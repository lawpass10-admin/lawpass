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
const gradingProgress = require("../lib/grading/progress-registry");
const {
  isConfigured: cloudinaryConfigured,
  uploadImage,
  isOwnAssetUrl,
  HANDWRITING_MAX_BYTES,
  HANDWRITING_MIME_TYPES,
} = require("../lib/cloudinary");
const { env } = require("../config/env");
const { startSpan, secs } = require("../lib/timing");

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
  // The request itself is two queries and a return — it should never be part of
  // why a student waits. Timed anyway so that "grading is slow" can be answered
  // with the submit cost on the record rather than assumed to be nothing.
  const submitSpan = startSpan();
  const questionId = req.params.id;
  const text = req.valid.text ?? "";
  const pages = req.valid.hand_writing ?? [];

  // `row` not `question` — the row's own `question` column is the JSON below.
  const row = await db.getQuestionById(req.supabase, questionId);
  if (!row) {
    console.info(
      `[open-questions] submit REJECTED user=${req.user.id} id=${questionId} reason=question_not_found`
    );
    return res.json({ ok: false, error: "השאלה לא נמצאה" });
  }

  // The pages were uploaded by an earlier request and come back as plain
  // strings, so "is this ours" is asked here rather than assumed. A URL on
  // another host is refused outright: the alternative is storing a link we do
  // not control on a row we serve back to a browser.
  if (pages.some((p) => !isOwnAssetUrl(p.url))) {
    console.warn(
      `[open-questions] submit REJECTED user=${req.user.id} id=${questionId} reason=foreign_handwriting_url`
    );
    return res.json({ ok: false, error: "קישור לתמונות אינו תקין" });
  }

  // Numbered by position, not by whatever the body claimed: the client sends
  // the pages in the order the student arranged them, and two pages both
  // calling themselves "1" is a stored answer nobody can read back in order.
  const handWriting = pages.length
    ? pages.map((p, i) => ({ ...p, page: i + 1 }))
    : null;

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
    handWriting,
  });

  console.info(
    `[open-questions] submit OK user=${req.user.id} question=${questionId} answer=${saved.answer_id} attempt=${saved.attempt_number} words=${answerBody.word_count} pages=${handWriting ? handWriting.length : 0} elapsed=${secs(submitSpan())}`
  );

  // Grading starts now and is NOT awaited. A marking run is around a minute —
  // far longer than any sane HTTP timeout — so the student gets their receipt
  // immediately and the page polls for the result. The row's grading_status is
  // the queue, so if this process dies mid-run the CLI worker picks it up:
  // nothing here is the only copy of the work.
  //
  // Nothing is queued for a submission with no typed text. The grader reads
  // `answer_body.text` and would mark a photographed answer `failed` within the
  // second — telling a student who did the work that their answer could not be
  // checked. Marking handwriting means reading the image, which is a different
  // grader; until it exists the row stays `pending` and the page says so
  // instead of showing a marking error that is really our gap.
  const gradable = answerBody.word_count > 0;
  if (gradable) startGrading(saved.answer_id);

  return res.json({
    ok: true,
    answer: {
      answer_id: saved.answer_id,
      open_question_id: saved.open_question_id,
      attempt_number: saved.attempt_number,
      created_at: saved.created_at,
      word_count: answerBody.word_count,
      grading_status: "pending",
      hand_writing_pages: handWriting ? handWriting.length : 0,
      /** False = filed but not queued for marking (handwriting only). */
      grading_queued: gradable,
    },
  });
}

/**
 * POST /api/open-questions/:id/handwriting — the photographed answer pages.
 *
 * Separate from the submit for a reason: the student photographs their pages
 * while still deciding whether to send, and an upload that only happened at
 * submit time would mean a two-page upload standing between "send" and the
 * receipt, with nothing on screen confirming the photos were even readable.
 * Here the modal confirms each page as it lands, and the submit that follows
 * carries links.
 *
 * The cost of splitting it is orphans: pages uploaded and then never submitted
 * stay in Cloudinary with no row pointing at them. That is a sweeper's job (the
 * folder carries the user and question ids for exactly that), not a reason to
 * make the student wait.
 */
