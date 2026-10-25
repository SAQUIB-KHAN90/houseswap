import { createClient } from "@/lib/supabase/server";
import type { LedgerKind, LedgerRow, PointsBalance } from "@/types/db";

/** How each kind of ledger row is described on the points screen. */
const KIND_LABELS: Record<LedgerKind, string> = {
  starter_bonus: "Verification bonus",
  listing_bonus: "First listing published",
  topup: "Points bought",
  stay_spent: "Stay booked",
  stay_earned: "Hosted a stay",
  swap_settlement: "Direct swap, difference settled",
  dispute_adjustment: "Dispute resolved",
  admin_adjustment: "Adjustment by staff",
};

export type LedgerEntry = {
  id: number;
  label: string;
  date: string;
  delta: number;
  kind: LedgerKind;
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export async function myLedger(limit = 50): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("points_ledger")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return ((data ?? []) as LedgerRow[]).map((r) => ({
    id: r.id,
    // The note is written by whichever function moved the points and says more
    // than the kind alone, so prefer it when there is one.
    label: r.note?.trim() || KIND_LABELS[r.kind],
    date: dayLabel(r.created_at),
    delta: r.delta,
    kind: r.kind,
  }));
}

/** Points the member has earned by hosting, for the host dashboard. */
export async function hostingTotals(): Promise<{ points: number; stays: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("points_ledger")
    .select("delta")
    .eq("kind", "stay_earned");
  if (error) throw error;

  const rows = (data ?? []) as { delta: number }[];
  return {
    points: rows.reduce((sum, r) => sum + r.delta, 0),
    stays: rows.length,
  };
}

export async function balanceFor(userId: string): Promise<PointsBalance> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("points_balance", { p_user: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PointsBalance) ?? { settled: 0, held: 0, available: 0 };
}
