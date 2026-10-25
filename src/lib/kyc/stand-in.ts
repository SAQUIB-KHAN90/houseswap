/**
 * Whether the self-verification placeholder is allowed to run.
 *
 * It is off unless `ALLOW_SELF_VERIFY` is explicitly "true", and it can never
 * be on in production. Without that second condition the placeholder is one
 * forgotten environment variable away from letting anyone on the internet mark
 * themselves ID-verified, collect the starter points and book a stranger's
 * home — the whole trust model gone.
 *
 * The database refuses it too: `guard_profile_columns` in 0008 stops a member
 * writing `kyc_status` on their own row whatever the app does. This flag is the
 * outer of the two doors.
 *
 * Lives outside `actions/auth.ts` because every export of a "use server"
 * module has to be an async server action, and this is a plain predicate.
 */
export function selfVerifyAllowed(): boolean {
  return (
    process.env.ALLOW_SELF_VERIFY === "true" && process.env.NODE_ENV !== "production"
  );
}
