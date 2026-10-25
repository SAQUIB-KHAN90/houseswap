# Database

Eleven migrations, applied in order. Together they hold the whole points economy,
the stay state machine and the way a dispute ends.

| File | Holds |
|---|---|
| `migrations/0001_schema.sql` | Types, tables, constraints, indexes |
| `migrations/0002_functions.sql` | Points movement and the stay state machine |
| `migrations/0003_rls.sql` | Row-level security and grants |
| `migrations/0004_disputes.sql` | Opening and resolving a damage claim |
| `migrations/0005_settlement.sql` | Recording check-out time, and the settle sweep |
| `migrations/0006_storage.sql` | Photo buckets and who may read them |
| `migrations/0007_reviews.sql` | Reviews, the trust score, two fixes to 0002 |
| `migrations/0008_moderation.sql` | Suspension, the audit log, realtime on chat |
| `migrations/0009_limits_and_location.sql` | Rate limits, and a public approximate location |
| `migrations/0010_abuse_signals.sql` | What flags a member for staff review |
| `migrations/0011_notify_channels.sql` | Notification channels, opt-in |

## Applying it to a Supabase project

Paste each file into the SQL editor in order, or with the Supabase CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Then run `scheduled/settle.sql` once, in the SQL editor. It is not a migration
because it needs pg_cron, which the scenario tests run without — but until it
has run, nothing calls `settle_due_stays()` and points never leave escrow.
Check it with `select * from cron.job;`.

## Running the tests

```bash
npm run test:db
```

That is the whole thing. It applies every migration and runs
`tests/scenario.sql` against PGlite — a real Postgres compiled to WebAssembly —
so the plpgsql, the triggers and the row-level security all execute as they
would on the server, with no Postgres installed and no Docker. The runner is
`scripts/db-test.mjs`.

The scenario walks a member from signup through a settled stay, a direct swap,
two cancellations, a damage claim, the settle sweep, reviews and a suspension,
checking balances and permissions after each step.

`tests/_shim.sql` runs first and fakes the `auth` schema and the `anon` and
`authenticated` roles that Supabase provides but a bare Postgres does not. It
is for testing only and must never be applied to a real project.

`0006_storage.sql` is skipped: it writes to the `storage` schema, which only
Supabase has. It is applied to the real project like any other migration.

It also runs under psql, if you would rather:

```bash
createdb houseswap_test
psql -d houseswap_test -v ON_ERROR_STOP=1 \
  -f tests/_shim.sql \
  -f migrations/0001_schema.sql \
  -f migrations/0002_functions.sql \
  -f migrations/0003_rls.sql \
  -f migrations/0004_disputes.sql \
  -f migrations/0005_settlement.sql \
  -f migrations/0007_reviews.sql \
  -f migrations/0008_moderation.sql \
  -f migrations/0009_limits_and_location.sql \
  -f migrations/0010_abuse_signals.sql \
  -f migrations/0011_notify_channels.sql
psql -d houseswap_test -f tests/scenario.sql
```

Last run: 137 assertions, all passing, covering 0001 to 0011.

## Reviews and the trust score

`profiles.trust_score` is computed by `recompute_trust_score()`, never written
by hand. Triggers call it when a review is inserted and when a host cancels a
stay they had approved. Members cannot execute it — one who could would be able
to rewrite their own score.

The formula is prd.md 15a: a mean pulled toward a prior of 4.2, so one
five-star review cannot put a brand-new host above somebody with forty. No
history means **null**, not 4.2, and the UI shows "New member".

`0007` also corrects two things in `0002` that the trust work exposed:

- `cancel_stay` now records `cancelled_by` and `cancelled_from`. Without them a
  host cancellation was indistinguishable from a guest one afterwards, so the
  host penalty in prd.md 10a could not be enforced at all.
- `pair_direct_swap` now checks the caller is one of the two people trading. It
  was granted to every signed-in member and only checked that the two legs
  mirrored each other, so knowing two ids was enough to link, price and put a
  hold on two strangers' requests.

## Moderation and the audit log

Staff can suspend a member, restore one, adjust a balance and resolve a
dispute. Each is a function that acts and writes its own `admin_actions` row in
the same transaction, so an action without a record is not possible: nothing
grants insert on that table, and the only writer is a function already doing
the thing it is logging. Every one of them refuses without a reason.

