import { PageTitle } from "@/components/layout/page-title";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { DisputeActions } from "@/components/evidence/dispute-actions";
import { EvidencePairView } from "@/components/evidence/evidence-pair";
import { disputeStatusLabel, openDisputes } from "@/lib/db/disputes";
import { evidencePairs } from "@/lib/db/photos";

export default async function DisputesPage() {
  const disputes = await openDisputes();

  // Staff read evidence through the same bucket policy as the two parties,
  // which lets is_staff() through.
  const records = await Promise.all(
    disputes.map(async (d) => [d.id, await evidencePairs(d.stayId)] as const)
  );
  const byDispute = new Map(records);

  return (
    <div>
      <PageTitle
        title="Disputes"
        description="Compare the check-in and check-out photos, then decide how many held points to move."
      />

      {disputes.length === 0 ? (
        <p className="rounded-lg border bg-surface p-12 text-center text-muted">
          Nothing in the queue.
        </p>
      ) : (
        <div className="space-y-5">
          {disputes.map((d) => {
            const variant: BadgeVariant = d.status === "open" ? "star" : "brand";
            const pairs = byDispute.get(d.id) ?? [];

            return (
              <article key={d.id} className="rounded-lg border bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{d.stay}</h2>
                    <p className="mt-1 text-muted">
                      Raised by {d.raisedBy}: {d.issue}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {d.pointsHeld} points held on this stay
                    </p>
                  </div>
                  <Badge variant={variant}>{disputeStatusLabel(d.status)}</Badge>
                </div>

                {pairs.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-field p-5 text-sm text-muted">
                    No photo record on this stay. Decide on the messages and what both sides say.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pairs.map((pair) => (
                      <EvidencePairView key={`${pair.room}:${pair.item}`} pair={pair} />
                    ))}
                  </div>
                )}

                <DisputeActions disputeId={d.id} pointsHeld={d.pointsHeld} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
