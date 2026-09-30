// pdf2json.mjs — take a PDF apart page by page and write one JSON per page,
// via @firecrawl/pdf-inspector.
//
//   node scripts/ingestion/pdf2json.mjs --pages=5          # the booklet, 5 pages
//   node scripts/ingestion/pdf2json.mjs --inspect          # look, convert nothing
//   node scripts/ingestion/pdf2json.mjs <folder|file...> --out=<dir>
//   node scripts/ingestion/pdf2json.mjs book.pdf --out=json/ --pages=3   # test run
//   node scripts/ingestion/pdf2json.mjs book.pdf --out=json/ --from=40 --pages=10
//   node scripts/ingestion/pdf2json.mjs book.pdf --out=json/ --mode=document --keep-md
//
// With no path it reads חוברת מיקוד בניסוח משפטי.pdf and writes into
// json_files_from_pdf beside it — see TEST_PDF / TEST_OUT below.
//
// NO UPLOAD, NO API KEY. pdf-inspector is Firecrawl's Rust PDF library with
// Node bindings — it runs on this machine, like @firecrawl/anydoc in
// docx2json.mjs and unlike the hosted OCR jpeg2json.mjs falls back to. Nothing
// here leaves the machine, so a whole exam corpus can go through it.
//
// WHY PAGE BY PAGE. docx2json.mjs writes one JSON per document, which is right
// for a document that is one thing. A 300-page scanned-era paper is not: it is
// 300 units of work that get read, classified and corrected separately, and one
// 8MB JSON is the wrong shape for all three. So each page gets its own file —
// `page-007.json` — and a per-document `index.json` says what the whole PDF is
// and which pages were written.
//
// The pages are NOT physically split into per-page PDFs first. pdf-inspector
// parses the document once and returns the pages asked for, which is both
// faster and more accurate than splitting: its header detection uses font
// statistics from the WHOLE document, so a page cut out of its document would
// be classified with less to go on than the same page read in place.
//
// --pages=N IS THE TEST PARAMETER. A big PDF is a long run and a wrong --mode
// is only visible in the output, so start with `--pages=3`: it converts the
// first three pages and stops. --from=N moves the window, so --from=40
// --pages=10 is pages 40-49. Neither changes how a page is read — the whole
// document is still parsed — so what you see in a three-page run is exactly
// what a full run would write for those pages.
//
// THREE MODES, the same three docx2json.mjs has, so nothing downstream learns
// a second shape:
//
//   --mode=page (default) — the page's markdown, plus the blocks it is made of
//     (headings, paragraphs, tables). Invents no structure.
//   --mode=document — the page's blocks rolled into sections: a heading with
//     the paragraphs and tables under it.
//   --mode=questions — an exam page read as numbered stems with א–ד options,
//     in scratchpad/pdf2json.py's shape. See the warning under WHERE THIS CUTS.
//
// WHERE THIS CUTS. A page boundary is not a content boundary. A question whose
// stem is at the foot of page 4 and whose options are at the head of page 5 is
// two half-questions to --mode=questions, and the script says so rather than
// writing them as if they were whole. When a paper matters more than its pages
// do, jpeg2json.mjs reads the sitting as one document and is the right tool.
//
// A SCANNED PAGE IS NOT READ UNLESS YOU ASK. pdf-inspector reads a text layer;
// a scanned page has none, and comes back `needs_ocr: true` with no markdown
// rather than with silence. `--ocr` then sends those pages — and only those —
// to Firecrawl Parse, one upload per page so the text lands in the right page's
// JSON. It is off by default because it uploads the material, and every page it
// touches is marked `text_source: "firecrawl-hosted"` so OCR'd text is never
// mistaken for text the document actually carried.
//
// Hosted OCR is right for a flat scan and wrong for a photograph — on phone
// photos of this same kind of material it returned 0.9% Hebrew (see
// jpeg2json.mjs). Each page's Hebrew share is therefore measured and a page
// that comes back barely Hebrew says so in its own JSON rather than looking
// converted. When that happens, jpeg2json.mjs --ocr=claude is the route that
// reads this material.
//
// NOT hebrew_pdf_to_json.py. That script fights a specific, known corruption in
// the Bar's own papers — ToUnicode tables that map נ to ð, or to a glyph
// poppler throws away — and rebuilds reading order from glyph boxes. This one
// is the general reader. It cannot repair a broken font map, but it does
// DETECT one (`encoding_warnings` in index.json) and tells you to go there.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
} from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";

import { toStructure, asDocument } from "./docx2json.mjs";
import { toLines, parse as parseQuestions } from "./jpeg2json.mjs";

// FIRECRAWL_API_KEY, for --ocr. Loaded here explicitly rather than inherited
// from importing jpeg2json.mjs, which happens to call dotenv at module scope:
// depending on that would mean this script's credentials came from another
// script's import order. Anchored to THIS FILE's directory, not the shell's
// cwd — `../.env.local` from the app folder is the stray duplicate repo's copy,
// which is the bug jpeg2json.mjs documents at length.
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};

/** A --flag=N that must be a positive whole number, or the script stops. */
function intFlag(name, fallback) {
  const raw = flagOf(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    console.error(`--${name} must be a whole number of 1 or more (got '${raw}')`);
    process.exit(2);
  }
  return value;
}

/**
 * The booklet this script was built against, and where its pages go.
 *
 * Here so a test run is one flag and no typing of a path with Hebrew, spaces
 * and a comma in it:
 *
 *   node scripts/ingestion/pdf2json.mjs --pages=5
 *
 * A positional path overrides the first, `--out=<dir>` the second. They are a
 * convenience for the machine this was written on, not a policy: on any other
 * machine they simply will not exist, and the script says so and asks for a
 * path rather than failing obscurely.
 */
const TEST_PDF =
  "C:/Users/User/Documents/עידו/פיתוח אפליקציות/low_pass/learning_material_photos/open_question/pdf_files/חוברת מיקוד בניסוח משפטי.pdf";
const TEST_OUT =
  "C:/Users/User/Documents/עידו/פיתוח אפליקציות/low_pass/learning_material_photos/open_question/pdf_files/json_files_from_pdf";

