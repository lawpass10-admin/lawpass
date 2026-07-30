"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getExamSessionById,
  getQuestionForExamPosition,
  sampleExamQuestions,
} from "@/lib/db/exam";
import { EXAM_TOTAL_DURATION_SECONDS } from "@/lib/exam/clusters";
import { createClient } from "@/lib/supabase/server";
import { examPlayUrl, examResultsUrl } from "@/lib/urls";
import {
  abandonAndExitExamInput,
  claimExamWindowInput,
  createExamSessionInput,
  pauseExamInput,
  resumeExamInput,
  skipExamQuestionInput,
  submitExamAttemptInput,
  submitFinalExamInput,
  toggleExamBookmarkInput,
} from "@/lib/validators/exam";

// =============================================================================
// Common types
// =============================================================================

type ExamActionFail = { ok: false; error: string };

/**
 * Shape every Phase 5 RPC returns. Validation/typed-error responses
 * land as { ok: false, error_code }; success carries the payload. Action
 * wrappers map error_code into their typed failure shape.
 */
type RpcEnvelope<Payload> =
  | ({ ok: true } & Payload)
  | { ok: false; error_code: string };

function asEnvelope<P>(data: unknown): RpcEnvelope<P> | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.ok === true) return data as RpcEnvelope<P>;
  if (obj.ok === false && typeof obj.error_code === "string") {
    return { ok: false, error_code: obj.error_code };
  }
  return null;
}

// =============================================================================
// createExamSession
// =============================================================================

type CreateExamSessionResult =
  | { ok: true; url: string; sessionId: string; windowToken: string }
  | { ok: false; error: string };

/**
 * Mint a new exam session. Slice 9 — the only client input is `mode`,
 * which selects the sampling pool + cluster config:
 *   - procedural: 40 procedural Qs (existing behaviour).
 *   - substantive: 40 substantive Qs (Slice 9).
 *   - combined: 20 procedural + 20 substantive (Slice 9).
 *
 * Steps:
 *   1. Validate input via zod (rejects unknown modes — DB CHECK adds
 *      defense in depth).
 *   2. Abandon any prior active/paused session for the caller.
 *   3. Sample 40 questions via the cluster-weighted sampler in the
 *      requested mode.
 *   4. Mint an `active_window_token` and INSERT the row with `mode`.
 *   5. revalidatePath layout (so the resume modal on `/exam` re-fetches).
 *   6. Return the play URL + sessionId + windowToken.
 */
export async function createExamSession(
  input: unknown
): Promise<CreateExamSessionResult> {
  const parsed = createExamSessionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { mode } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  try {
    await supabase
      .from("exam_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .in("status", ["active", "paused"]);

    const questionList = await sampleExamQuestions(supabase, mode);
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
        mode,
      })
      .select("id, active_window_token")
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error("insert_returned_no_row");
    }

    console.info(
      `[exam] create_session OK user=${user.id} session=${inserted.id} ` +
        `mode=${mode} items=${questionList.length}`
    );

    revalidatePath("/", "layout");

    return {
      ok: true,
      url: examPlayUrl(inserted.id, 0),
      sessionId: inserted.id,
      windowToken: inserted.active_window_token,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(
      `[exam] create_session FAILED user=${user.id} mode=${mode} code=${
        code ?? "unknown"
      } message=${message}`
    );
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
 * Soft-cancel any in-flight exam session for the caller. Used by the
 * resume modal's "התחל בחינה חדשה" button. Idempotent.
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
    console.error("[exam] abandon_active failed", {
      userId: user.id,
      code: (error as { code?: string }).code,
      message: error.message,
    });
    return { ok: false, error: "abandon_active_failed" };
  }

  revalidatePath("/exam");
  return { ok: true };
}

// =============================================================================
// Phase 3 / Phase 5 — gameplay actions
// =============================================================================
//
// Phase 5 refactor (per SLICE_3_TIMER_AUDIT.md §3+§4): each action is a
// thin wrapper around a single SECURITY DEFINER RPC. The RPCs handle
// auth, token validation, attempt UPSERT (where applicable), counter
// recompute, and time math — all in one transaction with a row lock.
// No float math crosses the wire and no read-modify-write race remains.

// -----------------------------------------------------------------------------
// submitExamAttempt
// -----------------------------------------------------------------------------

type SubmitExamAttemptResult =
  | { ok: true; remaining_seconds: number; is_correct: boolean }
  | ExamActionFail;

