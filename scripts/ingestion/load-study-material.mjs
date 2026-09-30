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
// A pdf2json.mjs output folder — page-01.json … page-NN.json plus index.json —
// loaded as ONE row: a booklet is one document, not sixty-two.
//
// Named --pages-dir rather than --pages on purpose. pdf2json.mjs reads --pages
// as a page COUNT and rejects a non-number at import time, so the two scripts
// must not share the spelling; that collision has already cost this repo a bug
// once (see validateFlags in docx2json.mjs).
const pagesDir = flagOf("pages-dir");
const paperIdFlag = flagOf("paper-id");
// The booklet's converted half, from rewrite-source.mjs. The .docx path finds
// its .lawpass.json by pairing on filename; a booklet's source is a folder of
// page JSONs whose name need not match, so it is named outright.
const lawpassFile = flagOf("lawpass-file");
// Publish the source ITSELF as the LawPass text, unconverted.
//
// This exists for one narrow case: material that has no unprotectable layer to
// convert — a booklet of worked example documents, where the drafting IS the
// content — and that is held to be official published material rather than a
// third party's copyrighted work. rewrite-source.mjs cannot help there; there
// is nothing to send while withholding the expression.
//
// It is deliberately awkward to reach, and it does not publish anything on its
// own. The row is written with
// `provenance.publication = 'pending_legal_review'`, which the candidate-facing
// view filters out (20260930000001). Someone has to change that field before a
// candidate sees a word of it. Whether the material really is exempt is a legal
// question, and this flag records the claim rather than settling it.
const verbatim = argv.includes("--verbatim");

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
      "  --pages-dir a pdf2json.mjs output folder, loaded as ONE booklet row\n" +
      "  --paper-id  the row key; defaults to the folder name\n" +
      "  --lawpass-file  a .lawpass.json to store as lawpass_text\n" +
      "  --verbatim  store the source AS the lawpass text, held pending review\n" +
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

// ------------------------------------------------- a booklet of page JSONs

/** What the OCR prompt writes where it could not read, and for a blank page. */
const UNREADABLE = "[לא קריא]";
const BLANK_PAGE = "[עמוד ריק]";

/**
 * Whether one page of a pdf2json run is good enough to load.
 *
 * THIS IS A LOADING POLICY, not a reading one, which is why it lives here and
 * not in pdf2json.mjs. That script's job is to report honestly what it read;
 * this one decides what is fit to go into the product. A page with one
 * unreadable word is a page with one unreadable word — it loads. A page that is
 * mostly markers is not a page of text, and loading it would put holes into
 * study material that a candidate is going to read.
 *
 * `blank` is a third answer, separate from both: correct, and not content.
 */
function pageStatus(json) {
  const markdown = (json.markdown ?? "").trim();
  if (json.blank || markdown === BLANK_PAGE) return "blank";
  if (!markdown) return "empty";
  const gaps = (markdown.match(/\[לא קריא\]/g) ?? []).length;
  const readable = markdown.length - gaps * UNREADABLE.length;
  if (readable < markdown.length * 0.5 || gaps >= 5) return "unreadable";
  return gaps > 0 ? "partial" : "ok";
}

/**
 * One booklet, assembled from the pages worth loading.
 *
 * The pages' blocks are concatenated IN PAGE ORDER and run through the same
 * `asDocument` the .docx path uses, so the row's shape is identical whichever
 * script produced it — one `sections` array, not sixty-two. That also handles a
 * section running across a page break, which is the normal case in a booklet:
 * the heading is on page 4, its paragraphs continue on page 5, and concatenating
 * first means they end up under that heading rather than in two fragments.
 *
 * Which pages went in is recorded on the row. Four of this booklet's 62 were
 * left out, and a reader who cannot see that from the data would reasonably
 * assume they were reading the whole thing.
 */
