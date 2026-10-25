-- End-to-end check of the points rules, the stay state machine, disputes,
-- settlement, reviews and moderation.
--
-- Run against a scratch database that already has the migrations. 0006 is left
-- out: it writes to the `storage` schema, which only Supabase has. See
-- supabase/README.md for the exact command.
--
-- Exits non-zero if anything fails.

\set ON_ERROR_STOP on
\pset pager off

create temp table t_results (label text, ok boolean, detail text);
-- The row-level-security section runs as the authenticated role, which still
-- needs to record its results here.
grant all on t_results to public;

create or replace function t_eq(p_label text, p_actual text, p_expected text)
returns void language plpgsql as $$
begin
  insert into t_results values (
    p_label,
    p_actual is not distinct from p_expected,
    case when p_actual is not distinct from p_expected then p_actual
         else format('expected %s, got %s', p_expected, p_actual) end
  );
end $$;

create or replace function t_raises(p_label text, p_sql text)
returns void language plpgsql as $$
begin
  execute p_sql;
  insert into t_results values (p_label, false, 'expected an error, none raised');
exception when others then
  insert into t_results values (p_label, true, left(sqlerrm, 60));
end $$;

-- ------------------------------------------------------------------ fixtures

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555');

-- Dev never verifies. He is here to try the things an unverified member must
-- not be able to do to themselves.
insert into profiles (id, full_name, home_city, kyc_status) values
  ('11111111-1111-1111-1111-111111111111', 'Asha (guest)',   'Delhi',      'unverified'),
  ('22222222-2222-2222-2222-222222222222', 'Bhavin (host)',  'Chandigarh', 'unverified'),
  ('33333333-3333-3333-3333-333333333333', 'Chetan (swap)',  'Jaipur',     'unverified'),
  ('44444444-4444-4444-4444-444444444444', 'Staff',          'Delhi',      'verified'),
  ('55555555-5555-5555-5555-555555555555', 'Dev (unverified)', 'Delhi',    'unverified');
update profiles set is_staff = true where full_name = 'Staff';

\echo '== starter points are granted once, on verification'
select t_eq('unverified member has no points',
  (select settled::text from points_balance('11111111-1111-1111-1111-111111111111')), '0');

update profiles set kyc_status = 'verified'
 where id in ('11111111-1111-1111-1111-111111111111',
              '22222222-2222-2222-2222-222222222222',
              '33333333-3333-3333-3333-333333333333');

select t_eq('verification grants 100',
  (select settled::text from points_balance('11111111-1111-1111-1111-111111111111')), '100');

-- Re-running verification must not pay twice.
update profiles set kyc_status = 'pending' where id = '11111111-1111-1111-1111-111111111111';
update profiles set kyc_status = 'verified' where id = '11111111-1111-1111-1111-111111111111';
select t_eq('starter points are not paid twice',
  (select settled::text from points_balance('11111111-1111-1111-1111-111111111111')), '100');

-- ------------------------------------------------------------------ listings

-- Rates come from pointsPerNight() in src/lib/points/rates.ts:
-- 2BHK entire home with four scoring amenities = 56, 1BHK with four = 42.
insert into listings (id, host_id, title, offering, city, area, bedrooms, max_guests,
                      amenities, points_per_night, deposit_inr, accepts_points,
                      accepts_direct_swap, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'Compact 1BHK', 'home', 'Chandigarh', 'Sector 17', 1, 2,
   array['AC','Washing machine','Full kitchen','Parking'], 42, 5000, true, true, 'draft'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333',
   'Roomy 2BHK', 'home', 'Jaipur', 'C-Scheme', 2, 4,
   array['AC','Washing machine','Full kitchen','Parking'], 56, 5000, true, true, 'draft'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Asha''s 1BHK', 'home', 'Delhi', 'Saket', 1, 2,
   array['AC','Washing machine','Full kitchen','Parking'], 42, 0, true, true, 'draft');

-- Listing 3 gets one too, so there is an address nobody in the story has
-- earned the right to see.
insert into listing_addresses (listing_id, address_line) values
  ('aaaaaaaa-0000-0000-0000-000000000003', '9 Saket, Delhi'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '12 Sector 17, Chandigarh');

\echo '== publishing a first listing pays the listing bonus once'
update listings set status = 'active';
select t_eq('host gets 25 for a first listing',
  (select settled::text from points_balance('22222222-2222-2222-2222-222222222222')), '125');

update listings set status = 'paused' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update listings set status = 'active' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select t_eq('listing bonus is not paid twice',
  (select settled::text from points_balance('22222222-2222-2222-2222-222222222222')), '125');

select t_raises('a listing accepting neither mode is refused', $$
  update listings set accepts_points = false, accepts_direct_swap = false
   where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$);

insert into availability (listing_id, starts_on, ends_on) values
  ('aaaaaaaa-0000-0000-0000-000000000001', current_date, current_date + 120),
  ('aaaaaaaa-0000-0000-0000-000000000002', current_date, current_date + 120),
  ('aaaaaaaa-0000-0000-0000-000000000003', current_date, current_date + 120);

