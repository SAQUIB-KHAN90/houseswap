import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  CalendarDays,
  MapPin,
  Check,
  KeyRound,
  Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { PhotoMosaic } from "@/components/listings/photo-mosaic";
import { AreaMap } from "@/components/map/area-map";
import { RequestPanel } from "@/components/listings/request-panel";
import { photosFor } from "@/lib/images";
import { listingPhotosFor } from "@/lib/db/photos";
import { reviewsAbout } from "@/lib/db/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { getListingView, listingAvailability, myListings } from "@/lib/db/listings";
import { getMember } from "@/lib/auth";
import { offeringLabels } from "@/lib/points/rates";

const dateWindow = (start: string, end: string) => {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
};

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const [member, { id }] = await Promise.all([getMember(), params]);
  const listing = await getListingView(id);
  if (!listing) notFound();

  const isOwn = Boolean(member) && listing.hostId === member!.id;
  const [windows, own] = await Promise.all([
    listingAvailability(listing.id),
    member && !isOwn ? myListings(member.id) : Promise.resolve([]),
  ]);

  // The home the member can put up in a direct swap: their first live listing.
  const ownHome = own.find((l) => l.status === "active") ?? null;

  const [uploaded, hostReviews] = await Promise.all([
    listingPhotosFor(listing.id),
    reviewsAbout(listing.hostId),
  ]);
  const { coverWide, gallery } = photosFor(listing.id, uploaded.map((p) => p.url));
  const alt = `${listing.title} in ${listing.area}, ${listing.city}`;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to stays
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
        >
          <Share2 className="size-4" aria-hidden />
          Share
        </button>
      </div>

      <h1 className="text-2xl font-bold sm:text-[32px]">{listing.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        {listing.host.trust > 0 && (
          <>
            <Rating value={listing.host.trust} />
            <span className="text-muted">·</span>
          </>
        )}
        <span className="text-muted">
          {listing.area}, {listing.city}
        </span>
        <span className="text-muted">·</span>
        <span className="font-medium">{offeringLabels[listing.type]}</span>
        {listing.hostPresent && <Badge variant="default">Host is home</Badge>}
        {listing.status !== "active" && <Badge variant="star">Not live</Badge>}
      </div>

      <div className="mt-5">
        <PhotoMosaic cover={coverWide} gallery={gallery} alt={alt} />
      </div>

      <div className="mt-9 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex items-center justify-between gap-4 border-b pb-6">
            <div>
              <h2 className="text-lg font-semibold">
                {offeringLabels[listing.type]}, hosted by {listing.host.name.split(" ")[0]}
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {listing.bedrooms} bedroom{listing.bedrooms > 1 ? "s" : ""} · up to{" "}
                {listing.guests} guests
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-lg font-bold text-white">
              {listing.host.name.charAt(0).toUpperCase()}
            </span>
          </div>

          {listing.blurb && <p className="border-b py-6 leading-relaxed">{listing.blurb}</p>}

          {listing.amenities.length > 0 && (
            <section className="border-b py-6">
              <h2 className="text-lg font-semibold">What&apos;s included</h2>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {listing.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2.5 text-[15px]">
                    <Check className="size-4 shrink-0 text-brand" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {listing.rules.length > 0 && (
            <section className="border-b py-6">
              <h2 className="text-lg font-semibold">House rules</h2>
              <p className="mt-1 text-sm text-muted">
                You&apos;ll accept these before the stay is confirmed.
              </p>
              <ul className="mt-4 space-y-2.5">
                {listing.rules.map((r) => (
                  <li key={r} className="text-[15px]">
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border-b py-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="size-5 text-brand" aria-hidden />
              When it&apos;s free
            </h2>
            {windows.length === 0 ? (
              <p className="mt-2 text-muted">
                The host has not opened any dates yet.
              </p>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2">
                {windows.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-md border border-field px-3.5 py-2 text-sm font-medium"
                  >
                    {dateWindow(w.starts_on, w.ends_on)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {listing.location && (
            <section className="border-b py-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MapPin className="size-5 text-brand" aria-hidden />
                Where you&apos;ll be
              </h2>
              <p className="mt-1 text-sm text-muted">
                {listing.area}, {listing.city}. The circle is approximate — you get the
                exact address once {listing.host.name.split(" ")[0]} approves your stay.
              </p>
              <div className="mt-4 h-[300px]">
                <AreaMap
                  points={[
                    {
                      id: listing.id,
                      latitude: listing.location.latitude,
                      longitude: listing.location.longitude,
                      label: `${listing.area}, ${listing.city}`,
                    },
                  ]}
                  city={listing.city}
                />
              </div>
            </section>
          )}

          <section className="border-b py-6">
            <h2 className="text-lg font-semibold">How you can book it</h2>
            <ul className="mt-4 space-y-2.5">
              {listing.acceptsPoints && (
                <li className="flex items-center gap-2.5 text-[15px]">
                  <KeyRound className="size-4 shrink-0 text-brand" aria-hidden />
                  Points, at {listing.pointsPerNight} a night
                </li>
              )}
              {listing.acceptsDirectSwap && (
                <li className="flex items-center gap-2.5 text-[15px]">
                  <ArrowLeftRight className="size-4 shrink-0 text-brand" aria-hidden />
                  Direct swap, with the difference in value settled in points
                </li>
              )}
            </ul>
          </section>

          {listing.host.verified && (
            <section className="py-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <BadgeCheck className="size-5 text-brand" aria-hidden />
                Verified host
              </h2>
              <p className="mt-1.5 max-w-lg leading-relaxed text-muted">
                {listing.host.name}
                {listing.host.joined ? ` joined in ${listing.host.joined}.` : "."} ID and selfie
                confirmed by a licensed provider.
              </p>
            </section>
          )}

          <section className="border-t py-6">
            <h2 className="text-lg font-semibold">
              What guests say about {listing.host.name.split(" ")[0]}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Written after a stay settles, by people who actually stayed.
            </p>
            <div className="mt-4">
              <ReviewList
                reviews={hostReviews}
                emptyMessage={`${listing.host.name.split(" ")[0]} has no reviews yet.`}
              />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {!member ? (
            <div className="rounded-lg border bg-surface p-6 shadow-card">
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold">{listing.pointsPerNight} points</span>
                <span className="text-muted">night</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Join to request this stay. Verified members get 100 starter points, enough for a
                short first trip, and you can travel on points without hosting.
              </p>
              <Button asChild size="lg" className="mt-5 w-full">
                <Link href="/signup">Create an account</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="mt-2.5 w-full">
                <Link href={`/login?next=/listings/${listing.id}`}>Sign in</Link>
              </Button>
            </div>
          ) : isOwn ? (
            <div className="rounded-lg border bg-surface p-6 shadow-card">
              <p className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold">{listing.pointsPerNight} points</span>
                <span className="text-muted">night</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                This is your own home, so there is nothing to request. Guests see the panel here.
              </p>
              <Button asChild className="mt-5 w-full">
                <Link href="/host">Manage it</Link>
              </Button>
            </div>
          ) : (
            <RequestPanel
              listingId={listing.id}
              pointsPerNight={listing.pointsPerNight}
              hostName={listing.host.name}
              acceptsPoints={listing.acceptsPoints}
              acceptsDirectSwap={listing.acceptsDirectSwap}
              depositInr={listing.depositInr}
              availablePoints={member!.points.available}
              ownHome={
                ownHome
                  ? {
                      id: ownHome.id,
                      title: ownHome.title,
                      area: ownHome.area,
                      pointsPerNight: ownHome.pointsPerNight,
                    }
                  : null
              }
            />
          )}
        </aside>
      </div>
    </div>
  );
}
