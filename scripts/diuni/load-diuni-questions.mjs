// load-diuni-questions.mjs — assemble generated questions into one
// public.diuni_questions row.
//
//   node scripts/diuni/load-diuni-questions.mjs                 # dry run, all of generated/
//   node scripts/diuni/load-diuni-questions.mjs --commit
//   node scripts/diuni/load-diuni-questions.mjs --title="דין דיוני — מבחן 1" --commit
//   node scripts/diuni/load-diuni-questions.mjs --update=<question_id> --commit
//
// SAFE BY DEFAULT: without --commit this connects, validates, reports exactly
// what it would write, and rolls back. Nothing reaches the table until you pass
// --commit deliberately.
//
// WHAT IT BUILDS. The generator writes one file per question, each a self-
// contained draft for a lawyer to read. A paper is those files collected into
// the two jsonb payloads the study screen reads — `questions` (candidate-facing,
// carrying the answer key the server strips before serving) and
// `question_review` (the nine 360° sections) — aligned by `number`.
//
// THE FIELD-NAME TRAP. The review payload uses mahoti's StoredReview spelling,
// which is `explanation` where the generator says `full_explanation`. Getting
// this wrong is silent: Learning360Panel reads `explanation`, finds nothing,
// and renders an empty "הסבר משפטי מלא" with no error anywhere. The mapping is
// done here, in one place, and asserted before the write.

import dotenv from "dotenv";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const commit = argv.includes("--commit");
const title = flagOf("title") ?? "דין דיוני";
const updateId = flagOf("update");

const generatedDir = join(here, "generated");

// --------------------------------------------------------------- collect

const files = readdirSync(generatedDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`no generated questions in ${generatedDir}`);
  process.exit(1);
}

const drafts = files.map((f) => ({
  file: f,
  data: JSON.parse(readFileSync(join(generatedDir, f), "utf8")),
}));

// Numbering is assigned HERE, by load order, not taken from the draft files.
// Each draft was numbered 1 within its own generation run, so trusting those
// would give a paper of eight question ones — and `question_review` aligns to
// `questions` by number, so the review would attach to the wrong questions
// rather than fail.
const questions = [];
const reviews = [];
const verdictIds = [];
const meta = [];

drafts.forEach((d, i) => {
  const number = i + 1;
  const q = d.data.question;
  const r = d.data.review;

  questions.push({
    number,
    fact_pattern: q.fact_pattern,
    stem: q.stem,
    options: q.options,
    correct_answer: q.correct_answer,
    // The material behind this question, and the passages it leans on. Keeps
    // every question checkable after load without re-reading the draft file.
    //
    // Two shapes, one per grounding kind. `kind` is written explicitly rather
    // than left to be inferred from which fields are present: a reader that
    // guesses gets it wrong the first time a law question has no case number
    // and silently renders a reference with `undefined` in it.
    sources: (d.data.grounding_quotes ?? []).map((g) =>
      d.data.generated_from.grounding_kind === "law"
        ? {
            kind: "law",
            law_id: d.data.generated_from.law_id,
            law_name: d.data.generated_from.law_name,
            section_number: d.data.generated_from.section_number,
            role: g.role,
            quote: g.quote,
          }
        : {
            kind: "verdict",
            verdict_id: d.data.generated_from.verdict_id,
            case_number: d.data.generated_from.case_number,
            role: g.role,
            quote: g.quote,
          }
    ),
  });

  reviews.push({
    number,
    legal_topic_analysis: r.legal_topic_analysis,
    // mahoti's spelling. See the header note.
    explanation: r.full_explanation,
    common_pitfall: r.common_pitfall,
    quick_thinking_360: r.quick_thinking_360,
    summary_for_memory: r.summary_for_memory,
    concepts_and_skills: r.concepts_and_skills,
    distractor_analysis: r.distractor_analysis,
  });

  // Only judgment-grounded questions contribute a verdict id; a law question
  // has none, and pushing undefined would break the uuid[] column.
  if (d.data.generated_from.verdict_id) {
    verdictIds.push(d.data.generated_from.verdict_id);
  }
  meta.push({
    number,
    file: d.file,
    grounding_kind: d.data.generated_from.grounding_kind ?? "verdict",
    case_number: d.data.generated_from.case_number ?? null,
    judgment_area_id: d.data.generated_from.judgment_area_id ?? null,
    law_id: d.data.generated_from.law_id ?? null,
    section_number: d.data.generated_from.section_number ?? null,
    model: d.data.generated_from.model,
    effort: d.data.generated_from.effort,
    prompt_version: d.data.generated_from.prompt_version,
    answer_placement: d.data.generated_from.answer_placement ?? null,
    usage: d.data.generated_from.usage ?? null,
  });
});

