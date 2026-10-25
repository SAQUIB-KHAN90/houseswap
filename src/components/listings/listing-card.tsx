import Link from "next/link";
import { ArrowLeftRight, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Photo } from "@/components/ui/photo";
import { Rating } from "@/components/ui/rating";
import { listingPhotos } from "@/lib/images";
import { offeringLabels } from "@/lib/points/rates";
import type { ListingView } from "@/lib/db/listings";

export function ListingCard({
  listing,
  coverUrl,
}: {
  listing: ListingView;
  /** The host's own cover photo. Falls back to stock when they have none. */
  coverUrl?: string;
}) {
  const cover = coverUrl ?? listingPhotos(listing.id).cover;

  return (
    <article className="group relative">
      <div className="relative aspect-[20/17] overflow-hidden rounded-lg">
        <Photo
          src={cover}
          alt={`${listing.title} in ${listing.area}, ${listing.city}`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {listing.hostPresent && (
          <Badge variant="glass" className="absolute left-3 top-3">
            Host is home
          </Badge>
        )}
        <button
          type="button"
          aria-label={`Save ${listing.title}`}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full text-white/90 transition-colors hover:text-white"
        >
          <Heart className="size-5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-3 space-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug">
            {listing.area}, {listing.city}
          </h3>
          {listing.host.trust > 0 && <Rating value={listing.host.trust} className="mt-0.5 shrink-0" />}
        </div>
        <p className="text-sm text-muted">
          {offeringLabels[listing.type]} · up to {listing.guests} guests
        </p>
        {listing.acceptsDirectSwap && (
          <p className="flex items-center gap-1.5 pt-0.5 text-sm text-brand">
            <ArrowLeftRight className="size-3.5" aria-hidden />
            {listing.acceptsPoints ? "Points or direct swap" : "Direct swap only"}
          </p>
        )}
        <p className="pt-1 text-sm">
          <span className="font-semibold">{listing.pointsPerNight} points</span>
          <span className="text-muted"> night</span>
        </p>
      </div>

      <Link href={`/listings/${listing.id}`} className="absolute inset-0 rounded-lg">
        <span className="sr-only">View {listing.title}</span>
      </Link>
    </article>
  );
}
