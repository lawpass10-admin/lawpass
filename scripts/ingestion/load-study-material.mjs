// load-study-material.mjs — load source documents and their LawPass versions
// into public.study_material.
//
//   node scripts/ingestion/load-study-material.mjs \
//     --docs=<folder of .docx> --lawpass=<folder of .lawpass.json> \
//     --text-field=open_questions                     # dry run
//   ... --text-field=open_questions --commit          # write
//
// SAFE BY DEFAULT: without --commit this connects, pairs the files, reports
// exactly what it would write, and rolls back.
//
// WHERE EACH COLUMN COMES FROM. The two halves of a row are produced at
// different times by different scripts, so they live in different places:
//
//   original_text  ← the .docx in --docs, extracted HERE, now.
//   lawpass_text   ← <name>.lawpass.json in --lawpass, written earlier by
//                    rewrite-source.mjs under LLM-text-converting.json.
//
// THE SOURCE IS RE-EXTRACTED RATHER THAN READ FROM AN INTERMEDIATE. There is an
// extracted <name>.json sitting beside the .lawpass.json, and loading that would
// be one less step — but it is a copy, and a copy can be stale, hand-edited, or
// left behind from an older run of the extractor. The .docx is the document.
// Extraction is local, free and takes milliseconds, so the loader does it again
// and the row is guaranteed to match the file on disk.
//
// A DOCUMENT WITH NO CONVERSION YET STILL LOADS, with lawpass_text NULL. That is
// what the nullable column is for: the source is banked as soon as it exists,
// and the conversion fills in later. Re-running then updates that row in place
// rather than inserting a second one.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

import { toStructure, asDocument } from "./docx2json.mjs";

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
// Replace a lawpass_text that is ALREADY there.
//
// Without this the loader only ever fills a NULL, which is right for a first
// load and wrong for a promotion: a document reconverted under a new contract
// version has a better lawpass_text than the row holds, and "already present"
// is not a reason to keep the old one. Off by default so an ordinary re-run
// still cannot overwrite published text by accident.
const refresh = argv.includes("--refresh");
const docsDir = flagOf("docs");
const lawpassDir = flagOf("lawpass");

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURATION — text_field
// ═══════════════════════════════════════════════════════════════════════════
//
//  Which part of the product a document belongs to. One of exactly three:
//
//      open_questions   מטלת כתיבה      ← the learning material loaded so far
//      diuni            דין דיוני
//      mahoti           דין מהותי
//
//  Choose it per run on the command line, because one folder of documents is
//  one kind of material and the next folder is another — a value hard-coded
//  here would have to be edited between runs, which is how the wrong label
//  ends up on a row:
//
//      --text-field=open_questions
//
//  These are the only three values public.study_material accepts; its CHECK
//  constraint rejects anything else. Validating the flag here turns that into
//  a clear message before the script even connects, instead of a 23514 check
//  violation thrown away at COMMIT after all the work is done.
//
//  To add a fourth kind of material you must change BOTH this list and the
//  constraint in supabase/migrations/20260928000001_study_material.sql.
// ═══════════════════════════════════════════════════════════════════════════
const TEXT_FIELDS = ["diuni", "mahoti", "open_questions"];

const textField = flagOf("text-field");

const DOC_EXT = new Set([".docx", ".doc", ".odt", ".rtf", ".docm"]);

function usage(code) {
  console.log(
    "usage: node scripts/ingestion/load-study-material.mjs \\\n" +
      "         --docs=<folder> --lawpass=<folder> --text-field=<" +
      TEXT_FIELDS.join("|") +
      "> [--commit]\n\n" +
      "  --docs      folder holding the source documents (.docx)\n" +
      "  --lawpass   folder holding <name>.lawpass.json from rewrite-source.mjs\n" +
      "  --text-field which part of the product this material belongs to\n" +
      "  --refresh   replace a lawpass_text that is already stored (promotion)\n" +
      "  --commit    actually write; without it the run is a dry run"
  );
  process.exit(code);
}

// ------------------------------------------------------------- pairing

/**
 * One entry per source document, with its LawPass version when one exists.
 *
 * Paired on the document's base name, which is what rewrite-source.mjs builds
 * its output name from. A .docx whose name contains a dot ("x.docx LawPass.docx")
 * still works, because both sides strip only the final extension.
 */
function pair(docs, lawpass) {
  const converted = new Map();
  for (const name of readdirSync(lawpass)) {
    if (!name.endsWith(".lawpass.json")) continue;
    converted.set(name.slice(0, -".lawpass.json".length), join(lawpass, name));
  }

  const rows = [];
  const skipped = [];

  for (const name of readdirSync(docs)) {
    const full = join(docs, name);
    if (!statSync(full).isFile()) continue;
    if (!DOC_EXT.has(extname(name).toLowerCase())) {
      skipped.push(name);
      continue;
    }
    const stem = basename(name, extname(name));
    rows.push({ paperId: stem, docPath: full, lawpassPath: converted.get(stem) ?? null });
    converted.delete(stem);
  }

  // A conversion with no source document left in the folder: worth naming,
  // because it means the pair has come apart somewhere.
  const orphans = [...converted.keys()];
  return { rows, skipped, orphans };
}

// ------------------------------------------------------------ extraction

