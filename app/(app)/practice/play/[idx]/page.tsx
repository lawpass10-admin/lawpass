import { redirect } from "next/navigation";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getBookmarkState,
  getExistingAttempt,
  getQuestionForPosition,
  getSessionForUser,
  stripAnswerFromChoices,
  type AngleQuestionRow,
  type SourceQuestionRow,
} from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { practicePlayUrl, practiceSummaryUrl } from "@/lib/urls";

import { ArchivedAutoAdvance } from "../_components/archived-auto-advance";
import { PracticeQuestion } from "../_components/practice-question";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * /practice/play/[idx]?session={id} — the heart of Phase 3.
 *
 * Routing notes:
 *  - `idx` is a path segment (Router-Cache-safe across position
 *    navigations). `session` stays a search param because it doesn't
 *    cycle within a session.
 *  - Session-status redirects:
 *      completed  → /practice/summary?session=…
 *      abandoned  → /practice
 *  - Position clamping:
 *      idx >= question_list.length → summary
 *      idx > questions_answered    → /practice/play/{questions_answered}
 *        (prevents URL-jumping past where the user actually answered)
 *
 * The replay-mode determination happens further down: if an attempt
 * row exists for this (session, question) pair we render the page
 * with `revealed=true` and the un-stripped choice data. Otherwise we
 * strip `is_correct` + `distractor_analysis` so the RSC payload
 * doesn't leak the answer before submit.
 */
export default async function PracticePlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ idx: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { user } = await requireActiveSubscription();

  const { idx: idxParam } = await params;
  const { session: sessionId } = await searchParams;

  const idx = Number.parseInt(idxParam, 10);
  if (!Number.isFinite(idx) || idx < 0) redirect("/practice");
  if (!sessionId || !UUID_RE.test(sessionId)) redirect("/practice");

  const supabase = await createClient();
  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) redirect("/practice");

  if (session.status === "completed") {
    redirect(practiceSummaryUrl(sessionId));
  }
  if (session.status === "abandoned") {
    redirect("/practice");
  }

  const totalQuestions = session.question_list.length;
  if (idx >= totalQuestions) {
    redirect(practiceSummaryUrl(sessionId));
  }
  if (idx > session.questions_answered) {
    redirect(practicePlayUrl(sessionId, session.questions_answered));
  }

  const resolved = await getQuestionForPosition(supabase, session, idx);

  if (resolved.kind === "out_of_range") {
    redirect(practiceSummaryUrl(sessionId));
  }

  if (resolved.kind === "archived") {
    return (
      <ArchivedAutoAdvance sessionId={sessionId} fromPosition={idx} />
    );
  }

  const existingAttempt = await getExistingAttempt(
    supabase,
    user.id,
    sessionId,
    resolved
  );
  const bookmarked = await getBookmarkState(supabase, user.id, resolved);

  // Replay vs first-view: strip `is_correct` + `distractor_analysis`
  // from the choices when the user hasn't answered yet — otherwise the
  // answer would ship to the client inside the RSC payload, where a
  // curious user could read it from DevTools before clicking. After
  // submit, the action returns correctChoiceId + correctLetter and the
  // client redisplays from that.
  const stripped: SourceQuestionRow | AngleQuestionRow =
    existingAttempt === null
      ? stripAnswerFromChoices(resolved.question)
      : resolved.question;

  const view =
    resolved.kind === "source"
      ? {
          kind: "source" as const,
          question: stripped as SourceQuestionRow,
          breadcrumbChapter: resolved.question.chapter_title,
          breadcrumbType: "שאלת מקור" as const,
          subtopicTitle: resolved.question.subtopic_title,
        }
      : {
          kind: "angle" as const,
          question: stripped as AngleQuestionRow,
          breadcrumbChapter: resolved.parentSource.chapter_title,
          breadcrumbType: `זווית ${resolved.question.angle_letter}`,
          subtopicTitle: resolved.parentSource.subtopic_title,
        };

  return (
    <PracticeQuestion
      session={session}
      view={view}
      position={idx}
      totalQuestions={totalQuestions}
      existingAttempt={existingAttempt}
      bookmarked={bookmarked}
    />
  );
}
