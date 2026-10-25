# HouseSwap — Product Requirements Document (PRD)

Status: Draft v0.2 · Date: 2026-10-24

## 1. Vision
A trusted home-swap platform for India. People travel by letting others stay in their home (full home, a private room, or room + kitchen) and earn **credit points** they spend to stay in someone else's home, in any city.

## 2. Problem
- Hotels and rentals are expensive for frequent travellers.
- Direct swaps rarely work: two people almost never need each other's city at the same time.
- Letting strangers into a home needs trust, proof of condition, and a way to settle damage.

## 3. Goals
1. Make a swap possible without both parties travelling at the same time (points model).
2. Build trust: verified identity, reviews, structured check-in/out evidence.
3. Be fair: bigger/better homes earn and cost more points.
4. Launch narrow (Delhi, Chandigarh, Jaipur) and prove people will actually swap.

Non-goals (v1): cash deposits and point top-ups over Razorpay (phase 2), mobile apps,
insurance integration, international cities.

## 4. Target users
Primary (to confirm): working professionals doing short trips/workations. Secondary: students, families.
- **Host**: owns/rents a home and can offer it while away.
- **Guest**: travels and wants to stay somewhere.
- A user can be both. Guest-only users are allowed (see Points).

## 4a. Decisions taken (24 Oct 2026)

| Question | Decision |
|---|---|
| Target user | **All three**: students, workation professionals and families. The product does not segment by user type; capacity, offering type and points cost do the filtering. |
| Points rates | Set by formula, defined in 7a. Implemented once in `src/lib/points/rates.ts` and stored on each listing. |
| Deposit | **Points hold from day one, real money later.** A refundable cash deposit over Razorpay is phase 2. The schema carries the deposit fields now so nothing has to be migrated later. |
| Swap modes | **Both.** A listing may accept points, direct swaps, or both. Unequal direct swaps are settled with points (7b). |

Consequences:
- A member may join without a home to list, such as a student in a hostel. They get the starter
  balance and, from phase 2, may buy points. Hosting is optional, not required.
- Families are served by the capacity filter and the `Child friendly` and `Lift` amenities, not by a
  separate product.
- Every stay request carries a `mode` of `points` or `direct`, so both paths share one state machine.

## 5. Offering types
Each listing offers one of:
- Entire home
- Private room (host may be present)
- Room + kitchen access
Each listing sets house rules, capacity, amenities, photos, and availability dates.

## 6. Core user flow
1. **Sign up** (phone/email).
2. **Verify identity**: government ID via a licensed provider (e.g. DigiLocker-based) plus selfie match. Raw Aadhaar number is never stored.
3. **Trip intent**: enter origin city, destination city, dates.
4. **Match**: see homes in the destination available on those dates; filter by offering type and point cost.
5. **Review a listing**: photos, offering type, house rules, host's trust score, reviews, points cost.
6. **Request stay**: spends points into escrow; host approves or declines.
7. **Confirm**: both parties accept house rules; dates locked.
8. **Check-in**: guided room-by-room photo checklist, timestamped, signed off by both parties (baseline).
9. **Stay.**
10. **Check-out**: same checklist photos; system lays them side-by-side against baseline.
11. **Settle**: if no issue reported within 24h, points released to host and reviews unlock. If an issue is reported, go to dispute.

## 7. Points system
- **Earn**: hosting a stay (points scale with offering type, size, bedrooms, amenities); verified signup bonus; completing a first listing.
- **Spend**: staying at another home; cost scales the same way per night.
- **Starting balance**: new verified users receive a starter balance so they can take a first trip.
- **Guest-only users**: get the starter balance and, from phase 2, may buy top-up points.
- **Escrow**: guest's points are held at request, released to host after clean check-out.
- **Visible history**: host's total hosting count and points history shown on profile as a trust signal.
- Exact rates: see 7a. Both swap modes: see 7b.

## 7a. Points rate table

Rate per night for a listing:

```
points_per_night = base + (bedrooms x per_bedroom) + amenity_bonus
```

| Offering type | Base | Per bedroom |
|---|---|---|
| Entire home | 20 | 14 |
| Room + kitchen | 14 | 6 |
| Private room | 10 | 4 |

`amenity_bonus` is +2 for each of these, capped at +12: AC, washing machine, full kitchen, parking,
workspace, terrace, lift, child friendly. Wi-Fi, kitchen access, attached bathroom and breakfast
score zero: they are either baseline or already priced into the offering type.

Worked examples:

