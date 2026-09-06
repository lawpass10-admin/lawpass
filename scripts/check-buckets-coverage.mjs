// check-buckets-coverage.mjs — does every question the generators can produce
// still resolve to a reporting bucket?
//
//   node scripts/check-buckets-coverage.mjs
//
// Read-only. No model calls, no writes, nothing billed.
//
// WHY THIS EXISTS. The dashboard groups a candidate's history by legal area,
// using lawpass_server/lib/buckets_mapping.json. That file is checked for
// internal consistency when the server loads — an area in two buckets, a law
// pointing at an area that does not exist — but nothing checks it against the
// CONTENT, and the content grows.
//
// The failure that matters is silent. Scrape a new law into `mahoti_laws` and
// every question built from it resolves to no area at all, so it pools into
// "ללא סיווג" on the dashboard with no error anywhere. A candidate then reads a
// revision chart with a growing unlabelled slice and no way to know why.
//
// A new judgment area is the benign case by comparison: it falls through the
// mapping under its own name, which is visible and self-announcing. This script
// reports both, and exits non-zero on either, so it can gate a data import.
//
// RUN IT AFTER: importing laws into mahoti_laws, importing or re-classifying
// judgments in verdict_list, or editing buckets_mapping.json by hand.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const require = createRequire(import.meta.url);

const dotenv = require("dotenv");
dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(2);
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// The service-role client is used because mahoti_questions / diuni_questions are
// admin-only under RLS. This reads content, never a candidate's answers.
const { areaForLaw, AREA_GROUPS_SPEC, MAPPING_PATH } = require(
  join(appRoot, "lawpass_server", "db", "legal-areas.js")
);
const mahotiDb = require(join(appRoot, "lawpass_server", "db", "mahoti.js"));
const diuniDb = require(join(appRoot, "lawpass_server", "db", "diuni.js"));

const bucketed = new Set(Object.values(AREA_GROUPS_SPEC).flat());
const bucketNames = new Set(Object.keys(AREA_GROUPS_SPEC));

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`   FAIL  ${msg}`);
};
const ok = (msg) => console.log(`   ok    ${msg}`);

console.log(`mapping: ${MAPPING_PATH.replace(/\\/g, "/").split("/app/").pop()}`);
console.log(`         ${bucketNames.size} buckets, ${bucketed.size} areas\n`);

// --- 1. the statute corpus -------------------------------------------------
//
// Every row here is material the mahoti generator samples from, and the law half
// of a diuni paper too.

console.log("1. laws the generators can draw from (mahoti_laws)");
const { data: laws, error: lawsError } = await sb
  .from("mahoti_laws")
  .select("law_id, law_name");
if (lawsError) {
  fail(`could not read mahoti_laws: ${lawsError.message}`);
} else {
  const unmapped = laws.filter((l) => !areaForLaw(l.law_id));
  const unbucketed = laws.filter((l) => {
    const area = areaForLaw(l.law_id);
    return area && !bucketed.has(area);
  });

  if (unmapped.length) {
    fail(
      `${unmapped.length} of ${laws.length} law(s) are NOT in law_areas — questions ` +
        `built from them report as "ללא סיווג", silently:`
    );
    for (const l of unmapped) console.log(`           ${l.law_id}  ${l.law_name}`);
    console.log(`         Add them to "law_areas" in ${"buckets_mapping.json"}.`);
  }
  if (unbucketed.length) {
    fail(`${unbucketed.length} law(s) map to an area that is in no bucket:`);
    for (const l of unbucketed) {
      console.log(`           ${l.law_id}  ${l.law_name}  ->  ${areaForLaw(l.law_id)}`);
    }
  }
  if (!unmapped.length && !unbucketed.length) {
    ok(`all ${laws.length} laws resolve to a bucket`);
  }
}

// --- 2. the judgment corpus ------------------------------------------------

console.log("\n2. judgment areas the diuni generator can draw from (verdict_list)");
let rows = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from("verdict_list")
    .select("judgment_area")
    .range(from, from + 999);
  if (error) {
    fail(`could not read verdict_list: ${error.message}`);
    break;
  }
  if (!data?.length) break;
  rows = rows.concat(data);
  if (data.length < 1000) break;
}
const areas = [...new Set(rows.map((r) => r.judgment_area).filter(Boolean))];
const unbucketedAreas = areas.filter((a) => !bucketed.has(a));
if (unbucketedAreas.length) {
  fail(
    `${unbucketedAreas.length} of ${areas.length} area(s) are in no bucket — they ` +
      `report under their own name, one question each:`
  );
  for (const a of unbucketedAreas) console.log(`           ${a}`);
  console.log(`         Add them to a bucket in ${"buckets_mapping.json"}.`);
} else {
  ok(`all ${areas.length} judgment areas (${rows.length} judgments) resolve to a bucket`);
}

// --- 3. the papers as they actually resolve --------------------------------
//
// The end-to-end check: not "is the vocabulary covered" but "does every question
// already written come out with a bucket". Catches anything the two checks above
// cannot see, such as a question whose source row was deleted.

console.log("\n3. every question in every paper already written");
for (const [label, table, db] of [
  ["mahoti", "mahoti_questions", mahotiDb],
  ["diuni", "diuni_questions", diuniDb],
]) {
  const { data: papers, error } = await sb
    .from(table)
    .select("question_id")
    .not("questions", "is", null);
  if (error) {
    fail(`could not read ${table}: ${error.message}`);
    continue;
  }

  let total = 0;
  const orphans = [];
  for (const p of papers ?? []) {
    const key = await db.getAnswerKey(sb, p.question_id);
    for (const entry of key ?? []) {
      total++;
      const resolved = entry.area && (bucketed.has(entry.area) || bucketNames.has(entry.area));
      if (!resolved) {
        orphans.push(`${p.question_id.slice(0, 8)}… Q${entry.number} -> ${entry.area ?? "null"}`);
      }
    }
  }

  if (orphans.length) {
    fail(`${label}: ${orphans.length} of ${total} question(s) do not resolve to a bucket:`);
    for (const o of orphans.slice(0, 10)) console.log(`           ${o}`);
    if (orphans.length > 10) console.log(`           …and ${orphans.length - 10} more`);
  } else {
    ok(`${label}: all ${total} questions across ${papers?.length ?? 0} paper(s) resolve`);
  }
}

console.log("");
if (failures === 0) {
  console.log("PASS — every question the generators can produce resolves to a bucket.");
  process.exit(0);
}
console.log(`FAIL — ${failures} problem(s) above. Until they are fixed, the affected`);
console.log("questions group under an unintended heading on the dashboard.");
process.exit(1);
