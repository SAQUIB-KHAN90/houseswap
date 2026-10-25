import Link from "next/link";
import { CATEGORIES, categoryHref } from "@/lib/categories";

const CITIES = ["Delhi", "Chandigarh", "Jaipur"];

/**
 * The browse rail: cities first, then sizes.
 *
 * The size chips use the same categories the page groups by below, so a chip
 * and a section mean the same thing and clicking one lands on search already
 * filtered to it.
 */
const chips: { label: string; href: string }[] = [
  { label: "All stays", href: "/search" },
  ...CITIES.map((city) => ({ label: city, href: `/search?to=${city}` })),
  ...CATEGORIES.map((category) => ({
    label: category.label,
    href: categoryHref(category),
  })),
];

export function CityRail() {
  return (
    <nav aria-label="Browse stays" className="border-b bg-surface">
      <div className="container-x no-scrollbar flex gap-2 overflow-x-auto py-3.5">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="shrink-0 rounded-md border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-field hover:text-ink"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
