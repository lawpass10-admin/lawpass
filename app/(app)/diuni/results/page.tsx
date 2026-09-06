import Link from "next/link";

import { ScoreResults } from "@/components/app/score-results";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getDiuniAttempt } from "@/lib/db/diuni";
import { breakdownByTopic } from "@/lib/scoring/topic-breakdown";

/**
 * /diuni/results?attempt=<answer_id> — what one sitting scored, before the
 * full solution.
 *
 * Reads the STORED sitting rather than being handed numbers by the screen that
 * filed it. That is what makes this page linkable and re-openable: the score
 * here is the row's own, so it cannot disagree with the table, and a candidate
 * can come back to it days later.
 *
 * The per-subject table is recomputed from `answer_body.given`, where each
 * marked answer carries the law or judgment area it came from. The server
 * computes the same rollup at marking time; the two implementations are pinned
 * to each other by tests/topic-breakdown-parity.test.ts.
 */
export default async function DiuniResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  await requireActiveSubscription();

  const { attempt: attemptId } = await searchParams;
  const attempt = attemptId ? await getDiuniAttempt(attemptId) : null;

  if (!attempt) return <MissingAttempt />;

  return (
    <ScoreResults
      subject="דין דיוני"
      correct={attempt.correct}
      total={attempt.total}
      answered={attempt.answered}
      attempts={attempt.attempts}
      byTopic={breakdownByTopic(attempt.given)}
      reviewUrl={`/diuni/review?attempt=${encodeURIComponent(attempt.answerId)}`}
      backUrl={`/diuni?set=${encodeURIComponent(attempt.questionId)}`}
      backLabel="חזרה למבחן"
    />
  );
}

/**
 * A missing or unreadable `?attempt=` is not an error page. The sitting may
 * belong to someone else, or the link may be stale; either way the useful
 * thing to offer is the way back, not a stack trace.
 */
function MissingAttempt() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-16 text-center">
      <h1 className="font-heebo text-xl font-bold">לא נמצאו תוצאות</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        הקישור אינו תקין או שהמבחן אינו שייך למשתמש הזה.
      </p>
      <Link
        href="/diuni"
        className="mt-5 inline-block text-sm text-primary underline underline-offset-2 hover:no-underline"
      >
        חזרה לדין דיוני
      </Link>
    </div>
  );
}
