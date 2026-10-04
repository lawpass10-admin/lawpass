// vision-ocr-pdf.mjs — read a scanned Hebrew PDF with Google Cloud Vision.
//
//   node --dns-result-order=ipv4first scripts/ingestion/vision-ocr-pdf.mjs <file.pdf>
//   … --pages=1-40 --concurrency=6 --tesseract      (also run Tesseract, to compare)
//
// WHY VISION. Measured on page 5 of 1.pdf against an Opus transcription that was
// checked line by line against the image:
//
//   Google Vision   95.5%   0.9 s/page   ~$1.50 per 1,000 pages
//   Tesseract       92.7%   2.2 s/page   free
//   OCRmyPDF        86.7%   8 s/page     free   (it IS Tesseract, plus bidi damage)
//   OpenCV variants 85-91%  ~3 s/page    free   (preprocessing made it worse)
//   Haiku 4.5       unusable — invents whole phrases
//   Opus 5          the reference; ~$0.11/page
//
// Vision is both the most accurate of the cheap options and the fastest, which
// is not the usual trade. It fixed the errors that made Tesseract unsafe here:
// חוק העזר (Tesseract: העזה), הכנסת (הבנסת), 2017 (2047).
//
// WHAT IT STILL GETS WRONG, and what no engine here solved: handwritten margin
// notes are transcribed as if they were print, so noise lands inline. Only Opus
// marked them [לא קריא]. And כ/ב confusion survives everywhere — Vision wrote
// סבום for סכום. Hebrew OCR on a scan is not a solved problem; this is the best
// cheap starting point, not a finished text.
//
// --dns-result-order=ipv4first IS REQUIRED on this machine. Without it every
// call dies with UND_ERR_CONNECT_TIMEOUT while curl reaches the same host
// fine — Node's resolver tries IPv6 first and nothing answers.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..", "..");
dotenv.config({ path: join(APP_ROOT, ".env.local") });
dotenv.config({ path: join(APP_ROOT, ".env") });

const TESSERACT = process.env.TESSERACT_PATH ?? "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";
const TESSDATA = process.env.TESSDATA_DIR ?? join(HERE, "tmp", "tessdata");
const DPI = 150;

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const pdf = argv.find((a) => !a.startsWith("--"));
const withTesseract = argv.includes("--tesseract");
const concurrency = Number(flagOf("concurrency") ?? 6);
const outDir = flagOf("out-dir");

/**
 * Blocks below this confidence are dropped from `text`.
 *
 * The handwritten margin notes on these scans are what this removes. Measured
 * on page 5, where the separation is clean: the four handwritten blocks scored
 * 42, 45, 57 and 62, while the lowest PRINTED block — a section heading — scored
 * 91. 75 sits in the gap, nearer the noise, because a page of dense or faint
 * print can legitimately dip into the 80s and losing real text is the worse
 * error.
 *
 * Nothing is destroyed: what is dropped is kept on the page under `dropped`,
 * so the decision is reversible without re-reading the page.
 */
const MIN_BLOCK_CONFIDENCE = Number(flagOf("min-block-confidence") ?? 75) / 100;

if (!pdf) {
  console.error("usage: node --dns-result-order=ipv4first vision-ocr-pdf.mjs <file.pdf> [--pages=1-40] [--concurrency=6] [--tesseract]");
  process.exit(2);
}

const key = process.env.GOOGLE_VISION_API_KEY;
if (!key) {
  console.error("GOOGLE_VISION_API_KEY is not set (it lives in .env.local)");
  process.exit(2);
}

const WORK = join(HERE, "tmp", "vision", pdf.split(/[\\/]/).pop().replace(/\.pdf$/i, ""));
mkdirSync(WORK, { recursive: true });

/** Page count, and every page rendered to PNG in one Python call — 156 separate
 *  interpreter starts would cost more than the OCR does. */
function renderAll(pdfPath, from, to) {
  const code = [
    "import fitz, json, sys",
    `d = fitz.open(r"${pdfPath}")`,
    `lo, hi = ${from || 1}, ${to || 0}`,
    "hi = min(hi, len(d)) if hi else len(d)",
    "out = []",
    "for i in range(lo - 1, hi):",
    `    p = r"${WORK.replace(/\\/g, "\\\\")}" + "\\\\page-" + str(i + 1) + ".png"`,
    "    import os",
    "    if not os.path.exists(p):",
    `        d[i].get_pixmap(dpi=${DPI}).save(p)`,
    "    out.append([i + 1, p])",
    "print(json.dumps({'total': len(d), 'pages': out}))",
  ].join("\n");
  const result = spawnSync("python", ["-c", code], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`render failed: ${result.stderr}`);
  return JSON.parse(result.stdout.trim().split("\n").pop());
}

