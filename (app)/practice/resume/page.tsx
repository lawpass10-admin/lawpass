import { redirect } from "next/navigation";

import { ResumeCard } from "@/app/(app)/practice/resume/_components/resume-card";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getQuestionForPosition,
  getResumableSessionForUser,
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
 *   4. Batch-resolve ALL selected chapters' titles for the card header
 *      (Slice 57 A — was previously only `[0]`), and resolve the
 *      *next* question's actual chapter for the "next-q" banner.
 */
export default async function PracticeResumePage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const session = await getResumableSessionForUser(supabase, user.id);
  if (!session) redirect("/practice");

  // ---------------------------------------------------------------------------
  // Slice 57 A — batch chapter-title lookup.
  // ---------------------------------------------------------------------------
  // The session row persists the FULL builder selection in
  // `selected_chapters` (string[] of chapter UUIDs, builder click-order
  // preserved). The previous implementation read only `[0]` and showed
  // a multi-chapter session as if it were single-chapter. We fetch all
  // titles in one `.in()` query and re-order them back to the
  // selected_chapters order so the card reads in the same order the
  // user picked them at session creation.
  //
  // Legacy single-question sessions (review / mistake retry) insert
  // `selected_chapters: []`. For those, `chapterTitles` is an empty
  // array and the card falls back to the legacy generic label.
  const chapterTitles: string[] = await resolveChapterTitles(
    supabase,
    session.selected_chapters
  );

  // ---------------------------------------------------------------------------
  // Slice 57 A — next-question's REAL chapter.
  // ---------------------------------------------------------------------------
  // Previously this line echoed the first selected chapter's title —
  // wrong for multi-chapter sessions where the next question may live
  // in chapter[1] or chapter[2]. We resolve the actual next item via
  // the play-page's shared helper so the banner matches what the user
  // will land on. The resolver may return `archived` (a question was
  // soft-deleted mid-session) or `out_of_range` (questions_answered is
  // past the end — a stale row that should have been cleaned up); both
  // are non-fatal here, so we fall back to the first chapter title and
  // log a warning. The play page itself still handles those branches
  // properly when the user clicks resume.
  const nextChapterTitle = await resolveNextChapterTitle(
    supabase,
    session,
    chapterTitles[0] ?? null
  );

  return (
    <ResumeCard
      sessionId={session.id}
      chapterTitles={chapterTitles}
      startedAtISO={session.started_at}
      totalQuestions={session.question_list.length}
      questionsAnswered={session.questions_answered}
      questionsCorrect={session.questions_correct}
      nextChapterTitle={nextChapterTitle}
    />
  );
}

// =============================================================================
// Helpers
// =============================================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function resolveChapterTitles(
  supabase: SupabaseClient,
  selectedChapterIds: string[]
): Promise<string[]> {
  if (selectedChapterIds.length === 0) return [];

  const { data, error } = await supabase
    .from("chapters")
    .select("id, title")
    .in("id", selectedChapterIds);

  if (error || !data) {
    console.warn(
      `[practice/resume] chapter title batch lookup failed code=${
        (error as { code?: string } | null)?.code ?? "unknown"
      } msg=${error?.message ?? "no data"}`
    );
    return [];
  }

  // Preserve builder click-order from session.selected_chapters; the
  // .in() query returns rows in arbitrary order.
  const titleById = new Map<string, string>(
    data.map((row) => [row.id as string, row.title as string])
  );
  return selectedChapterIds
    .map((id) => titleById.get(id))
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}

async function resolveNextChapterTitle(
  supabase: SupabaseClient,
  session: Awaited<ReturnType<typeof getResumableSessionForUser>>,
  firstChapterFallback: string | null
): Promise<string | null> {
  if (!session) return firstChapterFallback;
  if (session.questions_answered >= session.question_list.length) {
    return firstChapterFallback;
  }

  const resolved = await getQuestionForPosition(
    supabase,
    session,
    session.questions_answered
  );

  if (resolved.kind === "source") {
    return resolved.question.chapter_title || firstChapterFallback;
  }
  if (resolved.kind === "angle") {
    return resolved.parentSource.chapter_title || firstChapterFallback;
  }

  // archived | out_of_range — non-fatal here.
  console.warn(
    `[practice/resume] next-chapter resolve fell back kind=${resolved.kind} session=${session.id} position=${session.questions_answered}`
  );
  return firstChapterFallback;
}