async function extractOriginal(path, toMarkdown) {
  const markdown = await toMarkdown(path);
  const { sections, warnings } = asDocument(toStructure(markdown));
  return {
    source_file: basename(path),
    language: "he",
    section_count: sections.length,
    sections,
    ...(warnings.length ? { warnings } : {}),
  };
}

// ------------------------------------------------------------ connection

async function connect() {
  const direct = process.env.DIRECT_URL;
  const pooled = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!direct && !pooled) throw new Error("neither DIRECT_URL nor DATABASE_URL is set");

  for (const url of [direct, pooled].filter(Boolean)) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      // Only a dead host is worth falling through on; bad credentials would
      // fail identically on the second URL.
      if (err.code !== "ENOTFOUND" && err.code !== "EAI_AGAIN") throw err;
    }
  }
  throw new Error("no reachable database host");
}

// ------------------------------------------------------------------ main

async function main() {
  if (argv.includes("--help")) usage(0);
  if (!docsDir || !lawpassDir || !textField) {
    console.error("--docs, --lawpass and --text-field are all required.\n");
    usage(2);
  }
  if (!TEXT_FIELDS.includes(textField)) {
    console.error(`--text-field must be one of ${TEXT_FIELDS.join(", ")} (got '${textField}')`);
    process.exit(2);
  }
  for (const [label, dir] of [["--docs", docsDir], ["--lawpass", lawpassDir]]) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`${label}: not a folder — ${dir}`);
      process.exit(2);
    }
  }

  const { rows, skipped, orphans } = pair(docsDir, lawpassDir);
  if (rows.length === 0) {
    console.error(`no source documents found in ${docsDir}`);
    process.exit(1);
  }

  let toMarkdown;
  try {
    ({ toMarkdown } = await import("@firecrawl/anydoc"));
  } catch {
    console.error("@firecrawl/anydoc is not installed. Run:\n  npm install --save-dev @firecrawl/anydoc");
    process.exit(1);
  }

  console.log(`${rows.length} document(s), text_field='${textField}'`);
  console.log(`  docs:    ${docsDir}`);
  console.log(`  lawpass: ${lawpassDir}\n`);

  const client = await connect();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  try {
    await client.query("BEGIN");

    for (const row of rows) {
      let original;
      try {
        original = await extractOriginal(row.docPath, toMarkdown);
      } catch (error) {
        failed++;
        const hint = error.code === "needsOcr" ? " (scanned pages — use jpeg2json.mjs)" : "";
        console.log(`  FAILED  ${row.paperId} — ${error.code ?? "error"}${hint}: ${error.message}`);
        continue;
      }

      let lawpass = null;
      if (row.lawpassPath) {
        const parsed = JSON.parse(readFileSync(row.lawpassPath, "utf8"));
        // rewrite-source.mjs wraps the document in run metadata. Both the
        // content and the provenance are worth keeping, so the whole file goes
        // in — `lawpass_text->'doc'` is the publishable part.
        lawpass = parsed;
      }

      const found = await client.query(
        `SELECT study_material_id, lawpass_text IS NOT NULL AS has_lawpass
           FROM public.study_material
          WHERE paper_id = $1 AND text_field = $2`,
        [row.paperId, textField]
      );

      const mark = commit ? "" : "would ";
      if (found.rowCount === 0) {
        await client.query(
          `INSERT INTO public.study_material (paper_id, text_field, original_text, lawpass_text)
           VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
          [row.paperId, textField, JSON.stringify(original), lawpass ? JSON.stringify(lawpass) : null]
        );
        inserted++;
        console.log(
          `  ${mark}insert ${row.paperId} — ${original.section_count} section(s), ` +
            `lawpass ${lawpass ? "yes" : "not yet"}`
        );
      } else if (lawpass && (!found.rows[0].has_lawpass || refresh)) {
        // The second stage catching up with the first. Updating in place is
        // what keeps the pair on one row instead of accumulating duplicates.
        await client.query(
          `UPDATE public.study_material
              SET original_text = $3::jsonb, lawpass_text = $4::jsonb
            WHERE study_material_id = $1 AND text_field = $2`,
          [found.rows[0].study_material_id, textField, JSON.stringify(original), JSON.stringify(lawpass)]
        );
        updated++;
        console.log(
          `  ${mark}update ${row.paperId} — LawPass version ` +
            `${found.rows[0].has_lawpass ? "REPLACED (--refresh)" : "added to the existing row"}`
        );
      } else {
        unchanged++;
        console.log(`  skip    ${row.paperId} — already present`);
      }
    }

    if (commit) {
      await client.query("COMMIT");
      console.log(`\nCOMMITTED — ${inserted} inserted, ${updated} updated, ${unchanged} unchanged.`);
    } else {
      await client.query("ROLLBACK");
      console.log(`\nDRY RUN — rolled back. ${inserted} would be inserted, ${updated} updated, ${unchanged} unchanged.`);
      console.log("Pass --commit to write them.");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`\nFAILED — rolled back, nothing written.\n${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }

  if (skipped.length) console.log(`\nignored ${skipped.length} non-document file(s) in --docs`);
  if (orphans.length) {
    console.log("\nLawPass versions with no source document in --docs:");
    for (const o of orphans) console.log(`  - ${o}.lawpass.json`);
  }
  if (failed) process.exitCode = 1;
}

export { pair };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
