// docx2json.mjs — extract the text of a Word document to JSON, via anydoc.
//
//   node scripts/ingestion/docx2json.mjs <folder|file...> --out=<dir>
//   node scripts/ingestion/docx2json.mjs book.docx --out=json/ --mode=templates
//   node scripts/ingestion/docx2json.mjs folder/  --out=json/ --html
//
// NO OCR, NO UPLOAD, NO API KEY. This is the case @firecrawl/anydoc is actually
// built for: a .docx carries its text, so anydoc's local Rust parser reads it
// and nothing leaves this machine. That is the whole reason this script exists
// beside jpeg2json.mjs — the same material photographed and OCR'd came back
// 0.9% Hebrew from the hosted model and 33.8% from a vision model marking most
// of the page unreadable, while the .docx of it reads at ~55% Hebrew, which is
// simply what Hebrew prose measures. If a document exists in both forms, this
// is the one to use, every time.
//
// THREE MODES, BECAUSE A DOCUMENT IS NOT ALWAYS A LIST OF THE SAME THING.
//
//   --mode=document (default) — a faithful structural extraction: the headings
//     the document has, the paragraphs under each, and its tables as named
//     columns and rows. Works on any .docx and invents no structure.
//   --mode=templates — for a book of writing skeletons. Maps the shape those
//     use (a bold title, then a one-cell table holding the whole form) onto
//     open_question_templates: number, part, title, summary, body.
//   --mode=questions — for an exam paper: numbered stems with four א–ד options,
//     written in scratchpad/pdf2json.py's shape. Shares the parser with
//     jpeg2json.mjs rather than growing a second one.
//
// Other formats anydoc reads locally work too — .doc, .rtf, .odt, .epub, .pptx,
// .xlsx, .csv. A PDF is accepted and will fail with `needsOcr` if its pages are
// scans, which is the point at which jpeg2json.mjs is the right tool.

import { writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { pathToFileURL } from "node:url";

import { toLines, parse as parseQuestions } from "./jpeg2json.mjs";

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const outDir = flagOf("out");
const wantHtml = argv.includes("--html");
const keepMd = argv.includes("--keep-md");
const force = argv.includes("--force");
const mode = flagOf("mode") ?? "document";
const inputs = argv.filter((a) => !a.startsWith("--"));

/**
 * Checked in main(), NOT here, because this module is imported as a library —
 * pdf2json.mjs takes `toStructure` and `asDocument` from it. A `process.exit`
 * at module scope runs on IMPORT, judging the importing script's own argv by
 * this script's vocabulary, and kills it before it starts. That is not
 * hypothetical: this file reads `--mode=document`, jpeg2json.mjs (imported
 * below) reads the same argv and accepts only 'questions' or 'templates', so
 * `docx2json.mjs --mode=document` — the usage in the header — exited 2 inside
 * an import without ever reaching a document.
 */
function validateFlags() {
  if (!["document", "templates", "questions"].includes(mode)) {
    console.error(`--mode must be 'document', 'templates' or 'questions' (got '${mode}')`);
    process.exit(2);
  }
}

// Everything anydoc converts locally. PDF is in the list because it often is
// text, and when it is not the error says so precisely.
const DOC_EXT = new Set([
  ".doc", ".docx", ".docm", ".odt", ".rtf", ".epub",
  ".ppt", ".pps", ".pot", ".pptx", ".pptm", ".ppsx", ".ppsm",
  ".xls", ".xlsx", ".xlsm", ".xlsb", ".ods", ".odp", ".csv", ".pdf",
]);

function collectDocs(paths) {
  const found = [];
  const skipped = [];
  for (const p of paths) {
    if (!existsSync(p)) throw new Error(`no such path: ${p}`);
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p)) {
        const full = join(p, name);
        if (!statSync(full).isFile()) continue;
        if (DOC_EXT.has(extname(name).toLowerCase())) found.push(full);
        else skipped.push(name);
      }
    } else if (DOC_EXT.has(extname(p).toLowerCase())) {
      found.push(p);
    } else {
      skipped.push(basename(p));
    }
  }
  return {
    docs: found.sort((a, b) => basename(a).localeCompare(basename(b), undefined, { numeric: true })),
    skipped,
  };
}

// ------------------------------------------------------------- markdown

/**
 * Undo what the Markdown writer added, so the JSON holds the document's text
 * rather than a rendering of it.
 *
 * `<br>` is the one that matters most: anydoc puts a whole multi-line table
 * cell on one line separated by `<br>`, and a skeleton's body IS its line
 * breaks — collapsing them would turn a court-heading form into a paragraph.
 */
function unmark(cell) {
  return cell
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold, keeping the text
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1") // escaped punctuation
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isTableRule = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line);
/** A paragraph that is nothing but bold text — how this document marks a heading. */
const BOLD_ONLY_RE = /^\*\*(.+?)\*\*$/;

/** The cells of one `| a | b |` row. */
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(unmark);
}

/**
 * Markdown to blocks: headings, paragraphs and tables, in document order.
 *
 * This is deliberately shallow. The job is to carry the document's own shape
 * into JSON — not to interpret it, which is what the modes below do.
 */
