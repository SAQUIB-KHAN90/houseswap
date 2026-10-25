/**
 * When not to send.
 *
 * Email could go at any hour, but reminders now reach phones too, and a 3 a.m.
 * SMS about a check-out is worse than no SMS: it wakes somebody for something
 * that can wait until morning, and it is how a sender ends up reported and
 * blocked.
 *
 * Safe to defer, because the reminder window is twelve hours wide and the
 * sweep runs hourly: a stay that becomes due overnight is picked up after
 * 08:00, still well inside its 24 hours.
 *
 * Lives here rather than in the route because a route file may only export
 * HTTP handlers — and because a rule about when members get woken up deserves
 * a test.
 */
const QUIET_FROM_IST = 21;
const QUIET_UNTIL_IST = 8;

/** IST is UTC+5:30 year round, with no daylight saving, so this needs no library. */
export function istHour(now: Date): number {
  return new Date(now.getTime() + 5.5 * 3_600_000).getUTCHours();
}

export function inQuietHours(now: Date): boolean {
  const hour = istHour(now);
  return hour >= QUIET_FROM_IST || hour < QUIET_UNTIL_IST;
}
