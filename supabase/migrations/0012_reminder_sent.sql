-- Remembering that a check-out reminder went out.
--
-- The reminder job used to select a one-hour slice of check-outs and lean on
-- running hourly for exactly-once delivery. That is a hidden dependency on the
-- schedule: a Vercel Hobby account allows only a daily cron, and on a daily run
-- that slice misses twenty-three hours out of every twenty-four.
--
-- Recording the send makes the job idempotent instead. It can run hourly,
-- daily, twice, or by hand, and each stay is still reminded once.

alter table stay_requests
  add column if not exists reminder_sent_at timestamptz;

comment on column stay_requests.reminder_sent_at is
  'When the check-out reminder went out. The job selects stays whose 24-hour '
  'window is still open and where this is null, so delivery is exactly-once '
  'regardless of how often the job runs.';

-- The job asks for "still checked out, not yet reminded" on every run.
create index if not exists stay_requests_reminder_idx
  on stay_requests (checked_out_at)
  where status = 'checked_out' and reminder_sent_at is null;
