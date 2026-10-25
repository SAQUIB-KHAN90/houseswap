"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/stays";

/**
 * Closes a dispute, awarding the host `toHost` of the guest's held points.
 *
 * `resolve_dispute` checks that the caller is staff and that the award is
 * within the hold, then writes both ledger rows and clears the hold in one
 * statement. Nothing here repeats those checks.
 */
export async function resolveDispute(
  disputeId: string,
  toHost: number,
  resolution: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute: disputeId,
    p_to_host: Math.max(0, Math.round(toHost)),
    p_resolution: resolution,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/disputes");
  revalidatePath("/requests");
  return { ok: true };
}

export async function takeDispute(disputeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_dispute", { p_dispute: disputeId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/disputes");
  return { ok: true };
}