function toStructure(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isTableRow(line)) {
      const rows = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        if (!isTableRule(lines[i].trim())) rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      if (rows.length) blocks.push({ kind: "table", rows });
      continue;
    }

    const md = /^(#{1,6})\s+(.*)$/.exec(line);
    if (md) {
      blocks.push({ kind: "heading", level: md[1].length, text: unmark(md[2]) });
      continue;
    }

    const bold = BOLD_ONLY_RE.exec(line);
    if (bold && !bold[1].includes("**")) {
      // A Word document that never applied heading styles still marks its
      // headings — in bold, on a line of their own. Reading that is the
      // difference between a list of sections and one undifferentiated blob.
      blocks.push({ kind: "heading", level: 2, text: unmark(bold[1]) });
      continue;
    }

    blocks.push({ kind: "paragraph", text: unmark(line) });
  }

  return blocks;
}

// --------------------------------------------------------------- modes

/**
 * Blocks to sections: each heading with the paragraphs and tables beneath it.
 *
 * A table keeps its header row as column names when it has one, because
 * `{"שגוי": "אודות", "תקין": "על אודות"}` is usable and `["אודות", "על אודות"]`
 * has to be decoded by whoever reads it.
 */
function asDocument(blocks) {
  const sections = [];
  const warnings = [];
  let current = null;

  const open = (heading) => {
    current = { heading, paragraphs: [], tables: [] };
    sections.push(current);
  };

  for (const block of blocks) {
    if (block.kind === "heading") {
      open(block.text);
      continue;
    }
    if (!current) open("");

    if (block.kind === "paragraph") {
      current.paragraphs.push(block.text);
      continue;
    }

    const [head, ...rest] = block.rows;
    const width = Math.max(...block.rows.map((r) => r.length));
    // A header row is one whose cells are all short, non-empty labels and where
    // data rows follow. Anything else is data all the way down.
    const looksLabelled =
      rest.length > 0 && head.every((c) => c.length > 0 && c.length <= 24 && !c.includes("\n"));

    if (looksLabelled) {
      current.tables.push({
        columns: head,
        rows: rest.map((r) => Object.fromEntries(head.map((c, n) => [c, r[n] ?? ""]))),
      });
    } else {
      current.tables.push({ columns: null, rows: block.rows });
    }
    if (width > head.length) warnings.push(`"${current.heading}": a table row has more cells than its header`);
  }

  const empty = sections.filter((s) => !s.paragraphs.length && !s.tables.length).map((s) => s.heading);
  for (const h of empty) warnings.push(`"${h}": heading with nothing under it`);

  return { sections, warnings };
}

/**
 * Blocks to open_question_templates rows.
 *
 * The shape this document uses: a bold title, then a table of ONE cell holding
 * the entire form. So a heading followed by a single-cell table is a template,
 * and its body is that cell with its line breaks intact.
 *
 * part is left empty. It is the field open_question_templates derives
 * legal_area from, and this document does not print one — inventing it here
 * would be guessing at the field that decides which skeletons a candidate is
 * offered. The warning says so rather than the JSON hiding it.
 */
function asTemplates(blocks) {
  const templates = [];
  const warnings = [];
  let title = null;
  let number = 0;

  for (const block of blocks) {
    if (block.kind === "heading") {
      if (title) warnings.push(`"${title}": no skeleton followed the title`);
      title = block.text;
      continue;
    }
    if (block.kind === "table" && title) {
      const body = block.rows.map((r) => r.filter(Boolean).join("\n")).filter(Boolean).join("\n").trim();
      templates.push({ number: ++number, part: "", title, summary: "", body });
      if (!body) warnings.push(`"${title}": the skeleton body is empty`);
      title = null;
    }
    // A paragraph between a title and its table is a description of it.
    if (block.kind === "paragraph" && title && templates.length === 0) {
      // Leading blurb for the document as a whole, not for this title.
      continue;
    }
  }
  if (title) warnings.push(`"${title}": no skeleton followed the title`);
  if (templates.length) {
    warnings.push(
      `no part headings in this document — every template has part="". ` +
        `open_question_templates derives legal_area from part, so set it before loading.`
    );
  }

  return { templates, warnings };
}

// ----------------------------------------------------------- proof sheet

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hebrewShare = (t) => (t.length ? (100 * (t.match(/[֐-׿]/g) ?? []).length) / t.length : 0);

