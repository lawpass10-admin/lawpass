// verify_sets.mjs — is every generated question actually a complete set?
//
//   node scripts/ingestion/open_questions/verify_sets.mjs
//   node scripts/ingestion/open_questions/verify_sets.mjs --expect=7
//
// A set is complete when all three parts are present AND JOINED:
//
//   question   open_questions.question   (type = 'new', carries external_id)
//   answer     open_questions.answers    (same row, non-empty array)
//   rubric     open_question_rubrics     (a row whose open_question_id matches)
//
// The join is the point. The rubric lives in its own table — open_questions is
// student-readable and RLS is row-level, so a rubric stored beside the question
// would be one direct query away from being the answer key in a student's
// browser — and the only thing tying the two together is open_question_id.
// A rubric row whose open_question_id matches nothing is invisible to the
// grader; a question with no matching rubric row is a task a student can sit
// and nobody can grade. This checks both directions.
//
// It also re-adds the marks. A rubric whose content items do not sum to 12 out
// of 20 produces grades that cannot be explained to a student who asks, and
// nothing after load_rubric.mjs re-checks that.
//
// READ-ONLY. Three SELECTs, no writes, no model calls, safe to run any time.
// Exit code is 1 if anything is incomplete, or if --expect is given and the
// number of complete sets does not match it.

import pg from 'pg';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const generatedDir = join(here, 'generated');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const argv = process.argv.slice(2);
const expectRaw = argv.find((a) => a.startsWith('--expect='))?.slice('--expect='.length);
const expect = expectRaw === undefined ? null : Number(expectRaw);
if (expect !== null && (!Number.isInteger(expect) || expect < 0)) {
  console.error(`--expect must be a whole number, got "${expectRaw}"`);
  process.exit(2);
}

const CONTENT_MAX = 12;
const TOTAL_POINTS = 20;

// Same resolution order as the loaders: direct host first, pooler second.
async function connect() {
  const direct = process.env.DIRECT_URL;
  const pooled = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!direct && !pooled) throw new Error('neither DIRECT_URL nor DATABASE_URL is set');

  for (const url of [direct, pooled].filter(Boolean)) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      if (err.code !== 'ENOTFOUND' && err.code !== 'EAI_AGAIN') throw err;
    }
  }
  throw new Error('no reachable database host');
}

const client = await connect();
let sets;
let orphanRubrics;
let retired;
try {
  // The join, left from the question side: every generated question, with its
  // rubric if one points back at it. A retired rubric is deliberately excluded —
  // it has been superseded and grades nothing.
  ({ rows: sets } = await client.query(
    `SELECT q.open_question_id,
            q.question->>'external_id'  AS external_id,
            q.subject,
            jsonb_typeof(q.answers)     AS answers_type,
            CASE WHEN jsonb_typeof(q.answers) = 'array'
                 THEN jsonb_array_length(q.answers) ELSE 0 END AS answer_count,
            r.rubric_id,
            r.status                    AS rubric_status,
            r.version                   AS rubric_version,
            r.rubric                    AS rubric
       FROM public.open_questions q
       LEFT JOIN public.open_question_rubrics r
              ON r.open_question_id = q.open_question_id
             AND r.status <> 'retired'
      WHERE q.type = 'new'
      ORDER BY 2`
  ));

  // The same join from the rubric side: a rubric whose open_question_id matches
  // no question at all, or matches one that is not a generated question.
  ({ rows: orphanRubrics } = await client.query(
    `SELECT r.rubric_id, r.open_question_id, r.status, r.version
       FROM public.open_question_rubrics r
       LEFT JOIN public.open_questions q
              ON q.open_question_id = r.open_question_id
      WHERE r.status <> 'retired'
        AND (q.open_question_id IS NULL OR q.type <> 'new')`
  ));

  ({ rows: retired } = await client.query(
    `SELECT COUNT(*)::int AS n FROM public.open_question_rubrics WHERE status = 'retired'`
  ));
} finally {
  await client.end().catch(() => {});
}

// ------------------------------------------------------------- evaluate

function contentTotal(rubric) {
  const items = rubric?.dimensions?.content?.items;
  if (!Array.isArray(items)) return null;
  return Math.round(items.reduce((s, i) => s + Number(i.points || 0), 0) * 100) / 100;
}

