import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { CookieBar } from "./_components/cookie-bar";
import { LandingFaq } from "./_components/landing-faq";
import { LandingFooter } from "./_components/landing-footer";
import { LandingHeader } from "./_components/landing-header";
import { LandingHero } from "./_components/landing-hero";
import { LandingMethod } from "./_components/landing-method";
import { LandingPlans } from "./_components/landing-plans";

/**
 * / — public landing page (Server Component).
 *
 * Slice 16 / Phase L3 — wires header + cookie bar + hero + method
 * + plans + faq + footer. The hero typewriter machine was pulled
 * forward into the L2-polish commit. Phase L4 lands the
 * "wire actions" pass (CTAs → /signup, /login, /checkout) and L5
 * adds metadata + sitemap + robots.
 *
 * Slice 16 / Phase L1 (still in effect) — authenticated visitors
 * are bounced to /dashboard. Anonymous visitors see this page.
 * The redirect lives here because the project has no
 * `middleware.ts`; auth gating across the app is per-route via
 * `requireActiveSubscription` / `requireAdmin` in lib/auth/*.
 *
 * NO database access, NO admin client. The single auth.getUser()
 * call uses the SSR client and reads from cookies — Hardening
 * Rule #2 compliant (never the service-role client on a public
 * page).
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <LandingHeader />
      <CookieBar />
      <main className="flex-1">
        <LandingHero />
        <LandingMethod />
        <LandingPlans />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}
