"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/stays";
import { notifyRequestReceived } from "@/lib/email/notify";

/**
 * Answers a direct-swap request by filing the return leg and linking the two.
 *
 * A trade is two ordinary stays pointing in opposite directions. The person who
 * was asked picks one of the requester's homes and some dates, which becomes
 * their own `request_stay` with `mode = 'direct'`; `pair_direct_swap` then links
 * the pair and prices the gap between them.
 *
 * Both calls are separate statements, so a failure to pair leaves the return
 * leg standing as an ordinary open request rather than something half-linked.
 * That is recoverable — it can be paired or cancelled — and is reported as
 * such.
 */
export async function proposeReturnLeg(input: {
  /** The direct request that arrived, which this leg will be paired with. */
  incomingRequestId: string;
  /** One of the requester's listings: where the member would stay in return. */
  listingId: string;
  start: string;
  end: string;
}): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: created, error } = await supabase.rpc("request_stay", {
    p_listing: input.listingId,
    p_start: input.start,
    p_end: input.end,
    p_mode: "direct",
  });
  if (error) return { ok: false, error: error.message };

  const returnLegId = created as string;

  const { error: pairError } = await supabase.rpc("pair_direct_swap", {
    p_request: input.incomingRequestId,
    p_counter_request: returnLegId,
  });

  if (pairError) {
    return {
      ok: false,
      error: `${pairError.message}. Your return request is still open under Your stays — pair or cancel it there.`,
    };
  }

  // The other side now has a request to approve, same as any other.
  await notifyRequestReceived(returnLegId);

  revalidatePath("/requests");
  revalidatePath("/wallet");
  return { ok: true, id: returnLegId };
}

export type SwappableListing = {
  id: string;
  title: string;
  area: string;
  city: string;
  pointsPerNight: number;
};

/**
 * The requester's homes that this member could stay in, in return.
 *
 * Only active listings that accept direct swaps: `request_stay` refuses the
 * rest, and offering them would be offering something that cannot work.
 */
export async function swappableListings(hostId: string): Promise<SwappableListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, area, city, points_per_night")
    .eq("host_id", hostId)
    .eq("status", "active")
    .eq("accepts_direct_swap", true)
    .order("points_per_night");
  if (error) return [];

  return (
    (data ?? []) as {
      id: string;
      title: string;
      area: string;
      city: string;
      points_per_night: number;
    }[]
  ).map((l) => ({
    id: l.id,
    title: l.title,
    area: l.area,
    city: l.city,
    pointsPerNight: l.points_per_night,
  }));
}
