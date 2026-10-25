import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export function SiteHeader({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-surface/95 backdrop-blur">
      <div className="container-x flex h-[70px] items-center gap-4">
        <Logo />

        {showSearch && (
          <Link
            href="/trip"
            className="mx-auto hidden items-center gap-0 rounded-xl border border-line py-1.5 pl-5 pr-1.5 text-sm shadow-card transition-shadow hover:shadow-lift lg:flex"
          >
            <span className="pr-4 font-semibold">Anywhere</span>
            <span className="border-l border-line px-4 text-muted">Any dates</span>
            <span className="border-l border-line px-4 text-muted">Any stay type</span>
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
              <Search className="size-4" aria-hidden />
            </span>
            <span className="sr-only">Plan a trip</span>
          </Link>
        )}

        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 lg:flex">
          <Link href="/#how" className="text-sm font-medium text-muted hover:text-ink">
            How it works
          </Link>
          <Link href="/#trust" className="text-sm font-medium text-muted hover:text-ink">
            Trust and safety
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Join the pilot</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
