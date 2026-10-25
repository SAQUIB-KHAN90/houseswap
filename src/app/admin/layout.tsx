import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { AdminNav } from "@/components/layout/admin-nav";
import { requireMember } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  // Not a redirect: a member who is not staff should not learn that this exists.
  if (!member.profile.is_staff) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-surface">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo />
            <Badge variant="outline">Staff</Badge>
          </div>
          <Link href="/trip" className="text-sm font-medium text-muted hover:text-ink">
            Back to the app
          </Link>
        </div>
        <div className="container-x pb-2.5">
          <AdminNav />
        </div>
      </header>
      <main className="container-x py-9">{children}</main>
    </div>
  );
}
