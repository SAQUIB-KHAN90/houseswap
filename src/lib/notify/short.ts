import "server-only";

import type { StayEmail } from "@/lib/email/templates";

/**
 * The same four notifications, as a phone message.
 *
 * Not a truncated email. An SMS is one glance on a lock screen, so it says
 * what happened, the one number that matters and where to go — and nothing
 * else. Anything that reads as marketing is also what gets a sender flagged.
 *
 * Each carries the registered template it corresponds to. India drops
 * transactional SMS without a DLT template id, and WhatsApp outside the
 * service window only delivers templates Meta has approved, so the ids belong
 * next to the words they were registered with: change the words and the
 * registration no longer matches.
 *
 * The values array is the ordered parameter list a WhatsApp template takes.
 * It must line up with the {{1}}, {{2}} placeholders as registered, which is
 * why both live in the same object.
 */
export type ShortMessage = {
  /** For SMS. Kept under 160 characters so it is one segment. */
  text: string;
  /** DLT-registered template id. Undefined until registration is done. */
  smsTemplateId?: string;
  /** Meta-approved WhatsApp template. Undefined until approval is done. */
  whatsappTemplate?: string;
  /** Ordered values for that template's placeholders. */
  values: string[];
};

const env = (name: string) => process.env[name] || undefined;

const first = (name: string) => name.split(" ")[0];

const dates = (stay: StayEmail) => {
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${day(stay.startsOn)}-${day(stay.endsOn)}`;
};

export function requestReceivedShort(stay: StayEmail): ShortMessage {
  const values = [first(stay.otherName), stay.listingTitle, dates(stay)];
  return {
    text: `${values[0]} has asked to stay at ${values[1]}, ${values[2]}. Approve or decline in HouseSwap.`,
    smsTemplateId: env("SMS_TEMPLATE_REQUEST"),
    whatsappTemplate: env("WHATSAPP_TEMPLATE_REQUEST"),
    values,
  };
}

export function requestApprovedShort(stay: StayEmail): ShortMessage {
  const values = [first(stay.otherName), stay.city, dates(stay)];
  return {
    text: `${values[0]} approved your stay in ${values[1]}, ${values[2]}. Accept the house rules in HouseSwap to lock it in.`,
    smsTemplateId: env("SMS_TEMPLATE_APPROVED"),
    whatsappTemplate: env("WHATSAPP_TEMPLATE_APPROVED"),
    values,
  };
}

export function requestDeclinedShort(stay: StayEmail): ShortMessage {
  const values = [first(stay.otherName), String(stay.points)];
  return {
    text: `${values[0]} declined your request. Your ${values[1]} points are free to spend again.`,
    smsTemplateId: env("SMS_TEMPLATE_DECLINED"),
    whatsappTemplate: env("WHATSAPP_TEMPLATE_DECLINED"),
    values,
  };
}

export function checkOutReminderShort(
  stay: StayEmail & { hoursLeft: number }
): ShortMessage {
  const values = [String(stay.hoursLeft), stay.listingTitle];
  return {
    text: `${values[0]}h left to report a problem with ${values[1]}. After that the points go to the host.`,
    smsTemplateId: env("SMS_TEMPLATE_REMINDER"),
    whatsappTemplate: env("WHATSAPP_TEMPLATE_REMINDER"),
    values,
  };
}
