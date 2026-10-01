import type { Metadata } from "next";

import { CookieBar } from "@/app/(marketing)/_components/cookie-bar";
import { LandingFaq } from "@/app/(marketing)/_components/landing-faq";
import { LandingFooter } from "@/app/(marketing)/_components/landing-footer";
import { LandingHeader } from "@/app/(marketing)/_components/landing-header";
import { LandingHero } from "@/app/(marketing)/_components/landing-hero";
import { LandingMethod } from "@/app/(marketing)/_components/landing-method";
import { LandingSourceNote } from "@/app/(marketing)/_components/landing-source-note";
import { LandingTry } from "@/app/(marketing)/_components/landing-try";
import styles from "@/app/(marketing)/_components/landing.module.css";

/**
 * / — public landing page (Server Component).
 *
 * Slice 46 — replaces the <ComingSoon> placeholder with the new responsive
 * landing rebuilt from `_design/landing-hifi-new.html`.
 *
 * EVERY VISITOR SEES IT, signed in or not. It used to redirect an
 * authenticated visitor to /dashboard (Slice 16 / Phase L1), which meant the
 * front door of the product was closed to anyone holding a session: a brand-new
 * Google account that had just authenticated could not reach this page at all —
 * `/` sent it to /dashboard, which sent it on to /onboarding/complete-profile,
 * so the landing was unreachable from the moment you signed in.
 *
 * The header CTA reads "כניסה לאזור אישי" and points at /early-access,
 * where registration and login are offered side by side — those words are
 * clicked by returning members and by strangers alike, and that page is where
 * the two part ways.
 *
 * Section order (matches the design):
 *   1. <LandingHeader>     — sticky navy bar.
 *   2. <CookieBar>         — passive consent notice (reused as-is from Slice 16).
 *   3. <LandingHero>       — h1 + typewriter subline + CTAs + character figure.
 *   4. <LandingSourceNote> — the source-note-360 strip below the hero.
 *   5. <LandingMethod>     — navy section, 6 pillars (hover-video).
 *   6. <LandingTry>        — Slice 48: 3-question interactive simulator
 *                            (was a 0-height placeholder in Slice 46).
 *   (the 3-card plans grid used to sit here; the landing no longer quotes a
 *   price, so the component and its "#plans" nav and footer links came out
 *   together. <LandingPlans> itself is left in _components, unused, because
 *   the copy it carries is the only written record of the three tiers.)
 *   8. <LandingFaq>        — character + accordion.
 *   9. <LandingFooter>     — footer.
 *
 * NOT mounted in this slice (separate slices):
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
  title: "LawPass — מגיעים למבחן הלשכה בראש שקט",
  description:
    "פלטפורמה דיגיטלית להכנה למבחני ההסמכה של לשכת עורכי הדין. שיטת ה-360°: לכל שאלה ניתוח מלא של הנושא, המסיחים, מלכודות ופסיקה.",
};

export default async function Home() {
  return (
    <div className={styles.landingRoot}>
      <div className={styles.page}>
        <LandingHeader />
        <CookieBar />
        <main id="main-content" tabIndex={-1}>
          <LandingHero />
          <LandingSourceNote />
          <LandingMethod />
          <LandingTry />
          <LandingFaq />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
