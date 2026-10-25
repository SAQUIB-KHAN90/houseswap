import Link from "next/link";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/stays/chat-view";
import { requireMember } from "@/lib/auth";
import { stayThreads } from "@/lib/db/stays";
import { stayMessages } from "@/lib/db/messages";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [member, sp] = await Promise.all([requireMember(), searchParams]);
  const stays = await stayThreads(member.id);

  const threads = stays.map((s) => ({
    id: s.id,
    name: s.counterparty?.name ?? "Member",
    sub:
      s.role === "host"
        ? `Request for your home · ${day(s.starts_on)}–${day(s.ends_on)}`
        : `${s.listing?.area ?? ""}, ${s.listing?.city ?? ""} · ${day(s.starts_on)}–${day(s.ends_on)}`,
    // Chat opens once the host has approved: before that there is nothing to
    // arrange, and the guest has not been given the address.
    open: s.status !== "requested",
  }));

  const active = threads.find((t) => t.id === sp.stay) ?? threads[0] ?? null;
  const messages = active ? await stayMessages(active.id, member.id) : [];

  return (
    <div>
      <PageTitle title="Messages" description="Chat opens once a host approves a request." />
      {threads.length === 0 ? (
        <div className="rounded-lg border bg-surface p-12 text-center">
          <h2 className="text-lg font-semibold">No conversations yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-muted">
            Request a stay, or approve one, and the thread opens here.
          </p>
          <Button asChild className="mt-6">
            <Link href="/trip">Plan a trip</Link>
          </Button>
        </div>
      ) : (
        <ChatView threads={threads} activeId={active!.id} messages={messages} />
      )}
    </div>
  );
}
