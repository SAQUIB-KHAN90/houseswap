import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { MemberActions } from "@/components/evidence/member-actions";
import { riskFor, staffMembers } from "@/lib/db/admin";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const members = await staffMembers(sp.q);
  const risk = await riskFor(members.map((m) => m.id));

  return (
    <div>
      <PageTitle
        title="Members"
        description="Suspend an account, put one back, or correct a balance. Every action is logged."
      />

      <form className="mb-6 flex max-w-sm gap-2.5">
        <label htmlFor="q" className="sr-only">
          Search by name
        </label>
        <input
          id="q"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search by name"
          className="h-9 flex-1 rounded-sm border border-field bg-surface px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-md border border-field px-4 text-sm font-semibold"
        >
          Search
        </button>
      </form>

      {members.length === 0 ? (
        <p className="rounded-lg border bg-surface p-12 text-center text-muted">
          No members match.
        </p>
      ) : (
        <ul className="space-y-4">
          {members.map((m) => (
            <li key={m.id} className="rounded-lg border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold">
                    {m.name}
                    {m.isStaff && <Badge variant="outline">Staff</Badge>}
                    {m.suspendedAt && <Badge variant="alert">Suspended</Badge>}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {m.city ?? "No city"} · joined {m.joined} · {m.kycStatus}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {m.staysHosted} hosted · {m.staysTaken} taken ·{" "}
                    {m.disputesInvolved} disputes
                  </p>
                  {m.suspendedReason && (
                    <p className="mt-2 text-sm text-alert">Reason: {m.suspendedReason}</p>
                  )}
                </div>
                {m.trustScore ? (
                  <Rating value={m.trustScore} />
                ) : (
                  <span className="text-sm text-muted">New member</span>
                )}
              </div>

              {(risk.get(m.id)?.flags.length ?? 0) > 0 && (
                <ul className='mt-3 space-y-1 rounded-md bg-star/10 p-3'>
                  {risk.get(m.id)!.flags.map((flag) => (
                    <li key={flag} className='text-sm text-[#8a5a10]'>
                      {flag}
                    </li>
                  ))}
                </ul>
              )}

              {!m.isStaff && (
                <MemberActions
                  userId={m.id}
                  name={m.name}
                  suspended={Boolean(m.suspendedAt)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
