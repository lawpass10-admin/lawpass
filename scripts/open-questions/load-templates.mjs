// load-templates.mjs — put the legal-writing skeletons into
// public.open_question_templates, and map each one to the open-question
// subjects it serves.
//
//   node scripts/open-questions/load-templates.mjs            # dry run
//   node scripts/open-questions/load-templates.mjs --commit
//   node scripts/open-questions/load-templates.mjs --keep-subjects --commit
//
// SAFE BY DEFAULT: without --commit this validates, reports exactly what it
// would write, and touches nothing.
//
// IDEMPOTENT. Rows are keyed by `number` — the number the source document
// prints — so re-running refreshes a template rather than adding a second copy.
//
// HOW A TEMPLATE FINDS ITS QUESTION: legal_area, set here from the part the
// template is printed under. A question reaches an area through
// open_question_subject_areas (migration 20260924000003), and the two areas are
// joined. Nothing in this file decides which SUBJECT a template serves any
// more — that was the old key, and it meant editing up to 36 rows to introduce
// one subject while leaving 18 templates reachable by nothing.
//
// template_subjects is still written, because the column still exists and
// dropping a populated column is a statement someone should look at first. It
// is no longer read. `--keep-subjects` therefore only affects that dead column.
//
// To add a subject: one row in open_question_subject_areas. Not this file.

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
const keepSubjects = argv.includes("--keep-subjects");
const file = flagOf("file") ?? "templates.json";

/**
 * Template numbers -> the open_questions.subject values they serve.
 *
 * Keyed by number rather than by part so that a single template can be moved
 * without rewriting a range, and so a reviewer can see exactly what each one
 * claims. The five תבנית כללית templates are not here: they fit any subject and
 * are mapped to every subject present in open_questions at load time.
 */
/**
 * Part -> legal area. The part a template is printed under IS its area; this
 * only translates the printed Hebrew into the key both sides join on
 * (open_question_legal_areas, migration 20260924000003).
 *
 * ח' ערעורים, ט' סיכומים and י' מכתב משפטי are document stages rather than
 * fields of law — an appeal is an appeal in a civil, labour or administrative
 * matter alike — so they are 'general' and offered for every area.
 */
const PART_AREA = [
  [/^חלק א/, "civil"],
  [/^חלק ב/, "labour"],
  [/^חלק ג/, "administrative"],
  [/^חלק ד/, "criminal"],
  [/^חלק ה/, "family"],
  [/^חלק ו/, "property"],
  [/^חלק ז/, "insolvency"],
];

const areaForPart = (part) =>
  PART_AREA.find(([re]) => re.test(String(part ?? "")))?.[1] ?? "general";

const AREA_SUBJECTS = [
  {
    why: "חלק א' – הליכים אזרחיים: the civil-procedure skeletons; 1-3 cite תקסד\"א themselves",
    numbers: [1, 2, 3, 4, 5, 6, 7],
    subjects: ['תקנות סדר הדין האזרחי, תשע"ט-2018'],
  },
  {
    why: "חלק ב' – דיני עבודה: the labour-court skeletons",
    numbers: [8, 9, 10],
    subjects: ["מילפלדר נ' בית הדין הארצי לעבודה"],
  },
  {
    why: "חלק ג' – משפט מנהלי: administrative and constitutional petitions",
    numbers: [11, 12, 13],
    subjects: [
      'חוק חופש המידע, התשנ"ח-1998',
      "חוק-יסוד: השפיטה",
      "התנועה למען איכות השלטון בישראל נ' משטרת ישראל",
    ],
  },
];

