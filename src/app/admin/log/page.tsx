import { PageTitle } from "@/components/layout/page-title";
import { auditActionLabel, auditLog } from "@/lib/db/admin";

export default async function AuditLogPage() {
  const entries = await auditLog();

  return (
    <div>
      <PageTitle
        title="Audit log"
        description="Every staff action, with who did it and why. Written by the database, not by the app."
      />

      {entries.length === 0 ? (
        <p className="rounded-lg border bg-surface p-12 text-center text-muted">
          Nothing logged yet.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
          {entries.map((e) => (
            <li key={e.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {auditActionLabel(e.action)}
                  {e.targetName ? (
                    <span className="font-normal text-muted"> · {e.targetName}</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">
                  {e.actorName} · {e.at}
                </p>
              </div>
              {e.reason && <p className="mt-1 text-sm">{e.reason}</p>}
              {e.detail && Object.keys(e.detail).length > 0 && (
                <p className="mt-1 text-sm text-muted">
                  {Object.entries(e.detail)
                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
                    .join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
