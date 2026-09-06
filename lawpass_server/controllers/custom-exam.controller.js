"use strict";

const { adminClient } = require("../config/supabase");
const db = require("../db/custom-exam");

/**
 * How many questions are available per area.
 *
 * Read with the ADMIN client: the pool lives in the question tables, which are
 * admin-only under RLS because they carry the answer key. Only counts and area
 * names leave this handler — never a question, and never a correct answer.
 */
async function pool(req, res) {
  const subject = String(req.query.subject ?? "").trim();
  if (!db.SUBJECTS[subject]) {
    return res.json({ ok: false, error: "נושא לא מוכר" });
  }
  const data = await db.getExamPool(adminClient(), subject);
  return res.json({ ok: true, pool: data });
}

/**
 * Build the exam and hand back its id.
 *
 * The owner is req.user.id — the session — never anything from the body, so a
 * caller cannot build an exam into somebody else's account. The total is
 * re-checked in the db layer rather than trusted from the browser.
 */
async function build(req, res) {
  const { subject, counts, total } = req.body ?? {};
  if (!db.SUBJECTS[String(subject)]) {
    return res.json({ ok: false, error: "נושא לא מוכר" });
  }

  try {
    const examId = await db.buildCustomExam(adminClient(), {
      subject: String(subject),
      userId: req.user.id,
      counts: counts ?? {},
      expectedTotal: Number(total),
    });
    console.info(
      `[custom-exam] built user=${req.user.id} subject=${subject} exam=${examId}`
    );
    return res.json({ ok: true, exam_id: examId });
  } catch (error) {
    // These are the candidate's own input problems — too few questions chosen,
    // or more than the pool holds — and read as sentences, not stack traces.
    console.info(`[custom-exam] refused user=${req.user.id}: ${error.message}`);
    return res.json({ ok: false, error: error.message });
  }
}

module.exports = { pool, build };
