"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ItemCapture, type CapturedItem } from "@/components/evidence/item-capture";
import { recordChecklist } from "@/lib/actions/checklists";
import { raiseDispute } from "@/lib/actions/stays";
import { uploadEvidencePhoto } from "@/lib/photos/upload";
import { geoStamp, type GeoStamp } from "@/lib/photos/capture";
import { checklistRooms } from "@/config/checklist";

export function ChecklistFlow({
  stayId,
  mode,
  alreadySigned,
}: {
  stayId: string;
  mode: "checkin" | "checkout";
  /** True when this phase was already recorded, so the record is shown instead. */
  alreadySigned: boolean;
}) {
  const [captured, setCaptured] = useState<Record<string, CapturedItem>>({});
  const [signed, setSigned] = useState(alreadySigned);
  const [issue, setIssue] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // Asked for once, when the flow opens, so the permission prompt does not
  // appear in the middle of taking the first photo. Null is fine: a stamp is
  // corroboration, not a gate.
  const geo = useRef<GeoStamp>(null);
  const [geoReady, setGeoReady] = useState(false);

  useEffect(() => {
    if (signed) return;
    let live = true;
    geoStamp().then((stamp) => {
      if (!live) return;
      geo.current = stamp;
      setGeoReady(true);
    });
    return () => {
      live = false;
    };
  }, [signed]);

  const allItems = checklistRooms.flatMap((r) => r.items.map((i) => `${r.id}:${i}`));
  const count = allItems.filter((k) => captured[k]).length;
  const complete = count === allItems.length;
  const label = mode === "checkin" ? "Check-in" : "Check-out";

  /**
   * Uploads as each photo is taken, rather than all of them on submit. On a
   * weak connection one failure then costs one photo, not the whole checklist.
   */
  async function capture(key: string, file: File) {
    const uploaded = await uploadEvidencePhoto(stayId, mode, file, geo.current);
    setCaptured((current) => ({
      ...current,
      [key]: { ...uploaded, preview: URL.createObjectURL(file) },
    }));
  }

  function submit() {
    setError(null);
    start(async () => {
      const items = checklistRooms.flatMap((room) =>
        room.items.map((item) => {
          const shot = captured[`${room.id}:${item}`];
          return {
            room: room.name,
            item,
            storagePath: shot?.storagePath ?? null,
            sha256: shot?.sha256 ?? null,
            takenAt: shot?.takenAt ?? null,
            latitude: shot?.latitude ?? null,
            longitude: shot?.longitude ?? null,
          };
        })
      );

      const result = await recordChecklist(stayId, mode, items);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSigned(true);
      router.refresh();
    });
  }

  function report() {
    setError(null);
    start(async () => {
      const result = await raiseDispute(stayId, issue);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReported(true);
      router.refresh();
    });
  }

  if (signed) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-lg border bg-surface p-8 text-center shadow-card">
          <CheckCircle2 className="mx-auto size-10 text-brand" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold">{label} recorded</h1>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {mode === "checkin"
              ? "Both of you now have the same photo record. Enjoy the stay."
              : "Here's how the home compares with check-in. If you spot a problem, report it within 24 hours."}
          </p>
        </div>

        {mode === "checkout" && (
          <div className="mt-8 rounded-lg border bg-surface p-5">
            <h2 className="font-semibold">Compare the two records</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Every item you photographed today, side by side with the same item at
              check-in.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/stays/${stayId}/record`}>Open the photo record</Link>
            </Button>
          </div>
        )}

        {reported ? (
          <p className="mt-8 rounded-lg border border-brand/25 bg-brand-tint p-5 text-sm leading-relaxed text-brand">
            Your claim is with staff. The points stay held until they decide, and settlement is
            paused while it is open.
          </p>
        ) : (
          <div className="mt-8">
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant={mode === "checkout" ? "outline" : "default"}>
                <Link href="/requests">Back to requests</Link>
              </Button>
              {mode === "checkout" && (
                <Button size="lg" variant="outline" onClick={() => setReporting((r) => !r)}>
                  Report an issue
                </Button>
              )}
            </div>

            {mode === "checkout" && !reporting && (
              <p className="mt-3 text-sm text-muted">
                With no issue reported, the points reach the host 24 hours after check-out.
              </p>
            )}

            {reporting && (
              <div className="mt-4 space-y-2.5 rounded-lg border bg-surface p-5">
                <label htmlFor="issue" className="font-semibold">
                  What went wrong?
                </label>
                <p className="text-sm text-muted">
                  Be specific about the room and the damage. Staff compare this against both photo
                  records.
                </p>
                <Textarea
                  id="issue"
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Scratch on the dining table, not in the check-in photos"
                />
                <Button disabled={pending || !issue.trim()} onClick={report}>
                  {pending ? "Sending…" : "Raise a claim"}
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold sm:text-[32px]">{label} checklist</h1>
      <p className="mt-2 leading-relaxed text-muted">
        Take one photo of each item. Each is timestamped and hashed as it uploads, so
        the record cannot be quietly changed later.
      </p>
      <p className="mt-3.5 flex items-center gap-2 text-sm text-muted">
        <MapPin className="size-4" aria-hidden />
        {!geoReady
          ? "Checking your location…"
          : geo.current
            ? "Location on. Your photos carry a geo-stamp."
            : "No location available. Photos are still timestamped and hashed."}
      </p>

      <div className="sticky top-[72px] z-20 mt-7 rounded-md bg-page/95 py-3 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {count} of {allItems.length} photos
          </span>
          <span className="text-muted">{Math.round((count / allItems.length) * 100)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={allItems.length}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]"
        >
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(count / allItems.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-6 space-y-7">
        {checklistRooms.map((room) => (
          <section key={room.id}>
            <h2 className="mb-2.5 text-lg font-semibold">{room.name}</h2>
            <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
              {room.items.map((item) => {
                const key = `${room.id}:${item}`;
                return (
                  <ItemCapture
                    key={key}
                    label={item}
                    captured={captured[key]}
                    disabled={pending}
                    onCapture={(file) => capture(key, file)}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-9 rounded-lg border bg-surface p-5">
        <p className="text-sm leading-relaxed text-muted">
          By confirming, you agree this record shows the home as it is right now. The{" "}
          {mode === "checkin" ? "host" : "other person"} confirms too.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-alert">
            {error}
          </p>
        )}
        <Button size="lg" className="mt-4 w-full" disabled={!complete || pending} onClick={submit}>
          {pending ? "Recording…" : `Confirm ${label.toLowerCase()}`}
        </Button>
        {!complete && (
          <p className="mt-2.5 text-center text-xs text-muted">
            Take all {allItems.length} photos to continue.
          </p>
        )}
      </div>
    </div>
  );
}
