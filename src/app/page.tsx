import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSearch } from "@/components/marketing/hero-search";
import { CityRail } from "@/components/marketing/city-rail";
import { CategorySections } from "@/components/marketing/category-sections";
import { spreadAcrossCategories } from "@/lib/categories";
import { Photo } from "@/components/ui/photo";
import { Badge } from "@/components/ui/badge";
import { heroPhoto } from "@/lib/images";
import { searchListingRows, withHosts } from "@/lib/db/listings";
import { coverPhotosFor } from "@/lib/db/photos";
import {
  Comparison,
  Faq,
  FeaturedStays,
  FinalCta,
  HowItWorks,
  Reviews,
  TrustSection,
  WaysToOffer,
} from "@/components/marketing/sections";

export default async function HomePage() {
  // One round trip for the rows, then the host cards and the cover photos at
  // the same time rather than one after the other. Each call to the database
  // costs 250ms or more from India, so a waterfall here is visible.
  const rows = await searchListingRows({});
  const [featured, covers] = await Promise.all([
    withHosts(rows),
    coverPhotosFor(rows.map((r) => r.id)),
  ]);

  // One from each category before a second from any, so the top row shows the
  // range of the network rather than its eight cheapest rooms.
  const showcase = spreadAcrossCategories(featured, 8);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="container-x pt-6">
          <div className="relative overflow-hidden rounded-xl">
            <div className="aspect-[16/10] sm:aspect-[16/8] lg:aspect-[21/8]">
              <Photo src={heroPhoto} alt="" priority sizes="100vw" />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,22,19,0.78)_0%,rgba(14,22,19,0.45)_45%,rgba(14,22,19,0.1)_100%)]" />
            <div className="absolute inset-0 flex items-center">
              <div className="max-w-xl px-6 py-8 sm:px-10 lg:px-14">
                <Badge variant="glass">Pilot · Delhi, Chandigarh, Jaipur</Badge>
                <h1 className="mt-4 text-[34px] font-extrabold leading-[1.04] text-white sm:text-5xl lg:text-[56px]">
                  Your home is your ticket.
                </h1>
                <p className="mt-4 max-w-md leading-relaxed text-white/85 sm:text-lg">
                  Host a stay in your city, earn points, and spend them on a verified home
                  somewhere else.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 -mt-7 px-0 sm:-mt-9 sm:px-6 lg:px-12">
            <HeroSearch />
          </div>
        </section>

        <div className="mt-12">
          <CityRail />
        </div>

        <FeaturedStays listings={showcase} covers={covers} />
        <CategorySections listings={featured} covers={covers} />
        <HowItWorks />
        <WaysToOffer />
        <TrustSection />
        <Comparison />
        <Reviews />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
