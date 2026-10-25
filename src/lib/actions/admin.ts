"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/stays";

/**
 * Staff actions.
 *
 * Each one is a single database function that acts and writes its own
 * `admin_actions` row in the same transaction. Nothing here checks whether the
 * caller is staff — the functions do, and putting the check in both places
 * would mean two definitions of who staff are.
 */

const touched = () => {
  revalidatePath("/admin/members");
  revalidatePath("/admin/log");
};

export async function suspendMember(userId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) {
    return { ok: false, error: "Give a reason. It goes in the audit log." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("suspend_member", {
    p_user: userId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  touched();
  revalidatePath("/search");
  return { ok: true, id: userId };
}

export async function restoreMember(userId: string, reason?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_member", {
    p_user: userId,
    p_reason: reason?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  touched();
  return { ok: true, id: userId };
}

/** A manual correction to a member's balance, logged with a reason. */
export async function adjustPoints(
  userId: string,
  delta: number,
  reason: string
): Promise<ActionResult> {
  const whole = Math.round(delta);
  if (!Number.isFinite(whole) || whole === 0) {
    return { ok: false, error: "Enter how many points to add or take away." };
  }
  if (!reason.trim()) {
    return { ok: false, error: "Give a reason. The member sees it on their history." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_points", {
    p_user: userId,
    p_delta: whole,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  touched();
  revalidatePath("/wallet");
  return { ok: true, id: userId };
}
