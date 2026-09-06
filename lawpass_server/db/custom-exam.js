"use strict";

// custom-exam.js — "שאלון מותאם אישית": an exam a candidate assembles from
// questions that already exist, rather than one the model generates.
//
// NOTHING IS GENERATED HERE. Every question comes from an authored paper that
// has already been written, quote-verified and reviewed. Building an exam is
// selection and renumbering, so it costs nothing and takes milliseconds.
//
// THE BUILT EXAM IS A ROW IN THE SAME TABLE as the authored papers, carrying
// `built_for = <the candidate>`. That is what lets everything downstream work
// untouched: the answers tables have a foreign key onto these tables, so an
// exam kept anywhere else could not be sat. See 20260906000001_custom_exams.sql.

const { getAnswerKey: mahotiAnswerKey } = require("./mahoti");
const { getAnswerKey: diuniAnswerKey } = require("./diuni");

const UNCLASSIFIED = "ללא סיווג";

/** How each subject names itself in the built exam's title. */
const SUBJECT_LABEL = { mahoti: "דין מהותי", diuni: "דין דיוני" };

/** The two subjects a custom exam can be built for. */
const SUBJECTS = {
  mahoti: { table: "mahoti_questions", answerKey: mahotiAnswerKey, notebook: true },
  diuni: { table: "diuni_questions", answerKey: diuniAnswerKey, notebook: false },
};

/**
 * Every authored question of one subject, tagged with its area.
 *
 * Reads only `built_for IS NULL` — a candidate builds from the authored papers,
 * never from another candidate's custom exam, which would otherwise let one
 * person's selection leak into everyone else's pool.
 */
