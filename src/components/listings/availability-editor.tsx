"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addAvailability, removeAvailability } from "@/lib/actions/listings";

export type Window = { id: string; start: string; end: string };

const label = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * The dates a listing is open.
 *
 * A listing cannot publish two overlapping windows: an exclusion constraint on
 * `availability` refuses it, and the error is surfaced here rather than checked
 * again in the browser.
 */
export function AvailabilityEditor({
  listingId,
  windows,
}: {
  listingId: string;
  windows: Window[];
}) {
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addAvailability(listingId, start, end);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStart("");
      setEnd("");
      setAdding(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeAvailability(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {windows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No dates open yet. Guests can only request dates you have opened.
        </p>
      ) : (
        <ul className="mt-3.5 space-y-2.5 text-sm">
          {windows.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2">
              <span>
                {label(w.start)} – {label(w.end)}
              </span>
              <button
                type="button"
                onClick={() => remove(w.id)}
                disabled={pending}
                aria-label={`Remove ${label(w.start)} to ${label(w.end)}`}
                className="grid size-7 place-items-center rounded-sm text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-4 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor={`av-start-${listingId}`}>From</Label>
              <Input
                id={`av-start-${listingId}`}
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`av-end-${listingId}`}>Until</Label>
              <Input
                id={`av-end-${listingId}`}
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={add} disabled={pending || !start || !end}>
              {pending ? "Saving…" : "Open these dates"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Open more dates
        </Button>
      )}

      {error && (
        <p role="alert" className="mt-2.5 text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
