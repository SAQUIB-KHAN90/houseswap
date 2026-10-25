-- Rate limits on requests and chat, and a public approximate location.
--
-- architecture.md 8 asks for "rate limiting and abuse detection on requests and
-- chat" and nothing implemented it. architecture.md 2 lists maps for city
-- search, and no listing had a coordinate anywhere a browser could read.

-- ----------------------------------------------------------- rate limiting

/*
 * Enforced by triggers on the tables themselves rather than inside
 * `request_stay` or the application.
 *
 * It means the limit holds however the row arrives — through the function,
 * through a future admin path, through a direct insert if a policy ever
 * loosens — and it avoids recreating a ninety-line function for a four-line
 * rule.
 *
 * The counts come from the rows already there. A dedicated counter table would
 * need its own cleanup and could drift from reality; this cannot, and at pilot
 * volumes the index makes it cheap.
 */

-- Counting by author and time is the access pattern these add.
create index if not exists stay_requests_rate_idx
  on stay_requests (guest_id, created_at desc);
create index if not exists messages_rate_idx
  on messages (sender_id, created_at desc);

-- Chosen to sit far above real use and far below what abuse needs. A member
-- booking a trip looks at a handful of homes; nobody sends twenty messages in
-- a minute by hand.
create or replace function enforce_request_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_hour integer;
  v_day  integer;
begin
  select count(*) into v_hour from stay_requests
   where guest_id = new.guest_id and created_at > now() - interval '1 hour';
  if v_hour >= 10 then
    raise exception 'too many requests in the last hour: wait a little before asking again';
  end if;

  select count(*) into v_day from stay_requests
   where guest_id = new.guest_id and created_at > now() - interval '1 day';
  if v_day >= 40 then
    raise exception 'too many requests today: wait a little before asking again';
  end if;

  return new;
end;
$$;

drop trigger if exists stay_requests_rate_limit on stay_requests;
create trigger stay_requests_rate_limit before insert on stay_requests
  for each row execute function enforce_request_rate();

create or replace function enforce_message_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_minute integer;
  v_hour   integer;
begin
  select count(*) into v_minute from messages
   where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if v_minute >= 20 then
    raise exception 'you are sending messages too quickly: wait a moment';
  end if;

  select count(*) into v_hour from messages
   where sender_id = new.sender_id and created_at > now() - interval '1 hour';
  if v_hour >= 200 then
    raise exception 'too many messages in the last hour: wait a little';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit on messages;
create trigger messages_rate_limit before insert on messages
  for each row execute function enforce_message_rate();

-- ------------------------------------------------------ approximate location

/*
 * Where a home roughly is, for the map on search and on a listing.
 *
 * It has to live on `listings`, not on `listing_addresses`. That table already
 * carries latitude and longitude and is the right place for the exact point —
 * but its policy hides it until the host approves a stay, which is the whole
 * reason it exists. A map a visitor can see cannot read from there.
 *
 * So: two locations, with different precisions and different audiences. The
 * public one is rounded to three decimals, about 100 m, and the map draws a
 * circle rather than a pin. Nobody should be able to pick out the building
 * from a listing they have not been approved for.
 */
alter table listings
  add column if not exists approx_latitude  double precision,
  add column if not exists approx_longitude double precision;

-- Dropped first because `add constraint` has no IF NOT EXISTS, and a migration
-- that cannot be run twice is a migration that strands you halfway through a
-- failed apply.
alter table listings drop constraint if exists approx_latitude_range;
alter table listings drop constraint if exists approx_longitude_range;
alter table listings
  add constraint approx_latitude_range
    check (approx_latitude is null or approx_latitude between -90 and 90),
  add constraint approx_longitude_range
    check (approx_longitude is null or approx_longitude between -180 and 180);

comment on column listings.approx_latitude is
  'Public, rounded to ~100 m. The exact point belongs on listing_addresses, '
  'which is withheld until the host approves a stay.';

-- Rounding happens here, not in the browser, so a crafted request cannot store
-- a precise point in a column the whole world can read.
create or replace function round_approx_location() returns trigger
language plpgsql as $$
begin
  new.approx_latitude  := round(new.approx_latitude::numeric,  3)::double precision;
  new.approx_longitude := round(new.approx_longitude::numeric, 3)::double precision;
  return new;
end;
$$;

drop trigger if exists listings_round_location on listings;
create trigger listings_round_location before insert or update of
  approx_latitude, approx_longitude on listings
  for each row execute function round_approx_location();