const outDir = flagOf("out") ?? TEST_OUT;
const mode = flagOf("mode") ?? "page";
const keepMd = argv.includes("--keep-md");
const force = argv.includes("--force");
const inspectOnly = argv.includes("--inspect");
// Read scanned pages. Off by default, because either engine uploads them.
//
// 'claude' is the default, and that is a decision this material forced. Hosted
// OCR read six pages of חוברת מיקוד בניסוח משפטי at 48-74% Hebrew and returned
// nonsense for two — page 2 came back as invented Chinese arithmetic, page 6 as
// 12k characters of fabricated table — and the pages it did read carry Latin
// junk where a Hebrew word should be (ONN for אתם, Od for כל) and final letters
// swapped (המסמכיס for המסמכים). It is the same conclusion jpeg2json.mjs
// reached from the other direction.
const ocrEngine = (() => {
  if (!argv.some((a) => a === "--ocr" || a.startsWith("--ocr="))) return null;
  const named = flagOf("ocr");
  const engine = named ?? "claude";
  if (!["claude", "firecrawl", "hybrid", "mistral"].includes(engine)) {
    console.error(
      `--ocr must be 'claude', 'firecrawl', 'hybrid' or 'mistral' (got '${engine}')`
    );
    process.exit(2);
  }
  return engine;
})();
const wantOcr = ocrEngine !== null;
const model = flagOf("model") ?? "claude-opus-5";
// Mistral's OCR model, pinned rather than `mistral-ocr-latest` so a comparison
// run is reproducible and says which model it measured. The ids the API lists
// for this key: mistral-ocr-4-1, mistral-ocr-4, mistral-ocr-4-0, mistral-ocr-3,
// mistral-ocr-3-0, mistral-ocr-2512, mistral-ocr-latest.
const mistralModel = flagOf("mistral-model") ?? "mistral-ocr-4-1";
// How hard the model works on a page.
//
// `high` because it measured free. The same page read twice is not word-for-word
// identical, and at `medium` page 9 came back with טעונתיכם for טענותיכם and
// בודקת for מורה — single wrong words in Hebrew legal prose, which is the
// hardest kind of error to catch downstream. At `high` both were right, and the
// page took 38.2s against 36.9s: within noise. There is nothing to buy by
// reading this material less carefully.
const effort = flagOf("effort") ?? "high";
if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) {
  console.error(`--effort must be low, medium, high, xhigh or max (got '${effort}')`);
  process.exit(2);
}
// A proof sheet per page: the scan beside what was read off it. Built from the
// JSON on disk, so it converts nothing and can be run over an old run.
const wantHtml = argv.includes("--html");
// How many pages to convert, and where to start. Both are about THIS RUN and
// nothing else: the whole document is parsed either way.
const pageLimit = intFlag("pages", null);
const firstPage = intFlag("from", 1);
// How many pages are parsed out in one call. A big PDF held entirely in
// memory as markdown is the one way this script can run a machine out of it,
// so the pages are taken in bites and each one's JSON is written before the
// next is asked for.
const batchSize = intFlag("batch", 25);
// How many pages are read at once — and the answer to "Claude is too slow".
//
// Per PAGE Claude is ~8x slower than hosted OCR (36s against 4.3s on page 9 of
// the booklet). Per DOCUMENT that difference mostly disappears, because each
// page is an independent request: 8 pages at concurrency 8 took 34s wall-clock,
// which is 4.3s per page — hosted OCR's latency at Claude's accuracy. Throughput
// is the lever here, not the engine.
//
// 8 is the default because it is what was measured without hitting a limit;
// lower it on a 429.
const concurrency = intFlag("concurrency", 8);
// `--only=2,6,17` — exactly these pages, ignoring --from/--pages. The other
// half of `pages_to_review`: a run says which pages came back wrong, and this
// is how those pages are done again without touching the rest.
const onlyPages = (() => {
  const raw = flagOf("only");
  if (raw === null) return null;
  const pages = [
    ...new Set(
      raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((page) => Number.isInteger(page) && page > 0)
    ),
  ].sort((a, b) => a - b);
  if (pages.length === 0) {
    console.error(`--only must be page numbers, e.g. --only=2,6,17 (got '${raw}')`);
    process.exit(2);
  }
  return pages;
})();
const inputs = argv.filter((a) => !a.startsWith("--"));

if (!["page", "document", "questions"].includes(mode)) {
  console.error(`--mode must be 'page', 'document' or 'questions' (got '${mode}')`);
  process.exit(2);
}

function collectPdfs(paths) {
  const found = [];
  const skipped = [];
  for (const p of paths) {
    if (!existsSync(p)) throw new Error(`no such path: ${p}`);
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p)) {
        const full = join(p, name);
        if (!statSync(full).isFile()) continue;
        if (extname(name).toLowerCase() === ".pdf") found.push(full);
        else skipped.push(name);
      }
    } else if (extname(p).toLowerCase() === ".pdf") {
      found.push(p);
    } else {
      skipped.push(basename(p));
    }
  }
  return {
    pdfs: found.sort((a, b) =>
      basename(a).localeCompare(basename(b), undefined, { numeric: true })
    ),
    skipped,
  };
}

// ------------------------------------------------------------- measures

const hebrewShare = (t) =>
  t.length ? (100 * (t.match(/[֐-׿]/g) ?? []).length) / t.length : 0;

/** U+FFFD — a character the font's CMap could not name. See `encodingWarnings`. */
const replacementCount = (t) => (t.match(/�/g) ?? []).length;

/** What the OCR prompt writes where it could not read, and for a blank page. */
const UNREADABLE = "[לא קריא]";
const BLANK_PAGE = "[עמוד ריק]";

/**
 * What a page's own text says about how well it was read.
 *
 * THE HEBREW-SHARE CHECK DOES NOT COVER THIS, and the gap was live: a page whose
 * every table cell came back `[לא קריא]` measured 44.5% Hebrew — because the
 * marker is itself Hebrew — and so passed a check meant to catch pages that were
 * not read. 24 pages of the booklet carried an unreadable region and none of
 * them were flagged. The markers have to be counted, not inferred from the
 * alphabet.
 */
function readingWarnings(markdown) {
  const text = markdown.trim();
  if (text === BLANK_PAGE) return { blank: true, warnings: [] };

  const unreadable = (markdown.match(/\[לא קריא\]/g) ?? []).length;
  if (unreadable === 0) return { blank: false, warnings: [] };

  // Marker characters as a share of the page: one unreadable word in a full
  // page is a footnote, a page that is nothing but markers was not read.
  const share = (unreadable * UNREADABLE.length) / Math.max(markdown.length, 1);
  return {
    blank: false,
    warnings: [
      share > 0.5
        ? `this page is mostly unreadable — ${unreadable} region(s) marked ${UNREADABLE} ` +
          `and almost no other text. Check the scan; it may need a better source.`
        : `${unreadable} region(s) on this page could not be read and are marked ${UNREADABLE}`,
    ],
  };
}

/**
 * Drop emphasis markup, keeping the words and the structure.
 *
 * The booklet bolds and underlines constantly — a heading, a defined term, half
 * a sentence — and carrying that into the JSON leaves `**` and `</u>` littered
 * through text that is going to be read, diffed and loaded, where it is noise in
 * every one of those. The prompt asks for plain text; this is the guarantee,
 * because a prompt is a request and the models occasionally mark something up
 * anyway.
 *
 * Headings, lists, tables and line breaks survive: they are the page's
 * structure, not its typography.
 */
function stripEmphasis(text) {
  return (
    text
      // Paired inline HTML the model reaches for: <u>, <b>, <i>, <em>, <strong>.
      .replace(/<\/?(?:u|b|i|em|strong|mark|span)\b[^>]*>/gi, "")
      // **bold** and __bold__, across line breaks — a bolded run can wrap.
      .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
      .replace(/__([\s\S]+?)__/g, "$1")
      // An unpaired marker left by a run that opened and never closed. Bullets
      // are a single `*` at the start of a line, so a doubled one is never one.
      .replace(/\*\*/g, "")
  );
}

