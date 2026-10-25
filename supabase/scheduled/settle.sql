-- Schedules settlement. Run once, in the Supabase SQL editor, after the
-- migrations are applied.
--
-- This is not a migration because it needs pg_cron, which the scenario tests
-- run without. `settle_due_stays()` from 0005 does the actual work and can be
-- called by hand at any time; this only arranges for it to be called.
--
-- Check it afterwards with:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--
-- To stop it:  select cron.unschedule('settle-due-stays');

create extension if not exists pg_cron;

-- Safe to re-run: drop any existing schedule under this name first.
do $$
begin
  perform cron.unschedule('settle-due-stays');
exception when others then
  null;   -- not scheduled yet, which is the normal case on a first run
end;
$$;

-- Hourly rather than daily. The window is 24 hours from check-out, so an hourly
-- sweep settles a stay within an hour of becoming due instead of up to a day
-- later. Minute 7 keeps it clear of everyone else's on-the-hour jobs.
select cron.schedule(
  'settle-due-stays',
  '7 * * * *',
  $$select settle_due_stays()$$
);