select t_raises('overlapping availability windows are refused', $$
  insert into availability (listing_id, starts_on, ends_on)
  values ('aaaaaaaa-0000-0000-0000-000000000001', current_date + 10, current_date + 20) $$);

-- ------------------------------------------------------- requesting a stay

\echo '== a points request holds points without touching the ledger'
select auth.become('11111111-1111-1111-1111-111111111111');
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 30, current_date + 32, 'points') as stay_a \gset

select t_eq('two nights at 42 holds 84',
  (select points_held::text from stay_requests where id = :'stay_a'), '84');
-- Asha holds 125: 100 starter plus 25 for publishing her own listing.
select t_eq('ledger is untouched by a hold',
  (select settled::text from points_balance('11111111-1111-1111-1111-111111111111')), '125');
select t_eq('available drops by the hold',
  (select available::text from points_balance('11111111-1111-1111-1111-111111111111')), '41');

select t_raises('a second request beyond the balance is refused', $$
  select request_stay('aaaaaaaa-0000-0000-0000-000000000002',
                      current_date + 40, current_date + 42, 'points') $$);

select t_raises('requesting your own home is refused', $$
  select request_stay('aaaaaaaa-0000-0000-0000-000000000003',
                      current_date + 50, current_date + 51, 'points') $$);

select t_raises('dates outside the open window are refused', $$
  select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                      current_date + 200, current_date + 202, 'points') $$);

\echo '== declining releases the hold in full'
select auth.become('22222222-2222-2222-2222-222222222222');
select decline_stay(:'stay_a', 'dates no longer free');
select t_eq('declined stay holds nothing',
  (select points_held::text from stay_requests where id = :'stay_a'), '0');
select t_eq('guest balance is whole again',
  (select available::text from points_balance('11111111-1111-1111-1111-111111111111')), '125');

-- --------------------------------------------------------- the happy path

\echo '== a full stay moves points from guest to host, and only once'
select auth.become('11111111-1111-1111-1111-111111111111');
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 30, current_date + 32, 'points') as stay_b \gset

select auth.become('22222222-2222-2222-2222-222222222222');
select approve_stay(:'stay_b');
select auth.become('11111111-1111-1111-1111-111111111111');
select confirm_stay(:'stay_b');

select t_raises('the same dates cannot be booked twice once confirmed', $$
  insert into stay_requests (listing_id, guest_id, host_id, mode, starts_on, ends_on,
                             nights, points_per_night, points_total, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          '22222222-2222-2222-2222-222222222222', 'points',
          current_date + 31, current_date + 33, 2, 42, 84, 'confirmed') $$);

select check_in_stay(:'stay_b');
select check_out_stay(:'stay_b');
select settle_stay(:'stay_b');

select t_eq('guest paid 84', (select settled::text
  from points_balance('11111111-1111-1111-1111-111111111111')), '41');
select t_eq('host earned 84', (select settled::text
  from points_balance('22222222-2222-2222-2222-222222222222')), '209');
select t_eq('nothing is left on hold', (select points_held::text
  from stay_requests where id = :'stay_b'), '0');
select t_eq('deposit is marked for release', (select deposit_state::text
  from stay_requests where id = :'stay_b'), 'pending');

select t_raises('settling twice is refused', format('select settle_stay(%L)', :'stay_b'));

\echo '== the ledger is append-only'
select t_raises('updating a ledger row is refused',
  'update points_ledger set delta = 9999 where id = (select min(id) from points_ledger)');
select t_raises('deleting a ledger row is refused',
  'delete from points_ledger where id = (select min(id) from points_ledger)');

\echo '== points are conserved: stays only move them, never create them'
select t_eq('stay movements net to zero',
  (select sum(delta)::text from points_ledger),
  (select sum(delta)::text from points_ledger
    where kind in ('starter_bonus','listing_bonus','admin_adjustment','topup')));

-- ----------------------------------------------------------- direct swaps

\echo '== an unequal direct swap is settled with the difference in points'
select auth.become('11111111-1111-1111-1111-111111111111');
select request_stay('aaaaaaaa-0000-0000-0000-000000000002',
                    current_date + 60, current_date + 64, 'direct') as leg_a \gset
select auth.become('33333333-3333-3333-3333-333333333333');
select request_stay('aaaaaaaa-0000-0000-0000-000000000003',
                    current_date + 70, current_date + 74, 'direct') as leg_b \gset

select t_eq('Asha stays 4 nights in a 56 home', (select points_total::text
  from stay_requests where id = :'leg_a'), '224');
select t_eq('Chetan stays 4 nights in a 42 home', (select points_total::text
  from stay_requests where id = :'leg_b'), '168');

