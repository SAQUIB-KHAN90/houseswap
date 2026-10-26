# Going live on Vercel

The database is already a hosted Supabase project, so this is only the web app.

## 1. Put the code in Git

There is no repository yet. Vercel can take a direct upload, but connecting a
repository is what gives you a deploy on every push, so do this first.

```bash
git init
git add .
git commit -m "HouseSwap pilot"
```

Check what you are about to publish before you push:

```bash
git status --short
```

`.env` is ignored, which is what you want — the keys go into Vercel, not the
repository. Everything in `public/homes` **is** committed on purpose: the build
references those files by name.

Then create an empty repository on GitHub and push to it.

## 2. Import it

[vercel.com/new](https://vercel.com/new) → import the repository. Next.js is
detected; the build command and output directory need no changes.

## 3. Environment variables

Add these under Settings → Environment Variables. Copy the values from your
local `.env`, with the two exceptions noted.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as local |
| `SUPABASE_SERVICE_ROLE_KEY` | same as local — **secret**, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | **your Vercel URL**, not localhost |
| `CRON_SECRET` | **a new random value**, not the local dev one |
| `RESEND_API_KEY` | optional; without it email logs instead of sending |
| `EMAIL_FROM` | e.g. `HouseSwap <stays@yourdomain.com>` |

`NEXT_PUBLIC_APP_URL` is what every link inside an email is built from. Leave it
as localhost and you will send members links to their own machine.

**Do not set `ALLOW_SELF_VERIFY`.** It is refused in production anyway, but
leaving it out is one less thing to get wrong — it would let anyone mark
themselves ID-verified and take the starter points.

## 4. Pick a region

Settings → Functions → Region. Choose the one closest to your Supabase project
(Supabase dashboard → Settings → General shows it).

This matters more than anything else in this file. Every page here makes two
round trips to the database, and from a laptop in India those take about 250ms
each. Between a Vercel function and a Supabase project in the same region they
take a few milliseconds. Get this wrong and every page is half a second slower
than it needs to be, permanently.

## 5. Deploy, then check the cron

`vercel.json` schedules `/api/cron/reminders` **once a day at 05:00 UTC**
(10:30 IST). After the first deploy, Settings → Cron Jobs should list it.
Vercel sends `CRON_SECRET` automatically; the route refuses every call without
it.

**Why daily and not hourly.** A Vercel Hobby account allows one cron run a day
and rejects anything more frequent at import time. The job does not mind: it
asks for "window still open, not yet reminded" and records each send on
`stay_requests.reminder_sent_at`, so it delivers exactly once whether it runs
hourly, daily or by hand.

The trade-off is only in timing. A stay that checks out just after the daily
run is reminded close to the end of its 24 hours rather than in the middle of
it. On a Pro plan, change the schedule to `0 * * * *` and nothing else needs to
move.

Settlement is **not** on Vercel — it runs on pg_cron inside Supabase
(`supabase/scheduled/settle.sql`), so hosts get paid whether or not the web app
is up. Confirm it with `select * from cron.job;` in the SQL editor.

## 6. After the first deploy

- Sign up with a real email and confirm the whole flow works against production.
- Supabase → Authentication → URL Configuration: add your Vercel URL to the
  redirect allow-list, or email confirmation links will bounce.
- If you add a custom domain later, update `NEXT_PUBLIC_APP_URL` to match.

## Things that are not ready for real members

Stated plainly, because a deploy makes it easy to forget:

- **ID verification is a placeholder.** It refuses to run in production, so
  nobody can become verified on the live site, and therefore nobody can request
  a stay. A provider has to be connected first (`prd.md` 16).
- **WhatsApp and SMS** need DLT registration and Meta-approved templates
  (`prd.md` 13). Email works today.
- **No error monitoring.** Nothing reports a failure to you; you will hear it
  from a user.

A deploy is useful right now for showing people and for testing against real
infrastructure. It is not ready to take a real booking between two strangers.
