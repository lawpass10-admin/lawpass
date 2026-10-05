"use strict";

// How many times a student has already been marked on a writing task.
//
// The table stores the COUNT; the ALLOWANCE is env.openQuestions.maxGradesPerQuestion.
// That split is the point of the design: the number is meant to be tuned from
// .env.local, so nothing in the database encodes what the limit is — only what
// has been spent.
//
// READS go through the caller's RLS client wherever there is one. The
// open_question_grades_counts_students_select_own policy scopes a student to
// their own counters, so a borrowed question id reads as zero rather than as
// someone else's quota. WRITES go through the service-role client and the
// SECURITY DEFINER function, because no student role may write a quota.

const { env } = require("../config/env");

/**
 * Grades already spent by this student on this task.
 *
 * Returns 0 for a pair with no row — a student who has never been marked on a
 * task is the overwhelmingly common case and does not get a row until their
 * first grade is written.
 *
 * A read failure is NOT swallowed. The temptation is to treat an unreadable
 * counter as zero so a database hiccup never blocks a submission; that turns
 * the one check standing between us and unbounded model spend into something
 * that fails open under exactly the conditions where it matters.
 */
async function getGradeCount(client, userId, openQuestionId) {
  const { data, error } = await client
    .from("open_question_grades_counts")
    .select("no_of_grades")
    .eq("user_id", userId)
    .eq("open_question_id", openQuestionId)
    .maybeSingle();

  if (error) throw error;
  return data?.no_of_grades ?? 0;
}

/** The configured allowance. One place, so the controller and the grader agree. */
function gradeLimit() {
  return env.openQuestions.maxGradesPerQuestion;
}

/**
 * Has this student used up their markings on this task?
 *
 * @returns {Promise<{ used: number, limit: number, exhausted: boolean, remaining: number }>}
 */
async function getGradeQuota(client, userId, openQuestionId) {
  const limit = gradeLimit();
  const used = await getGradeCount(client, userId, openQuestionId);
  return {
    used,
    limit,
    exhausted: used >= limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Count one completed marking. Returns the new total.
 *
 * Goes through the RPC rather than a read-modify-write because an increment
 * must be one statement: two gradings finishing together would otherwise both
 * read the same number and both write it back plus one, losing a grade in the
 * direction that costs money.
 *
 * `admin` must be the service-role client — EXECUTE on the function is granted
 * to service_role only.
 */
async function recordGrade(admin, { userId, openQuestionId, answerId = null }) {
  const { data, error } = await admin.rpc("record_open_question_grade", {
    p_user_id: userId,
    p_open_question_id: openQuestionId,
    p_answer_id: answerId,
  });

  if (error) throw error;
  return Number(data);
}

module.exports = {
  getGradeCount,
  getGradeQuota,
  gradeLimit,
  recordGrade,
};
