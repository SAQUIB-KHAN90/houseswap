# HouseSwap

Home-swap platform. Next.js (App Router, TypeScript) + Supabase.
See `prd.md`, `architecture.md`, `design.md`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill it in. Browsing and every member
   action run on the anon key; the service role key is needed to seed and to
   send notifications. Email and cron settings are optional in development.
3. Apply `supabase/migrations` in order, then run `supabase/scheduled/settle.sql`
   once (see `supabase/README.md`).
4. `npm run seed` to create six verified members with listings, plus a staff
   account. They all sign in with the password printed at the end.
5. `npm run dev`

Deploying to Vercel: see [DEPLOY.md](DEPLOY.md).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build and type check |
| `npm run test:points` | The points rules in `src/lib/points/rates.ts` |
| `npm run test:notify` | Phone number parsing and quiet hours |
| `npm run test:db` | Every migration and `supabase/tests/scenario.sql`, on PGlite |
| `npm run seed` | Members and listings for a development project |
| `npm run photos:index` | Index your own photos from `public/homes` |

`npm run test:db` needs no Postgres and no Docker: PGlite is a real Postgres
compiled to WebAssembly, so the triggers, the plpgsql and the row-level
security all run as they would on the server. 137 assertions, covering
migrations 0001 to 0011.

## Structure

- `src/app/(auth)` sign up, sign in, ID verification
- `src/app/(app)` trip, search, listings, requests, stays (check-in/out), chat, wallet, host, profile
- `src/app/admin` disputes and moderation, staff only
- `src/components` ui, layout, listings, stays, evidence, auth, marketing
- `src/lib/db` read queries, one module per area
- `src/lib/actions` server actions; everything that writes goes through these
- `src/lib/points/rates.ts` the one definition of the points rules
- `src/lib/supabase` browser, server and middleware clients
- `src/types/db.ts` row shapes, kept in step with the migrations by hand
- `supabase/` migrations, tests and edge functions

## How the data layer is arranged

Reads go through `src/lib/db/*` from server components. Writes go through
`src/lib/actions/*`, and the ones that touch points call the database functions
rather than the tables: `points_ledger` takes no inserts from members and
`stay_requests` takes no updates at all, so the balance rules cannot be
side-stepped. Row-level security is the backstop, not the only check.