/**
 * Record (or overwrite) the user's answer at `position`. Server derives
 * correctness from the question's `is_correct` choice — never trust the
 * client. The RPC handles UPSERT (partial-index ON CONFLICT) + counter
 * recompute + time bump atomically.
 */
export async function submitExamAttempt(
  input: unknown
): Promise<SubmitExamAttemptResult> {
  const parsed = submitExamAttemptInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken, position, selectedLetter } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const session = await getExamSessionById(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "session_not_found" };

  const item = session.question_list[position];
  if (!item) return { ok: false, error: "position_out_of_range" };

  const resolved = await getQuestionForExamPosition(supabase, item);
  if (resolved.kind === "archived") {
    return { ok: false, error: "question_archived" };
  }
  const choices = resolved.question.choices;
  const chosen = choices.find((c) => c.letter === selectedLetter);
  const correctChoice = choices.find((c) => c.is_correct);
  if (!chosen || !correctChoice) {
    return { ok: false, error: "invalid_choice_data" };
  }
  const isCorrect = chosen.id === correctChoice.id;
  const isSource = resolved.kind === "source";

  const { data, error } = await supabase.rpc("submit_exam_answer", {
    p_session_id: sessionId,
    p_window_token: windowToken,
    p_question_type: isSource ? "source" : "angle",
    p_source_question_id: isSource ? item.question_id : null,
    p_angle_question_id: isSource ? null : item.question_id,
    p_selected_choice_id: chosen.id,
    p_selected_letter: selectedLetter,
    p_is_correct: isCorrect,
    p_was_skipped: false,
  });

  const env = asEnvelope<{ remaining_seconds: number }>(data);
  if (error || !env) {
    console.error("[exam] submit_exam_answer RPC failed", {
      sessionId,
      position,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "rpc_failed" };
  }
  if (!env.ok) return { ok: false, error: env.error_code };

  return {
    ok: true,
    remaining_seconds: env.remaining_seconds,
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
  const { sessionId, windowToken, position } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const session = await getExamSessionById(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "session_not_found" };

  const item = session.question_list[position];
  if (!item) return { ok: false, error: "position_out_of_range" };

  const isSource = item.question_type === "source";

  const { data, error } = await supabase.rpc("submit_exam_answer", {
    p_session_id: sessionId,
    p_window_token: windowToken,
    p_question_type: isSource ? "source" : "angle",
    p_source_question_id: isSource ? item.question_id : null,
    p_angle_question_id: isSource ? null : item.question_id,
    p_selected_choice_id: null,
    p_selected_letter: null,
    p_is_correct: null,
    p_was_skipped: true,
  });

  const env = asEnvelope<{ remaining_seconds: number }>(data);
  if (error || !env) {
    console.error("[exam] skip RPC failed", {
      sessionId,
      position,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "rpc_failed" };
  }
  if (!env.ok) return { ok: false, error: env.error_code };

  return { ok: true, remaining_seconds: env.remaining_seconds };
}

// -----------------------------------------------------------------------------
// pauseExam / resumeExam
// -----------------------------------------------------------------------------

type PauseExamResult = { ok: true } | ExamActionFail;

export async function pauseExam(input: unknown): Promise<PauseExamResult> {
  const parsed = pauseExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken } = parsed.data;

  await requireActiveSubscription();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("bump_exam_session_time", {
    p_session_id: sessionId,
    p_window_token: windowToken,
    p_new_status: "paused",
  });

  const env = asEnvelope<{ remaining_seconds: number }>(data);
  if (error || !env) {
    console.error("[exam] pause RPC failed", {
      sessionId,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "rpc_failed" };
  }
  if (!env.ok) return { ok: false, error: env.error_code };

  return { ok: true };
}

type ResumeExamResult =
  | { ok: true; remaining_seconds: number }
  | ExamActionFail;

export async function resumeExam(input: unknown): Promise<ResumeExamResult> {
  const parsed = resumeExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken } = parsed.data;

  await requireActiveSubscription();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("resume_exam_session", {
    p_session_id: sessionId,
    p_window_token: windowToken,
  });

  const env = asEnvelope<{ remaining_seconds: number }>(data);
  if (error || !env) {
    console.error("[exam] resume RPC failed", {
      sessionId,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "rpc_failed" };
  }
  if (!env.ok) return { ok: false, error: env.error_code };

  return { ok: true, remaining_seconds: env.remaining_seconds };
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

  // Bookmark toggle still validates the window token client-flow-side
  // by going through getExamSessionById and comparing. The action is
  // read-only on session state otherwise, so it doesn't go through the
  // Phase 5 RPCs.
  const session = await getExamSessionById(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "session_not_found" };
  if (session.active_window_token !== windowToken) {
    return { ok: false, error: "window_conflict" };
  }

  const item = session.question_list[position];
  if (!item) return { ok: false, error: "position_out_of_range" };

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
    console.error("[exam] toggle_bookmark failed", {
      sessionId,
      position,
      message: error.message,
    });
    return { ok: false, error: "rpc_failed" };
  }

  revalidatePath("/", "layout");
  return { ok: true, bookmarked: Boolean(data) };
}

// -----------------------------------------------------------------------------
// submitFinalExam
// -----------------------------------------------------------------------------

type SubmitFinalExamResult = { ok: true; url: string } | ExamActionFail;

/**
 * Compute final_score / passed, flip status, return the results URL.
 * Idempotent — RPC returns the existing terminal state if status is
 * already 'completed'.
 */
export async function submitFinalExam(
  input: unknown
): Promise<SubmitFinalExamResult> {
  const parsed = submitFinalExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken } = parsed.data;

  await requireActiveSubscription();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_final_exam", {
    p_session_id: sessionId,
    p_window_token: windowToken,
  });

  const env = asEnvelope<{
    final_score: number;
    passed: boolean;
    already_completed: boolean;
  }>(data);
  if (error || !env) {
    console.error("[exam] submit_final RPC failed", {
      sessionId,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "rpc_failed" };
  }
  if (!env.ok) return { ok: false, error: env.error_code };

  revalidatePath("/", "layout");
  return { ok: true, url: examResultsUrl(sessionId) };
}

