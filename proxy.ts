import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { deviceOf, normalisePath, recordUsage } from "@/lib/usage/record";

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
//
// Slice 49 — added "/early-access". The waitlist page was introduced in
// Slice 43 (commit cfd90c9) but never added to this allowlist, so anonymous
// GETs were silently 307'd to /login (NextResponse.redirect's default
// status). The regression was invisible until Slice 46 wired the landing
// CTAs (hero / plan-3mo / plan-6mo) and the Slice-48 #try unlock CTAs to
// /early-access — at which point real unauthenticated traffic hit the route
// for the first time and got bounced. Authenticated test traffic during
// Slices 43-45 passed the `!user` check below and rendered fine, which is
// how the latent bug went unnoticed.
//
// The three legal pages are public: /privacy, /accessibility and /terms. A
// visitor reading the terms before deciding whether to register has no session
// yet, and the catch-all below would send them to /login — which is the one
// place a page like this must not lead.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/onboarding/complete-profile",
  "/early-access",
  "/privacy",
  "/accessibility",
  "/terms",
]);

export async function proxy(
  request: NextRequest,
  event?: NextFetchEvent
): Promise<NextResponse> {
  const { user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // COUNTED HERE BECAUSE THIS IS THE ONE PLACE EVERY REQUEST PASSES.
  //
  // `event.waitUntil` keeps the count off the response's critical path: the
  // redirect or the page goes out immediately and the POST finishes after. The
  // `event` argument is optional so the existing tests, which call proxy() with
  // a request alone, keep working — without it the count is simply skipped
  // rather than awaited, because a page must never wait on analytics.
  //
  // The matcher below already excludes _next/static, images and the other
  // asset extensions, so what reaches here is pages and route handlers — which
  // is exactly what "which endpoints are used" means.
  if (event) {
    event.waitUntil(
      recordUsage({
        surface: "web",
        device: deviceOf(request.headers.get("user-agent")),
        path: normalisePath(pathname),
      })
    );
  }

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
    //   auth/google — OAuth start route handler. Must bypass middleware for
    //     the same reason as auth/callback: signInWithOAuth writes the PKCE
    //     code_verifier cookie via the SSR client's setAll callback, and
    //     updateSession's "no user → wipe sb-* cookies" branch would clobber
    //     it before the redirect to Google leaves the server. The user is
    //     unauthenticated by definition when starting OAuth, so the
    //     /login redirect for unauthed users would also short-circuit the
    //     handler.
    //   auth/callback — Google OAuth redirect target. Must bypass middleware
    //     entirely: (a) the route handler runs exchangeCodeForSession, which
    //     reads the PKCE code_verifier cookie set during signInWithOAuth — if
    //     updateSession's "no user → wipe sb-* cookies" branch fires here, the
    //     verifier is wiped and the exchange fails; (b) we don't want the
    //     unauthed-user → /login redirect to swallow the OAuth code before
    //     the route handler can use it.
    //   static-asset extensions — images, video, audio, fonts
    //     Slice 16 (L3 QA): added `mp4|webm` so the Method-section
    //     videos in public/animations/landing/ aren't redirected to
    //     /login for anonymous visitors. Anything in public/ that
    //     doesn't carry a logged-in identity has to be on this list
    //     or the proxy treats it as a private (app) route.
    //     Slice 16 (L6): added `txt|xml` for /robots.txt and
    //     /sitemap.xml (both generated by Next App Router file
    //     conventions, both must be reachable by Googlebot
    //     anonymously).
    //   api/cron — Vercel Cron invocations. Same case as api/webhooks: a
    //     server-to-server call that carries no session cookie, authenticated
    //     by its own `Authorization: Bearer $CRON_SECRET` check inside the
    //     route. Without this exclusion the catch-all below treats a cron hit
    //     as an anonymous visitor and 307s it to /login, so the route never
    //     runs and the redirect looks like a success to the scheduler —
    //     exactly the silent failure described for /early-access above.
    //     Found 2026-10-04 while triggering the spend alarm by hand; it
    //     applies equally to /api/cron/reengagement, which has been shipping
    //     with this defect.
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|auth/callback|auth/google|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|txt|xml)$).*)",
  ],
};