/**
 * Normalise what Vision reliably gets cosmetically wrong.
 *
 * Only the two Hebrew punctuation marks, which it renders as ASCII quotes:
 * gershayim ״ in acronyms (התשל״ז) and geresh ׳ in ordinals (א׳). Replacing
 * them is safe because an ASCII quote between two Hebrew letters is never a
 * real quotation. Nothing else is touched — a "fix" that guessed at letters
 * would be the confabulation problem all over again.
 */
function normalise(text) {
  return text
    .replace(/(?<=[\u05D0-\u05EA])"(?=[\u05D0-\u05EA])/g, "\u05F4")
    .replace(/(?<=[\u05D0-\u05EA])'(?=\s|$)/g, "\u05F3");
}

async function vision(png) {
  const started = Date.now();
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: readFileSync(png).toString("base64") },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        },
      ],
    }),
  });
  const body = await response.json();
  const err = body.responses?.[0]?.error ?? body.error;
  if (!response.ok || err) throw new Error(`${response.status} ${err?.message ?? "unknown"}`);

  const ann = body.responses[0].fullTextAnnotation;
  const blocks = ann?.pages?.flatMap((p) => p.blocks ?? []) ?? [];

  // Rebuilt from the blocks we keep rather than taken from `fullTextAnnotation.text`,
  // which is the whole page including the handwriting.
  /**
   * Spacing comes from Vision's own `detectedBreak`, not from joining words
   * with a space.
   *
   * Joining on " " looks right and is not: it puts a space before every comma
   * and inside every hyphenated date, so "חוק העונשין, התשל״ז-1977" comes out
   * as "חוק העונשין , התשל״ז -1977". Vision already says, per symbol, whether a
   * space or a line break follows — it is the same information
   * `fullTextAnnotation.text` is built from, and using it means the filtered
   * text is spaced exactly like the unfiltered text would have been.
   */
  const blockText = (blk) => {
    let out = "";
    for (const par of blk.paragraphs ?? []) {
      for (const word of par.words ?? []) {
        for (const sym of word.symbols ?? []) {
          out += sym.text;
          const brk = sym.property?.detectedBreak?.type;
          if (brk === "SPACE" || brk === "SURE_SPACE" || brk === "EOL_SURE_SPACE") out += " ";
          else if (brk === "LINE_BREAK") out += "\n";
          else if (brk === "HYPHEN") out += "-\n";
        }
      }
      out += "\n";
    }
    return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  const kept = blocks.filter((b) => (b.confidence ?? 0) >= MIN_BLOCK_CONFIDENCE);
  const dropped = blocks
    .filter((b) => (b.confidence ?? 0) < MIN_BLOCK_CONFIDENCE)
    .map((b) => ({ confidence: b.confidence ?? null, text: blockText(b) }));

  const confs = kept.map((b) => b.confidence).filter((c) => typeof c === "number");
  return {
    text: normalise(kept.map(blockText).join("\n")),
    blocks: kept.length,
    droppedBlocks: dropped,
    confidence: confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null,
    seconds: (Date.now() - started) / 1000,
  };
}

function tesseract(png, pageNo) {
  const base = join(WORK, `tess-${pageNo}`);
  const started = Date.now();
  spawnSync(TESSERACT, [png, base, "--tessdata-dir", TESSDATA, "-l", "heb", "--psm", "3"], { encoding: "utf8" });
  return {
    text: existsSync(`${base}.txt`) ? readFileSync(`${base}.txt`, "utf8") : "",
    seconds: (Date.now() - started) / 1000,
  };
}

/** Word-level agreement between two readings of the same page. With no ground
 *  truth over a whole book, two independent engines agreeing IS the signal:
 *  where they diverge, at least one is wrong and the page wants a closer look. */
