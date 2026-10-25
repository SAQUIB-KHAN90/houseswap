"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail, MessageCircle, Smartphone } from "lucide-react";
import { setNotifyChannel, type Channel } from "@/lib/actions/preferences";
import { cn } from "@/lib/utils";

type Row = {
  channel: Channel;
  label: string;
  detail: string;
  icon: typeof Mail;
};

const ROWS: Row[] = [
  {
    channel: "notify_email",
    label: "Email",
    detail: "Requests, approvals and the check-out reminder.",
    icon: Mail,
  },
  {
    channel: "notify_whatsapp",
    label: "WhatsApp",
    detail: "The same alerts, shorter.",
    icon: MessageCircle,
  },
  {
    channel: "notify_sms",
    label: "SMS",
    detail: "For when you have no data connection.",
    icon: Smartphone,
  },
];

/**
 * Which channels a member wants.
 *
 * WhatsApp and SMS are off until switched on: a phone number given so a host
 * can reach a guest is not consent to be messaged on it. Both also need the
 * number verified, and nothing verifies it yet — so rather than letting
 * somebody switch one on and silently receive nothing, the control says why it
 * cannot be used.
 */
export function NotifySettings({
  values,
  phone,
  phoneVerified,
}: {
  values: Record<Channel, boolean>;
  phone: string | null;
  phoneVerified: boolean;
}) {
  const [state, setState] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(channel: Channel, on: boolean) {
    setError(null);
    setState((current) => ({ ...current, [channel]: on }));
    start(async () => {
      const result = await setNotifyChannel(channel, on);
      if (!result.ok) {
        setState((current) => ({ ...current, [channel]: !on }));
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const phoneReady = Boolean(phone) && phoneVerified;

  return (
    <div>
      <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
        {ROWS.map(({ channel, label, detail, icon: Icon }) => {
          const needsPhone = channel !== "notify_email";
          const blocked = needsPhone && !phoneReady;

          return (
            <li key={channel} className="flex items-start gap-3.5 p-4">
              <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={channel}
                  className={cn("font-medium", blocked && "text-muted")}
                >
                  {label}
                </label>
                <p className="mt-0.5 text-sm text-muted">
                  {blocked
                    ? !phone
                      ? "Add a mobile number to your profile first."
                      : "Your number has not been confirmed yet, so nothing would arrive."
                    : detail}
                </p>
              </div>
              <input
                id={channel}
                type="checkbox"
                checked={state[channel]}
                disabled={pending || blocked}
                onChange={(e) => toggle(channel, e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)] disabled:opacity-40"
              />
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-2.5 text-sm text-alert">
          {error}
        </p>
      )}

      <p className="mt-2.5 text-sm text-muted">
        You can switch any of these off at any time.
      </p>
    </div>
  );
}
