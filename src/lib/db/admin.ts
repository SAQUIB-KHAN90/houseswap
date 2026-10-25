import { createClient } from "@/lib/supabase/server";

export type StaffMember = {
  id: string;
  name: string;
  city: string | null;
  kycStatus: string;
  trustScore: number | null;
  isStaff: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  joined: string;
  staysHosted: number;
  staysTaken: number;
  disputesInvolved: number;
};

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

type MemberRow = {
  id: string;
  full_name: string;
  home_city: string | null;
  kyc_status: string;
  trust_score: number | null;
  is_staff: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  stays_hosted: number;
  stays_taken: number;
  disputes_involved: number;
};

/**
 * The member list, for the staff screens.
 *
 * Reads `staff_members`, a view over `profiles` with phone and email left out.
 * It is `security_invoker`, so `profiles_read_own` still applies and a member
 * who is not staff sees only themselves — the view grants no new access, it
 * just saves the joins.
 */
export async function staffMembers(search?: string): Promise<StaffMember[]> {
  const supabase = await createClient();
  let query = supabase.from("staff_members").select("*");

  if (search?.trim()) {
    query = query.ilike("full_name", `%${search.trim()}%`);
  }

  const { data, error } = await query
    .order("suspended_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return ((data ?? []) as MemberRow[]).map((m) => ({
    id: m.id,
    name: m.full_name,
    city: m.home_city,
    kycStatus: m.kyc_status,
    trustScore: m.trust_score,
    isStaff: m.is_staff,
    suspendedAt: m.suspended_at,
    suspendedReason: m.suspended_reason,
    joined: monthYear(m.created_at),
    staysHosted: Number(m.stays_hosted ?? 0),
    staysTaken: Number(m.stays_taken ?? 0),
    disputesInvolved: Number(m.disputes_involved ?? 0),
  }));
}

export type RiskRow = {
  id: string;
  name: string;
  suspendedAt: string | null;
  trustScore: number | null;
  staysCompleted: number;
  upheldAgainst: number;
  claimsRejected: number;
  openAgainst: number;
  hostCancellations: number;
  /** Why this member is worth a look. Empty means nothing stands out. */
  flags: string[];
};

type RiskDbRow = {
  id: string;
  full_name: string;
  suspended_at: string | null;
  trust_score: number | null;
  stays_completed: number;
  upheld_against: number;
  claims_rejected: number;
  open_against: number;
  host_cancellations: number;
  flags: string[] | null;
};

const toRisk = (r: RiskDbRow): RiskRow => ({
  id: r.id,
  name: r.full_name,
  suspendedAt: r.suspended_at,
  trustScore: r.trust_score,
  staysCompleted: Number(r.stays_completed ?? 0),
  upheldAgainst: Number(r.upheld_against ?? 0),
  claimsRejected: Number(r.claims_rejected ?? 0),
  openAgainst: Number(r.open_against ?? 0),
  hostCancellations: Number(r.host_cancellations ?? 0),
  flags: r.flags ?? [],
});

/**
 * Members worth a staff look, most flags first.
 *
 * Advisory only. Nothing in the system acts on a flag: suspending still takes
 * a staff member and a written reason, because every one of these signals has
 * an innocent explanation and the cost of acting on a false one is somebody's
 * home and reputation.
 */
export async function flaggedMembers(): Promise<RiskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("member_risk")
    .select("*")
    .not("flags", "eq", "{}")
    .limit(100);
  if (error) throw error;

  return ((data ?? []) as RiskDbRow[])
    .map(toRisk)
    .filter((r) => r.flags.length > 0)
    .sort((a, b) => b.flags.length - a.flags.length);
}

/** Risk rows for members already on screen, keyed by id. */
export async function riskFor(ids: string[]): Promise<Map<string, RiskRow>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.from("member_risk").select("*").in("id", ids);
  if (error) throw error;

  return new Map(((data ?? []) as RiskDbRow[]).map((r) => [r.id, toRisk(r)]));
}

export type AuditEntry = {
  id: number;
  action: string;
  actorName: string;
  targetName: string | null;
  reason: string | null;
  detail: Record<string, unknown> | null;
  at: string;
};

const ACTION_LABELS: Record<string, string> = {
  suspend_member: "Suspended a member",
  restore_member: "Restored a member",
  adjust_points: "Adjusted points",
  resolve_dispute: "Resolved a dispute",
};

export const auditActionLabel = (action: string) => ACTION_LABELS[action] ?? action;

/**
 * The audit log. Staff-only by policy, and append-only in practice: nothing
 * grants insert, update or delete, so the only way a row appears is a staff
 * function writing one as it acts.
 */
export async function auditLog(limit = 100): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as {
    id: number;
    actor_id: string | null;
    action: string;
    target_user: string | null;
    reason: string | null;
    detail: Record<string, unknown> | null;
    created_at: string;
  }[];
  if (rows.length === 0) return [];

  const ids = [
    ...new Set(
      rows.flatMap((r) => [r.actor_id, r.target_user]).filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: people } = await supabase.from("host_cards").select("id, full_name").in("id", ids);
  const nameById = new Map(
    ((people ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name])
  );

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor_id ? (nameById.get(r.actor_id) ?? "Staff") : "System",
    targetName: r.target_user ? (nameById.get(r.target_user) ?? "Member") : null,
    reason: r.reason,
    detail: r.detail,
    at: when(r.created_at),
  }));
}
