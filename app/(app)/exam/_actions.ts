"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { sampleExamQuestions } from "@/lib/db/exam";
import { EXAM_TOTAL_DURATION_SECONDS } from "@/lib/exam/clusters";
import { createClient } from "@/lib/supabase/server";
import { examPlayUrl } from "@/lib/urls";

// =============================================================================
// Result types
// =============================================================================

type CreateExamSessionResult =
  | {
      ok: true;
      url: string;
      sessionId: string;
      windowToken: string;
    }
  | { ok: false; error: string };

// =============================================================================
// createExamSession
// =============================================================================

/**
 * Mint a new exam session. No client input — sampling is fully derived
 * from the caller's auth + the cluster config.
 *
 * Steps:
 *   1. Abandon any prior active/paused session for the caller (per the
 *      PM-confirmed "single in-flight exam per user" rule; mirror of
 *      `createPracticeSession`).
 *   2. Sample 40 questions via the cluster-weighted sampler.
 *   3. Mint an `active_window_token` (the DB column has no DEFAULT) and
 *      INSERT the session row.
 *   4. revalidatePath layout (no badge changes today, but the resume
 *      modal on `/exam` reads via RSC and benefits from a fresh fetch).
 *   5. Return the play URL + sessionId + windowToken. The client carries
 *      the windowToken into `localStorage` so subsequent server-action
 *      calls can validate it against the row's `active_window_token` —
 *      the single-window guard surface lands in Phase 3.
 */
