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
import { getNoteForPosition } from "@/lib/db/notes";
import { computeRemaining } from "@/lib/practice/session-timer";
import { createClient } from "@/lib/supabase/server";
import { practicePlayUrl, practiceSummaryUrl } from "@/lib/urls";

import { QaQuestionSetter } from "../../../_components/qa-question-setter";
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

  // Slice 25 B-1 — Notes are fetched alongside the existing reads
  // so the play page render carries the initial note state (or
  // `null` for first-time view). RLS gates this on
  // has_active_subscription, so an expired user fails CLOSED at the
  // DB layer — the page can't show a stale note.
  //
  // Slice 54 A — the QA/admin gate for the question-ID badge. The
  // profile flags aren't loaded by requireActiveSubscription() (it
  // only reads the subscriptions row), so we fetch (is_qa_tester,
  // is_admin) here in the same parallel batch. `is_qa_tester` lives
  // in the DB (qa_feedback_system migration) but isn't in the stale
  // generated types; the SSR client is untyped so the select is
  // fine (same pattern as the (app) layout + qa actions).
  const [existingAttempt, bookmarked, initialNote, profileResult] =
    await Promise.all([
      getExistingAttempt(supabase, user.id, sessionId, resolved),
      getBookmarkState(supabase, user.id, resolved),
      getNoteForPosition(supabase, user.id, resolved),
      supabase
        .from("profiles")
        .select("is_qa_tester, is_admin")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const profile = profileResult.data;
  const showQuestionId =
    profile?.is_qa_tester === true || profile?.is_admin === true;

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
          // Slice 54 A — parent source's external_id, already fetched
          // server-side, threaded through so the QA badge can compose
          // the angle identifier ("{external_id} · זווית {letter}").
          parentExternalId: resolved.parentSource.external_id,
        };

  return (
    // Slice 10.2 — same pattern as the exam play page. The setter is
    // a sibling of <PracticeQuestion>; it writes the question identity
    // into the module-level qa-question-store on mount and clears it
    // on unmount, so the QA widget (mounted in the layout above) can
    // read it via getQaQuestionContext() at submit time.
    // view.question.id is the resolved source/angle row id;
    // view.kind discriminates the union ('source' | 'angle').
    <>
      <QaQuestionSetter
        questionId={view.question.id}
        questionType={view.kind}
      />
      <PracticeQuestion
        session={session}
        view={view}
        position={idx}
        totalQuestions={totalQuestions}
        existingAttempt={existingAttempt}
        bookmarked={bookmarked}
        // Slice 54 A — QA/admin-only question-ID badge gate. False for
        // students, so the badge element never renders for them.
        showQuestionId={showQuestionId}
        // Slice 24 — wall-clock session timer. Re-derived on every
        // page render from `session_duration_seconds` + `started_at`,
        // so navigation, resume, and refresh all see the same number.
        // `null` when `session_duration_seconds === 0` (no timer).
        sessionRemainingSeconds={computeRemaining({
          sessionDurationSeconds: session.session_duration_seconds,
          startedAt: session.started_at,
        })}
        // Slice 25 B-1 — initial note state + a server-built Hebrew
        // context label for the sheet header. The label collapses
        // source/angle since Slice 18 removed that vocabulary from
        // the user-facing UI; it shows position + chapter only.
        initialNote={
          initialNote
            ? {
                contentJson: initialNote.content_json,
                contentHtml: initialNote.content_html,
                updatedAt: initialNote.updated_at,
              }
            : null
        }
        questionContextLabel={`שאלה ${idx + 1} · ${view.breadcrumbChapter}`}
      />
    </>
  );
}