Postgres raises a readable message for every rule it enforces ("not enough
points: need 168, have 84"), and the actions pass it straight through to the
screen instead of restating the rule in TypeScript.

## Not built yet

**ID verification** is the one deliberate placeholder, and the UI says so.
No provider is chosen yet (`prd.md` 16), so `completeVerification()` in
`src/lib/actions/auth.ts` marks a member verified without checking anything. It
is replaced by the webhook in `src/app/api/webhooks/kyc`; delete it then.

It is shut behind two doors in the meantime:

- `selfVerifyAllowed()` needs `ALLOW_SELF_VERIFY=true` **and** a non-production
  build. The verify screen says plainly that nothing is connected and disables
  the button.
- `guard_profile_columns` in `0008` refuses `kyc_status` from a member whatever
  the app does, so the placeholder cannot be routed around by writing the
  column directly.



## Reviews and the trust score

Both sides review each other once a stay settles. `profiles.trust_score` is
computed by a trigger, never written by hand, using the formula in `prd.md` 15a:
a mean pulled toward a prior of 4.2, so one five-star review cannot put a new
host above somebody with forty. A member with no history has **no score** — the
UI says "New member" rather than inventing one.

A host who cancels after approving enters their own pool as a rating of 1.0.
That is how the penalty in `prd.md` 10a is actually applied, and it costs
exactly what a one-star review costs.

## Staff

`/admin` is staff-only and 404s for everyone else, rather than redirecting —
somebody who is not staff should not learn it exists. Four screens: the dispute
queue, "Needs a look", members, and the audit log.

Suspension, restoring, point adjustments and dispute resolutions each go
through a database function that refuses without a reason and writes its own
audit row in the same transaction. A suspended member sees a banner saying so
and why, rather than discovering it when a request silently fails.

**"Needs a look"** is the abuse-detection queue: members with claims upheld
against them, claims of their own that staff rejected, repeat cancellations on
approved guests, or a low trust score. Thresholds are in `prd.md` 8a.

It counts dispute *outcomes*, not disputes — counting accusations would punish
members for having been complained about, which is easy to arrange. And it is
advisory: nothing acts on a flag, because every signal has an innocent
explanation and the cost of being wrong is somebody's home and reputation.

## Chat

Messages arrive over a Supabase Realtime subscription on the stay's thread. The
payload is ignored and the server component refetched: the row Realtime
delivers holds only the columns `messages` has, so trusting it would mean
duplicating in the browser the mapping of who sent what. Realtime respects
row-level security, so subscribing cannot widen what a member can read.

## Rate limits

Triggers on `stay_requests` and `messages`, so the limit holds however a row
arrives rather than only through the server action. Ten requests an hour and
forty a day; twenty messages a minute and two hundred an hour. It is a rolling
window, not a ban.

## Maps

Leaflet with OpenStreetMap tiles — no key, no billing account. `src/lib/map.ts`
holds the tile URL and attribution, so moving to Mapbox later is that file plus
a key.

Hosts place their own point when they list; nothing is geocoded. What is stored
publicly is rounded by the database to about 100 m, and maps draw a 500 m
circle rather than a pin — the exact address lives in a different table behind
a policy that withholds it until a stay is approved. A pin would give away a
building the viewer has not earned the right to find.

Leaflet is imported inside an effect, never at module scope: it touches
`window` as it loads and would break the server render of any page holding a
map.

## Direct swaps

A trade is two ordinary stays pointing opposite ways. The guest proposes from a
listing page; the host answers from `/requests` by picking one of the
requester's homes and some dates, which files the return leg and links the pair
in one go. An unlinked direct request has no approve button, because there is
nothing yet to approve.

## Photos

Hosts upload their own; a listing with none falls back to the stock photography
in `src/lib/images.ts`, mixing real photos first where there are only a few.

**Every picture is served from this app's own origin.** `components/ui/photo.tsx`
goes through `next/image`, so the browser requests `/_next/image` and the server
fetches the real file. A network that blocks the photo host — plenty do, and any
ad blocker will — has nothing to block, because as far as the browser is
concerned the picture came from the site it was already on. The hosts the server
will fetch from are allow-listed in `next.config.ts`; without that list
`/_next/image` would be an open proxy.

To use your own pictures instead of the stock ones, drop any `.jpg`, `.png` or
`.webp` files into `public/homes` and run:

```bash
npm run photos:index
```

That writes `src/lib/local-photos.ts`, and those files are then used for every
listing without its own uploads, and for the hero and the illustrations. Each
listing gets a stable run of them, starting at a position derived from its id,
so two homes rarely share a cover. They are committed to the repository on
purpose, since the generated file names them and the build would otherwise
reference files that are not there.

A host's own uploads always win over both.

Evidence photos live in a private bucket and are read through short-lived
signed URLs. Both buckets are governed by policies in `0006_storage.sql`, which
reuse `in_stay()` — there is one definition of who may see a photo of the
inside of someone's home, and it is in SQL.

Uploads go **straight from the browser to Storage**, never through a server
action: the bucket policies apply to the member's own token either way, so
routing multi-megabyte bodies through a serverless function would buy nothing
and cost latency. Photos are resized to 1600px and re-encoded as JPEG on the
device first, which keeps check-in usable on Indian mobile data and means the
SHA-256 describes exactly the bytes that were stored.

`src/lib/photos/capture.ts` has the resize, hash and geo-stamp;
`src/lib/photos/upload.ts` does the uploading; `src/lib/db/photos.ts` reads
them back and pairs check-in against check-out.

## Scheduled work

Two jobs, in two places, for the reason given in `architecture.md` 10.

**Settlement, in the database.** `settle_due_stays()` releases escrowed points
to the host 24 hours after a clean check-out. pg_cron runs it hourly once you
have applied `supabase/scheduled/settle.sql`. Until that file has been run,
points go into escrow and never come out, so it is not optional.

Call it by hand to test:

```sql
select settle_due_stays();                      -- the real 24-hour window
select settle_due_stays(interval '0 seconds');  -- settle everything due now
```

**Reminders, in the app.** `/api/cron/reminders` tells both sides when the
window to report damage is closing. `vercel.json` schedules it hourly; any
scheduler works as long as it sends `Authorization: Bearer $CRON_SECRET`.
Without `CRON_SECRET` set the route refuses every call rather than running open.

## Notifications

Four events: a request arrives, it is approved, it is declined, and the
check-out reminder above. Each goes to every channel the member has asked for
and can be reached on — `notify_channels` in `0011` decides that, combining
preference with having a number and having verified it, so the sender never
works the rule out twice.

**Email is on by default; WhatsApp and SMS are opt-in.** A phone number given
so a host can reach a guest is not consent to be messaged on it. Members switch
them on, and off again, from their profile.

### Neither phone channel can be switched on yet

Both are blocked on registrations with weeks of lead time, like the KYC
provider:

- **SMS needs DLT registration.** TRAI requires the sender and every template
  to be registered on a DLT platform before Indian operators will deliver
  transactional SMS. Unregistered traffic is dropped by the carrier, not by us.
- **WhatsApp needs approved templates.** Outside the 24-hour window that opens
  when a member messages first, Meta delivers only templates it has approved,
  and they take ordered parameters rather than free text — which is why
  `sendWhatsApp` takes a template name and values, not a sentence.

Until those are done, both senders log what they would have sent and report
`sent: false`. Nothing silently pretends to have told somebody something. The
message text and its registered template id live together in
`src/lib/notify/short.ts`: change the words and the registration no longer
matches.

Phone messages are written for a lock screen, not truncated from the email.
Reminders also respect quiet hours — nothing goes out between 21:00 and 08:00
IST, which is safe because the reminder window is twelve hours wide and the
sweep runs hourly.

### Email

Without `RESEND_API_KEY` the app logs what it would have sent and carries on: a
host not hearing about a request is bad, but a request failing to save because
the mail provider was down would be worse. Notifications never fail the action
that triggered them.

Looking up the other party's address needs `SUPABASE_SERVICE_ROLE_KEY`, because
`profiles_read_own` correctly stops a guest reading the host's email. That
lookup is isolated in `src/lib/supabase/admin.ts` and nothing it reads is
returned to the caller.
