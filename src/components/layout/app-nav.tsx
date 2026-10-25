"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/trip", label: "Plan a trip" },
  { href: "/search", label: "Stays" },
  { href: "/requests", label: "Requests" },
  { href: "/chat", label: "Messages" },
  { href: "/host", label: "My home" },
  { href: "/wallet", label: "Points" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="App" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((i) => {
          const active = pathname === i.href || pathname.startsWith(i.href + "/");
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-md px-3.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-brand-tint text-brand"
                    : "text-muted hover:bg-ink/[0.05] hover:text-ink"
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
