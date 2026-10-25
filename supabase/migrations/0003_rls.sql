-- Row-level security.
--
-- Shape of it: members read their own rows, active listings are public, and
-- anything that moves points goes through the functions in 0002, which run as
-- the definer. Direct writes to stay_requests and points_ledger are refused so
-- the balance rules cannot be side-stepped.

alter table profiles          enable row level security;
alter table listings          enable row level security;
alter table listing_addresses enable row level security;
alter table listing_photos    enable row level security;
alter table availability      enable row level security;
alter table stay_requests     enable row level security;
alter table points_ledger     enable row level security;
alter table checklists        enable row level security;
alter table checklist_items   enable row level security;
alter table reviews           enable row level security;
alter table disputes          enable row level security;
alter table messages          enable row level security;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_staff from profiles where id = auth.uid()), false);
$$;

-- True when the signed-in member is one of the two people in a stay.
create or replace function in_stay(p_stay uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from stay_requests
     where id = p_stay and auth.uid() in (guest_id, host_id)
  );
$$;

-- ------------------------------------------------------------------ profiles

create policy profiles_read_own on profiles
  for select using (id = auth.uid() or is_staff());
create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on profiles
  for insert with check (id = auth.uid());

-- A member's name and trust score have to be visible on their listings, but
-- their phone and email must not be. Row-level rules cannot hide a column, so
-- the public face of a profile is this view instead.
create view host_cards
  with (security_invoker = false)
  as select id, full_name, home_city, trust_score, kyc_status, created_at
       from profiles;

-- ------------------------------------------------------------------ listings

create policy listings_read_active on listings
  for select using (status = 'active' or host_id = auth.uid() or is_staff());
create policy listings_write_own on listings
  for all using (host_id = auth.uid()) with check (host_id = auth.uid());

-- The street address is held back until the host has approved the stay.
create policy addresses_read_when_approved on listing_addresses
  for select using (
    exists (select 1 from listings l
             where l.id = listing_id and l.host_id = auth.uid())
    or exists (select 1 from stay_requests s
                where s.listing_id = listing_addresses.listing_id
                  and s.guest_id = auth.uid()
                  and s.status in ('approved', 'confirmed', 'checked_in',
                                   'checked_out', 'settled'))
    or is_staff()
  );
create policy addresses_write_by_host on listing_addresses
  for all using (
    exists (select 1 from listings l where l.id = listing_id and l.host_id = auth.uid())
  ) with check (
    exists (select 1 from listings l where l.id = listing_id and l.host_id = auth.uid())
  );

create policy photos_read on listing_photos
  for select using (
    exists (select 1 from listings l
             where l.id = listing_id
               and (l.status = 'active' or l.host_id = auth.uid()))
    or is_staff()
  );
create policy photos_write_by_host on listing_photos
  for all using (
    exists (select 1 from listings l where l.id = listing_id and l.host_id = auth.uid())
  ) with check (
    exists (select 1 from listings l where l.id = listing_id and l.host_id = auth.uid())
  );

create policy availability_read on availability
  for select using (
    exists (select 1 from listings l
             where l.id = listing_id
               and (l.status = 'active' or l.host_id = auth.uid()))
    or is_staff()
  );
create policy availability_write_by_host on availability
  for all using (
    exists (select 1 from listings l where l.id = listing_id and l.host_id = auth.uid())
  ) with check (
    exists (select 1 from listings l where l.id = listing_id and l.host_id = auth.uid())
  );

-- -------------------------------------------------------------- stay requests

-- Read only. Creating and moving a stay goes through request_stay,
-- approve_stay, cancel_stay and the rest, so the points rules always run.
create policy stays_read_own on stay_requests
  for select using (
    guest_id = auth.uid() or host_id = auth.uid() or is_staff()
  );

-- ---------------------------------------------------------------- points

create policy ledger_read_own on points_ledger
  for select using (user_id = auth.uid() or is_staff());

-- --------------------------------------------------------- stay paperwork

create policy checklists_parties on checklists
  for all using (in_stay(stay_id) or is_staff())
  with check (in_stay(stay_id));

create policy checklist_items_parties on checklist_items
  for all using (
    exists (select 1 from checklists c
             where c.id = checklist_id and (in_stay(c.stay_id) or is_staff()))
  ) with check (
    exists (select 1 from checklists c where c.id = checklist_id and in_stay(c.stay_id))
  );

create policy messages_parties on messages
  for select using (in_stay(stay_id) or is_staff());
create policy messages_send on messages
  for insert with check (sender_id = auth.uid() and in_stay(stay_id));

-- A review is written once, by someone who was on the stay, after it settles.
create policy reviews_read_all on reviews
  for select using (true);
create policy reviews_write_after_stay on reviews
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from stay_requests s
                 where s.id = stay_id
                   and s.status = 'settled'
                   and auth.uid() in (s.guest_id, s.host_id))
  );

create policy disputes_parties on disputes
  for select using (in_stay(stay_id) or is_staff());
create policy disputes_raise on disputes
  for insert with check (raised_by = auth.uid() and in_stay(stay_id));
create policy disputes_staff_resolve on disputes
  for update using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------------ grants

grant usage on schema public to anon, authenticated;

grant select on host_cards to anon, authenticated;
grant select, insert, update on profiles to authenticated;
grant select, insert, update, delete on listings, listing_addresses,
      listing_photos, availability to authenticated;
grant select on listings, listing_photos, availability to anon;
grant select on stay_requests, points_ledger to authenticated;
grant select, insert, update, delete on checklists, checklist_items to authenticated;
grant select, insert on messages, reviews, disputes to authenticated;
grant update on disputes to authenticated;   -- narrowed to staff by policy

-- Points move only through these.
grant execute on function my_points, points_balance, request_stay, pair_direct_swap,
  approve_stay, decline_stay, confirm_stay, cancel_stay, check_in_stay,
  check_out_stay to authenticated;

-- settle_stay runs from a scheduled job, not from a signed-in member.
revoke execute on function settle_stay(uuid) from authenticated;
