"use strict";

// Data access for דיון מהותי sittings — public.mahoti_answers, plus the one
// read of public.mahoti_questions that marking needs.
//
// ── Why the admin client, and not the caller's RLS client ──────────────────
// mahoti_questions is admin-only under RLS (20260823000003): it is authoring
// content, and the candidate's own paper is served to them through the same
// service-role bypass on the Next.js side (see lib/db/mahoti.ts, which explains
// it at length). The answer key lives in that table, so marking cannot happen
// under the student's own client — it would read nothing.
//
// mahoti_answers is the other half of the same decision: the student may SELECT
// their own rows, but there is no INSERT policy and no INSERT grant for
// `authenticated` at all, because a caller who can insert their own row can
// insert their own score. Every write here therefore goes through the admin
// client, and the ownership that RLS would otherwise enforce is enforced by the
// controller passing req.user.id and nothing else.

const MAHOTI_QUESTIONS = "mahoti_questions";
const MAHOTI_ANSWERS = "mahoti_answers";

/**
 * The answer key for one paper: every question's number and its correct
 * letter, in the order the paper stores them.
 *
 * Returns null when the paper does not exist or has no questions yet — a row
 * is written notebook-first, so `questions IS NULL` is a normal intermediate
 * state rather than an error.
 */
async function getAnswerKey(admin, questionId) {
  const { data, error } = await admin
    .from(MAHOTI_QUESTIONS)
    .select("question_id, questions")
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) throw error;

  const questions = data?.questions?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;

  return questions.map((q) => ({
    number: q.number,
    correct_letter: q.correct_answer ?? null,
  }));
}

/**
 * File one sitting and return the stored row.
 *
 * `attempts` is not sent: a BEFORE INSERT trigger assigns it from this
 * student's own history for this paper, so it cannot disagree with the rows
 * already filed (see 20260826000001). It is selected back because the caller
 * reports it.
 */
async function insertAttempt(admin, { userId, questionId, answerBody, score }) {
  const { data, error } = await admin
    .from(MAHOTI_ANSWERS)
    .insert({
      user_id: userId,
      question_id: questionId,
      answer_body: answerBody,
      answer_score: score,
    })
    .select("answer_id, question_id, attempts, answer_score, created_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * This student's sittings, newest first — the read behind "filter the answers
 * by user". Scoped to one paper when `questionId` is given, which is what the
 * attempt-over-attempt comparison asks for.
 *
 * `answer_body` is deliberately not selected: a listing wants the scores, and
 * the per-question detail is forty entries per row that nothing on a list
 * renders. Fetch one row by id when the breakdown is actually needed.
 */
async function listAttemptsForUser(admin, userId, questionId = null) {
  let query = admin
    .from(MAHOTI_ANSWERS)
    .select("answer_id, question_id, attempts, answer_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (questionId) query = query.eq("question_id", questionId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

module.exports = {
  getAnswerKey,
  insertAttempt,
  listAttemptsForUser,
};
