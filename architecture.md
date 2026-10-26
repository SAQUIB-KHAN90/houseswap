# HouseSwap — Architecture

Status: Draft v0.2 · Date: 2026-10-24

## 1. Approach
A single web app (mobile-first) on a managed backend so a small team can ship the MVP fast. A mobile app can reuse the same API later.

## 2. Proposed stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React, TypeScript), Tailwind CSS | SSR for SEO, fast iteration |
| Backend / API | Next.js route handlers + Supabase (Postgres, Auth, Storage, Realtime) | Auth, DB, file storage, chat in one service |
| Database | PostgreSQL (Supabase) | Relational data, transactions for the points ledger |
| Storage | Supabase Storage (S3-compatible) | Listing + check-in/out photos |
| ID verification | Licensed KYC provider (DigiLocker-based) + selfie match | Avoids storing raw Aadhaar |
| Payments (phase 2) | Razorpay | Cash deposits and point top-ups |
| Notifications | Email (Resend); WhatsApp and SMS (Twilio) | Request and reminder alerts |
| Maps/Geo | Leaflet + OpenStreetMap tiles | Area maps on search and listings (see 7a) |
| Hosting | Vercel (web) + Supabase (data) | Low ops |
| Monitoring | Sentry, basic analytics | Error and funnel tracking |

Stack is a proposal; confirm before building.

## 3. High-level components
```
Browser (Next.js)
   │
   ├── Auth & Profile ──── Supabase Auth
   ├── KYC Service ─────── External KYC provider (webhook → verification status)
   ├── Listings ────────── Postgres + Storage
   ├── Search/Match ────── Postgres queries (city, dates, type, points)
   ├── Stay Requests ───── State machine + Points Ledger (transactional)
   ├── Chat ────────────── Supabase Realtime
   ├── Check-in/out ────── Photo upload + metadata (time, geo, device) + comparison
   ├── Reviews & Trust ─── Postgres
   ├── Disputes/Admin ──── Admin panel (role-based)
   └── Notifications ───── Email queue
```

## 4. Data model

The schema lives in `supabase/migrations` and is the source of truth, not this
document. Run it against a scratch Postgres with `supabase/tests/scenario.sql` to
check it.

| Migration | Holds |
|---|---|
| `0001_schema.sql` | Types, tables, constraints, indexes |
| `0002_functions.sql` | Points movement and the stay state machine |
| `0003_rls.sql` | Row-level security and grants |
| `0004_disputes.sql` | Opening and resolving a damage claim |
| `0005_settlement.sql` | Check-out timestamp and the settle sweep |
| `0006_storage.sql` | Photo buckets and who may read them |
| `0007_reviews.sql` | Reviews, the trust score, two fixes to 0002 |
| `0008_moderation.sql` | Suspension, the audit log, realtime on chat |
| `0009_limits_and_location.sql` | Rate limits, and a public approximate location |
| `0010_abuse_signals.sql` | What flags a member for staff review |
| `0011_notify_channels.sql` | Notification channels, opt-in |
| `0012_reminder_sent.sql` | Remembering a reminder went out |

Tables: `profiles`, `listings`, `listing_addresses`, `listing_photos`,
`availability`, `stay_requests`, `points_ledger`, `checklists`,
`checklist_items`, `reviews`, `disputes`, `messages`.

Four decisions from prd.md 4a are enforced in the schema rather than left to the
application:

- **Hosting is optional.** Nothing requires a member to own a listing, so a
  student in a hostel can travel on points alone.
- **Both swap modes.** `listings.accepts_points` and
  `listings.accepts_direct_swap`, with a check constraint that at least one is
  true. `stay_requests.mode` says which path a stay took, and
  `paired_request_id` links the two legs of a trade.
- **Deposits are ready but dormant.** `deposit_inr`, `deposit_state` and
  `payment_reference` exist now so the Razorpay work in phase 2 needs no
  migration.
- **One definition of the rates.** `pointsPerNight()` in
  `src/lib/points/rates.ts` prices a listing, and the result is frozen on
  `listings.points_per_night`. No SQL recomputes it, so a later rule change
  never reprices a live listing.

Two integrity rules worth naming:

- The street address sits in `listing_addresses`, which has its own policy, so it
  is withheld until the host approves the stay.
- A GiST exclusion constraint on `stay_requests` makes a double booking
  impossible at the database level, not just in the application.

### Points, and why holds are not ledger rows

