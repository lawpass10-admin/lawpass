import Link from "next/link";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

import { AnswerFeedback } from "./_components/answer-feedback";

/**
 * /writing-task/results/[answerId] — the marking of one submission.
 *
 * Server Component shell, same shape as the rest of /writing-task: the gate runs
 * here so an expired subscription cannot replay the route from the Router Cache,
 * and the data is fetched client-side from lawpass_server with the user's bearer
 * token.
 *
 * The route is reached automatically the moment an answer is filed — grading
 * takes about a minute, so the page owns the waiting rather than the editor.
 * That also makes it durable: the URL is the submission, so a student who closes
 * the tab, refreshes, or comes back an hour later lands on the same screen and
 * sees either the spinner or the result, whichever is true by then.
 *
 * Someone else's answer id renders "not found" — the row is scoped to its owner
 * by RLS, so the API returns nothing for it.
 */
export default async function WritingTaskResultsPage({
  params,
}: {
  params: Promise<{ answerId: string }>;
}) {
  await requireActiveSubscription();
  const { answerId } = await params;

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6">
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
        <span>חוות דעת</span>
      </nav>

      <AnswerFeedback answerId={answerId} />
    </div>
  );
}