| Listing | Calculation | Points / night |
|---|---|---|
| Private room, 1 bed, attached bath | 10 + 4 + 0 | 14 |
| Room + kitchen, 1 bed, AC and workspace | 14 + 6 + 4 | 24 |
| Entire home, 1BHK, AC, washing machine, kitchen, parking | 20 + 14 + 8 | 42 |
| Entire home, 2BHK, same four amenities | 20 + 28 + 8 | 56 |
| Entire home, 3BHK, five amenities | 20 + 42 + 10 | 72 |

Other balances:

- **Starter balance:** 100 points on passing verification. Roughly two nights in a 1BHK, or seven in
  a private room.
- **Listing bonus:** 25 points when a first listing goes live. Rewards supply without waiting for a
  completed stay.
- **Top-up (phase 2):** 1 point = Rs 40, bought over Razorpay. Provisional, and the main lever for
  members who cannot host.
- **City factor:** a multiplier, 1.0 across all pilot cities. It sits in the formula as a lever for
  when demand between cities turns lopsided.

These numbers are a starting point, not a finished economy. Watch the ratio of points earned to
points spent during the pilot: if the pool inflates, cut the listing bonus before touching rates.

## 7b. Direct swaps

A direct swap is two linked stays, one in each direction, which need not run on the same dates.

- Each stay is priced in points as usual.
- The side receiving the more valuable stay pays the difference in points. A 42/night home traded
  against a 56/night home for four nights leaves a gap of (56 - 42) x 4 = 56 points, paid by the
  guest of the more valuable home.
- If the gap is zero, no points move and the swap costs nothing.
- Both sides must approve before either stay is confirmed. One rejection cancels the pair.
- Each side keeps its own check-in and check-out record. A dispute on one leg does not block the other.

This keeps a straight trade attractive without pretending a 1BHK and a bungalow are worth the same.

## 7c. Deposits (phase 2)

A refundable cash deposit, held over Razorpay, on top of the points hold:

| Offering type | Suggested deposit |
|---|---|
| Entire home | Rs 5,000 |
| Room + kitchen | Rs 2,500 |
| Private room | Rs 1,500 |

Hosts may waive it. Released 24 hours after a clean check-out, on the same schedule as the points.
Not built in phase 1: the schema carries `deposit_inr`, `deposit_status` and `payment_ref` so the
integration drops in without a migration.

## 8. Trust & safety
- Mandatory ID + selfie verification before any request or listing goes live.
- Host approval required for every stay.
- Two-sided reviews after each stay.
- Report/SOS flow during a stay; flagged users reviewed by staff.
- Structured evidence: checklist per room (walls, furniture, appliances, kitchen, bathroom), photos with timestamp and geo-stamp.
- Security hold: part of guest's points (and optionally a refundable deposit later) held until check-out is clear.

## 8a. What flags a member

Section 8 says flagged users are reviewed by staff and never said what flags
them. These do, and they appear on a "Needs a look" queue in the staff panel:

| Signal | Threshold |
|---|---|
| Damage claims upheld against them | 2, or 1 on a history of 2 stays or fewer |
| Claims they raised that staff rejected | 2 |
| Cancelling on a guest after approving | 2 |
| Trust score below 3.5 | with at least 3 reviews |

Two principles behind the thresholds.

**Outcome, not accusation.** A claim that exists says nothing about anybody; a
claim staff *upheld* says something about the member it was raised against, and
a claim staff *rejected* says something about whoever raised it. Counting
disputes rather than their outcomes would punish members for having been
complained about, which is an easy thing to arrange.

**Rates, not counts, where it matters.** A member with forty stays will have
collected more of everything than one with two. One upheld claim against
somebody on their second stay is worth a look; the same claim against somebody
on their fortieth is not, and the thresholds say so.

**Nothing is automatic.** A flag is a reason for a person to read the stay and
the photo record. Suspension still takes a staff member and a written reason
(9). Every one of these signals has an innocent explanation — a genuinely
unlucky host, a guest who was right twice — and the cost of acting on a false
one is somebody's home and reputation.

Thresholds are a starting point. Watch how many members the queue holds during
the pilot: a queue nobody can get through is the same as no queue.

## 9. Disputes
- Either party can raise a damage claim within 24h of check-out with photos.
- Support reviews baseline vs. check-out photos and messages.
- Outcomes: release points, partial/full deduction from guest's held points, account warning/suspension.
- Cash damages beyond points: out of scope v1; require policy/legal review.

## 10. Cancellations
- Guest cancels > 7 days before: full points returned.
- Guest cancels 2–7 days: partial return.
- Guest cancels < 48h or no-show: points forfeited to host.
- Host cancels after approval: host penalty (reputation + points) and guest fully refunded.
(Thresholds are a starting proposal.)

