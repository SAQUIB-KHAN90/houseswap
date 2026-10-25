"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustPoints, restoreMember, suspendMember } from "@/lib/actions/admin";

type Panel = "suspend" | "points" | null;

/**
 * What staff can do to a member.
 *
 * Every one of these asks for a reason before it will go through, because the
 * database refuses without one — it is what the audit log entry is made of.
 */
export function MemberActions({
  userId,
  name,
  suspended,
}: {
  userId: string;
  name: string;
  suspended: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [delta, setDelta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "That did not work.");
        return;
      }
      setPanel(null);
      setReason("");
      setDelta("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap gap-2.5">
        {suspended ? (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => restoreMember(userId, reason))}
          >
            Restore {name.split(" ")[0]}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setPanel((p) => (p === "suspend" ? null : "suspend"))}
          >
            Suspend
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setPanel((p) => (p === "points" ? null : "points"))}
        >
          Adjust points
        </Button>
      </div>

      {panel === "suspend" && (
        <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
          <div className="min-w-[16rem] flex-1 space-y-1.5">
            <Label htmlFor={`reason-${userId}`}>Why, in the audit log</Label>
            <Input
              id={`reason-${userId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Repeated no-shows, two upheld damage claims"
            />
          </div>
          <Button
            size="sm"
            disabled={pending || !reason.trim()}
            onClick={() => run(() => suspendMember(userId, reason))}
          >
            {pending ? "…" : "Suspend"}
          </Button>
        </div>
      )}

      {panel === "points" && (
        <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
          <div className="space-y-1.5">
            <Label htmlFor={`delta-${userId}`}>Points</Label>
            <Input
              id={`delta-${userId}`}
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="-50"
              className="w-28"
            />
          </div>
          <div className="min-w-[16rem] flex-1 space-y-1.5">
            <Label htmlFor={`preason-${userId}`}>Why, shown on their history</Label>
            <Input
              id={`preason-${userId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Goodwill credit after a host cancellation"
            />
          </div>
          <Button
            size="sm"
            disabled={pending || !delta || !reason.trim()}
            onClick={() => run(() => adjustPoints(userId, Number(delta), reason))}
          >
            {pending ? "…" : "Apply"}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2.5 text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
