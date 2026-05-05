import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Auth-group routes an authenticated user should be bounced away from.
// /onboarding/complete-profile is excluded — an authed user with no profile
// row must be allowed to reach it.
const AUTH_BOUNCE_PATHS = new Set([
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
]);

// Routes that do not require auth. Anything else is treated as part of the
// (app) group and redirects to /login when no session is present.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/onboarding/complete-profile",
]);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (user && AUTH_BOUNCE_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user && !PUBLIC_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Excludes:
    //   _next/static, _next/image, favicon.ico — Next.js internals
    //   api/webhooks — server-to-server callbacks (signature-verified, no auth)
    //   auth/callback — Google OAuth redirect target. Must bypass middleware
    //     entirely: (a) the route handler runs exchangeCodeForSession, which
    //     reads the PKCE code_verifier cookie set during signInWithOAuth — if
    //     updateSession's "no user → wipe sb-* cookies" branch fires here, the
    //     verifier is wiped and the exchange fails; (b) we don't want the
    //     unauthed-user → /login redirect to swallow the OAuth code before
    //     the route handler can use it.
    //   image extensions — static assets
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
