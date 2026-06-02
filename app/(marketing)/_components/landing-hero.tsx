import Image from "next/image";
import Link from "next/link";

import { heroCopy } from "@/app/(marketing)/_components/landing-copy";

import { HeroTypewriter } from "./hero-typewriter";
import styles from "./landing.module.css";

/**
 * Slice 46 — landing hero.
 *
 * Two-column grid (md+): hero copy + CTAs on visual-start, character figure on
 * visual-end. Mobile stacks. Typewriter swap happens in the small
 * `<HeroTypewriter>` client island. Decorative SVG wave clipped against the
 * navy method section below.
 */
export function LandingHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroHeadline}>
            <span>{heroCopy.headlineTop}</span>
            <span style={{ color: "var(--gold-deep)" }}>
              {heroCopy.headlineBottom}
              <span aria-hidden className={styles.h1Dot}>
                .
              </span>
            </span>
          </h1>

          <p aria-live="polite" className={styles.heroSub}>
            <HeroTypewriter lines={heroCopy.typewriterLines} />
          </p>

          <div className={styles.ctaRow}>
            <Link className={styles.btnGold} href={heroCopy.primaryCtaHref}>
              {heroCopy.primaryCtaLabel}
            </Link>
            <a
              className={styles.btnGhost}
              aria-label={heroCopy.secondaryCtaAriaLabel}
              href={heroCopy.secondaryCtaHref}
            >
              {heroCopy.secondaryCtaLabel}
            </a>
          </div>
        </div>

        <div className={styles.heroFigure}>
          <div aria-hidden className={styles.heroFigureBg} />
          <div className={styles.characterSlot}>
            <Image
              alt={heroCopy.characterAlt}
              className={styles.characterImg}
              src="/landing/hero-character.png"
              width={1040}
              height={1200}
              priority
            />
          </div>
        </div>
      </div>

      <div aria-hidden className={styles.heroWave}>
        <svg preserveAspectRatio="none" viewBox="0 0 1440 360">
          <path
            d="M0,260 C220,40 540,-20 860,140 C1080,250 1260,300 1440,300 L1440,360 L0,360 Z"
            fill="#0F1F4F"
          />
        </svg>
      </div>
    </section>
  );
}
