// ocr-scans.mjs — read scanned Hebrew pages: Tesseract first, Opus only where
// Tesseract looks unsure.
//
//   node scripts/ingestion/ocr-scans.mjs <file.pdf> --pages=5
//   node scripts/ingestion/ocr-scans.mjs <file.pdf> --pages=1-20 --commit
//   node scripts/ingestion/ocr-scans.mjs <file.pdf> --pages=5 --no-llm   # score only
//
// WHY A HYBRID. Measured on page 5 of 1.pdf, a page of חוק העונשין:
//
//   Tesseract (heb, tessdata_best)  2.3 s   $0        92.7% of words match
//   Haiku 4.5                       24 s    $0.010    unusable — invents phrases
//   Opus 5                          35 s    $0.111    no error found
//
// Tesseract is free, fast and mostly right. Opus is right. Running Opus over
// 2,309 pages is ~$195; running Tesseract is ~90 minutes and nothing. So
// Tesseract reads everything and Opus re-reads only the pages that need it.
//
// WHAT THE FLAG CAN AND CANNOT SEE. Tesseract reports a confidence per word,
// and it is honest about garbage: it scored "העזה" (for "העזר") at 0.0, and the
// handwritten margin notes in the teens. It is NOT honest about confident
// letter swaps — "עור" for "עזר" scored 93.3, "ששה" for "שישה" 96.9, because
// both are real Hebrew words. One letter, high confidence, wrong.
//
// That is why the flag is a PAGE-level decision, not a word-level one. A page
// carrying obvious garbage is a page whose quiet errors you cannot trust
// either, so the whole page goes to Opus. It also means the flag will miss a
// page whose only defect is one confident swap — the hybrid reduces the error
// rate, it does not zero it, and legal text still wants a human or a quote-lock
// pass behind it.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..", "..");
dotenv.config({ path: join(APP_ROOT, ".env.local") });
dotenv.config({ path: join(APP_ROOT, ".env") });

const TESSERACT = process.env.TESSERACT_PATH ?? "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";
const TESSDATA = process.env.TESSDATA_DIR ?? join(HERE, "tmp", "tessdata");
const WORK = join(HERE, "tmp", "ocr");
const MODEL = process.env.OCR_MODEL ?? "claude-opus-5";
const DPI = 150;

/**
 * When a page is re-read by the model.
 *
 * Calibrated on one page, which is not enough to settle them — run with
 * --no-llm over a few dozen pages first and look at what fraction trips, since
 * that fraction IS the cost of the run. Each rule exists for a defect seen in
 * the sample:
 *
 *   meanConf      the page as a whole came out shaky.
 *   lowShare      a tail of bad words, even if the average looks fine. Page 5
 *                 had mean 87.9 — respectable — with 5.8% of words under 60.
 *   anyVeryLow    a single wholly-failed word. "העזה" scored 0.0; a page with
 *                 one of those has usually got more wrong than that one word.
 *   latinInHebrew poppler/tesseract confusing scripts mid-word, which is how a
 *                 citation turns into something unsearchable.
 */
const FLAG = {
  meanConf: 85,
  lowShare: 0.03,
  lowBelow: 60,
  anyVeryLow: 30,
};

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const pdf = argv.find((a) => !a.startsWith("--"));
const noLlm = argv.includes("--no-llm");
const commit = argv.includes("--commit");

if (!pdf || argv.includes("--help")) {
  console.log(
    [
      "ocr-scans.mjs — Tesseract first, Opus only on pages that look unsure.",
      "",
      "  node scripts/ingestion/ocr-scans.mjs <file.pdf> --pages=5",
      "  node scripts/ingestion/ocr-scans.mjs <file.pdf> --pages=1-20 --no-llm",
      "",
      "  --pages=N | N-M   which pages (1-based). Default: 1",
      "  --no-llm          score with Tesseract only — use this to learn the",
      "                    flag rate before paying for a run",
      "  --commit          write <pdf>.ocr.json beside the output",
      "",
      `  Model: ${MODEL}. Tesseract: ${TESSERACT}`,
    ].join("\n")
  );
  process.exit(pdf ? 0 : 2);
}

