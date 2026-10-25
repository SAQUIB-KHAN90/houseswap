import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";
import { AreaMap } from "@/components/map/area-map";
import { Button } from "@/components/ui/button";
import { searchListingRows, withHosts } from "@/lib/db/listings";
import { coverPhotosFor } from "@/lib/db/photos";
import { getMember } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import type { OfferingType } from "@/lib/points/rates";
import { cn } from "@/lib/utils";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * The filter chips: "Any", then one per category.
 *
 * The same sizes the landing page groups by, so a chip and a section mean the
 * same thing and a link from one lands on the other already filtered.
 */
const CHIPS = [
  { key: "any", label: "Any", type: "any", beds: undefined, open: false },
  ...CATEGORIES.map((c) => ({
    key: c.slug,
    label: c.label,
    type: c.offering as string,
    beds: c.bedrooms?.min,
    open: Boolean(c.bedrooms && c.bedrooms.max === undefined),
  })),
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [member, sp] = await Promise.all([getMember(), searchParams]);
  const to = sp.to ?? "";
  const type = (sp.type ?? "any") as OfferingType | "any";
  const beds = sp.beds ? Number(sp.beds) : undefined;
  const bedsOpenEnded = sp.bedsMax === "any";
  const dated = Boolean(sp.start && sp.end);

  // Which chip is lit: the one whose type and bedroom rule match the query.
  const activeChip =
    CHIPS.find(
      (c) =>
        c.type === type &&
        c.beds === (Number.isFinite(beds) ? beds : undefined) &&
        c.open === bedsOpenEnded
    )?.key ?? (type === "any" && !beds ? "any" : undefined);

  const rows = await searchListingRows({
    city: to || undefined,
    type,
    start: sp.start,
    end: sp.end,
    beds: Number.isFinite(beds) ? beds : undefined,
    bedsOpenEnded,
  });

  // Nobody can request their own home, so there is no reason to show it.
  // Filtered before fetching the extras, so nothing is fetched for a card
  // that will not be drawn.
  const mine = rows.filter((r) => r.host_id !== member?.id);

  // Host cards and cover photos together: neither needs the other.
  const [results, covers] = await Promise.all([
    withHosts(mine),
    coverPhotosFor(mine.map((r) => r.id)),
  ]);

  // Only the homes whose host placed a point. Hiding the map when nobody has
  // beats showing an empty one centred on nothing.
  const mapped = results
    .filter((l) => l.location)
    .map((l) => ({
      id: l.id,
      latitude: l.location!.latitude,
      longitude: l.location!.longitude,
      label: `${l.area}, ${l.city}`,
      href: `/listings/${l.id}`,
    }));

  /** Keeps the city and dates, swaps the category. */
  const href = (chip: (typeof CHIPS)[number]) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "type" && k !== "beds" && k !== "bedsMax") q.set(k, v);
    }
    if (chip.type !== "any") q.set("type", chip.type);
    if (chip.beds) q.set("beds", String(chip.beds));
    if (chip.open) q.set("bedsMax", "any");
    return `/search?${q}`;
  };

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {results.length} {results.length === 1 ? "home" : "homes"}
            {to ? ` in ${to}` : " in the pilot"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {dated
              ? `Free from ${dateLabel(sp.start!)} to ${dateLabel(sp.end!)}`
              : "Add dates to see what's free."}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/trip">
            <SlidersHorizontal aria-hidden />
            Change trip
          </Link>
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Size and stay type">
        {CHIPS.map((chip) => (
          <Link
            key={chip.key}
            href={href(chip)}
            aria-current={activeChip === chip.key ? "true" : undefined}
            className={cn(
              "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
              activeChip === chip.key
                ? "border-brand bg-brand-tint text-brand"
                : "border-field hover:bg-ink/[0.04]"
            )}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="rounded-lg border bg-surface p-12 text-center">
          <h2 className="text-lg font-semibold">No homes match yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-muted">
            {dated
              ? "Nothing is open on those dates. Try a different week, or another stay type."
              : "Try another stay type, or look at every home in the pilot cities."}
          </p>
          <Button asChild className="mt-6">
            <Link href="/search">See all stays</Link>
          </Button>
        </div>
      ) : (
        <>
          {mapped.length > 0 && (
            <section className="mb-9">
              <div className="h-[320px]">
                <AreaMap points={mapped} city={to || undefined} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {mapped.length} of {results.length}{" "}
                {results.length === 1 ? "home has" : "homes have"} said roughly where
                they are. Each circle is an area, not an address.
              </p>
            </section>
          )}

          <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((l) => (
              <ListingCard key={l.id} listing={l} coverUrl={covers.get(l.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
