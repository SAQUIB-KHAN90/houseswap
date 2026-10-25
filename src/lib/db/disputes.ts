import { createClient } from "@/lib/supabase/server";
import type { DisputeRow, HostCardRow, ListingRow, StayRequestRow } from "@/types/db";

export type DisputeView = {
  id: string;
  stayId: string;
  stay: string;
  raisedBy: string;
  issue: string;
  status: DisputeRow["status"];
  pointsHeld: number;
  pointsMoved: number;
};

const STATUS_LABELS: Record<DisputeRow["status"], string> = {
  open: "Open",
  in_review: "In review",
  resolved: "Resolved",
  rejected: "Rejected",
};

export const disputeStatusLabel = (s: DisputeRow["status"]) => STATUS_LABELS[s];

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * The dispute queue. Only staff see every row: `disputes_parties` limits
 * everyone else to the stays they were on.
 */
export async function openDisputes(): Promise<DisputeView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("disputes")
    .select("*")
    .in("status", ["open", "in_review"])
    .order("created_at");
  if (error) throw error;

  const rows = (data ?? []) as DisputeRow[];
  if (rows.length === 0) return [];

  const { data: stays } = await supabase
    .from("stay_requests")
    .select("*")
    .in("id", [...new Set(rows.map((r) => r.stay_id))]);
  const stayRows = (stays ?? []) as StayRequestRow[];

  const [{ data: listings }, { data: people }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, city, area")
      .in("id", [...new Set(stayRows.map((s) => s.listing_id))]),
    supabase
      .from("host_cards")
      .select("*")
      .in("id", [...new Set(rows.map((r) => r.raised_by))]),
  ]);

  const stayById = new Map(stayRows.map((s) => [s.id, s]));
  const listingById = new Map(
    ((listings ?? []) as Pick<ListingRow, "id" | "city" | "area">[]).map((l) => [l.id, l])
  );
  const nameById = new Map(((people ?? []) as HostCardRow[]).map((p) => [p.id, p.full_name]));

  return rows.map((r) => {
    const stay = stayById.get(r.stay_id);
    const listing = stay ? listingById.get(stay.listing_id) : undefined;
    return {
      id: r.id,
      stayId: r.stay_id,
      stay: stay
        ? `${listing ? `${listing.area}, ${listing.city}` : "Stay"} · ${day(stay.starts_on)}`
        : "Stay",
      raisedBy: nameById.get(r.raised_by) ?? "Member",
      issue: r.description,
      status: r.status,
      pointsHeld: stay?.points_held ?? 0,
      pointsMoved: r.points_moved,
    };
  });
}
