-- Where a member wants to be told things.
--
-- prd.md 11 lists "notifications (email, WhatsApp/SMS later)". Email went in
-- with the settlement work; this is the rest of the row.
--
-- Two things decide the shape of it, and both are legal rather than technical:
--
--   * **DPDP consent.** A phone number given to run a stay is not consent to
--     be messaged on it. WhatsApp and SMS are therefore opt-in, default false,
--     and a member can switch them off again from their profile.
--
--   * **TRAI/DLT.** Transactional SMS to an Indian number cannot be sent at
--     all until the sender and every template are registered on a DLT
--     platform, and WhatsApp business-initiated messages need templates Meta
--     has approved. Both take weeks. The code below is ready for them; see
--     src/lib/notify/README or the main README for what has to be registered.

alter table profiles
  add column if not exists notify_email    boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default false,
  add column if not exists notify_sms      boolean not null default false,
  add column if not exists phone_verified  boolean not null default false;

comment on column profiles.notify_whatsapp is
  'Opt-in. A phone number given so a host can reach a guest is not consent to '
  'be marketed or messaged on it (DPDP).';

comment on column profiles.phone_verified is
  'Set when the number has been confirmed by an OTP. Nothing sets it yet: '
  'until it does, a member can opt in with a number that is not theirs, so '
  'the sender treats an unverified number as not reachable.';

-- A member choosing their own channels is ordinary profile editing, so the
-- guard from 0008 must not refuse it. It names the columns it protects, and
-- these are not among them — this comment exists so the next person adding a
-- column to that guard knows these were considered and left out on purpose.

-- ----------------------------------------------------------- who to reach

/*
 * The channels a member can actually be reached on right now.
 *
 * Preference alone is not enough: WhatsApp and SMS also need a phone number,
 * and one that has been verified. Returning the intersection here means the
 * sender never has to work out the rule a second time, and a member who opted
 * in before verifying simply gets email until they do.
 */
create or replace function notify_channels(p_user uuid)
returns table (channel text, address text)
language sql stable security definer set search_path = public as $$
  select 'email', p.email
    from profiles p
   where p.id = p_user and p.notify_email and p.email is not null
  union all
  select 'whatsapp', p.phone
    from profiles p
   where p.id = p_user and p.notify_whatsapp
     and p.phone is not null and p.phone_verified
  union all
  select 'sms', p.phone
    from profiles p
   where p.id = p_user and p.notify_sms
     and p.phone is not null and p.phone_verified;
$$;

-- Read by the notification code on the service role, which bypasses RLS: a
-- guest cannot read the host's address and should not be able to.
revoke execute on function notify_channels(uuid) from public, authenticated;
