import { redirect } from "next/navigation";

import { ResumeCard } from "@/app/(app)/practice/resume/_components/resume-card";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getResumableSessionForUser,
  type PracticeSessionRow,
  type QuestionListItem,
} from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";

/**
 * /practice/resume — Slice 5 Phase P2.
 *
 * Server Component dedicated to surfacing an active in-flight practice
 * session as a focused screen (replaces the Phase 9 inline dialog on
 * /practice).
 *
 * Gate ordering:
 *   1. Subscription gate (same hardening as the rest of (app)).
 *   2. `getResumableSessionForUser` — read + silently abandon if stale.
 *   3. No session → redirect back to /practice (route is meaningless
 *      without an active row; the user typed it directly or arrived
 *      via a stale link).
 *   4. Resolve the first selected chapter's title for the card header,
 *      and the *next* question's type + topic for the "next-q" banner.
 */
export default async function PracticeResumePage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const session = await getResumableSessionForUser(supabase, user.id);
  if (!session) redirect("/practice");

  // Card header — first selected chapter's title. Sessions with no
  // selected_chapters (legacy single-question review flows) fall back
  // to a generic label. The card never crashes on missing data.
  const firstChapterId = session.selected_chapters[0] ?? null;
  const chapterTitleQuery = firstChapterId
    ? await supabase
        .from("chapters")
        .select("title")
        .eq("id", firstChapterId)
        .maybeSingle()
    : null;
  const chapterTitle = chapterTitleQuery?.data?.title ?? "התרגול הפעיל שלך";

  // Next-question banner — resolve the type ("מקור" / "זווית") from
  // the question_list at the current `questions_answered` position. For
  // the topic line we surface the chapter title (subtopic resolution
  // would require a per-question lookup; intentionally skipped here).
  const nextItem = pickNextItem(session);
  const nextQuestionType = nextItem?.type ?? null;
  const nextQuestionLabel = chapterTitle;

  return (
    <ResumeCard
      sessionId={session.id}
      chapterTitle={chapterTitle}
      sourceCount={session.source_count_target}
      angleCount={session.angles_per_source}
      startedAtISO={session.started_at}
      totalQuestions={session.question_list.length}
      questionsAnswered={session.questions_answered}
      questionsCorrect={session.questions_correct}
      nextQuestionType={nextQuestionType}
      nextQuestionLabel={nextQuestionLabel}
    />
  );
}

function pickNextItem(session: PracticeSessionRow): QuestionListItem | null {
  if (session.questions_answered >= session.question_list.length) return null;
  return session.question_list[session.questions_answered] ?? null;
}
