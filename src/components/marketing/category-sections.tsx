import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ListingCard } from "@/components/listings/listing-card";
import { groupByCategory, categoryHref } from "@/lib/categories";
import type { ListingView } from "@/lib/db/listings";

/**
 * Homes grouped the way people actually describe them: 1BHK, 2BHK, and so on.
 *
 * A single flat grid makes someone scan every card to find the one size they
 * can use. Most people arrive knowing roughly what they need — a couple wants
 * a 1BHK, a family of five does not — so the sizes are the first cut, and the
 * city filter sits above in the chip rail.
 *
 * Empty categories are dropped rather than shown empty. In a pilot with a
 * handful of homes per city, a heading over nothing reads as something broken.
 */
export function CategorySections({
  listings,
  covers,
  /** How many homes to show per category before linking to the rest. */
  perCategory = 4,
}: {
  listings: ListingView[];
  covers: Map<string, string>;
  perCategory?: number;
}) {
  const groups = groupByCategory(listings);
  if (groups.length === 0) return null;

  return (
    <div className="divide-y">
      {groups.map(({ category, listings: homes }) => (
        <section key={category.slug} className="container-x py-11">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                {category.label}
                <span className="ml-2 text-base font-medium text-muted">
                  {homes.length} {homes.length === 1 ? "home" : "homes"}
                </span>
              </h2>
              <p className="mt-1 text-muted">{category.blurb}</p>
            </div>
            {homes.length > perCategory && (
              <Link
                href={categoryHref(category)}
                className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline sm:inline-flex"
              >
                See all {homes.length}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>

          <div className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {homes.slice(0, perCategory).map((l) => (
              <ListingCard key={l.id} listing={l} coverUrl={covers.get(l.id)} />
            ))}
          </div>

          <Link
            href={categoryHref(category)}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline sm:hidden"
          >
            See all {category.label.toLowerCase()}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      ))}
    </div>
  );
}
