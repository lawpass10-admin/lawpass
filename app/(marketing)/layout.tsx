import type { Metadata } from "next";

/**
 * Public site URL used to anchor every absolute URL the metadata API
 * emits (Open Graph url, canonical, etc.). Falls back to localhost in
 * dev so `pnpm dev` doesn't try to resolve `undefined` URLs. Production
 * sets this in Vercel env vars to the canonical https origin.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Slice 16 / Phase L6 — landing-page metadata.
 *
 * Layout-level so that any future marketing subroute inherits the
 * template + Open Graph baseline. Per-page metadata (when added)
 * just sets a string `title` and the template above wraps it.
 *
 * Decision 6 — no og:image yet. The branded OG card is on the
 * design backlog and will land in a follow-up. Until then, Open
 * Graph and Twitter previews fall back to the URL + title +
 * description text-only card, which is acceptable for soft launch.
 *
 * The HTML lang/dir comes from app/layout.tsx (`<html lang="he"
 * dir="rtl">`) and is independent of the OG `locale` below — they
 * answer different questions (page language vs. content locale)
 * so there's no conflict.
 */
const TITLE = "LawPass — עוברים את מבחן הלשכה בפעם הראשונה";
const DESCRIPTION =
  "פלטפורמה דיגיטלית להכנה למבחני ההסמכה של לשכת עורכי הדין. שיטת ה-360°: לכל שאלה ניתוח מלא של הנושא, המסיחים, מלכודות ופסיקה.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    // Future marketing subroutes (e.g. /about) get "About · LawPass".
    template: "%s · LawPass",
  },
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LawPass",
    locale: "he_IL",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Safety net for the mobile pass: each section is anchored inside the
  // 1320px MarketingSection wrapper, but anything that bleeds past the
  // viewport (radial washes, the character figure with -6% inset,
  // future overhanging decorations) gets clipped here rather than
  // triggering horizontal scroll on phones.
  return <div className="overflow-x-hidden">{children}</div>;
}
