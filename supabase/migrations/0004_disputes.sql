-- Resolving a dispute.
--
-- 0002 stops a disputed stay from settling but never says how one ends. This
-- does. Staff decide how much of the guest's hold the host keeps, and the same
-- call closes the dispute, writes the ledger rows and clears the hold, so a
-- stay can never be left half-resolved.
--
-- It has to be a function rather than a policy: `points_ledger` takes no
-- inserts from members and `stay_requests` takes no updates at all, which is
-- what keeps the balance rules from being side-stepped (0003).

-- Opening a claim is what moves a checked-out stay into dispute. Without this
-- the status stays 'checked_out' and the scheduled job would settle it anyway
-- 24 hours later, paying out a stay somebody has complained about.
create or replace function mark_stay_disputed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update stay_requests
     set status = 'disputed'
   where id = new.stay_id
     and status in ('checked_out', 'settled');
  return new;
end;
$$;

drop trigger if exists disputes_mark_stay on disputes;
create trigger disputes_mark_stay after insert on disputes
  for each row execute function mark_stay_disputed();

/*
 * Closes a dispute and splits the hold.
 *
 * `p_to_host` is how many of the held points the host keeps: the whole hold for
 * a claim upheld in full, zero for one rejected, anything between for a partial
 * deduction. Whatever is not awarded simply stops being held and stays with the
 * guest, because a hold was never taken out of their balance in the first place
 * (architecture.md, "why holds are not ledger rows").
 */
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

  -- Any other claim on the same stay dies with it: the hold is gone.
  update disputes
     set status = 'rejected'::dispute_status,
         resolution = 'closed with the other claim on this stay',
         resolved_by = auth.uid(),
         resolved_at = now()
   where stay_id = v_stay.id
     and id <> p_dispute
     and status in ('open', 'in_review');
end;
$$;

-- Staff only, and the function checks that itself: the grant is to every signed-in
-- member because `is_staff()` is the gate, exactly as the update policy on
-- `disputes` works.
grant execute on function resolve_dispute(uuid, integer, text) to authenticated;

-- Picking a claim up for review, short of deciding it.
create or replace function take_dispute(p_dispute uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'only staff can review a dispute';
  end if;
  update disputes set status = 'in_review'
   where id = p_dispute and status = 'open';
end;
$$;

grant execute on function take_dispute(uuid) to authenticated;
