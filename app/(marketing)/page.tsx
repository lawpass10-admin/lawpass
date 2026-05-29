import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ComingSoon } from "./_components/coming-soon";

/**
 * / — public landing page (Server Component).
 *
 * ⏸ TEMPORARY HOLD ⏸
 * The full landing (LandingHeader / Cookie / Hero / Method / Plans /
 * FAQ / Footer) is paused while a client reviews the design offline
 * (see LawPass-לעיון.html in the repo root). Anonymous visitors get
 * the minimal `<ComingSoon>` screen instead.
 *
 * To restore: `git revert <this-commit-sha>` then push to main.
 * Vercel rebuilds + redeploys in ~2-3 min. Every landing-* component
 * is still in app/(marketing)/_components/ and unchanged — the
 * revert just re-imports them here.
 *
 * Slice 16 / Phase L1 STILL APPLIES — authenticated visitors are
 * bounced to /dashboard. The auth redirect lives here because the
 * project has no `middleware.ts`; auth gating across the app is
 * per-route via `requireActiveSubscription` / `requireAdmin` in
 * lib/auth/*.
 *
 * NO database access, NO admin client. The single auth.getUser()
 * call uses the SSR client and reads from cookies — Hardening
 * Rule #2 compliant (never the service-role client on a public
 * page).
 */

// Page-level metadata overrides the marketing layout's (which still
// carries the production landing's title/description/OG). While we're
// behind the placeholder we don't want Google to snapshot the rich
// metadata against a barebones page, and we don't want the title bar
// to read "עוברים את מבחן הלשכה בפעם הראשונה" over a "בקרוב" body.
export const metadata: Metadata = {
  title: "LawPass — בקרוב",
  description: "האתר בהקמה. נשוב בקרוב.",
  robots: { index: false, follow: false },
  // Drop the OG/Twitter cards too — the layout's still applies if
  // we don't override, and a wrong preview on social would be worse
  // than no preview. Setting them to null prunes the layout values.
  openGraph: null,
  twitter: null,
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return <ComingSoon />;
}
