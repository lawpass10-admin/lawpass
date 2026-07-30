import { trySectionCopy } from "@/app/(marketing)/_components/landing-try-copy";

import { LandingTryClient } from "./landing-try-client";
import styles from "./landing.module.css";

/**
 * Slice 48 — `#try` interactive simulator (Server Component shell).
 *
 * Replaces the 0-height `<div id="try" />` placeholder from Slice 46 with the
 * full 3-question simulator ported from `_design/landing-hifi-new.html`
 * (markup lines 1529–1812, script lines 1813–1866).
 *
 * Split:
 *   - This file renders the static section chrome (eyebrow + h2) and mounts
 *     the all-state client island below it.
 *   - `<LandingTryClient>` (a single "use client" component) owns ALL the
 *     interactive bits: the qtab row (which card is visible), per-card
 *     answer / feedback state, the 360° toggle, and the 7-tab pane
 *     switcher inside each 360° panel.
 *
 * Why one big island, not 3 small ones: the qtab row's "is-active" state
 * lives at the section level (which card is showing), while per-card state
 * (answered / is360open / activeTab) is naturally card-scoped. Keeping it
 * all in a single client component avoids prop-drilling the card-index
 * callback through 3 child islands and keeps the design's data-pane
 * cross-card grouping faithful.
 *
 * Unlock-CTA destination (PM-locked §A): all 12 locked-pane CTAs route to
 * `/early-access?source=try-unlock`, NOT the design's `#plans`. Single href,
 * defined once on `trySectionCopy.unlockCta.href` in the copy module.
 */
export function LandingTry() {
  return (
    <section className={styles.tsSection} id="try">
      <div className={styles.container}>
        <div className={styles.sectionHead}>
          <div
            className={styles.eyebrow}
            style={{ color: "var(--gold-deep)" }}
          >
            <span aria-hidden className={styles.eyebrowBar} />
            <span>{trySectionCopy.eyebrow}</span>
          </div>
          <h2 className={styles.h2} style={{ color: "var(--navy-ink)" }}>
            {trySectionCopy.headlineLead}
            <span className={styles.gold}>{trySectionCopy.headlineGold}</span>
          </h2>
        </div>

        <LandingTryClient />
      </div>
    </section>
  );
}