-- Asha has 41 points at this stage: 100 starter + 25 listing bonus - 84 spent.
-- The gap is 56, so the trade must be refused until she can cover it.
select t_eq('Asha cannot cover the gap yet',
  (select available::text from points_balance('11111111-1111-1111-1111-111111111111')), '41');
select t_raises('an unequal swap is refused when the gap is unaffordable',
  format('select pair_direct_swap(%L, %L)', :'leg_a', :'leg_b'));

-- Top her up so the balanced path can be checked as well.
insert into points_ledger (user_id, delta, kind, note)
values ('11111111-1111-1111-1111-111111111111', 60, 'admin_adjustment', 'test top-up');

select pair_direct_swap(:'leg_a', :'leg_b');

select t_eq('the gap is 56 points', (select swap_points_delta::text
  from stay_requests where id = :'leg_a'), '56');
select t_eq('the other leg records the mirror', (select swap_points_delta::text
  from stay_requests where id = :'leg_b'), '-56');
select t_eq('the richer stay holds the gap', (select points_held::text
  from stay_requests where id = :'leg_a'), '56');
select t_eq('the cheaper stay holds nothing', (select points_held::text
  from stay_requests where id = :'leg_b'), '0');
select t_eq('the gap is reserved, not yet spent',
  (select available::text from points_balance('11111111-1111-1111-1111-111111111111')), '45');
select t_eq('legs are linked', (select (paired_request_id = :'leg_a')::text
  from stay_requests where id = :'leg_b'), 'true');

\echo '== one side approving is not enough to confirm a swap'
select auth.become('33333333-3333-3333-3333-333333333333');
select approve_stay(:'leg_a');
select t_eq('first approval leaves it approved', (select status::text
  from stay_requests where id = :'leg_a'), 'approved');
select auth.become('11111111-1111-1111-1111-111111111111');
select approve_stay(:'leg_b');
select t_eq('both approvals confirm leg A', (select status::text
  from stay_requests where id = :'leg_a'), 'confirmed');
select t_eq('both approvals confirm leg B', (select status::text
  from stay_requests where id = :'leg_b'), 'confirmed');

-- ---------------------------------------------------------- cancellation

\echo '== cancelling inside 48 hours forfeits the points to the host'
select auth.become('33333333-3333-3333-3333-333333333333');
select request_stay('aaaaaaaa-0000-0000-0000-000000000003',
                    current_date + 1, current_date + 2, 'points') as stay_late \gset
select t_eq('one night at 42 is held', (select points_held::text
  from stay_requests where id = :'stay_late'), '42');

select cancel_stay(:'stay_late');
select t_eq('the host is compensated in full', (select delta::text
  from points_ledger where stay_id = :'stay_late'
    and user_id = '11111111-1111-1111-1111-111111111111'), '42');
select t_eq('the guest is charged', (select delta::text
  from points_ledger where stay_id = :'stay_late'
    and user_id = '33333333-3333-3333-3333-333333333333'), '-42');

\echo '== cancelling well ahead returns everything'
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 90, current_date + 91, 'points') as stay_early \gset
select cancel_stay(:'stay_early');
select t_eq('no ledger entry for an early cancellation',
  (select count(*)::text from points_ledger where stay_id = :'stay_early'), '0');
select t_eq('hold released', (select points_held::text
  from stay_requests where id = :'stay_early'), '0');

\echo '== points are still conserved after swaps and cancellations'
select t_eq('stay movements still net to zero',
  (select sum(delta)::text from points_ledger),
  (select sum(delta)::text from points_ledger
    where kind in ('starter_bonus','listing_bonus','admin_adjustment','topup')));

-- ------------------------------------------------------------- disputes

\echo '== a claim stops a stay settling, and resolving it splits the hold'
select auth.become('33333333-3333-3333-3333-333333333333');
-- One night, 42 points. Chetan is down to 83 by this point in the story: 100
-- starter, 25 for listing, less the 42 he forfeited on the late cancellation.
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 100, current_date + 101, 'points') as stay_d \gset
select auth.become('22222222-2222-2222-2222-222222222222');
select approve_stay(:'stay_d');
select auth.become('33333333-3333-3333-3333-333333333333');
select confirm_stay(:'stay_d');
select check_in_stay(:'stay_d');
select check_out_stay(:'stay_d');

select t_eq('check-out records when it happened',
  (select (checked_out_at is not null)::text from stay_requests where id = :'stay_d'), 'true');

-- The host raises a damage claim before the 24 hours are up.
select auth.become('22222222-2222-2222-2222-222222222222');
insert into disputes (stay_id, raised_by, description)
values (:'stay_d', '22222222-2222-2222-2222-222222222222', 'burn mark on the counter');

select t_eq('raising a claim moves the stay to disputed',
  (select status::text from stay_requests where id = :'stay_d'), 'disputed');
select t_raises('a disputed stay will not settle',
  format('select settle_stay(%L)', :'stay_d'));

select t_eq('the hold survives the dispute',
  (select points_held::text from stay_requests where id = :'stay_d'), '42');

