"use server";

import { revalidatePath } from "next/cache";

import { deriveNoteIdentity } from "@/lib/db/notes";
import {
  getExistingAttempt,
  getQuestionForPosition,
  getSessionForUser,
} from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { practicePlayUrl, practiceSummaryUrl } from "@/lib/urls";
import {
  advanceToNextSchema,
  deleteNoteSchema,
  exitSessionSchema,
  saveNoteSchema,
  submitAttemptSchema,
  toggleBookmarkSchema,
} from "@/lib/validators/practice";

// =============================================================================
// Result types
// =============================================================================

type SubmitAttemptResult =
  | {
      ok: true;
      archived: false;
      isCorrect: boolean;
      correctChoiceId: string;
      correctLetter: "א" | "ב" | "ג" | "ד";
    }
  | { ok: true; archived: true }
  | { ok: false; error: string };

type AdvanceToNextResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type ToggleBookmarkResult =
  | { ok: true; bookmarked: boolean }
  | { ok: false; error: string };

type ExitSessionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// =============================================================================
// Helpers
// =============================================================================

/**
 * Clamps `duration_seconds` to the same range Zod's outer bound accepts
 * (0–600). Server-side defence: even if a client crafts a payload that
 * passes Zod, we don't store unbounded values.
 */
function clampDuration(s: number): number {
  return Math.max(0, Math.min(600, Math.round(s)));
}

async function authedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// =============================================================================
// submitAttempt
// =============================================================================

/**
 * Records the user's chosen letter for the question at `position`. Server
 * is the source of truth for correctness — never trust the client's idea
 * of `is_correct` or which letter is the right answer.
 *
 * Flow:
 *   1. Zod validate, authenticate, load session (must be active).
 *   2. Resolve the question at the position. If RLS hid it (archived
 *      mid-session), return {ok:true, archived:true} — the client will
 *      auto-advance with skip semantics, no attempt row is inserted.
 *   3. Match the selected letter to a choice. Derive isCorrect by
 *      comparing the chosen choice's id to the unique is_correct=true
 *      choice's id (cheaper than re-deriving from the letter and
 *      defends against duplicate letters in malformed seed data).
 *   4. INSERT attempts; the Phase 2.7 partial unique index makes the
 *      retry path safe — duplicate insert returns 23505, which we treat
 *      as "already submitted" and serve the existing row's verdict.
 *   5. Fire-and-log: increment_session_counters RPC (atomic) and
 *      record_mistake RPC (only on wrong answer). Neither is fatal —
 *      the attempt row is what the summary reads.
 *   6. revalidatePath layout → sidebar mistakes badge updates.
 */
