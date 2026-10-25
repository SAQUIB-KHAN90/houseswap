import { createClient } from "@/lib/supabase/server";
import { LISTING_BUCKET, EVIDENCE_BUCKET } from "@/lib/photos/buckets";

/** How long a signed evidence URL stays valid. Long enough to look, not to share. */
const SIGNED_URL_TTL = 60 * 10;

export type ListingPhoto = { id: string; url: string; room: string | null };

function publicUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string): string {
  return supabase.storage.from(LISTING_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Photos for one listing, in the order the host arranged them. */
export async function listingPhotosFor(listingId: string): Promise<ListingPhoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .select("id, storage_path, room")
    .eq("listing_id", listingId)
    .order("sort_order");
  if (error) throw error;

  return ((data ?? []) as { id: string; storage_path: string; room: string | null }[]).map((p) => ({
    id: p.id,
    url: publicUrl(supabase, p.storage_path),
    room: p.room,
  }));
}

/**
 * The first photo of each of many listings, for the card grids.
 *
 * One query for the whole page rather than one per card.
 */
export async function coverPhotosFor(listingIds: string[]): Promise<Map<string, string>> {
  if (listingIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .select("listing_id, storage_path, sort_order")
    .in("listing_id", listingIds)
    .order("sort_order");
  if (error) throw error;

  const covers = new Map<string, string>();
  for (const row of (data ?? []) as { listing_id: string; storage_path: string }[]) {
    // Ordered by sort_order, so the first one seen is the cover.
    if (!covers.has(row.listing_id)) {
      covers.set(row.listing_id, publicUrl(supabase, row.storage_path));
    }
  }
  return covers;
}

export type EvidenceShot = {
  url: string | null;
  takenAt: string | null;
  sha256: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type EvidencePair = {
  room: string;
  item: string;
  checkin: EvidenceShot | null;
  checkout: EvidenceShot | null;
};

type ItemRow = {
  room: string;
  item: string;
  storage_path: string | null;
  taken_at: string | null;
  sha256: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Check-in and check-out photos for a stay, paired up by room and item.
 *
 * This is the comparison the whole evidence idea rests on: the same fixed
 * checklist is shot twice, so the two photos of one item are directly
 * comparable. Items are keyed by room and item name, which `checklist_items`
 * already makes unique per checklist.
 *
 * Reading a URL needs a signature: the bucket is private and the policy only
 * lets the two parties and staff through. A member who is not on the stay gets
 * an empty list, not an error.
 */
export async function evidencePairs(stayId: string): Promise<EvidencePair[]> {
  const supabase = await createClient();

  const { data: checklists, error } = await supabase
    .from("checklists")
    .select("id, phase")
    .eq("stay_id", stayId);
  if (error) throw error;

  const rows = (checklists ?? []) as { id: string; phase: "checkin" | "checkout" }[];
  if (rows.length === 0) return [];

  const phaseById = new Map(rows.map((c) => [c.id, c.phase]));

  const { data: items, error: itemError } = await supabase
    .from("checklist_items")
    .select("checklist_id, room, item, storage_path, taken_at, sha256, latitude, longitude")
    .in(
      "checklist_id",
      rows.map((c) => c.id)
    );
  if (itemError) throw itemError;

  const paths = ((items ?? []) as (ItemRow & { checklist_id: string })[])
    .map((i) => i.storage_path)
    .filter((p): p is string => Boolean(p));

  const signed = await signEvidence(paths);

  const pairs = new Map<string, EvidencePair>();
  for (const row of (items ?? []) as (ItemRow & { checklist_id: string })[]) {
    const key = `${row.room}:${row.item}`;
    if (!pairs.has(key)) {
      pairs.set(key, { room: row.room, item: row.item, checkin: null, checkout: null });
    }

    const shot: EvidenceShot = {
      url: row.storage_path ? (signed.get(row.storage_path) ?? null) : null,
      takenAt: row.taken_at,
      sha256: row.sha256,
      latitude: row.latitude,
      longitude: row.longitude,
    };

    const phase = phaseById.get(row.checklist_id);
    if (phase === "checkin") pairs.get(key)!.checkin = shot;
    if (phase === "checkout") pairs.get(key)!.checkout = shot;
  }

  return [...pairs.values()];
}

/** Signs many paths in one call. */
async function signEvidence(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  // Not fatal: the record still shows what was confirmed and when, with the
  // photos missing, which beats failing the whole page.
  if (error) return new Map();

  return new Map(
    ((data ?? []) as { path: string | null; signedUrl: string }[])
      .filter((s) => s.path)
      .map((s) => [s.path!, s.signedUrl])
  );
}
