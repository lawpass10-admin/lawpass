import Link from "next/link";

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

      <WritingTaskWorkspace questionId={id} />
    </div>
  );
}
