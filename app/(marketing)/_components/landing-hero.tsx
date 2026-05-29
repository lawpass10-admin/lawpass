import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  HERO_CTA_LABEL,
  HERO_HEADLINE_A,
  HERO_HEADLINE_B,
  HERO_TYPEWRITER_LINES,
  HERO_TYPEWRITER_SPEED_MS,
} from "./landing-copy";
import { Typewriter } from "./typewriter";

/**
 * Landing hero.
 *
 * Slice 16 / Phase L2. RTL grid with copy column on the right
 * (column 1 in RTL) and character figure on the left (column 2).
 * Behind the bottom of the figure sits the navy wave SVG, which
 * meets the navy-ink Method section below in L3.
 *
 * Headline stays static; the sub line cycles through four
 * sentences via the `<Typewriter>` client component (originally
 * scoped to Phase L4 but pulled forward in the L2-polish commit
 * since the hero is otherwise complete).
 *
 * NOTE on z-index stacking (prototype index.html L264–276):
 *   hero-figure  → z 1
 *   hero-wave    → z 2  (overlaps figure's bottom)
 *   hero-copy    → z 3  (always above the wave)
 *   .character-img margin-bottom: -60px → bleeds the figure into
 *                                          the wave so the wave
 *                                          "washes over" the feet.
 *
 * Decision 6 — no `<meta property="og:image">` here; that lands in L6.
 */
export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-white pt-6">
      {/* Subtle radial wash — prototype hero::before. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 540px at 85% 30%, rgba(30,58,138,0.04), transparent 65%), radial-gradient(700px 460px at 12% 75%, rgba(201,161,73,0.06), transparent 65%)",
        }}
      />

      <div
        className={cn(
          "relative mx-auto grid w-full max-w-[1320px] items-start gap-8 px-4 pt-6 pb-[200px]",
          // Mobile keeps the bottom padding shorter (200px) so the
          // wave isn't a giant blank navy band under a stacked
          // figure. md+ restores the prototype's 280px to give the
          // wave room to overlap the character's feet.
          "md:gap-10 md:px-8 md:pb-[280px]",
          // RTL grid: column 1 (right) holds copy, column 2 (left) holds figure.
          // 1.25fr / 0.75fr ratio matches prototype hero-grid (L258).
          "grid-cols-1 md:grid-cols-[1.25fr_0.75fr]"
        )}
        style={{ zIndex: 1 }}
      >
        {/* Copy column */}
        <div className="relative" style={{ zIndex: 3 }}>
          {/* Eyebrow ("שיטת ה-360° של ד״ר שרון נאור") was removed per
              Sharon, 2026-05-29 — the headline now opens the column. */}

          {/* Headline. Two lines — second line gets a gold dot.
              Clamp goes lower (32px) on narrow viewports so the headline
              never overflows; `whitespace-nowrap` keeps each line on
              one row at the chosen size. */}
          <h1 className="mb-[18px] text-[var(--color-navy-ink)] font-extrabold leading-[1.04] text-[clamp(32px,7vw,70px)]">
            <span className="block whitespace-nowrap">{HERO_HEADLINE_A}</span>
            <span className="relative block whitespace-nowrap">
              <span>{HERO_HEADLINE_B}</span>
              <span
                aria-hidden="true"
                className="ms-1 text-[var(--color-gold)]"
              >
                .
              </span>
            </span>
          </h1>

          {/* Sub line — Typewriter cycles through HERO_TYPEWRITER_LINES.
              The min-height matches the prototype's reserved 3.2em so the
              CTA row never shifts as lines of different lengths cycle.
              Mobile min size 17px keeps the subtitle readable without
              eating the whole viewport. */}
          <p
            className="mb-9 max-w-[620px] text-[var(--ink-3)] font-normal leading-[1.5] text-[clamp(17px,3.6vw,30px)]"
            style={{ minHeight: "3.2em" }}
          >
            <Typewriter
              lines={HERO_TYPEWRITER_LINES}
              speed={HERO_TYPEWRITER_SPEED_MS}
            />
          </p>

          <div className="mb-14 flex flex-wrap items-center gap-3.5">
            <Link
              // L4: hero CTA goes to /signup. The user picks a plan there
              // (signup form reads ?plan=… if present) or on /pricing
              // after they verify the OTP and land with no subscription.
              href="/signup"
              className={cn(
                buttonVariants({ variant: "gold", size: "lg" }),
                "px-7 py-3 text-base font-semibold"
              )}
            >
              {HERO_CTA_LABEL}
            </Link>
            <Link
              href="#method"
              className="text-[var(--color-navy-ink)] text-base font-medium hover:opacity-70 transition-opacity"
            >
              איך זה עובד ←
            </Link>
          </div>

          {/* Trust signals — 3 stat cards. */}
          <div className="grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-3">
            <TrustCard num="+1,200" label="שאלות מקור וזווית" />
            <TrustCard num="360°" label="ניתוח עומק לכל שאלה" />
            <TrustCard num="6 שבועות" label="מהרישום לבחינה" />
          </div>
        </div>

        {/* Figure column. Mobile cuts figure height in half so the
            stacked layout doesn't stretch to 1200px tall on phones. */}
        <div
          className="relative flex h-[400px] items-end justify-center md:h-[600px]"
          style={{ zIndex: 1 }}
        >
          <div
            aria-hidden="true"
            className="absolute"
            style={{
              insetInlineEnd: "-6%",
              bottom: -80,
              width: "90%",
              height: "80%",
              background:
                "radial-gradient(closest-side, rgba(201,161,73,0.13), rgba(201,161,73,0) 70%)",
              zIndex: 0,
            }}
          />
          <div
            className="relative flex h-full w-full max-w-[520px] items-end justify-center"
            style={{ zIndex: 1 }}
          >
            {/*
              Character image. Compressed from 2.4MB → ~365KB during
              L2 build (sips -Z 768, native PNG at half resolution).
              loading="eager" + explicit dimensions prevent CLS.

              margin-bottom: -60px deliberately bleeds the figure into
              the navy wave below so the wave overlaps the feet — see
              the stacking note at the top of this file.
            */}
            <Image
              src="/landing/hero-character.png"
              alt="ד״ר שרון נאור — שיטת ה-360° של LawPass"
              width={768}
              height={1152}
              priority
              className="block h-[calc(100%+60px)] w-full object-contain object-top"
              style={{
                marginBottom: -60,
                filter: "drop-shadow(0 30px 40px rgba(15,31,79,0.18))",
              }}
            />
          </div>
        </div>
      </div>

      {/* Navy wave — absolute bottom band, between figure (z1) and copy (z3).
          Mobile shrinks the wave height so it doesn't gulp the lower
          third of a 667px viewport; md+ restores the prototype's 320px. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[180px] md:h-[320px]"
        style={{ zIndex: 2 }}
      >
        <svg
          viewBox="0 0 1440 360"
          preserveAspectRatio="none"
          className="block h-full w-full"
        >
          <path
            d="M0,260 C220,40 540,-20 860,140 C1080,250 1260,300 1440,300 L1440,360 L0,360 Z"
            fill="#0F1F4F"
          />
        </svg>
      </div>
    </section>
  );
}

function TrustCard({ num, label }: { num: string; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white px-4 pb-4 pt-4.5 shadow-[var(--shadow-sm)]">
      <div className="mb-1.5 text-[clamp(26px,2.4vw,32px)] font-extrabold leading-none tracking-[-0.01em] text-[var(--color-navy-ink)]">
        {num}
      </div>
      <div className="text-sm leading-snug text-[var(--ink-3)]">{label}</div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--color-gold)]"
      />
    </div>
  );
}
