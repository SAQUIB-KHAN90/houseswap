import { AppHeader } from "@/components/layout/app-header";
import { SuspendedBanner } from "@/components/layout/suspended-banner";
import { getMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Anonymous visitors reach the search and listing pages through here.
  const member = await getMember();

  return (
    <div className="min-h-screen">
      <AppHeader />
      {member?.profile.suspended_at && (
        <SuspendedBanner reason={member.profile.suspended_reason} />
      )}
      <main className="container-x py-9">{children}</main>
    </div>
  );
}
