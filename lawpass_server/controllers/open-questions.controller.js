"use strict";

// Writing task (מטלת כתיבה) — the student-facing read side of open_questions.
//
// ── The one thing to get right here ────────────────────────────────────────
// A stored question carries BOTH the candidate's paper and the exam writer's
// notes, in the same JSON object. `legal_topic_analysis`, `model_answer_outline`
// and `common_pitfall` are the marking notes — model_answer_outline is a
// point-by-point plan of the winning answer. Sending the row through verbatim
// would hand the student the answer in the network tab, whatever the page
// chooses to render.
//
// So the projection below is an ALLOWLIST, not a blocklist: a field reaches the
// browser only by being named in STUDENT_FIELDS. A new writer-only field added
// to the generator is invisible here by default, which is the safe direction to
// fail. This mirrors render-open-question-pdf.js, which excludes the same three
// fields when it prints the candidate's paper.

const db = require("../db/open-questions");
const { adminClient } = require("../config/supabase");
const { gradeOne } = require("../lib/grading/run-grading");

/** Question fields the candidate is allowed to see. Everything else is cut. */
const STUDENT_FIELDS = [
  "external_id",
  "question_type",
  "angle_title",
  "title",
  "difficulty_level",
  "client_role",
  "deliverable",
  "fact_pattern",
  "task_instructions",
  "answer_limit",
  "timeline",
];

/** Quote fields — the sources printed on the exam paper, verbatim. */
const QUOTE_FIELDS = ["id", "type", "citation", "text"];

function pick(source, fields) {
  const out = {};
  for (const f of fields) {
    if (source?.[f] !== undefined) out[f] = source[f];
  }
  return out;
}

/** Row -> the object the browser gets. Writer-only fields never appear. */
function toStudentQuestion(row) {
  const q = row.question ?? {};
  return {
    open_question_id: row.open_question_id,
    subject: row.subject,
    type: row.type,
    created_at: row.created_at,
    ...pick(q, STUDENT_FIELDS),
    quotes: (q.quotes ?? []).map((quote) => pick(quote, QUOTE_FIELDS)),
  };
}

/** Row -> the one-line entry in the picker list. Deliberately thinner. */
function toListEntry(row) {
  const q = row.question ?? {};
  return {
    open_question_id: row.open_question_id,
    title: q.angle_title || q.title || q.external_id || "מטלת כתיבה",
    external_id: q.external_id ?? null,
    difficulty_level: q.difficulty_level ?? null,
    deliverable: q.deliverable ?? null,
    answer_limit: q.answer_limit ?? null,
    created_at: row.created_at,
  };
}

/** GET /api/open-questions/subjects */
async function getSubjects(req, res) {
  const subjects = await db.listSubjects(req.supabase);
  console.info(
    `[open-questions] subjects OK user=${req.user.id} count=${subjects.length}`
  );
  return res.json({ ok: true, subjects });
}

/** GET /api/open-questions?subject=... */
async function getQuestionsBySubject(req, res) {
  const subject = String(req.query.subject ?? "").trim();
  if (!subject) {
    return res.json({ ok: false, error: "יש לבחור נושא" });
  }

  const rows = await db.listQuestionsBySubject(req.supabase, subject);
  console.info(
    `[open-questions] list OK user=${req.user.id} subject="${subject}" count=${rows.length}`
  );
  return res.json({ ok: true, questions: rows.map(toListEntry) });
}

/** GET /api/open-questions/:id */
async function getQuestion(req, res) {
  const row = await db.getQuestionById(req.supabase, req.params.id);
  if (!row) {
    // Also the RLS-hidden case — same answer either way, on purpose: a
    // student probing ids learns nothing about which ones exist.
    console.info(
      `[open-questions] get MISS user=${req.user.id} id=${req.params.id}`
    );
    return res.json({ ok: false, error: "השאלה לא נמצאה" });
  }

  console.info(`[open-questions] get OK user=${req.user.id} id=${row.open_question_id}`);
  return res.json({ ok: true, question: toStudentQuestion(row) });
}

/**
 * POST /api/open-questions/:id/answers — file the student's answer.
 *
 * Two checks before the insert, in this order:
 *   1. the question exists AND is type='new' (getQuestionById filters on it),
 *      so an answer can never be attached to a source paper or a bogus id —
 *      the FK would catch the bogus id, but with a Postgres error rather than
 *      a Hebrew message;
 *   2. the id is a uuid, left to the database: a malformed id fails the
 *      lookup above and returns the same "not found" as a real miss.
 *
 * The answer's owner is req.user.id — the session — never anything from the
 * body. word_count is computed here rather than accepted from the client so it
 * cannot disagree with the text it describes.
 *
 * A student may file the same question again: nothing here checks for an
 * earlier submission, and there is no unique constraint underneath to trip on.
 * Each filing is its own row, numbered by the database (attempt_number) and
 * returned so the page can say which sitting this was.
 */
