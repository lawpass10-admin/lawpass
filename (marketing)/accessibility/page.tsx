import type { Metadata } from "next";

import { accessibilityCopy } from "@/app/(marketing)/_components/legal-copy";
import { LegalPageShell } from "@/app/(marketing)/_components/legal-page-shell";

/**
 * /accessibility — Slice 50 accessibility-declaration page (הצהרת נגישות).
 *
 * Public, INDEXABLE (no `noindex`) — Israeli accessibility regs effectively
 * require this page to be reachable + crawlable. Renders `accessibilityCopy`
 * (verbatim port of `הצהרת נגישות ה LawPass (1).docx`) inside the shared
 * `<LegalPageShell>`. The shell handles the top strip (LawPass logo + back
 * link to "/") and the prose typography; this page file is just metadata +
 * the page-level mount.
 */
export const metadata: Metadata = {
  title: accessibilityCopy.meta.title,
  description: accessibilityCopy.meta.description,
  alternates: { canonical: "/accessibility" },
  openGraph: {
    type: "website",
    url: "/accessibility",
    title: accessibilityCopy.meta.title,
    description: accessibilityCopy.meta.description,
  },
};

export default function AccessibilityPage() {
  return <LegalPageShell copy={accessibilityCopy} />;
}
