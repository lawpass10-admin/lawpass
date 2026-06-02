import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CookieBar } from "@/app/(marketing)/_components/cookie-bar";
import { LandingFaq } from "@/app/(marketing)/_components/landing-faq";
import { LandingFooter } from "@/app/(marketing)/_components/landing-footer";
import { LandingHeader } from "@/app/(marketing)/_components/landing-header";
import { LandingHero } from "@/app/(marketing)/_components/landing-hero";
import { LandingMethod } from "@/app/(marketing)/_components/landing-method";
import { LandingPlans } from "@/app/(marketing)/_components/landing-plans";
import { LandingSourceNote } from "@/app/(marketing)/_components/landing-source-note";
import styles from "@/app/(marketing)/_components/landing.module.css";
import { createClient } from "@/lib/supabase/server";

/**
 * / — public landing page (Server Component).
 *
 * Slice 46 — replaces the <ComingSoon> placeholder with the new responsive
 * landing rebuilt from `_design/landing-hifi-new.html`. Anonymous visitors see
 * the full landing; authenticated visitors continue to bounce to /dashboard
 * (unchanged from Slice 16 / Phase L1; the project still has no
 * `middleware.ts`, so the redirect lives here).
 *
 * Section order (matches the design):
 *   1. <LandingHeader>     — sticky navy bar.
 *   2. <CookieBar>         — passive consent notice (reused as-is from Slice 16).
 *   3. <LandingHero>       — h1 + typewriter subline + CTAs + character figure.
 *   4. <LandingSourceNote> — the source-note-360 strip below the hero.
 *   5. <LandingMethod>     — navy section, 6 pillars (hover-video).
 *   6. <div id="try" />    — 0-height invisible anchor reserving the slot for
 *                            the Slice-2 interactive simulator. The simulator
 *                            itself is NOT mounted here; this just keeps any
 *                            inbound `#try` link from 404-feeling and prevents
 *                            a layout reflow when Slice 2 drops the section in.
 *   7. <LandingPlans>      — 3-card plans grid (3mo / 6mo / 6mo+AI disabled).
 *   8. <LandingFaq>        — character + accordion.
 *   9. <LandingFooter>     — footer.
 *
 * NOT mounted in this slice (separate slices):
 *   - The full #try interactive simulator (Slice 2).
 *   - The accessibility-options panel `#lpA11yWidget` (Slice 3).
 *
 * CSS isolation: the whole landing is wrapped in `<div className={styles.landingRoot}>`
 * so the design's `--navy`, `--gold`, `--paper`, ... tokens stay scoped to
 * this wrapper. The app's global `--color-navy-ink`, `--color-gold`, etc. in
 * `app/globals.css` are NOT touched — the marketing page reads ONLY from the
 * design tokens (different names, no collision).
 *
 * Indexable: `/` is the public marketing surface, so we override the prior
 * "בקרוב" placeholder's `noindex` metadata with the default indexable values.
 */
export const metadata: Metadata = {
  title: "LawPass — עוברים את מבחן הלשכה בפעם הראשונה",
  description:
    "פלטפורמה דיגיטלית להכנה למבחני ההסמכה של לשכת עורכי הדין. שיטת ה-360°: לכל שאלה ניתוח מלא של הנושא, המסיחים, מלכודות ופסיקה.",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className={styles.landingRoot}>
      <div className={styles.page}>
        <LandingHeader />
        <CookieBar />
        <main id="main-content" tabIndex={-1}>
          <LandingHero />
          <LandingSourceNote />
          <LandingMethod />
          {/* Slice 2 anchor — see file doc-comment. */}
          <div id="try" aria-hidden style={{ scrollMarginTop: "80px" }} />
          <LandingPlans />
          <LandingFaq />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
