import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth callback (SPEC §6.2).
 *
 * Flow:
 *  - User clicks "המשך עם Google" → signInWithGoogleAction redirects to Google.
 *  - User chooses an account / authorizes → Google redirects to Supabase's
 *    /auth/v1/callback with an authorization code.
 *  - Supabase redirects to this route with ?code=… on success, or
 *    ?error=…&error_description=… on cancel/failure.
 *
 * Success path: exchangeCodeForSession reads the PKCE verifier cookie set
 * by signInWithOAuth, exchanges the code for an access + refresh token,
 * and writes the new sb-* cookies via our SSR client's setAll callback.
 * Then redirect to /dashboard, where (app)/layout.tsx evaluates the user's
 * profile + subscription state.
 *
 * Failure paths all redirect to /login with a discriminated ?error= code.
 * LoginForm reads the param on mount and toasts the appropriate Hebrew
 * message per SPEC §6.2 edge cases:
 *   - oauth_cancelled    → "ההרשמה לא הושלמה"
 *   - oauth_failed       → "התרחשה שגיאה. נסה שוב או הירשם עם מייל"
 *   - oauth_no_code      → same as oauth_failed (defensive — shouldn't hit
 *                          this branch in normal Google + Supabase flow)
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_cancelled", requestUrl.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_no_code", requestUrl.origin)
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", requestUrl.origin)
    );
  }

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
