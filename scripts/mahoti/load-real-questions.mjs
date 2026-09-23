// load-real-questions.mjs — put the real Bar חלק ג' (דין מהותי) questions into
// public.mahoti_real_questions, the pool a generated paper draws from.
//
//   node scripts/mahoti/load-real-questions.mjs            # dry run
//   node scripts/mahoti/load-real-questions.mjs --commit
//   node scripts/mahoti/load-real-questions.mjs --file=real-questions-2025-12.json --commit
//
// SAFE BY DEFAULT: without --commit this validates, reports exactly what it
// would write, and touches nothing — the insert runs inside a transaction that
// is rolled back, so the counts printed are the real post-load counts.
//
// SOURCE. scripts/mahoti/real-questions.json, built by
// scripts/mahoti/extract-real-questions.mjs from the Bar's own PDFs: the paper
// for the questions and the פתרון וסימוכין for the answer letter and the
// provision it cites.
//
// IDEMPOTENT. Rows are keyed by (paper, number), so re-running refreshes the
// text of a question rather than adding a second copy of it. `review`, `law_id`
// and `law_name` are deliberately NOT touched on an update: the first costs a
// model call to produce and the other two are mapped by hand, and re-loading
// the source file is not a reason to throw either away.
//
// This is the מהותי twin of scripts/diuni/load-real-questions.mjs. It differs
// in three columns the מהותי papers need and the דיוני ones do not —
// shared_passage, linked_numbers, and a nullable fact_pattern.

import dotenv from "dotenv";
import pg from "pg";
import { readFileSync } from "node:fs";
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
const file = flagOf("file") ?? "real-questions.json";

const LETTERS = ["א", "ב", "ג", "ד"];

const source = JSON.parse(readFileSync(join(here, file), "utf8"));
const questions = source.questions ?? [];
if (questions.length === 0) {
  console.error(`no questions in ${file}`);
  process.exit(1);
}

// A question missing any of these would reach a candidate as a broken exam
// question, so it is refused here rather than loaded and discovered later.
// fact_pattern is NOT among them: a knowledge question legitimately has none.
const problems = [];
const rows = [];

questions.forEach((q, i) => {
  const where = `${q.paper ?? "(no paper)"} #${q.number ?? i + 1}`;
  const options = q.options ?? [];

  if (!q.paper) problems.push(`${where}: no paper`);
  if (!Number.isInteger(q.number)) problems.push(`${where}: number is not an integer`);
  if (!String(q.stem ?? "").trim()) problems.push(`${where}: empty stem`);
  if (options.length !== 4) problems.push(`${where}: ${options.length} options, expected 4`);
  for (const letter of LETTERS) {
    const option = options.find((o) => o?.letter === letter);
    if (!option) problems.push(`${where}: no option ${letter}`);
    else if (!String(option.text ?? "").trim()) problems.push(`${where}: option ${letter} is empty`);
  }
  if (!LETTERS.includes(q.correct_answer)) {
    problems.push(`${where}: correct_answer is ${JSON.stringify(q.correct_answer)}`);
  }
  // A stem is a question: it ends in "?" or, for the ones phrased as a lead-in
  // ("...שלושת מבחני העזר הם:"), in a colon. A stem that ends in neither is the
  // shape a failed split leaves behind — the extractor took a sentence out of
  // the middle of the facts — and it is worth refusing before it is loaded.
  // Length is NOT the test: "?מהו תחלוף בדיני ביטוח" is 24 characters and whole.
  if (!/[?:]$/.test(String(q.stem ?? "").trim())) {
    problems.push(`${where}: stem ends in neither "?" nor ":" — ${JSON.stringify(q.stem)}`);
  }

  rows.push({
    paper: q.paper,
    number: q.number,
    shared_passage: q.shared_passage ?? null,
    linked_numbers: q.linked_numbers ?? null,
    fact_pattern: q.fact_pattern ?? null,
    stem: q.stem,
    options,
    correct_answer: q.correct_answer,
    source_citation: q.source_citation ?? null,
  });
});

// (paper, number) is the key, so a duplicate inside ONE file would make the
// upsert write the same row twice in one statement — Postgres rejects that
// outright ("ON CONFLICT DO UPDATE command cannot affect row a second time").
const seen = new Set();
for (const row of rows) {
  const key = `${row.paper}#${row.number}`;
  if (seen.has(key)) problems.push(`${key}: appears twice in ${file}`);
  seen.add(key);
}

const byPaper = new Map();
for (const row of rows) byPaper.set(row.paper, (byPaper.get(row.paper) ?? 0) + 1);

console.log(`${file}: ${rows.length} question(s)`);
for (const [paper, n] of byPaper) console.log(`  ${paper}  ${n}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");

  for (const row of rows) {
    await client.query(
      `INSERT INTO public.mahoti_real_questions
         (paper, number, shared_passage, linked_numbers, fact_pattern, stem,
          options, correct_answer, source_citation)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT (paper, number) DO UPDATE SET
         shared_passage  = EXCLUDED.shared_passage,
         linked_numbers  = EXCLUDED.linked_numbers,
         fact_pattern    = EXCLUDED.fact_pattern,
         stem            = EXCLUDED.stem,
         options         = EXCLUDED.options,
         correct_answer  = EXCLUDED.correct_answer,
         source_citation = EXCLUDED.source_citation`,
      [
        row.paper,
        row.number,
        row.shared_passage,
        row.linked_numbers,
        row.fact_pattern,
        row.stem,
        JSON.stringify(row.options),
        row.correct_answer,
        row.source_citation,
      ]
    );
  }

  const total = await client.query(`SELECT count(*)::int n FROM public.mahoti_real_questions`);
  const reviewed = await client.query(
    `SELECT count(*)::int n FROM public.mahoti_real_questions WHERE review IS NOT NULL`
  );
  const spread = await client.query(
    `SELECT correct_answer, count(*)::int n
       FROM public.mahoti_real_questions
      GROUP BY correct_answer ORDER BY correct_answer`
  );

  if (commit) {
    await client.query("COMMIT");
    console.log(`\nCOMMITTED — the pool now holds ${total.rows[0].n} question(s).`);
  } else {
    await client.query("ROLLBACK");
    console.log(`\ndry run — would leave ${total.rows[0].n} question(s) in the pool. Pass --commit to write.`);
  }

  // A key read one row out of step still loads cleanly and is wrong in every
  // question. A lopsided spread of correct letters is the cheapest sign of it.
  console.log(
    `answers: ${spread.rows.map((r) => `${r.correct_answer} ${r.n}`).join("  ")}`
  );
  console.log(
    `${reviewed.rows[0].n} of them carry a 360° review; the rest need a review ` +
      `pass before a paper can draw them.`
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