const source = JSON.parse(readFileSync(join(here, file), "utf8"));
const templates = source.templates ?? [];
if (templates.length === 0) {
  console.error(`no templates in ${file}`);
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
  // The subjects that actually exist. Read rather than assumed: a mapping that
  // names a subject no question carries is a typo, and silently loading it
  // would leave a template that can never be found.
  const present = new Set(
    (
      await client.query(
        "SELECT DISTINCT subject FROM public.open_questions WHERE subject IS NOT NULL"
      )
    ).rows.map((r) => r.subject)
  );

  const byNumber = new Map();
  for (const area of AREA_SUBJECTS) {
    for (const n of area.numbers) byNumber.set(n, area.subjects);
  }

  const problems = [];
  for (const area of AREA_SUBJECTS) {
    for (const s of area.subjects) {
      if (!present.has(s)) problems.push(`mapping names a subject no question has: ${JSON.stringify(s)}`);
    }
  }

  const allSubjects = [...present].sort();
  const rows = templates.map((t) => {
    const where = `#${t.number} ${t.title}`;
    if (!Number.isInteger(t.number)) problems.push(`${where}: number is not an integer`);
    if (!String(t.part ?? "").trim()) problems.push(`${where}: no part`);
    if (!String(t.title ?? "").trim()) problems.push(`${where}: no title`);
    if (String(t.body ?? "").trim().length < 40) problems.push(`${where}: body is ${String(t.body ?? "").length} chars`);
    return {
      number: t.number,
      part: t.part,
      title: t.title,
      summary: t.summary ?? null,
      body: t.body,
      is_generic: Boolean(t.is_generic),
      // A generic template fits whatever subjects exist; the rest get their area.
      template_subjects: t.is_generic ? allSubjects : byNumber.get(t.number) ?? [],
      legal_area: areaForPart(t.part),
      source_pdf: source.source_pdf ?? null,
    };
  });

  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.number)) problems.push(`#${r.number}: appears twice in ${file}`);
    seen.add(r.number);
  }

  const byArea = new Map();
  for (const r of rows) byArea.set(r.legal_area, (byArea.get(r.legal_area) ?? 0) + 1);
  console.log("  legal areas:");
  for (const [a, n] of [...byArea.entries()].sort()) console.log(`    ${String(n).padStart(2)}  ${a}`);

  const mapped = rows.filter((r) => r.template_subjects.length > 0);
  console.log(`${file}: ${rows.length} template(s)`);
  console.log(`  ${present.size} distinct subject(s) in open_questions`);
  console.log(`  mapped to at least one subject : ${mapped.length}`);
  console.log(`  left unmapped (no subject fits): ${rows.length - mapped.length}`);
  console.log("");
  for (const r of rows) {
    const subs = r.template_subjects.length
      ? r.template_subjects.map((s) => s.slice(0, 26)).join(" | ")
      : "—";
    console.log(`  ${String(r.number).padStart(2)}  ${r.title.slice(0, 30).padEnd(30)} ${r.is_generic ? "G" : " "}  ${subs}`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  if (!commit) {
    console.log("\ndry run — nothing written. Pass --commit to apply.");
    process.exit(0);
  }

  await client.query("BEGIN");
  for (const r of rows) {
    await client.query(
      `INSERT INTO public.open_question_templates
         (number, part, title, summary, body, is_generic, template_subjects, legal_area, source_pdf)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (number) DO UPDATE SET
         part       = EXCLUDED.part,
         title      = EXCLUDED.title,
         summary    = EXCLUDED.summary,
         body       = EXCLUDED.body,
         is_generic = EXCLUDED.is_generic,
         legal_area = EXCLUDED.legal_area,
         source_pdf = EXCLUDED.source_pdf
         ${keepSubjects ? "" : ", template_subjects = EXCLUDED.template_subjects"}`,
      [r.number, r.part, r.title, r.summary, r.body, r.is_generic, r.template_subjects,
       r.legal_area, r.source_pdf]
    );
  }
  await client.query("COMMIT");

  const total = await client.query(
    `SELECT count(*)::int n,
            count(*) FILTER (WHERE cardinality(template_subjects) > 0)::int mapped
       FROM public.open_question_templates`
  );
  console.log(
    `\nCOMMITTED — ${total.rows[0].n} template(s), ${total.rows[0].mapped} mapped to a subject` +
      (keepSubjects ? " (--keep-subjects: the mapping was left as it was)" : "")
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