## 10a. Cancellation points, exactly

| When the guest cancels | Points returned |
|---|---|
| More than 7 days before check-in | 100% |
| 2 to 7 days before | 50% |
| Less than 48 hours, or no-show | 0% |

A host who cancels after approving returns the guest's points in full and takes a trust-score
penalty. For a direct swap, cancelling one leg cancels both, and the penalty falls on the side that
cancelled.

## 11. Functional requirements (v1)
- Auth, profile, ID verification
- Listing create/edit with photos, house rules, availability calendar
- Search/match by city + dates + offering type
- Request/approve flow with escrow
- Points ledger (earn, hold, release, deduct)
- In-app chat between matched users
- Check-in/out photo checklist with timestamps and comparison view
- Reviews and trust score
- Report/dispute flow with admin panel
- Notifications (email, WhatsApp/SMS later)

## 12. Non-functional requirements
- Compliance with India's data protection and Aadhaar rules; encrypt PII at rest.
- Mobile-first responsive web.
- Photo storage with tamper-resistant metadata.
- Basic audit log for points and disputes.

## 13. Legal & policy items to check before launch
- Society/RWA rules and tenancy agreements (renters may not be allowed to host).
- Police/tenant verification norms for guests.
- Liability terms, user agreement, damage policy.
- Insurance options.
- **DLT registration** with a TRAI-approved platform, for the sender and for
  every SMS template. Indian operators drop unregistered transactional SMS, so
  this is not optional and takes weeks.
- **WhatsApp Business templates** approved by Meta, for the same four messages.
  Outside the 24-hour service window nothing else is delivered.

Both of the last two block a channel that is otherwise built and tested. Start
them at the same time as the KYC provider: all three are lead time, not work.

## 14. Success metrics
- Verified users, active listings per city
- Request → approved → completed stay conversion
- Repeat stays per user
- Dispute rate (< 5% of stays)
- Average trust score; NPS after stays

## 15. Rollout
1. **Pilot**: 20–30 real swaps via simple site/WhatsApp, 1–2 cities.
2. **MVP**: web app with everything in §11.
3. **Growth**: more cities, mobile app, insurance, payments.

## 15a. Trust score, exactly

Both sides review each other after a stay settles, 1 to 5. The score on a
profile is not the plain average of those ratings:

```
trust_score = (C x m + sum(ratings) + 1.0 x host_cancellations)
              / (C + n + host_cancellations)

m = 4.2   the assumed rating of a member we know nothing about
C = 5     how many reviews it takes for a member's own record to outweigh it
```

Rounded to one decimal. A member with no ratings and no cancellations has **no
score at all**, not 4.2: the UI shows "New member". Inventing a number for
somebody with no history is the one thing a trust score must not do.

**Why not the plain average.** One 5-star review would put a brand-new host
above a host with forty reviews averaging 4.8, and the badge would mean the
opposite of what it says. Pulling the score toward a prior fixes that: a single
5 gives 4.33, two 5s give 4.43, and it takes a real record to reach 4.8. The
pull fades as evidence accumulates, which is the point.

**Why m is 4.2 and not 5.** Starting everyone at the top means the score can
only ever fall, so it reads as a complaint count rather than a reputation. 4.2
sits slightly below where real review averages land, so a good host visibly
climbs.

**Cancellations count against it.** A host who cancels after approving enters
the pool as a rating of 1.0 (prd.md 10a). Folding the penalty into the same
formula keeps the score inside 1–5 with no special cases, and makes one
cancellation cost exactly what one one-star review costs — a host on 4.5 after
three good stays drops to 4.1. That is the right exchange rate, because to the
guest whose trip collapsed it is worse than a bad stay.

**What the numbers do.** No history is null. One five-star review gives 4.3,
two give 4.4, and it takes fifteen straight fives to reach 4.8, so the top of
the range stays worth something. A member with twenty one-star reviews sits at
1.6: the prior pulls up as well as down, which is the same mechanism and the
price of it.

Guest-side cancellations are not penalised here: they already forfeit points on
the schedule in 10a, and charging twice for one act is not fair.

These numbers are a starting point. Watch the distribution during the pilot: if
every member sits between 4.5 and 4.8 the score is not separating anyone and C
should come down.

## 16. Open questions

Answered in 4a: target user, points rates, deposits, swap modes.
Answered in 15a: the trust-score formula.

Still open:
- Which ID verification provider, and the cost per check.
- Whether a cash deposit needs an escrow account or can sit on a Razorpay hold.
- Whether renters, as opposed to owners, may host, and what proof we ask for.
