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
  console.error("[oauth-route] begin");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  console.error("[oauth-route] signInWithOAuth returned", {
    hasUrl: !!data?.url,
    urlOrigin: data?.url ? new URL(data.url).origin : null,
    errorName: error?.name,
    errorMessage: error?.message,
  });

  if (error || !data?.url) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_failed", process.env.NEXT_PUBLIC_SITE_URL!)
    );
  }

  return NextResponse.redirect(data.url);
}