select t_raises('a member cannot resolve their own dispute', format(
  'select resolve_dispute((select id from disputes where stay_id = %L), 84, %L)',
  :'stay_d', 'let me off'));

-- Staff award part of the hold.
select auth.become('44444444-4444-4444-4444-444444444444');
select t_raises('awarding more than is held is refused', format(
  'select resolve_dispute((select id from disputes where stay_id = %L), 500, %L)',
  :'stay_d', 'too much'));

select resolve_dispute(
  (select id from disputes where stay_id = :'stay_d'), 30, 'partial: counter resurfaced');

select t_eq('the dispute is closed',
  (select status::text from disputes where stay_id = :'stay_d'), 'resolved');
select t_eq('the stay settles out of the dispute',
  (select status::text from stay_requests where id = :'stay_d'), 'settled');
select t_eq('nothing stays on hold',
  (select points_held::text from stay_requests where id = :'stay_d'), '0');
select t_eq('the host receives the award',
  (select delta::text from points_ledger
    where stay_id = :'stay_d' and user_id = '22222222-2222-2222-2222-222222222222'
      and kind = 'dispute_adjustment'), '30');
select t_eq('the guest is charged the award, not the whole stay',
  (select delta::text from points_ledger
    where stay_id = :'stay_d' and user_id = '33333333-3333-3333-3333-333333333333'
      and kind = 'dispute_adjustment'), '-30');
select t_raises('a closed dispute cannot be resolved twice', format(
  'select resolve_dispute((select id from disputes where stay_id = %L), 10, %L)',
  :'stay_d', 'again'));

-- ----------------------------------------------------------- settlement job

\echo '== the settle sweep pays out only what is due and undisputed'
select auth.become('33333333-3333-3333-3333-333333333333');
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 110, current_date + 111, 'points') as stay_s \gset
select auth.become('22222222-2222-2222-2222-222222222222');
select approve_stay(:'stay_s');
select auth.become('33333333-3333-3333-3333-333333333333');
select confirm_stay(:'stay_s');
select check_in_stay(:'stay_s');
select check_out_stay(:'stay_s');

-- Checked out just now, so the 24 hours are not up.
select t_eq('a fresh check-out is not swept',
  (select settle_due_stays()::text), '0');
select t_eq('and it is still checked_out',
  (select status::text from stay_requests where id = :'stay_s'), 'checked_out');

-- Age it past the window.
update stay_requests set checked_out_at = now() - interval '25 hours'
 where id = :'stay_s';

select t_eq('a stay past its window is swept',
  (select settle_due_stays()::text), '1');
select t_eq('and is settled',
  (select status::text from stay_requests where id = :'stay_s'), 'settled');
select t_eq('a second sweep finds nothing left',
  (select settle_due_stays()::text), '0');

-- ------------------------------------------------------------- reviews

\echo '== reviews pull the trust score toward the prior, not to the average'
select t_eq('a member with no reviews has no score',
  (select coalesce(trust_score::text, 'null') from profiles
    where id = '11111111-1111-1111-1111-111111111111'), 'null');

select auth.become('33333333-3333-3333-3333-333333333333');
insert into reviews (stay_id, author_id, target_id, rating, body)
values (:'stay_s', '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222', 5, 'spotless, easy to reach');

-- (5*4.2 + 5) / (5 + 1) = 4.333 -> 4.3
select t_eq('one five-star gives 4.3, not 5.0',
  (select trust_score::text from profiles
    where id = '22222222-2222-2222-2222-222222222222'), '4.3');

select t_raises('a second review on the same stay is refused', format($f$
  insert into reviews (stay_id, author_id, target_id, rating)
  values (%L, '33333333-3333-3333-3333-333333333333',
          '22222222-2222-2222-2222-222222222222', 1) $f$, :'stay_s'));

select t_raises('a rating outside 1-5 is refused', format($f$
  insert into reviews (stay_id, author_id, target_id, rating)
  values (%L, '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333', 9) $f$, :'stay_s'));

select t_raises('you cannot review yourself', format($f$
  insert into reviews (stay_id, author_id, target_id, rating)
  values (%L, '22222222-2222-2222-2222-222222222222',
          '22222222-2222-2222-2222-222222222222', 5) $f$, :'stay_s'));

-- The host reviews the guest back, so the second side is covered too.
select auth.become('22222222-2222-2222-2222-222222222222');
insert into reviews (stay_id, author_id, target_id, rating)
values (:'stay_s', '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333', 4);
-- (21 + 4) / 6 = 4.166 -> 4.2
select t_eq('a four-star gives 4.2',
  (select trust_score::text from profiles
    where id = '33333333-3333-3333-3333-333333333333'), '4.2');

\echo '== a host cancelling after approving costs them the same as a one-star'
select auth.become('11111111-1111-1111-1111-111111111111');
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 115, current_date + 116, 'points') as stay_hc \gset
select auth.become('22222222-2222-2222-2222-222222222222');
select approve_stay(:'stay_hc');
select cancel_stay(:'stay_hc');

