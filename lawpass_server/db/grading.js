"use strict";

// Data access for grading a writing-task submission.
//
// EVERY QUERY HERE RUNS UNDER THE SERVICE-ROLE CLIENT, and that is deliberate
// rather than convenient. The grader needs three things a student may not read
// (the rubric, our model answer, the writer-only question fields) in order to
// mark one thing a student owns (their answer), and it runs with no user session
// at all — a background worker has no token to scope. Authorization is therefore
// this file's own business: nothing here takes a user id from a caller, and the
// only row it ever writes is the answer row it was handed.

/**
 * Everything needed to mark one submission, in one round trip.
 *
 * Returns null when the answer does not exist, and a `blocked` reason when it
 * exists but cannot be marked — no approved rubric, most often. Those are
 * different outcomes: the first is a bad id, the second is a question nobody
 * finished setting up, and the worker reports them differently.
 */
async function getGradingContext(admin, answerId) {
  const { data: answer, error } = await admin
    .from("open_question_answers")
    .select(
      // hand_writing is here so the runner can tell an EMPTY submission from a
      // photographed one. Both have no text; only one of them is a mistake.
      "answer_id, user_id, open_question_id, answer_body, hand_writing, attempt_number, grading_status, score, created_at"
    )
    .eq("answer_id", answerId)
    .maybeSingle();

  if (error) throw error;
  if (!answer) return null;

  const { data: question, error: qErr } = await admin
    .from("open_questions")
    .select("open_question_id, question, answers, subject")
    .eq("open_question_id", answer.open_question_id)
    .maybeSingle();

  if (qErr) throw qErr;
  if (!question) return { answer, blocked: "the question this answer belongs to no longer exists" };

  const { data: rubricRow, error: rErr } = await admin
    .from("open_question_rubrics")
    .select("rubric_id, rubric, version")
    .eq("open_question_id", answer.open_question_id)
    .eq("status", "approved")
    .maybeSingle();

  if (rErr) throw rErr;
  if (!rubricRow) {
    return {
      answer,
      question,
      blocked: "this question has no approved rubric — generate one and load it with --approve",
    };
  }

  return {
    answer,
    question: question.question,
    modelAnswer: question.answers,
    rubric: rubricRow.rubric,
    rubricId: rubricRow.rubric_id,
    rubricVersion: rubricRow.version,
  };
}

/**
 * Move one submission from `pending` to `grading`, and report whether we got it.
 *
 * The status is part of the WHERE clause, not just the SET: two workers racing
 * for the same row both issue this update, and only the one that arrives while
 * the row still says `pending` gets a row back. The loser sees zero rows and
 * moves on rather than paying for a second marking of an answer already in hand.
 */
async function claimForGrading(admin, answerId) {
  const { data, error } = await admin
    .from("open_question_answers")
    .update({ grading_status: "grading", grading_error: null })
    .eq("answer_id", answerId)
    .eq("grading_status", "pending")
    .select("answer_id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Oldest first — a student who submitted an hour ago waited longest. */
async function listPendingAnswers(admin, limit = 20) {
  const { data, error } = await admin
    .from("open_question_answers")
    .select("answer_id, open_question_id, attempt_number, created_at")
    .eq("grading_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Rows stuck in `grading` because the worker died mid-call. Nothing else clears
 * them: the claim is what makes concurrent grading safe, so it has to outlive
 * the process that took it, and only a timeout can tell a crashed run from a
 * slow one.
 */
async function listStaleClaims(admin, olderThanMinutes = 15) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("open_question_answers")
    .select("answer_id, created_at")
    .eq("grading_status", "grading")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function releaseClaim(admin, answerId) {
  const { error } = await admin
    .from("open_question_answers")
    .update({ grading_status: "pending" })
    .eq("answer_id", answerId)
    .eq("grading_status", "grading");
  if (error) throw error;
}

async function saveScore(admin, answerId, { score, rubricId }) {
  const { error } = await admin
    .from("open_question_answers")
    .update({
      score,
      grading_status: "graded",
      graded_at: new Date().toISOString(),
      graded_with_rubric_id: rubricId,
      grading_error: null,
    })
    .eq("answer_id", answerId);

  if (error) throw error;
}

/**
 * The answer text stays; only the marking failed. A failed row is retryable by
 * moving it back to `pending`, which is why the message is stored rather than
 * just logged — whoever retries needs to know what went wrong last time.
 */
async function markGradingFailed(admin, answerId, message) {
  const { error } = await admin
    .from("open_question_answers")
    .update({
      grading_status: "failed",
      grading_error: String(message || "unknown error").slice(0, 2000),
    })
    .eq("answer_id", answerId);

  if (error) throw error;
}

module.exports = {
  getGradingContext,
  claimForGrading,
  listPendingAnswers,
  listStaleClaims,
  releaseClaim,
  saveScore,
  markGradingFailed,
};
