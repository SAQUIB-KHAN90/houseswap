"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  notifyRequestApproved,
  notifyRequestDeclined,
  notifyRequestReceived,
} from "@/lib/email/notify";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Postgres raises a plain exception for every rule it enforces, and the message
 * is already written for a member to read ("not enough points: need 168, have
 * 84"). Pass it straight through rather than replacing it with something vaguer.
 */
function failed(error: { message: string }): ActionResult {
  return { ok: false, error: error.message };
}

const touched = () => {
  revalidatePath("/requests");
  revalidatePath("/wallet");
  revalidatePath("/host");
};

/**
 * Asks to stay. The function holds the points, checks the dates against the
 * listing's availability and refuses an unverified member, so the app does not
 * repeat any of that.
 */
export async function requestStay(input: {
  listingId: string;
  start: string;
  end: string;
  mode: "points" | "direct";
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_stay", {
    p_listing: input.listingId,
    p_start: input.start,
    p_end: input.end,
    p_mode: input.mode,
  });
  if (error) return failed(error);

  const id = data as string;
  // Awaited, not fired and forgotten: a serverless function can be frozen the
  // moment the response is returned, and a dangling promise would simply never
  // run. notify() never throws, so this cannot fail the request.
  await notifyRequestReceived(id);

  touched();
  return { ok: true, id };
}

/** Links the two legs of a direct swap and prices the gap between them. */
export async function pairDirectSwap(
  requestId: string,
  counterRequestId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("pair_direct_swap", {
    p_request: requestId,
    p_counter_request: counterRequestId,
  });
  if (error) return failed(error);
  touched();
  return { ok: true };
}

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return failed(error);
  touched();
  return { ok: true };
}

// Each of these is spelled out as an async function, not an arrow assigned to a
// const: Next only accepts async function declarations as server actions.
export async function approveStay(id: string) {
  const result = await call("approve_stay", { p_request: id });
  if (result.ok) await notifyRequestApproved(id);
  return result;
}

export async function declineStay(id: string, reason?: string) {
  const result = await call("decline_stay", { p_request: id, p_reason: reason ?? null });
  if (result.ok) await notifyRequestDeclined(id);
  return result;
}

export async function confirmStay(id: string) {
  return call("confirm_stay", { p_request: id });
}

export async function cancelStay(id: string) {
  return call("cancel_stay", { p_request: id });
}

export async function checkInStay(id: string) {
  return call("check_in_stay", { p_request: id });
}

export async function checkOutStay(id: string) {
  return call("check_out_stay", { p_request: id });
}

/** Raises a damage claim. Blocks settlement until staff resolve it. */
export async function raiseDispute(stayId: string, description: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!description.trim()) return { ok: false, error: "Describe what went wrong." };

  const { error } = await supabase
    .from("disputes")
    .insert({ stay_id: stayId, raised_by: user.id, description: description.trim() });
  if (error) return failed(error);

  revalidatePath("/requests");
  return { ok: true };
}

export async function sendMessage(stayId: string, body: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!body.trim()) return { ok: false, error: "Write a message first." };

  const { error } = await supabase
    .from("messages")
    .insert({ stay_id: stayId, sender_id: user.id, body: body.trim() });
  if (error) return failed(error);

  revalidatePath("/chat");
  return { ok: true };
}
