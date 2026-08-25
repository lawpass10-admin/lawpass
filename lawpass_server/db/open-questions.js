"use strict";

// Data access for the writing task (מטלת כתיבה) — public.open_questions.
//
// Every query runs under the caller's RLS-scoped client, so the
// open_questions_students_select policy is what actually decides which rows
// come back. Nothing here re-checks authorization.
//
// Shape of a row: question jsonb, answers jsonb, subject text, type text.
// The answers column is selected by exactly ONE function here —
// getModelAnswerFor, which exists for the "צפה בפתרון המלא" review screen and
// is reached only through a controller that has already checked the caller
// filed an answer to this question and that its marking is finished. It holds
// the model answer, so the student picking a question must never be able to
// fetch it from the network tab: no other query below may name it, and the
// student projections (STUDENT_COLUMNS) deliberately do not.
//
// type='new' ONLY. The 'source' rows are the real exam papers, and they exist
// here as INPUT to the offline generator — a student who was handed one would
// be sitting a past paper rather than a fresh task, and would be one search away
// from its published model answer. Every query below filters on it, and the
// open_questions_students_select policy repeats the filter so a future endpoint
// that forgets it still cannot reach a source row.

const STUDENT_TYPE = "new";

/** The columns a student is allowed to see. Note the absent `answers`. */
const STUDENT_COLUMNS = "open_question_id, subject, type, created_at, question";

/**
 * The distinct subjects that actually have at least one question, each with
 * its question count, newest first by most recent question.
 *
 * Postgres has no DISTINCT ON through PostgREST, so the grouping is done here:
 * the row count is small (tens, not thousands) and it saves an RPC for what is
 * one cheap pass over an indexed column.
 */
async function listSubjects(supabase) {
  const { data, error } = await supabase
    .from("open_questions")
    .select("subject, created_at")
    .eq("type", STUDENT_TYPE)
    .not("subject", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const bySubject = new Map();
  for (const row of data ?? []) {
    const subject = (row.subject ?? "").trim();
    if (!subject) continue;
    const seen = bySubject.get(subject);
    if (seen) seen.count += 1;
    else bySubject.set(subject, { subject, count: 1, latest: row.created_at });
  }

  return [...bySubject.values()];
}

/**
 * Every question filed under one subject, newest first.
 *
 * Matched on the exact stored string. The subjects come off the PDFs and some
 * carry bidi damage from extraction (תקנות סדר הדין האזרחי ,התשע"ט:2018), so
 * two spellings of the same statute are two subjects here — deliberately, since
 * the list the student picks from is built from these same strings.
 */
async function listQuestionsBySubject(supabase, subject) {
  const { data, error } = await supabase
    .from("open_questions")
    .select(STUDENT_COLUMNS)
    .eq("type", STUDENT_TYPE)
    .eq("subject", subject)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * One question by id, or null when it does not exist, is a 'source' row, or
 * RLS hides it. All three collapse to the same null on purpose — a student
 * pasting an id learns nothing about which rows are there.
 */
async function getQuestionById(supabase, id) {
  const { data, error } = await supabase
    .from("open_questions")
    .select(STUDENT_COLUMNS)
    .eq("type", STUDENT_TYPE)
    .eq("open_question_id", id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * File one submission and return the stored row.
 *
 * `user_id` comes from the authenticated session, never from the request body —
 * and the RLS WITH CHECK compares it against auth.uid() anyway, so a forged id
 * is rejected by the database rather than trusted here.
 *
 * `score` is not set. It is the grader's column; the insert policy requires it
 * to arrive NULL, so writing it here would fail the check rather than quietly
 * succeed.
 *
 * `attempt_number` is not set either, for the same reason in reverse: a
 * BEFORE INSERT trigger assigns it from the student's own history for this
 * question (see 20260817000003), so it cannot disagree with the rows already
 * filed. It is selected back because the caller reports it. Nothing here caps
 * the count — re-sitting the same task is allowed, it just gets the next number.
 */
async function insertAnswer(
  supabase,
  { userId, openQuestionId, answerBody, handWriting = null }
) {
  const { data, error } = await supabase
    .from("open_question_answers")
    .insert({
      user_id: userId,
      open_question_id: openQuestionId,
      answer_body: answerBody,
      // Its own column rather than a key inside answer_body: the pages are a
      // different kind of thing from the text — they are assets living
      // elsewhere, with their own lifecycle — and a column is what makes
      // "which submissions were handwritten" a query instead of a scan.
      hand_writing: handWriting,
    })
    .select("answer_id, open_question_id, attempt_number, created_at")
    .single();

  if (error) throw error;
  return data;
}

/**
 * One of the caller's own submissions, with its grading state and score.
 *
 * Runs under the caller's RLS client on purpose: open_question_answers_students_select
 * scopes to `user_id = auth.uid()`, so a student polling someone else's answer id
 * gets nothing back and learns nothing about whether it exists. There is no
 * ownership check in this file for the same reason there is none in the others —
 * the database is doing it.
 *
 * `answer_body` is returned so the results screen can show what was submitted
 * beside the marking; `grading_error` is NOT — a model error message is
 * diagnostics for us, not feedback for a student.
 */
async function getAnswerForUser(supabase, answerId) {
  const { data, error } = await supabase
    .from("open_question_answers")
    .select(
      "answer_id, open_question_id, attempt_number, answer_body, hand_writing, score, grading_status, created_at, graded_at"
    )
    .eq("answer_id", answerId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * The model answer stored on one question, for the review screen.
 *
 * The ONLY select in this file that names `answers`. It is not a student
 * projection and must never become one: the caller (getSolution) first loads
 * the student's OWN answer row for this question and refuses unless its
 * marking has finished, so a question the student has not sat cannot be opened
 * this way. Handing over the model answer earlier would turn every task into a
 * reading exercise.
 *
 * Runs under the caller's RLS client like everything else here, so the
 * type='new' policy still applies underneath and a 'source' paper — whose
 * official answer is published — cannot be reached at all. Null when the
 * question is gone, is a source row, or was never given an answer by the
 * generator (`answers` is nullable, and a question can exist before one is
 * written).
 */
async function getModelAnswerFor(supabase, questionId) {
  const { data, error } = await supabase
    .from("open_questions")
    .select("open_question_id, answers")
    .eq("type", STUDENT_TYPE)
    .eq("open_question_id", questionId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

module.exports = {
  listSubjects,
  listQuestionsBySubject,
  getQuestionById,
  insertAnswer,
  getAnswerForUser,
  getModelAnswerFor,
};