async function uploadHandwriting(req, res) {
  const questionId = req.params.id;
  const files = req.files || [];

  if (!cloudinaryConfigured()) {
    console.error(
      "[open-questions] handwriting REJECTED reason=cloudinary_not_configured"
    );
    return res.json({
      ok: false,
      error: "העלאת תמונות אינה מוגדרת בשרת. פנה אלינו ונטפל בזה.",
    });
  }

  if (files.length === 0) {
    return res.json({ ok: false, error: "לא נבחרו תמונות" });
  }

  // Same "does it exist and is it answerable" check the submit makes, and for
  // the same reason: nothing should be uploaded against an id that cannot be
  // answered. It also keeps the folder name from being built out of a bogus id.
  const row = await db.getQuestionById(req.supabase, questionId);
  if (!row) {
    console.info(
      `[open-questions] handwriting REJECTED user=${req.user.id} id=${questionId} reason=question_not_found`
    );
    return res.json({ ok: false, error: "השאלה לא נמצאה" });
  }

  for (const file of files) {
    if (!file.size) {
      return res.json({ ok: false, error: "אחת התמונות ריקה" });
    }
    if (file.size > HANDWRITING_MAX_BYTES) {
      return res.json({
        ok: false,
        error: "אחת התמונות גדולה מדי (מקסימום 10MB לעמוד)",
      });
    }
    if (!HANDWRITING_MIME_TYPES.has(file.mimetype)) {
      return res.json({
        ok: false,
        error: "אפשר לצרף תמונות בלבד (JPG, PNG, WebP או HEIC)",
      });
    }
  }

  // user/question in the path so an orphan can be traced back to who uploaded
  // it and for what, and so one student's pages are never in another's folder.
  const folder = `${env.cloudinary.folder}/${req.user.id}/${questionId}`;
  const stamp = Date.now();

  const pages = [];
  for (const [i, file] of files.entries()) {
    const page = i + 1;
    try {
      const asset = await uploadImage(file.buffer, {
        folder,
        publicId: `${stamp}-p${page}`,
        mimetype: file.mimetype,
      });
      pages.push({ page, ...asset });
    } catch (err) {
      // The reason is Cloudinary's (bad credentials, over quota, not an image)
      // and belongs in the log, not on a student's screen.
      console.error(
        `[open-questions] handwriting FAILED user=${req.user.id} question=${questionId} page=${page} — ${err && err.message ? err.message : err}`
      );
      return res.json({
        ok: false,
        error: "העלאת התמונות נכשלה — נסה שוב",
      });
    }
  }

  console.info(
    `[open-questions] handwriting OK user=${req.user.id} question=${questionId} pages=${pages.length}`
  );
  return res.json({ ok: true, pages });
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
      // The photographed pages, so the results screen can show what was filed
      // rather than an empty answer box next to a handwritten submission.
      hand_writing: answer.hand_writing ?? null,
      // Only ever populated once grading_status is 'graded'.
      score: answer.score ?? null,
      // How far along the marking is, when this process happens to be the one
      // doing it (see lib/grading/progress-registry.js). Null is a normal
      // answer, not an error — for a finished row, for a run picked up by the
      // CLI worker, or after a restart — and the page falls back to its plain
      // waiting message whenever it is null.
      progress:
        answer.grading_status === "grading"
          ? gradingProgress.get(answer.answer_id)
          : null,
    },
  });
}

module.exports = {
  getSubjects,
  getQuestionsBySubject,
  getQuestion,
  submitAnswer,
  uploadHandwriting,
  getAnswer,
  toStudentQuestion,
  toListEntry,
};
