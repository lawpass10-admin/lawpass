// load-converted-material.mjs — converted chapters into study_material.lawpass_text.
//
//   node scripts/ingestion/load-converted-material.mjs --text-field=mahoti
//   node scripts/ingestion/load-converted-material.mjs --text-field=mahoti --commit
//
// THIS IS THE STEP THAT PUBLISHES. study_material_public exposes
// `lawpass_text -> 'doc'` to every subscriber and filters out rows where
// lawpass_text is NULL — so writing this column is what puts a book on screen.
// original_text is untouched and stays admin-only.
//
// IT REFUSES TO PUBLISH MATERIAL THAT FAILS THE CONTRACT. Each converted file
// carries the span check that produced it (convert-study-book.mjs writes it).
// A book with a 12+ word shared span is skipped and named, because the one
// moment that check matters is the moment before publication.

import dotenv from "dotenv";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { deepStatuteText, sharedSpans, summarise, toWords } from "./lib/span-check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
dotenv.config({ path: join(ROOT, ".env.local") });
dotenv.config({ path: join(ROOT, ".env") });

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const textField = flagOf("text-field") ?? "mahoti";
const commit = argv.includes("--commit");
const dir = flagOf("dir") ?? join(HERE, "tmp", "converted");

const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await client.connect();

const { rows: existing } = await client.query(
  `SELECT paper_id, original_text, lawpass_text IS NOT NULL AS published
     FROM public.study_material WHERE text_field = $1`,
  [textField]
);
const { rows: laws } = await client.query(`SELECT sections_body FROM public.mahoti_laws`);
const statuteWords = toWords(laws.flatMap((l) => (l.sections_body ?? []).map(deepStatuteText)).join("\n"));

/**
 * Converted chapters into the shape lib/db/study-material.ts parses.
 *
 * That module accepts `{kind:"sections", title, intro, sections:[{heading,
 * paragraphs, tables}]}`. A chapter becomes one heading-only section carrying
 * its intro, then one section per statutory provision holding the law and our
 * explanation as two paragraphs — the law first, because that is the order a
 * candidate reads in and it keeps the quoted provision adjacent to the thing
 * explaining it.
 */
function toDoc(paperId, converted) {
  const sections = [];
  for (const ch of converted.chapters) {
    const out = ch.output;
    if (!out?.sections?.length) continue;
    // level 1 — the chapter. These are the only entries in the contents rail,
    // which is why the rail reads "פרק א׳, פרק ב׳…" instead of listing all 381
    // provisions of a book.
    // "<law> — <chapter>", law FIRST, because the contents rail groups by
    // `titleStem`, which is everything before the first " — ". With the law
    // last (the first version of this) every chapter was its own group and a
    // book covering eight laws produced 34 ungrouped lines. Law first makes
    // the rail show each law once with its chapters indented beneath it.
    // "(ללא פרק)" is what the corpus carries for sections the legislature did
    // not file under a chapter. Honest in a database, meaningless in a contents
    // list — 14 entries across the books read as a defect rather than a label.
    const chapterName = ch.chapter === "(ללא פרק)" ? "סעיפים כלליים" : ch.chapter;
    const chapterTitle = chapterName && ch.law ? `${ch.law} — ${chapterName}` : out.title || chapterName;
    sections.push({
      heading: chapterTitle,
      level: 1,
      paragraphs: [out.intro].filter(Boolean),
      tables: [],
    });
    // level 2 — one statutory provision. Still a heading on the page, just not
    // in the rail.
    for (const s of out.sections) {
      sections.push({
        heading: s.heading || `§${s.statute_number ?? ""}`,
        level: 2,
        paragraphs: [s.statute_text, s.explanation].filter(Boolean),
        tables: [],
      });
    }
  }
  return {
    kind: "sections",
    // NO `title`. DocumentReader does `doc.title || name`, and `doc.title` is
    // meant to be an AUTHORED headline — the open-questions booklets have one
    // ("למה דווקא כאן אתה נכשל?"). A converted law book has none, and putting
    // paper_id there printed the filename as the page's heading: "מהותי 1 -
    // אתיקה מקצועית". Leaving it out lets the page fall through to the name it
    // is known by, which is the same one the breadcrumb and the index use.
    intro: `חומר הלימוד נכתב על ידי LawPass. לשון החוק מצוטטת מנוסח רשמי; ההסברים נכתבו באופן עצמאי.`,
    sections,
  };
}

const files = readdirSync(dir).filter((f) => f.endsWith(".lawpass.json")).sort();
console.log(`${files.length} converted file(s), text_field=${textField}\n`);

const plan = [];
for (const file of files) {
  const data = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const row = existing.find((r) => r.paper_id === data.paper_id);
  if (!row) {
    console.log(`  SKIP  no study_material row for "${data.paper_id}"`);
    continue;
  }

  // Re-run the check here rather than trusting the file: the chapters may have
  // been patched by a rerun since the converter wrote its verdict.
  const sourceWords = toWords(
    (row.original_text?.sections ?? []).map((s) => [s.heading, ...s.paragraphs].join("\n")).join("\n")
  );
  const authored = data.chapters
    .flatMap((ch) => [
      ch.output?.intro ?? "",
      ...(ch.output?.sections ?? []).map((x) => `${x.heading}\n${x.explanation}`),
    ])
    .join("\n");
  const check = summarise(sharedSpans(authored, sourceWords, statuteWords));

  const doc = toDoc(data.paper_id, data);
  const status = !check.passes ? "BLOCKED" : row.published ? "replace" : "insert";
  console.log(
    `  ${status.padEnd(8)} ${String(doc.sections.length).padStart(4)} sections  ` +
      `check ${check.report}/${check.review}/${check.block}  ${data.paper_id}`
  );
  for (const b of check.blocking) console.log(`           blocking (${b.length}w): ${b.text.slice(0, 64)}`);
  if (check.passes) plan.push({ paperId: data.paper_id, doc, check, model: data.model });
}

if (plan.length === 0) {
  console.log("\nnothing publishable.");
  await client.end();
  process.exit(1);
}

if (!commit) {
  console.log(`\ndry run — ${plan.length} row(s) would get lawpass_text. Pass --commit to publish.`);
  await client.end();
  process.exit(0);
}

for (const { paperId, doc, check, model } of plan) {
  await client.query(
    `UPDATE public.study_material
        SET lawpass_text = $2::jsonb, updated_at = now()
      WHERE text_field = $1 AND paper_id = $3`,
    [
      textField,
      JSON.stringify({
        doc,
        run: {
          contract: "diuni_and_mhuti-LLM-params.json@1.1.0",
          model,
          converted_at: new Date().toISOString(),
          check: { report: check.report, review: check.review, block: check.block },
        },
      }),
      paperId,
    ]
  );
  console.log(`  published  ${paperId}`);
}

await client.end();
console.log(`\n${plan.length} row(s) now carry lawpass_text and are visible through study_material_public.`);
