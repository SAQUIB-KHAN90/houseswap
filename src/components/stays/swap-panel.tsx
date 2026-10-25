"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { proposeReturnLeg, type SwappableListing } from "@/lib/actions/swaps";
import { nightsBetween, stayCost } from "@/lib/points/rates";

/**
 * Answering a direct-swap request: pick one of their homes, pick dates, and the
 * trade is linked.
 *
 * The gap shown here is an estimate from the two nightly rates. The figure that
 * counts is the one `pair_direct_swap` computes and holds, and it is computed
 * from the same numbers — but the server decides, and a refusal is shown rather
 * than pre-empted.
 */
export function SwapPanel({
  incomingRequestId,
  requesterName,
  /** What the requester's stay at this member's home is worth. */
  theirStayValue,
  theirNights,
  listings,
  availablePoints,
}: {
  incomingRequestId: string;
  requesterName: string;
  theirStayValue: number;
  theirNights: number;
  listings: SwappableListing[];
  availablePoints: number;
}) {
  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const chosen = listings.find((l) => l.id === listingId);
  const nights = useMemo(() => nightsBetween(start, end), [start, end]);
  const myStayValue = stayCost(chosen?.pointsPerNight ?? 0, nights);

  // Positive: this member receives the more valuable stay and pays the gap.
  const iOwe = myStayValue - theirStayValue;
  const short = iOwe > 0 && iOwe > availablePoints;

  const firstName = requesterName.split(" ")[0];

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await proposeReturnLeg({
        incomingRequestId,
        listingId,
        start,
        end,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (listings.length === 0) {
    return (
      <p className="rounded-md bg-ink/[0.04] px-3.5 py-2.5 text-sm text-muted">
        {firstName} has no home open to direct swaps right now, so this trade cannot
        be completed. You can still decline, or ask them to list one.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-surface p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <ArrowLeftRight className="size-4 text-brand" aria-hidden />
        Trade back
      </h3>
      <p className="mt-1 text-sm text-muted">
        Pick one of {firstName}&apos;s homes and when you would stay. Both halves are
        linked, and either of you declining cancels the pair.
      </p>

      <div className="mt-4 space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor={`swap-listing-${incomingRequestId}`}>Where you would stay</Label>
          <Select
            id={`swap-listing-${incomingRequestId}`}
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
          >
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title} — {l.area}, {l.city} ({l.pointsPerNight}/night)
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <Label htmlFor={`swap-start-${incomingRequestId}`}>You arrive</Label>
            <Input
              id={`swap-start-${incomingRequestId}`}
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`swap-end-${incomingRequestId}`}>You leave</Label>
            <Input
              id={`swap-end-${incomingRequestId}`}
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <dl className="space-y-2 border-t pt-3.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">
              Their stay with you, {theirNights} {theirNights === 1 ? "night" : "nights"}
            </dt>
            <dd>{theirStayValue}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">
              Your stay with them, {nights} {nights === 1 ? "night" : "nights"}
            </dt>
            <dd>{myStayValue || "—"}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <dt>{iOwe >= 0 ? "You pay" : `${firstName} pays`}</dt>
            <dd>
              {nights === 0
                ? "—"
                : iOwe === 0
                  ? "Nothing, even trade"
                  : `${Math.abs(iOwe)} points`}
            </dd>
          </div>
        </dl>

        {short && (
          <p role="alert" className="text-sm text-alert">
            Balancing this needs {iOwe - availablePoints} more points. Pick a shorter
            stay, or a home worth less a night.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}

        <Button
          className="w-full"
          disabled={pending || !listingId || nights === 0 || short}
          onClick={send}
        >
          {pending ? "Linking…" : "Propose this trade"}
        </Button>
        <p className="text-center text-xs text-muted">
          Nothing is confirmed until you both approve.
        </p>
      </div>
    </div>
  );
}
