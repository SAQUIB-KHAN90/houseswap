"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/stays";

/**
 * Recording photos after the browser has uploaded them.
 *
 * The bytes go straight from the device to Storage; these actions only write
 * the rows that point at them. Both halves are protected by the same policies,
 * so a row can never point at an object its author was not allowed to write.
 */

export async function saveListingPhotos(
  listingId: string,
  photos: { storagePath: string; room?: string | null }[]
): Promise<ActionResult> {
  if (photos.length === 0) return { ok: true, id: listingId };

  const supabase = await createClient();
  const { error } = await supabase.from("listing_photos").insert(
    photos.map((p, index) => ({
      listing_id: listingId,
      storage_path: p.storagePath,
      room: p.room ?? null,
      sort_order: index,
    }))
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/host");
  revalidatePath("/search");
  revalidatePath(`/listings/${listingId}`);
  return { ok: true, id: listingId };
}

export async function removeListingPhoto(photoId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("listing_photos")
    .select("listing_id, storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo not found." };

  const row = photo as { listing_id: string; storage_path: string };

  const { error } = await supabase.from("listing_photos").delete().eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  // Then the object itself. If this fails the row is already gone, so the
  // photo has disappeared from the listing either way; what is left behind is
  // an orphaned file, not a visible fault.
  await supabase.storage.from("listing-photos").remove([row.storage_path]);

  revalidatePath("/host");
  revalidatePath(`/listings/${row.listing_id}`);
  return { ok: true, id: photoId };
}
