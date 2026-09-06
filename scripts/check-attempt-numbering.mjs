// check-attempt-numbering.mjs — is `attempts` numbered correctly in the live
// answer tables, for both subjects?
//
//   node scripts/check-attempt-numbering.mjs
//
// Read-only. No writes, no model calls, nothing billed.
//
// RE-SITTING IS NOT A FAULT. Neither mahoti_answers nor diuni_answers caps
// attempts or constrains (user_id, question_id) to be unique — sitting a paper
// three times is supported, and the dashboard's sitting picker depends on it.
// This checks only that the NUMBERS are right: 1, 2, 3 … per candidate per
// paper, no gaps, no repeats, no zero.
//
// The rule itself lives in lawpass_server/lib/marking/attempt-numbering.js and
// is unit-tested there, so the live data and the fixtures are judged by exactly
// the same code.
//
// Exits non-zero on any problem, so it can gate a deploy or a data import.

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

const { auditAttemptNumbering } = require(
  join(appRoot, "lawpass_server", "lib", "marking", "attempt-numbering.js")
);

let failures = 0;

for (const [label, table] of [
  ["דין מהותי", "mahoti_answers"],
  ["דין דיוני", "diuni_answers"],
]) {
  const { data, error } = await sb
    .from(table)
    .select("user_id, question_id, attempts, answer_score, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.log(`${table}: FAILED to read — ${error.message}`);
    failures++;
    continue;
  }

  const { problems, pairs, rows } = auditAttemptNumbering(data ?? []);
  console.log(`${table}  (${label})`);
  console.log(`   rows                 : ${rows}`);
  console.log(`   (candidate, paper)   : ${pairs}`);

  // Re-sits are reported as information, never as a fault — seeing the spread
  // is useful, and calling it a problem would be wrong.
  const counts = new Map();
  for (const r of data ?? []) {
    const k = `${r.user_id}|${r.question_id}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const resits = [...counts.values()].filter((n) => n > 1).length;
  const deepest = counts.size ? Math.max(...counts.values()) : 0;
  console.log(`   pairs with re-sits   : ${resits}  (deepest: ${deepest} sittings) — supported`);

  if (problems.length) {
    failures += problems.length;
    console.log(`   PROBLEMS             : ${problems.length}`);
    for (const p of problems) console.log(`      ${p}`);
  } else {
    console.log(`   numbering            : ok — 1..n per candidate per paper`);
  }
  console.log("");
}

if (failures === 0) {
  console.log("PASS — attempt numbering is correct in both tables.");
  process.exit(0);
}
console.log(`FAIL — ${failures} problem(s). A candidate's sittings would be`);
console.log("mislabelled in the dashboard's picker until they are fixed.");
process.exit(1);
