"use strict";

// Ported from ../../app/(app)/exam/_actions.ts. Gameplay actions are thin
// wrappers around SECURITY DEFINER RPCs (submit_exam_answer,
// bump_exam_session_time, resume_exam_session, submit_final_exam) that do
// auth + token validation + time math atomically. `revalidatePath` dropped.
// Error strings are CODES (frontend maps them to Hebrew), so validation
// failures return the fixed "invalid_input" code — matching the actions.

const { randomUUID } = require("node:crypto");

const db = require("../db/exam");
const { EXAM_TOTAL_DURATION_SECONDS } = require("../constants/exam");

// URL helpers (from ../../lib/urls.ts).
function examPlayUrl(sessionId, position) {
  return `/exam/play/${position}?session=${sessionId}`;
}
function examResultsUrl(sessionId) {
  return `/exam/results/${sessionId}`;
}

/**
 * Every Phase 5 RPC returns this envelope: { ok:true, ...payload } or
 * { ok:false, error_code }. Returns null when the shape is unrecognized.
 */
function asEnvelope(data) {
  if (!data || typeof data !== "object") return null;
  if (data.ok === true) return data;
  if (data.ok === false && typeof data.error_code === "string") {
    return { ok: false, error_code: data.error_code };
  }
  return null;
}

// =============================================================================
// createExamSession
// =============================================================================

