import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { readLoginGate } from "@/lib/auth/login-lock";
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
  // The page the lockdown sends people to. Public by necessity: it is shown
  // to visitors with no session, and to users whose session is being refused.
  "/maintenance",
]);

/**
 * Paths that stay reachable while the app is locked to admins.
 *
 * ── /login IS ON THIS LIST, and leaving it off locked the admins out ──────
 * The gate can only tell an admin from anyone else once there IS a session.
 * A visitor who has not signed in yet is indistinguishable from a blocked
 * user — `allowed` is false for both — so with /login gated, an admin
 * arriving signed-out was redirected to /maintenance before the sign-in form
 * ever rendered. There was no way back in: the lock locked out the only
 * people who could unlock it.
 *
 * So the sign-in DOOR stays open and the gate judges what is behind it. A
 * blocked user can still reach the form and still sign in successfully —
 * they are bounced to /maintenance on the very next request, which is the
 * intended behaviour and costs nothing.
 *
 * /forgot-password and /reset-password are here for the same reason: an admin
 * who cannot remember their password during a lockdown must not be stranded.
 * Resetting it gives a non-admin a session and nothing else.
 *
 * /signup and /verify-email are deliberately NOT here. Registration is what
 * the lockdown is meant to stop, and an admin account already exists.
 *
 * The maintenance page itself, or the redirect below loops. The legal pages,
 * because a published privacy policy going 404 during a maintenance window is
 * its own problem. `/api/cron/*` is NOT here and does not need to be — the
 * matcher at the bottom of this file already excludes it.
 */
const LOCKDOWN_ALLOWED_PATHS = new Set([
  "/maintenance",
  // The marketing landing page. It lives in the (marketing) group, reads no
  // user data and shows nothing a signed-out visitor could not already see —
  // the same category as the legal pages below, and it should never have been
  // gated. Turning the bare domain into a maintenance notice also hid the
  // front door: typing lawpass.onrender.com, which is what everyone does,
  // bounced even an admin before any page rendered.
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/accessibility",
  "/terms",
]);

/**
 * Creating an account. Blocked for the whole lockdown, signed in or not.
 *
 * These are the one group where "cannot identify the caller" is not a reason
 * to let them through: an admin never needs to register, so there is nobody
 * here to misidentify, and leaving them open would mean anyone could still
 * open an account while the app is closed.
 */
const REGISTRATION_PATHS = new Set(["/signup", "/verify-email"]);

export async function proxy(
  request: NextRequest,
  event?: NextFetchEvent
): Promise<NextResponse> {
  const { supabase, user, response } = await updateSession(request);
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

  // THE LOCKDOWN, and it is checked here because this is the one place every
  // request passes. Gating the sign-in action instead would leave three other
  // doors open — Google OAuth, the Express API, and every session issued
  // before the lock went on. Here, how a session was obtained does not matter.
  //
  // Read from the database (app_settings.login_locked), so locking and
  // unlocking is one SQL UPDATE rather than a deploy. The reading is cached
  // for a few seconds while unlocked, so the normal path costs nothing; see
  // lib/auth/login-lock.ts.
  //
  // Ahead of the two redirects below so a locked-out user is never first
  // bounced to /login — which would tell them to sign in to an app that is
  // about to refuse them.
  if (!LOCKDOWN_ALLOWED_PATHS.has(pathname)) {
    // `user` comes from the getUser() call updateSession has already made, so
    // it is verified. Handing it over beats having the SQL function re-derive
    // it from the JWT — which is exactly what failed in production.
    const gate = await readLoginGate(supabase, user?.id ?? null);

    // TWO DIFFERENT RULES, because a missing session means two different
    // things depending on the path.
    //
    // Registration is blocked on the lock ALONE. No admin needs to sign up —
    // they already have an account — so there is no one to misidentify, and
    // an anonymous visitor must not be able to register during a lockdown.
    //
    // Everywhere else, only a user the middleware can POSITIVELY identify as
    // a non-admin is turned away. If it cannot resolve the session it says
    // nothing: the rule below sends a genuinely signed-out visitor to /login,
    // and the (app) layout — which has a verified user and the profile row —
    // judges anyone who does have one.
    //
    // That asymmetry is the lockout that cost three rounds. An admin whose
    // session the middleware failed to see looked exactly like an anonymous
    // visitor, so the gate read them as a non-admin and refused them. Now the
    // worst a missed session can do is ask someone to sign in again.
    const blockedHere = REGISTRATION_PATHS.has(pathname)
      ? gate.locked
      : Boolean(user) && !gate.allowed;

    if (blockedHere) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      url.search = "";
      // ALSO IN THE URL, not just the header below.
      //
      // "locked and not an admin" and "the middleware never saw your session"
      // produce the same redirect to the same page, and they need opposite
      // fixes. The header carries that, but reading it means opening DevTools;
      // the query string is visible in the address bar and survives a
      // screenshot, which is how this actually gets reported.
      //
      // Three digits, no ids, nothing secret: locked-session-admin.
      url.searchParams.set(
        "d",
        `${gate.locked ? 1 : 0}${user ? 1 : 0}${gate.isAdmin ? 1 : 0}`
      );
      const blocked = NextResponse.redirect(url);
      // WHY THE REDIRECT HAPPENED, on the redirect itself.
      //
      // This took two wrong diagnoses to find, because from outside the
      // response for "the app is locked and you are not an admin" and for
      // "the middleware could not see your session at all" are the same 307
      // to the same page. They need completely different fixes.
      //
      // Three booleans, no ids and no token — safe to read from a terminal
      // and enough to tell those two cases apart:
      //   session=0 → updateSession saw no user. A cookie problem, not a
      //               lock problem; the lock is working as designed.
      //   session=1 admin=0 → the session is fine and the admin lookup is
      //               what is failing.
      blocked.headers.set(
        "x-lockdown",
        `locked=${gate.locked ? 1 : 0};session=${user ? 1 : 0};admin=${gate.isAdmin ? 1 : 0}`
      );
      return blocked;
    }
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
