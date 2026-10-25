import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { AppNav } from "@/components/layout/app-nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getMember } from "@/lib/auth";

export async function AppHeader() {
  const member = await getMember();
  const name = member?.profile.full_name ?? "";
  const verified = member?.profile.kyc_status === "verified";

  return (
    <header className="sticky top-0 z-40 border-b bg-surface/95 backdrop-blur">
      <div className="container-x flex h-[66px] items-center justify-between gap-6">
        <Logo />
        <div className="hidden md:block">
          <AppNav />
        </div>
        {!member ? (
          // Search and listing pages are open to anyone, so the header has to
          // work before sign-in too.
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-md px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Join
            </Link>
          </div>
        ) : (
        <div className="flex items-center gap-2.5">
          <Link
            href="/wallet"
            className="rounded-md bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand"
          >
            {member?.points.available ?? 0} points
          </Link>
          <Link
            href="/profile"
            className="relative grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-white"
            aria-label="Your profile"
          >
            {name.charAt(0).toUpperCase() || "?"}
            {verified && (
              <BadgeCheck
                className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-surface text-brand"
                aria-label="ID verified"
              />
            )}
          </Link>
          <SignOutButton />
        </div>
        )}
      </div>
      <div className="container-x pb-2.5 md:hidden">
        <AppNav />
      </div>
    </header>
  );
}
