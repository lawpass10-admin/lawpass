"use strict";

// Data access for דין דיוני sittings — public.diuni_answers, plus the one
// read of public.diuni_questions that marking needs.
//
// ── Why the admin client, and not the caller's RLS client ──────────────────
// diuni_questions is admin-only under RLS (20260823000003): it is authoring
// content, and the candidate's own paper is served to them through the same
// service-role bypass on the Next.js side (see lib/db/diuni.ts, which explains
// it at length). The answer key lives in that table, so marking cannot happen
// under the student's own client — it would read nothing.
//
// diuni_answers is the other half of the same decision: the student may SELECT
// their own rows, but there is no INSERT policy and no INSERT grant for
// `authenticated` at all, because a caller who can insert their own row can
// insert their own score. Every write here therefore goes through the admin
// client, and the ownership that RLS would otherwise enforce is enforced by the
// controller passing req.user.id and nothing else.

const DIUNI_QUESTIONS = "diuni_questions";
const DIUNI_ANSWERS = "diuni_answers";

/**
 * The subject a diuni question belongs to, for the per-topic breakdown.
 *
 * TWO KINDS OF QUESTION, TWO KINDS OF SUBJECT. A statute-grounded question is
 * about a named law, and that name is already on the question's own `sources`.
 * A judgment-grounded one is not about a law at all — its subject is the area
 * of practice the judgment sits in, which lives on `verdict_list` and reaches
 * here through `areaByVerdict`.
 *
 * Falls back to null rather than to a guess. An unclassified question is shown
 * under one honest "ללא סיווג" heading by the caller; inventing a subject for
 * it would put a wrong number in a table the candidate is using to decide what
 * to revise.
 */
function topicOf(question, areaByVerdict) {
  const source = (question.sources ?? [])[0];
  if (!source) return null;
  if (source.kind === "law") return source.law_name ?? null;
  return areaByVerdict.get(source.verdict_id) ?? null;
}

/**
 * The answer key for one paper: every question's number, its correct letter,
 * and the subject it belongs to, in the order the paper stores them.
 *
 * Returns null when the paper does not exist or has no questions yet — a row
 * is written notebook-first, so `questions IS NULL` is a normal intermediate
 * state rather than an error.
 *
 * The subject is resolved HERE, at marking time, rather than being stored on
 * the paper: it is a property of the source material, and reading it from the
 * table that owns it means a judgment reclassified later is reflected in the
 * next sitting without a backfill.
 */
async function getAnswerKey(admin, questionId) {
  const { data, error } = await admin
    .from(DIUNI_QUESTIONS)
    .select("question_id, questions")
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) throw error;

  const questions = data?.questions?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;

  // One join for the whole paper, not one per question. Only judgment-grounded
  // questions carry a verdict id, so a paper built entirely from statutes makes
  // no second query at all.
  const verdictIds = [
    ...new Set(
      questions
        .map((q) => (q.sources ?? [])[0])
        .filter((s) => s && s.kind !== "law" && s.verdict_id)
        .map((s) => s.verdict_id)
    ),
  ];

  const areaByVerdict = new Map();
  if (verdictIds.length > 0) {
    const { data: verdicts, error: vError } = await admin
      .from("verdict_list")
      .select("verdict_id, judgment_area")
      .in("verdict_id", verdictIds);

    if (vError) throw vError;
    for (const v of verdicts ?? []) {
      if (v.judgment_area) areaByVerdict.set(v.verdict_id, v.judgment_area);
    }
  }

  return questions.map((q) => ({
    number: q.number,
    correct_letter: q.correct_answer ?? null,
    topic: topicOf(q, areaByVerdict),
  }));
}

/**
 * File one sitting and return the stored row.
 *
 * `attempts` is not sent: a BEFORE INSERT trigger assigns it from this
 * student's own history for this paper, so it cannot disagree with the rows
 * already filed (see 20260831000004). It is selected back because the caller
 * reports it.
 */
async function insertAttempt(admin, { userId, questionId, answerBody, score }) {
  const { data, error } = await admin
    .from(DIUNI_ANSWERS)
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
    .from(DIUNI_ANSWERS)
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
