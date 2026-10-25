import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Paths that need a signed-in member.
 *
 * Browsing is not on the list: search and listing pages read active listings,
 * which row-level security already makes public, and a visitor who likes what
 * they see is asked to sign in at the point of requesting a stay. `/listings/new`
 * is the exception, since publishing is not browsing.
 */
const PROTECTED = [
  "/trip",
  "/requests",
  "/wallet",
  "/host",
  "/profile",
  "/chat",
  "/stays",
  "/listings/new",
  "/verify",
  "/admin",
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // A signed-in member has no use for the sign-in pages.
  if (user && (path === "/login" || path === "/signup")) {
    return NextResponse.redirect(new URL("/trip", request.url));
  }

  return response;
}

export const config = {
  // Scheduled and webhook routes carry their own secret and have no session to
  // refresh, so they skip this entirely.
  matcher: [
    "/((?!api/cron|api/webhooks|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)",
  ],
};
