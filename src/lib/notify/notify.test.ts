/**
 * Run with: npx tsx src/lib/notify/notify.test.ts
 * No test framework needed: it exits non-zero if anything failed.
 */
import { toE164 } from "./e164";
import { inQuietHours, istHour } from "./quiet-hours";

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

console.log("Indian mobile numbers, however they are typed");
eq("ten digits", toE164("9810012345"), "+919810012345");
eq("with spaces", toE164("98100 12345"), "+919810012345");
eq("with dashes", toE164("98100-12345"), "+919810012345");
eq("with the country code", toE164("919810012345"), "+919810012345");
eq("already E.164", toE164("+919810012345"), "+919810012345");
eq("E.164 with spaces", toE164("+91 98100 12345"), "+919810012345");
eq("starting 6", toE164("6012345678"), "+916012345678");
eq("starting 7", toE164("7012345678"), "+917012345678");

console.log("numbers to refuse rather than guess at");
// A landline or a mis-typed mobile. Prefixing +91 would send to someone else.
eq("ten digits starting 5", toE164("5012345678"), null);
eq("ten digits starting 0", toE164("0810012345"), null);
eq("nine digits", toE164("981001234"), null);
eq("eleven digits", toE164("98100123456"), null);
eq("empty", toE164(""), null);
eq("letters", toE164("call me"), null);
eq("a plus and nothing else", toE164("+"), null);
eq("too short for E.164", toE164("+9198"), null);
eq("too long for E.164", toE164("+9198100123456789"), null);

console.log("other countries pass through when fully qualified");
eq("UK", toE164("+447700900123"), "+447700900123");
eq("US", toE164("+12025550143"), "+12025550143");
// Without a country code there is no way to know which country this is.
eq("US number with no code", toE164("2025550143"), null);

console.log("quiet hours, in IST");
// IST is UTC+5:30, so 18:30 UTC is midnight IST.
eq("midnight IST", istHour(new Date("2026-10-24T18:30:00Z")), 0);
eq("09:00 IST", istHour(new Date("2026-10-24T03:30:00Z")), 9);

eq("3am is quiet", inQuietHours(new Date("2026-10-24T21:30:00Z")), true);
eq("7:59am is quiet", inQuietHours(new Date("2026-10-24T02:29:00Z")), true);
eq("8am is not", inQuietHours(new Date("2026-10-24T02:30:00Z")), false);
eq("midday is not", inQuietHours(new Date("2026-10-24T06:30:00Z")), false);
eq("8:59pm is not", inQuietHours(new Date("2026-10-24T15:29:00Z")), false);
eq("9pm is quiet", inQuietHours(new Date("2026-10-24T15:30:00Z")), true);

console.log(failures === 0 ? "\nall notification rules hold" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
