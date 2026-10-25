-- Settlement, on a schedule.
--
-- 0002 wrote `settle_stay` and left it ungranted, for "a scheduled job" that
-- did not exist. This is that job. Until it runs, a guest's points enter escrow
-- at request time and never reach the host: the economy takes money in and
-- never pays out.
--
-- It lives in the database rather than in the web app on purpose. Paying hosts
-- must not depend on Vercel being up, on a deploy having happened, or on anyone
-- remembering to call an endpoint.

-- ------------------------------------------------- when did check-out happen

-- `updated_at` cannot answer this: the touch trigger moves it on every write,
-- so a message, a dispute or an admin edit would all look like a fresh
-- check-out and push settlement another 24 hours away. Record the moment
-- itself.
alter table stay_requests
  add column if not exists checked_out_at timestamptz;

comment on column stay_requests.checked_out_at is
  'Set by check_out_stay. The 24-hour settlement window is measured from here, '
  'not from updated_at, which any write moves.';

-- Any stay already checked out when this migration runs has no recorded time.
-- updated_at is the best estimate available for those, and there are none in a
-- fresh project.
update stay_requests
   set checked_out_at = updated_at
 where status in ('checked_out', 'settled', 'disputed')
   and checked_out_at is null;

create index if not exists stay_requests_settlement_idx
  on stay_requests (checked_out_at)
  where status = 'checked_out';

-- Same function as 0002, with the timestamp recorded.
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
  update stay_requests
     set status = 'checked_out',
         checked_out_at = now()
   where id = p_request;
end;
$$;

-- ------------------------------------------------------------- the job

/*
 * Settles every stay whose 24 hours are up and which nobody has disputed.
 *
 * Each stay is settled in its own block, so one that cannot be settled — a
 * dispute raised in the same second, a row another transaction holds — is
 * logged and skipped instead of aborting the whole run. The next run picks it
 * up again.
 *
 * Returns how many settled, which makes a run visible in the cron job log.
 */
create or replace function settle_due_stays(p_after interval default interval '24 hours')
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid;
  v_settled integer := 0;
begin
  for v_id in
    select s.id
      from stay_requests s
     where s.status = 'checked_out'
       and s.checked_out_at is not null
       and s.checked_out_at < now() - p_after
       and not exists (
         select 1 from disputes d
          where d.stay_id = s.id and d.status in ('open', 'in_review')
       )
     order by s.checked_out_at
  loop
    begin
      perform settle_stay(v_id);
      v_settled := v_settled + 1;
    exception when others then
      raise warning 'could not settle stay %: %', v_id, sqlerrm;
    end;
  end loop;

  return v_settled;
end;
$$;

-- Members never call either of these. settle_stay was already revoked in 0003;
-- this one is not granted to anybody, so only the scheduler reaches it.
revoke execute on function settle_due_stays(interval) from public;

-- Scheduling it needs pg_cron, which a bare Postgres does not have and the
-- scenario tests run on. It lives in supabase/scheduled/settle.sql, applied
-- once against the real project. Nothing here depends on it: settle_due_stays()
-- can be called by hand, which is also how you test it.