select t_eq('the canceller is recorded',
  (select (cancelled_by = '22222222-2222-2222-2222-222222222222')::text
     from stay_requests where id = :'stay_hc'), 'true');
select t_eq('and what it was cancelled from',
  (select cancelled_from::text from stay_requests where id = :'stay_hc'), 'approved');
select t_eq('the guest is refunded in full',
  (select count(*)::text from points_ledger where stay_id = :'stay_hc'), '0');
-- (21 + 5 + 1) / (5 + 1 + 1) = 3.857 -> 3.9
select t_eq('the host score drops from 4.3 to 3.9',
  (select trust_score::text from profiles
    where id = '22222222-2222-2222-2222-222222222222'), '3.9');

-- ------------------------------------------------------------ moderation

\echo '== suspension stops a member booking, and is logged'
select auth.become('11111111-1111-1111-1111-111111111111');
select t_raises('a member cannot suspend anybody', format(
  'select suspend_member(%L, %L)',
  '33333333-3333-3333-3333-333333333333', 'because I said so'));

select auth.become('44444444-4444-4444-4444-444444444444');
select t_raises('suspending without a reason is refused', format(
  'select suspend_member(%L, %L)', '33333333-3333-3333-3333-333333333333', '   '));

select suspend_member('33333333-3333-3333-3333-333333333333', 'two upheld damage claims');

select t_eq('the member is marked suspended',
  (select (suspended_at is not null)::text from profiles
    where id = '33333333-3333-3333-3333-333333333333'), 'true');
select t_eq('their homes come off search',
  (select count(*)::text from listings
    where host_id = '33333333-3333-3333-3333-333333333333' and status = 'active'), '0');
select t_eq('the action is logged with its reason',
  (select reason from admin_actions
    where action = 'suspend_member'
      and target_user = '33333333-3333-3333-3333-333333333333'),
  'two upheld damage claims');
select t_eq('the log records who did it',
  (select (actor_id = '44444444-4444-4444-4444-444444444444')::text
     from admin_actions where action = 'suspend_member'
      and target_user = '33333333-3333-3333-3333-333333333333'), 'true');
select t_raises('suspending twice is refused', format(
  'select suspend_member(%L, %L)',
  '33333333-3333-3333-3333-333333333333', 'again'));

select auth.become('33333333-3333-3333-3333-333333333333');
select t_raises('a suspended member cannot request a stay', $$
  select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                      current_date + 118, current_date + 119, 'points') $$);

select auth.become('44444444-4444-4444-4444-444444444444');
select restore_member('33333333-3333-3333-3333-333333333333', 'claims withdrawn');
select t_eq('restoring clears the suspension',
  (select coalesce(suspended_at::text, 'null') from profiles
    where id = '33333333-3333-3333-3333-333333333333'), 'null');
select t_eq('restoring is logged too',
  (select count(*)::text from admin_actions
    where action = 'restore_member'
      and target_user = '33333333-3333-3333-3333-333333333333'), '1');

\echo '== staff point adjustments are logged and reasoned'
select t_raises('an adjustment with no reason is refused', format(
  'select adjust_points(%L, 50, %L)', '11111111-1111-1111-1111-111111111111', ''));
select t_raises('an adjustment of zero is refused', format(
  'select adjust_points(%L, 0, %L)', '11111111-1111-1111-1111-111111111111', 'nothing'));

select adjust_points('11111111-1111-1111-1111-111111111111', 40,
                     'goodwill after a host cancellation');
select t_eq('the adjustment reaches the ledger',
  (select delta::text from points_ledger
    where user_id = '11111111-1111-1111-1111-111111111111'
      and note = 'goodwill after a host cancellation'), '40');
select t_eq('and is attributed to the staff member',
  (select (created_by = '44444444-4444-4444-4444-444444444444')::text
     from points_ledger where note = 'goodwill after a host cancellation'), 'true');
select t_eq('and logged',
  (select count(*)::text from admin_actions where action = 'adjust_points'), '1');

select auth.become('11111111-1111-1111-1111-111111111111');
select t_raises('a member cannot adjust their own points', format(
  'select adjust_points(%L, 10000, %L)',
  '11111111-1111-1111-1111-111111111111', 'free money'));

-- Restoring does not un-pause a host's homes: that is their decision, not
-- staff's. Chetan puts his back on search, which also returns the fixtures to
-- three active listings for the row-level-security checks below.
select auth.become('33333333-3333-3333-3333-333333333333');
update listings set status = 'active'
 where host_id = '33333333-3333-3333-3333-333333333333';
select t_eq('a restored host can relist',
  (select count(*)::text from listings
    where host_id = '33333333-3333-3333-3333-333333333333' and status = 'active'), '1');

-- ----------------------------------------------------------- rate limiting

\echo '== chat and requests are rate limited'

