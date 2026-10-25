import { createClient } from "@/lib/supabase/server";
import type { HostCardRow } from "@/types/db";

export type ReviewView = {
  id: string;
  rating: number;
  body: string | null;
  authorName: string;
  /** Which side the author was on, read from the stay. */
  authorRole: "guest" | "host";
  createdAt: string;
  date: string;
};

type ReviewRow = {
  id: string;
  stay_id: string;
  author_id: string;
  target_id: string;
  rating: number;
  body: string | null;
  created_at: string;
};

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/**
 * Reviews written about one member.
 *
 * Readable by anyone: `reviews_read_all` is deliberately open, because a
 * review nobody outside the stay can read is not a trust signal.
 */
export async function reviewsAbout(userId: string, limit = 20): Promise<ReviewView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("target_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as ReviewRow[];
  if (rows.length === 0) return [];

  const [{ data: people }, { data: stays }] = await Promise.all([
    supabase
      .from("host_cards")
      .select("*")
      .in("id", [...new Set(rows.map((r) => r.author_id))]),
    supabase
      .from("stay_requests")
      .select("id, guest_id")
      .in("id", [...new Set(rows.map((r) => r.stay_id))]),
  ]);

  const nameById = new Map(((people ?? []) as HostCardRow[]).map((p) => [p.id, p.full_name]));
  // A stay is only readable by its own two members, so for anyone else this
  // map is empty and the role falls back to "guest".
  const guestByStay = new Map(
    ((stays ?? []) as { id: string; guest_id: string }[]).map((s) => [s.id, s.guest_id])
  );

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    authorName: nameById.get(r.author_id) ?? "Member",
    authorRole: guestByStay.get(r.stay_id) === r.author_id ? "guest" : "host",
    createdAt: r.created_at,
    date: monthYear(r.created_at),
  }));
}

export type AwaitingReview = { stayId: string; targetId: string };

/** Settled stays this member has not reviewed yet. */
export async function staysAwaitingReview(): Promise<AwaitingReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stays_awaiting_review");
  if (error) throw error;

  return ((data ?? []) as { stay_id: string; target_id: string }[]).map((r) => ({
    stayId: r.stay_id,
    targetId: r.target_id,
  }));
}

/** How many reviews a member has, for the count beside their score. */
export async function reviewCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("target_id", userId);
  if (error) throw error;
  return count ?? 0;
}
