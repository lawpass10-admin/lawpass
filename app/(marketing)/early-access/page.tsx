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
 * Slice 44 polish — new copy + celebratory graduation photo. Layout flips to a
 * responsive two-column split:
 *   - Desktop (md+): right-column (RTL visual-start) navy panel holding the
 *     logo + headline + sub + form, vertically centered. Left column = the
 *     photo, full-bleed object-cover, full viewport height. `flex-row-reverse`
 *     in RTL flips DOM-first (photo) to visual-LEFT and DOM-second (navy panel)
 *     to visual-RIGHT — gives us the reading-start navy panel without
 *     reordering the source.
 *   - Mobile (<md): stacks. Photo as a ~38vh top banner (framed on the
 *     celebratory faces via object-cover + center positioning), navy content
 *     block below it.
 *   - CONTRAST RULE: all text sits on the SOLID NAVY panel. No text overlaps
 *     the bright photo anywhere — no scrim needed because there is zero
 *     overlap.
 *
 * Server action / source attribution / form behavior / noindex metadata are
 * BYTE-FOR-BYTE UNCHANGED from Slice 43 — Slice 44 is layout + copy + image only.
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
    <main className="flex min-h-screen flex-col md:flex-row-reverse">
      {/* PHOTO — first in DOM so it lands at the top on mobile (flex-col).
          On md+, `flex-row-reverse` in RTL routes DOM-first to visual-LEFT,
          giving us the photo on the visual end (left in RTL) and the navy
          panel at the reading start (right in RTL). */}
      <div
        className="relative h-[38vh] w-full overflow-hidden md:h-auto md:flex-1"
        aria-hidden
      >
        <Image
          src="/landing/early-access-hero.png"
          alt=""
          fill
          priority
          /* Mobile = full viewport width (banner); desktop md+ = half the
             viewport width (column). */
          sizes="(min-width: 768px) 50vw, 100vw"
          /* `object-cover` keeps the celebratory faces framed even when the
             container's aspect ratio differs from the source 3:2. The 1024-row
             ground/feet area at the bottom crops gracefully on tall desktop
             columns. */
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
