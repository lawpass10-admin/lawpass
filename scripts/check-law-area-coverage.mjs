// Which laws used by stored exam papers have no area in buckets_mapping.json.
//
//   node scripts/check-law-area-coverage.mjs
//
// WHY THIS EXISTS. The dashboard's "תחום התמחות" charts group a question by the
// AREA of the law it was built from (lawpass_server/db/legal-areas.js). A law
// with no entry in the mapping is not an error anywhere — the question simply
// lands under "ללא סיווג", which looks like data rather than a gap. 47 of 366
// mahoti questions sat there before anyone noticed, across 14 laws.
//
// So the gap is only visible if something goes looking. Run this after
// generating a paper, or whenever "ללא סיווג" appears on a chart: it names the
// laws to add, with the id to key them by and the question count to say how much
// it matters. Exits 1 when any are missing, so it can gate a generation run.
//
// Read-only, and reads the papers with the service-role client — they are
// authoring content in admin-only tables.
import pg from "pg";
import dotenv from "dotenv";
import { createRequire } from "node:module";

dotenv.config({ path: ".env.local" });
dotenv.config();

const require = createRequire(import.meta.url);
const { areaForLaw, MAPPING_PATH } = require("../lawpass_server/db/legal-areas.js");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const unmapped = new Map();
let total = 0;
let mapped = 0;

for (const table of ["mahoti_questions", "diuni_questions"]) {
  const { rows } = await client.query(
    `SELECT questions FROM public.${table} WHERE questions IS NOT NULL`
  );
  for (const row of rows) {
    for (const question of row.questions?.questions ?? []) {
      const source = (question.sources ?? [])[0];
      // A diuni question grounded in a judgment takes its area from
      // verdict_list, not from this mapping — not a gap this can see.
      if (!source?.law_id) continue;
      total++;
      if (areaForLaw(source.law_id)) {
        mapped++;
        continue;
      }
      const entry = unmapped.get(source.law_id) ?? {
        name: source.law_name ?? "(unnamed)",
        questions: 0,
        table,
      };
      entry.questions += 1;
      unmapped.set(source.law_id, entry);
    }
  }
}

await client.end();

console.log(`law-grounded questions: ${total} · classified ${mapped} · unclassified ${total - mapped}`);

if (unmapped.size === 0) {
  console.log("\nevery law used by a paper has an area — nothing to add");
  process.exit(0);
}

console.log(`\n${unmapped.size} law(s) missing from ${MAPPING_PATH}:\n`);
for (const [lawId, entry] of [...unmapped].sort((a, b) => b[1].questions - a[1].questions)) {
  console.log(`  "${lawId}": { "law": ${JSON.stringify(entry.name)}, "area": "???" },   // ${entry.questions} question(s), ${entry.table}`);
}
console.log(
  "\nFill each \"???\" with an area that appears in exactly one bucket of the same file,\n" +
    "then re-run. Requiring the file is enough to validate it — it throws on a bad area."
);
process.exit(1);