export async function createExamSession(): Promise<CreateExamSessionResult> {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  try {
    // Step 1 — abandon any prior in-flight session. .in() on status
    // covers both 'active' and 'paused'.
    await supabase
      .from("exam_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .in("status", ["active", "paused"]);

    // Step 2 — sample (throws 'exam_pool_insufficient' if the pool is
    // <40; current production pool is 195 so this branch is defensive).
    const questionList = await sampleExamQuestions(supabase);

    // Step 3 — mint window token client-side. The DB column has no
    // DEFAULT (verified via information_schema), so we explicitly set
    // it; the round-trip on .select('active_window_token') re-reads
    // the stored value, so token drift between app + DB can't happen.
    const windowToken = randomUUID();

    const { data: inserted, error: insertError } = await supabase
      .from("exam_sessions")
      .insert({
        user_id: user.id,
        question_list: questionList,
        total_duration_seconds: EXAM_TOTAL_DURATION_SECONDS,
        time_used_seconds: 0,
        status: "active",
        active_window_token: windowToken,
      })
      .select("id, active_window_token")
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error("insert_returned_no_row");
    }

    console.info(
      `[exam] create_session OK user=${user.id} session=${inserted.id} items=${questionList.length}`
    );

    revalidatePath("/", "layout");

    return {
      ok: true,
      url: examPlayUrl(inserted.id, 0),
      sessionId: inserted.id,
      // Use the round-tripped value rather than the local variable so
      // any DB-side rewrite (none expected, but defensive) is reflected.
      windowToken: inserted.active_window_token,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(
      `[exam] create_session FAILED user=${user.id} code=${
        code ?? "unknown"
      } message=${message}`
    );
    // Surface the sampler's known-error code verbatim so the caller can
    // distinguish "we tried, the pool is too small" from generic
    // failures. Phase 2 surfaces this as a user-visible toast.
    if (message === "exam_pool_insufficient") {
      return { ok: false, error: "exam_pool_insufficient" };
    }
    return { ok: false, error: "create_exam_session_failed" };
  }
}

// =============================================================================
// abandonActiveExamSession
// =============================================================================

/**
 * Soft-cancel any in-flight exam session (status active OR paused) for
 * the caller. Used by the resume modal's "התחל בחינה חדשה" button so
 * the new createExamSession call doesn't trip the
 * "abandon-then-create" guard with a stale row.
 *
 * Idempotent — runs the UPDATE regardless of whether any active row
 * exists; the WHERE clause is the gate.
 */
export async function abandonActiveExamSession(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("exam_sessions")
    .update({
      status: "abandoned",
      last_activity_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .in("status", ["active", "paused"]);

  if (error) {
    console.error(
      `[exam] abandon_active FAILED user=${user.id} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "abandon_active_failed" };
  }

  console.info(`[exam] abandon_active OK user=${user.id}`);
  revalidatePath("/exam");
  return { ok: true };
}

// =============================================================================
// Phase 3 — gameplay actions
// =============================================================================
//
// All gameplay actions share three concerns: window-token validation,
// server-authoritative time accounting, and counter recompute. The
// helpers below encapsulate them so the action bodies stay readable.

import {
  getExamSessionById,
  getQuestionForExamPosition,
  type ExamSessionRow,
} from "@/lib/db/exam";
import { examResultsUrl } from "@/lib/urls";
import {
  abandonAndExitExamInput,
  claimExamWindowInput,
  pauseExamInput,
  resumeExamInput,
  skipExamQuestionInput,
  submitExamAttemptInput,
  submitFinalExamInput,
  toggleExamBookmarkInput,
} from "@/lib/validators/exam";
import type { SupabaseClient } from "@supabase/supabase-js";

type ExamActionFail = { ok: false; error: string };

/**
 * Common pre-flight: load the row, check the token, check the status.
 * Returns the session row on success or a typed failure for the caller
 * to short-circuit on.
 */
async function loadSessionForAction(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  windowToken: string,
  options: { requireActive?: boolean } = {}
): Promise<{ ok: true; session: ExamSessionRow } | ExamActionFail> {
  const session = await getExamSessionById(supabase, userId, sessionId);
  if (!session) return { ok: false, error: "session_not_found" };
  if (session.active_window_token !== windowToken) {
    return { ok: false, error: "window_conflict" };
  }
  if ((options.requireActive ?? true) && session.status !== "active") {
    return { ok: false, error: "session_not_active" };
  }
  return { ok: true, session };
}

/** Clamp client-supplied elapsed seconds against the session's
 *  remaining budget. Server-authoritative. */
function nextTimeUsed(session: ExamSessionRow, clientElapsed: number): number {
  const incr = Math.max(0, clientElapsed);
  return Math.min(
    session.time_used_seconds + incr,
    session.total_duration_seconds
  );
}

function remainingSeconds(
  session: ExamSessionRow,
  newTimeUsed: number
): number {
  return Math.max(0, session.total_duration_seconds - newTimeUsed);
}

/**
 * Recompute `questions_answered` + `questions_correct` for the session
 * from the current `attempts` rows. Cheaper than tracking deltas and
 * bulletproof under backward-nav overwrites + skip toggles.
 *
 * answered = attempts where was_skipped=false AND is_correct IS NOT NULL
 * correct  = attempts where is_correct=true
 * (Skip rows have was_skipped=true; they exist for analytics but do
 *  not count as answered.)
 */
async function recomputeExamCounters(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ answered: number; correct: number }> {
  const [answeredRes, correctRes] = await Promise.all([
    supabase
      .from("attempts")
      .select("*", { count: "exact", head: true })
      .eq("exam_session_id", sessionId)
      .eq("was_skipped", false)
      .not("is_correct", "is", null),
    supabase
      .from("attempts")
      .select("*", { count: "exact", head: true })
      .eq("exam_session_id", sessionId)
      .eq("is_correct", true),
  ]);
  const answered = answeredRes.count ?? 0;
  const correct = correctRes.count ?? 0;
  await supabase
    .from("exam_sessions")
    .update({ questions_answered: answered, questions_correct: correct })
    .eq("id", sessionId);
  return { answered, correct };
}

// -----------------------------------------------------------------------------
// submitExamAttempt
// -----------------------------------------------------------------------------

type SubmitExamAttemptResult =
  | { ok: true; remaining_seconds: number; is_correct: boolean }
  | ExamActionFail;

/**
 * Record (or overwrite) the user's answer at `position`. UPSERTs against
 * the Phase 0 partial unique indexes so backward navigation + re-pick is
 * idempotent.
 *
 * Correctness is derived server-side from the question's `is_correct`
 * choice — never trust the client. Counter recompute fires after the
 * UPSERT so changing an answer from wrong → right (or vice versa)
 * always converges.
 *
 * `mistakes` is NOT touched here: PM-confirmed exam-wrong answers do
 * not write to the mistakes folder.
 */
export async function submitExamAttempt(
  input: unknown
): Promise<SubmitExamAttemptResult> {
  const parsed = submitExamAttemptInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, clientElapsedSeconds, position, selectedLetter } =
    parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken
  );
  if (!guard.ok) return guard;
  const session = guard.session;

  const item = session.question_list[position];
  if (!item) return { ok: false, error: "position_out_of_range" };

  // Resolve question on the server — we need the choice ids + is_correct
  // to compute correctness; the client never sees these.
  const resolved = await getQuestionForExamPosition(supabase, item);
  if (resolved.kind === "archived") {
    return { ok: false, error: "question_archived" };
  }

  const choices =
    resolved.kind === "source"
      ? resolved.question.choices
      : resolved.question.choices;
  const chosen = choices.find((c) => c.letter === selectedLetter);
  const correctChoice = choices.find((c) => c.is_correct);
  if (!chosen || !correctChoice) {
    return { ok: false, error: "invalid_choice_data" };
  }
  const isCorrect = chosen.id === correctChoice.id;
  const isSource = resolved.kind === "source";

  const newTimeUsed = nextTimeUsed(session, clientElapsedSeconds);
  // Clamp duration into the column's reasonable range. Matches the
  // submit-attempt practice convention (max 600 s per question).
  const durationClamped = Math.max(
    0,
    Math.min(600, Math.round(clientElapsedSeconds))
  );

  // PartIAL unique index UPSERT: supabase-js's .upsert() can't emit
  // the `WHERE <predicate>` Postgres requires for partial indexes.
  // Phase 3 hotfix: go through the record_exam_attempt SECURITY DEFINER
  // RPC which issues the INSERT … ON CONFLICT (cols) WHERE … DO UPDATE
  // in raw SQL.
  const { error: upsertError } = await supabase.rpc(
    "record_exam_attempt",
    {
      p_session_id: sessionId,
      p_question_type: isSource ? "source" : "angle",
      p_source_question_id: isSource ? item.question_id : null,
      p_angle_question_id: isSource ? null : item.question_id,
      p_selected_choice_id: chosen.id,
      p_selected_letter: selectedLetter,
      p_is_correct: isCorrect,
      p_was_skipped: false,
      p_duration_seconds: durationClamped,
    }
  );
  if (upsertError) {
    console.error(
      `[exam] record_exam_attempt RPC FAILED session=${sessionId} pos=${position} code=${
        (upsertError as { code?: string }).code ?? "unknown"
      } msg=${upsertError.message}`
    );
    return { ok: false, error: "attempt_write_failed" };
  }

  // Counters: recompute from attempts. Cheap, race-free.
  await recomputeExamCounters(supabase, sessionId);

  // Time accounting.
  await supabase
    .from("exam_sessions")
    .update({
      time_used_seconds: newTimeUsed,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  return {
    ok: true,
    remaining_seconds: remainingSeconds(session, newTimeUsed),
    is_correct: isCorrect,
  };
}

// -----------------------------------------------------------------------------
// skipExamQuestion
// -----------------------------------------------------------------------------

type SkipExamQuestionResult =
  | { ok: true; remaining_seconds: number }
  | ExamActionFail;

export async function skipExamQuestion(
  input: unknown
): Promise<SkipExamQuestionResult> {
  const parsed = skipExamQuestionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, clientElapsedSeconds, position } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken
  );
  if (!guard.ok) return guard;
  const session = guard.session;

  const item = session.question_list[position];
  if (!item) return { ok: false, error: "position_out_of_range" };

  const isSource = item.question_type === "source";
  const newTimeUsed = nextTimeUsed(session, clientElapsedSeconds);
  const durationClamped = Math.max(
    0,
    Math.min(600, Math.round(clientElapsedSeconds))
  );

  // Same partial-index UPSERT path as submitExamAttempt — go through
  // the SECURITY DEFINER RPC. Skip rows carry the same shape as
  // answered rows with the answer-bearing fields nulled and
  // was_skipped=true.
  const { error: upsertError } = await supabase.rpc(
    "record_exam_attempt",
    {
      p_session_id: sessionId,
      p_question_type: isSource ? "source" : "angle",
      p_source_question_id: isSource ? item.question_id : null,
      p_angle_question_id: isSource ? null : item.question_id,
      p_selected_choice_id: null,
      p_selected_letter: null,
      p_is_correct: null,
      p_was_skipped: true,
      p_duration_seconds: durationClamped,
    }
  );
  if (upsertError) {
    console.error(
      `[exam] skip RPC FAILED session=${sessionId} pos=${position} code=${
        (upsertError as { code?: string }).code ?? "unknown"
      } msg=${upsertError.message}`
    );
    return { ok: false, error: "attempt_write_failed" };
  }

  await recomputeExamCounters(supabase, sessionId);
  await supabase
    .from("exam_sessions")
    .update({
      time_used_seconds: newTimeUsed,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  return { ok: true, remaining_seconds: remainingSeconds(session, newTimeUsed) };
}

// -----------------------------------------------------------------------------
// pauseExam / resumeExam
// -----------------------------------------------------------------------------

type PauseExamResult = { ok: true } | ExamActionFail;

export async function pauseExam(input: unknown): Promise<PauseExamResult> {
  const parsed = pauseExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, clientElapsedSeconds } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken
  );
  if (!guard.ok) return guard;
  const session = guard.session;

  const newTimeUsed = nextTimeUsed(session, clientElapsedSeconds);
  const nowIso = new Date().toISOString();
  await supabase
    .from("exam_sessions")
    .update({
      status: "paused",
      paused_at: nowIso,
      time_used_seconds: newTimeUsed,
      last_activity_at: nowIso,
    })
    .eq("id", sessionId);

  return { ok: true };
}

type ResumeExamResult =
  | { ok: true; remaining_seconds: number }
  | ExamActionFail;

export async function resumeExam(input: unknown): Promise<ResumeExamResult> {
  const parsed = resumeExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  // Resume targets a paused session — relax the requireActive check.
  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken,
    { requireActive: false }
  );
  if (!guard.ok) return guard;
  const session = guard.session;
  if (session.status !== "paused") {
    return { ok: false, error: "session_not_paused" };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("exam_sessions")
    .update({
      status: "active",
      paused_at: null,
      last_activity_at: nowIso,
    })
    .eq("id", sessionId);

  return {
    ok: true,
    remaining_seconds: remainingSeconds(session, session.time_used_seconds),
  };
}

// -----------------------------------------------------------------------------
// toggleExamBookmark
// -----------------------------------------------------------------------------

type ToggleExamBookmarkResult =
  | { ok: true; bookmarked: boolean }
  | ExamActionFail;

export async function toggleExamBookmark(
  input: unknown
): Promise<ToggleExamBookmarkResult> {
  const parsed = toggleExamBookmarkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, position } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken
  );
  if (!guard.ok) return guard;
  const session = guard.session;

  const item = session.question_list[position];
  if (!item) return { ok: false, error: "position_out_of_range" };

  // Resolve to derive the question_group_id for source bookmarks.
  const resolved = await getQuestionForExamPosition(supabase, item);
  if (resolved.kind === "archived") {
    return { ok: false, error: "question_archived" };
  }

  const args =
    resolved.kind === "source"
      ? {
          p_question_type: "source",
          p_source_question_group_id: resolved.question.question_group_id,
          p_angle_question_id: null,
        }
      : {
          p_question_type: "angle",
          p_source_question_group_id: null,
          p_angle_question_id: resolved.question.id,
        };

  const { data, error } = await supabase.rpc("record_bookmark_toggle", args);
  if (error) {
    console.error(
      `[exam] toggle_bookmark FAILED session=${sessionId} pos=${position} msg=${error.message}`
    );
    return { ok: false, error: "rpc_failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true, bookmarked: Boolean(data) };
}

// -----------------------------------------------------------------------------
// submitFinalExam
// -----------------------------------------------------------------------------

type SubmitFinalExamResult =
  | { ok: true; url: string }
  | ExamActionFail;

/**
 * Compute final_score / passed from `attempts`, flip status, return the
 * results URL. Idempotent — if status is already 'completed', return
 * the existing URL without re-computing.
 */
export async function submitFinalExam(
  input: unknown
): Promise<SubmitFinalExamResult> {
  const parsed = submitFinalExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, clientElapsedSeconds } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  // Allow submission from active OR paused — auto-submit at 0 may fire
  // while paused (unlikely but defensive).
  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken,
    { requireActive: false }
  );
  if (!guard.ok) return guard;
  const session = guard.session;

  // Idempotency: already submitted.
  if (session.status === "completed") {
    return { ok: true, url: examResultsUrl(sessionId) };
  }
  if (session.status === "abandoned") {
    return { ok: false, error: "session_abandoned" };
  }

  // Recompute counters before reading them for the final tally.
  const { correct } = await recomputeExamCounters(supabase, sessionId);
  const finalScore = correct;
  const passed = finalScore >= 24;
  const newTimeUsed = nextTimeUsed(session, clientElapsedSeconds);
  const nowIso = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("exam_sessions")
    .update({
      status: "completed",
      final_score: finalScore,
      passed,
      completed_at: nowIso,
      paused_at: null,
      time_used_seconds: newTimeUsed,
      last_activity_at: nowIso,
    })
    .eq("id", sessionId);
  if (updateError) {
    console.error(
      `[exam] submit_final FAILED session=${sessionId} msg=${updateError.message}`
    );
    return { ok: false, error: "update_failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true, url: examResultsUrl(sessionId) };
}

// -----------------------------------------------------------------------------
// abandonAndExitExam — pause + redirect to dashboard
// -----------------------------------------------------------------------------

type AbandonAndExitExamResult =
  | { ok: true; url: string }
  | ExamActionFail;

/**
 * Note: action name says "abandon" but the DB transition is to 'paused'.
 * PM-confirmed: the pause overlay's "צא לדשבורד" is a "save & exit"
 * UX — the user expects to come back via the resume modal. The name
 * reflects caller intent ("leave"); the DB state stays recoverable.
 */
export async function abandonAndExitExam(
  input: unknown
): Promise<AbandonAndExitExamResult> {
  const parsed = abandonAndExitExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, clientElapsedSeconds } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const guard = await loadSessionForAction(
    supabase,
    user.id,
    sessionId,
    windowToken,
    { requireActive: false }
  );
  if (!guard.ok) return guard;
  const session = guard.session;
  if (session.status !== "active" && session.status !== "paused") {
    return { ok: false, error: "session_not_pauseable" };
  }

  const newTimeUsed = nextTimeUsed(session, clientElapsedSeconds);
  const nowIso = new Date().toISOString();
  await supabase
    .from("exam_sessions")
    .update({
      status: "paused",
      paused_at: session.paused_at ?? nowIso,
      time_used_seconds: newTimeUsed,
      last_activity_at: nowIso,
    })
    .eq("id", sessionId);

  revalidatePath("/exam");
  return { ok: true, url: "/dashboard" };
}

// -----------------------------------------------------------------------------
// claimExamWindow — Phase 5 stub
// -----------------------------------------------------------------------------

export async function claimExamWindow(
  input: unknown
): Promise<{ ok: true; windowToken: string } | ExamActionFail> {
  const parsed = claimExamWindowInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  // Phase 5 implements: validate session ownership, mint a new
  // active_window_token via crypto.randomUUID, persist, return it.
  // For now return a sentinel so the WindowConflict UI can render a
  // "Phase 5 feature" disabled state instead of silently failing.
  return { ok: false, error: "not_implemented_yet" };
}