const pageSpec = flagOf("pages") ?? "1";
const [from, to] = pageSpec.includes("-")
  ? pageSpec.split("-").map(Number)
  : [Number(pageSpec), Number(pageSpec)];

mkdirSync(WORK, { recursive: true });

/** Render one page to PNG via PyMuPDF — the renderer hebrew_pdf_to_json.py
 *  already depends on, so this adds no new requirement. */
function renderPage(pdfPath, pageNo) {
  const out = join(WORK, `page-${pageNo}.png`);
  const code = [
    "import fitz, sys",
    `d = fitz.open(r"${pdfPath}")`,
    `d[${pageNo - 1}].get_pixmap(dpi=${DPI}).save(r"${out}")`,
  ].join("\n");
  const result = spawnSync("python", ["-c", code], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`render failed: ${result.stderr}`);
  return out;
}

/** Tesseract, returning both the text and the per-word confidence it is scored
 *  on. The TSV mode needs the `configs` directory, which is why --tessdata-dir
 *  must point at a copy that has it, not at a bare traineddata file. */
function tesseract(png, pageNo) {
  const base = join(WORK, `tess-${pageNo}`);
  const run = (mode) =>
    spawnSync(TESSERACT, [png, base, "--tessdata-dir", TESSDATA, "-l", "heb", "--psm", "3", ...mode], {
      encoding: "utf8",
    });
  const started = Date.now();
  run([]);
  run(["tsv"]);
  const seconds = (Date.now() - started) / 1000;

  const text = existsSync(`${base}.txt`) ? readFileSync(`${base}.txt`, "utf8") : "";
  const tsv = existsSync(`${base}.tsv`) ? readFileSync(`${base}.tsv`, "utf8") : "";

  const words = tsv
    .split("\n")
    .slice(1)
    .map((line) => line.split("\t"))
    .filter((cols) => cols.length >= 12 && (cols[11] ?? "").trim() && Number(cols[10]) >= 0)
    .map((cols) => ({ conf: Number(cols[10]), text: cols[11].trim() }));

  return { text, words, seconds };
}

/** Does this page need a second opinion? */
function score(words) {
  if (words.length === 0) return { flagged: true, why: "no words read at all", mean: 0, lowShare: 1 };

  const mean = words.reduce((sum, w) => sum + w.conf, 0) / words.length;
  const low = words.filter((w) => w.conf < FLAG.lowBelow).length;
  const lowShare = low / words.length;
  const veryLow = words.filter((w) => w.conf < FLAG.anyVeryLow);
  // A Latin letter inside an otherwise-Hebrew token. Page numbers and years are
  // fine; "lייק" is not.
  const mixed = words.filter((w) => /[\u0590-\u05FF]/.test(w.text) && /[A-Za-z]/.test(w.text));

  const reasons = [];
  if (mean < FLAG.meanConf) reasons.push(`mean confidence ${mean.toFixed(1)} < ${FLAG.meanConf}`);
  if (lowShare > FLAG.lowShare)
    reasons.push(`${(lowShare * 100).toFixed(1)}% of words below ${FLAG.lowBelow} (limit ${FLAG.lowShare * 100}%)`);
  if (veryLow.length > 0)
    reasons.push(`${veryLow.length} word(s) below ${FLAG.anyVeryLow}: ${veryLow.slice(0, 4).map((w) => w.text).join(", ")}`);
  if (mixed.length > 0) reasons.push(`${mixed.length} Hebrew/Latin mixed token(s)`);

  return { flagged: reasons.length > 0, why: reasons.join("; "), mean, lowShare };
}