/**
 * What the inspection found wrong with the document's fonts.
 *
 * This is the defect hebrew_pdf_to_json.py was written for, seen from the
 * outside: a font whose ToUnicode table has no entry for codes the page shows
 * through it. Every such code is either guessed from its neighbours
 * (`interpolated`) or lost (`unmapped`, a U+FFFD in the text). A paper can look
 * perfectly clean in a reader and still be unusable as text, so this is
 * reported per document rather than left for someone to notice.
 */
function encodingWarnings(detected) {
  const warnings = [];
  for (const gap of detected.cmapGaps ?? []) {
    if (!gap.unmapped && !gap.interpolated) continue;
    warnings.push(
      `font "${gap.font}": ${gap.unmapped} character(s) unreadable, ` +
        `${gap.interpolated} guessed from their neighbours, out of ${gap.codes} shown`
    );
  }
  if (detected.hasEncodingIssues && warnings.length === 0) {
    warnings.push("the document reports encoding issues its font tables do not explain");
  }
  if (warnings.length) {
    warnings.push(
      "a broken font map cannot be repaired here — " +
        "run scripts/ingestion/hebrew_pdf_to_json.py --glyph-boxes on this file instead"
    );
  }
  return warnings;
}

// ---------------------------------------------------------------- pages

/**
 * Which pages this run converts, 1-indexed.
 *
 * Out-of-range is not an error to fail on: --from=400 on a 300-page document
 * means the window is past the end, and an empty list says that plainly.
 */
function pageWindow(pageCount) {
  // A named list wins over the window. Numbers past the end are dropped rather
  // than failing the run: --only came from a list someone pasted.
  if (onlyPages) return onlyPages.filter((page) => page <= pageCount);

  const start = Math.min(firstPage, pageCount + 1);
  const end = pageLimit === null ? pageCount : Math.min(start + pageLimit - 1, pageCount);
  const pages = [];
  for (let page = start; page <= end; page++) pages.push(page);
  return pages;
}

// ---------------------------------------------------------- proof sheet

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * One page, twice: the scan on one side and what was read off it on the other.
 *
 * This is the only way to tell a right transcription from a confident wrong one
 * — which is not a hypothetical on this material, where hosted OCR returned a
 * page of invented Chinese for page 2 and 12k characters of fabricated table for
 * page 6. A number in a JSON does not show that; the page beside the text does.
 *
 * The PDF page is EMBEDDED, as a base64 data URI, so the file can be opened,
 * moved or sent on its own with nothing to resolve beside it. The original page
 * rather than an image of it: no rasteriser is involved, so what is on screen is
 * the document, at whatever zoom the reader wants.
 */
function proofSheet(data, pdfBytes) {
  const title = `${data.source_file} — עמוד ${data.page}`;
  const suspect = (data.warnings ?? []).length > 0;

  return `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --line: #d8d8d8; --warn: #b42318; }
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 16px; line-height: 1.7; }
  header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; margin-bottom: 12px; }
  h1 { font-size: 18px; margin: 0; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; }
  .tag { border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; }
  .tag.bad { border-color: var(--warn); color: var(--warn); font-weight: 600; }
  .warnings { border: 1px solid var(--warn); color: var(--warn); border-radius: 8px;
              padding: 10px 14px; margin-bottom: 12px; font-size: 14px; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: stretch; }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
  .pane { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .pane h2 { font-size: 13px; margin: 0; padding: 8px 12px; border-bottom: 1px solid var(--line);
             background: #00000008; font-weight: 600; }
  embed { width: 100%; height: 88vh; border: 0; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 15px;
        margin: 0; padding: 12px 14px; height: 88vh; overflow: auto; }
  .empty { color: #777; font-style: italic; }
</style>
<header>
  <h1>${esc(title)}</h1>
  <div class="tags">
    <span class="tag">עמוד ${data.page} מתוך ${data.page_count}</span>
    <span class="tag">${esc(data.pdf_type)}</span>
    <span class="tag">${esc(data.text_source ?? "text-layer")}</span>
    <span class="tag${data.hebrew_share < 5 ? " bad" : ""}">${data.hebrew_share}% עברית</span>
  </div>
</header>
${
  suspect
    ? `<div class="warnings">${data.warnings.map((w) => esc(w)).join("<br>")}</div>`
    : ""
}
<div class="split">
  <div class="pane">
    <h2>הסריקה המקורית</h2>
    <embed type="application/pdf" src="data:application/pdf;base64,${pdfBytes.toString("base64")}">
  </div>
  <div class="pane">
    <h2>מה שנקרא מהעמוד</h2>
    <pre dir="auto">${
      (data.markdown ?? "").trim()
        ? esc(data.markdown)
        : '<span class="empty">(לא הוחזר טקסט)</span>'
    }</pre>
  </div>
</div>
</html>
`;
}

// ------------------------------------------------------------------ OCR
//
// THIS SENDS THE PAGE TO A THIRD PARTY. `--ocr` uploads it to Firecrawl Parse
// through @firecrawl/anydoc, the same service and the same call jpeg2json.mjs
// makes. It is off by default and never happens for a page that already has
// text: only a page the inspection marked as a scan is ever sent, which is why
// the inspection runs first.
//
// ONE PAGE PER UPLOAD, not one per document. The whole point of this script is
// a JSON per page, and the hosted service returns one markdown for whatever it
// is given — send it sixty pages and the text comes back in one piece with
// nothing reliable to cut it on, so page 34's JSON would be a guess. A
// single-page PDF, copied out with pdf-lib, keeps the attribution exact.
//
// The cost of that is one request per page, which is why --pages exists: check
// three before spending sixty-two.

