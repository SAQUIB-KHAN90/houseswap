/**
 * The points economy, in one place.
 *
 * Both the app and the seed data price listings through `pointsPerNight`, and
 * the value is stored on the listing row. Nothing recomputes it in SQL, so
 * there is only ever one definition of the rules.
 *
 * Rates are documented in prd.md section 7a.
 */

export type OfferingType = "home" | "room_kitchen" | "room";

export const offeringLabels: Record<OfferingType, string> = {
  home: "Entire home",
  room_kitchen: "Room + kitchen",
  room: "Private room",
};

/** The amenities a listing may declare. Anything else is not offered. */
export const AMENITIES = [
  "Wi-Fi",
  "AC",
  "Washing machine",
  "Full kitchen",
  "Kitchen access",
  "Parking",
  "Workspace",
  "Terrace",
  "Lift",
  "Child friendly",
  "Attached bathroom",
  "Breakfast",
] as const;

export type Amenity = (typeof AMENITIES)[number];

/**
 * Amenities that add to the nightly rate. The rest are either baseline
 * (Wi-Fi) or already priced into the offering type (kitchen access).
 */
const SCORING_AMENITIES = new Set<Amenity>([
  "AC",
  "Washing machine",
  "Full kitchen",
  "Parking",
  "Workspace",
  "Terrace",
  "Lift",
  "Child friendly",
]);

const AMENITY_POINTS = 2;
const AMENITY_BONUS_CAP = 12;

const BASE: Record<OfferingType, { base: number; perBedroom: number }> = {
  home: { base: 20, perBedroom: 14 },
  room_kitchen: { base: 14, perBedroom: 6 },
  room: { base: 10, perBedroom: 4 },
};

/**
 * A per-city multiplier, a lever for when demand between cities turns
 * lopsided. 1.0 everywhere during the pilot.
 */
export const CITY_FACTOR: Record<string, number> = {
  Delhi: 1,
  Chandigarh: 1,
  Jaipur: 1,
};

export const STARTER_POINTS = 100;
export const FIRST_LISTING_BONUS = 25;

/** Provisional top-up price, phase 2. Rupees per point. */
export const RUPEES_PER_POINT = 40;

/** Suggested refundable cash deposit, phase 2. Hosts may waive it. */
export const DEPOSIT_INR: Record<OfferingType, number> = {
  home: 5000,
  room_kitchen: 2500,
  room: 1500,
};

export function amenityBonus(amenities: readonly string[]): number {
  const scoring = amenities.filter((a) => SCORING_AMENITIES.has(a as Amenity)).length;
  return Math.min(scoring * AMENITY_POINTS, AMENITY_BONUS_CAP);
}

/**
 * The nightly rate for a listing. Stored on the listing when it is published,
 * so an existing stay is never repriced by a later rule change.
 */
export function pointsPerNight(input: {
  type: OfferingType;
  bedrooms: number;
  amenities: readonly string[];
  city?: string;
}): number {
  const { base, perBedroom } = BASE[input.type];
  const bedrooms = Math.max(1, Math.floor(input.bedrooms));
  const raw = base + bedrooms * perBedroom + amenityBonus(input.amenities);
  const factor = (input.city && CITY_FACTOR[input.city]) || 1;
  return Math.round(raw * factor);
}

export function nightsBetween(start: string | Date, end: string | Date): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const nights = Math.round((b - a) / 86_400_000);
  return nights > 0 ? nights : 0;
}

/** Total points a points-mode stay costs the guest. */
export function stayCost(pointsPerNightValue: number, nights: number): number {
  return Math.max(0, Math.round(pointsPerNightValue * nights));
}

/**
 * A direct swap, priced. Each leg is valued at its own nightly rate, and
 * whoever receives the more valuable stay pays the gap in points.
 *
 * Returns the points the initiator owes. A negative number means the other
 * side owes the initiator.
 */
export function swapSettlement(a: {
  /** Nightly rate of the home the initiator will stay in. */
  theirRate: number;
  /** Nights the initiator will stay. */
  theirNights: number;
  /** Nightly rate of the initiator's own home. */
  myRate: number;
  /** Nights the other side will stay with the initiator. */
  myNights: number;
}): { initiatorOwes: number; receivedValue: number; givenValue: number } {
  const receivedValue = stayCost(a.theirRate, a.theirNights);
  const givenValue = stayCost(a.myRate, a.myNights);
  return { initiatorOwes: receivedValue - givenValue, receivedValue, givenValue };
}

export type CancelWindow = "early" | "mid" | "late";

/** Which refund window a cancellation falls into. */
export function cancelWindow(checkIn: string | Date, now: Date = new Date()): CancelWindow {
  const hours = (new Date(checkIn).getTime() - now.getTime()) / 3_600_000;
  if (hours > 24 * 7) return "early";
  if (hours >= 48) return "mid";
  return "late";
}

const REFUND_SHARE: Record<CancelWindow, number> = {
  early: 1,
  mid: 0.5,
  late: 0,
};

/**
 * Points returned to the guest when they cancel, and points released to the
 * host as compensation. See prd.md section 10a.
 */
export function cancellationSplit(
  pointsHeld: number,
  window: CancelWindow
): { toGuest: number; toHost: number } {
  const toGuest = Math.round(pointsHeld * REFUND_SHARE[window]);
  return { toGuest, toHost: pointsHeld - toGuest };
}

/** Rupee value of a points balance, for display and phase-2 top-ups. */
export function pointsToRupees(points: number): number {
  return points * RUPEES_PER_POINT;
}