// -----------------------------------------------------------------------------
// abandonAndExitExam — pause + redirect to dashboard
// -----------------------------------------------------------------------------

type AbandonAndExitExamResult = { ok: true; url: string } | ExamActionFail;

/**
 * Pause + leave. The DB transition is to 'paused' so the user can come
 * back via the resume modal. PM-confirmed: "save & exit" UX.
 */
export async function abandonAndExitExam(
  input: unknown
): Promise<AbandonAndExitExamResult> {
  const parsed = abandonAndExitExamInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId, windowToken } = parsed.data;

  await requireActiveSubscription();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("bump_exam_session_time", {
    p_session_id: sessionId,
    p_window_token: windowToken,
    p_new_status: "paused",
  });

  const env = asEnvelope<{ remaining_seconds: number }>(data);
  if (error || !env) {
    console.error("[exam] abandon_and_exit RPC failed", {
      sessionId,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "rpc_failed" };
  }
  if (!env.ok) return { ok: false, error: env.error_code };

  revalidatePath("/exam");
  return { ok: true, url: "/dashboard" };
}

// -----------------------------------------------------------------------------
// claimExamWindow
// -----------------------------------------------------------------------------

type ClaimExamWindowResult =
  | { ok: true; windowToken: string; url: string }
  | ExamActionFail;

/**
 * Phase 5 — single-window guard activation.
 *
 * The user clicked "העבר לחלון הזה" in `<WindowConflict />`. Mint a
 * fresh `active_window_token`, invalidating the prior tab's stored
 * value. The prior tab's next server action will fail with
 * 'window_conflict'; the storage event listener in `<ExamQuestion>`
 * surfaces the conflict screen proactively.
 *
 * Returns the play URL (positioned at `questions_answered` so the user
 * resumes mid-flight, mirroring `<ResumePrompt>`'s resume target).
 */
export async function claimExamWindow(
  input: unknown
): Promise<ClaimExamWindowResult> {
  const parsed = claimExamWindowInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { sessionId } = parsed.data;

  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const newToken = randomUUID();
  const { data, error } = await supabase
    .from("exam_sessions")
    .update({
      active_window_token: newToken,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .in("status", ["active", "paused"])
    .select("id, questions_answered")
    .single();

  if (error || !data) {
    console.error("[exam] claim_window failed", {
      sessionId,
      code: (error as { code?: string } | null)?.code,
      message: error?.message,
    });
    return { ok: false, error: "claim_failed" };
  }

  revalidatePath("/exam");
  return {
    ok: true,
    windowToken: newToken,
    url: examPlayUrl(data.id, data.questions_answered),
  };
}
