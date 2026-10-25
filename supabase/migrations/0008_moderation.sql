-- Moderation, the audit log, and realtime on messages.
--
-- prd.md 8 says flagged users are reviewed by staff and 9 gives outcomes of
-- "account warning/suspension", but nothing could suspend anybody: staff had a
-- dispute queue and no other power. architecture.md 8 also asks for
-- "role-based admin access with audit logs", and there was no audit log at all
-- — a staff member could move points through resolve_dispute and leave no trace
-- of who did it or why.
--
-- Both gaps are closed here. Every staff action goes through a function that
-- writes an `admin_actions` row in the same transaction, so an action without a
-- record is not possible.

-- ---------------------------------------------------------------- suspension

alter table profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

comment on column profiles.suspended_at is
  'Set by suspend_member. A suspended member keeps their points and history but '
  'cannot request a stay or publish a listing, and their homes are paused.';

create index if not exists profiles_suspended_idx on profiles (suspended_at)
  where suspended_at is not null;

create or replace function is_suspended(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from profiles where id = p_user), false);
$$;

grant execute on function is_suspended(uuid) to authenticated;

-- ---------------------------------------------------------------- audit log

create table if not exists admin_actions (
  id         bigserial primary key,
  actor_id   uuid references profiles on delete set null,
  action     text not null,
  target_user uuid references profiles on delete set null,
  target_stay uuid references stay_requests on delete set null,
  target_dispute uuid references disputes on delete set null,
  reason     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_recent_idx
  on admin_actions (created_at desc);
create index if not exists admin_actions_target_idx
  on admin_actions (target_user, created_at desc);

alter table admin_actions enable row level security;

drop policy if exists admin_actions_staff_read on admin_actions;
create policy admin_actions_staff_read on admin_actions
  for select using (is_staff());

-- No insert policy, deliberately. Rows are written by the security-definer
-- functions below, so a staff member cannot act without being logged, and
-- cannot write a log entry describing something they did not do.
grant select on admin_actions to authenticated;

create or replace function log_admin_action(
  p_action  text,
  p_user    uuid default null,
  p_stay    uuid default null,
  p_dispute uuid default null,
  p_reason  text default null,
  p_detail  jsonb default null
) returns void
language sql security definer set search_path = public as $$
  insert into admin_actions (actor_id, action, target_user, target_stay,
                             target_dispute, reason, detail)
  values (auth.uid(), p_action, p_user, p_stay, p_dispute,
          nullif(trim(p_reason), ''), p_detail);
$$;

revoke execute on function log_admin_action(text, uuid, uuid, uuid, text, jsonb)
  from public, authenticated;

-- ------------------------------------------------------- suspend and restore

create or replace function suspend_member(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_paused integer;
begin
  if not is_staff() then
    raise exception 'only staff can suspend a member';
  end if;
  if p_user = auth.uid() then
    raise exception 'you cannot suspend yourself';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'give a reason: it goes in the audit log';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    raise exception 'member not found';
  end if;

  update profiles
     set suspended_at = now(), suspended_reason = trim(p_reason)
   where id = p_user and suspended_at is null;

  if not found then
    raise exception 'that member is already suspended';
  end if;

  -- Their homes come off search too. Pausing rather than unpublishing means
  -- restoring them is one statement and nothing is lost.
  update listings set status = 'paused'
   where host_id = p_user and status = 'active';
  get diagnostics v_paused = row_count;

  -- Stays already confirmed are left alone on purpose. Someone is mid-trip, or
  -- about to be, and cancelling on them is a separate decision with its own
  -- points consequences under prd.md 10a.
  perform log_admin_action('suspend_member', p_user, null, null, p_reason,
                           jsonb_build_object('listings_paused', v_paused));
end;
$$;

create or replace function restore_member(p_user uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'only staff can restore a member';
  end if;

  update profiles
     set suspended_at = null, suspended_reason = null
   where id = p_user and suspended_at is not null;

  if not found then
    raise exception 'that member is not suspended';
  end if;

  -- Listings are not un-paused automatically: the host chooses when their home
  -- goes back on search.
  perform log_admin_action('restore_member', p_user, null, null, p_reason, null);
end;
$$;

grant execute on function suspend_member(uuid, text), restore_member(uuid, text)
  to authenticated;

-- ------------------------------------------------------- staff point changes

-- The ledger has an `admin_adjustment` kind and there was no way to write one:
-- members cannot insert, and nothing else did. This is it, and it is logged.
create or replace function adjust_points(p_user uuid, p_delta integer, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'only staff can adjust points';
  end if;
  if p_delta = 0 then
    raise exception 'an adjustment of zero does nothing';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'give a reason: it goes in the audit log and on the member''s history';
  end if;

  insert into points_ledger (user_id, delta, kind, note, created_by)
  values (p_user, p_delta, 'admin_adjustment', trim(p_reason), auth.uid());

  perform log_admin_action('adjust_points', p_user, null, null, p_reason,
                           jsonb_build_object('delta', p_delta));
end;
$$;

grant execute on function adjust_points(uuid, integer, text) to authenticated;

-- ------------------------------------------- disputes leave a trace as well

-- Same body as 0004 with the audit row added. Resolving a dispute moves points
-- between two members on a staff member's say-so, which is exactly the kind of
-- act that must not be anonymous.
create or replace function resolve_dispute(
  p_dispute    uuid,
  p_to_host    integer,
  p_resolution text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dispute disputes;
  v_stay    stay_requests;
begin
  if not is_staff() then
    raise exception 'only staff can resolve a dispute';
  end if;

  select * into v_dispute from disputes where id = p_dispute for update;
  if not found then raise exception 'dispute not found'; end if;
  if v_dispute.status in ('resolved', 'rejected') then
    raise exception 'this dispute is already closed';
  end if;

  select * into v_stay from stay_requests where id = v_dispute.stay_id for update;
  if not found then raise exception 'stay not found'; end if;

  if p_to_host < 0 or p_to_host > v_stay.points_held then
    raise exception 'award between 0 and % points, the amount held', v_stay.points_held;
  end if;

  if p_to_host > 0 then
    insert into points_ledger (user_id, delta, kind, stay_id, note, created_by)
    values (v_stay.guest_id, -p_to_host, 'dispute_adjustment', v_stay.id,
            coalesce(nullif(trim(p_resolution), ''), 'dispute resolved'), auth.uid()),
           (v_stay.host_id,   p_to_host, 'dispute_adjustment', v_stay.id,
            coalesce(nullif(trim(p_resolution), ''), 'dispute resolved'), auth.uid());
  end if;

  update stay_requests
     set status = 'settled',
         points_held = 0,
         deposit_state = case
           when v_stay.deposit_state <> 'held' then v_stay.deposit_state
           when p_to_host > 0 then 'forfeited'::deposit_status
           else 'released'::deposit_status
         end
   where id = v_stay.id;

  update disputes
     set status       = case when p_to_host > 0 then 'resolved'::dispute_status
                             else 'rejected'::dispute_status end,
         resolution   = nullif(trim(p_resolution), ''),
         points_moved = p_to_host,
         resolved_by  = auth.uid(),
         resolved_at  = now()
   where id = p_dispute;

  update disputes
     set status = 'rejected'::dispute_status,
         resolution = 'closed with the other claim on this stay',
         resolved_by = auth.uid(),
         resolved_at = now()
   where stay_id = v_stay.id
     and id <> p_dispute
     and status in ('open', 'in_review');

  perform log_admin_action('resolve_dispute', v_dispute.raised_by, v_stay.id,
                           p_dispute, p_resolution,
                           jsonb_build_object('points_to_host', p_to_host));
end;
$$;

-- --------------------------------------------- suspension actually bites

-- Same as 0002/0007 with the suspension check. Without this, suspension would
-- be cosmetic: a suspended member could carry on booking.
create or replace function request_stay(
  p_listing uuid,
  p_start   date,
  p_end     date,
  p_mode    stay_mode default 'points'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_guest     uuid := auth.uid();
  v_listing   listings;
  v_nights    integer;
  v_total     integer;
  v_available integer;
  v_id        uuid;
begin
  if v_guest is null then
    raise exception 'not signed in';
  end if;

  perform 1 from profiles where id = v_guest for update;

  if (select suspended_at from profiles where id = v_guest) is not null then
    raise exception 'your account is suspended: contact support';
  end if;

  if (select kyc_status from profiles where id = v_guest) <> 'verified' then
    raise exception 'verify your identity before requesting a stay';
  end if;

  select * into v_listing from listings where id = p_listing;
  if not found then
    raise exception 'listing not found';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing is not accepting requests';
  end if;
  if v_listing.host_id = v_guest then
    raise exception 'you cannot request your own home';
  end if;
  if (select suspended_at from profiles where id = v_listing.host_id) is not null then
    raise exception 'this home is not accepting requests';
  end if;
  if p_mode = 'points' and not v_listing.accepts_points then
    raise exception 'this home does not accept points';
  end if;
  if p_mode = 'direct' and not v_listing.accepts_direct_swap then
    raise exception 'this home does not accept direct swaps';
  end if;

  v_nights := p_end - p_start;
  if v_nights <= 0 then
    raise exception 'check-out must be after check-in';
  end if;

  if not exists (
    select 1 from availability
     where listing_id = p_listing
       and daterange(starts_on, ends_on, '[)') @> daterange(p_start, p_end, '[)')
  ) then
    raise exception 'those dates are not open on this listing';
  end if;

  v_total := v_nights * v_listing.points_per_night;

  if p_mode = 'points' then
    select available into v_available from points_balance(v_guest);
    if v_available < v_total then
      raise exception 'not enough points: need %, have %', v_total, v_available;
    end if;
  end if;

  insert into stay_requests (
    listing_id, guest_id, host_id, mode, starts_on, ends_on, nights,
    points_per_night, points_total, points_held, deposit_inr, deposit_state
  ) values (
    p_listing, v_guest, v_listing.host_id, p_mode, p_start, p_end, v_nights,
    v_listing.points_per_night, v_total,
    case when p_mode = 'points' then v_total else 0 end,
    v_listing.deposit_inr,
    case when v_listing.deposit_inr > 0 then 'pending'::deposit_status
         else 'none'::deposit_status end
  ) returning id into v_id;

  return v_id;
end;
$$;

-- A suspended host cannot put a home back on search either.
drop policy if exists listings_write_own on listings;
create policy listings_write_own on listings
  for all using (host_id = auth.uid())
  with check (host_id = auth.uid() and not is_suspended(auth.uid()));

-- --------------------------------------------- columns members must not set

/*
 * `profiles_update_own` lets a member write their own row, and a row-level
 * policy cannot restrict which columns. So until now a member could run
 *
 *     update profiles set kyc_status = 'verified' where id = auth.uid();
 *
 * and be verified, collect the starter points and book a stranger's home —
 * with no provider involved and the application-side placeholder bypassed
 * entirely. The same trick cleared a suspension or granted staff rights.
 *
 * This refuses those columns from member-level roles. The test is `current_user`,
 * not auth.uid(): a SECURITY DEFINER function runs as its owner, so
 * suspend_member, the KYC webhook on the service role, and the trust-score
 * triggers all pass, while a direct write from `authenticated` does not.
 */
-- Deliberately SECURITY INVOKER, which is the default and the whole point:
-- inside a SECURITY DEFINER function `current_user` is the function's owner,
-- so a definer trigger would see "postgres" for everybody and wave every write
-- through. As an invoker it sees the role that actually issued the update.
create or replace function guard_profile_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;   -- a definer function, the service role, or a migration
  end if;

  if is_staff() then
    return new;
  end if;

  if new.kyc_status    is distinct from old.kyc_status
     or new.kyc_reference is distinct from old.kyc_reference
     or new.selfie_match  is distinct from old.selfie_match then
    raise exception 'identity verification is set by the provider, not by you';
  end if;

  if new.is_staff is distinct from old.is_staff then
    raise exception 'staff access is not self-granted';
  end if;

  if new.suspended_at is distinct from old.suspended_at
     or new.suspended_reason is distinct from old.suspended_reason then
    raise exception 'only staff can change a suspension';
  end if;

  if new.trust_score is distinct from old.trust_score then
    raise exception 'the trust score is computed, not set';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_columns on profiles;
create trigger profiles_guard_columns before update on profiles
  for each row execute function guard_profile_columns();

-- -------------------------------------------------------- staff member list

-- Staff need to see members to act on them, and `profiles_read_own` stops even
-- them: is_staff() is in that policy, so this is really a convenience view with
-- the contact details left out, same as host_cards.
create or replace view staff_members
  with (security_invoker = true)
  as select p.id, p.full_name, p.home_city, p.kyc_status, p.trust_score,
            p.is_staff, p.suspended_at, p.suspended_reason, p.created_at,
            (select count(*) from stay_requests s
              where s.host_id = p.id and s.status = 'settled') as stays_hosted,
            (select count(*) from stay_requests s
              where s.guest_id = p.id and s.status = 'settled') as stays_taken,
            (select count(*) from disputes d
               join stay_requests s on s.id = d.stay_id
              where p.id in (s.guest_id, s.host_id)) as disputes_involved
       from profiles p;

grant select on staff_members to authenticated;

-- ------------------------------------------------------------- realtime

-- Lets the chat subscribe instead of refetching after every send. Wrapped
-- because `supabase_realtime` is a Supabase publication and a bare Postgres,
-- which the scenario tests run on, does not have it.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = 'messages'
    ) then
      execute 'alter publication supabase_realtime add table messages';
    end if;
  end if;
end;
$$;

-- Realtime respects row-level security, so `messages_parties` still decides who
-- receives a row. Subscribing does not widen what anyone can read.
