// load_verdicts.mjs — load scraped judgments into public.verdict_list.
//
// Reads the enrichment pipeline's output (an array of judgment objects) and
// upserts one row per judgment, keyed on `url`. Re-running after a re-scrape
// REFRESHES the rows it already has rather than duplicating them, so this is
// safe to point at a growing file repeatedly.
//
// SAFE BY DEFAULT: without --commit this connects, validates, reports exactly
// what it would write, and rolls back. Nothing reaches the table until you pass
// --commit deliberately.
//
// Usage:
//   node scripts/ingestion/verdicts/load_verdicts.mjs <file.json>
//   node scripts/ingestion/verdicts/load_verdicts.mjs <file.json> --commit
//
// The path may be absolute or relative to where you run it. A Windows path with
// spaces or Hebrew in it must be quoted.

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');

dotenv.config({ path: join(appRoot, '.env.local') });
dotenv.config({ path: join(appRoot, '.env') });

const argv = process.argv.slice(2);
const commit = argv.includes('--commit');
const fileArgs = argv.filter((a) => !a.startsWith('--'));

if (fileArgs.length !== 1) {
  console.error('usage: node load_verdicts.mjs <enriched.json> [--commit]');
  process.exit(1);
}

const filePath = isAbsolute(fileArgs[0])
  ? fileArgs[0]
  : resolve(process.cwd(), fileArgs[0]);

if (!existsSync(filePath)) {
  console.error(`file not found: ${filePath}`);
  process.exit(1);
}

// --------------------------------------------------------------- parse

/**
 * "29.08.2026" -> "2026-08-29".
 *
 * The scraper writes DD.MM.YYYY. Handing that to Postgres directly is a coin
 * flip on the server's DateStyle — 03.04.2026 is either March or April — so the
 * conversion happens here, explicitly, and an unrecognised value becomes NULL
 * rather than a wrong date. A judgment with no usable date is still worth
 * storing; a judgment filed under the wrong one is not.
 */
function toIsoDate(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Always an array of strings, whatever the field turns out to hold. */
function toTextArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' && v.trim() !== '');
}

const raw = JSON.parse(readFileSync(filePath, 'utf8'));
const records = Array.isArray(raw) ? raw : [raw];

const rows = [];
const skipped = [];
const badDates = [];

for (const [i, r] of records.entries()) {
  // url and full text are the two fields nothing downstream works without: the
  // first is the upsert key, the second is the reason for the row. Anything
  // missing either is reported and left out rather than inserted half-formed.
  if (!r?.url || typeof r.url !== 'string') {
    skipped.push(`#${i}: no url`);
    continue;
  }
  if (typeof r.text !== 'string' || r.text.trim() === '') {
    skipped.push(`#${i}: no text (${r.url})`);
    continue;
  }

  const decidedOn = toIsoDate(r.date);
  if (r.date && !decidedOn) badDates.push(`${r.date} (${r.case_number ?? r.url})`);

  rows.push({
    url: r.url,
    post_id: Number.isFinite(r.post_id) ? r.post_id : null,
    title: typeof r.title === 'string' && r.title.trim() ? r.title : r.url,
    decided_on: decidedOn,
    court: r.court ?? null,
    doc_type: r.doc_type ?? null,
    case_number: r.case_number ?? null,
    category: r.category ?? null,
    judge: r.judge ?? null,
    // The column is jsonb shaped { body: … } — a container the scraper's flat
    // string goes into under a named key, so segmented judgments can be added
    // alongside it later without a migration. The table's CHECK requires the
    // key, and everything that reads the judgment goes through ->>'body'.
    full_text: JSON.stringify({ body: r.text }),
    judgment_topic: r.judgment_topic ?? null,
    judgment_area: r.judgment_area ?? null,
    judgment_area_id: r.judgment_area_id ?? null,
    judgment_area_category: r.judgment_area_category ?? null,
    judgment_area_category_id: r.judgment_area_category_id ?? null,
    judgment_area_confidence: r.judgment_area_confidence ?? null,
    judgment_area_matched: toTextArray(r.judgment_area_matched),
    judgment_area_alternatives: toTextArray(r.judgment_area_alternatives),
  });
}

// Two records in one file claiming the same url would make the upsert fire
// twice in one statement, which Postgres refuses. Catch it here with a message
// that names the duplicate instead of surfacing an ON CONFLICT error.
const seen = new Set();
for (const row of rows) {
  if (seen.has(row.url)) {
    console.error(`duplicate url within the file: ${row.url}`);
    process.exit(1);
  }
  seen.add(row.url);
}

console.log(`file      : ${filePath}`);
console.log(`records   : ${records.length}`);
console.log(`loadable  : ${rows.length}`);
if (skipped.length) console.log(`skipped   : ${skipped.length}\n  - ${skipped.join('\n  - ')}`);
if (badDates.length) {
  console.log(`unparsed dates (stored NULL): ${badDates.length}`);
  for (const d of badDates) console.log(`  - ${d}`);
}
if (rows.length === 0) process.exit(1);

// --------------------------------------------------------------- connect
//
// Same strategy as scripts/apply-sql.mjs: prefer DIRECT_URL, fall back to the
// pooler. Hardening Rule #1 — the pooled URL is the production-safe one.
const directUrl = process.env.DIRECT_URL;
const pooledUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!directUrl && !pooledUrl) {
  console.error('no DIRECT_URL or DATABASE_URL in .env.local');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: directUrl || pooledUrl,
  ssl: { rejectUnauthorized: false },
});

const COLUMNS = [
  'url', 'post_id', 'title', 'decided_on', 'court', 'doc_type', 'case_number',
  'category', 'judge', 'full_text', 'judgment_topic', 'judgment_area',
  'judgment_area_id', 'judgment_area_category', 'judgment_area_category_id',
  'judgment_area_confidence', 'judgment_area_matched', 'judgment_area_alternatives',
];

// Everything except the key is refreshed on conflict; scraped_at records that
// this row was seen again. created_at is left alone on purpose — it is when the
// judgment first arrived here, and a re-scrape does not change that.
const UPDATE_SET = COLUMNS
  .filter((c) => c !== 'url')
  .map((c) => `${c} = EXCLUDED.${c}`)
  .concat('scraped_at = now()')
  .join(',\n    ');

const SQL = `
  INSERT INTO public.verdict_list (${COLUMNS.join(', ')})
  VALUES (${COLUMNS.map((_, i) => `$${i + 1}`).join(', ')})
  ON CONFLICT (url) DO UPDATE SET
    ${UPDATE_SET}
  RETURNING (xmax = 0) AS inserted
`;

let inserted = 0;
let updated = 0;

await client.connect();
try {
  await client.query('BEGIN');

  for (const row of rows) {
    const result = await client.query(SQL, COLUMNS.map((c) => row[c]));
    if (result.rows[0].inserted) inserted++;
    else updated++;
  }

  if (commit) {
    await client.query('COMMIT');
    console.log(`\nCOMMITTED — ${inserted} inserted, ${updated} refreshed.`);
  } else {
    await client.query('ROLLBACK');
    console.log(`\nDRY RUN — rolled back. ${inserted} would be inserted, ${updated} refreshed.`);
    console.log('Pass --commit to write them.');
  }
} catch (err) {
  await client.query('ROLLBACK');
  console.error(`\nFAILED — rolled back. ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
