// load-real-questions.mjs — put the real Bar questions into
// public.diuni_real_questions, the pool a generated paper draws from.
//
//   node scripts/diuni/load-real-questions.mjs            # dry run
//   node scripts/diuni/load-real-questions.mjs --commit
//   node scripts/diuni/load-real-questions.mjs --file=exemplars-2025-04-28.json --commit
//
// SAFE BY DEFAULT: without --commit this validates, reports exactly what it
// would write, and touches nothing.
//
// SOURCE. scripts/diuni/exemplars.json — the merged extraction of three real
// sittings (scripts/diuni/extract-exam-pdf.mjs). The file keeps its job as the
// generator's style exemplars; this copies the same questions into a table so a
// paper can also SIT them.
//
// IDEMPOTENT. Rows are keyed by (paper, number), so re-running refreshes the
// text of a question rather than adding a second copy of it. The `review`
// column is deliberately NOT touched on an update: it costs a model call to
// produce (generate-real-reviews.mjs) and re-loading the source file is not a
// reason to throw it away.

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
const file = flagOf("file") ?? "exemplars.json";

const LETTERS = ["א", "ב", "ג", "ד"];

const source = JSON.parse(readFileSync(join(here, file), "utf8"));
const questions = source.questions ?? [];
if (questions.length === 0) {
  console.error(`no questions in ${file}`);
  process.exit(1);
}

// A question missing any of these would reach a candidate as a broken exam
// question, so it is refused here rather than loaded and discovered later.
const problems = [];
const rows = [];

questions.forEach((q, i) => {
  const where = `${q.paper ?? "(no paper)"} #${q.number ?? i + 1}`;
  const options = q.options ?? [];

  if (!q.paper) problems.push(`${where}: no paper`);
  if (!Number.isInteger(q.number)) problems.push(`${where}: number is not an integer`);
  // fact_pattern is NOT required: a knowledge question — "?מה כלול בחלקו השני
  // של כתב הגנה" — has a stem and no facts, and never had any. See
  // 20260924000001. The stem still is: a question without one is what a failed
  // extraction leaves behind.
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

  rows.push({
    paper: q.paper,
    number: q.number,
    // "" and undefined both mean "this question has no facts"; the column
    // takes NULL for that, not an empty string that renders as a blank block.
    fact_pattern: String(q.fact_pattern ?? "").trim() || null,
    stem: q.stem,
    options,
    correct_answer: q.correct_answer,
    source_citation: q.source_citation ?? null,
  });
});

// (paper, number) is the key, so a duplicate inside ONE file would make the
// upsert write the same row twice in one statement — Postgres rejects that
// outright ("ON CONFLICT DO UPDATE command cannot affect row a second time").
const seen = new Map();
for (const row of rows) {
  const key = `${row.paper}#${row.number}`;
  if (seen.has(key)) problems.push(`${key}: appears twice in ${file}`);
  seen.set(key, true);
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
      `INSERT INTO public.diuni_real_questions
         (paper, number, fact_pattern, stem, options, correct_answer, source_citation)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (paper, number) DO UPDATE SET
         fact_pattern    = EXCLUDED.fact_pattern,
         stem            = EXCLUDED.stem,
         options         = EXCLUDED.options,
         correct_answer  = EXCLUDED.correct_answer,
         source_citation = EXCLUDED.source_citation`,
      [
        row.paper,
        row.number,
        row.fact_pattern,
        row.stem,
        JSON.stringify(row.options),
        row.correct_answer,
        row.source_citation,
      ]
    );
  }

  const total = await client.query(`SELECT count(*)::int n FROM public.diuni_real_questions`);
  const reviewed = await client.query(
    `SELECT count(*)::int n FROM public.diuni_real_questions WHERE review IS NOT NULL`
  );

  if (commit) {
    await client.query("COMMIT");
    console.log(`\nCOMMITTED — the pool now holds ${total.rows[0].n} question(s).`);
  } else {
    await client.query("ROLLBACK");
    console.log(`\ndry run — would leave ${total.rows[0].n} question(s) in the pool. Pass --commit to write.`);
  }

  console.log(
    `${reviewed.rows[0].n} of them carry a 360° review; the rest need ` +
      `scripts/diuni/generate-real-reviews.mjs before a paper can draw them.`
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
