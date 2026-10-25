"use client";

import { createClient } from "@/lib/supabase/client";
import { photoKey, preparePhoto, type GeoStamp } from "@/lib/photos/capture";
import { EVIDENCE_BUCKET, LISTING_BUCKET } from "@/lib/photos/buckets";

export { EVIDENCE_BUCKET, LISTING_BUCKET };

/**
 * Uploading from the browser, straight to Supabase Storage.
 *
 * The file never passes through a server action. A multi-megabyte body through
 * a serverless function is slow, costs more and can hit request size limits,
 * and it buys nothing: the bucket policies in 0006 apply to the member's own
 * token, so the same rules are enforced either way.
 */

export type UploadedPhoto = {
  storagePath: string;
  sha256: string;
  takenAt: string;
  latitude: number | null;
  longitude: number | null;
};




async function upload(
  bucket: string,
  key: string,
  file: Blob,
  geo: GeoStamp
): Promise<UploadedPhoto> {
  const prepared = await preparePhoto(file);
  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).upload(key, prepared.blob, {
    contentType: "image/jpeg",
    // Never overwrite. Evidence has no update policy at all, and a listing
    // photo colliding would mean two listings sharing a key.
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return {
    storagePath: key,
    sha256: prepared.sha256,
    takenAt: prepared.takenAt,
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
  };
}

/** A photo of a home, for the listing. Public once the listing is live. */
export function uploadListingPhoto(listingId: string, file: Blob) {
  return upload(LISTING_BUCKET, photoKey([listingId]), file, null);
}

/**
 * A photo of one checklist item, at check-in or check-out.
 *
 * The path starts with the stay id, which is what the bucket policy reads to
 * decide who may see it.
 */
export function uploadEvidencePhoto(
  stayId: string,
  phase: "checkin" | "checkout",
  file: Blob,
  geo: GeoStamp
) {
  return upload(EVIDENCE_BUCKET, photoKey([stayId, phase]), file, geo);
}

/** Public URL for a listing photo. The bucket is public, so no signing. */
export function listingPhotoUrl(storagePath: string): string {
  const supabase = createClient();
  return supabase.storage.from(LISTING_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
