import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { MemberActions } from "@/components/evidence/member-actions";
import { flaggedMembers } from "@/lib/db/admin";

export default async function ReviewPage() {
  const flagged = await flaggedMembers();

  return (
    <div>
      <PageTitle
        title="Needs a look"
        description="Members whose record stands out. Nothing here is automatic: these are reasons to read the stay, not verdicts."
      />

      {flagged.length === 0 ? (
        <p className="rounded-lg border bg-surface p-12 text-center text-muted">
          Nobody stands out right now.
        </p>
      ) : (
        <ul className="space-y-4">
          {flagged.map((m) => (
            <li key={m.id} className="rounded-lg border border-star/40 bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="size-4 text-star" aria-hidden />
                    {m.name}
                    {m.suspendedAt && <Badge variant="alert">Suspended</Badge>}
                  </h2>
                  <ul className="mt-2 space-y-1">
                    {m.flags.map((flag) => (
                      <li key={flag} className="text-sm">
                        {flag}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 text-sm text-muted">
                    {m.staysCompleted} completed{" "}
                    {m.staysCompleted === 1 ? "stay" : "stays"} ·{" "}
                    {m.upheldAgainst} upheld against · {m.claimsRejected} of their
                    claims rejected
                    {m.openAgainst > 0 ? ` · ${m.openAgainst} still open` : ""}
                  </p>
                </div>
                {m.trustScore ? (
                  <Rating value={m.trustScore} />
                ) : (
                  <span className="text-sm text-muted">New member</span>
                )}
              </div>

              <p className="mt-3.5 text-sm text-muted">
                Read the stays and the photo records before acting.{" "}
                <Link href="/admin/disputes" className="font-medium text-brand hover:underline">
                  Open disputes
                </Link>
              </p>

              <MemberActions
                userId={m.id}
                name={m.name}
                suspended={Boolean(m.suspendedAt)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
