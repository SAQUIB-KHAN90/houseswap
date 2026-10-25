import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCheckOutReminder } from "@/lib/email/notify";
import { inQuietHours } from "@/lib/notify/quiet-hours";

/**
 * Tells both sides that the window to report damage is closing.
 *
 * Settlement itself is not done here. It runs in the database, on pg_cron, so
 * that hosts get paid whether or not this app is deployed and reachable
 * (supabase/scheduled/settle.sql). This endpoint only sends mail, which needs
 * the app anyway.
 *
 * Meant to be called hourly. Vercel Cron is configured in vercel.json; any
 * scheduler works as long as it sends the secret.
 */

export const dynamic = "force-dynamic";

/** Remind once, in the hour that leaves this much of the window. */
const REMIND_AFTER_HOURS = 12;
const WINDOW_HOURS = 24;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Refuse rather than run open: an unauthenticated mail trigger is a way to
  // spam members.
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "not authorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "service role key not configured" }, { status: 500 });
  }

  // Not an error: the next run inside waking hours picks these up, and they
  // are still well within the stay's 24-hour window.
  if (inQuietHours(new Date())) {
    return NextResponse.json({ skipped: "quiet hours", stays: 0, emails: 0 });
  }

  const now = Date.now();
  const from = new Date(now - (REMIND_AFTER_HOURS + 1) * 3_600_000).toISOString();
  const until = new Date(now - REMIND_AFTER_HOURS * 3_600_000).toISOString();

  // A one-hour slice, so an hourly run reminds each stay exactly once without
  // needing a "reminded" flag on the row.
  const { data, error } = await admin
    .from("stay_requests")
    .select("id, checked_out_at")
    .eq("status", "checked_out")
    .gte("checked_out_at", from)
    .lt("checked_out_at", until);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stays = (data ?? []) as { id: string; checked_out_at: string }[];
  let sent = 0;

  for (const stay of stays) {
    const elapsed = (now - new Date(stay.checked_out_at).getTime()) / 3_600_000;
    const hoursLeft = Math.max(1, Math.round(WINDOW_HOURS - elapsed));
    sent += await notifyCheckOutReminder(stay.id, hoursLeft);
  }

  return NextResponse.json({ stays: stays.length, emails: sent });
}
