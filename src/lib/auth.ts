import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PointsBalance, ProfileRow } from "@/types/db";

/**
 * The signed-in member, their profile row and their balance, in one call.
 *
 * Pages use `requireMember()`; the middleware has already bounced anonymous
 * visitors, so the redirect here is only a backstop.
 */
export type Member = {
  id: string;
  email: string | null;
  profile: ProfileRow;
  points: PointsBalance;
};

const EMPTY_BALANCE: PointsBalance = { settled: 0, held: 0, available: 0 };

export async function getMember(): Promise<Member | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: balance }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_points"),
  ]);

  if (!profile) return null;

  // my_points() returns a one-row table, so the client hands back an array.
  const points = (Array.isArray(balance) ? balance[0] : balance) ?? EMPTY_BALANCE;

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile as ProfileRow,
    points: points as PointsBalance,
  };
}

export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/login");
  return member;
}

/** Pages that need a verified member, since `request_stay` refuses otherwise. */
export async function requireVerifiedMember(): Promise<Member> {
  const member = await requireMember();
  if (member.profile.kyc_status !== "verified") redirect("/verify");
  return member;
}