-- A stay to talk on. Bhavin hosts, Asha is the guest on the settled stay_b.
select t_eq('a normal exchange is fine', (select (count(*) = 0)::text
  from messages where stay_id = :'stay_b'), 'true');

-- A loop, not one INSERT ... SELECT: the limit counts rows already there, and
-- what a BEFORE trigger sees of its own statement's earlier rows is not
-- something to rely on. Separate statements make the count unambiguous.
-- psql variables do not reach inside plpgsql, so the stay is looked up.
do $$
declare
  v_stay uuid;
  i integer;
begin
  select id into v_stay from stay_requests
   where guest_id = '11111111-1111-1111-1111-111111111111'
     and listing_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and starts_on = current_date + 30
     and status = 'settled';

  for i in 1..19 loop
    insert into messages (stay_id, sender_id, body)
    values (v_stay, '11111111-1111-1111-1111-111111111111', 'message ' || i);
  end loop;
end $$;

select t_eq('nineteen messages go through',
  (select count(*)::text from messages
    where sender_id = '11111111-1111-1111-1111-111111111111'), '19');

-- The twentieth is the limit, so the twenty-first must be refused.
insert into messages (stay_id, sender_id, body)
values (:'stay_b', '11111111-1111-1111-1111-111111111111', 'message 20');

select t_raises('the twenty-first message in a minute is refused', format($f$
  insert into messages (stay_id, sender_id, body)
  values (%L, '11111111-1111-1111-1111-111111111111', 'flood') $f$, :'stay_b'));

select t_eq('the flood is not recorded',
  (select count(*)::text from messages
    where sender_id = '11111111-1111-1111-1111-111111111111'), '20');

select t_eq('the other party is unaffected by their limit', (select (count(*) = 0)::text
  from messages where sender_id = '22222222-2222-2222-2222-222222222222'), 'true');
insert into messages (stay_id, sender_id, body)
values (:'stay_b', '22222222-2222-2222-2222-222222222222', 'all fine here');
select t_eq('and can still write',
  (select count(*)::text from messages
    where sender_id = '22222222-2222-2222-2222-222222222222'), '1');

-- Requests: Bhavin has made none so far, so he gets a clean run at the limit.
-- Rows are inserted directly; the trigger is on the table, so it fires either
-- way and this does not need ten open windows on a listing.
do $$
declare i integer;
begin
  for i in 1..10 loop
    insert into stay_requests (listing_id, guest_id, host_id, mode, starts_on,
                               ends_on, nights, points_per_night, points_total)
    values ('aaaaaaaa-0000-0000-0000-000000000003',
            '22222222-2222-2222-2222-222222222222',
            '11111111-1111-1111-1111-111111111111', 'points',
            current_date + 300 + i, current_date + 301 + i, 1, 1, 1);
  end loop;
end $$;

select t_eq('ten requests in an hour go through',
  (select count(*)::text from stay_requests
    where guest_id = '22222222-2222-2222-2222-222222222222'), '10');

select t_raises('the eleventh request in an hour is refused', $$
  insert into stay_requests (listing_id, guest_id, host_id, mode, starts_on,
                             ends_on, nights, points_per_night, points_total)
  values ('aaaaaaaa-0000-0000-0000-000000000003',
          '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111', 'points',
          current_date + 320, current_date + 321, 1, 1, 1) $$);

-- Age them out and the member is free again: the limit is a window, not a ban.
update stay_requests set created_at = now() - interval '2 hours'
 where guest_id = '22222222-2222-2222-2222-222222222222';

insert into stay_requests (listing_id, guest_id, host_id, mode, starts_on,
                           ends_on, nights, points_per_night, points_total)
values ('aaaaaaaa-0000-0000-0000-000000000003',
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111', 'points',
        current_date + 330, current_date + 331, 1, 1, 1);
select t_eq('once the hour passes they can ask again',
  (select count(*)::text from stay_requests
    where guest_id = '22222222-2222-2222-2222-222222222222'), '11');

-- ------------------------------------------------------ approximate location

