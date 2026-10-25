import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { AvailabilityEditor } from "@/components/listings/availability-editor";
import { ListingStatusButton } from "@/components/listings/listing-status-button";
import { listingPhotos } from "@/lib/images";
import { coverPhotosFor } from "@/lib/db/photos";
import { requireMember } from "@/lib/auth";
import { listingAvailability, myListings } from "@/lib/db/listings";
import { hostingTotals } from "@/lib/db/points";
import { offeringLabels } from "@/lib/points/rates";

const statusMeta = {
  active: { label: "Live", variant: "brand" as const },
  draft: { label: "Draft", variant: "star" as const },
  paused: { label: "Paused", variant: "default" as const },
};

export default async function HostPage() {
  const member = await requireMember();
  const [listings, hosting] = await Promise.all([myListings(member.id), hostingTotals()]);
  const covers = await coverPhotosFor(listings.map((l) => l.id));

  // Availability is edited per listing, so fetch it for each one up front.
  const windows = await Promise.all(
    listings.map(async (l) => [l.id, await listingAvailability(l.id)] as const)
  );
  const windowsById = new Map(windows);

  return (
    <div>
      <PageTitle title="My home" description="Your listing, availability and guests.">
        <Button asChild>
          <Link href="/listings/new">
            <Plus aria-hidden />
            Add a listing
          </Link>
        </Button>
      </PageTitle>

      {listings.length === 0 ? (
        <div className="rounded-lg border bg-surface p-12 text-center">
          <h2 className="text-lg font-semibold">You have no listing yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-muted">
            Hosting is optional: you can travel on points alone. But a first listing earns 25 points
            the moment it goes live, and hosting is how you keep earning.
          </p>
          <Button asChild className="mt-6">
            <Link href="/listings/new">List your home</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            {listings.map((listing) => {
              const coverWide = covers.get(listing.id) ?? listingPhotos(listing.id).coverWide;
              const meta = statusMeta[listing.status];

              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-lg border bg-surface shadow-card"
                >
                  <div className="aspect-[16/9]">
                    <Photo
                      src={coverWide}
                      alt={`${listing.title} in ${listing.area}`}
                      sizes="(max-width: 1024px) 100vw, 60vw"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <Badge>{offeringLabels[listing.type]}</Badge>
                    </div>
                    <h2 className="mt-2.5 text-lg font-semibold">{listing.title}</h2>
                    <p className="text-sm text-muted">
                      {listing.area}, {listing.city} · {listing.pointsPerNight} points night
                    </p>
                    <div className="mt-4 flex gap-2.5">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/listings/${listing.id}`}>View as a guest</Link>
                      </Button>
                      <ListingStatusButton id={listing.id} status={listing.status} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="space-y-4">
            {listings.map((listing) => (
              <section key={listing.id} className="rounded-lg border bg-surface p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="size-4 text-brand" aria-hidden />
                  Available dates
                </h2>
                {listings.length > 1 && (
                  <p className="mt-0.5 text-sm text-muted">{listing.title}</p>
                )}
                <AvailabilityEditor
                  listingId={listing.id}
                  windows={(windowsById.get(listing.id) ?? []).map((w) => ({
                    id: w.id,
                    start: w.starts_on,
                    end: w.ends_on,
                  }))}
                />
              </section>
            ))}

            <section className="rounded-lg border bg-brand-tint p-5">
              <h2 className="font-semibold">Earned from hosting</h2>
              <p className="mt-1 text-4xl font-extrabold tracking-tight text-brand">
                {hosting.points}
              </p>
              <p className="mt-1 text-sm text-muted">
                points across {hosting.stays} {hosting.stays === 1 ? "stay" : "stays"}
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
