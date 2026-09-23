// Does every embedded real question belong to the paper it sits in?
//
//   node scripts/check-real-question-fit.mjs
//   node scripts/check-real-question-fit.mjs --set=<question_id>
//
// THE RULE. A generated מהותי paper is written from ONE notebook, and a notebook
// is not a list of laws — it is a SAMPLE of sections from 25 laws, because every
// section of 25 laws is ~120 A4 pages against the 70–90 a candidate is given.
// Every generated question on the paper is verified against that sample at
// section level. When a real Bar question is embedded in the paper
// (scripts/mahoti/embed-real-questions.mjs), the law its answer turns on has to
// be in the notebook AND every section its answer key cites has to be in it too.
//
// Checking the law alone is not enough and looks like it is: of 26 pool
// questions whose law was in one notebook, only 11 had all their cited sections
// in it.
//
// WHY IT MATTERS. Break the rule and the paper stops being about what it says it
// is about: a candidate revising חוק ההתיישנות meets a question on חוק הנוער,
// and the topic breakdown on the results screen describes a paper nobody sat.
// It is also invisible — the question renders perfectly, carries a full review,
// and is simply about the wrong thing. That is exactly the class of defect that
// needs something going looking for it, which is what this is.
//
// It happened once, in full: the first seven questions embedded in
// 02f47f09 were drawn at random from the whole 157-question pool and NONE of
// them were notebook laws. The embedder now filters, and this is the check that
// the filter is still doing its job — on papers written before it existed, and
// on any written after by a path that forgets.
//
// Exits 1 when any paper violates the rule, so it can gate a generation run
// beside scripts/check-law-area-coverage.mjs.
//
// Read-only, with the direct connection: these are admin-only authoring tables.
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const setArg = process.argv.slice(2).find((a) => a.startsWith("--set="));
const onlySet = setArg ? setArg.slice("--set=".length) : null;

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows } = await client.query(
  `SELECT question_id,
          questions->'exam'->>'title'   AS title,
          questions->'questions'        AS questions,
          question_notebook->'laws'     AS notebook_laws
     FROM public.mahoti_questions
    WHERE questions IS NOT NULL
      ${onlySet ? "AND question_id = $1" : ""}
    ORDER BY created_at`,
  onlySet ? [onlySet] : []
);

// The pool is the authority on what a real question cites, not the copy in the
// paper: a question embedded before section matching existed carries no
// sections in its source, and judging it on that would clear it for exactly the
// reason it was wrongly cleared before.
const pool = new Map(
  (
    await client.query(
      `SELECT paper, number, law_id, law_name, cited_sections
         FROM public.mahoti_real_questions`
    )
  ).rows.map((r) => [`${r.paper}#${r.number}`, r])
);

let papersWithReal = 0;
let embedded = 0;
const violations = [];

for (const row of rows) {
  const notebookIds = new Set((row.notebook_laws ?? []).map((l) => Number(l.law_id)));
  const notebookSections = new Map(
    (row.notebook_laws ?? []).map((l) => [
      Number(l.law_id),
      new Set((l.sections ?? []).map((s) => String(s.number).trim())),
    ])
  );
  const real = (row.questions ?? []).filter((q) =>
    (q.sources ?? []).some((s) => s?.origin === "real_exam")
  );
  if (real.length === 0) continue;
  papersWithReal++;
  embedded += real.length;

  for (const q of real) {
    const source = (q.sources ?? []).find((s) => s?.origin === "real_exam");
    const poolRow = pool.get(`${source?.paper}#${source?.number}`);
    const lawId = poolRow?.law_id ? Number(poolRow.law_id) : null;

    const fail = (why, law) =>
      violations.push({
        question_id: row.question_id,
        title: row.title,
        number: q.number,
        from: `${source?.paper} #${source?.number}`,
        law,
        why,
        notebook_size: notebookIds.size,
      });

    if (!poolRow) {
      fail("not in mahoti_real_questions", "(unknown)");
      continue;
    }
    // No law_id is a violation in its own right, not a lesser state: nothing
    // says the question belongs, and the dashboard files it under ללא סיווג.
    if (lawId === null) {
      fail("no law_id", "(unclassified)");
      continue;
    }
    const law = `${lawId} ${poolRow.law_name ?? ""}`.trim();
    if (!notebookIds.has(lawId)) {
      fail("law not in notebook", law);
      continue;
    }
    const lead = (poolRow.cited_sections ?? [])[0];
    if (!lead || lead.sections.length === 0) {
      fail("key pins no section to that law", law);
      continue;
    }
    const held = notebookSections.get(lawId) ?? new Set();
    const missing = lead.sections.filter((s) => !held.has(String(s)));
    if (missing.length > 0) {
      fail(`section(s) ${missing.join(", ")} not in notebook`, law);
    }
  }
}

console.log(
  `${rows.length} paper(s) checked — ${papersWithReal} carry embedded real questions ` +
    `(${embedded} in total)`
);

if (violations.length === 0) {
  console.log(
    "every embedded real question is grounded in its own paper's notebook, section by section."
  );
  await client.end();
  process.exit(0);
}

console.error(`\n${violations.length} question(s) not grounded in their paper's notebook:\n`);
const byPaper = new Map();
for (const v of violations) byPaper.set(v.question_id, [...(byPaper.get(v.question_id) ?? []), v]);
for (const [questionId, items] of byPaper) {
  console.error(`  ${questionId}  ${items[0].title ?? ""}  (notebook: ${items[0].notebook_size} laws)`);
  for (const v of items) {
    console.error(
      `    #${String(v.number).padStart(2)}  from ${v.from.padEnd(18)}  ${v.why.padEnd(34)}  ${v.law}`
    );
  }
  console.error(
    `    fix: node scripts/mahoti/embed-real-questions.mjs --set=${questionId} --replace-unfit --commit\n`
  );
}

await client.end();
process.exit(1);
