"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveStay,
  cancelStay,
  confirmStay,
  declineStay,
  type ActionResult,
} from "@/lib/actions/stays";

type Act = "approve" | "decline" | "confirm" | "cancel";

const run: Record<Act, (id: string) => Promise<ActionResult>> = {
  approve: approveStay,
  decline: declineStay,
  confirm: confirmStay,
  cancel: cancelStay,
};

/**
 * The buttons that move a stay along. Each one calls the matching database
 * function, which is where the rules live: only the host can approve, only the
 * guest can confirm, and cancelling late forfeits the points.
 */
export function StayActions({
  stayId,
  acts,
}: {
  stayId: string;
  acts: { act: Act; label: string; variant?: "default" | "outline" | "ghost" }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Act | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function go(act: Act) {
    setError(null);
    setBusy(act);
    start(async () => {
      const result = await run[act](stayId);
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex gap-2.5">
        {acts.map(({ act, label, variant }) => (
          <Button
            key={act}
            size="sm"
            variant={variant}
            disabled={pending}
            onClick={() => go(act)}
          >
            {busy === act ? "…" : label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="max-w-[18rem] text-right text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
