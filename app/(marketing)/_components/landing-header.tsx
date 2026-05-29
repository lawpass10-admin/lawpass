import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketingSection } from "./marketing-section";

/**
 * Landing-page header.
 *
 * Slice 16 / Phase L2. Sticky navy-ink bar with three-column grid
 * (nav | logo | CTA). RTL by default; the parent `<html dir="rtl">`
 * already flips visual order so "nav" sits on the right, "CTA" on
 * the left of the viewport.
 *
 * The CTA stays a placeholder (`href="#"`) on purpose — Phase L5
 * (`Wire actions`) rewrites it to /login once the auth path is
 * confirmed. Same for the anchor nav links — they target on-page
 * sections that land in L3 (method) / L3 (plans) / L3 (faq).
 *
 * `<header>` is a pure Server Component — nothing here needs state.
 */
export function LandingHeader() {
  return (
    <MarketingSection
      as="header"
      className="sticky top-0 z-50 border-b border-white/10 bg-[var(--color-navy-ink)]"
      // Mobile (<768px): drop the nav cell entirely and run 2 columns
      // so the logo sits at the start and the gold CTA at the end.
      // md+ (≥768px): restore the 1fr|auto|1fr grid with nav visible.
      innerClassName="grid grid-cols-[auto_1fr] items-center gap-3 py-2.5 md:grid-cols-[1fr_auto_1fr] md:gap-6"
    >
      <nav
        aria-label="ראשי"
        // Hide nav under 768px per Sharon's mobile spec — logo + gold
        // CTA are the only chrome on phones; the in-page sections are
        // still reachable by scrolling once you land.
        className="hidden items-center gap-6 justify-self-start md:flex"
      >
        <Link
          href="#method"
          className="px-0.5 py-1.5 text-[15px] font-medium text-white/85 transition-colors hover:text-[var(--color-gold)]"
        >
          שיטת ה-360°
        </Link>
        <Link
          href="#plans"
          className="px-0.5 py-1.5 text-[15px] font-medium text-white/85 transition-colors hover:text-[var(--color-gold)]"
        >
          תוכניות מנוי
        </Link>
        <Link
          href="#faq"
          className="px-0.5 py-1.5 text-[15px] font-medium text-white/85 transition-colors hover:text-[var(--color-gold)]"
        >
          שאלות נפוצות
        </Link>
        <Link
          href="#contact"
          className="px-0.5 py-1.5 text-[15px] font-medium text-white/85 transition-colors hover:text-[var(--color-gold)]"
        >
          צרו קשר
        </Link>
      </nav>

      <Link href="/" aria-label="LawPass" className="justify-self-center">
        {/*
          Logo height: clamp(46px, 4.2vw, 70px) per prototype index.html L206.
          Asset lives at /public/landing/lawpass-logo-landing.png — name picked
          per Decision 7 so the live `lawpass-logo-tight.png` isn't clobbered.
          The image already has its own transparent crop; we render it at
          natural aspect (935×540 source → resized to 600 wide).
        */}
        <Image
          src="/landing/lawpass-logo-landing.png"
          alt="LawPass"
          width={195}
          height={113}
          priority
          className="block h-[clamp(46px,4.2vw,70px)] w-auto"
        />
      </Link>

      <Link
        // L4: header CTA goes to /login. The proxy at the repo root
        // bounces already-authed users away from /login → /dashboard,
        // so this single href works for both anonymous + returning
        // sessions without a separate "logout / go to app" pivot.
        href="/login"
        className={cn(
          buttonVariants({ variant: "gold", size: "lg" }),
          // Slightly tighter on mobile so the CTA + logo fit on a
          // 375px viewport. md+ uses the prototype padding.
          "justify-self-end px-3 py-2 text-[13px] font-semibold md:px-[22px] md:py-[11px] md:text-sm"
        )}
      >
        כניסה לאזור אישי
      </Link>
    </MarketingSection>
  );
}
