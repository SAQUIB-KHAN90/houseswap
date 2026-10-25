-- Reviews, the trust score, and two corrections to 0002.
--
-- `reviews` and its policies have existed since 0001, but nothing ever wrote a
-- row and `profiles.trust_score` was never computed — it held whatever the seed
-- put there. This makes the badge mean something.
--
-- The formula is prd.md 15a. It is a mean pulled toward a prior, not a plain
-- average, so one five-star review cannot put a brand-new host above somebody
-- with forty.

-- ------------------------------------------------ who cancelled, and from where

-- prd.md 10a says a host who cancels after approving takes a trust-score
-- penalty. That was unenforceable: cancel_stay recorded neither who cancelled
-- nor what the stay's status had been, so afterwards a host cancellation was
-- indistinguishable from a guest one.
alter table stay_requests
  add column if not exists cancelled_by   uuid references profiles on delete set null,
  add column if not exists cancelled_from stay_status;

comment on column stay_requests.cancelled_from is
  'The status the stay was in when it was cancelled. A host cancelling from '
  'approved or confirmed is the case prd.md 10a penalises; cancelling a stay '
  'still at requested costs the guest nothing and is not penalised.';

-- Same as 0002, with the two columns recorded. The refund windows are unchanged.
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
                             deposit_state = 'none',
                             cancelled_by = auth.uid(),
                             cancelled_from = v.status
     where id = p_request;
    if v.paired_request_id is not null then
      update stay_requests set status = 'cancelled', points_held = 0,
                               cancelled_by = auth.uid(),
                               cancelled_from = status
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
     set status = 'cancelled', points_held = 0, deposit_state = 'none',
         cancelled_by = auth.uid(), cancelled_from = v.status
   where id = p_request;

  if v.paired_request_id is not null then
    update stay_requests set status = 'cancelled', points_held = 0,
                             cancelled_by = auth.uid(),
                             cancelled_from = status
     where id = v.paired_request_id;
  end if;
end;
$$;

-- ------------------------------------------------- pairing, with a caller check

-- 0002 granted pair_direct_swap to every signed-in member and then checked only
-- that the two legs mirror each other. It never asked whether the caller was
-- one of the two people. Knowing the ids was enough to link, price and put a
-- hold on two strangers' requests.
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
  -- The legs mirror each other, so the two people on the trade are exactly
  -- a.guest_id and a.host_id.
  if auth.uid() not in (a.guest_id, a.host_id) then
    raise exception 'only the two members trading can link a swap';
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

-- ------------------------------------------------------------- trust score

/*
 * The score on a profile. prd.md 15a has the reasoning.
 *
 *   (C*m + sum(ratings) + 1.0*host_cancellations) / (C + n + host_cancellations)
 *
 * Null, not 4.2, for a member with no history: the UI says "New member"
 * instead, because inventing a number for somebody nobody has stayed with is
 * the one thing a trust score must not do.
 */
create or replace function recompute_trust_score(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m        constant numeric := 4.2;   -- assumed rating of an unknown member
  c        constant numeric := 5;     -- reviews before their own record outweighs it
  v_sum    numeric;
  v_count  integer;
  v_cancels integer;
begin
  select coalesce(sum(rating), 0), count(*)
    into v_sum, v_count
    from reviews where target_id = p_user;

  -- Only a host walking away from a stay they had already approved. A guest
  -- cancelling already forfeits points on the 10a schedule.
  select count(*) into v_cancels
    from stay_requests
   where host_id = p_user
     and status = 'cancelled'
     and cancelled_by = p_user
     and cancelled_from in ('approved', 'confirmed');

  if v_count = 0 and v_cancels = 0 then
    update profiles set trust_score = null where id = p_user;
    return;
  end if;

  update profiles
     set trust_score = round(
           (c * m + v_sum + 1.0 * v_cancels) / (c + v_count + v_cancels),
           1
         )
   where id = p_user;
end;
$$;

create or replace function review_touches_trust() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform recompute_trust_score(new.target_id);
  return new;
end;
$$;

drop trigger if exists reviews_recompute_trust on reviews;
create trigger reviews_recompute_trust after insert on reviews
  for each row execute function review_touches_trust();

create or replace function cancellation_touches_trust() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and coalesce(old.status, 'requested') <> 'cancelled'
     and new.cancelled_by = new.host_id
     and new.cancelled_from in ('approved', 'confirmed') then
    perform recompute_trust_score(new.host_id);
  end if;
  return new;
end;
$$;

drop trigger if exists stays_recompute_trust on stay_requests;
create trigger stays_recompute_trust after update of status on stay_requests
  for each row execute function cancellation_touches_trust();

-- Everyone who already has rows gets a score consistent with the formula,
-- replacing whatever the seed wrote.
do $$
declare v_id uuid;
begin
  for v_id in select id from profiles loop
    perform recompute_trust_score(v_id);
  end loop;
end;
$$;

-- ------------------------------------------------------------------ reads

/*
 * Whether this member still owes a review on a stay.
 *
 * The app asks this to decide whether to prompt. The policy on `reviews` is
 * what actually decides whether the insert is allowed.
 */
create or replace function stays_awaiting_review()
returns table (stay_id uuid, target_id uuid)
language sql stable security definer set search_path = public as $$
  select s.id,
         case when s.guest_id = auth.uid() then s.host_id else s.guest_id end
    from stay_requests s
   where s.status = 'settled'
     and auth.uid() in (s.guest_id, s.host_id)
     and not exists (
       select 1 from reviews r
        where r.stay_id = s.id and r.author_id = auth.uid()
     );
$$;

grant execute on function stays_awaiting_review to authenticated;

-- recompute_trust_score is called by triggers only. No member calls it, and a
-- member who could would be able to rewrite their own score.
revoke execute on function recompute_trust_score(uuid) from public, authenticated;
