import { ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { requireMember } from "@/lib/auth";
import { myLedger } from "@/lib/db/points";
import { cn } from "@/lib/utils";

export default async function WalletPage() {
  const member = await requireMember();
  const ledger = await myLedger();
  const { settled, held, available } = member.points;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Points" description="Earn them by hosting. Spend them on any stay." />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-surface p-6 shadow-card">
          <p className="text-sm text-muted">Available to spend</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight">{available}</p>
          <p className="mt-2 text-sm text-muted">
            {settled} earned, less {held} reserved
          </p>
        </div>
        <div className="rounded-lg border bg-surface p-6 shadow-card">
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Lock className="size-3.5" aria-hidden />
            Held for requests
          </p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight text-muted">{held}</p>
          <p className="mt-2 text-sm text-muted">
            Returned if a host declines or you cancel early.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">History</h2>
        {ledger.length === 0 ? (
          <p className="rounded-lg border bg-surface p-8 text-center text-muted">
            Nothing yet. Verifying your ID and publishing a first listing both earn points.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
            {ledger.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3.5">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      t.delta > 0 ? "bg-brand-tint text-brand" : "bg-ink/[0.06] text-muted"
                    )}
                  >
                    {t.delta > 0 ? (
                      <ArrowDownLeft className="size-4" aria-hidden />
                    ) : (
                      <ArrowUpRight className="size-4" aria-hidden />
                    )}
                  </span>
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-sm text-muted">{t.date}</p>
                  </div>
                </div>
                <p className={cn("font-semibold tabular-nums", t.delta > 0 && "text-brand")}>
                  {t.delta > 0 ? "+" : "−"}
                  {Math.abs(t.delta)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-lg border bg-surface p-6">
        <h2 className="text-lg font-semibold">How points are set</h2>
        <ul className="mt-3 space-y-2 text-muted">
          <li>Entire homes earn and cost the most per night.</li>
          <li>More bedrooms and amenities raise the rate.</li>
          <li>Points reach the host only after a clean check-out.</li>
        </ul>
      </section>
    </div>
  );
}