/**
 * Run `worker` over `items`, at most `limit` at a time, results in input order.
 *
 * A fixed pool rather than Promise.all over everything: sixty-two simultaneous
 * requests is how a rate limit is discovered the expensive way, and the whole
 * point of the limit is that it can be turned down to 1 when one is hit.
 */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let at = next++; at < items.length; at = next++) {
      results[at] = await worker(items[at], at);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * The bytes of one page of `buffer`, as a PDF in its own right.
 *
 * `turn` adds to the page's own /Rotate, which is a page attribute rather than a
 * re-render: the scan's pixels are untouched and the reader — or the model — is
 * simply told which way up it is.
 */
async function onePagePdf(PDFDocument, degrees, source, page, turn = 0) {
  const one = await PDFDocument.create();
  const [copied] = await one.copyPages(source, [page - 1]);
  const added = one.addPage(copied);
  if (turn) {
    added.setRotation(degrees((added.getRotation().angle + turn) % 360));
  }
  return Buffer.from(await one.save());
}

/**
 * What the model is asked to do with one page. Adapted from jpeg2json.mjs's
 * prompt, which was tuned on this same kind of Hebrew study material — the
 * rules that matter are: copy, never correct; and say [לא קריא] rather than
 * guess, because a guess is exactly what makes a bad transcription look good.
 */
function claudeOcrPrompt(page, pageCount) {
  return [
    `This is page ${page} of ${pageCount} of a scanned Hebrew legal-studies booklet.`,
    "",
    "Transcribe it to Markdown. Rules:",
    "- Copy the Hebrew exactly as printed. Do not translate, correct, complete or summarise it.",
    "- PLAIN TEXT ONLY. Never mark emphasis: no ** for bold, no _ or * for italics,",
    "  no <u>, <b>, <i> or any other HTML tag. The printed page uses bold and",
    "  underline heavily and none of it carries meaning worth keeping here.",
    "- A heading on the page becomes a Markdown heading (#, ##). That is the one",
    "  piece of formatting to keep, because it is structure rather than decoration.",
    "- Keep the numbering, the lists and the line breaks as printed.",
    "- Keep fill-in blanks as printed, including ]brackets[ and runs of underscores. NEVER invent content for a blank.",
    "- Render a table on the page as a Markdown table.",
    "- If a region is cut off, blurred or genuinely unreadable, write [לא קריא] there. Do not guess.",
    "- If the page has no readable text at all, output exactly: [עמוד ריק]",
    "",
    "Output only the transcription. No preamble, no commentary, no code fences.",
  ].join("\n");
}

/**
 * One scanned page, read by Claude.
 *
 * The page goes up as a PDF document block, not as an image: the Messages API
 * reads PDFs directly, so there is no rasteriser in the middle and no second
 * lossy step between the scan and the model. That is also why this script needs
 * no image tooling at all, unlike jpeg2json.mjs, which starts from photographs.
 */
async function ocrPageWithClaude({ PDFDocument, degrees, source, page, pageCount, turn = 0 }) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (it lives in .env.local)");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });
    const bytes = await onePagePdf(PDFDocument, degrees, source, page, turn);

    const message = await client.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: bytes.toString("base64"),
              },
            },
            { type: "text", text: claudeOcrPrompt(page, pageCount) },
          ],
        },
      ],
    });

    // A refusal is not a transcription, and must not be written as one.
    if (message.stop_reason === "refusal") {
      return { markdown: "", error: `refused (${message.stop_details?.category ?? "unknown"})` };
    }
    const markdown =
      message.content.find((block) => block.type === "text")?.text?.trim() ?? "";
    return {
      markdown,
      turn,
      error: null,
      // Worth saying: a page cut off at the token ceiling is half a page, and
      // it looks exactly like a short one in the JSON.
      truncated: message.stop_reason === "max_tokens",
    };
  } catch (error) {
    return { markdown: "", error: error.message };
  }
}

/**
 * A whole batch of scanned pages, read by Mistral OCR in ONE request.
 *
 * WHY THIS ONE IS SHAPED DIFFERENTLY. Claude and Firecrawl are asked for a page
 * at a time, so this script fans them out `--concurrency` at a time to make a
 * booklet finish. Mistral's OCR endpoint takes a document — up to 1000 pages —
 * and returns per-page markdown from a single call, so the whole batch is one
 * round trip and the fan-out is pointless. That is the entire reason it might be
 * faster, and the reason it is worth measuring.
 *
 * A SUB-DOCUMENT, NOT A `pages` PARAMETER. The endpoint takes `pages`, but its
 * docs say page numbers start at 0 while the example response shows `index: 1` —
 * and mapping text to the wrong page is a silent, expensive mistake to find
 * later. Copying the wanted pages into a fresh PDF removes the question: what
 * comes back is that document's pages, in the order they were put in, so
 * position IS the mapping. It also means a three-page test run uploads three
 * pages instead of a 2.9MB booklet.
 */
