/**
 * Phone numbers in the shape WhatsApp and SMS want: E.164.
 *
 * Kept out of `phone.ts` so it can be tested: that file is `server-only`,
 * which refuses to load outside a server component, and this is a pure
 * function with the only interesting edge cases in the feature.
 *
 * Members type numbers as they please — ten digits, with +91, with spaces,
 * with dashes. Anything that is not clearly a full international number or a
 * ten-digit Indian mobile returns null rather than being guessed at: a message
 * delivered to the wrong person is worse than one not delivered.
 */
export function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return /^\+\d{8,15}$/.test(digits) ? digits : null;
  }
  // Already carries the country code.
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  // Indian mobile numbers are ten digits and start 6, 7, 8 or 9.
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;

  return null;
}
