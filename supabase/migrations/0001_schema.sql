-- HouseSwap core schema
-- Decisions encoded here: both swap modes (prd.md 7b), points holds from day
-- one with Razorpay deposit fields ready for phase 2 (7c), and members who may
-- join without a listing (4a).

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ---------------------------------------------------------------- enumerations

create type offering_type as enum ('home', 'room_kitchen', 'room');
create type kyc_status    as enum ('unverified', 'pending', 'verified', 'rejected');
create type listing_status as enum ('draft', 'active', 'paused');
create type stay_mode     as enum ('points', 'direct');
create type stay_status   as enum (
  'requested', 'approved', 'confirmed', 'checked_in',
  'checked_out', 'settled', 'declined', 'cancelled', 'disputed'
);
create type ledger_kind   as enum (
  'starter_bonus', 'listing_bonus', 'topup',
  'stay_spent', 'stay_earned', 'swap_settlement',
  'dispute_adjustment', 'admin_adjustment'
);
create type checklist_phase as enum ('checkin', 'checkout');
create type dispute_status  as enum ('open', 'in_review', 'resolved', 'rejected');
create type deposit_status  as enum ('none', 'pending', 'held', 'released', 'forfeited');

-- -------------------------------------------------------------------- profiles

create table profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text not null,
  phone         text,
  email         text,
  home_city     text,
  kyc_status    kyc_status not null default 'unverified',
  kyc_reference text,          -- provider's handle; never the Aadhaar number
  selfie_match  boolean not null default false,
  trust_score   numeric(2,1),
  is_staff      boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint trust_score_range check (trust_score is null or trust_score between 0 and 5)
);

comment on column profiles.kyc_reference is
  'Opaque reference from the verification provider. Aadhaar numbers are never stored.';

-- Hosting is optional: a member with no listing can still travel on points.
create table listings (
  id                   uuid primary key default gen_random_uuid(),
  host_id              uuid not null references profiles on delete cascade,
  title                text not null,
  description          text,
  offering             offering_type not null,
  city                 text not null,
  area                 text not null,
  bedrooms             smallint not null default 1,
  max_guests           smallint not null default 2,
  amenities            text[] not null default '{}',
  house_rules          text[] not null default '{}',
  host_present         boolean not null default false,
  accepts_points       boolean not null default true,
  accepts_direct_swap  boolean not null default false,
  points_per_night     integer not null,
  deposit_inr          integer not null default 0,
  status               listing_status not null default 'draft',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint bedrooms_positive   check (bedrooms between 1 and 20),
  constraint guests_positive     check (max_guests between 1 and 30),
  constraint rate_positive       check (points_per_night > 0),
  constraint deposit_not_negative check (deposit_inr >= 0),
  -- A listing nobody can book is not a listing.
  constraint at_least_one_mode   check (accepts_points or accepts_direct_swap)
);

create index listings_search_idx on listings (city, offering, status);
create index listings_host_idx on listings (host_id);

comment on column listings.points_per_night is
  'Set by pointsPerNight() in src/lib/points/rates.ts and frozen on the row, so a '
  'later rule change never reprices a live listing.';

-- The street address is kept apart so it can have its own access rule.
create table listing_addresses (
  listing_id   uuid primary key references listings on delete cascade,
  address_line text not null,
  pincode      text,
  latitude     double precision,
  longitude    double precision
);

