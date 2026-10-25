import "server-only";

import type { Email } from "@/lib/email/send";

/**
 * The four messages the pilot sends.
 *
 * Written the way design.md asks the product to speak: plain, active, specific,
 * and stated in points rather than rupees. Each one says what happened, what it
 * costs or earns, and the single next thing to do.
 */

export type StayEmail = {
  to: string;
  /** Who the message is about, from the recipient's side. */
  otherName: string;
  listingTitle: string;
  area: string;
  city: string;
  startsOn: string;
  endsOn: string;
  nights: number;
  points: number;
  mode: "points" | "direct";
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const link = (path: string) => `${appUrl()}${path}`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const dates = (s: StayEmail) =>
  `${day(s.startsOn)} to ${day(s.endsOn)}, ${s.nights} ${s.nights === 1 ? "night" : "nights"}`;

const firstName = (name: string) => name.split(" ")[0];

/** To the host: somebody wants to stay. */
export function requestReceived(stay: StayEmail): Email {
  const value =
    stay.mode === "direct"
      ? "This is a direct swap, so the difference in value is settled in points once both legs are linked."
      : `You earn ${stay.points} points for this stay, released 24 hours after a clean check-out.`;

  return {
    to: stay.to,
    subject: `${firstName(stay.otherName)} wants to stay at ${stay.listingTitle}`,
    body: `${firstName(stay.otherName)} has asked to stay at ${stay.listingTitle}.

${dates(stay)}.

${value}

Their points are held until you reply, so a decline costs them nothing. Nobody arrives without your approval.

Approve or decline: ${link("/requests")}`,
  };
}

/** To the guest: you are going. */
export function requestApproved(stay: StayEmail): Email {
  return {
    to: stay.to,
    subject: `${firstName(stay.otherName)} approved your stay in ${stay.city}`,
    body: `${firstName(stay.otherName)} has approved your stay at ${stay.listingTitle} in ${stay.area}, ${stay.city}.

${dates(stay)}.

Accept the house rules to lock the dates in. The address is on your requests page now that you are approved, and you can message ${firstName(stay.otherName)} to agree on an arrival time.

Your stay: ${link("/requests")}`,
  };
}

/** To the guest: you are not going, and here are your points back. */
export function requestDeclined(stay: StayEmail): Email {
  return {
    to: stay.to,
    subject: `Your request for ${stay.listingTitle} was declined`,
    body: `${firstName(stay.otherName)} has declined your request to stay at ${stay.listingTitle}.

${dates(stay)}.

Nothing was charged. The ${stay.points} points that were held are available to spend again right away.

Other homes in ${stay.city}: ${link(`/search?to=${encodeURIComponent(stay.city)}`)}`,
  };
}

/**
 * To both sides, the morning after check-out: the clock is running.
 *
 * This one exists because the 24-hour window is the only chance to report
 * damage, and a window nobody is told about is not a protection.
 */
export function checkOutReminder(stay: StayEmail & { hoursLeft: number }): Email {
  return {
    to: stay.to,
    subject: `${stay.listingTitle}: ${stay.hoursLeft} hours left to report a problem`,
    body: `The stay at ${stay.listingTitle} has been checked out.

${dates(stay)}.

If something was damaged, report it in the next ${stay.hoursLeft} hours with photos. After that the points are released to the host and the stay is closed.

If everything was fine, you need do nothing at all.

The photo record: ${link("/requests")}`,
  };
}
