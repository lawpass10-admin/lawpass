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
 *
 * TODO(slice-7): the [oauth-callback] console.error logs below are
 * temporary diagnostic instrumentation added while debugging a production
 * OAuth failure. Once the underlying issue is identified and fixed,
 * downgrade to console.info or wrap in a debug-mode gate.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");

  console.error("[oauth-callback] start", {
    url: request.url,
    origin: requestUrl.origin,
    pathname: requestUrl.pathname,
    hasCode: code !== null,
    codeLength: code?.length ?? 0,
    hasError: oauthError !== null,
    errorParam: oauthError,
    errorDescription: oauthErrorDescription,
    // Reveal which cookies the request carries so we can verify the PKCE
    // code_verifier survived the round-trip from signInWithOAuth → Google →
    // Supabase → us. Cookie VALUES are sensitive; log only NAMES.
    cookieNames: request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean) ?? [],
  });

  if (oauthError) {
    console.error("[oauth-callback] redirect oauth_cancelled", {
      errorParam: oauthError,
      errorDescription: oauthErrorDescription,
    });
    return NextResponse.redirect(
      new URL("/login?error=oauth_cancelled", requestUrl.origin)
    );
  }

  if (!code) {
    console.error("[oauth-callback] redirect oauth_no_code", {
      reason: "no ?code= param on the callback URL",
    });
    return NextResponse.redirect(
      new URL("/login?error=oauth_no_code", requestUrl.origin)
    );
  }

  console.error("[oauth-callback] attempting exchangeCodeForSession", {
    codeLength: code.length,
  });

  const supabase = await createClient();
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[oauth-callback] exchangeCodeForSession FAILED", {
      name: exchangeError.name,
      message: exchangeError.message,
      status: (exchangeError as { status?: number }).status,
      code: (exchangeError as { code?: string }).code,
      stack: exchangeError.stack,
    });
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", requestUrl.origin)
    );
  }

  console.error("[oauth-callback] exchangeCodeForSession OK", {
    userId: data.user?.id,
    userEmail: data.user?.email,
    hasSession: data.session !== null,
    provider: data.user?.app_metadata?.provider,
    providers: data.user?.app_metadata?.providers,
  });

  return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
}
