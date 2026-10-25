/**
 * Bucket names, shared by the browser uploader and the server-side readers.
 *
 * Kept apart from upload.ts so a server component can name a bucket without
 * pulling in client-only code.
 */
export const LISTING_BUCKET = "listing-photos";
export const EVIDENCE_BUCKET = "stay-evidence";