async function createExamSession(req, res) {
  const { mode } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  try {
    await supabase
      .from("exam_sessions")
      .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .in("status", ["active", "paused"]);

    const questionList = await db.sampleExamQuestions(supabase, mode);
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
      `[exam] create_session OK user=${user.id} session=${inserted.id} mode=${mode} items=${questionList.length}`
    );

    return res.json({
      ok: true,
      url: examPlayUrl(inserted.id, 0),
      sessionId: inserted.id,
      windowToken: inserted.active_window_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && err.code;
    console.error(
      `[exam] create_session FAILED user=${user.id} mode=${mode} code=${code ?? "unknown"} message=${message}`
    );
    if (message === "exam_pool_insufficient") {
      return res.json({ ok: false, error: "exam_pool_insufficient" });
    }
    return res.json({ ok: false, error: "create_exam_session_failed" });
  }
}

async function abandonActiveExamSession(req, res) {
  const supabase = req.supabase;
  const user = req.user;

  const { error } = await supabase
    .from("exam_sessions")
    .update({ status: "abandoned", last_activity_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("status", ["active", "paused"]);

  if (error) {
    console.error("[exam] abandon_active failed", {
      userId: user.id,
      code: error.code,
      message: error.message,
    });
    return res.json({ ok: false, error: "abandon_active_failed" });
  }

  return res.json({ ok: true });
}

// =============================================================================
// Gameplay
// =============================================================================

async function submitExamAttempt(req, res) {
  const { sessionId, windowToken, position, selectedLetter } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  const session = await db.getExamSessionById(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "session_not_found" });

  const item = session.question_list[position];
  if (!item) return res.json({ ok: false, error: "position_out_of_range" });

  const resolved = await db.getQuestionForExamPosition(supabase, item);
  if (resolved.kind === "archived") {
    return res.json({ ok: false, error: "question_archived" });
  }
  const choices = resolved.question.choices;
  const chosen = choices.find((c) => c.letter === selectedLetter);
  const correctChoice = choices.find((c) => c.is_correct);
  if (!chosen || !correctChoice) {
    return res.json({ ok: false, error: "invalid_choice_data" });
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

  const env = asEnvelope(data);
  if (error || !env) {
    console.error("[exam] submit_exam_answer RPC failed", {
      sessionId,
      position,
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "rpc_failed" });
  }
  if (!env.ok) return res.json({ ok: false, error: env.error_code });

  return res.json({
    ok: true,
    remaining_seconds: env.remaining_seconds,
    is_correct: isCorrect,
  });
}

async function skipExamQuestion(req, res) {
  const { sessionId, windowToken, position } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  const session = await db.getExamSessionById(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "session_not_found" });

  const item = session.question_list[position];
  if (!item) return res.json({ ok: false, error: "position_out_of_range" });

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

  const env = asEnvelope(data);
  if (error || !env) {
    console.error("[exam] skip RPC failed", {
      sessionId,
      position,
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "rpc_failed" });
  }
  if (!env.ok) return res.json({ ok: false, error: env.error_code });

  return res.json({ ok: true, remaining_seconds: env.remaining_seconds });
}

async function pauseExam(req, res) {
  const { sessionId, windowToken } = req.valid;

  const { data, error } = await req.supabase.rpc("bump_exam_session_time", {
    p_session_id: sessionId,
    p_window_token: windowToken,
    p_new_status: "paused",
  });

  const env = asEnvelope(data);
  if (error || !env) {
    console.error("[exam] pause RPC failed", {
      sessionId,
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "rpc_failed" });
  }
  if (!env.ok) return res.json({ ok: false, error: env.error_code });

  return res.json({ ok: true });
}

async function resumeExam(req, res) {
  const { sessionId, windowToken } = req.valid;

  const { data, error } = await req.supabase.rpc("resume_exam_session", {
    p_session_id: sessionId,
    p_window_token: windowToken,
  });

  const env = asEnvelope(data);
  if (error || !env) {
    console.error("[exam] resume RPC failed", {
      sessionId,
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "rpc_failed" });
  }
  if (!env.ok) return res.json({ ok: false, error: env.error_code });

  return res.json({ ok: true, remaining_seconds: env.remaining_seconds });
}

async function toggleExamBookmark(req, res) {
  const { sessionId, windowToken, position } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

  const session = await db.getExamSessionById(supabase, user.id, sessionId);
  if (!session) return res.json({ ok: false, error: "session_not_found" });
  if (session.active_window_token !== windowToken) {
    return res.json({ ok: false, error: "window_conflict" });
  }

  const item = session.question_list[position];
  if (!item) return res.json({ ok: false, error: "position_out_of_range" });

  const resolved = await db.getQuestionForExamPosition(supabase, item);
  if (resolved.kind === "archived") {
    return res.json({ ok: false, error: "question_archived" });
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
    return res.json({ ok: false, error: "rpc_failed" });
  }

  return res.json({ ok: true, bookmarked: Boolean(data) });
}

async function submitFinalExam(req, res) {
  const { sessionId, windowToken } = req.valid;

  const { data, error } = await req.supabase.rpc("submit_final_exam", {
    p_session_id: sessionId,
    p_window_token: windowToken,
  });

  const env = asEnvelope(data);
  if (error || !env) {
    console.error("[exam] submit_final RPC failed", {
      sessionId,
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "rpc_failed" });
  }
  if (!env.ok) return res.json({ ok: false, error: env.error_code });

  return res.json({ ok: true, url: examResultsUrl(sessionId) });
}

async function abandonAndExitExam(req, res) {
  const { sessionId, windowToken } = req.valid;

  const { data, error } = await req.supabase.rpc("bump_exam_session_time", {
    p_session_id: sessionId,
    p_window_token: windowToken,
    p_new_status: "paused",
  });

  const env = asEnvelope(data);
  if (error || !env) {
    console.error("[exam] abandon_and_exit RPC failed", {
      sessionId,
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "rpc_failed" });
  }
  if (!env.ok) return res.json({ ok: false, error: env.error_code });

  return res.json({ ok: true, url: "/dashboard" });
}

async function claimExamWindow(req, res) {
  const { sessionId } = req.valid;
  const supabase = req.supabase;
  const user = req.user;

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
      code: error && error.code,
      message: error && error.message,
    });
    return res.json({ ok: false, error: "claim_failed" });
  }

  return res.json({
    ok: true,
    windowToken: newToken,
    url: examPlayUrl(data.id, data.questions_answered),
  });
}

module.exports = {
  createExamSession,
  abandonActiveExamSession,
  submitExamAttempt,
  skipExamQuestion,
  pauseExam,
  resumeExam,
  toggleExamBookmark,
  submitFinalExam,
  abandonAndExitExam,
  claimExamWindow,
};
