import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

/** Routes reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/auth/sign-out",
  "/setup-required",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Refreshes the Supabase session and enforces the authenticated boundary.
 *
 * This is a convenience layer, not the security boundary: every page re-checks
 * the session server-side and the database enforces row level security
 * regardless of how a request arrives.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Without configuration there is no auth server to talk to; send people to a
  // page that explains the setup instead of failing with a blank screen.
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup-required") {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/setup-required";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const needsAuthCheck = !isPublicPath(pathname) || ["/login", "/forgot-password", "/reset-password"].includes(pathname);

  if (!needsAuthCheck) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
