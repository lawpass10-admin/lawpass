import type { Metadata } from "next";

import { LegalPageShell } from "@/app/(marketing)/_components/legal-page-shell";
import { termsCopy } from "@/app/(marketing)/_components/legal-copy";

/**
 * /terms — תקנון האתר.
 *
 * The slot Slice 50 left open when it shipped /privacy and /accessibility and
 * noted the תקנון as "a separate follow-up slice once the תקנון file lands".
 *
 * Public, INDEXABLE, and built from the same <LegalPageShell> as its two
 * siblings — so the top strip, the back link and the prose typography are the
 * same on all three, and this file is metadata plus the mount.
 *
 * What it does NOT carry is the quality-control NDA: that is a different
 * agreement, it lives in lib/legal/nda.ts, and it is shown and version-recorded
 * during registration. See the note on `termsCopy`.
 */
export const metadata: Metadata = {
  title: termsCopy.meta.title,
  description: termsCopy.meta.description,
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    url: "/terms",
    title: termsCopy.meta.title,
    description: termsCopy.meta.description,
  },
};

export default function TermsPage() {
  return <LegalPageShell copy={termsCopy} />;
}
