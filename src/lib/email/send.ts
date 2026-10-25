import "server-only";

/**
 * Sending email, over Resend's HTTP API.
 *
 * Called over fetch rather than through the SDK: it is one POST, and a
 * dependency that exists to wrap one POST is a dependency to keep updated for
 * no reason.
 *
 * Without RESEND_API_KEY it logs what it would have sent and reports success.
 * That is deliberate — a development project with no mail provider should still
 * let you approve a request, and a notification is never worth failing the
 * action that triggered it.
 */
export type Email = {
  to: string;
  subject: string;
  /** Plain text. The HTML version is generated from it. */
  body: string;
};

const ENDPOINT = "https://api.resend.com/emails";

function sender(): string {
  return process.env.EMAIL_FROM ?? "HouseSwap <onboarding@resend.dev>";
}

/** Wraps the plain text in the least markup that still reads well in a client. */
function asHtml(body: string): string {
  const paragraphs = body
    .trim()
    .split("\n\n")
    .map(
      (p) =>
        `<p style="margin:0 0 16px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;color:#1B1A17;max-width:560px">${paragraphs}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendEmail(email: Email): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    console.info(`[email] not configured, would have sent to ${email.to}: ${email.subject}`);
    return { sent: false };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [email.to],
        subject: email.subject,
        text: email.body,
        html: asHtml(email.body),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[email] ${response.status} sending to ${email.to}: ${detail}`);
      return { sent: false, error: detail };
    }

    return { sent: true };
  } catch (error) {
    // A notification must never take the action down with it.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email] failed sending to ${email.to}: ${message}`);
    return { sent: false, error: message };
  }
}

/** Sends several, and never rejects: each result says what happened. */
export async function sendAll(emails: Email[]) {
  return Promise.all(emails.map(sendEmail));
}