// No `degrees` here: this builds its own multi-page sub-document rather than
// going through onePagePdf, so there is nothing to turn.
async function ocrPagesWithMistral({ PDFDocument, source, pages }) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not set — add it to .env.local");
  }

  const sub = await PDFDocument.create();
  for (const copied of await sub.copyPages(source, pages.map((page) => page - 1))) {
    sub.addPage(copied);
  }
  const bytes = Buffer.from(await sub.save());

  // A 429 here is worth retrying — one request carries the whole batch, so
  // giving up on it costs every page in it. Three tries with a widening wait,
  // honouring `retry-after` when the response carries one.
  //
  // It is NOT worth retrying forever, and the difference matters: a throughput
  // limit clears in seconds, while a key whose workspace has no OCR entitlement
  // returns the same 429 in under half a second, every time, for ever. When the
  // waits do not help, the error says so rather than leaving someone to watch a
  // spinner.
  let response;
  for (const [attempt, wait] of [[1, 0], [2, 5000], [3, 20000]]) {
    if (wait) await new Promise((done) => setTimeout(done, wait));
    response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: mistralModel,
      // A base64 PDF goes in `document_url` as a data URI. The API reference
      // also documents a `{type:"file", file_content}` variant; the endpoint
      // rejects it with a 422 naming `document_url` as the expected type, so
      // the reference is wrong on that point and this is what actually works.
      document: {
        type: "document_url",
        document_name: "page-batch.pdf",
        document_url: `data:application/pdf;base64,${bytes.toString("base64")}`,
      },
        // The scans' own images are of no use here — this writes text JSON —
        // and asking for them would return a base64 copy of every figure.
        include_image_base64: false,
      }),
    });
    if (response.status !== 429) break;
    if (attempt === 3) break;
    const after = Number(response.headers.get("retry-after"));
    if (Number.isFinite(after) && after > 0) {
      await new Promise((done) => setTimeout(done, after * 1000));
    }
  }

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) {
      throw new Error(
        "Mistral OCR 429 (rate limited) after 3 tries — if this comes back " +
          "instantly every time, the key authenticates but the workspace has no " +
          "OCR entitlement: activate it and add billing at console.mistral.ai"
      );
    }
    throw new Error(`Mistral OCR ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const returned = data.pages ?? [];
  if (returned.length !== pages.length) {
    // Not fatal — the pages that did come back are still mapped by position and
    // written — but it means the tail of the batch has no text, and a silent
    // short read is exactly what this whole script is built to not do.
    console.log(
      `          ! Mistral returned ${returned.length} page(s) for ${pages.length} sent`
    );
  }

  const byPage = new Map();
  returned.forEach((entry, at) => {
    if (pages[at] !== undefined) byPage.set(pages[at], entry.markdown ?? "");
  });
  return byPage;
}

/**
 * One scanned page, read upright — and if that fails, read sideways.
 *
 * WHY. Page 6 of the booklet is a full-page table printed in landscape: the
 * text runs bottom-to-top and the model marked all 21 cells `[לא קריא]`, which
 * was the honest answer to the question it was asked. Turning the page and
 * asking again is the fix, and it is the same one jpeg2json.mjs offers as
 * --rotate for photographs held sideways.
 *
 * It fires only on a page that came back MOSTLY unreadable, so an upright page
 * with one blurred word costs one request as before. 90° first because a
 * landscape page in a Hebrew booklet is nearly always turned that way; 270° is
 * the other possibility and costs a third request on the rare page that needs
 * it. Whichever attempt reads best is kept, measured by how much of it is
 * unreadable rather than by length — a long transcription of nothing is not a
 * better answer than a short one.
 */
async function ocrPageUpOrSideways(args) {
  const first = await ocrPageWithClaude(args);

  // How much of the attempt is text that was actually READ — its length with
  // the markers' own characters taken out.
  //
  // Scoring on the markers' SHARE instead was a mistake worth recording: a page
  // answered with one `[לא קריא]` and nothing else scored better than the same
  // page answered with a whole table skeleton whose cells were unreadable,
  // because the short answer had proportionally less marker in it. The rule has
  // to reward reading, not brevity.
  const readable = (result) => {
    if (result.error || !result.markdown.trim()) return 0;
    const hits = (result.markdown.match(/\[לא קריא\]/g) ?? []).length;
    return Math.max(0, result.markdown.length - hits * UNREADABLE.length);
  };
  const mostlyUnread = (result) =>
    readable(result) < Math.max(result.markdown.length, 1) * 0.5;

  if (!mostlyUnread(first)) return first;

  let best = first;
  for (const turn of [90, 270]) {
    const turned = await ocrPageWithClaude({ ...args, turn });
    if (readable(turned) > readable(best)) best = turned;
    if (!mostlyUnread(best)) break;
  }
  return best;
}

/**
 * One scanned page, read cheaply and then corrected.
 *
 * THE IDEA: Firecrawl reads the page in ~4s and gets most words right; Claude
 * then looks at the same page and says only what is WRONG, as find/replace
 * pairs. The saving is in output tokens — a page of corrections is a fraction of
 * a page of transcription, and output size is what the 36s is mostly made of.
 * Claude still reads the whole scan, so the accuracy is its accuracy, not
 * Firecrawl's.
 *
 * WHEN IT IS NOT USED. A draft that is not a bad transcription but a fabricated
 * one — the invented Chinese on page 2, the 12k-character table on page 6 —
 * cannot be patched, because there is nothing in it to correct. Those are sent
 * for full transcription instead, which is why this returns a `fellBack` flag:
 * the run should say when the cheap path did not apply rather than quietly
 * costing what it was supposed to save.
 */
async function ocrPageHybrid({ toMarkdownBytes, PDFDocument, degrees, source, page, pageCount }) {
  const draft = await ocrPage({ toMarkdownBytes, PDFDocument, degrees, source, page });

  // A draft worth correcting has to be mostly Hebrew already. Below that it is
  // not a transcription of this page at all.
  const usable =
    !draft.error && draft.markdown.trim().length > 0 && hebrewShare(draft.markdown) >= 40;
  if (!usable) {
    const full = await ocrPageUpOrSideways({ PDFDocument, degrees, source, page, pageCount });
    return { ...full, fellBack: true };
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (it lives in .env.local)");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });
    const bytes = await onePagePdf(PDFDocument, degrees, source, page);

    const message = await client.messages.create({
      model,
      max_tokens: 8000,
      output_config: {
        effort,
        // The whole point is a small, structured answer. Left as prose the
        // model writes the page back out and the saving disappears.
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              corrections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    find: { type: "string" },
                    replace: { type: "string" },
                  },
                  required: ["find", "replace"],
                  additionalProperties: false,
                },
              },
            },
            required: ["corrections"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: bytes.toString("base64"),
              },
            },
            {
              type: "text",
              text: [
                `Below is an OCR transcription of page ${page} of ${pageCount} of this scanned`,
                "Hebrew booklet. The OCR is decent but substitutes Latin letters for Hebrew",
                "words it could not read (ONN for אתם, Od for גם), swaps final letters",
                "(המסמכיס for המסמכים), and drops words.",
                "",
                "Compare it against the page image and return ONLY the corrections needed,",
                "as find/replace pairs.",
                "- `find` must be text that appears EXACTLY ONCE in the transcription below,",
                "  long enough to be unambiguous — include a word or two of context.",
                "- `replace` is what the page actually says there.",
                "- Include a pair for every wrong, missing or invented word. Nothing else.",
                "- Do not restyle, reword or reformat anything that is already correct.",
                "- Plain text in `replace`: no **, no <u>, no HTML.",
                "- If the transcription is already correct, return an empty list.",
                "",
                "--- TRANSCRIPTION ---",
                draft.markdown,
              ].join("\n"),
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return { markdown: draft.markdown, error: null, corrected: 0, unmatched: 0 };
    }

    const text = message.content.find((block) => block.type === "text")?.text ?? "{}";
    const { corrections = [] } = JSON.parse(text);

    // Applied first-match-only, and a pair whose `find` is missing or ambiguous
    // is COUNTED rather than forced: a blind global replace on a bad anchor is
    // how a correction pass introduces errors of its own.
    let corrected = 0;
    let unmatched = 0;
    let markdown = draft.markdown;
    for (const { find, replace } of corrections) {
      if (!find || typeof replace !== "string") continue;
      const at = markdown.indexOf(find);
      if (at === -1 || markdown.indexOf(find, at + 1) !== -1) {
        unmatched++;
        continue;
      }
      markdown = markdown.slice(0, at) + replace + markdown.slice(at + find.length);
      corrected++;
    }

    return { markdown, error: null, corrected, unmatched };
  } catch (error) {
    // The correction pass failing must not lose the draft — it is still the
    // better half of this path's output.
    return { markdown: draft.markdown, error: null, corrected: 0, unmatched: 0, note: error.message };
  }
}

/**
 * One scanned page, read by Firecrawl Parse.
 *
 * Errors are returned rather than thrown: a page that fails to OCR should cost
 * that page, not the other sixty-one. The caller writes what came back —
 * including nothing — and says so in the JSON.
 */
async function ocrPage({ toMarkdownBytes, PDFDocument, degrees, source, page }) {
  try {
    const bytes = await onePagePdf(PDFDocument, degrees, source, page);
    const markdown = await toMarkdownBytes(bytes, "pdf", {
      ocr: "hosted",
      ...(process.env.FIRECRAWL_API_KEY
        ? { apiKey: process.env.FIRECRAWL_API_KEY }
        : {}),
    });
    return { markdown: markdown ?? "", error: null };
  } catch (error) {
    // anydoc's own codes; each says something different about the fix.
    const hint = {
      hosted: "Firecrawl Parse could not be reached — check the network, or set FIRECRAWL_API_KEY",
      needsOcr: "OCR was refused — 'hosted' did not take effect",
      malformed: "no readable content came back for this page",
      resourceLimit: "the page crossed a safety limit",
    }[error.code];
    return {
      markdown: "",
      error: `${error.code ?? "unknown"} — ${error.message}${hint ? ` (${hint})` : ""}`,
    };
  }
}

/** The JSON for one page, in the shape `--mode` asks for. */
function pageJson({ pdfName, page, pageCount, pdfType, extracted }) {
  const markdown = extracted.markdown ?? "";
  const envelope = {
    source_file: pdfName,
    language: "he",
    page,
    page_count: pageCount,
    pdf_type: pdfType,
    needs_ocr: extracted.needsOcr,
    // Only present when the library says WHY, which it does not always know.
    ...(extracted.ocrReason ? { ocr_reason: extracted.ocrReason } : {}),
    // Where the text below came from. A page read by OCR and a page read off a
    // text layer are not equally trustworthy, and whoever corrects this JSON
    // later has to be able to tell them apart without rerunning anything.
    text_source: extracted.textSource ?? "text-layer",
    hebrew_share: Number(hebrewShare(markdown).toFixed(1)),
  };

  // A page with no text layer has nothing to parse into any mode's shape. It
  // still gets a file, because a gap in a 300-page run has to be visible as a
  // gap rather than as a missing number in a directory listing.
  if (extracted.needsOcr && !markdown.trim()) {
    return {
      ...envelope,
      markdown: "",
      warnings: [
        extracted.ocrError
          ? `OCR failed for this page: ${extracted.ocrError}`
          : "no text layer on this page — rerun with --ocr, or use jpeg2json.mjs",
      ],
    };
  }

  const reading = readingWarnings(markdown);
  if (reading.blank) {
    // A blank page is a correct result, not a failure — but it has to be
    // labelled, or `[עמוד ריק]` ends up loaded as if it were the page's text.
    return { ...envelope, blank: true, markdown };
  }

  const warnings = [...reading.warnings];
  const lost = replacementCount(markdown);
  if (lost > 0) {
    warnings.push(
      `${lost} character(s) on this page could not be read from the font's map (U+FFFD)`
    );
  }
  // The measurement that caught Firecrawl failing on photographs, per page: a
  // Hebrew page that comes back barely Hebrew was not read, whatever else the
  // service returned. Only asked of OCR'd text — a text layer that is genuinely
  // Latin is not a failure.
  if (envelope.text_source !== "text-layer" && envelope.hebrew_share < 5) {
    warnings.push(
      `only ${envelope.hebrew_share}% of the ${markdown.length} characters OCR returned ` +
        `are Hebrew — this page was probably not read. Try jpeg2json.mjs --ocr=claude.`
    );
  }

  if (mode === "questions") {
    const { questions, warnings: parseWarnings } = parseQuestions(toLines(markdown));
    return {
      ...envelope,
      question_count: questions.length,
      questions,
      ...(keepMd ? { markdown } : {}),
      ...(warnings.concat(parseWarnings).length
        ? { warnings: warnings.concat(parseWarnings) }
        : {}),
    };
  }

  const blocks = toStructure(markdown);

  if (mode === "document") {
    const { sections, warnings: sectionWarnings } = asDocument(blocks);
    return {
      ...envelope,
      section_count: sections.length,
      sections,
      ...(keepMd ? { markdown } : {}),
      ...(warnings.concat(sectionWarnings).length
        ? { warnings: warnings.concat(sectionWarnings) }
        : {}),
    };
  }

  return {
    ...envelope,
    markdown,
    block_count: blocks.length,
    blocks,
    ...(warnings.length ? { warnings } : {}),
  };
}

