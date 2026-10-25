"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/stays";

export type Channel = "notify_email" | "notify_whatsapp" | "notify_sms";

/**
 * Turns one notification channel on or off.
 *
 * These are ordinary profile columns a member owns, so `profiles_update_own`
 * is what allows it and the column guard from 0008 deliberately leaves them
 * alone. Opting in is the member's to give and to withdraw (DPDP), so there is
 * no path here for anyone else to set them.
 */
export async function setNotifyChannel(
  channel: Channel,
  on: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { error } = await supabase
    .from("profiles")
    .update({ [channel]: on })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true, id: user.id };
}
