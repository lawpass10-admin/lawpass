import Link from "next/link";

import { ScoreResults } from "@/components/app/score-results";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getMahotiAttempt } from "@/lib/db/mahoti";
import { breakdownByTopic } from "@/lib/scoring/topic-breakdown";

/**
 * /mahoti/results?attempt=<answer_id> — what one sitting scored, before the
 * full solution.
 *
 * The דיון מהותי twin of /diuni/results, sharing one <ScoreResults>. See that
 * component for why this is a page rather than the dialog it started as: a
 * 40-question mahoti paper spans up to 25 laws, and 25 rows never fitted in a
 * modal.
 *
 * The per-law table is recomputed from `answer_body.given`, where each marked
 * answer carries the law it was built from.
 */
export default async function MahotiResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  await requireActiveSubscription();

  const { attempt: attemptId } = await searchParams;
  const attempt = attemptId ? await getMahotiAttempt(attemptId) : null;

  if (!attempt) return <MissingAttempt />;

  return (
    <ScoreResults
      subject="דיון מהותי"
      correct={attempt.correct}
      total={attempt.total}
      answered={attempt.answered}
      attempts={attempt.attempts}
      byTopic={breakdownByTopic(attempt.given)}
      reviewUrl={`/mahoti/review?attempt=${encodeURIComponent(attempt.answerId)}`}
      backUrl={`/mahoti?set=${encodeURIComponent(attempt.questionId)}`}
      backLabel="חזרה למבחן"
    />
  );
}

function MissingAttempt() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-16 text-center">
      <h1 className="font-heebo text-xl font-bold">לא נמצאו תוצאות</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        הקישור אינו תקין או שהמבחן אינו שייך למשתמש הזה.
      </p>
      <Link
        href="/mahoti"
        className="mt-5 inline-block text-sm text-primary underline underline-offset-2 hover:no-underline"
      >
        חזרה לדיון מהותי
      </Link>
    </div>
  );
}
