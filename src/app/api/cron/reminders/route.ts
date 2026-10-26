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
 * **The schedule does not matter.** It used to: the job took a one-hour slice
 * of check-outs and relied on running hourly to hit each stay exactly once,
 * which quietly breaks on any other cadence — and a Vercel Hobby account
 * allows only a daily cron. It now asks for "window still open, not yet
 * reminded" and records the send, so hourly, daily, twice over or by hand all
 * deliver once.
 */

export const dynamic = "force-dynamic";

/** How long after check-out a member may still report a problem. */
const WINDOW_HOURS = 24;

/** Nobody gets a second reminder with less than this left; it would only nag. */
const MIN_HOURS_LEFT = 1;

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

  // A guard for a hand-run at night, not for the schedule: the cron is set to
  // mid-morning IST. On a daily cadence this is the only run of the day, so it
  // must not routinely land here.
  if (inQuietHours(new Date())) {
    return NextResponse.json({ skipped: "quiet hours", stays: 0, emails: 0 });
  }

  const now = Date.now();
  const windowOpenedAfter = new Date(now - WINDOW_HOURS * 3_600_000).toISOString();

  // Everything still inside its 24 hours that has not been reminded yet.
  const { data, error } = await admin
    .from("stay_requests")
    .select("id, checked_out_at")
    .eq("status", "checked_out")
    .is("reminder_sent_at", null)
    .gte("checked_out_at", windowOpenedAfter)
    .order("checked_out_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stays = (data ?? []) as { id: string; checked_out_at: string }[];
  let sent = 0;
  let reminded = 0;

  for (const stay of stays) {
    const elapsed = (now - new Date(stay.checked_out_at).getTime()) / 3_600_000;
    const hoursLeft = Math.round(WINDOW_HOURS - elapsed);
    if (hoursLeft < MIN_HOURS_LEFT) continue;

    sent += await notifyCheckOutReminder(stay.id, hoursLeft);

    // Marked whether or not a message actually went out. A member with every
    // channel switched off, or a mail provider having a bad minute, should not
    // turn into the same stay being retried on every run forever.
    const { error: markError } = await admin
      .from("stay_requests")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", stay.id);
    if (!markError) reminded++;
  }

  return NextResponse.json({ stays: stays.length, reminded, emails: sent });
}
