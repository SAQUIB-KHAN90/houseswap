import "server-only";

import { toE164 } from "@/lib/notify/e164";

/**
 * Sending to a phone, over WhatsApp or SMS.
 *
 * Twilio does both, so it is one account and one credential pair rather than
 * two vendors to onboard for a pilot. It is called over its HTTP API for the
 * same reason the mailer is: it is one form POST, and a dependency that wraps
 * one POST is a dependency to keep updated for nothing.
 *
 * ## Neither channel can be switched on today
 *
 * **SMS to an Indian number needs DLT registration.** TRAI requires the sender
 * and every template to be registered on a DLT platform before transactional
 * SMS will be delivered; unregistered traffic is dropped by the operators, not
 * by us. `SMS_DLT_ENTITY_ID` and a registered template id per message are
 * required once that is done.
 *
 * **WhatsApp business-initiated messages need approved templates.** Outside
 * the 24-hour window that opens when a member messages us first, only
 * templates Meta has approved may be sent, and they take ordered parameters
 * rather than free text. That is why `sendWhatsApp` takes a template name and
 * a list of values and not a sentence.
 *
 * Both are weeks of lead time, like the KYC provider. Until they are done the
 * functions below log what they would have sent and report it as not sent, so
 * the rest of the product works and nothing silently pretends to have told
 * somebody something.
 */

export { toE164 };

export type PhoneResult = { sent: boolean; skipped?: string; error?: string };

const TWILIO_API = "https://api.twilio.com/2010-04-01";

function credentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return sid && token ? { sid, token } : null;
}

async function post(path: string, body: Record<string, string>): Promise<PhoneResult> {
  const creds = credentials();
  if (!creds) {
    return { sent: false, skipped: "no provider configured" };
  }

  try {
    const response = await fetch(`${TWILIO_API}/Accounts/${creds.sid}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[phone] ${response.status}: ${detail.slice(0, 300)}`);
      return { sent: false, error: detail.slice(0, 300) };
    }
    return { sent: true };
  } catch (error) {
    // A notification must never take down the action that triggered it.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[phone] failed: ${message}`);
    return { sent: false, error: message };
  }
}

/**
 * An SMS.
 *
 * `templateId` is the DLT-registered template this message corresponds to.
 * India drops transactional SMS that does not carry one, so sending without it
 * is refused here rather than failing invisibly at the operator.
 */
export async function sendSms(
  to: string,
  body: string,
  templateId: string | undefined
): Promise<PhoneResult> {
  const number = toE164(to);
  if (!number) return { sent: false, skipped: "number is not in a usable form" };

  const sender = process.env.SMS_SENDER_ID;
  const entityId = process.env.SMS_DLT_ENTITY_ID;

  if (!sender || !entityId || !templateId) {
    console.info(`[sms] not registered, would have sent to ${number}: ${body}`);
    return { sent: false, skipped: "DLT registration incomplete" };
  }

  return post("Messages.json", {
    To: number,
    From: sender,
    Body: body,
    // Twilio passes these through to the Indian operators as the DLT proof.
    "PersistentAction": "",
    "StatusCallback": "",
    DltEntityId: entityId,
    DltTemplateId: templateId,
  });
}

/**
 * A WhatsApp message, as an approved template.
 *
 * Free text is deliberately not an option: outside the 24-hour service window
 * Meta only delivers approved templates, and letting callers pass a sentence
 * would build a habit that stops working the moment it matters.
 */
export async function sendWhatsApp(
  to: string,
  template: string | undefined,
  values: string[]
): Promise<PhoneResult> {
  const number = toE164(to);
  if (!number) return { sent: false, skipped: "number is not in a usable form" };

  const sender = process.env.WHATSAPP_FROM;

  if (!sender || !template) {
    console.info(
      `[whatsapp] no approved template, would have sent to ${number}: ${template ?? "?"}(${values.join(", ")})`
    );
    return { sent: false, skipped: "no approved template" };
  }

  return post("Messages.json", {
    To: `whatsapp:${number}`,
    From: `whatsapp:${sender}`,
    ContentSid: template,
    ContentVariables: JSON.stringify(
      Object.fromEntries(values.map((value, index) => [String(index + 1), value]))
    ),
  });
}
