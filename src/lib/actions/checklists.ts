"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkInStay, checkOutStay, type ActionResult } from "@/lib/actions/stays";

export type Phase = "checkin" | "checkout";

export type RecordedItem = {
  room: string;
  item: string;
  /** Where the browser already put the photo, in the stay-evidence bucket. */
  storagePath: string | null;
  sha256: string | null;
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Records a check-in or check-out, then moves the stay.
 *
 * The photos are already in Storage by the time this runs: the browser uploads
 * them one at a time as they are taken, so a member on a weak connection is not
 * holding twenty images in memory waiting for one submit. This writes the rows
 * that point at them, with the hash and the stamps that make them evidence.
 */
export async function recordChecklist(
  stayId: string,
  phase: Phase,
  items: RecordedItem[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data: stay, error: stayError } = await supabase
    .from("stay_requests")
    .select("guest_id, host_id, status")
    .eq("id", stayId)
    .maybeSingle();
  if (stayError) return { ok: false, error: stayError.message };
  if (!stay) return { ok: false, error: "Stay not found." };

  const party = stay as { guest_id: string; host_id: string };
  const asGuest = party.guest_id === user.id;
  if (!asGuest && party.host_id !== user.id) {
    return { ok: false, error: "Not your stay." };
  }

  const signedAt = new Date().toISOString();
  const signature = asGuest ? { signed_by_guest: signedAt } : { signed_by_host: signedAt };

  // One checklist per stay and phase, so the second party signs the same row
  // rather than starting a parallel record.
  const { data: checklist, error: upsertError } = await supabase
    .from("checklists")
    .upsert({ stay_id: stayId, phase, ...signature }, { onConflict: "stay_id,phase" })
    .select("id")
    .single();
  if (upsertError) return { ok: false, error: upsertError.message };

  const checklistId = (checklist as { id: string }).id;

  const { error: itemError } = await supabase.from("checklist_items").upsert(
    items.map((i) => ({
      checklist_id: checklistId,
      room: i.room,
      item: i.item,
      storage_path: i.storagePath,
      sha256: i.sha256,
      // The time the photo was taken, not the time it was submitted. They can
      // be an hour apart on a bad connection, and the first one is the claim
      // the evidence actually makes.
      taken_at: i.takenAt ?? signedAt,
      latitude: i.latitude,
      longitude: i.longitude,
    })),
    { onConflict: "checklist_id,room,item" }
  );
  if (itemError) return { ok: false, error: itemError.message };

  // Only the first signature moves the stay; the second finds it already moved.
  const moved = phase === "checkin" ? await checkInStay(stayId) : await checkOutStay(stayId);
  if (!moved.ok && !/not confirmed|not in progress/.test(moved.error)) return moved;

  revalidatePath("/requests");
  return { ok: true, id: checklistId };
}

/** Both phases of a stay's record, for the side-by-side comparison. */
export async function checklistRecord(stayId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checklists")
    .select("id, phase, signed_by_guest, signed_by_host")
    .eq("stay_id", stayId);
  return (data ?? []) as {
    id: string;
    phase: Phase;
    signed_by_guest: string | null;
    signed_by_host: string | null;
  }[];
}