\echo '== the public location is rounded, the exact one stays private'
update listings set approx_latitude = 28.5355123, approx_longitude = 77.2910456
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select t_eq('latitude is rounded to three decimals',
  (select approx_latitude::text from listings
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'), '28.536');
select t_eq('longitude is rounded to three decimals',
  (select approx_longitude::text from listings
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'), '77.291');

select t_raises('an impossible latitude is refused', $$
  update listings set approx_latitude = 120
   where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$);

-- ---------------------------------------------------------- abuse signals

\echo '== members are flagged for a staff look, never acted on automatically'

-- Asha has a clean record: stays completed, no upheld claims, no cancellations.
select t_eq('a member with a clean record is not flagged',
  (select coalesce(array_length(flags, 1), 0)::text from member_risk
    where id = '11111111-1111-1111-1111-111111111111'), '0');

-- Bhavin cancelled once on an approved guest, which is penalised in the trust
-- score but is not yet a pattern.
select t_eq('one host cancellation is not a pattern',
  (select host_cancellations::text from member_risk
    where id = '22222222-2222-2222-2222-222222222222'), '1');
select t_eq('and does not flag on its own',
  (select coalesce(array_length(flags, 1), 0)::text from member_risk
    where id = '22222222-2222-2222-2222-222222222222'), '0');

-- A second one is.
select auth.become('11111111-1111-1111-1111-111111111111');
-- Inside listing 1's open window, which runs to current_date + 120.
select request_stay('aaaaaaaa-0000-0000-0000-000000000001',
                    current_date + 117, current_date + 118, 'points') as stay_hc2 \gset
select auth.become('22222222-2222-2222-2222-222222222222');
select approve_stay(:'stay_hc2');
select cancel_stay(:'stay_hc2');

select t_eq('two cancellations flag the host',
  (select (flags @> array['cancelled on 2 approved guests'])::text
     from member_risk where id = '22222222-2222-2222-2222-222222222222'), 'true');

-- The claim Chetan lost earlier: it was resolved in the host's favour, so it
-- counts against Chetan, who had only a couple of stays behind him.
select t_eq('an upheld claim counts against the member it was raised against',
  (select upheld_against::text from member_risk
    where id = '33333333-3333-3333-3333-333333333333'), '1');

-- A rejected claim says something about whoever raised it. Chetan raises two
-- that staff throw out.
select auth.become('33333333-3333-3333-3333-333333333333');
insert into disputes (stay_id, raised_by, description)
values (:'stay_s', '33333333-3333-3333-3333-333333333333', 'imagined damage one');
select auth.become('44444444-4444-4444-4444-444444444444');
select resolve_dispute((select id from disputes where stay_id = :'stay_s'
                          and description = 'imagined damage one'),
                       0, 'nothing in the photos supports this');

select t_eq('a rejected claim counts against whoever raised it',
  (select claims_rejected::text from member_risk
    where id = '33333333-3333-3333-3333-333333333333'), '1');
select t_eq('one rejected claim is not yet a pattern',
  (select (not (flags @> array['1 claims they raised were rejected']))::text
     from member_risk where id = '33333333-3333-3333-3333-333333333333'), 'true');

select t_eq('flagging never suspends anyone by itself',
  (select coalesce(suspended_at::text, 'null') from profiles
    where id = '33333333-3333-3333-3333-333333333333'), 'null');

-- ------------------------------------------------------ notification channels

\echo '== phone channels are opt-in and need a verified number'

select t_eq('email is on by default',
  (select notify_email::text from profiles
    where id = '11111111-1111-1111-1111-111111111111'), 'true');
select t_eq('WhatsApp is off until asked for',
  (select notify_whatsapp::text from profiles
    where id = '11111111-1111-1111-1111-111111111111'), 'false');
select t_eq('SMS is off until asked for',
  (select notify_sms::text from profiles
    where id = '11111111-1111-1111-1111-111111111111'), 'false');

update profiles set email = 'asha@example.com', phone = '9810012345'
 where id = '11111111-1111-1111-1111-111111111111';

select t_eq('email alone is reachable',
  (select count(*)::text from notify_channels('11111111-1111-1111-1111-111111111111')), '1');

-- Opting in is not enough on its own: the number has to be confirmed, or a
-- member could opt in with somebody else's number and we would message them.
update profiles set notify_whatsapp = true, notify_sms = true
 where id = '11111111-1111-1111-1111-111111111111';

select t_eq('an unverified number is not reachable',
  (select count(*)::text from notify_channels('11111111-1111-1111-1111-111111111111')), '1');

update profiles set phone_verified = true
 where id = '11111111-1111-1111-1111-111111111111';

select t_eq('a verified number opens both phone channels',
  (select count(*)::text from notify_channels('11111111-1111-1111-1111-111111111111')), '3');
select t_eq('and the phone channels carry the number',
  (select address from notify_channels('11111111-1111-1111-1111-111111111111')
    where channel = 'whatsapp'), '9810012345');

-- Withdrawing consent takes effect immediately.
update profiles set notify_whatsapp = false, notify_sms = false
 where id = '11111111-1111-1111-1111-111111111111';
select t_eq('opting back out drops them again',
  (select count(*)::text from notify_channels('11111111-1111-1111-1111-111111111111')), '1');

-- A member with nothing on is reachable nowhere, and the sender has to cope.
update profiles set notify_email = false
 where id = '11111111-1111-1111-1111-111111111111';
select t_eq('a member can turn everything off',
  (select count(*)::text from notify_channels('11111111-1111-1111-1111-111111111111')), '0');
update profiles set notify_email = true
 where id = '11111111-1111-1111-1111-111111111111';

-- ------------------------------------------------------ row-level security

\echo '== row-level security'
set role authenticated;
select auth.become('11111111-1111-1111-1111-111111111111');

select t_eq('a member sees only their own profile row',
  (select count(*)::text from profiles), '1');
select t_eq('a member sees only their own ledger rows',
  (select count(distinct user_id)::text from points_ledger), '1');
select t_eq('a member sees only stays they are part of',
  (select count(*)::text from stay_requests
    where guest_id <> '11111111-1111-1111-1111-111111111111'
      and host_id <> '11111111-1111-1111-1111-111111111111'), '0');
select t_eq('active listings are public',
  (select count(*)::text from listings), '3');
select t_eq('host name is readable through host_cards',
  (select full_name from host_cards where id = '22222222-2222-2222-2222-222222222222'),
  'Bhavin (host)');

-- Asha has a settled stay at listing 1, so she may see that address.
select t_eq('address visible after an approved stay',
  (select count(*)::text from listing_addresses
    where listing_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '1');

-- Bhavin has never stayed at Asha's home and does not host it. Chetan is no
-- use for this check any more: he has two settled stays at listing 1 by now,
-- so he is entitled to that address.
select auth.become('22222222-2222-2222-2222-222222222222');
select t_eq('address hidden from someone with no stay there',
  (select count(*)::text from listing_addresses
    where listing_id = 'aaaaaaaa-0000-0000-0000-000000000003'), '0');

select t_raises('a member cannot write a stay row directly', $$
  insert into stay_requests (listing_id, guest_id, host_id, mode, starts_on, ends_on,
                             nights, points_per_night, points_total)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '33333333-3333-3333-3333-333333333333',
          '22222222-2222-2222-2222-222222222222', 'points',
          current_date + 95, current_date + 96, 1, 1, 1) $$);

select t_raises('a member cannot mint points', $$
  insert into points_ledger (user_id, delta, kind)
  values ('33333333-3333-3333-3333-333333333333', 100000, 'admin_adjustment') $$);

select t_raises('a member cannot settle a stay themselves',
  format('select settle_stay(%L)', :'leg_a'));

select t_eq('the audit log is invisible to members',
  (select count(*)::text from admin_actions), '0');

select t_raises('a member cannot write an audit entry', $$
  insert into admin_actions (actor_id, action)
  values ('11111111-1111-1111-1111-111111111111', 'granted myself a medal') $$);

select t_eq('staff_members shows a member only themselves',
  (select count(*)::text from staff_members), '1');

-- A row policy cannot restrict columns, so these are guarded by a trigger.
-- Without it a member could simply verify themselves and take the 100 points.
--
-- Become Asha first: these have to act on the session's own row. Aimed at
-- somebody else's they would match nothing, update nothing and raise nothing,
-- which looks exactly like the guard working when it is not.
-- Dev is unverified, so this is the real attack: mark yourself verified, take
-- the 100 starter points and book a stranger's home, with no provider
-- involved and the application-side placeholder bypassed entirely.
select auth.become('55555555-5555-5555-5555-555555555555');
select t_raises('an unverified member cannot verify themselves', $$
  update profiles set kyc_status = 'verified'
   where id = '55555555-5555-5555-5555-555555555555' $$);
select t_eq('and gets no starter points for trying',
  (select settled::text from points_balance('55555555-5555-5555-5555-555555555555')), '0');

select auth.become('11111111-1111-1111-1111-111111111111');
select t_raises('a member cannot suspend or unsuspend themselves', $$
  update profiles set suspended_at = now()
   where id = '11111111-1111-1111-1111-111111111111' $$);
select t_raises('a member cannot make themselves staff', $$
  update profiles set is_staff = true
   where id = '11111111-1111-1111-1111-111111111111' $$);
select t_raises('a member cannot set their own trust score', $$
  update profiles set trust_score = 5.0
   where id = '11111111-1111-1111-1111-111111111111' $$);
-- The guard must not lock a member out of their own profile.
update profiles set home_city = 'Mumbai'
 where id = '11111111-1111-1111-1111-111111111111';
select t_eq('but they can still edit their own details',
  (select home_city from profiles
    where id = '11111111-1111-1111-1111-111111111111'), 'Mumbai');

-- Staff see the whole picture, which is what the screens rely on.
select auth.become('44444444-4444-4444-4444-444444444444');
select t_eq('staff see every member',
  (select (count(*) >= 4)::text from staff_members), 'true');
select t_eq('staff see the audit log',
  (select (count(*) >= 3)::text from admin_actions), 'true');

reset role;

-- --------------------------------------------------------------- results

\echo ''
\echo '---------------------------------------------------------------'
select case when ok then '  ok  ' else ' FAIL ' end || label
       || case when ok then '' else '  <-- ' || detail end as result
  from t_results order by ctid;
\echo '---------------------------------------------------------------'

select count(*) filter (where ok) as passed,
       count(*) filter (where not ok) as failed
  from t_results;

do $$
declare n integer;
begin
  select count(*) into n from t_results where not ok;
  if n > 0 then
    raise exception '% assertion(s) failed', n;
  end if;
end $$;
