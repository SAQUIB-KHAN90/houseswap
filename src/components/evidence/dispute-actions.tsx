"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveDispute } from "@/lib/actions/disputes";

/**
 * How a claim is closed: the host keeps some of the guest's held points, and
 * whatever is not awarded simply stops being held.
 */
export function DisputeActions({
  disputeId,
  pointsHeld,
}: {
  disputeId: string;
  pointsHeld: number;
}) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState(Math.round(pointsHeld / 2));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function close(toHost: number, reason: string) {
    setError(null);
    start(async () => {
      const result = await resolveDispute(disputeId, toHost, reason || note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" disabled={pending} onClick={() => close(pointsHeld, "claim upheld")}>
          Award all {pointsHeld} to host
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || pointsHeld === 0}
          onClick={() => setPartial((p) => !p)}
        >
          Deduct part
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => close(0, "claim rejected, points returned to the guest")}
        >
          Reject the claim
        </Button>
      </div>

      {partial && (
        <div className="mt-3.5 flex flex-wrap items-end gap-2.5">
          <div className="space-y-1.5">
            <Label htmlFor={`award-${disputeId}`}>Points to the host</Label>
            <Input
              id={`award-${disputeId}`}
              type="number"
              min={0}
              max={pointsHeld}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-28"
            />
          </div>
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <Label htmlFor={`note-${disputeId}`}>Reason, shown to both</Label>
            <Input
              id={`note-${disputeId}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Scratch matches the check-out photo"
            />
          </div>
          <Button size="sm" disabled={pending} onClick={() => close(amount, note)}>
            {pending ? "Saving…" : "Close dispute"}
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