create table listing_photos (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references listings on delete cascade,
  storage_path text not null,
  room         text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index listing_photos_listing_idx on listing_photos (listing_id, sort_order);

create table availability (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  constraint availability_ordered check (ends_on > starts_on),
  -- One listing cannot publish two overlapping open windows.
  exclude using gist (
    listing_id with =,
    daterange(starts_on, ends_on, '[)') with &&
  )
);

-- --------------------------------------------------------------- stay requests

create table stay_requests (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references listings on delete restrict,
  guest_id           uuid not null references profiles on delete restrict,
  host_id            uuid not null references profiles on delete restrict,
  mode               stay_mode not null default 'points',
  starts_on          date not null,
  ends_on            date not null,
  nights             integer not null,
  points_per_night   integer not null,   -- copied from the listing at request time
  points_total       integer not null,   -- nights x points_per_night
  points_held        integer not null default 0,
  -- Direct swaps: the other leg, and the points that balance an unequal trade.
  paired_request_id  uuid unique references stay_requests on delete set null,
  swap_points_delta  integer not null default 0,
  -- Phase 2, Razorpay. Fields exist now so no migration is needed later.
  deposit_inr        integer not null default 0,
  deposit_state      deposit_status not null default 'none',
  payment_reference  text,
  status             stay_status not null default 'requested',
  rules_accepted_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint stay_dates_ordered check (ends_on > starts_on),
  constraint nights_match      check (nights = (ends_on - starts_on)),
  constraint nights_positive   check (nights > 0),
  constraint total_matches     check (points_total = nights * points_per_night),
  constraint held_not_negative check (points_held >= 0),
  constraint guest_is_not_host check (guest_id <> host_id),
  constraint not_paired_to_self check (paired_request_id is null or paired_request_id <> id)
);

create index stay_requests_guest_idx on stay_requests (guest_id, status);
create index stay_requests_host_idx on stay_requests (host_id, status);
create index stay_requests_listing_idx on stay_requests (listing_id, starts_on);

-- A home cannot be double-booked once a stay is locked in.
alter table stay_requests add constraint no_overlapping_confirmed_stays
  exclude using gist (
    listing_id with =,
    daterange(starts_on, ends_on, '[)') with &&
  ) where (status in ('confirmed', 'checked_in', 'checked_out', 'settled', 'disputed'));

-- ------------------------------------------------------------------- points

-- Append-only. Holds are not recorded here: they live on
-- stay_requests.points_held, so this table only ever shows settled movement.
create table points_ledger (
  id         bigserial primary key,
  user_id    uuid not null references profiles on delete cascade,
  delta      integer not null,
  kind       ledger_kind not null,
  stay_id    uuid references stay_requests on delete set null,
  note       text,
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  constraint delta_not_zero check (delta <> 0)
);

create index points_ledger_user_idx on points_ledger (user_id, created_at desc);

-- ------------------------------------------------------- check-in / check-out

create table checklists (
  id               uuid primary key default gen_random_uuid(),
  stay_id          uuid not null references stay_requests on delete cascade,
  phase            checklist_phase not null,
  signed_by_guest  timestamptz,
  signed_by_host   timestamptz,
  created_at       timestamptz not null default now(),
  unique (stay_id, phase)
);

create table checklist_items (
  id            uuid primary key default gen_random_uuid(),
  checklist_id  uuid not null references checklists on delete cascade,
  room          text not null,
  item          text not null,
  storage_path  text,
  taken_at      timestamptz,
  latitude      double precision,
  longitude     double precision,
  sha256        text,
  created_at    timestamptz not null default now(),
  unique (checklist_id, room, item)
);

comment on column checklist_items.sha256 is
  'Hash of the uploaded photo, so a later substitution is detectable.';

-- ------------------------------------------------------- reviews and disputes

create table reviews (
  id         uuid primary key default gen_random_uuid(),
  stay_id    uuid not null references stay_requests on delete cascade,
  author_id  uuid not null references profiles on delete cascade,
  target_id  uuid not null references profiles on delete cascade,
  rating     smallint not null,
  body       text,
  created_at timestamptz not null default now(),
  unique (stay_id, author_id),
  constraint rating_range check (rating between 1 and 5),
  constraint no_self_review check (author_id <> target_id)
);

create table disputes (
  id           uuid primary key default gen_random_uuid(),
  stay_id      uuid not null references stay_requests on delete cascade,
  raised_by    uuid not null references profiles on delete restrict,
  description  text not null,
  status       dispute_status not null default 'open',
  resolution   text,
  points_moved integer not null default 0,
  resolved_by  uuid references profiles on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index disputes_status_idx on disputes (status, created_at);

create table messages (
  id         uuid primary key default gen_random_uuid(),
  stay_id    uuid not null references stay_requests on delete cascade,
  sender_id  uuid not null references profiles on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index messages_stay_idx on messages (stay_id, created_at);

-- ------------------------------------------------------------------- touch

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_touch before update on listings
  for each row execute function touch_updated_at();
create trigger stay_requests_touch before update on stay_requests
  for each row execute function touch_updated_at();