// A question can pick up more than one live rubric row — a second load that did
// not retire the first. The join returns one line per rubric, so count them.
const byId = new Map();
for (const row of sets) {
  const key = row.open_question_id;
  if (!byId.has(key)) byId.set(key, { ...row, rubrics: [] });
  if (row.rubric_id) byId.get(key).rubrics.push(row);
}

const evaluated = [...byId.values()].map((q) => {
  const problems = [];
  if (!q.external_id) problems.push('question has no external_id');
  if (q.answer_count < 1) problems.push(`no answer on the row (answers is ${q.answers_type ?? 'null'})`);
  if (q.rubrics.length === 0) problems.push('NO RUBRIC ROW — cannot be graded');
  if (q.rubrics.length > 1) {
    problems.push(`${q.rubrics.length} live rubric rows (v${q.rubrics.map((r) => r.version).join(', v')}) — only one should be live`);
  }

  const live = q.rubrics[0];
  if (live) {
    const total = contentTotal(live.rubric);
    if (total === null) problems.push('rubric has no content items');
    else if (total !== CONTENT_MAX) problems.push(`content items sum to ${total}, must be ${CONTENT_MAX}`);
    if (live.rubric?.total_points !== undefined && Number(live.rubric.total_points) !== TOTAL_POINTS) {
      problems.push(`rubric total_points is ${live.rubric.total_points}, must be ${TOTAL_POINTS}`);
    }
  }

  // Secondary signal only — the database is what decides whether a set is
  // usable. A row can be complete with the files long since tidied away.
  const files = q.external_id
    ? ['generated', 'answer', 'rubric'].filter((k) =>
        existsSync(join(generatedDir, `${q.external_id}.${k}.json`))
      ).length
    : 0;

  return { ...q, live, problems, files, ok: problems.length === 0 };
});

const complete = evaluated.filter((e) => e.ok);
const broken = evaluated.filter((e) => !e.ok);

// ---------------------------------------------------------------- report

const pad = (s, n) => String(s ?? '').padEnd(n);
console.log('');
// Header kept in ASCII: a Hebrew label in a fixed-width column misaligns the
// whole table in most terminals.
console.log(`${pad('external_id', 18)}${pad('answers', 9)}${pad('rubric', 8)}${pad('status', 9)}${pad('ver', 5)}${pad('content', 9)}files`);
console.log('─'.repeat(72));
for (const e of evaluated) {
  const total = e.live ? contentTotal(e.live.rubric) : null;
  console.log(
    pad(e.external_id ?? '(no external_id)', 18) +
      pad(e.answer_count, 9) +
      pad(e.rubrics.length ? 'yes' : 'NO', 8) +
      pad(e.live?.rubric_status ?? '—', 9) +
      pad(e.live?.rubric_version ?? '—', 5) +
      pad(total === null ? "—" : `${total}/${CONTENT_MAX}`, 9) +
      `${e.files}/3`
  );
}
console.log('─'.repeat(72));

console.log(`\n${complete.length} of ${evaluated.length} generated question(s) are a complete set (question + answer + rubric, joined on open_question_id).`);

if (broken.length) {
  console.log('\nINCOMPLETE:');
  for (const e of broken) {
    console.log(`  ${e.external_id ?? e.open_question_id}`);
    for (const p of e.problems) console.log(`      - ${p}`);
  }
}

if (orphanRubrics.length) {
  console.log(`\nORPHAN RUBRICS — ${orphanRubrics.length} live rubric row(s) whose open_question_id matches no generated question:`);
  for (const r of orphanRubrics) {
    console.log(`  rubric_id ${r.rubric_id}  ->  open_question_id ${r.open_question_id}  (${r.status} v${r.version})`);
  }
  console.log('  These grade nothing and are invisible to the grader.');
}

if (retired?.[0]?.n) console.log(`\n(${retired[0].n} retired rubric row(s) ignored — superseded by a later version.)`);

const drafts = complete.filter((e) => e.live?.rubric_status === 'draft').length;
if (drafts) {
  console.log(`\n${drafts} of the complete set(s) carry a DRAFT rubric — those grade nothing until approved.`);
}

if (expect !== null) {
  const met = complete.length === expect;
  console.log(`\n--expect=${expect}: ${met ? 'MET' : `NOT MET — ${complete.length} complete`}`);
  if (!met) process.exitCode = 1;
}
if (broken.length || orphanRubrics.length) process.exitCode = 1;
