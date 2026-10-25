import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/photo";
import type { EvidencePair, EvidenceShot } from "@/lib/db/photos";

const stamp = (shot: EvidenceShot | null) => {
  if (!shot?.takenAt) return null;
  return new Date(shot.takenAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function Shot({ shot, caption }: { shot: EvidenceShot | null; caption: string }) {
  return (
    <figure>
      <div className="aspect-[4/3] overflow-hidden rounded-md border bg-[#eceae4]">
        {shot?.url ? (
          <Photo src={shot.url} alt={`${caption} photo`} sizes="(max-width: 640px) 50vw, 300px" />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center text-xs text-muted">
            No photo
          </div>
        )}
      </div>
      <figcaption className="mt-1.5 text-xs text-muted">
        {caption}
        {stamp(shot) ? ` · ${stamp(shot)}` : ""}
        {shot?.latitude != null && (
          <span className="ml-1" title="Geo-stamped where it was taken">
            · geo-stamped
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * One checklist item, at check-in and at check-out.
 *
 * Deliberately no verdict on whether anything changed. Nothing here compares
 * pixels, and a badge saying "no change" would be a claim the system cannot
 * support — the point is to put the two photos side by side and let a person
 * decide. `prd.md` 9 gives that decision to staff.
 */
export function EvidencePairView({ pair }: { pair: EvidencePair }) {
  const missing = !pair.checkin?.url || !pair.checkout?.url;

  return (
    <div className="rounded-lg border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{pair.item}</h3>
          <p className="text-sm text-muted">{pair.room}</p>
        </div>
        {missing && <Badge variant="star">Incomplete</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Shot shot={pair.checkin} caption="Check-in" />
        <Shot shot={pair.checkout} caption="Check-out" />
      </div>
    </div>
  );
}

/** The whole record for a stay, grouped by room. */
export function EvidenceRecord({ pairs }: { pairs: EvidencePair[] }) {
  if (pairs.length === 0) {
    return (
      <p className="rounded-lg border bg-surface p-8 text-center text-muted">
        No photo record yet. It is created at check-in.
      </p>
    );
  }

  const rooms = [...new Set(pairs.map((p) => p.room))];

  return (
    <div className="space-y-8">
      {rooms.map((room) => (
        <section key={room}>
          <h2 className="mb-3 text-lg font-semibold">{room}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pairs
              .filter((p) => p.room === room)
              .map((pair) => (
                <EvidencePairView key={`${pair.room}:${pair.item}`} pair={pair} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