Suspension pauses the member's listings and blocks `request_stay`. Restoring
does **not** un-pause their homes — when a home goes back on search is the
host's decision, not staff's. Confirmed stays are left alone: somebody is
mid-trip, and cancelling on them is a separate call with its own points
consequences under prd.md 10a.

**Columns a member must not set.** `profiles_update_own` lets a member write
their own row and a row policy cannot restrict columns, so until 0008 a member
could run `update profiles set kyc_status = 'verified'` and be verified, take
the starter points and book a stranger's home — no provider involved, the
application-side placeholder bypassed entirely. The same trick cleared a
suspension or granted staff rights. `guard_profile_columns` refuses those
columns from member-level roles. It is SECURITY INVOKER on purpose: inside a
definer function `current_user` is the function's owner, so a definer trigger
would see "postgres" for everybody and wave every write through.

## Who gets flagged

`member_risk` is a view, not a stored score. A score on the member would need a
job to keep it fresh and would go stale silently; a view is right by
construction, and at pilot volumes it costs nothing. It is `security_invoker`,
so staff see everybody and a member sees only themselves.

It counts **outcomes**, not accusations: a claim staff upheld counts against
the member it was raised against, a claim staff rejected counts against
whoever raised it, and an open claim counts against nobody. Counting disputes
themselves would punish members for having been complained about, which is an
easy thing to arrange.

Thresholds are in prd.md 8a. Nothing acts on a flag: `suspend_member` still
needs a staff member and a written reason.

## Rate limits

Triggers on `stay_requests` and `messages`, not checks inside `request_stay` or
the app, so the limit holds however a row arrives. Ten requests an hour and
forty a day; twenty messages a minute and two hundred an hour. Those sit far
above real use — nobody sends twenty messages a minute by hand — and far below
what abuse needs.

The counts come from the rows already there rather than a counter table, which
would need its own cleanup and could drift from the truth. It is a rolling
window, not a ban: once the hour passes the member is free again.

## Where a home is

Two locations, with different precision and different audiences.
`listing_addresses` holds the exact point and the street, and is withheld until
the host approves a stay. `listings.approx_latitude` / `approx_longitude` is
public, rounded by a trigger to three decimals — about 100 m — and the map
draws a 500 m circle rather than a pin.

The rounding is in the database on purpose: done in the browser, a crafted
request could store a precise point in a column the whole world can read.

## Photos

Two buckets, with opposite rules. `listing-photos` is public — they are the
advertisement. `stay-evidence` is private, read through short-lived signed
URLs, and its policy calls `in_stay()`, the same helper the `checklists` and
`messages` policies use. There is one definition of who is on a stay, in SQL,
and nothing in TypeScript decides it.

`stay-evidence` has no update and no delete policy. Evidence is written once: a
photo that could be replaced after a dispute opens is not evidence, and the
`sha256` on `checklist_items` would stop proving anything.

Photos are resized and hashed in the browser before upload
(`src/lib/photos/capture.ts`), so what the hash describes is exactly the stored
object. Re-encoding also strips the camera's own EXIF, including its GPS; the
location kept is the one the member was asked for, in a column.

## Three things worth knowing before you change any of this

**Rates are set in TypeScript, not SQL.** `pointsPerNight()` in
`src/lib/points/rates.ts` prices a listing, and the number is frozen on
`listings.points_per_night` when it is published. Nothing in SQL recomputes it,
so there is one definition of the rules and a later change never reprices a
stay that is already booked. Run `npm run test:points` after touching it.

**Holds are not ledger rows.** `points_ledger` is append-only and records only
value that actually changed hands. A pending request reserves points on
`stay_requests.points_held` instead, so:

```
available = sum(ledger deltas) - sum(points_held on open requests)
```

Use `points_balance(uuid)` or `my_points()` rather than summing the ledger
yourself, or you will report points a member cannot actually spend.

**Two triggers fire on an update, not an insert.** `grant_starter_points` hangs
off a change to `profiles.kyc_status` and `grant_first_listing_bonus` off a
change to `listings.status`. A row written straight to `verified` or to `active`
earns nothing, which is why both the publish action and the seed script insert
first and then change the status.

The refund windows in `cancel_stay` are the enforced copy of the cancellation
policy in `prd.md` 10a. `cancellationSplit()` in the points module mirrors them
so the app can tell a member what cancelling will cost, but this file decides.
