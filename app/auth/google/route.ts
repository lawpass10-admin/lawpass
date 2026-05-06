import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /auth/google
 *
 * Initiates Google OAuth via Supabase. Replaces the previous Server Action
 * approach (signInWithGoogleAction) which was non-deterministically failing
 * to deliver Set-Cookie for the PKCE verifier in production. Vercel logs
 * confirmed the cookie was written to the action's cookie store but did
 * not consistently reach the browser.
 *
 * Route Handler returns NextResponse.redirect with the verifier cookie
 * applied via the SSR client's setAll callback. Same-origin Set-Cookie
 * + Location header to Supabase = reliable.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      // prompt=select_account forces Google to show the account picker
      // even when the user is already signed in to a single Google
      // account. Without it, Google silently re-uses the only signed-in
      // account, which makes account-switching impossible from our UI.
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", process.env.NEXT_PUBLIC_SITE_URL!)
    );
  }

  return NextResponse.redirect(data.url);
}