`points_ledger` is append-only, enforced by triggers, and records only settled
movement. A pending request does not write to it: the reservation lives in
`stay_requests.points_held`. So:

```
available = sum(ledger deltas) - sum(points_held on open requests)
```

This keeps the ledger a true statement of value that changed hands, leaves no
release rows to reconcile, and still makes double-spending impossible because
available subtracts the holds. `points_balance(uuid)` returns all three figures.

Every function that spends points locks the member's `profiles` row first, which
is what stops two requests sent at the same instant from both passing the
balance check.

## 5. Stay state machine

```
requested -> approved -> confirmed -> checked_in -> checked_out -> settled
```

Side exits: `declined`, `cancelled`, `disputed`.

Points mode:
- `request_stay` reserves the full cost on the request row.
- `decline_stay` and an early `cancel_stay` just clear the reservation; nothing
  was ever taken from the ledger, so there is nothing to refund.
- A late `cancel_stay` writes the forfeited share to the ledger, guest to host.
- `settle_stay` moves the stay value and clears the hold. It runs from a
  scheduled job 24 hours after check-out, and refuses while a dispute is open,
  so it takes no caller identity and is not granted to members.

Direct swap:
- Each side files its own `request_stay` with `mode = 'direct'`.
- `pair_direct_swap` links the two legs and prices the gap between them. Only
  the side receiving the more valuable stay holds points, and the trade is
  refused outright if they cannot cover the gap.
- Only the two members trading may call `pair_direct_swap`. In the app the
  second leg is filed from the incoming request itself: the member picks one of
  the requester's homes and some dates, and the two calls happen together.
- An unlinked direct request cannot be approved — there is no second half yet —
  so the app offers the return leg instead of an approve button.
- Both hosts must approve before either leg moves to `confirmed`; one decline
  cancels the pair.
- Each leg keeps its own check-in and check-out record, so a dispute on one does
  not block the other.

After settlement:
- Both sides may review each other once. `reviews_write_after_stay` allows the
  insert only from somebody on a settled stay, and the unique key on
  (stay_id, author_id) is what stops a second one.
- A trigger recomputes the target's `trust_score`. It is never written by hand,
  and members cannot execute the function — one who could would be able to
  rewrite their own score. The formula is prd.md 15a.
- A host who cancels after approving enters their own pool as a rating of 1.0,
  which is how prd.md 10a's penalty is actually applied. `cancel_stay` records
  `cancelled_by` and `cancelled_from` so the two cases can be told apart.

Dispute:
- Raising a claim moves the stay to `disputed`, by trigger, so the scheduled job
  cannot settle a stay somebody has complained about.
- `resolve_dispute` is the only way out. Staff say how many of the held points
  the host keeps; the same call writes both ledger rows, clears the hold, closes
  the claim and rejects any other claim on the same stay.
- Points not awarded need no refund: a hold was never taken out of the guest's
  balance, so releasing it is enough.

## 6. Points ledger rules
- Append-only; balance = sum of deltas.
- All state transitions that move points run in a single DB transaction.
- Held points cannot be spent elsewhere.
- Admin adjustments are logged with reason and actor.

## 7. Check-in / check-out evidence
- App guides user room by room with a fixed checklist, the same list both times,
  so the two records are directly comparable.
- Each photo is resized and hashed in the browser, then uploaded one at a time
  as it is taken. On a weak connection a failure costs one photo, not the
  checklist.
- Stored in the private `stay-evidence` bucket with SHA-256, capture time and a
  geo-stamp on `checklist_items`. Both parties sign.
- The record view pairs check-in against check-out per item. It offers no
  verdict: nothing compares pixels, and a "no change" badge would be a claim
  the system cannot support. Staff decide (prd.md 9).

**On what the camera hint actually buys.** The capture control asks for the
rear camera (`capture="environment"`), but that is a hint and a browser may
still offer the gallery, so "photos cannot come from the gallery" is not a
property the web can enforce and this document should not claim it. What makes
the record hard to falsify is the rest: the hash is taken over the exact bytes
uploaded, so a later substitution is detectable; the capture time and location
are recorded in columns; and `stay-evidence` has no update or delete policy, so
nothing can be replaced after a dispute opens. A native app could close the
gallery gap later.

Re-encoding in the browser strips the camera's own EXIF, including its GPS and
serial number. The location kept is the one the member was explicitly asked
for — a narrower claim, and a deliberate one under DPDP.

## 7a. Maps, and why not Mapbox