function bookletFromPages(dir) {
  const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
  const files = readdirSync(dir)
    .map((name) => /^page-(\d+)\.json$/.exec(name))
    .filter(Boolean)
    .map((hit) => ({ page: Number(hit[1]), file: join(dir, hit[0]) }))
    .sort((a, b) => a.page - b.page);

  const loaded = [];
  const excluded = { blank: [], unreadable: [], empty: [] };
  const blocks = [];
  let partial = 0;

  for (const { page, file } of files) {
    const json = JSON.parse(readFileSync(file, "utf8"));
    const status = pageStatus(json);
    if (status !== "ok" && status !== "partial") {
      excluded[status].push(page);
      continue;
    }
    if (status === "partial") partial++;
    loaded.push(page);
    // mode=page writes `blocks`; fall back to re-deriving them from the
    // markdown so a folder written in another mode still loads.
    blocks.push(...(json.blocks ?? toStructure(json.markdown ?? "")));
  }

  const { sections, warnings } = asDocument(blocks);
  return {
    document: {
      source_file: index.source_file,
      language: "he",
      section_count: sections.length,
      sections,
      // Provenance: this row is a SUBSET of the booklet, and says so.
      page_count: index.page_count,
      pages_loaded: loaded,
      pages_excluded: excluded,
      pages_with_gaps: partial,
      ...(warnings.length ? { warnings } : {}),
    },
    loaded,
    excluded,
    partial,
    pageCount: index.page_count,
  };
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

/**
 * Load one pdf2json folder as a single study_material row.
 *
 * `lawpass_text` is left NULL: this is the source side of the pair, exactly as
 * a freshly extracted .docx is, and rewrite-source.mjs fills the other half
 * later. Re-running updates the row in place rather than adding a second one,
 * so re-reading a page and loading again is safe.
 */
async function loadBooklet() {
  const booklet = bookletFromPages(pagesDir);
  const paperId = paperIdFlag ?? basename(pagesDir);
  const { document, loaded, excluded, partial, pageCount } = booklet;

  console.log(`booklet '${paperId}', text_field='${textField}'`);
  console.log(`  from: ${pagesDir}`);
  console.log(
    `  ${loaded.length} of ${pageCount} page(s) loaded — ` +
      `${loaded.length - partial} clean, ${partial} with a small gap`
  );
  for (const [why, pages] of Object.entries(excluded)) {
    if (pages.length) console.log(`  left out (${why}): ${pages.join(", ")}`);
  }
  console.log(
    `  → ${document.section_count} section(s), ` +
      `${(JSON.stringify(document).length / 1024).toFixed(0)}KB of jsonb\n`
  );

  if (loaded.length === 0) {
    console.error("nothing to load — every page was excluded");
    process.exitCode = 1;
    return;
  }

  let lawpass = null;
  if (verbatim) {
    if (lawpassFile) {
      console.error("--verbatim and --lawpass-file are mutually exclusive.");
      process.exitCode = 2;
      return;
    }
    // The same envelope rewrite-source.mjs writes, so the column has one shape
    // whatever produced it — and a `provenance` block saying plainly that this
    // one was not authored, only copied.
    lawpass = {
      contract: "verbatim-source (no conversion)",
      model: null,
      generated_at: new Date().toISOString(),
      item_count: document.section_count,
      provenance: {
        kind: "official_publication",
        verbatim: true,
        publication: "pending_legal_review",
        claim:
          "Held to be official published material of the Bar examining committee, " +
          "so stored unconverted. Not verified by this pipeline.",
        note:
          "No unprotectable layer exists in worked example documents, so " +
          "LLM-text-converting cannot apply. Clear the publication hold only " +
          "after a lawyer familiar with Israeli copyright has reviewed it.",
      },
      doc: document,
    };
    console.log(
      "  lawpass_text: VERBATIM copy of the source, publication=pending_legal_review\n" +
        "                (held out of study_material_public until that is cleared)\n"
    );
  } else if (lawpassFile) {
    if (!existsSync(lawpassFile)) {
      console.error(`--lawpass-file: no such file — ${lawpassFile}`);
      process.exitCode = 1;
      return;
    }
    lawpass = JSON.parse(readFileSync(lawpassFile, "utf8"));
    console.log(
      `  lawpass_text: ${lawpass.contract ?? "unknown contract"}, ` +
        `${lawpass.item_count ?? "?"} item(s)\n`
    );
  }

  const client = await connect();
  try {
    await client.query("BEGIN");

    const found = await client.query(
      `SELECT study_material_id, lawpass_text IS NOT NULL AS has_lawpass
         FROM public.study_material
        WHERE paper_id = $1 AND text_field = $2`,
      [paperId, textField]
    );

    const mark = commit ? "" : "would ";
    if (found.rowCount === 0) {
      await client.query(
        `INSERT INTO public.study_material (paper_id, text_field, original_text, lawpass_text)
         VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
        [paperId, textField, JSON.stringify(document), lawpass ? JSON.stringify(lawpass) : null]
      );
      console.log(`  ${mark}insert one row${lawpass ? " with its LawPass version" : ""}`);
    } else {
      // The same rule the .docx path follows: a lawpass_text already stored is
      // published text, and only --refresh may replace it. Without the flag an
      // ordinary re-run still updates the source side and leaves it alone.
      const writeLawpass = lawpass && (!found.rows[0].has_lawpass || refresh);
      await client.query(
        writeLawpass
          ? `UPDATE public.study_material
                SET original_text = $2::jsonb, lawpass_text = $3::jsonb
              WHERE study_material_id = $1`
          : `UPDATE public.study_material
                SET original_text = $2::jsonb
              WHERE study_material_id = $1`,
        writeLawpass
          ? [found.rows[0].study_material_id, JSON.stringify(document), JSON.stringify(lawpass)]
          : [found.rows[0].study_material_id, JSON.stringify(document)]
      );
      console.log(
        `  ${mark}update the existing row (${found.rows[0].study_material_id})` +
          (writeLawpass
            ? found.rows[0].has_lawpass
              ? " — lawpass_text REPLACED (--refresh)"
              : " — lawpass_text added"
            : lawpass
              ? " — lawpass_text kept (pass --refresh to replace it)"
              : "")
      );
    }

    if (commit) {
      await client.query("COMMIT");
      console.log("\nCOMMITTED.");
    } else {
      await client.query("ROLLBACK");
      console.log("\nDRY RUN — rolled back. Pass --commit to write it.");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`\nFAILED — rolled back, nothing written.\n${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// ------------------------------------------------------------------ main

async function main() {
  if (argv.includes("--help")) usage(0);
  if (!textField) {
    console.error("--text-field is required.\n");
    usage(2);
  }
  if (!pagesDir && (!docsDir || !lawpassDir)) {
    console.error("--docs and --lawpass are required (or --pages-dir for a booklet).\n");
    usage(2);
  }
  if (!TEXT_FIELDS.includes(textField)) {
    console.error(`--text-field must be one of ${TEXT_FIELDS.join(", ")} (got '${textField}')`);
    process.exit(2);
  }
  for (const [label, dir] of [
    ["--docs", docsDir],
    ["--lawpass", lawpassDir],
    ["--pages-dir", pagesDir],
  ]) {
    if (!dir) continue;
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      console.error(`${label}: not a folder — ${dir}`);
      process.exit(2);
    }
  }

  // The booklet path: one folder of page JSONs in, one row out. It shares
  // everything below — the connection, the upsert, the dry run — and differs
  // only in where `original_text` comes from.
  if (pagesDir) {
    await loadBooklet();
    return;
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
