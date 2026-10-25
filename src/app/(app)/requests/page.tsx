import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { StayActions } from "@/components/stays/stay-actions";
import { ReviewPrompt } from "@/components/reviews/review-prompt";
import { SwapPanel } from "@/components/stays/swap-panel";
import { listingPhotos } from "@/lib/images";
import { coverPhotosFor } from "@/lib/db/photos";
import { requireMember } from "@/lib/auth";
import { staysAwaitingReview } from "@/lib/db/reviews";
import { swappableListings } from "@/lib/actions/swaps";
import {
  addressesForStays,
  incomingRequests,
  myStays,
  ownStays,
  type StayView,
} from "@/lib/db/stays";
import type { StayStatus } from "@/types/db";

const statusMeta: Record<StayStatus, { label: string; variant: BadgeVariant }> = {
  requested: { label: "Waiting for host", variant: "star" },
  approved: { label: "Approved", variant: "brand" },
  confirmed: { label: "Confirmed", variant: "brand" },
  checked_in: { label: "Staying now", variant: "solid" },
  checked_out: { label: "Checked out", variant: "default" },
  settled: { label: "Complete", variant: "default" },
  declined: { label: "Declined", variant: "default" },
  cancelled: { label: "Cancelled", variant: "default" },
  disputed: { label: "In dispute", variant: "alert" },
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** What the member can do next on a stay, given their side of it. */
function actionsFor(stay: StayView, awaitingReview: boolean) {
  if (stay.status === "settled" && awaitingReview) {
    return (
      <ReviewPrompt stayId={stay.id} aboutName={stay.counterparty?.name ?? "them"} />
    );
  }
  if (stay.role === "guest") {
    if (stay.status === "requested") {
      return <StayActions stayId={stay.id} acts={[{ act: "cancel", label: "Cancel", variant: "outline" }]} />;
    }
    if (stay.status === "approved") {
      return (
        <StayActions
          stayId={stay.id}
          acts={[
            { act: "confirm", label: "Accept rules" },
            { act: "cancel", label: "Cancel", variant: "outline" },
          ]}
        />
      );
    }
    if (stay.status === "confirmed") {
      return (
        <Button asChild size="sm">
          <Link href={`/stays/${stay.id}/checkin`}>Check in</Link>
        </Button>
      );
    }
    if (stay.status === "checked_in") {
      return (
        <Button asChild size="sm">
          <Link href={`/stays/${stay.id}/checkout`}>Check out</Link>
        </Button>
      );
    }
  }
  if (stay.status === "checked_out" || stay.status === "settled") {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/stays/${stay.id}/record`}>Photo record</Link>
      </Button>
    );
  }
  return null;
}

export default async function RequestsPage() {
  const member = await requireMember();
  const stays = await myStays(member.id);
  const incoming = incomingRequests(stays);
  const mine = ownStays(stays);
  // Withheld until the host approves, which is enforced by the policy on
  // listing_addresses rather than here.
  const addresses = await addressesForStays(mine);
  const covers = await coverPhotosFor(mine.map((s) => s.listing_id));
  const awaiting = new Set((await staysAwaitingReview()).map((a) => a.stayId));

  // For each unlinked direct request, the homes its sender has open to swaps,
  // so the member can file the return leg without leaving the page.
  const swapRequesters = [
    ...new Set(
      incoming
        .filter((r) => r.mode === "direct" && !r.paired_request_id)
        .map((r) => r.counterparty?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const swapOptions = new Map(
    await Promise.all(
      swapRequesters.map(async (id) => [id, await swappableListings(id)] as const)
    )
  );

  return (
    <div>
      <PageTitle
        title="Requests"
        description="Stays you've asked for, and guests asking to stay with you."
      />

      {incoming.length > 0 && (
        <section className="mb-11">
          <h2 className="mb-4 text-lg font-semibold">Waiting for your reply</h2>
          <div className="space-y-3">
            {incoming.map((r) => {
              // An unlinked direct request cannot simply be approved: the trade
              // has no second half yet, so the host files it here first.
              const needsReturnLeg = r.mode === "direct" && !r.paired_request_id;

              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-brand/25 bg-brand-tint p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{r.counterparty?.name} wants to stay</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {r.listing?.title} · {day(r.starts_on)} to {day(r.ends_on)} ·{" "}
                        {r.nights} nights
                      </p>
                      <p className="mt-2 text-sm font-semibold text-brand">
                        {r.mode === "direct"
                          ? needsReturnLeg
                            ? `Direct swap · their stay is worth ${r.points_total} points`
                            : r.swap_points_delta < 0
                              ? `Direct swap · you pay ${-r.swap_points_delta} points`
                              : r.swap_points_delta > 0
                                ? `Direct swap · you receive ${r.swap_points_delta} points`
                                : "Direct swap · even trade"
                          : `You earn ${r.points_total} points`}
                      </p>
                    </div>
                    <StayActions
                      stayId={r.id}
                      acts={
                        needsReturnLeg
                          ? [{ act: "decline", label: "Decline", variant: "outline" }]
                          : [
                              { act: "approve", label: "Approve" },
                              { act: "decline", label: "Decline", variant: "outline" },
                            ]
                      }
                    />
                  </div>

                  {needsReturnLeg && (
                    <div className="mt-4">
                      <SwapPanel
                        incomingRequestId={r.id}
                        requesterName={r.counterparty?.name ?? "They"}
                        theirStayValue={r.points_total}
                        theirNights={r.nights}
                        listings={swapOptions.get(r.counterparty?.id ?? "") ?? []}
                        availablePoints={member.points.available}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">Your stays</h2>
        {mine.length === 0 ? (
          <div className="rounded-lg border bg-surface p-12 text-center">
            <h3 className="text-lg font-semibold">No stays yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-muted">
              Find a home in one of the pilot cities and ask to stay. The points are held until the
              host replies.
            </p>
            <Button asChild className="mt-6">
              <Link href="/trip">Plan a trip</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
            {mine.map((r) => {
              const meta = statusMeta[r.status];
              const photo = covers.get(r.listing_id) ?? listingPhotos(r.listing_id).cover;
              const address = addresses.get(r.id);

              return (
                <li key={r.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="size-20 shrink-0 overflow-hidden rounded-md">
                    <Photo src={photo} alt="" sizes="80px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.listing?.title ?? "Listing"}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {r.listing ? `${r.listing.area}, ${r.listing.city} · ` : ""}
                      {day(r.starts_on)} to {day(r.ends_on)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {r.role === "host" ? "Your home · " : ""}
                      {r.mode === "direct"
                        ? r.swap_points_delta > 0
                          ? `Direct swap · ${r.swap_points_delta} points to balance`
                          : "Direct swap · even trade"
                        : `${r.points_total} points`}
                      {r.points_held > 0 ? ` · ${r.points_held} held` : ""}
                    </p>
                    {address && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-brand">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>
                          {address.addressLine}
                          {address.pincode ? `, ${address.pincode}` : ""}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {actionsFor(r, awaiting.has(r.id))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
