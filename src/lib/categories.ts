import type { OfferingType } from "@/lib/points/rates";

/**
 * How homes are grouped for browsing.
 *
 * BHK is how people actually describe a home in India — bedroom, hall,
 * kitchen — and it is what someone types into a search. It only means anything
 * for an entire home, though: "1BHK" describes a whole flat, and a private
 * room inside somebody's 3BHK is not a 1BHK. So the categories are the three
 * offering types, with entire homes split by bedroom count.
 *
 * 4BHK and larger are one bucket. Past three bedrooms the difference stops
 * mattering to someone choosing, and splitting further would leave categories
 * with one home in them.
 */
export type CategorySlug = "1bhk" | "2bhk" | "3bhk" | "4bhk-plus" | "room_kitchen" | "room";

export type Category = {
  slug: CategorySlug;
  label: string;
  /** Shown under the heading on the landing page. */
  blurb: string;
  offering: OfferingType;
  /** Bedroom range for entire homes, inclusive. Absent for the room types. */
  bedrooms?: { min: number; max?: number };
};

export const CATEGORIES: Category[] = [
  {
    slug: "1bhk",
    label: "1BHK",
    blurb: "A whole flat to yourself. Good for one or two people.",
    offering: "home",
    bedrooms: { min: 1, max: 1 },
  },
  {
    slug: "2bhk",
    label: "2BHK",
    blurb: "Room for a couple, a small family, or two who want their own space.",
    offering: "home",
    bedrooms: { min: 2, max: 2 },
  },
  {
    slug: "3bhk",
    label: "3BHK",
    blurb: "Space for a family or a group travelling together.",
    offering: "home",
    bedrooms: { min: 3, max: 3 },
  },
  {
    slug: "4bhk-plus",
    label: "4BHK and larger",
    blurb: "The biggest homes in the pilot.",
    offering: "home",
    bedrooms: { min: 4 },
  },
  {
    slug: "room_kitchen",
    label: "Room + kitchen",
    blurb: "A private room with kitchen access. The host may be home.",
    offering: "room_kitchen",
  },
  {
    slug: "room",
    label: "Private room",
    blurb: "A room of your own, with shared living space.",
    offering: "room",
  },
];

export const categoryBySlug = (slug: string): Category | undefined =>
  CATEGORIES.find((c) => c.slug === slug);

/** Which category a listing belongs to. Every listing lands in exactly one. */
export function categoryOf(listing: {
  type: OfferingType;
  bedrooms: number;
}): Category {
  const match = CATEGORIES.find(
    (c) =>
      c.offering === listing.type &&
      (!c.bedrooms ||
        (listing.bedrooms >= c.bedrooms.min &&
          (c.bedrooms.max === undefined || listing.bedrooms <= c.bedrooms.max)))
  );
  // A listing with an offering of 'home' always matches one of the BHK
  // buckets, since the last is open-ended; the fallback is for safety only.
  return match ?? CATEGORIES[CATEGORIES.length - 1];
}

/** The search query that shows one category. */
export function categoryHref(category: Category, city?: string): string {
  const query = new URLSearchParams({ type: category.offering });
  if (category.bedrooms) {
    query.set("beds", String(category.bedrooms.min));
    if (category.bedrooms.max === undefined) query.set("bedsMax", "any");
  }
  if (city) query.set("to", city);
  return `/search?${query}`;
}

/**
 * A varied handful, for a showcase row.
 *
 * Taking the first N of a price-sorted list gives the N cheapest, which here
 * means eight private rooms and no homes at all — the opposite of what a
 * landing page should say about the network. This deals round-robin through
 * the categories instead, so the row shows the range before it shows depth.
 */
export function spreadAcrossCategories<
  T extends { type: OfferingType; bedrooms: number },
>(listings: T[], count: number): T[] {
  const buckets = CATEGORIES.map((category) =>
    listings.filter((l) => categoryOf(l).slug === category.slug)
  );

  const picked: T[] = [];
  for (let round = 0; picked.length < count; round++) {
    const before = picked.length;
    for (const bucket of buckets) {
      if (picked.length >= count) break;
      if (bucket[round]) picked.push(bucket[round]);
    }
    // Every bucket is exhausted; there is nothing left to deal.
    if (picked.length === before) break;
  }
  return picked;
}

/** Groups listings into categories, dropping the ones nobody has listed in. */
export function groupByCategory<T extends { type: OfferingType; bedrooms: number }>(
  listings: T[]
): { category: Category; listings: T[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    listings: listings.filter((l) => categoryOf(l).slug === category.slug),
  })).filter((group) => group.listings.length > 0);
}