async function submitAnswer(req, res) {
  const questionId = req.params.id;
  const text = req.valid.text;

  // `row` not `question` — the row's own `question` column is the JSON below.
  const row = await db.getQuestionById(req.supabase, questionId);
  if (!row) {
    console.info(
      `[open-questions] submit REJECTED user=${req.user.id} id=${questionId} reason=question_not_found`
    );
    return res.json({ ok: false, error: "השאלה לא נמצאה" });
  }

  const answerBody = {
    text,
    word_count: text.split(/\s+/).filter(Boolean).length,
    // The question's own id, frozen at submission time. The FK already links
    // the row; this records WHICH VERSION of the paper was answered, since a
    // question could be re-generated under the same row.
    question_external_id: row.question?.external_id ?? null,
    submitted_from: "web",
  };

  const saved = await db.insertAnswer(req.supabase, {
    userId: req.user.id,
    openQuestionId: questionId,
    answerBody,
  });

  console.info(
    `[open-questions] submit OK user=${req.user.id} question=${questionId} answer=${saved.answer_id} attempt=${saved.attempt_number} words=${answerBody.word_count}`
  );

  // Grading starts now and is NOT awaited. A marking run is around a minute —
  // far longer than any sane HTTP timeout — so the student gets their receipt
  // immediately and the page polls for the result. The row's grading_status is
  // the queue, so if this process dies mid-run the CLI worker picks it up:
  // nothing here is the only copy of the work.
  startGrading(saved.answer_id);

  return res.json({
    ok: true,
    answer: {
      answer_id: saved.answer_id,
      open_question_id: saved.open_question_id,
      attempt_number: saved.attempt_number,
      created_at: saved.created_at,
      word_count: answerBody.word_count,
      grading_status: "pending",
    },
  });
}

/**
 * Fire-and-forget grading.
 *
 * Deliberately not awaited and deliberately never rethrown: a failure here has
 * already been recorded on the row by gradeOne (status `failed`, with the
 * reason), and letting it surface as an unhandled rejection would take the
 * server down over one bad submission. The log line is what we watch.
 */
function startGrading(answerId) {
  const admin = adminClient();
  void gradeOne(admin, answerId)
    .then((result) => {
      if (result.ok) {
        console.info(
          `[open-questions] grade OK answer=${answerId} score=${result.score.total}/${result.score.max}`
        );
      } else {
        console.error(
          `[open-questions] grade ${result.status} answer=${answerId} — ${result.detail}`
        );
      }
    })
    .catch((err) => {
      console.error(
        `[open-questions] grade CRASHED answer=${answerId} — ${err && err.message ? err.message : err}`
      );
    });
}

/**
 * GET /api/open-questions/answers/:id — one of the caller's own submissions.
 *
 * This is what the page polls while the spinner is up, and what the results
 * screen reads afterwards. RLS scopes it to the caller's own rows, so a bad or
 * borrowed id is simply "not found".
 */
async function getAnswer(req, res) {
  const answer = await db.getAnswerForUser(req.supabase, req.params.id);
  if (!answer) {
    console.info(`[open-questions] answer MISS user=${req.user.id} id=${req.params.id}`);
    return res.json({ ok: false, error: "התשובה לא נמצאה" });
  }

  console.info(
    `[open-questions] answer OK user=${req.user.id} id=${answer.answer_id} status=${answer.grading_status}`
  );
  return res.json({
    ok: true,
    answer: {
      answer_id: answer.answer_id,
      open_question_id: answer.open_question_id,
      attempt_number: answer.attempt_number,
      grading_status: answer.grading_status,
      created_at: answer.created_at,
      graded_at: answer.graded_at,
      text: answer.answer_body?.text ?? "",
      word_count: answer.answer_body?.word_count ?? 0,
      // Only ever populated once grading_status is 'graded'.
      score: answer.score ?? null,
    },
  });
}

module.exports = {
  getSubjects,
  getQuestionsBySubject,
  getQuestion,
  submitAnswer,
  getAnswer,
  toStudentQuestion,
  toListEntry,
};