export async function submitAttempt(
  input: unknown
): Promise<SubmitAttemptResult> {
  const parsed = submitAttemptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "טופס לא תקין" };
  }
  const { sessionId, position, selectedLetter, durationSeconds } = parsed.data;

  const { supabase, user } = await authedClient();
  if (!user) return { ok: false, error: "לא מחובר" };

  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "סשן לא נמצא" };
  if (session.status !== "active") {
    return { ok: false, error: "הסשן אינו פעיל" };
  }

  const resolved = await getQuestionForPosition(supabase, session, position);

  if (resolved.kind === "archived") {
    console.info(
      `[practice] submit_attempt archived user=${user.id} session=${sessionId} position=${position}`
    );
    return { ok: true, archived: true };
  }
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return { ok: false, error: "מיקום לא תקין" };
  }

  const chosenChoice = resolved.question.choices.find(
    (c) => c.letter === selectedLetter
  );
  if (!chosenChoice) {
    return { ok: false, error: "תשובה לא תקינה" };
  }
  const correctChoice = resolved.question.choices.find((c) => c.is_correct);
  if (!correctChoice) {
    // Defensive — every question should have exactly one is_correct
    // choice (enforced by idx_source_ch_one_correct partial unique
    // index). Surface as a server error rather than silently treating
    // the chosen choice as correct.
    console.error(
      `[practice] submit_attempt FAILED user=${user.id} session=${sessionId} position=${position} reason=no_correct_choice`
    );
    return { ok: false, error: "תקלה בנתוני השאלה" };
  }

  const isCorrect = chosenChoice.id === correctChoice.id;
  const isSource = resolved.kind === "source";
  const clampedDuration = clampDuration(durationSeconds);

  const { error: insertError } = await supabase.from("attempts").insert({
    user_id: user.id,
    question_type: isSource ? "source" : "angle",
    source_question_id: isSource ? resolved.question.id : null,
    angle_question_id: isSource ? null : resolved.question.id,
    selected_choice_id: chosenChoice.id,
    selected_letter: selectedLetter,
    is_correct: isCorrect,
    mode: "practice",
    practice_session_id: sessionId,
    duration_seconds: clampedDuration,
    was_skipped: false,
  });

  // 23505 = unique_violation. The Phase 2.7 partial unique index makes
  // double-submit safe: we fetch the existing attempt and return its
  // verdict so the client sees a consistent answer.
  if (insertError) {
    const code = (insertError as { code?: string }).code;
    if (code === "23505") {
      const existing = await getExistingAttempt(
        supabase,
        user.id,
        sessionId,
        resolved
      );
      if (existing && existing.is_correct !== null) {
        console.info(
          `[practice] submit_attempt IDEMPOTENT user=${user.id} session=${sessionId} position=${position}`
        );
        return {
          ok: true,
          archived: false,
          isCorrect: existing.is_correct,
          correctChoiceId: correctChoice.id,
          correctLetter: correctChoice.letter,
        };
      }
    }
    console.error(
      `[practice] submit_attempt FAILED user=${user.id} session=${sessionId} position=${position} code=${
        code ?? "unknown"
      } msg=${insertError.message}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }

  // Phase 5 perf: increment_session_counters and record_mistake are
  // independent RPCs after the attempt insert has succeeded. Run them in
  // parallel — saves one fra1↔Supabase round-trip (~5-10ms intra-region)
  // on every wrong answer, and is harmless on right answers (the
  // record_mistake side resolves to a passthrough no-op promise).
  const incrPromise = supabase.rpc("increment_session_counters", {
    p_session_id: sessionId,
    p_was_correct: isCorrect,
  });

  const mistakePromise = isCorrect
    ? Promise.resolve({ error: null as { message: string; code?: string } | null })
    : isSource
      ? supabase.rpc("record_mistake", {
          p_question_type: "source",
          p_source_question_group_id: resolved.question.question_group_id,
          p_angle_question_id: null,
        })
      : supabase.rpc("record_mistake", {
          p_question_type: "angle",
          p_source_question_group_id: null,
          p_angle_question_id: resolved.question.id,
        });

  const [incrResult, mistakeResult] = await Promise.all([
    incrPromise,
    mistakePromise,
  ]);

  if (incrResult.error) {
    // Non-fatal — attempt row is the source of truth for summary counts.
    console.error(
      `[practice] increment_session_counters FAILED session=${sessionId} code=${
        (incrResult.error as { code?: string }).code ?? "unknown"
      } msg=${incrResult.error.message}`
    );
  }
  if (mistakeResult.error) {
    console.error(
      `[practice] record_mistake FAILED session=${sessionId} position=${position} code=${
        (mistakeResult.error as { code?: string }).code ?? "unknown"
      } msg=${mistakeResult.error.message}`
    );
  }

  revalidatePath("/", "layout");

  console.info(
    `[practice] submit_attempt OK user=${user.id} session=${sessionId} position=${position} is_correct=${isCorrect} letter=${selectedLetter} duration=${clampedDuration}`
  );

  return {
    ok: true,
    archived: false,
    isCorrect,
    correctChoiceId: correctChoice.id,
    correctLetter: correctChoice.letter,
  };
}

// =============================================================================
// advanceToNext
// =============================================================================

/**
 * Advances the user from `fromPosition` to either the next question's
 * URL or the summary URL (if `fromPosition` was the last item). When
 * the session has reached completion, the row is flipped to
 * status='completed' and `completed_at` is set — this is the canonical
 * completion path (the manual "סיים סשן" CTA is the only other way to
 * complete, via exitSession below).
 */
export async function advanceToNext(
  input: unknown
): Promise<AdvanceToNextResult> {
  const parsed = advanceToNextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "טופס לא תקין" };
  const { sessionId, fromPosition } = parsed.data;

  const { supabase, user } = await authedClient();
  if (!user) return { ok: false, error: "לא מחובר" };

  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "סשן לא נמצא" };

  // Completed/abandoned sessions: idempotent route — return the summary
  // URL so the client navigates there.
  if (session.status === "completed") {
    return { ok: true, url: practiceSummaryUrl(sessionId) };
  }
  if (session.status === "abandoned") {
    return { ok: true, url: "/practice" };
  }

  const nextPosition = fromPosition + 1;

  if (nextPosition >= session.question_list.length) {
    const { error: updErr } = await supabase
      .from("practice_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);
    if (updErr) {
      console.error(
        `[practice] advance_complete FAILED session=${sessionId} code=${
          (updErr as { code?: string }).code ?? "unknown"
        } msg=${updErr.message}`
      );
      return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
    }
    revalidatePath("/", "layout");
    console.info(
      `[practice] advance_to_next OK user=${user.id} session=${sessionId} from=${fromPosition} to=summary`
    );
    return { ok: true, url: practiceSummaryUrl(sessionId) };
  }

  console.info(
    `[practice] advance_to_next OK user=${user.id} session=${sessionId} from=${fromPosition} to=${nextPosition}`
  );
  return { ok: true, url: practicePlayUrl(sessionId, nextPosition) };
}

// =============================================================================
// toggleBookmark
// =============================================================================

/**
 * Toggles the bookmark for the question at (sessionId, position). The
 * server resolves the position → question type + ids; the client never
 * sends `source_question_group_id` or `angle_question_id` directly.
 *
 * Per B1: source bookmarks target the `question_group_id`; angle
 * bookmarks target the angle's own id. The record_bookmark_toggle RPC
 * (Phase 2.7) handles the ON CONFLICT logic against the partial unique
 * indexes from Phase 0.5.
 */
export async function toggleBookmark(
  input: unknown
): Promise<ToggleBookmarkResult> {
  const parsed = toggleBookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "טופס לא תקין" };
  const { sessionId, position } = parsed.data;

  const { supabase, user } = await authedClient();
  if (!user) return { ok: false, error: "לא מחובר" };

  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "סשן לא נמצא" };

  const resolved = await getQuestionForPosition(supabase, session, position);
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return { ok: false, error: "מיקום לא תקין" };
  }

  let bookmarked: boolean;
  if (resolved.kind === "source") {
    const { data, error } = await supabase.rpc("record_bookmark_toggle", {
      p_question_type: "source",
      p_source_question_group_id: resolved.question.question_group_id,
      p_angle_question_id: null,
    });
    if (error) {
      console.error(
        `[practice] toggle_bookmark source FAILED session=${sessionId} position=${position} code=${
          (error as { code?: string }).code ?? "unknown"
        } msg=${error.message}`
      );
      return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
    }
    bookmarked = Boolean(data);
  } else {
    const { data, error } = await supabase.rpc("record_bookmark_toggle", {
      p_question_type: "angle",
      p_source_question_group_id: null,
      p_angle_question_id: resolved.question.id,
    });
    if (error) {
      console.error(
        `[practice] toggle_bookmark angle FAILED session=${sessionId} position=${position} code=${
          (error as { code?: string }).code ?? "unknown"
        } msg=${error.message}`
      );
      return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
    }
    bookmarked = Boolean(data);
  }

  revalidatePath("/", "layout");
  console.info(
    `[practice] toggle_bookmark OK user=${user.id} session=${sessionId} target=${resolved.kind} new_state=${bookmarked}`
  );
  return { ok: true, bookmarked };
}

// =============================================================================
// exitSession
// =============================================================================

/**
 * Manual exit from the topbar "סיים סשן" CTA.
 *   - answered > 0 → status='completed', completed_at=NOW(), redirect to summary
 *   - answered = 0 → status='abandoned', redirect to /practice (no summary)
 * Idempotent on already-completed sessions: returns the summary URL.
 */
export async function exitSession(input: unknown): Promise<ExitSessionResult> {
  const parsed = exitSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "טופס לא תקין" };
  const { sessionId } = parsed.data;

  const { supabase, user } = await authedClient();
  if (!user) return { ok: false, error: "לא מחובר" };

  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "סשן לא נמצא" };

  if (session.status === "completed") {
    return { ok: true, url: practiceSummaryUrl(sessionId) };
  }
  if (session.status === "abandoned") {
    return { ok: true, url: "/practice" };
  }

  const isCompletion = session.questions_answered > 0;
  const newStatus: "completed" | "abandoned" = isCompletion
    ? "completed"
    : "abandoned";
  const completedAt = isCompletion ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("practice_sessions")
    .update({
      status: newStatus,
      completed_at: completedAt,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    console.error(
      `[practice] exit_session FAILED session=${sessionId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }

  revalidatePath("/", "layout");
  console.info(
    `[practice] exit_session OK user=${user.id} session=${sessionId} status=${newStatus} answered=${session.questions_answered}`
  );

  return {
    ok: true,
    url: isCompletion ? practiceSummaryUrl(sessionId) : "/practice",
  };
}

// =============================================================================
// saveNote / deleteNote — Slice 25 B-1
// =============================================================================

type SaveNoteResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

type DeleteNoteResult = { ok: true } | { ok: false; error: string };

/**
 * UPSERT the user's note for the question at (sessionId, position).
 * The server resolves the position → `(question_type,
 * source_question_group_id, angle_position)` triple; the client
 * never sends those columns directly (same defensive pattern as
 * `toggleBookmark`).
 *
 * The DB UNIQUE constraint
 *   (user_id, question_type, source_question_group_id, angle_position)
 * is the conflict target. supabase-js's `.upsert(..., {
 * onConflict: "..." })` handles the INSERT-vs-UPDATE branch atomically.
 *
 * RLS (`users_own_notes`) already gates this on
 * `auth.uid() = user_id AND has_active_subscription()`, so an
 * expired-sub user fails CLOSED at the DB level — even if the UI
 * trigger somehow leaked through. We don't recheck subscription in
 * application code.
 */
export async function saveNote(input: unknown): Promise<SaveNoteResult> {
  const parsed = saveNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "טופס לא תקין" };
  const { sessionId, position, contentJson, contentHtml } = parsed.data;

  const { supabase, user } = await authedClient();
  if (!user) return { ok: false, error: "לא מחובר" };

  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "סשן לא נמצא" };

  const resolved = await getQuestionForPosition(supabase, session, position);
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return { ok: false, error: "מיקום לא תקין" };
  }
  const identity = deriveNoteIdentity(resolved);
  if (!identity) {
    console.error(
      `[practice] save_note IDENTITY_FAILED user=${user.id} session=${sessionId} position=${position} kind=${resolved.kind}`
    );
    return { ok: false, error: "מיקום לא תקין" };
  }

  const { data, error } = await supabase
    .from("question_notes")
    .upsert(
      {
        user_id: user.id,
        question_type: identity.question_type,
        source_question_group_id: identity.source_question_group_id,
        angle_position: identity.angle_position,
        content_json: contentJson,
        content_html: contentHtml,
      },
      {
        onConflict:
          "user_id,question_type,source_question_group_id,angle_position",
      }
    )
    .select("updated_at")
    .single();

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;
    console.error(
      `[practice] save_note FAILED user=${user.id} session=${sessionId} position=${position} code=${
        code ?? "unknown"
      } msg=${error?.message ?? "no data"}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }

  console.info(
    `[practice] save_note OK user=${user.id} session=${sessionId} position=${position} type=${identity.question_type}`
  );

  return { ok: true, updatedAt: data.updated_at as string };
}

/**
 * Delete the user's note for the question at (sessionId, position).
 * Idempotent — silently succeeds when no note exists. Same identity
 * derivation as `saveNote`.
 */
export async function deleteNote(input: unknown): Promise<DeleteNoteResult> {
  const parsed = deleteNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "טופס לא תקין" };
  const { sessionId, position } = parsed.data;

  const { supabase, user } = await authedClient();
  if (!user) return { ok: false, error: "לא מחובר" };

  const session = await getSessionForUser(supabase, user.id, sessionId);
  if (!session) return { ok: false, error: "סשן לא נמצא" };

  const resolved = await getQuestionForPosition(supabase, session, position);
  if (resolved.kind !== "source" && resolved.kind !== "angle") {
    return { ok: false, error: "מיקום לא תקין" };
  }
  const identity = deriveNoteIdentity(resolved);
  if (!identity) return { ok: false, error: "מיקום לא תקין" };

  let q = supabase
    .from("question_notes")
    .delete()
    .eq("user_id", user.id)
    .eq("question_type", identity.question_type)
    .eq("source_question_group_id", identity.source_question_group_id);
  q =
    identity.angle_position === null
      ? q.is("angle_position", null)
      : q.eq("angle_position", identity.angle_position);

  const { error } = await q;
  if (error) {
    console.error(
      `[practice] delete_note FAILED user=${user.id} session=${sessionId} position=${position} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "התרחשה שגיאה. נסה שוב" };
  }
  console.info(
    `[practice] delete_note OK user=${user.id} session=${sessionId} position=${position}`
  );
  return { ok: true };
}
