import Link from "next/link";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getMyExamArchive } from "@/lib/db/exam-archive";

import { ArchiveTabs } from "./_components/archive-tabs";

/**
 * /exam-archive — ארכיון המבחנים שלי: every exam the candidate has filed, under
 * the same three subject tabs as the dashboard.
 *
 * Server Component: the list is read here, through lib/db/exam-archive.ts,
 * because the paper titles come from tables students cannot read directly.
 * `requireActiveSubscription()` re-runs the gate like every other (app) page,
 * so the layout's Router Cache cannot replay this for an expired user.
 *
 * Each entry opens the screen that already shows that sitting in full, so this
 * page stays an index — see lib/db/exam-archive.ts.
 */
export default async function ExamArchivePage() {
  await requireActiveSubscription();
  const archive = await getMyExamArchive();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2">
        <nav className="flex items-center gap-2 font-heebo text-sm" aria-label="פירורי לחם">
          <Link href="/dashboard" className="hover:underline" style={{ color: "var(--color-gold-deep)" }}>
            דשבורד
          </Link>
          <span aria-hidden style={{ color: "var(--color-ink-muted)" }}>
            ›
          </span>
          <span style={{ color: "var(--color-ink-dim)" }}>ארכיון המבחנים שלי</span>
        </nav>
        <h1
          className="font-heebo font-extrabold tracking-tight"
          style={{ fontSize: "clamp(24px, 2.1vw, 32px)", color: "var(--color-navy-ink)", lineHeight: 1.15 }}
        >
          ארכיון המבחנים שלי
        </h1>
        <p className="font-heebo" style={{ fontSize: 15, color: "var(--color-ink-dim)" }}>
          כל המבחנים שהגשת. לחיצה על מבחן פותחת אותו במלואו — התשובות שלך, התשובות הנכונות וההסבר המלא.
        </p>
      </header>

      <ArchiveTabs archive={archive} />
    </div>
  );
}
