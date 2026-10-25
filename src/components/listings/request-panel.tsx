"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeftRight, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestStay } from "@/lib/actions/stays";
import { nightsBetween, stayCost, swapSettlement } from "@/lib/points/rates";
import { cn } from "@/lib/utils";

type Mode = "points" | "direct";

/** The member's own listing, when they have one to offer in a trade. */
export type OwnHome = { id: string; title: string; area: string; pointsPerNight: number };

export function RequestPanel({
  listingId,
  pointsPerNight,
  hostName,
  acceptsPoints,
  acceptsDirectSwap,
  depositInr,
  availablePoints,
  ownHome,
}: {
  listingId: string;
  pointsPerNight: number;
  hostName: string;
  acceptsPoints: boolean;
  acceptsDirectSwap: boolean;
  depositInr: number;
  availablePoints: number;
  ownHome: OwnHome | null;
}) {
  const bothModes = acceptsPoints && acceptsDirectSwap;
  const [mode, setMode] = useState<Mode>(acceptsPoints ? "points" : "direct");
  const [sent, setSent] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Dates for the stay being requested.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // For a direct swap, when the other side would stay at your place.
  const [returnStart, setReturnStart] = useState("");
  const [returnEnd, setReturnEnd] = useState("");

  const nights = useMemo(() => nightsBetween(startDate, endDate), [startDate, endDate]);
  const returnNights = useMemo(
    () => nightsBetween(returnStart, returnEnd),
    [returnStart, returnEnd]
  );

  const total = stayCost(pointsPerNight, nights);
  const myRate = ownHome?.pointsPerNight ?? 0;

  const settlement = useMemo(
    () =>
      swapSettlement({
        theirRate: pointsPerNight,
        theirNights: nights,
        myRate,
        myNights: returnNights,
      }),
    [pointsPerNight, nights, myRate, returnNights]
  );

  const firstName = hostName.split(" ")[0];

  function send(which: Mode) {
    setError(null);
    start(async () => {
      const result = await requestStay({
        listingId,
        start: startDate,
        end: endDate,
        mode: which,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(which);
    });
  }

  if (sent) {
    return (
      <div className="rounded-lg border bg-surface p-6 shadow-card">
        <CheckCircle2 className="size-7 text-brand" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">
          {sent === "points" ? "Request sent" : "Swap proposed"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {sent === "points"
            ? `${total} points are held until ${firstName} replies. If they decline, you get them back.`
            : `${firstName} files the return leg at your home, and the difference in value is priced then. Nothing is held until both legs are linked.`}
        </p>
        <Button asChild className="mt-5 w-full">
          <Link href="/requests">View your requests</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-surface p-6 shadow-card">
      <p className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold">{pointsPerNight} points</span>
        <span className="text-muted">night</span>
      </p>

      {bothModes && (
        <div
          role="tablist"
          aria-label="How to book"
          className="mt-5 grid grid-cols-2 gap-1 rounded-md bg-ink/[0.05] p-1"
        >
          {(
            [
              ["points", "Use points", KeyRound],
              ["direct", "Direct swap", ArrowLeftRight],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-sm py-2 text-sm font-semibold transition-colors",
                mode === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      {!bothModes && (
        <p className="mt-3 text-sm text-muted">
          {acceptsDirectSwap
            ? "This home is offered for direct swaps only."
            : "This home is offered for points only."}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <Label htmlFor="rp-start">Check in</Label>
          <Input
            id="rp-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-end">Check out</Label>
          <Input
            id="rp-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {mode === "points" ? (
        <>
          <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">
                {pointsPerNight} points × {nights} nights
              </dt>
              <dd>{total || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Available to spend</dt>
              <dd>{availablePoints}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Held on request</dt>
              <dd>{total ? `${total} points` : "—"}</dd>
            </div>
          </dl>

          {nights > 0 && total > availablePoints && (
            <p role="alert" className="mt-4 text-sm text-alert">
              You need {total - availablePoints} more points. Host a stay to earn them.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-alert">
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={!nights || total > availablePoints || pending}
            onClick={() => send("points")}
          >
            {pending ? "Sending…" : "Request stay"}
          </Button>
        </>
      ) : (
        <>
          {ownHome ? (
            <div className="mt-5 rounded-md border bg-page p-3.5">
              <p className="text-xs font-medium text-muted">You offer in return</p>
              <p className="mt-0.5 font-semibold">{ownHome.title}</p>
              <p className="text-sm text-muted">
                {ownHome.area} · {myRate} points night
              </p>
            </div>
          ) : (
            <p role="alert" className="mt-5 rounded-md bg-alert/10 px-3.5 py-2.5 text-sm text-alert">
              A direct swap needs a home of your own to offer.{" "}
              <Link href="/listings/new" className="font-semibold underline">
                List yours
              </Link>
              , or book this one with points.
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label htmlFor="rp-rstart">They arrive</Label>
              <Input
                id="rp-rstart"
                type="date"
                value={returnStart}
                onChange={(e) => setReturnStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-rend">They leave</Label>
              <Input
                id="rp-rend"
                type="date"
                value={returnEnd}
                onChange={(e) => setReturnEnd(e.target.value)}
              />
            </div>
          </div>

          <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Your stay, {nights} nights</dt>
              <dd>{settlement.receivedValue || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Their stay, {returnNights} nights</dt>
              <dd>{settlement.givenValue || "—"}</dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>{settlement.initiatorOwes >= 0 ? "You pay" : `${firstName} pays`}</dt>
              <dd>
                {nights && returnNights
                  ? settlement.initiatorOwes === 0
                    ? "Nothing, even trade"
                    : `${Math.abs(settlement.initiatorOwes)} points`
                  : "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-xs leading-relaxed text-muted">
            An estimate. The gap is priced for real when {firstName} files the return leg, and the
            more valuable stay is settled in points, so a 1BHK and a 3BHK are never traded as equals.
          </p>

          {nights > 0 && returnNights > 0 && settlement.initiatorOwes > availablePoints && (
            <p role="alert" className="mt-4 text-sm text-alert">
              Balancing this swap needs {settlement.initiatorOwes - availablePoints} more points.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-alert">
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={
              !ownHome ||
              !nights ||
              !returnNights ||
              settlement.initiatorOwes > availablePoints ||
              pending
            }
            onClick={() => send("direct")}
          >
            {pending ? "Sending…" : "Propose swap"}
          </Button>
        </>
      )}

      <p className="mt-2.5 text-center text-xs text-muted">
        {firstName} approves every request
        {depositInr > 0 ? ` · ₹${depositInr.toLocaleString("en-IN")} deposit, from phase 2` : ""}
      </p>
    </div>
  );
}