// --------------------------------------------------------------- validate
//
// Everything here is a shape the study screen depends on and would fail QUIETLY
// on: a missing review section renders as an empty heading, a stray answer
// letter renders as a question with no correct choice. Checked before the write
// rather than discovered on screen.

const LETTERS = ["א", "ב", "ג", "ד"];
const problems = [];

for (const q of questions) {
  const letters = q.options.map((o) => o.letter);
  if (letters.join("") !== LETTERS.join("")) {
    problems.push(`Q${q.number}: options are ${letters.join("")}, expected ${LETTERS.join("")}`);
  }
  if (!letters.includes(q.correct_answer)) {
    problems.push(`Q${q.number}: correct_answer ${q.correct_answer} names no option`);
  }
  if (!q.fact_pattern?.trim() || !q.stem?.trim()) {
    problems.push(`Q${q.number}: empty fact_pattern or stem`);
  }
}

for (const r of reviews) {
  for (const field of [
    "legal_topic_analysis",
    "explanation",
    "common_pitfall",
    "quick_thinking_360",
    "summary_for_memory",
  ]) {
    if (!r[field] || !String(r[field]).trim()) {
      problems.push(`Q${r.number}: review.${field} is empty`);
    }
  }
  if (!Array.isArray(r.concepts_and_skills) || r.concepts_and_skills.length === 0) {
    problems.push(`Q${r.number}: review.concepts_and_skills is empty`);
  }
  for (const l of LETTERS) {
    if (!r.distractor_analysis?.[l]) {
      problems.push(`Q${r.number}: no distractor_analysis for ${l}`);
    }
  }
  // The panel's own parser, so a row that would render as one unparsed blob is
  // caught here rather than on screen.
  const cards = String(r.quick_thinking_360).split(/\*\*וריאציה\s*\d+[\s\S]*?\*\*/).slice(1);
  if (cards.length === 0) {
    problems.push(`Q${r.number}: quick_thinking_360 has no **וריאציה N — …:** markers`);
  }
}

const payloads = {
  questions: {
    exam: {
      title,
      question_count: questions.length,
      // Not Date.now() inside a payload the loader may re-run: this records
      // when the row was assembled, which is what a reviewer wants to know.
      assembled_at: new Date().toISOString(),
    },
    questions,
  },
  question_review: { questions: reviews },
  generation_meta: { source: "scripts/diuni/generated", questions: meta },
};

const answerSpread = questions.reduce((m, q) => {
  m[q.correct_answer] = (m[q.correct_answer] ?? 0) + 1;
  return m;
}, {});

console.log(`files            : ${files.length}`);
console.log(`questions        : ${questions.length}`);
const byKind = meta.reduce((m, x) => ((m[x.grounding_kind] = (m[x.grounding_kind] ?? 0) + 1), m), {});
console.log(`grounding        : ${JSON.stringify(byKind)}`);
console.log(`judgments        : ${new Set(verdictIds).size} distinct`);
console.log(`answer spread    : ${JSON.stringify(answerSpread)}`);
console.log(`title            : ${title}`);
console.log(`mode             : ${updateId ? `update ${updateId}` : "insert new row"}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s) — nothing written:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("validation       : ok");

// --------------------------------------------------------------- write

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("no DIRECT_URL or DATABASE_URL in .env.local");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("BEGIN");

  let row;
  if (updateId) {
    // created_at is deliberately not touched: a re-load refreshes the payloads
    // and leaves the paper's original creation time standing.
    const res = await client.query(
      `UPDATE public.diuni_questions
          SET verdict_ids = $2, questions = $3::jsonb,
              question_review = $4::jsonb, generation_meta = $5::jsonb
        WHERE question_id = $1
        RETURNING question_id, created_at`,
      [
        updateId,
        verdictIds,
        JSON.stringify(payloads.questions),
        JSON.stringify(payloads.question_review),
        JSON.stringify(payloads.generation_meta),
      ]
    );
    if (res.rowCount === 0) throw new Error(`no diuni_questions row with id ${updateId}`);
    row = res.rows[0];
  } else {
    const res = await client.query(
      `INSERT INTO public.diuni_questions
              (verdict_ids, questions, question_review, generation_meta)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
       RETURNING question_id, created_at`,
      [
        verdictIds,
        JSON.stringify(payloads.questions),
        JSON.stringify(payloads.question_review),
        JSON.stringify(payloads.generation_meta),
      ]
    );
    row = res.rows[0];
  }

  if (commit) {
    await client.query("COMMIT");
    console.log(`\nCOMMITTED — question_id ${row.question_id}`);
  } else {
    await client.query("ROLLBACK");
    console.log(`\nDRY RUN — rolled back. Would have written question_id ${row.question_id}.`);
    console.log("Pass --commit to write it.");
  }
} catch (err) {
  await client.query("ROLLBACK");
  console.error(`\nFAILED — rolled back. ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
