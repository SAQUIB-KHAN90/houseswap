"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/stays";

/**
 * Writes a review of the other person on a settled stay.
 *
 * Who may write one is decided by `reviews_write_after_stay`: the author has to
 * be on the stay and the stay has to have settled. The unique constraint on
 * (stay_id, author_id) is what stops a second review, so nothing here needs to
 * check for one. The trigger from 0007 recomputes the target's trust score.
 */
export async function submitReview(
  stayId: string,
  rating: number,
  body: string
): Promise<ActionResult> {
  const whole = Math.round(rating);
  if (whole < 1 || whole > 5) {
    return { ok: false, error: "Give a rating from 1 to 5." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  // The stay says who the other person is; the member never names a target.
  const { data: stay } = await supabase
    .from("stay_requests")
    .select("guest_id, host_id")
    .eq("id", stayId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "Stay not found." };

  const party = stay as { guest_id: string; host_id: string };
  const targetId = party.guest_id === user.id ? party.host_id : party.guest_id;
  if (targetId === user.id) return { ok: false, error: "You cannot review yourself." };

  const { error } = await supabase.from("reviews").insert({
    stay_id: stayId,
    author_id: user.id,
    target_id: targetId,
    rating: whole,
    body: body.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "You have already reviewed this stay." : error.message,
    };
  }

  revalidatePath("/requests");
  revalidatePath("/profile");
  return { ok: true, id: stayId };
}
