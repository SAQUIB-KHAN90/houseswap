import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type Email } from "@/lib/email/send";
import { sendSms, sendWhatsApp } from "@/lib/notify/phone";
import {
  checkOutReminder,
  requestApproved,
  requestDeclined,
  requestReceived,
  type StayEmail,
} from "@/lib/email/templates";
import {
  checkOutReminderShort,
  requestApprovedShort,
  requestDeclinedShort,
  requestReceivedShort,
  type ShortMessage,
} from "@/lib/notify/short";

/**
 * Turning something that happened to a stay into a message on whichever
 * channels the member has actually asked for and can be reached on.
 *
 * Every function here swallows its own failures. A host not hearing about a
 * request is bad; a request failing to save because a provider was down would
 * be worse, and the member would have no idea which of the two happened.
 */

type Party = { id: string; name: string; email: string | null };

type StayFacts = {
  id: string;
  guest: Party;
  host: Party;
  listingTitle: string;
  area: string;
  city: string;
  startsOn: string;
  endsOn: string;
  nights: number;
  points: number;
  mode: "points" | "direct";
};

/** A channel the member has turned on and can be reached on. See 0011. */
type Channel = { channel: "email" | "whatsapp" | "sms"; address: string };

/**
 * Everything a notification needs, read past row-level security.
 *
 * It has to bypass RLS: the guest who triggers a request cannot read the
 * host's email or phone, which is the correct rule and the reason this lookup
 * happens here instead of in the action. Nothing read here is returned to the
 * caller.
 */
export async function stayFacts(stayId: string): Promise<StayFacts | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: stay } = await admin
    .from("stay_requests")
    .select(
      "id, guest_id, host_id, starts_on, ends_on, nights, points_total, swap_points_delta, mode, listing_id"
    )
    .eq("id", stayId)
    .maybeSingle();
  if (!stay) return null;

  const s = stay as {
    id: string;
    guest_id: string;
    host_id: string;
    starts_on: string;
    ends_on: string;
    nights: number;
    points_total: number;
    swap_points_delta: number;
    mode: "points" | "direct";
    listing_id: string;
  };

  const [{ data: people }, { data: listing }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", [s.guest_id, s.host_id]),
    admin.from("listings").select("title, area, city").eq("id", s.listing_id).maybeSingle(),
  ]);

  const byId = new Map(
    ((people ?? []) as { id: string; full_name: string; email: string | null }[]).map((p) => [
      p.id,
      { id: p.id, name: p.full_name, email: p.email },
    ])
  );

  const guest = byId.get(s.guest_id);
  const host = byId.get(s.host_id);
  if (!guest || !host) return null;

  const home = (listing as { title: string; area: string; city: string } | null) ?? {
    title: "a home",
    area: "",
    city: "",
  };

  return {
    id: s.id,
    guest,
    host,
    listingTitle: home.title,
    area: home.area,
    city: home.city,
    startsOn: s.starts_on,
    endsOn: s.ends_on,
    nights: s.nights,
    // A direct swap only ever moves the gap between the two legs.
    points: s.mode === "points" ? s.points_total : Math.max(s.swap_points_delta, 0),
    mode: s.mode,
  };
}

/**
 * Which channels to use for a member.
 *
 * `notify_channels` decides, not this code: it is the one place that knows
 * preference has to be combined with having a number and having verified it.
 */
async function channelsFor(userId: string): Promise<Channel[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin.rpc("notify_channels", { p_user: userId });
  if (error) return [];
  return (data ?? []) as Channel[];
}

/** Shapes the facts for whichever side is being written to. */
function forRecipient(facts: StayFacts, to: "guest" | "host"): StayEmail {
  const recipient = to === "guest" ? facts.guest : facts.host;
  const other = to === "guest" ? facts.host : facts.guest;

  return {
    // Replaced per channel below; the templates want it for the email header.
    to: recipient.email ?? "",
    otherName: other.name,
    listingTitle: facts.listingTitle,
    area: facts.area,
    city: facts.city,
    startsOn: facts.startsOn,
    endsOn: facts.endsOn,
    nights: facts.nights,
    points: facts.points,
    mode: facts.mode,
  };
}

type Builders = {
  email: (stay: StayEmail) => Email;
  short: (stay: StayEmail) => ShortMessage;
};

/** Sends one notification everywhere the member has asked to receive it. */
async function fanOut(facts: StayFacts, to: "guest" | "host", build: Builders) {
  const recipient = to === "guest" ? facts.guest : facts.host;
  const channels = await channelsFor(recipient.id);
  if (channels.length === 0) return 0;

  const stay = forRecipient(facts, to);
  let sent = 0;

  for (const { channel, address } of channels) {
    if (!address) continue;

    if (channel === "email") {
      const result = await sendEmail({ ...build.email(stay), to: address });
      if (result.sent) sent++;
      continue;
    }

    const short = build.short(stay);
    const result =
      channel === "whatsapp"
        ? await sendWhatsApp(address, short.whatsappTemplate, short.values)
        : await sendSms(address, short.text, short.smsTemplateId);
    if (result.sent) sent++;
  }

  return sent;
}

async function notify(stayId: string, to: "guest" | "host", build: Builders) {
  try {
    const facts = await stayFacts(stayId);
    if (!facts) return 0;
    return await fanOut(facts, to, build);
  } catch (error) {
    console.error("[notify] failed:", error instanceof Error ? error.message : error);
    return 0;
  }
}

export const notifyRequestReceived = (stayId: string) =>
  notify(stayId, "host", { email: requestReceived, short: requestReceivedShort });

export const notifyRequestApproved = (stayId: string) =>
  notify(stayId, "guest", { email: requestApproved, short: requestApprovedShort });

export const notifyRequestDeclined = (stayId: string) =>
  notify(stayId, "guest", { email: requestDeclined, short: requestDeclinedShort });

/** Both sides get the reminder: either can raise a claim. */
export async function notifyCheckOutReminder(stayId: string, hoursLeft: number) {
  try {
    const facts = await stayFacts(stayId);
    if (!facts) return 0;

    const build: Builders = {
      email: (stay) => checkOutReminder({ ...stay, hoursLeft }),
      short: (stay) => checkOutReminderShort({ ...stay, hoursLeft }),
    };

    const counts = await Promise.all([
      fanOut(facts, "guest", build),
      fanOut(facts, "host", build),
    ]);
    return counts.reduce((total, n) => total + n, 0);
  } catch (error) {
    console.error("[notify] reminder failed:", error instanceof Error ? error.message : error);
    return 0;
  }
}
