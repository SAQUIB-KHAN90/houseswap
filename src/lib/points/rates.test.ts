/**
 * Run with: npx tsx src/lib/points/rates.test.ts
 * No test framework needed: it exits non-zero on the first failure.
 */
import {
  amenityBonus,
  cancellationSplit,
  cancelWindow,
  DEPOSIT_INR,
  nightsBetween,
  pointsPerNight,
  stayCost,
  swapSettlement,
} from "./rates";

let failures = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}\n       expected ${e}\n       got      ${a}`);
  }
}

console.log("amenity bonus");
eq("none", amenityBonus(["Wi-Fi", "Kitchen access"]), 0);
eq("four scoring", amenityBonus(["AC", "Washing machine", "Full kitchen", "Parking"]), 8);
eq("capped at 12", amenityBonus([
  "AC", "Washing machine", "Full kitchen", "Parking", "Workspace", "Terrace", "Lift", "Child friendly",
]), 12);

console.log("rate table from prd.md 7a");
eq("private room, 1 bed", pointsPerNight({ type: "room", bedrooms: 1, amenities: ["Attached bathroom"] }), 14);
eq("room + kitchen, AC + workspace", pointsPerNight({ type: "room_kitchen", bedrooms: 1, amenities: ["AC", "Workspace"] }), 24);
eq("entire home 1BHK, four amenities", pointsPerNight({
  type: "home", bedrooms: 1, amenities: ["AC", "Washing machine", "Full kitchen", "Parking"],
}), 42);
eq("entire home 2BHK, four amenities", pointsPerNight({
  type: "home", bedrooms: 2, amenities: ["AC", "Washing machine", "Full kitchen", "Parking"],
}), 56);
eq("entire home 3BHK, five amenities", pointsPerNight({
  type: "home", bedrooms: 3, amenities: ["AC", "Washing machine", "Full kitchen", "Parking", "Terrace"],
}), 72);
eq("bedrooms floor at 1", pointsPerNight({ type: "home", bedrooms: 0, amenities: [] }), 34);
eq("city factor applies", pointsPerNight({ type: "home", bedrooms: 1, amenities: [], city: "Delhi" }), 34);

console.log("nights");
eq("four nights", nightsBetween("2026-11-12", "2026-11-16"), 4);
eq("same day is zero", nightsBetween("2026-11-12", "2026-11-12"), 0);
eq("reversed is zero", nightsBetween("2026-11-16", "2026-11-12"), 0);
eq("garbage is zero", nightsBetween("nonsense", "2026-11-12"), 0);
eq("stay cost", stayCost(34, 4), 136);

console.log("direct swap settlement, prd.md 7b");
eq("worked example: 42 vs 56 over four nights", swapSettlement({
  theirRate: 56, theirNights: 4, myRate: 42, myNights: 4,
}), { initiatorOwes: 56, receivedValue: 224, givenValue: 168 });
eq("equal homes cost nothing", swapSettlement({
  theirRate: 42, theirNights: 3, myRate: 42, myNights: 3,
}), { initiatorOwes: 0, receivedValue: 126, givenValue: 126 });
eq("initiator is owed when they give more", swapSettlement({
  theirRate: 20, theirNights: 2, myRate: 50, myNights: 2,
}), { initiatorOwes: -60, receivedValue: 40, givenValue: 100 });

console.log("cancellation windows, prd.md 10a");
const checkIn = new Date("2026-12-20T12:00:00Z");
eq("ten days out is early", cancelWindow(checkIn, new Date("2026-12-10T12:00:00Z")), "early");
eq("exactly seven days is mid", cancelWindow(checkIn, new Date("2026-12-13T12:00:00Z")), "mid");
eq("three days out is mid", cancelWindow(checkIn, new Date("2026-12-17T12:00:00Z")), "mid");
eq("48 hours is mid", cancelWindow(checkIn, new Date("2026-12-18T12:00:00Z")), "mid");
eq("one day out is late", cancelWindow(checkIn, new Date("2026-12-19T12:00:00Z")), "late");
eq("after check-in is late", cancelWindow(checkIn, new Date("2026-12-21T12:00:00Z")), "late");

console.log("cancellation split never loses or invents points");
for (const [w, held] of [["early", 136], ["mid", 135], ["late", 136]] as const) {
  const s = cancellationSplit(held, w);
  eq(`${w} ${held} conserves total`, s.toGuest + s.toHost, held);
}
eq("early refunds all", cancellationSplit(136, "early"), { toGuest: 136, toHost: 0 });
eq("mid splits half, rounding to the guest", cancellationSplit(135, "mid"), { toGuest: 68, toHost: 67 });
eq("late forfeits all", cancellationSplit(136, "late"), { toGuest: 0, toHost: 136 });

console.log("deposits, prd.md 7c");
eq("entire home", DEPOSIT_INR.home, 5000);
eq("room + kitchen", DEPOSIT_INR.room_kitchen, 2500);
eq("private room", DEPOSIT_INR.room, 1500);

console.log(failures === 0 ? "\nall points rules hold" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
