import Link from "next/link";
import { BadgeCheck, ScanFace } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rating } from "@/components/ui/rating";
import { requireMember } from "@/lib/auth";
import { myStays } from "@/lib/db/stays";
import { reviewsAbout } from "@/lib/db/reviews";
import { ReviewList } from "@/components/reviews/review-list";
import { NotifySettings } from "@/components/profile/notify-settings";

export default async function ProfilePage() {
  const member = await requireMember();
  const [stays, reviews] = await Promise.all([myStays(member.id), reviewsAbout(member.id)]);
  const { full_name: name, home_city: city, kyc_status, trust_score } = member.profile;

  const settled = stays.filter((s) => s.status === "settled");
  const hosted = settled.filter((s) => s.role === "host").length;
  const stayed = settled.filter((s) => s.role === "guest").length;
  const verified = kyc_status === "verified";

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Your profile" />

      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-ink text-2xl font-bold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
        <div>
          <p className="flex items-center gap-2 text-xl font-bold">
            {name}
            {verified && <BadgeCheck className="size-5 text-brand" aria-label="ID verified" />}
          </p>
          <p className="text-muted">{city ?? "City not set"}</p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-3 divide-x overflow-hidden rounded-lg border bg-surface">
        <div className="p-5">
          <dt className="text-sm text-muted">Trust score</dt>
          <dd className="mt-1">
            {trust_score ? (
              <Rating value={trust_score} count={reviews.length} className="text-xl" />
            ) : (
              // No score until somebody has actually stayed: inventing one for
              // a member with no history is the thing a trust score must not do.
              <span className="text-base font-semibold text-muted">New member</span>
            )}
          </dd>
        </div>
        <div className="p-5">
          <dt className="text-sm text-muted">Stays hosted</dt>
          <dd className="mt-1 text-2xl font-bold">{hosted}</dd>
        </div>
        <div className="p-5">
          <dt className="text-sm text-muted">Stays taken</dt>
          <dd className="mt-1 text-2xl font-bold">{stayed}</dd>
        </div>
      </dl>

      <section className="mt-5 flex items-start gap-3.5 rounded-lg border bg-surface p-5">
        <ScanFace className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <div className="flex-1">
          <h2 className="font-semibold">
            {verified ? "Identity verified" : "Identity not verified yet"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {verified
              ? "ID and selfie matched. Hosts and guests see this badge on your profile."
              : "You need to verify your ID before you can request a stay or go live with a listing."}
          </p>
          {!verified && (
            <Button asChild size="sm" className="mt-3.5">
              <Link href="/verify">Verify now</Link>
            </Button>
          )}
        </div>
        <Badge variant={verified ? "brand" : "star"}>{verified ? "Verified" : "Pending"}</Badge>
      </section>

      <section className="mt-9">
        <h2 className="mb-1.5 text-lg font-semibold">How we reach you</h2>
        <p className="mb-4 text-sm text-muted">
          Only about your own stays. We never message you about anybody else&apos;s.
        </p>
        <NotifySettings
          values={{
            notify_email: member.profile.notify_email,
            notify_whatsapp: member.profile.notify_whatsapp,
            notify_sms: member.profile.notify_sms,
          }}
          phone={member.profile.phone}
          phoneVerified={member.profile.phone_verified}
        />
      </section>

      <section className="mt-9">
        <h2 className="mb-4 text-lg font-semibold">
          Reviews{reviews.length > 0 ? ` (${reviews.length})` : ""}
        </h2>
        <ReviewList
          reviews={reviews}
          emptyMessage="No reviews yet. They unlock when a stay settles, and both sides write one."
        />
      </section>
    </div>
  );
}