Tiles come from OpenStreetMap through Leaflet. No key, no billing account, no
vendor decision — none of which was worth making before the pilot has shown
anyone wants a map. `src/lib/map.ts` holds the tile URL and attribution;
moving to Mapbox or Google later is that file plus a key. OpenStreetMap's tile
policy expects light, attributed use, which three pilot cities are.

**Two locations, deliberately.** The exact point belongs on
`listing_addresses` with the street, behind the policy that withholds it until
a host approves a stay. The map a visitor sees reads
`listings.approx_latitude` / `approx_longitude`, which a trigger rounds to
three decimals, roughly 100 m. Rounding happens in the database, because done
in the browser a crafted request could store a precise point in a public
column.

Maps draw a 500 m circle, never a pin. A pin would claim a precision the stored
number does not have, and would let somebody pick out a building from a listing
they have not been approved for.

**Hosts place the point themselves** rather than it being geocoded from the
address. A geocoder is another provider, another key and another bill, and it
would be guessing at an address the host has not been asked to make precise —
while the host knows exactly where their own home is.

## 8. Security & privacy
- Never store raw Aadhaar numbers; keep only provider reference + verified flag.
- Encrypt PII at rest; TLS everywhere.
- Row-level security: users read only their own data; address revealed only after approved request.
- Role-based admin access with audit logs.
- Rate limiting and abuse detection on requests and chat.
- Follow India's DPDP Act requirements (consent, deletion).

**Where privilege actually lives.** Every staff power is a database function
that checks `is_staff()` and writes its own `admin_actions` row in the same
transaction. Nothing grants insert on that table, so a staff member cannot act
without being logged, nor log something they did not do. The application never
decides who is staff; it asks.

**Columns are guarded by a trigger, not a policy.** A row-level policy cannot
restrict which columns a member may write, and `profiles_update_own` lets them
write their own row. Without `guard_profile_columns` a member could set their
own `kyc_status` to verified, clear their own suspension, or make themselves
staff with one UPDATE. It is SECURITY INVOKER deliberately: a definer trigger
sees its owner in `current_user` and would approve everything.

**Rate limiting** is enforced by triggers on `stay_requests` and `messages`
(0009), not inside `request_stay` or the application, so the limit holds
however a row arrives. Ten requests an hour, forty a day; twenty messages a
minute, two hundred an hour. Counts come from the rows already there, so there
is no counter table to clean up or drift.

**Abuse detection** is the `member_risk` view (0010): dispute *outcomes*, host
cancellations and a low trust score, with thresholds in prd.md 8a. A view
rather than a stored score, so it cannot go stale. It counts outcomes rather
than accusations — counting disputes themselves would punish members for having
been complained about, which is easy to arrange.

It is advisory, and nothing suspends on a heuristic. Every signal has an
innocent explanation, and the cost of acting on a false one is somebody's home
and reputation.

## 9. Non-functional targets
- Search under 500 ms for pilot-scale data.
- Photo upload resilient to weak networks (retry, compression).
- Daily DB backups.

## 10. Phased delivery
1. **Foundation**: auth, profile, KYC integration, listings.
2. **Matching**: search, requests, approval, points ledger.
3. **Trust**: check-in/out evidence, reviews, disputes, admin panel.
4. **Polish**: notifications, analytics, pilot launch.
5. **Phase 2**: Razorpay for refundable deposits and point top-ups, then a mobile app.

Two scheduled jobs run, and they sit in different places on purpose.

**Settlement runs in the database.** `settle_due_stays()` calls `settle_stay`
for every stay that checked out more than 24 hours ago with no dispute against
it, and pg_cron runs it hourly (`supabase/scheduled/settle.sql`). It is not in
the web app because paying hosts must not depend on a deploy being live. Each
stay settles in its own block, so one that cannot settle is logged and skipped
rather than stopping the sweep.

The window is measured from `stay_requests.checked_out_at`, recorded by
`check_out_stay`. It cannot be measured from `updated_at`: the touch trigger
moves that on every write, so a message or an admin edit would look like a fresh
check-out and push settlement another day away.

**Reminders run in the app.** `/api/cron/reminders` tells both sides that the
window to report damage is closing. It needs the mail provider and the link
structure, which live here, and it is guarded by `CRON_SECRET` — an open mail
trigger is a way to spam members.

## 11. Risks
- KYC provider cost and approval time.
- Legal exposure on host-side tenancy and liability.
- Cold start: not enough listings in a city.
- Photo-evidence disputes that photos alone can't settle.
