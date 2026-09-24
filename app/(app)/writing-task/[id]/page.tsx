import Link from "next/link";

import { ExamPageNav } from "@/app/(app)/_components/exam-page-nav";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getTemplatesForQuestion } from "@/lib/db/open-question-templates";
import { createClient } from "@/lib/supabase/server";

import { WritingTaskWorkspace } from "../_components/writing-task-workspace";

/**
 * /writing-task/[id] — the exam paper plus the answer sheet.
 *
 * Server shell, same as the picker: the gate runs here and the question is
 * fetched in the browser from lawpass_server with the user's bearer token.
 *
 * The writing SKELETONS are the exception — they are read here rather than in
 * the browser. They are keyed off the question's subject, and the browser only
 * learns the subject once it has the question, so fetching them there would
 * mean the skeleton pane arriving a render after the paper it sits beside.
 */
export default async function WritingTaskQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireActiveSubscription();
  const { id } = await params;
  const supabase = await createClient();
  const templates = await getTemplatesForQuestion(supabase, id);

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

        {/* This route renders without the sidebar (see FOCUS_ROUTE_PATTERNS in
            _components/app-shell.tsx), so this back button is the way out — the
            same one every other exam screen carries, because a candidate should
            not have to learn a different way out per subject. */}
        <ExamPageNav backHref="/writing-task" backLabel="חזרה לרשימת המטלות" />
      </div>

      <WritingTaskWorkspace questionId={id} templates={templates} />
    </div>
  );
}
