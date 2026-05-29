import Image from "next/image";
import Link from "next/link";

import { MarketingSection } from "./marketing-section";

/**
 * Landing-page footer.
 *
 * Slice 16 / Phase L2. Distinct from the app-shell `SiteFooter`
 * (`components/shared/site-footer.tsx`) — that one renders a minimal
 * inline link row for authenticated screens. This landing-specific
 * footer is the navy-ink three-column block from the prototype with
 * a separator bar at the bottom.
 *
 * All non-mailto hrefs stay "#" for L2 — Decision 5 leaves /privacy
 * and /terms as TODOs until those pages exist. L5 wires the rest to
 * /login, /signup etc.
 */

type LinkRowProps = {
  heading: string;
  links: ReadonlyArray<{ label: string; href: string }>;
};

function FooterColumn({ heading, links }: LinkRowProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="mb-2 text-sm font-bold uppercase tracking-[0.06em] text-white">
        {heading}
      </div>
      {links.map((l) => (
        <Link
          key={`${heading}-${l.label}`}
          href={l.href}
          className="text-[15px] text-white/75 transition-colors hover:text-[var(--color-gold)]"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="bg-[var(--color-navy-ink)] text-white/[0.78]">
      <MarketingSection
        as="div"
        innerClassName="grid grid-cols-1 gap-x-15 gap-y-10 px-4 pt-12 pb-10 md:grid-cols-[1.2fr_2fr] md:px-8 md:pt-18 md:pb-12"
      >
        <div>
          <Image
            src="/landing/lawpass-logo-landing.png"
            alt="LawPass"
            width={195}
            height={113}
            className="mb-4 block h-[72px] w-auto"
            style={{ filter: "brightness(1.05)" }}
          />
          <p className="max-w-[320px] text-[15px] leading-[1.5] text-white/65">
            הדרך החכמה לפיצוח בחינת הלשכה.
          </p>
        </div>

        {/* 3-column links: stacks to 1-col on phones, splits to a
            2-col arrangement at small width, full 3-col at sm+. */}
        <div className="grid grid-cols-2 gap-6 gap-y-8 sm:grid-cols-3 sm:gap-8">
          <FooterColumn
            heading="המוצר"
            links={[
              { label: "שיטת ה-360°", href: "#method" },
              { label: "תוכניות מנוי", href: "#plans" },
              { label: "שאלות נפוצות", href: "#faq" },
            ]}
          />
          <FooterColumn
            heading="חשבון"
            links={[
              // L5: rewrite to /login, /signup, /terms, /privacy
              { label: "כניסה לאזור אישי", href: "#" },
              { label: "תמיכה", href: "#" },
              { label: "תקנון", href: "#" },
              { label: "מדיניות פרטיות", href: "#" },
            ]}
          />
          <FooterColumn
            heading="צרו קשר"
            links={[
              { label: "hello@lawpass.co.il", href: "mailto:hello@lawpass.co.il" },
              { label: "WhatsApp", href: "#" },
              { label: "טופס פנייה", href: "#" },
            ]}
          />
        </div>
      </MarketingSection>

      <div className="border-t border-white/10">
        <MarketingSection
          as="div"
          innerClassName="flex flex-col items-center gap-2 px-4 py-5 text-center text-[13px] text-white/55 md:flex-row md:flex-wrap md:justify-between md:gap-2.5 md:px-8 md:py-[22px] md:text-start"
        >
          <span>© 2026 LawPass. כל הזכויות שמורות.</span>
          <span>נבנה בקפידה עבור סטאז&apos;רים בישראל.</span>
        </MarketingSection>
      </div>
    </footer>
  );
}
