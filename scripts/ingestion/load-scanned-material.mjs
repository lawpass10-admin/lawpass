// load-scanned-material.mjs — OCR'd study books into public.study_material.
//
//   node scripts/ingestion/load-scanned-material.mjs <dir> --text-field=Mhauti
//   node scripts/ingestion/load-scanned-material.mjs <dir> --text-field=diuni --commit
//
// IT WRITES original_text, NEVER lawpass_text. THIS IS THE WHOLE POINT.
//
// study_material carries two texts per row. `original_text` is the publisher's
// own words, extracted from their book; `lawpass_text` is the version LawPass
// authored from it through scripts/ingestion/LLM-text-converting.json. Only the
// second may reach a candidate — study_material_public exists precisely because
// RLS can hide a row but not a column, and that view does not expose
// original_text at all.
//
// OCR output is, word for word, the publisher's text. Putting it in
// lawpass_text would publish someone else's copyrighted expression to every
// subscriber under our name, through a view built to make that impossible. So
// these rows load with lawpass_text NULL, which also means the view omits them:
// nothing new appears on anyone's screen until the conversion has been run.
//
// SHAPE. rewrite-source.mjs reads `source.sections[].heading` and
// `.paragraphs[]`, so the OCR is reshaped into that, one section per page. A
// page is not a section in any real sense — these books run chapters across
// pages — but it is the only division the OCR actually knows, and inventing
// chapter boundaries from a heading heuristic would hand the converter a
// structure the source does not have. The page number is kept on each section
// so a quote can always be traced back to the scan it came from.

import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: join(APP_ROOT, ".env.local") });
dotenv.config({ path: join(APP_ROOT, ".env") });

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const dir = argv.find((a) => !a.startsWith("--"));
const textField = flagOf("text-field");
const commit = argv.includes("--commit");
const startOrder = Number(flagOf("sort-start") ?? 100);

if (!dir || !textField) {
  console.error(
    "usage: node scripts/ingestion/load-scanned-material.mjs <dir> --text-field=<Mhauti|diuni> [--sort-start=100] [--commit]"
  );
  process.exit(2);
}

/**
 * A page's first line becomes its heading when it looks like one.
 *
 * Deliberately timid. A heading here is a SHORT first line that does not end
 * like a sentence — the running law name at the top of each page, or a chapter
 * title. Anything else keeps "עמוד N", because a wrong heading is worse than a
 * dull one: it goes into the contents rail, and a rail built from the first
 * sentence of each page is noise that looks like structure.
 */
function headingFor(lines, pageNo) {
  const first = (lines[0] ?? "").trim();
  const looksLikeHeading =
    first.length > 0 && first.length <= 60 && !/[.:;,]$/.test(first) && !/^\d+$/.test(first);
  return looksLikeHeading ? first : `עמוד ${pageNo}`;
}

function toDocument(file) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const name = basename(file).replace(/\.vision\.json$/i, "");

  const sections = [];
  const blank = [];
  let droppedBlocks = 0;

  for (const page of raw.pages) {
    droppedBlocks += (page.dropped ?? []).length;
    const lines = String(page.text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      blank.push(page.page);
      continue;
    }
    const heading = headingFor(lines, page.page);
    const paragraphs = heading === lines[0] ? lines.slice(1) : lines;
    sections.push({
      heading,
      paragraphs,
      tables: [],
      // Provenance, kept out of the way of the converter's contract.
      page: page.page,
      ocr_confidence: page.confidence ?? null,
    });
  }

  const warnings = [];
  if (blank.length) warnings.push(`${blank.length} blank page(s): ${blank.join(", ")}`);
  if (droppedBlocks) {
    warnings.push(
      `${droppedBlocks} low-confidence block(s) were dropped as handwriting/noise before loading`
    );
  }
  warnings.push(
    "OCR, not a text layer: scattered single-letter errors are expected (כ/ב, ז/ו). " +
      "Verify any quote against the scan before relying on it."
  );

  return {
    paperId: name,
    doc: {
      language: "he",
      source_file: `${name}.pdf`,
      page_count: raw.pages.length,
      pages_loaded: sections.length,
      pages_excluded: blank,
      pages_with_gaps: [],
      section_count: sections.length,
      sections,
      warnings,
      ocr: {
        engine: raw.engine ?? "google-vision DOCUMENT_TEXT_DETECTION",
        dpi: raw.dpi ?? null,
        dropped_blocks: droppedBlocks,
        read_at: new Date().toISOString(),
      },
    },
  };
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".vision.json"))
  .sort();
if (files.length === 0) {
  console.error(`no .vision.json files in ${dir}`);
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: existing } = await client.query(
  `SELECT paper_id, text_field FROM public.study_material`
);
const seen = new Set(existing.map((r) => `${r.text_field}::${r.paper_id}`));

console.log(`\n${files.length} document(s) from ${dir}`);
console.log(`text_field = ${textField}, into original_text (lawpass_text stays NULL)\n`);

const planned = [];
let order = startOrder;
for (const file of files) {
  const { paperId, doc } = toDocument(join(dir, file));
  const key = `${textField}::${paperId}`;
  const already = seen.has(key);
  const chars = doc.sections.reduce((n, s) => n + s.paragraphs.join("").length, 0);
  console.log(
    `  ${already ? "SKIP (exists)" : String(order).padStart(4) + "        "}  ` +
      `${String(doc.pages_loaded).padStart(3)}/${String(doc.page_count).padStart(3)} pages  ` +
      `${chars.toLocaleString().padStart(9)} chars  ${paperId}`
  );
  if (!already) {
    planned.push({ paperId, doc, order });
    order += 10;
  }
}

if (planned.length === 0) {
  console.log("\nnothing to insert.");
  await client.end();
  process.exit(0);
}

if (!commit) {
  console.log(
    `\ndry run — ${planned.length} row(s) would be inserted, nothing written.\n` +
      "Pass --commit to apply."
  );
  await client.end();
  process.exit(0);
}

for (const { paperId, doc, order: sortOrder } of planned) {
  await client.query(
    `INSERT INTO public.study_material (paper_id, text_field, original_text, sort_order)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [paperId, textField, JSON.stringify(doc), sortOrder]
  );
  console.log(`  inserted  ${paperId}`);
}

console.log(`\n${planned.length} row(s) inserted with lawpass_text NULL.`);
console.log("They are NOT visible to candidates: study_material_public omits rows without a conversion.");
await client.end();