// ------------------------------------------------------------------ main

async function main() {
  if (argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/pdf2json.mjs [folder|file...] [--out=<dir>]\n" +
        "       [--pages=N] [--from=N] [--mode=page|document|questions]\n" +
        "       [--inspect] [--keep-md] [--batch=N] [--force]\n\n" +
        "  --pages=N   convert only N pages — the test run. Default: every page.\n" +
        "  --from=N    start at page N (1-indexed). Default: 1.\n" +
        "  --only=2,6  exactly these pages — for redoing the ones in pages_to_review.\n" +
        "  --inspect   report what the PDF is and convert nothing.\n" +
        "  --ocr[=claude|mistral|firecrawl|hybrid]  read SCANNED pages.\n" +
        "              claude (default) reads Hebrew properly, one request per page.\n" +
        "              mistral reads the whole batch in ONE request — the fast option.\n" +
        "              firecrawl is fast per page and unreliable here. hybrid corrects\n" +
        "              a firecrawl draft with claude — same quality, measured slower.\n" +
        "  --mistral-model=ID  default: mistral-ocr-latest.\n" +
        "  --html      a proof sheet per page: the scan beside what was read off it.\n" +
        "  --keep-md   keep the page's markdown in the JSON (always kept in --mode=page).\n" +
        "  --batch=N   pages parsed out per call. Default: 25.\n" +
        "  --concurrency=N  pages read at once. Default: 8. Lower it on a rate limit.\n" +
        "  --effort=LEVEL   low|medium|high|xhigh|max for --ocr=claude. Default: high.\n" +
        "  --model=ID       the model --ocr=claude uses. Default: claude-opus-5.\n" +
        "  --force     overwrite page JSONs that already exist.\n\n" +
        "With no path, the booklet at the top of this file is used:\n" +
        `  in   ${TEST_PDF}\n` +
        `  out  ${TEST_OUT}`
    );
    process.exit(0);
  }

  // No path given: the booklet at the top of this file. Announced rather than
  // assumed silently — a run that converted something other than what was
  // typed, without saying which, is how the wrong PDF gets ingested.
  const usingDefault = inputs.length === 0;
  const targets = usingDefault ? [TEST_PDF] : inputs;
  if (usingDefault) console.log(`no path given — using ${basename(TEST_PDF)}\n`);

  let pdfs;
  let skipped;
  try {
    ({ pdfs, skipped } = collectPdfs(targets));
  } catch (error) {
    // A path that does not exist is a typo, not a crash: it gets a sentence
    // rather than a stack trace with this script's own line numbers in it.
    console.error(error.message);
    if (usingDefault) {
      console.error(
        "that is this script's built-in test path, which only exists on the machine\n" +
          "it was written on. Pass a PDF or a folder of them:\n" +
          "  node scripts/ingestion/pdf2json.mjs <file.pdf> --out=<dir> --pages=3"
      );
    }
    process.exit(1);
  }

  if (pdfs.length === 0) {
    console.error(`no PDF found in ${targets.join(", ")}`);
    if (skipped.length) console.error(`  ignored: ${skipped.slice(0, 8).join(", ")}`);
    process.exit(1);
  }

  let detectPdf;
  let extractPagesMarkdownAsync;
  try {
    ({ detectPdf, extractPagesMarkdownAsync } = await import("@firecrawl/pdf-inspector"));
  } catch {
    console.error(
      "\n@firecrawl/pdf-inspector is not installed. Run:\n" +
        "  npm install --save-dev @firecrawl/pdf-inspector"
    );
    process.exit(1);
  }

  // Loaded only when asked for, so a text-layer run needs neither package and
  // a machine without them still converts every PDF that has text.
  let toMarkdownBytes;
  let PDFDocument;
  // pdf-lib's degrees() builds the rotation value setRotation takes.
  let degrees;
  if ((wantOcr || wantHtml) && !inspectOnly) {
    try {
      // pdf-lib cuts a single page out of the document — for the upload, and
      // for the copy embedded in a proof sheet.
      ({ PDFDocument, degrees } = await import("pdf-lib"));
      if (ocrEngine === "firecrawl" || ocrEngine === "hybrid") {
        ({ toMarkdownBytes } = await import("@firecrawl/anydoc"));
      }
    } catch {
      console.error(
        "\n--ocr and --html need these packages. Run:\n" +
          "  npm install --save-dev @firecrawl/anydoc pdf-lib"
      );
      process.exit(1);
    }
  }
  if (wantOcr && !inspectOnly) {
    console.log(
      ocrEngine === "mistral"
        ? `! --ocr=mistral sends the SCANNED pages to ${mistralModel} — the whole\n` +
          "  batch in one request, not one per page. Needs MISTRAL_API_KEY in .env.local.\n"
        : ocrEngine === "claude"
        ? `! --ocr=claude sends each SCANNED page to ${model}, one request per page.\n` +
          "  Pages that already have text are never sent. Slower and priced per page,\n" +
          "  and the reason it is the default is that it reads this material.\n"
        : "! --ocr=firecrawl uploads each SCANNED page to Firecrawl Parse, one request\n" +
          "  per page. Faster, but it returned nonsense for 2 of 8 sampled pages of the\n" +
          "  booklet. Set FIRECRAWL_API_KEY for higher limits.\n"
    );
  }

  if (mode === "questions") {
    console.log(
      "! --mode=questions reads each page on its own, so a question split across a\n" +
        "  page break is parsed as two halves. jpeg2json.mjs reads a paper whole.\n"
    );
  }

  console.log(`${pdfs.length} PDF(s), mode=${mode}\n`);

  let failed = 0;

  for (const path of pdfs) {
    const pdfName = basename(path);
    const name = basename(path, extname(path));

    let buffer;
    let detected;
    try {
      buffer = readFileSync(path);
      // The inspection: type, page count, fonts and layout, no text extracted.
      // Milliseconds even on a large document, which is what makes --inspect
      // worth running before a long conversion.
      detected = detectPdf(buffer);
    } catch (error) {
      failed++;
      console.log(`  FAILED  ${name} — ${error.message}`);
      continue;
    }

    const encoding = encodingWarnings(detected);
    // `detectPdf` reports these 1-indexed. `classifyPdf` reports the same list
    // 0-indexed and `extractPagesMarkdown` takes its `pages` 0-indexed — the
    // library mixes the two conventions, so everything is converted to
    // 1-indexed here and only converted back at the call itself.
    const needsOcr = new Set(detected.pagesNeedingOcr ?? []);
    const withTables = new Set(detected.pagesWithTables ?? []);
    const withColumns = new Set(detected.pagesWithColumns ?? []);

    console.log(
      `  ${name} — ${detected.pdfType}, ${detected.pageCount} page(s), ` +
        `confidence ${detected.confidence.toFixed(2)}`
    );
    if (needsOcr.size) {
      console.log(
        wantOcr
          ? `          ${needsOcr.size} page(s) have no text layer and will be sent to OCR`
          : `          ${needsOcr.size} page(s) have no text layer and will be written empty ` +
            `(rerun with --ocr, or use jpeg2json.mjs)`
      );
    }
    for (const w of encoding) console.log(`          ! ${w}`);

    const pages = pageWindow(detected.pageCount);
    if (inspectOnly) {
      console.log(`          --inspect: nothing converted\n`);
      continue;
    }
    if (pages.length === 0) {
      console.log(
        `          nothing to convert: --from=${firstPage} is past page ${detected.pageCount}\n`
      );
      continue;
    }

    const docDir = join(outDir, name);
    if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true });

    // Zero-padded to the document's own length, so `page-007.json` sorts beside
    // `page-134.json` in any listing.
    const width = String(detected.pageCount).length;
    const fileFor = (page) => join(docDir, `page-${String(page).padStart(width, "0")}.json`);

    const written = [];
    const skippedPages = [];
    let pageFailures = 0;
    // Parsed once per document and only if --ocr actually has a page to send,
    // because loading a 4MB scan into pdf-lib is not free.
    let pdfDoc = null;

    for (let at = 0; at < pages.length; at += batchSize) {
      const batch = pages.slice(at, at + batchSize);
      const todo = batch.filter((page) => force || !existsSync(fileFor(page)));
      skippedPages.push(...batch.filter((page) => !todo.includes(page)));
      if (todo.length === 0) continue;

      let result;
      try {
        // `pages` here is 0-INDEXED — the one place the conversion happens.
        result = await extractPagesMarkdownAsync(
          buffer,
          todo.map((page) => page - 1)
        );
      } catch (error) {
        pageFailures += todo.length;
        console.log(
          `          FAILED  pages ${todo[0]}-${todo[todo.length - 1]} — ${error.message}`
        );
        continue;
      }

      // Loaded before the pages fan out: two workers racing to lazily load the
      // same document would each parse the 4MB scan, and one would win.
      if (wantOcr && !pdfDoc) {
        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      }

      // Mistral reads the batch in one request, before the per-page loop, and
      // the loop then just collects what came back. The other engines have
      // nothing to do here and skip it.
      let mistralPages = null;
      if (ocrEngine === "mistral") {
        const needing = (result.pages ?? [])
          .filter(
            (extracted) =>
              (extracted.needsOcr || needsOcr.has(extracted.page + 1)) &&
              !(extracted.markdown ?? "").trim()
          )
          .map((extracted) => extracted.page + 1);

        if (needing.length > 0) {
          const started = Date.now();
          try {
            mistralPages = await ocrPagesWithMistral({
              PDFDocument,
              source: pdfDoc,
              pages: needing,
            });
            const secs = Math.round((Date.now() - started) / 100) / 10;
            console.log(
              `          ${needing.length} page(s) to ${mistralModel} in one request — ` +
                `${secs}s total, ${(secs / needing.length).toFixed(1)}s per page`
            );
          } catch (error) {
            mistralPages = new Map();
            console.log(`          Mistral FAILED — ${error.message}`);
          }
        }
      }

      // Each page is its own request and its own file, so they run in parallel
      // — `concurrency` at a time. The per-page line is printed whole rather
      // than as a prefix and a completion, because two pages finishing at once
      // would otherwise splice their output together.
      await mapWithConcurrency(result.pages ?? [], concurrency, async (extracted) => {
        const page = extracted.page + 1; // back to 1-indexed
        // The per-page call and the document-wide inspection can disagree —
        // one reads the page, the other reads its fonts — and either saying so
        // is reason enough to keep the page out of a text pipeline.
        const pageNeedsOcr = extracted.needsOcr || needsOcr.has(page);

        // Stripped once, here, so every downstream consumer — the JSON, the
        // Hebrew share, the .md, the block parser, the proof sheet — sees the
        // same text, whichever of the three sources produced it.
        let markdown = stripEmphasis(extracted.markdown ?? "");
        let textSource = "text-layer";
        let ocrError = null;
        // Only a page with no text of its own is ever uploaded, and only when
        // asked. A page that already reads is never sent anywhere.
        // Mistral's text is already here — the batch call above fetched it.
        if (ocrEngine === "mistral" && pageNeedsOcr && !markdown.trim()) {
          const text = mistralPages?.get(page);
          markdown = stripEmphasis(text ?? "");
          textSource = `mistral:${mistralModel}`;
          if (text === undefined) ocrError = "no text returned for this page";
          console.log(
            `          page ${page} (mistral) — ` +
              (text === undefined
                ? "no text returned"
                : `${markdown.length} chars, ${hebrewShare(markdown).toFixed(1)}% Hebrew`)
          );
        } else if (wantOcr && pageNeedsOcr && !markdown.trim()) {
          const started = Date.now();
          const args = {
            toMarkdownBytes,
            PDFDocument,
            degrees,
            source: pdfDoc,
            page,
            pageCount: detected.pageCount,
          };
          const ocr =
            ocrEngine === "claude"
              ? await ocrPageUpOrSideways(args)
              : ocrEngine === "hybrid"
                ? await ocrPageHybrid(args)
                : await ocrPage(args);
          const secs = Math.round((Date.now() - started) / 100) / 10;
          markdown = stripEmphasis(ocr.markdown);
          ocrError = ocr.error;
          textSource =
            ocrEngine === "firecrawl"
              ? "firecrawl-hosted"
              : ocrEngine === "hybrid" && !ocr.fellBack
                ? `firecrawl+${model}`
                : `claude:${model}`;
          console.log(
            `          page ${page} (${textSource.startsWith("firecrawl+") ? "hybrid" : ocrEngine}) — ` +
              (ocr.error
                ? `failed — ${ocr.error}`
                : `${markdown.length} chars, ${hebrewShare(markdown).toFixed(1)}% Hebrew, ${secs}s` +
                  (ocr.corrected !== undefined ? `, ${ocr.corrected} fixes` : "") +
                  (ocr.unmatched ? ` (${ocr.unmatched} unmatched)` : "") +
                  (ocr.fellBack ? " — draft unusable, full re-read" : "") +
                  (ocr.truncated ? " (hit max_tokens — page may be cut off)" : ""))
          );
        }

        const json = pageJson({
          pdfName,
          page,
          pageCount: detected.pageCount,
          pdfType: detected.pdfType,
          extracted: {
            markdown,
            needsOcr: pageNeedsOcr,
            ocrReason: extracted.ocrReason,
            textSource,
            ocrError,
          },
        });
        if (withTables.has(page)) json.has_table = true;
        if (withColumns.has(page)) json.has_column_layout = true;

        writeFileSync(fileFor(page), `${JSON.stringify(json, null, 2)}\n`, "utf8");
        if (keepMd) {
          writeFileSync(fileFor(page).replace(/\.json$/, ".md"), markdown, "utf8");
        }
        written.push({
          page,
          hebrew_share: json.hebrew_share,
          text_source: json.text_source,
          // Empty is about the TEXT, not about whether the page was a scan: an
          // OCR'd page is still `needs_ocr`, and counting it as empty would
          // report a successful run as sixty-two blanks.
          empty: !markdown.trim(),
        });
      });
    }

    // Pages finish out of order when they run in parallel; the manifest lists
    // them in page order, which is the order anyone reading it expects.
    written.sort((a, b) => a.page - b.page);

    // The proof sheets, built from the JSON that is now on disk rather than
    // from this run's variables — so `--html --only=9` over an old run writes a
    // sheet for page 9 without re-reading, re-uploading or overwriting it.
    if (wantHtml) {
      if (!pdfDoc) pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      let sheets = 0;
      for (const page of pages) {
        if (!existsSync(fileFor(page))) continue;
        const data = JSON.parse(readFileSync(fileFor(page), "utf8"));
        const bytes = await onePagePdf(PDFDocument, degrees, pdfDoc, page);
        writeFileSync(
          fileFor(page).replace(/\.json$/, ".html"),
          proofSheet(data, bytes),
          "utf8"
        );
        sheets++;
      }
      console.log(`          wrote ${sheets} proof sheet(s) — open the .html beside the .json`);
    }

    // The manifest. Written after the pages so it can report what actually
    // landed, and it indexes the DIRECTORY rather than this run: converting a
    // long document in windows (`--from=1 --pages=50`, then 51, then 101…)
    // rewrites this file each time, and a manifest that only remembered the
    // last window would report a nearly finished document as two pages done.
    // `pages_present` is read back off disk, so it counts the earlier windows.
    const present = readdirSync(docDir)
      .map((file) => /^page-(\d+)\.json$/.exec(file))
      .filter(Boolean)
      .map((hit) => Number(hit[1]))
      .sort((a, b) => a - b);

    // The pages worth looking at again, across the whole directory rather than
    // just this run. Hosted OCR does not fail quietly on this material — it
    // returns a page of nothing, or a page of confident nonsense — and each of
    // those already writes itself a warning. Collecting them here is what makes
    // a 62-page run reviewable: read this list, rerun those pages with --force,
    // or send them through jpeg2json.mjs --ocr=claude instead.
    const suspect = [];
    for (const page of present) {
      try {
        const written = JSON.parse(readFileSync(fileFor(page), "utf8"));
        // The page's own warnings, plus a fresh look at its text. The second
        // half is what makes this index correct for pages written before the
        // unreadable-marker check existed: it re-derives the finding from the
        // markdown instead of trusting a `warnings` array that predates it.
        const found =
          written.warnings?.length ||
          readingWarnings(written.markdown ?? "").warnings.length;
        if (found) suspect.push(page);
      } catch {
        // A page file that cannot be read or parsed is itself a reason to
        // look, which is the same answer as a warning inside it.
        suspect.push(page);
      }
    }

    const manifest = {
      source_file: pdfName,
      pdf_type: detected.pdfType,
      page_count: detected.pageCount,
      confidence: Number(detected.confidence.toFixed(3)),
      // This run only.
      run: {
        mode,
        from: pages[0],
        to: pages[pages.length - 1],
        written: written.length,
      },
      // Everything converted so far, this run and any before it.
      pages_present: present,
      complete: present.length === detected.pageCount,
      // Pages whose JSON carries a warning — empty, or read badly. Rerun these.
      pages_to_review: suspect,
      pages_needing_ocr: [...needsOcr],
      pages_with_tables: [...withTables],
      pages_with_columns: [...withColumns],
      ...(detected.title ? { title: detected.title } : {}),
      ...(detected.author ? { author: detected.author } : {}),
      ...(encoding.length ? { encoding_warnings: encoding } : {}),
      pages: written,
    };
    writeFileSync(
      join(docDir, "index.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    const blank = written.filter((p) => p.empty).length;
    const hebrew = written.filter((p) => !p.empty);
    const meanHebrew = hebrew.length
      ? hebrew.reduce((sum, p) => sum + p.hebrew_share, 0) / hebrew.length
      : 0;

    console.log(
      `          wrote ${written.length} page JSON(s) to ${docDir}` +
        (written.length ? `, ${meanHebrew.toFixed(1)}% Hebrew on average` : "")
    );
    if (blank) console.log(`          ${blank} of them empty (no text layer)`);
    if (suspect.length) {
      console.log(
        `          ${suspect.length} page(s) need a look — ${suspect.slice(0, 12).join(", ")}` +
          `${suspect.length > 12 ? ", …" : ""} (pages_to_review in index.json)`
      );
    }
    if (skippedPages.length) {
      console.log(
        `          skipped ${skippedPages.length} page(s) that already existed (pass --force)`
      );
    }
    if (!manifest.complete) {
      console.log(
        `          ${detected.pageCount - present.length} of ${detected.pageCount} ` +
          `page(s) still unconverted — see index.json`
      );
    }
    if (pageFailures) failed++;
    console.log("");
  }

  if (skipped.length) console.log(`ignored ${skipped.length} non-PDF file(s)`);
  if (failed) process.exitCode = 1;
}

export { pageWindow, pageJson, encodingWarnings };

// Entry-point guard: `node pdf2json.mjs …` runs it, `import(…)` does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
