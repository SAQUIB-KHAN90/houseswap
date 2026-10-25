"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage } from "@/lib/actions/stays";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/db/messages";
import { cn } from "@/lib/utils";

export type Thread = { id: string; name: string; sub: string; open: boolean };

export function ChatView({
  threads,
  activeId,
  messages,
}: {
  threads: Thread[];
  activeId: string;
  messages: ChatMessage[];
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const bottom = useRef<HTMLDivElement>(null);

  const current = threads.find((t) => t.id === activeId)!;

  /**
   * Listens for messages on this stay instead of polling.
   *
   * The payload is ignored and the server component refetched. The row
   * Realtime delivers has only the columns `messages` holds — not who sent it
   * by name, not whether it is mine — so trusting it would mean duplicating
   * that mapping in the browser. Refetching keeps one definition of a message
   * and costs one round trip on an event that is already rare.
   *
   * Realtime respects row-level security, so `messages_parties` still decides
   * what arrives: subscribing cannot widen what this member can read.
   */
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`stay:${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `stay_id=eq.${activeId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, router]);

  // Follow the conversation as it grows, including messages that arrive while
  // the member is reading.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const result = await sendMessage(activeId, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div
      className="grid overflow-hidden rounded-lg border bg-surface md:grid-cols-[290px_1fr]"
      style={{ minHeight: 540 }}
    >
      <ul className="border-b md:border-b-0 md:border-r">
        {threads.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => router.push(`/chat?stay=${t.id}`)}
              aria-current={activeId === t.id}
              className={cn(
                "flex w-full items-center gap-3 border-b p-4 text-left transition-colors hover:bg-ink/[0.03]",
                activeId === t.id && "bg-brand-tint/60"
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">
                {t.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.name}</span>
                <span className="block truncate text-sm text-muted">{t.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col">
        <div className="border-b p-4">
          <p className="font-semibold">{current.name}</p>
          <p className="text-sm text-muted">{current.sub}</p>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-4" role="log" aria-live="polite">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {current.open
                ? "No messages yet. Say hello and agree on the arrival time."
                : "No messages yet. Approve the request to start talking."}
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[78%] rounded-lg px-3.5 py-2.5 text-[15px] leading-snug",
                    m.mine ? "bg-brand text-white" : "bg-ink/[0.06]"
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))
          )}
          <div ref={bottom} />
        </div>

        {error && (
          <p role="alert" className="border-t px-4 py-2 text-sm text-alert">
            {error}
          </p>
        )}

        <form onSubmit={send} className="flex gap-2.5 border-t p-3.5">
          <label htmlFor="msg" className="sr-only">
            Message
          </label>
          <Input
            id="msg"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={current.open ? "Write a message" : "Waiting on the host"}
            disabled={!current.open || pending}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={!current.open || pending}
          >
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}
