// map-real-question-laws.mjs — fill law_id / law_name on
// public.mahoti_real_questions from the citation the Bar's answer key printed.
//
//   node scripts/mahoti/map-real-question-laws.mjs            # dry run
//   node scripts/mahoti/map-real-question-laws.mjs --commit
//   node scripts/mahoti/map-real-question-laws.mjs --unmatched # just list the misses
//
// WHY IT MATTERS TWICE.
//
//  1. THE PAPER MUST STAY INSIDE ITS NOTEBOOK. A generated מהותי paper is built
//     from one notebook — 25 laws sampled from the corpus — and every generated
//     question on it is answerable from those 25. A real question embedded in it
//     has to belong to the same 25, or the paper quietly becomes a paper about
//     something else: a candidate revising חוק ההתיישנות meets a question on
//     חוק הנוער. embed-real-questions.mjs filters on this column to prevent that,
//     which it can only do once the column is filled.
//
//  2. THE DASHBOARD CLASSIFIES BY law_id. lawpass_server/db/mahoti.js resolves a
//     question's topic from sources[0].law_id. Without one, every embedded real
//     question reports as ללא סיווג.
//
// EXACT NAME MATCH, NOT INFERENCE. A citation resolves only when it reproduces
// a corpus law's name (see law-matching.mjs for the four spelling differences
// that are flattened first). Anything else is left NULL — the migration's own
// rule: "not yet classified" rather than a guess. 4 of the 157 land there,
// and so do the ones citing a judgment alone ("רע\"א 1272/05 כרמי נ' סבן").
//
// A KEY THAT NAMES TWO LAWS records the one it leads with, which is the one the
// answer turns on; the rest are reported so a human can overrule.

import dotenv from "dotenv";
import pg from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLawIndex, matchCitation } from "./law-matching.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const commit = argv.includes("--commit");
const onlyUnmatched = argv.includes("--unmatched");
// Without this, a row that already carries a law_id is left alone — a hand
// correction must survive a re-run of an automated mapper.
const redo = argv.includes("--redo");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const index = buildLawIndex((await client.query("SELECT law_id, law_name FROM public.mahoti_laws")).rows);

  const { rows } = await client.query(
    `SELECT real_question_id, paper, number, source_citation, law_id
       FROM public.mahoti_real_questions
      ${redo ? "" : "WHERE law_id IS NULL OR cited_sections IS NULL"}
      ORDER BY paper, number`
  );

  const matched = [];
  const missed = [];
  const multi = [];
  let sectionless = 0;

  let spacedFallback = 0;
  for (const row of rows) {
    const { hits, cited, spaced } = matchCitation(row.source_citation, index);
    if (hits.length === 0) {
      missed.push(row);
      continue;
    }
    if (hits.length > 1) multi.push({ row, hits });
    if (spaced) spacedFallback++;
    if (cited[0].sections.length === 0) sectionless++;
    matched.push({ row, lead: hits[0], hits, cited });
  }

  console.log(`${rows.length} row(s) considered${redo ? " (--redo)" : " (law_id IS NULL)"}`);
  console.log(`  resolved to a corpus law : ${matched.length}`);
  console.log(`  left unclassified        : ${missed.length}`);
  console.log(`  citation named >1 law    : ${multi.length} (the leading one is recorded)`);
  console.log(`  no section pinned to the leading law : ${sectionless}`);
  console.log(`  resolved only with spaces removed    : ${spacedFallback}`);

  if (onlyUnmatched || missed.length > 0) {
    console.log(`\nunclassified (${missed.length}):`);
    for (const r of missed) console.log(`  ${r.paper}#${r.number}  ${String(r.source_citation ?? "").slice(0, 88)}`);
  }
  if (onlyUnmatched) {
    process.exit(0);
  }

  const byLaw = new Map();
  for (const m of matched) byLaw.set(m.lead.law_name, (byLaw.get(m.lead.law_name) ?? 0) + 1);
  console.log(`\nresolved, by law (${byLaw.size} distinct):`);
  for (const [name, n] of [...byLaw.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${name}`);
  }

  if (!commit) {
    console.log("\ndry run — nothing written. Pass --commit to apply.");
    process.exit(0);
  }

  await client.query("BEGIN");
  for (const m of matched) {
    await client.query(
      `UPDATE public.mahoti_real_questions
          SET law_id = $1, law_name = $2, cited_sections = $3::jsonb
        WHERE real_question_id = $4`,
      [m.lead.law_id, m.lead.law_name, JSON.stringify(m.cited), m.row.real_question_id]
    );
  }
  await client.query("COMMIT");

  const total = await client.query(
    `SELECT count(*)::int all_rows,
            count(law_id)::int classified,
            count(cited_sections)::int with_sections
       FROM public.mahoti_real_questions`
  );
  console.log(
    `\nCOMMITTED — ${total.rows[0].classified}/${total.rows[0].all_rows} real questions carry a law_id, ` +
      `${total.rows[0].with_sections} carry their cited sections.`
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