const words = (s) => s.match(/[\u0590-\u05FF"'־-]+|\d+/g) ?? [];
function agreement(a, b) {
  const A = words(a), B = words(b);
  if (A.length === 0 || B.length === 0) return 0;
  const counts = new Map();
  for (const w of A) counts.set(w, (counts.get(w) ?? 0) + 1);
  let shared = 0;
  for (const w of B) {
    const n = counts.get(w) ?? 0;
    if (n > 0) { shared += 1; counts.set(w, n - 1); }
  }
  return (2 * shared) / (A.length + B.length);
}

const spec = flagOf("pages");
const [from, to] = spec ? (spec.includes("-") ? spec.split("-").map(Number) : [Number(spec), Number(spec)]) : [1, 0];

console.log(`rendering…`);
const { total, pages: rendered } = renderAll(pdf, from, to);
console.log(`${rendered.length} of ${total} page(s) ready at ${DPI} dpi\n`);

const results = new Array(rendered.length);
let visionSeconds = 0, tessSeconds = 0, done = 0;
const wallStart = Date.now();

// A small worker pool: Vision is a network call, so the limit is round trips,
// not CPU. Six at a time keeps well inside the default per-minute quota.
async function worker(queue) {
  for (;;) {
    const item = queue.shift();
    if (!item) return;
    const [index, [pageNo, png]] = item;
    try {
      const v = await vision(png);
      visionSeconds += v.seconds;
      let t = null, agree = null;
      if (withTesseract) {
        t = tesseract(png, pageNo);
        tessSeconds += t.seconds;
        agree = agreement(v.text, t.text);
      }
      results[index] = { page: pageNo, chars: v.text.length, blocks: v.blocks, confidence: v.confidence, agreement: agree, text: v.text, dropped: v.droppedBlocks };
    } catch (error) {
      results[index] = { page: pageNo, error: String(error.message ?? error) };
      console.error(`  page ${pageNo}: ${error.message}`);
    }
    done += 1;
    if (done % 20 === 0) process.stdout.write(`  ${done}/${rendered.length} pages…\n`);
  }
}

const queue = rendered.map((entry, i) => [i, entry]);
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker(queue)));

const wall = (Date.now() - wallStart) / 1000;
const ok = results.filter((r) => r && !r.error);
const confs = ok.map((r) => r.confidence).filter((c) => typeof c === "number");
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

console.log(`\n${ok.length} page(s) read, ${results.length - ok.length} failed`);
console.log(`  wall clock      ${wall.toFixed(1)}s  (${(wall / results.length).toFixed(2)}s per page at ${concurrency} concurrent)`);
console.log(`  vision time     ${visionSeconds.toFixed(1)}s total`);
if (withTesseract) console.log(`  tesseract time  ${tessSeconds.toFixed(1)}s total`);
console.log(`  characters      ${ok.reduce((s, r) => s + r.chars, 0).toLocaleString()}`);
console.log(`  confidence      mean ${(mean(confs) * 100).toFixed(1)}, min ${(Math.min(...confs) * 100).toFixed(1)}`);

if (withTesseract) {
  const agrees = ok.map((r) => r.agreement).filter((a) => typeof a === "number");
  console.log(`  vision↔tesseract agreement  mean ${(mean(agrees) * 100).toFixed(1)}%`);
  const worst = ok.filter((r) => typeof r.agreement === "number").sort((a, b) => a.agreement - b.agreement).slice(0, 10);
  console.log(`\n  pages where the two engines disagree most (worth a closer read):`);
  for (const r of worst) {
    console.log(`    page ${String(r.page).padStart(3)}  agreement ${(r.agreement * 100).toFixed(0)}%  confidence ${(r.confidence * 100).toFixed(0)}  ${r.chars} chars`);
  }
}

// Both separators: the paths handed to this are Windows paths with backslashes.
const base = pdf.split(/[\\/]/).pop().replace(/\.pdf$/i, "");
const dest = outDir ? join(outDir, `${base}.vision.json`) : `${pdf}.vision.json`;
if (outDir) mkdirSync(outDir, { recursive: true });
writeFileSync(dest, JSON.stringify({ pdf, engine: "google-vision DOCUMENT_TEXT_DETECTION", dpi: DPI, pages: results }, null, 1), "utf8");
console.log(`\n-> ${dest}`);
const droppedTotal = ok.reduce((sum, r) => sum + (r.dropped?.length ?? 0), 0);
console.log(`dropped ${droppedTotal} block(s) below ${(MIN_BLOCK_CONFIDENCE * 100).toFixed(0)} confidence (handwriting/noise); kept on each page under "dropped"`);
console.log(`cost: ${ok.length} page(s) × $1.50/1000 = $${((ok.length * 1.5) / 1000).toFixed(2)} (first 1,000/month free)`);
