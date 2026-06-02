import type { Metadata } from "next";

import { privacyCopy } from "@/app/(marketing)/_components/legal-copy";
import { LegalPageShell } from "@/app/(marketing)/_components/legal-page-shell";

/**
 * /privacy — Slice 50 privacy-policy page.
 *
 * Public, INDEXABLE (no `noindex`) — search engines should see this. Renders
 * `privacyCopy` (verbatim port of `מדיניות פרטיות LawPass (1).docx`) inside
 * the shared `<LegalPageShell>`. The shell handles the top strip (LawPass
 * logo + "חזרה לדף הנחיתה" back link) and the prose typography; this page
 * file is just metadata + the page-level mount.
 */
export const metadata: Metadata = {
  title: privacyCopy.meta.title,
  description: privacyCopy.meta.description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: privacyCopy.meta.title,
    description: privacyCopy.meta.description,
  },
};

export default function PrivacyPage() {
  return <LegalPageShell copy={privacyCopy} />;
}
