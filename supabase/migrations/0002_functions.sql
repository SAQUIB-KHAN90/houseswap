-- Points movement and the stay state machine.
--
-- Every function that moves points runs as a single statement, so a balance can
-- never be left half-updated. Spending is serialised per member by locking the
-- profile row, which is what stops two requests sent at the same moment from
-- both passing the balance check.
--
-- The refund windows in cancel_stay are the enforced copy of prd.md 10a. The
-- TypeScript in src/lib/points/rates.ts mirrors them so the app can tell a
-- member what a cancellation will cost; this file is the one that decides.

-- -------------------------------------------------- ledger is append-only

create or replace function reject_ledger_change() returns trigger
language plpgsql as $$
begin
  raise exception 'points_ledger is append-only: correct a mistake with a new row';
end;
$$;

create trigger points_ledger_no_update before update on points_ledger
  for each row execute function reject_ledger_change();
create trigger points_ledger_no_delete before delete on points_ledger
  for each row execute function reject_ledger_change();

-- ------------------------------------------------------------- balances

create or replace function points_balance(p_user uuid)
returns table (settled integer, held integer, available integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_settled integer;
  v_held    integer;
begin
  select coalesce(sum(delta), 0) into v_settled
    from points_ledger where user_id = p_user;

  -- Anything not yet resolved is still reserved.
  select coalesce(sum(points_held), 0) into v_held
    from stay_requests
   where guest_id = p_user
     and status in ('requested', 'approved', 'confirmed',
                    'checked_in', 'checked_out', 'disputed');

  return query select v_settled, v_held, v_settled - v_held;
end;
$$;

create or replace function my_points()
returns table (settled integer, held integer, available integer)
language sql stable security definer set search_path = public as $$
  select * from points_balance(auth.uid());
$$;

-- -------------------------------------------------------- requesting a stay

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

  -- Serialise this member's spending for the rest of the transaction.
  perform 1 from profiles where id = v_guest for update;

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

-- ------------------------------------------------------------ direct swaps

-- Links two requests into one trade and prices the difference. The side
-- receiving the more valuable stay holds the gap in points (prd.md 7b).
create or replace function pair_direct_swap(p_request uuid, p_counter_request uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a stay_requests;
  b stay_requests;
  v_delta integer;
  v_available integer;
begin
  select * into a from stay_requests where id = p_request for update;
  select * into b from stay_requests where id = p_counter_request for update;

  if a is null or b is null then
    raise exception 'both legs of the swap must exist';
  end if;
  if a.mode <> 'direct' or b.mode <> 'direct' then
    raise exception 'both legs must be direct-swap requests';
  end if;
  if a.guest_id <> b.host_id or a.host_id <> b.guest_id then
    raise exception 'a swap must be between the same two members';
  end if;
  if a.status <> 'requested' or b.status <> 'requested' then
    raise exception 'both legs must still be open';
  end if;

  -- What A's guest receives, less what they give up.
  v_delta := a.points_total - b.points_total;

  if v_delta > 0 then
    perform 1 from profiles where id = a.guest_id for update;
    select available into v_available from points_balance(a.guest_id);
    if v_available < v_delta then
      raise exception 'the more valuable home needs % points to balance, % available',
        v_delta, v_available;
    end if;
  elsif v_delta < 0 then
    perform 1 from profiles where id = b.guest_id for update;
    select available into v_available from points_balance(b.guest_id);
    if v_available < -v_delta then
      raise exception 'the more valuable home needs % points to balance, % available',
        -v_delta, v_available;
    end if;
  end if;

  update stay_requests
     set paired_request_id = b.id,
         swap_points_delta = v_delta,
         points_held = greatest(v_delta, 0)
   where id = a.id;

  update stay_requests
     set paired_request_id = a.id,
         swap_points_delta = -v_delta,
         points_held = greatest(-v_delta, 0)
   where id = b.id;
end;
$$;

-- ----------------------------------------------------------- host decisions

create or replace function approve_stay(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v stay_requests;
  v_other stay_requests;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can approve'; end if;
  if v.status <> 'requested' then raise exception 'request is not open'; end if;

  update stay_requests set status = 'approved' where id = p_request;

  if v.mode = 'direct' and v.paired_request_id is not null then
    select * into v_other from stay_requests where id = v.paired_request_id for update;
    -- A trade is only on once both sides have said yes.
    if v_other.status = 'approved' then
      update stay_requests set status = 'confirmed'
       where id in (p_request, v_other.id);
    end if;
  end if;
end;
$$;

create or replace function decline_stay(p_request uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v stay_requests;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v.host_id <> auth.uid() then raise exception 'only the host can decline'; end if;
  if v.status not in ('requested', 'approved') then
    raise exception 'request can no longer be declined';
  end if;

  -- Releasing the hold is all it takes: nothing was ever taken from the ledger.
  update stay_requests
     set status = 'declined', points_held = 0, deposit_state = 'none'
   where id = p_request;

  if v.mode = 'direct' and v.paired_request_id is not null then
    update stay_requests
       set status = 'cancelled', points_held = 0
     where id = v.paired_request_id;
  end if;
end;
$$;

create or replace function confirm_stay(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v stay_requests;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v.guest_id <> auth.uid() then raise exception 'only the guest can confirm'; end if;
  if v.status <> 'approved' then raise exception 'request is not approved'; end if;

  update stay_requests
     set status = 'confirmed', rules_accepted_at = now()
   where id = p_request;
end;
$$;

-- ----------------------------------------------------------- cancellation

-- Enforced copy of prd.md 10a: full refund beyond a week, half between two
-- days and a week, nothing inside 48 hours.
create or replace function cancel_stay(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v        stay_requests;
  v_hours  numeric;
  v_share  numeric;
  v_to_host integer;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v.status not in ('requested', 'approved', 'confirmed') then
    raise exception 'this stay can no longer be cancelled';
  end if;

  -- The host cancelling always returns the guest's points in full.
  if v.host_id = auth.uid() then
    update stay_requests set status = 'cancelled', points_held = 0,
                             deposit_state = 'none'
     where id = p_request;
    if v.paired_request_id is not null then
      update stay_requests set status = 'cancelled', points_held = 0
       where id = v.paired_request_id;
    end if;
    return;
  end if;

  if v.guest_id <> auth.uid() then
    raise exception 'only the guest or the host can cancel';
  end if;

  v_hours := extract(epoch from (v.starts_on::timestamptz - now())) / 3600;
  v_share := case
               when v_hours > 24 * 7 then 0
               when v_hours >= 48   then 0.5
               else 1
             end;
  v_to_host := round(v.points_held * v_share);

  if v_to_host > 0 then
    insert into points_ledger (user_id, delta, kind, stay_id, note)
    values (v.guest_id, -v_to_host, 'stay_spent', p_request, 'late cancellation'),
           (v.host_id,   v_to_host, 'stay_earned', p_request, 'late cancellation');
  end if;

  update stay_requests
     set status = 'cancelled', points_held = 0, deposit_state = 'none'
   where id = p_request;

  if v.paired_request_id is not null then
    update stay_requests set status = 'cancelled', points_held = 0
     where id = v.paired_request_id;
  end if;
end;
$$;

-- ------------------------------------------------------------- settlement

create or replace function check_in_stay(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v stay_requests;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if auth.uid() not in (v.guest_id, v.host_id) then
    raise exception 'not your stay';
  end if;
  if v.status <> 'confirmed' then raise exception 'stay is not confirmed'; end if;
  update stay_requests set status = 'checked_in' where id = p_request;
end;
$$;

create or replace function check_out_stay(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v stay_requests;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if auth.uid() not in (v.guest_id, v.host_id) then
    raise exception 'not your stay';
  end if;
  if v.status <> 'checked_in' then raise exception 'stay is not in progress'; end if;
  update stay_requests set status = 'checked_out' where id = p_request;
end;
$$;

-- Moves the held points to the host. Called by a scheduled job 24 hours after
-- check-out when no dispute was raised, so it takes no caller identity.
create or replace function settle_stay(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v stay_requests;
  v_amount integer;
begin
  select * into v from stay_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if v.status <> 'checked_out' then
    raise exception 'stay has not been checked out';
  end if;
  if exists (select 1 from disputes where stay_id = p_request and status in ('open','in_review')) then
    raise exception 'stay has an open dispute';
  end if;

  -- Points mode moves the whole stay value; a direct swap moves only the gap.
  v_amount := case when v.mode = 'points' then v.points_total
                   else greatest(v.swap_points_delta, 0) end;

  if v_amount > 0 then
    insert into points_ledger (user_id, delta, kind, stay_id, note)
    values (v.guest_id, -v_amount,
            case when v.mode = 'points' then 'stay_spent'::ledger_kind
                 else 'swap_settlement'::ledger_kind end,
            p_request, 'stay completed'),
           (v.host_id, v_amount,
            case when v.mode = 'points' then 'stay_earned'::ledger_kind
                 else 'swap_settlement'::ledger_kind end,
            p_request, 'stay completed');
  end if;

  update stay_requests
     set status = 'settled',
         points_held = 0,
         deposit_state = case when v.deposit_state = 'held'
                              then 'released'::deposit_status
                              else v.deposit_state end
   where id = p_request;
end;
$$;

-- --------------------------------------------------------------- onboarding

-- Starter points, once per member, on passing verification (prd.md 7a).
create or replace function grant_starter_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kyc_status = 'verified' and coalesce(old.kyc_status, 'unverified') <> 'verified'
     and not exists (
       select 1 from points_ledger
        where user_id = new.id and kind = 'starter_bonus'
     ) then
    insert into points_ledger (user_id, delta, kind, note)
    values (new.id, 100, 'starter_bonus', 'welcome to the pilot');
  end if;
  return new;
end;
$$;

create trigger profiles_starter_points after update of kyc_status on profiles
  for each row execute function grant_starter_points();

-- 25 points the first time a listing goes live.
create or replace function grant_first_listing_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and coalesce(old.status, 'draft') <> 'active'
     and not exists (
       select 1 from points_ledger
        where user_id = new.host_id and kind = 'listing_bonus'
     ) then
    insert into points_ledger (user_id, delta, kind, note)
    values (new.host_id, 25, 'listing_bonus', 'first listing published');
  end if;
  return new;
end;
$$;

create trigger listings_first_bonus after update of status on listings
  for each row execute function grant_first_listing_bonus();
