import type { Metadata } from "next";
import Image from "next/image";

import { EarlyAccessForm } from "./_components/early-access-form";

/**
 * /early-access — Slice 43 waitlist email-capture page.
 *
 * Public, indexable-NO. The landing CTAs (hero primary + plan 3mo + plan 6mo,
 * to be wired in the landing rebuild slice) point at this URL with
 * `?source=hero|plan-3mo|plan-6mo`. Direct visits have no source.
 *
 * Slice 44 — added the celebratory graduation photo + new copy.
 * Slice 45 — orientation swap + feathered seam:
 *   - Desktop (md+): photo lives on the visual-RIGHT (reading start in RTL),
 *     navy panel on the visual-LEFT. Achieved by using a plain `md:flex-row`
 *     (NOT row-reverse): DOM-first photo lands at visual-right in RTL,
 *     DOM-second navy panel lands at visual-left.
 *   - Mobile (<md): photo stays as the top banner (~38vh) above the navy
 *     content block (unchanged stack from Slice 44).
 *   - Feathered seam: the photo's edge adjacent to the navy panel dissolves
 *     into the navy via a CSS `mask-image` linear-gradient. Desktop fades the
 *     photo's LEFT edge (the seam with the visual-left navy panel); mobile
 *     fades the photo's BOTTOM edge (the seam with the navy block below).
 *     Fade band ≈22% of the seam-axis dimension — wide enough to read as a
 *     dissolve, narrow enough to leave the centered subjects (the graduates'
 *     faces) fully opaque. The `-webkit-mask-image` prefix is duplicated so
 *     pre-15.4 Safari falls back to the same effect rather than a hard edge.
 *   - CONTRAST RULE preserved: all text lives on the solid navy panel; the
 *     photo and the navy panel are siblings and never overlap (the fade is
 *     the photo dissolving into navy, not text appearing over the photo).
 *
 * Server action / source attribution / form behavior / noindex metadata are
 * BYTE-FOR-BYTE UNCHANGED from Slice 43/44 — Slice 45 is layout + seam only.
 */
export const metadata: Metadata = {
  title: "LawPass — הצטרפו לרשימת ההמתנה",
  description: "אנחנו פותחים גישה בהדרגה. השאירו אימייל ונעדכן אתכם ראשונים.",
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

type SearchParams = Promise<{ source?: string | string[] }>;

function firstString(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function EarlyAccessPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolved = (await searchParams) ?? {};
  const source = firstString(resolved.source);

  return (
    /* Slice 51 — id="main-content" added so the a11y widget's universal
       skip-link target exists on /early-access too. The class +
       responsive layout are unchanged from Slice 45. */
    <main id="main-content" className="flex min-h-screen flex-col md:flex-row">
      {/* PHOTO — first in DOM. On mobile (flex-col) it sits at the top as a
          ~38vh banner. On md+ (`md:flex-row` in RTL), DOM-first lands at
          visual-RIGHT (reading start), which is where Slice 45 wants the
          photo. Mask-image dissolves the seam-side edge into the adjacent
          navy panel — bottom on mobile, left on desktop. */}
      <div
        className={[
          "relative h-[38vh] w-full overflow-hidden md:h-auto md:flex-1",
          // Mobile: fade the bottom edge into the navy block below.
          "[mask-image:linear-gradient(to_top,transparent_0%,#000_22%)]",
          "[-webkit-mask-image:linear-gradient(to_top,transparent_0%,#000_22%)]",
          // Desktop: fade the LEFT edge into the navy panel at the visual-left.
          "md:[mask-image:linear-gradient(to_right,transparent_0%,#000_22%)]",
          "md:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,#000_22%)]",
        ].join(" ")}
        aria-hidden
      >
        <Image
          src="/landing/early-access-hero-v2.png"
          alt=""
          fill
          priority
          /* Mobile = full viewport width (banner); desktop md+ = half the
             viewport width (column). */
          sizes="(min-width: 768px) 50vw, 100vw"
          /* `object-cover` keeps the celebratory faces framed even when the
             container's aspect ratio differs from the source 3:2. */
          className="object-cover"
        />
      </div>

      {/* NAVY CONTENT PANEL — logo, headline, sub, form. Vertically centered
          on desktop; padded comfortably on mobile. Solid navy background; all
          text lives here exclusively (no overlap with the photo). */}
      <div
        className="flex w-full flex-col items-center justify-center px-6 py-12 text-center md:flex-1 md:py-16"
        style={{ backgroundColor: "var(--color-navy-ink)" }}
      >
        <Image
          src="/landing/lawpass-logo-landing.png"
          alt="LawPass"
          width={195}
          height={113}
          priority
          className="block h-[clamp(64px,8vw,96px)] w-auto"
        />

        <h1
          className="font-heebo mt-10 text-3xl font-extrabold sm:text-4xl"
          style={{ color: "rgba(255,255,255,0.96)" }}
        >
          עוד קצת — ואנחנו באוויר.
        </h1>

        <p
          className="font-heebo mt-4 max-w-md text-base leading-relaxed sm:text-lg"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          מוזמנים בינתיים להצטרף לרשימת ההמתנה שלנו, ונעדכן אתכם ראשונים.
        </p>

        {/* Form max-width keeps the input + button row comfortable on mobile
            and on the half-viewport desktop column. */}
        <div className="mt-10 w-full max-w-md">
          <EarlyAccessForm source={source} />
        </div>
      </div>
    </main>
  );
}
