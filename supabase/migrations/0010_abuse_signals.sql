-- Abuse detection.
--
-- prd.md 8 says "flagged users reviewed by staff" and never said what flags
-- them. architecture.md 8 pairs detection with the rate limiting that landed in
-- 0009. This is the detection half.
--
-- It computes signals from rows that already exist rather than keeping a score
-- on the member. A stored score needs a job to keep it fresh and goes stale
-- silently; a view is right by construction, and at pilot volumes the cost is
-- nothing.
--
-- **Nothing here suspends anybody.** Every flag is a reason for a person to
-- look, and `suspend_member` still needs a staff member and a written reason.
-- A heuristic that could remove someone's account on its own would be wrong at
-- this scale and wrong at any other: all of these have innocent explanations,
-- and the cost of acting on a false one is somebody's home and reputation.

/*
 * What the signals are, and why these and not counts of everything.
 *
 * Raw counts punish the busiest members: somebody with forty stays will
 * naturally have collected more of everything than somebody with two. Where it
 * matters the signal is a count against a short history, not a count.
 *
 * Outcome is used rather than the existence of a dispute. A claim that staff
 * rejected says something about the member who raised it; a claim staff upheld
 * says something about the member it was raised against. A claim still open
 * says nothing about anybody yet, and is shown as context only.
 */
create or replace view member_risk
  with (security_invoker = true)
  as
with stays as (
  select p.id as user_id,
         count(*) filter (where s.status = 'settled') as stays_completed
    from profiles p
    left join stay_requests s on p.id in (s.guest_id, s.host_id)
   group by p.id
),
claims as (
  select p.id as user_id,
         -- Claims the other side raised, which staff then upheld.
         count(*) filter (
           where d.raised_by <> p.id and d.status = 'resolved'
         ) as upheld_against,
         -- Claims this member raised, which staff threw out.
         count(*) filter (
           where d.raised_by = p.id and d.status = 'rejected'
         ) as claims_rejected,
         count(*) filter (
           where d.raised_by <> p.id and d.status in ('open', 'in_review')
         ) as open_against
    from profiles p
    left join stay_requests s on p.id in (s.guest_id, s.host_id)
    left join disputes d on d.stay_id = s.id
   group by p.id
),
cancels as (
  select p.id as user_id,
         count(*) filter (
           where s.status = 'cancelled'
             and s.cancelled_by = p.id
             and s.cancelled_from in ('approved', 'confirmed')
         ) as host_cancellations
    from profiles p
    left join stay_requests s on s.host_id = p.id
   group by p.id
),
reviews_count as (
  select p.id as user_id, count(r.id) as reviews_received
    from profiles p
    left join reviews r on r.target_id = p.id
   group by p.id
)
select p.id,
       p.full_name,
       p.suspended_at,
       p.trust_score,
       st.stays_completed,
       c.upheld_against,
       c.claims_rejected,
       c.open_against,
       cn.host_cancellations,
       rc.reviews_received,
       array_remove(array[
         case when c.upheld_against >= 2
              then format('%s damage claims upheld against them', c.upheld_against) end,
         case when c.upheld_against = 1 and st.stays_completed <= 2
              then 'a claim upheld against them on a short history' end,
         case when c.claims_rejected >= 2
              then format('%s claims they raised were rejected', c.claims_rejected) end,
         case when cn.host_cancellations >= 2
              then format('cancelled on %s approved guests', cn.host_cancellations) end,
         case when p.trust_score is not null and p.trust_score < 3.5
                   and rc.reviews_received >= 3
              then format('trust score %s across %s reviews', p.trust_score, rc.reviews_received) end
       ], null) as flags
  from profiles p
  join stays st        on st.user_id = p.id
  join claims c        on c.user_id = p.id
  join cancels cn      on cn.user_id = p.id
  join reviews_count rc on rc.user_id = p.id;

comment on view member_risk is
  'Reasons a member is worth a staff look. Advisory only: nothing acts on these '
  'automatically, and suspend_member still needs a person and a written reason.';

grant select on member_risk to authenticated;
