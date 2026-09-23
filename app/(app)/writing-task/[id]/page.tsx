import Link from "next/link";

import { ExamPageNav } from "@/app/(app)/_components/exam-page-nav";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

import { WritingTaskWorkspace } from "../_components/writing-task-workspace";

/**
 * /writing-task/[id] — the exam paper plus the answer sheet.
 *
 * Server shell only, same as the picker: the gate runs here, the question is
 * fetched in the browser from lawpass_server with the user's bearer token.
 */
export default async function WritingTaskQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireActiveSubscription();
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="breadcrumbs"
          className="flex items-center gap-2 font-heebo"
          style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
        >
          <Link
            href="/dashboard"
            className="font-semibold transition-colors hover:underline"
            style={{ color: "var(--color-gold-deep)" }}
          >
            דשבורד
          </Link>
          <span aria-hidden>›</span>
          <Link
            href="/writing-task"
            className="font-semibold transition-colors hover:underline"
            style={{ color: "var(--color-gold-deep)" }}
          >
            מטלת כתיבה
          </Link>
          <span aria-hidden>›</span>
          <span>השאלה</span>
        </nav>

        {/* This route keeps the sidebar, so the main-menu button is a
            convenience here rather than the only exit — but the back button is
            the same one every other exam screen carries, and a candidate should
            not have to learn a different way out per subject. */}
        <ExamPageNav backHref="/writing-task" backLabel="חזרה לרשימת המטלות" />
      </div>

      <WritingTaskWorkspace questionId={id} />
    </div>
  );
}