const PROMPT = `אתה מתעתק סריקה של ספר לימוד משפטי בעברית.

העתק את כל הטקסט בעמוד, בדיוק כפי שהוא מופיע.

כללים:
- אל תתקן שגיאות, אל תשלים מילים חסרות, אל תתרגם ואל תסכם.
- שמור על סדר השורות ועל מעברי הפסקאות.
- כותרות, מספרי סעיפים, הערות שוליים ומספר העמוד — העתק גם אותם, במקומם.
- טקסט בכתב יד או טקסט שאינו קריא: סמן [לא קריא] במקומו, ואל תנחש.
- אם העמוד ריק, החזר מחרוזת ריקה.

החזר JSON בלבד: {"text": "...", "unreadable_spans": <מספר>, "notes": "..."}`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function askModel(png) {
  const started = Date.now();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(png).toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  const raw = message.content.find((b) => b.type === "text")?.text ?? "";
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    parsed = { text: raw, unreadable_spans: null, notes: "model did not return JSON" };
  }
  return { ...parsed, usage: message.usage, seconds: (Date.now() - started) / 1000 };
}

// Opus 5 list price. Haiku is cheaper and, on this material, not usable — see
// the header.
const RATE = MODEL.includes("haiku") ? { input: 1, output: 5 } : { input: 5, output: 25 };

const pages = [];
let tessSeconds = 0;
let llmSeconds = 0;
let cost = 0;

for (let pageNo = from; pageNo <= to; pageNo += 1) {
  const png = renderPage(pdf, pageNo);
  const tess = tesseract(png, pageNo);
  tessSeconds += tess.seconds;
  const verdict = score(tess.words);

  console.log(
    `page ${pageNo}: tesseract ${tess.words.length} words, mean ${verdict.mean.toFixed(1)}, ` +
      `${tess.seconds.toFixed(1)}s — ${verdict.flagged ? "FLAGGED" : "clean"}`
  );
  if (verdict.flagged) console.log(`  ${verdict.why}`);

  let final = { source: "tesseract", text: tess.text };
  if (verdict.flagged && !noLlm) {
    const llm = await askModel(png);
    llmSeconds += llm.seconds;
    const spent =
      (llm.usage.input_tokens / 1e6) * RATE.input + (llm.usage.output_tokens / 1e6) * RATE.output;
    cost += spent;
    console.log(
      `  re-read by ${MODEL}: ${String(llm.text ?? "").length} chars, ` +
        `${llm.seconds.toFixed(1)}s, $${spent.toFixed(4)}, ${llm.unreadable_spans ?? "?"} unreadable span(s)`
    );
    final = { source: MODEL, text: llm.text, unreadable_spans: llm.unreadable_spans, notes: llm.notes };
  }

  pages.push({ page: pageNo, tesseract: { mean: verdict.mean, words: tess.words.length }, flagged: verdict.flagged, why: verdict.why, ...final });
}

const flagged = pages.filter((p) => p.flagged).length;
const n = pages.length;
console.log(
  `\n${n} page(s): ${flagged} flagged (${((flagged / n) * 100).toFixed(0)}%), ` +
    `tesseract ${tessSeconds.toFixed(1)}s, model ${llmSeconds.toFixed(1)}s, $${cost.toFixed(4)}`
);

// The only number anyone actually wants, and the one a single page cannot give
// honestly: the flag RATE drives the cost of the whole book, and one page is a
// sample of one.
const TOTAL_PAGES = 2309;
if (n > 0) {
  const perPageCost = cost / n;
  const perPageSecs = (tessSeconds + llmSeconds) / n;
  console.log(
    `\nextrapolated to ${TOTAL_PAGES} pages at this flag rate:\n` +
      `  cost  $${(perPageCost * TOTAL_PAGES).toFixed(2)}\n` +
      `  time  ${((perPageSecs * TOTAL_PAGES) / 3600).toFixed(1)} h serial, ` +
      `${((perPageSecs * TOTAL_PAGES) / 3600 / 8).toFixed(1)} h at 8 concurrent\n` +
      `  (from ${n} page(s) — run --no-llm over 30+ pages before trusting this)`
  );
}

if (commit) {
  const dest = `${pdf}.ocr.json`;
  writeFileSync(dest, JSON.stringify({ pdf, model: MODEL, pages }, null, 1), "utf8");
  console.log(`\n-> ${dest}`);
}
