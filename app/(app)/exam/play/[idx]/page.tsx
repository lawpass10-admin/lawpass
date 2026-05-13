import { redirect } from "next/navigation";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getExamBookmarkState,
  getExamPositionStatuses,
  getExamSessionById,
  getExistingExamAttempt,
  getQuestionForExamPosition,
  stripAnswerFromChoices,
  type AngleQuestionRow,
  type SourceQuestionRow,
} from "@/lib/db/exam";
import { createClient } from "@/lib/supabase/server";
import { examPlayUrl, examResultsUrl } from "@/lib/urls";

import { ExamQuestion } from "../_components/exam-question";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * /exam/play/[idx]?session={uuid} — Slice 3 Phase 3 play route.
 *
 * Routing rules:
 *   - Missing/invalid session id → /exam (intro)
 *   - Position out of [0, 39] → /exam
 *   - status='completed' → /exam/results/[id]
 *   - status='abandoned' → /exam
 *   - status='paused' → render normally; client shows pause overlay on mount
 *   - Question is archived (RLS-hidden mid-flight) → /exam (rare; PM-confirmed
 *     no in-place handling for exam — session is treated as broken)
 *
 * Choice payload is stripped (is_correct + distractor_analysis) before
 * shipping to the client — exam never reveals the answer mid-flight.
 *
 * Window-token guard lives client-side: the page hands the session's
 * `active_window_token` to `<ExamQuestion>` which compares against
 * localStorage on mount. Mismatch renders `<WindowConflict />` instead
 * of the question.
 */
export default async function ExamPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ idx: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { user } = await requireActiveSubscription();
  const { idx: idxParam } = await params;
  const { session: sessionId } = await searchParams;

  const position = Number.parseInt(idxParam, 10);
  if (!Number.isFinite(position) || position < 0 || position > 39) {
    redirect("/exam");
  }
  if (!sessionId || !UUID_RE.test(sessionId)) {
    redirect("/exam");
  }

  const supabase = await createClient();
  const session = await getExamSessionById(supabase, user.id, sessionId);
  if (!session) redirect("/exam");

  if (session.status === "completed") {
    redirect(examResultsUrl(session.id));
  }
  if (session.status === "abandoned") {
    redirect("/exam");
  }

  if (position >= session.question_list.length) {
    redirect(examPlayUrl(session.id, 0));
  }
  const item = session.question_list[position];
  if (!item) redirect(examPlayUrl(session.id, 0));

  const resolved = await getQuestionForExamPosition(supabase, item);
  if (resolved.kind === "archived") {
    redirect("/exam");
  }

  const [existingAttempt, bookmarked, positionStatuses] = await Promise.all([
    getExistingExamAttempt(supabase, user.id, session.id, item),
    getExamBookmarkState(supabase, user.id, resolved),
    // Hydrate per-position statuses so the progress strip can color
    // answered/skipped cells and the submit-confirm dialog can show
    // a real unanswered count (Phase 4 — folds in the two Phase 3
    // deviations).
    getExamPositionStatuses(supabase, session.id, session.question_list),
  ]);

  const stripped: SourceQuestionRow | AngleQuestionRow = stripAnswerFromChoices(
    resolved.question
  );

  return (
    <ExamQuestion
      session={{
        id: session.id,
        active_window_token: session.active_window_token,
        total_duration_seconds: session.total_duration_seconds,
        time_used_seconds: session.time_used_seconds,
        status: session.status,
        question_list: session.question_list,
      }}
      position={position}
      questionText={stripped.question_text}
      choices={stripped.choices}
      existingSelectedLetter={existingAttempt?.selected_letter ?? null}
      isBookmarked={bookmarked}
      positionStatuses={positionStatuses.map((p) => p.status)}
    />
  );
}
