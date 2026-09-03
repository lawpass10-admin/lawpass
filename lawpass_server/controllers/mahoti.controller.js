"use strict";

// דיון מהותי — filing and scoring a sitting of a generated paper.
//
// ── The one thing to get right here ────────────────────────────────────────
// The marking happens HERE, from the answer key, and never from anything the
// browser sends. The candidate's paper is served without `correct_answer`
// (lib/db/mahoti.ts strips it), so the client genuinely cannot mark itself —
// and mahoti_answers has no INSERT policy for `authenticated`, so it cannot
// file a score it made up either. A submission is a list of letters; what that
// is worth is decided on this side of the wire.

const db = require("../db/mahoti");
const { breakdownByTopic } = require("../lib/marking/topic-breakdown");
const { adminClient } = require("../config/supabase");

/**
 * Mark one submission against the paper's answer key.
 *
 * Alignment is by question NUMBER, not by array position: the browser sends
 * what it was asked, but a paper reordered between sitting and submission would
 * otherwise be marked against the wrong questions — silently, and in the
 * candidate's disfavour as often as not.
 *
 * A question the candidate left blank is `letter: null` and is marked wrong for
 * the score out of `total`, while `answered` records how many were attempted at
 * all. A question that is in the submission but not on the paper is dropped: it
 * cannot be marked against anything, and rejecting the whole sitting over one
 * stale entry would cost the candidate the other thirty-nine.
 *
 * The correct letter is snapshot onto each entry, because the loader refreshes
 * a paper's row in place — without the snapshot, regenerating a paper would
 * silently re-mark every sitting that happened before it changed.
 */
function markSubmission(answerKey, given) {
  const chosen = new Map(given.map((g) => [g.number, g.letter ?? null]));

  const marked = answerKey.map((entry) => {
    const letter = chosen.has(entry.number) ? chosen.get(entry.number) : null;
    return {
      number: entry.number,
      letter,
      correct_letter: entry.correct_letter,
      // A paper whose key is missing for this question cannot mark it right.
      // That is a content bug, not a candidate mistake — it is recorded as
      // not-correct and left visible in the row rather than thrown away.
      is_correct: letter !== null && letter === entry.correct_letter,
      // The subject this question belongs to, carried onto the marked entry
      // so the stored answer_body can be re-grouped later without re-reading
      // the paper — a sitting stays explainable after the fact.
      topic: entry.topic ?? null,
    };
  });

  const total = marked.length;
  const answered = marked.filter((m) => m.letter !== null).length;
  const correct = marked.filter((m) => m.is_correct).length;

  const byTopic = breakdownByTopic(marked);

  return {
    // The counts travel with the answers, in the same jsonb, so "30 of 40" can
    // be read off the row without walking forty entries to re-count it.
    //
    // The per-subject rollup is deliberately NOT stored beside them. Every
    // entry in `given` already carries its own `topic`, so the breakdown is
    // recomputable from the row at any time; storing it as well would be a
    // second copy of derived data that a later change to the grouping would
    // silently leave stale on every sitting already filed.
    answerBody: { given: marked, correct, answered, total },
    // answer_score is the headline percentage — correct out of the paper's
    // total, one decimal. Computed once and stored, so a report and a screen
    // can never round the same sitting differently. 30/40 -> 75.
    score: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    correct,
    answered,
    total,
    byTopic,
  };
}

/**
 * POST /api/mahoti/questions/:id/attempts — file this sitting.
 *
 * The owner is req.user.id — the session — never anything from the body. The
 * sitting number is not sent either: the database assigns it from this
 * student's own history for this paper (see 20260826000001), so it cannot
 * disagree with the rows already filed. Re-sitting is allowed and uncapped;
 * each filing is simply the next number.
 */
async function submitAttempt(req, res) {
  const questionId = req.params.id;
  const admin = adminClient();

  const answerKey = await db.getAnswerKey(admin, questionId);
  if (!answerKey) {
    console.info(
      `[mahoti] attempt MISS user=${req.user.id} question=${questionId}`
    );
    return res.json({ ok: false, error: "המבחן לא נמצא" });
  }

  const marking = markSubmission(answerKey, req.valid.given);

  const row = await db.insertAttempt(admin, {
    userId: req.user.id,
    questionId,
    answerBody: marking.answerBody,
    score: marking.score,
  });

  console.info(
    `[mahoti] attempt OK user=${req.user.id} question=${questionId} ` +
      `attempts=${row.attempts} score=${marking.correct}/${marking.total} (${marking.score}%)`
  );

  return res.json({
    ok: true,
    attempt: {
      answer_id: row.answer_id,
      question_id: row.question_id,
      attempts: row.attempts,
      score: row.answer_score,
      // The counts come from the marking that just ran rather than from a
      // second read of answer_body — same numbers, one round trip.
      correct: marking.correct,
      answered: marking.answered,
      total: marking.total,
      // Correct-out-of-total per subject, weakest first. Rendered as the
      // score table before the candidate opens the full solution.
      by_topic: marking.byTopic,
      created_at: row.created_at,
    },
  });
}

/**
 * GET /api/mahoti/attempts[?question_id=…] — this student's own sittings.
 *
 * Always scoped to req.user.id. The admin client is used for the read (see
 * db/mahoti.js), so the scoping is this line rather than RLS — passing a
 * user id in from the query string is exactly the mistake that would make.
 */
async function listAttempts(req, res) {
  const questionId = String(req.query.question_id ?? "").trim() || null;

  const attempts = await db.listAttemptsForUser(
    adminClient(),
    req.user.id,
    questionId
  );

  console.info(
    `[mahoti] attempts OK user=${req.user.id} count=${attempts.length}` +
      (questionId ? ` question=${questionId}` : "")
  );

  return res.json({
    ok: true,
    attempts: attempts.map((row) => ({
      answer_id: row.answer_id,
      question_id: row.question_id,
      attempts: row.attempts,
      score: row.answer_score,
      created_at: row.created_at,
    })),
  });
}

module.exports = {
  submitAttempt,
  listAttempts,
  markSubmission,
};