/** The extracted JSON rendered back as a page, so it can be read rather than parsed. */
function proofSheet(out, title) {
  let body = "";

  if (out.sections) {
    body = out.sections
      .map(
        (s) => `<section><h2>${esc(s.heading) || "<i>(ללא כותרת)</i>"}</h2>
${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n")}
${s.tables
  .map((t) =>
    t.columns
      ? `<table><thead><tr>${t.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${t.rows
          .map((r) => `<tr>${t.columns.map((c) => `<td>${esc(r[c] ?? "").replace(/\n/g, "<br>")}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      : `<table><tbody>${t.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
  )
  .join("\n")}</section>`
      )
      .join("\n");
  } else if (out.templates) {
    body = out.templates
      .map(
        (t) => `<section><h2>${t.number}. ${esc(t.title)}</h2>
${t.summary ? `<p>${esc(t.summary)}</p>` : ""}
<pre>${esc(t.body)}</pre></section>`
      )
      .join("\n");
  } else {
    body = (out.questions ?? [])
      .map(
        (q) => `<section><h2>שאלה ${q.number}</h2>
${q.preamble ? `<p><i>${esc(q.preamble)}</i></p>` : ""}
<p>${esc(q.question)}</p>
<ol>${q.options.map((o) => `<li><b>${esc(o.id)}</b> ${esc(o.text)}</li>`).join("")}</ol></section>`
      )
      .join("\n");
  }

  return `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark; --line: #d8d8d8; }
  body { font-family: "Segoe UI", Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 24px; line-height: 1.7; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin: 0 0 8px; }
  .lede { color: #666; font-size: 14px; margin-bottom: 24px; }
  section { border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 14px; }
  th, td { border: 1px solid var(--line); padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #00000008; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; background: #00000006; padding: 10px; border-radius: 6px; margin: 0; }
  ol { margin: 6px 0; padding-inline-start: 22px; }
</style>
<h1>${esc(title)}</h1>
<p class="lede">${esc(out.source_file)} · ${
    out.section_count ?? out.template_count ?? out.question_count
  } ${out.sections ? "מקטעים" : out.templates ? "תבניות" : "שאלות"}</p>
${body}
</html>
`;
}

// ------------------------------------------------------------------ main

async function main() {
  validateFlags();

  if (inputs.length === 0 || argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/docx2json.mjs <folder|file...> --out=<dir>\n" +
        "       [--mode=document|templates|questions] [--html] [--keep-md] [--force]"
    );
    process.exit(inputs.length === 0 ? 2 : 0);
  }

  const { docs, skipped } = collectDocs(inputs);
  if (docs.length === 0) {
    console.error(`no document found in ${inputs.join(", ")}`);
    if (skipped.length) console.error(`  ignored: ${skipped.slice(0, 8).join(", ")}`);
    process.exit(1);
  }

  let toMarkdown;
  try {
    ({ toMarkdown } = await import("@firecrawl/anydoc"));
  } catch {
    console.error("\n@firecrawl/anydoc is not installed. Run:\n  npm install --save-dev @firecrawl/anydoc");
    process.exit(1);
  }

  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  console.log(`${docs.length} document(s), mode=${mode}\n`);

  let failed = 0;

  for (const path of docs) {
    const name = basename(path, extname(path));
    const stem = join(outDir ?? ".", name);
    const jsonPath = `${stem}.json`;

    if (existsSync(jsonPath) && !force) {
      console.log(`  skip    ${name} — ${basename(jsonPath)} exists (pass --force to overwrite)`);
      continue;
    }

    let markdown;
    try {
      // Local. No network, no key, no OCR.
      markdown = await toMarkdown(path);
    } catch (error) {
      failed++;
      const hint = {
        needsOcr: "its pages are scans — use scripts/ingestion/jpeg2json.mjs instead",
        unsupported: "anydoc does not read this format",
        encrypted: "the file is password-protected",
        malformed: "no readable content could be extracted",
      }[error.code];
      console.log(`  FAILED  ${name} (${error.code ?? "unknown"}) — ${error.message}`);
      if (hint) console.log(`          ${hint}`);
      continue;
    }

    if (keepMd) writeFileSync(`${stem}.md`, markdown, "utf8");

    const blocks = toStructure(markdown);
    const envelope = { source_file: basename(path), language: "he" };
    let out;
    let count;

    if (mode === "templates") {
      const { templates, warnings } = asTemplates(blocks);
      out = { ...envelope, template_count: templates.length, templates, ...(warnings.length ? { warnings } : {}) };
      count = `${templates.length} template(s)`;
    } else if (mode === "questions") {
      const { questions, warnings } = parseQuestions(toLines(markdown));
      out = { ...envelope, question_count: questions.length, questions, ...(warnings.length ? { warnings } : {}) };
      count = `${questions.length} question(s)`;
    } else {
      const { sections, warnings } = asDocument(blocks);
      const tables = sections.reduce((n, s) => n + s.tables.length, 0);
      out = { ...envelope, section_count: sections.length, sections, ...(warnings.length ? { warnings } : {}) };
      count = `${sections.length} section(s), ${tables} table(s)`;
    }

    writeFileSync(jsonPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
    console.log(`  ok      ${name} — ${count}, ${hebrewShare(markdown).toFixed(1)}% Hebrew`);

    if (wantHtml) {
      writeFileSync(`${stem}.html`, proofSheet(out, name), "utf8");
      console.log(`          wrote ${basename(stem)}.html`);
    }
    for (const w of out.warnings ?? []) console.log(`          ! ${w}`);
  }

  if (skipped.length) console.log(`\nignored ${skipped.length} non-document file(s)`);
  if (failed) process.exitCode = 1;
}

export { toStructure, asDocument, asTemplates, unmark };

// Entry-point guard: `node docx2json.mjs …` runs it, `import(…)` does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