async function readPool(admin, subject) {
  const spec = SUBJECTS[subject];
  if (!spec) throw new Error(`unknown subject: ${subject}`);

  const { data: papers, error } = await admin
    .from(spec.table)
    .select("question_id, questions, question_review, created_at")
    .is("built_for", null)
    .not("questions", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const pool = [];
  for (const paper of papers ?? []) {
    const key = await spec.answerKey(admin, paper.question_id);
    const areaByNumber = new Map((key ?? []).map((e) => [e.number, e.area]));
    const reviews = new Map(
      (paper.question_review?.questions ?? []).map((r) => [r.number, r])
    );

    for (const question of paper.questions?.questions ?? []) {
      pool.push({
        sourcePaperId: paper.question_id,
        sourceNumber: question.number,
        area: areaByNumber.get(question.number) || UNCLASSIFIED,
        question,
        review: reviews.get(question.number) ?? null,
      });
    }
  }
  return pool;
}

/** How many questions exist per area — what the form's boxes are capped at. */
async function getExamPool(admin, subject) {
  const pool = await readPool(admin, subject);
  const byArea = new Map();
  for (const item of pool) {
    byArea.set(item.area, (byArea.get(item.area) ?? 0) + 1);
  }
  return {
    total: pool.length,
    areas: [...byArea.entries()]
      .map(([area, available]) => ({ area, available }))
      .sort((a, b) => b.available - a.available || a.area.localeCompare(b.area, "he")),
  };
}

/**
 * Deterministic shuffle, so a rebuild with the same request is reproducible and
 * two candidates asking for the same shape do not get identical papers.
 */
function shuffle(items, seed) {
  const out = [...items];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build one exam from a per-area request.
 *
 * `counts` is { area: howMany }. The total is checked against `expectedTotal`
 * HERE as well as in the browser: the form is a convenience, not the rule, and
 * a request that reached this function by any other route must still produce a
 * whole paper or nothing.
 *
 * Returns the new row's id. Throws with a Hebrew message the API hands straight
 * to the candidate when the request cannot be met.
 */
async function buildCustomExam(admin, { subject, userId, counts, expectedTotal }) {
  const spec = SUBJECTS[subject];
  if (!spec) throw new Error("נושא לא מוכר");

  const requested = Object.entries(counts ?? {}).filter(([, n]) => Number(n) > 0);
  const total = requested.reduce((sum, [, n]) => sum + Number(n), 0);

  if (total !== expectedTotal) {
    throw new Error(`יש לבחור בדיוק ${expectedTotal} שאלות. נבחרו ${total}.`);
  }

  const pool = await readPool(admin, subject);
  const byArea = new Map();
  for (const item of pool) {
    if (!byArea.has(item.area)) byArea.set(item.area, []);
    byArea.get(item.area).push(item);
  }

  // Check the whole request before taking anything, so a shortfall in the last
  // area does not leave a half-built exam.
  const shortfalls = [];
  for (const [area, n] of requested) {
    const available = byArea.get(area)?.length ?? 0;
    if (available < Number(n)) {
      shortfalls.push(`${area}: התבקשו ${n}, קיימות ${available}`);
    }
  }
  if (shortfalls.length) {
    throw new Error(`אין מספיק שאלות במאגר — ${shortfalls.join("; ")}`);
  }

  const seed = Date.now() & 0x7fffffff;
  const picked = [];
  for (const [area, n] of requested) {
    picked.push(...shuffle(byArea.get(area), seed).slice(0, Number(n)));
  }

  // One more shuffle across areas, so the paper does not run area by area —
  // a real sitting does not group its questions by subject.
  const ordered = shuffle(picked, seed ^ 0x5bf03635);

  // Renumber 1..N. Every downstream reader joins questions to their review by
  // `number`, so the two have to be renumbered together and identically.
  const questions = [];
  const reviews = [];
  const provenance = [];
  ordered.forEach((item, i) => {
    const number = i + 1;
    questions.push({ ...item.question, number });
    if (item.review) reviews.push({ ...item.review, number });
    provenance.push({
      number,
      area: item.area,
      source_paper: item.sourcePaperId,
      source_number: item.sourceNumber,
    });
  });

  const row = {
    built_for: userId,
    questions: {
      // EVERYTHING ABOUT THE BUILD LIVES IN THIS JSONB, not in a column.
      // `generation_meta` exists on diuni_questions and NOT on
      // mahoti_questions, so writing there would work for one subject and fail
      // for the other — which is exactly how this first broke. `questions.exam`
      // is present on both by construction, and both readers already look for
      // `questions.exam.title`, ignoring anything else they find beside it.
      exam: {
        title: `מבחן ${SUBJECT_LABEL[subject]} מותאם אישית`,
        kind: "custom",
        subject,
        built_at: new Date().toISOString(),
        requested: Object.fromEntries(requested),
        // Which authored question each item came from, so a custom exam can be
        // traced back to reviewed content rather than being an opaque copy.
        provenance,
      },
      questions,
    },
    question_review: { questions: reviews },
  };

  // A mahoti paper is read beside the legislation notebook it was built from,
  // and the reader treats a row without one as unusable. A custom exam draws
  // across papers, so its notebook is the union of theirs.
  if (spec.notebook) {
    row.question_notebook = await mergeNotebooks(
      admin,
      [...new Set(ordered.map((i) => i.sourcePaperId))]
    );
  }

  const { data, error } = await admin
    .from(spec.table)
    .insert(row)
    .select("question_id")
    .single();

  if (error) throw error;
  return data.question_id;
}

/**
 * One notebook covering every law the picked questions cite.
 *
 * Laws are keyed by law_id and merged section by section: two papers can both
 * carry חוק החוזים while sampling different sections of it, and a candidate
 * checking a question against the notebook needs the section THAT question
 * quoted, not whichever paper happened to be read last.
 */
async function mergeNotebooks(admin, paperIds) {
  const { data, error } = await admin
    .from("mahoti_questions")
    .select("question_notebook")
    .in("question_id", paperIds);

  if (error) throw error;

  const laws = new Map();
  for (const row of data ?? []) {
    for (const law of row.question_notebook?.laws ?? []) {
      const existing = laws.get(law.law_id);
      if (!existing) {
        laws.set(law.law_id, { ...law, sections: [...(law.sections ?? [])] });
        continue;
      }
      const seen = new Set(existing.sections.map((s) => String(s.number).trim()));
      for (const section of law.sections ?? []) {
        if (!seen.has(String(section.number).trim())) existing.sections.push(section);
      }
    }
  }

  const merged = [...laws.values()].map((law) => ({
    ...law,
    section_count: law.sections.length,
  }));
  const sectionCount = merged.reduce((n, law) => n + law.sections.length, 0);

  // THE SHAPE MUST MATCH AN AUTHORED NOTEBOOK EXACTLY: { laws, notebook }, with
  // the counts nested under `notebook`. The study screen reads
  // `notebook.notebook.law_count` and `.section_count` directly, so a merged
  // notebook that puts its metadata anywhere else — an earlier version of this
  // used `meta` — renders the page as a crash rather than as a paper.
  return {
    laws: merged,
    notebook: {
      seed: null,
      law_count: merged.length,
      section_count: sectionCount,
      estimated_a4_pages: null,
      built_at: new Date().toISOString(),
    },
  };
}

module.exports = { getExamPool, buildCustomExam, mergeNotebooks, SUBJECTS };
