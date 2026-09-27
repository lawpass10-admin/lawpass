// jpeg2json.mjs — turn scanned exam pages (JPEG) into the question JSON that
// quesion_json/ already holds, so a paper that exists only as photographs can
// be loaded the same way a PDF one is.
//
//   node scripts/ingestion/jpeg2json.mjs <folder|file...> --out=<dir>
//   node scripts/ingestion/jpeg2json.mjs pages/ --out=json/ --exam=2019_קיץ_חלק_3
//   node scripts/ingestion/jpeg2json.mjs pages/ --out=json/ --rotate=270 # sideways photos
//   node scripts/ingestion/jpeg2json.mjs book/  --out=json/ --mode=templates
//   node scripts/ingestion/jpeg2json.mjs book/  --out=json/ --ocr=claude   # photos
//   node scripts/ingestion/jpeg2json.mjs pages/ --out=json/ --keep-md   # keep the OCR
//
// WHY A PDF SITS IN THE MIDDLE. @firecrawl/anydoc does not read images. Its
// formats are Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV and PDF —
// hand it a .jpeg and it rejects with code 'unsupported', whatever the `ocr`
// option says. What `ocr: 'hosted'` actually does is rescue a PDF whose pages
// are image-only: anydoc converts locally, finds no text layer, and rejects
// with 'needsOcr' unless told to send that document to Firecrawl Parse.
//
// So the scans are wrapped into exactly that kind of PDF — one image-only page
// per photograph, the JPEG bytes embedded untouched through /DCTDecode — and
// the 'needsOcr' path becomes the route in rather than an error. No re-encoding
// happens, so the OCR sees the original pixels.
//
// ONE PDF FOR THE WHOLE PAPER, NOT ONE PER PAGE. A question's options routinely
// continue onto the next sheet. Converting page by page would cut those in half
// and leave a question with two options and an orphan pair with no stem.
//
// THIS SENDS THE PAPER TO A THIRD PARTY. `ocr: 'hosted'` uploads the PDF to
// Firecrawl Parse. That is the only way anydoc reads a scan, but it is an
// external service and the exam leaves this machine to reach it. --dry-run
// builds the PDF and stops, so the wrapping can be checked before anything is
// uploaded. Set FIRECRAWL_API_KEY for higher limits.
//
// TWO KINDS OF PAGE, ONE OCR STEP. --mode=questions (the default) reads an
// exam paper and writes scratchpad/pdf2json.py's shape field for field —
// number, preamble, linked_questions, question, prompt, options[{id,text}] — so
// the loaders and answer-key scripts do not learn a second shape.
// --mode=templates reads a book of writing skeletons and writes
// open_question_templates' shape instead — number, part, title, summary, body.
// A skeletons page has no stems and no options, so the question parser finds
// nothing in one and is right to; the mode is what says which to look for.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: resolve("../.env.local") });
dotenv.config({ path: resolve(".env.local") });
dotenv.config({ path: resolve(".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const dryRun = argv.includes("--dry-run");
const keepPdf = argv.includes("--keep-pdf") || dryRun;
const keepMd = argv.includes("--keep-md");
// A page-by-page proof sheet: each photograph beside what was read out of it.
// The only way to tell a right transcription from a confident wrong one.
const wantHtml = argv.includes("--html");
const force = argv.includes("--force");
const outDir = flagOf("out");
const examName = flagOf("exam");
// 1 image pixel = 1 PDF point. The page comes out physically large, which
// nothing downstream cares about, and in exchange no rasteriser ever sees less
// than the scan's own resolution. --dpi trades that for realistic page sizes.
const dpi = Number(flagOf("dpi") ?? 72);
// Turn every page by this much before the OCR sees it. A photograph of a book
// held sideways is the ordinary case, not the exception, and OCR on sideways
// text returns confident nonsense rather than an error — so this is the first
// thing to reach for when the Markdown comes back as gibberish. It costs
// nothing: /Rotate is a page attribute, so the JPEG is still never re-encoded.
const rotate = Number(flagOf("rotate") ?? 0);
// What the pages are. 'questions' reads an exam paper — numbered stems with
// four א–ד options. 'templates' reads a book of writing skeletons — a part, a
// title and a body with ]blanks[ — which has no stems and no options, so the
// question parser correctly finds nothing in one. The OCR step is identical;
// only the shape read out of the Markdown differs.
const mode = flagOf("mode") ?? "questions";
if (!["questions", "templates"].includes(mode)) {
  console.error(`--mode must be 'questions' or 'templates' (got '${mode}')`);
  process.exit(2);
}
// Who reads the pixels.
//
// 'firecrawl' is anydoc's hosted path and is right for a SCAN — a flat, square
// page with printed text. It is not right for a photograph: on ten phone photos
// of a book it returned 157,294 characters of which 1,434 were Hebrew, plus a
// run of 4,095 consecutive '7's. That is not a tuning problem, it is the wrong
// tool, and no amount of cropping makes a model read what it cannot read.
//
// 'claude' sends each photograph to the model this repo already calls for every
// other generation step. It reads Hebrew, it copes with a page held at an angle,
// and it can be told what the page IS, which a generic OCR model cannot be.
// It costs one call per page against Firecrawl's one per document.
const ocrEngine = flagOf("ocr") ?? "firecrawl";
if (!["firecrawl", "claude"].includes(ocrEngine)) {
  console.error(`--ocr must be 'firecrawl' or 'claude' (got '${ocrEngine}')`);
  process.exit(2);
}
const model = flagOf("model") ?? "claude-opus-5";
if (![0, 90, 180, 270].includes(((rotate % 360) + 360) % 360)) {
  console.error(`--rotate must be 0, 90, 180 or 270 (got ${rotate})`);
  process.exit(2);
}
const inputs = argv.filter((a) => !a.startsWith("--"));

// ---------------------------------------------------------------- collect

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".jpe", ".jfif"]);

/** Page order is the reading order, and "page10" must not sort before "page2". */
function naturalSort(a, b) {
  return basename(a).localeCompare(basename(b), undefined, { numeric: true, sensitivity: "base" });
}

function collectImages(paths) {
  const found = [];
  const rejected = [];
  for (const p of paths) {
    if (!existsSync(p)) throw new Error(`no such path: ${p}`);
    if (statSync(p).isDirectory()) {
      for (const name of readdirSync(p)) {
        const full = join(p, name);
        if (statSync(full).isFile()) {
          if (IMAGE_EXT.has(extname(name).toLowerCase())) found.push(full);
          else rejected.push(name);
        }
      }
    } else if (IMAGE_EXT.has(extname(p).toLowerCase())) {
      found.push(p);
    } else {
      rejected.push(p);
    }
  }
  return { images: found.sort(naturalSort), rejected };
}

// ------------------------------------------------------------ jpeg → pdf

/**
 * Width, height and component count, read from the JPEG's own SOF marker.
 *
 * Embedding needs the real pixel dimensions: a PDF image XObject states them,
 * and a wrong pair stretches the page without failing, which is the kind of
 * error nobody sees until the OCR comes back wrong.
 */
function jpegInfo(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("not a JPEG (no SOI marker) — was it renamed from PNG or HEIC?");
  }
  let i = 2;
  let adobe = false;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const m = buf[i + 1];
    if (m === 0xff) {
      i++; // fill byte
      continue;
    }
    // Standalone markers carry no length payload.
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) {
      i += 2;
      continue;
    }
    if (i + 4 > buf.length) break;
    const len = buf.readUInt16BE(i + 2);
    if (m === 0xee) adobe = true; // APP14, which is what marks CMYK as inverted
    const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSof) {
      if (i + 9 >= buf.length) break;
      return {
        marker: m,
        precision: buf[i + 4],
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
        components: buf[i + 9],
        progressive: m === 0xc2,
        adobe,
      };
    }
    i += 2 + len;
  }
  throw new Error("no SOF marker — the file is truncated or not a JPEG");
}

const COLOR_SPACE = { 1: "/DeviceGray", 3: "/DeviceRGB", 4: "/DeviceCMYK" };

/**
 * One image-only PDF page per scan, JPEG bytes passed through untouched.
 *
 * Written by hand rather than with a PDF library because the whole file is a
 * catalog, a page tree and one XObject per page — and because re-encoding the
 * pixels to satisfy a library would throw away the detail the OCR needs.
 */
function pdfFromJpegs(files) {
  const notes = [];
  const pages = files.map((path) => {
    const data = readFileSync(path);
    const info = jpegInfo(data);
    // PDF only guarantees baseline JPEG for /DCTDecode, and progressive is
    // therefore a gamble on the renderer rather than an error. Every rasteriser
    // tested here reads it — WhatsApp re-encodes everything progressive, so
    // refusing it would reject the most common source of scans outright. It is
    // reported instead, and --dry-run is there to settle it: open the PDF, and
    // if a page is blank the OCR would have read nothing either.
    if (info.progressive) notes.push(basename(path));
    if (!COLOR_SPACE[info.components]) {
      throw new Error(`${basename(path)} has ${info.components} colour components — not embeddable`);
    }
    return { path, data, info };
  });

  const chunks = [];
  let offset = 0;
  const push = (part) => {
    const buf = Buffer.isBuffer(part) ? part : Buffer.from(part, "latin1");
    chunks.push(buf);
    offset += buf.length;
  };

  const offsets = [];
  const obj = (n, body) => {
    offsets[n] = offset;
    push(`${n} 0 obj\n`);
    push(body);
    push("\nendobj\n");
  };

  // The binary comment on line 2 is what tells a transfer layer this is not text.
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const scale = 72 / (dpi > 0 ? dpi : 72);
  const pageObjNum = (i) => 3 + i * 3;
  const kids = pages.map((_, i) => `${pageObjNum(i)} 0 R`).join(" ");

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  pages.forEach((page, i) => {
    const n = pageObjNum(i);
    const w = +(page.info.width * scale).toFixed(2);
    const h = +(page.info.height * scale).toFixed(2);

    const turn = ((rotate % 360) + 360) % 360;
    obj(
      n,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `${turn ? `/Rotate ${turn} ` : ""}` +
        `/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`
    );

    // Draw the image over the whole page: scale by the page box, place at 0 0.
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;
    obj(n + 1, `<< /Length ${content.length} >>\nstream\n${content}endstream`);

    // An Adobe CMYK JPEG stores its channels inverted; without /Decode the page
    // comes out as a photographic negative and the OCR reads nothing.
    const decode = page.info.components === 4 && page.info.adobe ? " /Decode [1 0 1 0 1 0 1 0]" : "";
    offsets[n + 2] = offset;
    push(`${n + 2} 0 obj\n`);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.info.width} /Height ${page.info.height} ` +
        `/ColorSpace ${COLOR_SPACE[page.info.components]} /BitsPerComponent ${page.info.precision}` +
        `${decode} /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`
    );
    push(page.data);
    push("\nendstream\nendobj\n");
  });

  const size = 3 + pages.length * 3;
  const xrefAt = offset;
  push(`xref\n0 ${size}\n`);
  push("0000000000 65535 f \n");
  for (let n = 1; n < size; n++) {
    // Every entry is exactly 20 bytes; a reader seeks by multiplication.
    push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return { pdf: Buffer.concat(chunks), pages, notes };
}

// ------------------------------------------------------------- markdown

const OPT_LETTERS = ["א", "ב", "ג", "ד"];

// Ported from scratchpad/pdf2json.py, which learned these against the real
// papers. The bidi repair that script needs is absent here on purpose: OCR
// returns Hebrew in logical order already, and re-flipping it would break it.
const Q_RE = /^(\d{1,2})(?:\.(?=\S)|[.)]?\s+)/;
const OPT_RE = /^([א-ה])(?:\s*[.)]\s*|\s{2,}|\s*$)/;
const INTRO_RE = /^(?:ענו|ענה|קראו|קרא|השיבו|השב).*שאלות/;
const END_RE = /^[-–—\s]*ב\s*ה\s*צ\s*ל\s*ח\s*ה[!.\s\-–—]*$/;
const GROUP_N_RE = /(\d+)\s+ה?שאלות/;
const GROUP_RANGE_RE = /שאלות\s*(\d+)\s*[-–—]\s*(\d+)/;

const JUNK = [
  /^\d+\s*\/\s*\d+$/, // 5/19 page footer
  /^לשכת עורכי.{0,12}בישראל.*תאריך/, // the running header, and only it
  /^חלק ג.{0,4}דין מהותי/,
  /^\d+$/, // a bare page number
  /^!\[/, // an image the OCR could not read
];

/** Markdown down to the plain lines the parser walks. */
function toLines(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links, keeping the text
        .replace(/^\s*>+\s?/, "") // block quotes
        .replace(/^\s*#{1,6}\s*/, "") // headings
        .replace(/^\s*[-*+]\s+/, "") // bullets
        .replace(/\*\*|__|`/g, "") // emphasis
        .replace(/^\s*\|\s*|\s*\|\s*$/g, "") // table edges
        .replace(/\s*\|\s*/g, " ") // table cells
        .replace(/ /g, " ")
        .trim()
    )
    .filter((line) => line.length > 0 && !JUNK.some((re) => re.test(line)));
}

/**
 * Markdown down to lines that REMEMBER their heading level.
 *
 * The question parser can throw headings away because numbering carries the
 * structure there. A book of skeletons has no numbering to lean on — what
 * separates one template from the next is that its title was set as a heading —
 * so that one bit has to survive the cleaning. The cleaning itself is toLines',
 * applied a line at a time, so the two can never drift apart.
 */
function toBlocks(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => ({
      level: /^\s*(#{1,6})\s/.exec(line)?.[1].length ?? 0,
      text: toLines(line)[0] ?? "",
    }))
    .filter(({ text }) => text.length > 0);
}

/** How many questions an intro line says its passage covers. */
function groupSize(intro) {
  const range = GROUP_RANGE_RE.exec(intro);
  if (range) return Number(range[2]) - Number(range[1]) + 1;
  const n = GROUP_N_RE.exec(intro);
  return n ? Number(n[1]) : 0;
}

/**
 * Lines to questions.
 *
 * Numbering drives it: a line only opens question N if it is marked N and N is
 * the one expected next. A stray "3." inside a fact pattern — a date, a section
 * number — is therefore ignored, which is the failure this shape exists to
 * avoid.
 */
function parse(lines) {
  const questions = [];
  const warnings = [];
  let expected = 1;
  let pending = null; // an intro line waiting for the questions it covers
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (END_RE.test(line)) break;

    if (INTRO_RE.test(line)) {
      const size = groupSize(line);
      pending = { text: line, size, members: [] };
      i++;
      continue;
    }

    const m = Q_RE.exec(line);
    if (!m || Number(m[1]) !== expected) {
      i++;
      continue;
    }

    const number = Number(m[1]);
    const body = [line.slice(m[0].length).trim()].filter(Boolean);
    i++;

    // The stem runs until the first option letter. An intro line ends it too:
    // it introduces the NEXT group, and absorbing it would both lengthen this
    // question and lose the preamble the group needs.
    while (i < lines.length && !OPT_RE.test(lines[i]) && !END_RE.test(lines[i]) && !INTRO_RE.test(lines[i])) {
      const next = Q_RE.exec(lines[i]);
      if (next && Number(next[1]) === expected + 1) break; // a question with no options
      body.push(lines[i]);
      i++;
    }

    const options = [];
    while (i < lines.length && options.length < 4) {
      const om = OPT_RE.exec(lines[i]);
      if (!om) break;
      const wanted = OPT_LETTERS[options.length];
      if (om[1] !== wanted) break;
      const text = [lines[i].slice(om[0].length).trim()].filter(Boolean);
      i++;
      // An option wraps onto the following lines until the next letter, the
      // next question, an intro line, or the end.
      while (i < lines.length && !OPT_RE.test(lines[i]) && !END_RE.test(lines[i]) && !INTRO_RE.test(lines[i])) {
        const next = Q_RE.exec(lines[i]);
        if (next && Number(next[1]) === expected + 1) break;
        text.push(lines[i]);
        i++;
      }
      options.push({ id: wanted, text: text.join(" ").trim() });
    }

    const question = body.join(" ").replace(/\s+/g, " ").trim();
    // The asked sentence, which the paper puts last: "...מה הדין?".
    const asked = question.match(/[^.?!]*\?\s*$/);

    questions.push({
      number,
      preamble: pending ? pending.text : "",
      linked_questions: [],
      question,
      prompt: asked ? asked[0].trim() : "",
      options,
    });

    if (options.length !== 4) {
      warnings.push(`q${number}: found ${options.length} option(s), not 4`);
    }
    if (!question) warnings.push(`q${number}: empty stem`);

    if (pending) {
      pending.members.push(number);
      if (pending.size > 0 && pending.members.length >= pending.size) {
        for (const q of questions) {
          if (pending.members.includes(q.number)) q.linked_questions = [...pending.members];
        }
        pending = null;
      }
    }

    expected = number + 1;
  }

  // A group whose stated size never arrived still links what it got.
  if (pending && pending.members.length > 1) {
    for (const q of questions) {
      if (pending.members.includes(q.number)) q.linked_questions = [...pending.members];
    }
  }

  return { questions, warnings };
}

// ----------------------------------------------------------- claude OCR

/**
 * What the model is asked to do with a page.
 *
 * TRANSCRIBE, DO NOT READ. The failure that matters here is not a misread
 * letter — it is a model that decides what a legal form probably says and
 * writes that instead. A skeleton is mostly blanks and headings, which is
 * exactly the shape that invites it. So: copy what is there, mark what is not
 * legible, and never fill a blank in.
 *
 * The headings matter as much as the words, because --mode=templates finds a
 * template by its heading. A transcription that flattens every line to a
 * paragraph is correct Hebrew and useless structure.
 */
function ocrPrompt(pageNumber, pageCount) {
  return [
    `This is page ${pageNumber} of ${pageCount} photographed from a printed Hebrew legal-studies book.`,
    rotate ? `The photograph is rotated; the page reads correctly when turned ${rotate}°.` : "",
    "",
    "Transcribe it to Markdown. Rules:",
    "- Copy the Hebrew exactly as printed. Do not translate, correct, complete or summarise it.",
    "- A heading on the page becomes a Markdown heading (#, ##). This matters: headings are what separate one document template from the next.",
    "- Keep fill-in blanks as they are printed, including ]brackets[ and runs of underscores. NEVER invent content for a blank.",
    "- Keep line breaks where the page has them. Keep numbering as printed.",
    "- If the photograph shows two facing pages, transcribe the right-hand page first, then the left, separated by a horizontal rule.",
    "- If a region is cut off, blurred or genuinely unreadable, write [לא קריא] there. Do not guess.",
    "- If the page has no readable text at all, output exactly: [עמוד ריק]",
    "",
    "Output only the transcription. No preamble, no commentary, no code fences.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * One call per photograph, concatenated in reading order.
 *
 * Per page rather than all ten at once because a page is the unit that can
 * fail: one unreadable photograph should cost one page, not the document. The
 * pages are joined with a rule so the parsers see the same page boundaries
 * they would from a PDF.
 */
async function ocrWithClaude(images) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (it lives in .env.local)");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, maxRetries: 3, timeout: 10 * 60 * 1000 });

  const pages = [];
  let failed = 0;

  for (const [i, path] of images.entries()) {
    const label = `  [${i + 1}/${images.length}] ${basename(path).slice(-28)}`;
    const started = Date.now();
    try {
      const message = await client.messages.create({
        model,
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: readFileSync(path).toString("base64") },
              },
              { type: "text", text: ocrPrompt(i + 1, images.length) },
            ],
          },
        ],
      });
      const text = message.content.find((b) => b.type === "text")?.text?.trim() ?? "";
      pages.push(text);
      const secs = Math.round((Date.now() - started) / 100) / 10;
      console.log(`${label}  ${text.length} chars in ${secs}s${message.stop_reason === "max_tokens" ? "  (hit max_tokens)" : ""}`);
    } catch (error) {
      failed++;
      pages.push(`[לא קריא — page ${i + 1} failed: ${error.message}]`);
      console.log(`${label}  FAILED — ${error.message}`);
    }
  }

  if (failed === images.length) throw new Error("every page failed — nothing was transcribed");
  if (failed) console.log(`  ${failed} of ${images.length} page(s) failed and were left as [לא קריא]`);

  return pages;
}

// ------------------------------------------------------- the proof sheet

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What share of a transcription is actually Hebrew — the one number that says whether a page was read. */
function hebrewShare(text) {
  if (!text.length) return 0;
  return (100 * (text.match(/[֐-׿]/g) ?? []).length) / text.length;
}

/**
 * Each photograph beside what came back from it, in one self-contained page.
 *
 * WHY THIS EXISTS. A transcription cannot be checked against nothing. Reading
 * the .md tells you whether the Hebrew is plausible; it cannot tell you whether
 * it is what the page SAYS, and a confident wrong transcription reads exactly
 * like a right one. Putting the photograph next to it makes that a two-second
 * comparison instead of a file-switching exercise.
 *
 * The images are inlined as data URIs so the file can be moved or sent without
 * taking its folder with it, and [לא קריא] is coloured so the regions the model
 * refused are visible without reading a word.
 */
function proofSheet(images, pages, title) {
  const rows = images
    .map((path, i) => {
      const text = pages[i] ?? "";
      const share = hebrewShare(text);
      const unreadable = (text.match(/\[לא קריא\]/g) ?? []).length;
      const body = esc(text).replace(
        /\[לא קריא\]/g,
        '<mark class="bad">[לא קריא]</mark>'
      );
      // A CSS transform does not reserve layout space, so a rotated photo would
      // overlap whatever follows it. The frame is given the SWAPPED aspect
      // ratio and the image is sized against it, which is why the real pixel
      // dimensions are read here rather than guessed.
      const { width: w, height: h } = jpegInfo(readFileSync(path));
      const turned = ((rotate % 360) + 360) % 360;
      const upright = turned === 90 || turned === 270;
      const frame = upright
        ? ` style="aspect-ratio:${h}/${w}"`
        : ` style="aspect-ratio:${w}/${h}"`;
      // Rotating about the top-left corner leaves the image outside the frame;
      // the translate puts it back. Which axis depends on the direction.
      const spin = upright
        ? ` style="width:calc(100% * ${w} / ${h});transform:rotate(${turned}deg) ` +
          `translate${turned === 90 ? "Y(-100%)" : "X(-100%)"}"`
        : "";
      return `<section>
  <header><b>עמוד ${i + 1}</b> · ${esc(basename(path))} · ${text.length} תווים ·
    <span class="${share < 15 ? "bad" : "ok"}">${share.toFixed(1)}% עברית</span>
    ${unreadable ? ` · <span class="bad">${unreadable} אזורים לא קריאים</span>` : ""}</header>
  <div class="pair">
    <figure><div class="frame"${frame}><img${spin} src="data:image/jpeg;base64,${readFileSync(path).toString("base64")}" alt="עמוד ${i + 1}"></div></figure>
    <pre>${body}</pre>
  </div>
</section>`;
    })
    .join("\n");

  const all = pages.join("");
  return `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<title>${esc(title)} — בדיקת תמלול</title>
<style>
  :root { color-scheme: light dark; --bad: #c0392b; --ok: #1e8449; --line: #d8d8d8; }
  body { font-family: "Segoe UI", Arial, sans-serif; margin: 0 auto; padding: 24px; max-width: 1400px; line-height: 1.6; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .lede { color: #666; margin: 0 0 24px; font-size: 14px; }
  section { border: 1px solid var(--line); border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
  header { background: #00000008; padding: 8px 12px; font-size: 13px; border-bottom: 1px solid var(--line); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  figure { margin: 0; padding: 12px; border-inline-start: 1px solid var(--line); }
  .frame { position: relative; width: 100%; overflow: hidden; }
  .frame img { position: absolute; top: 0; left: 0; width: 100%; transform-origin: 0 0; display: block; }
  pre { margin: 0; padding: 12px; white-space: pre-wrap; font-family: inherit; font-size: 14px; overflow-wrap: anywhere; }
  .bad { color: var(--bad); font-weight: 600; background: none; }
  .ok { color: var(--ok); font-weight: 600; }
  @media (max-width: 900px) { .pair { grid-template-columns: 1fr; } figure { border-inline-start: 0; } img { max-width: 100%; } }
</style>
<h1>${esc(title)} — בדיקת איכות התמלול</h1>
<p class="lede">${images.length} עמודים · ${all.length} תווים · ${hebrewShare(all).toFixed(1)}% עברית.
  כל עמוד מוצג לצד מה שהוחזר ממנו. אזורים שסומנו <span class="bad">[לא קריא]</span> הם מקומות שהמודל סירב לנחש בהם.</p>
${rows}
</html>
`;
}

// --------------------------------------------------- markdown → templates

// "חלק א' – הליכים אזרחיים" — the ten parts the printed book is divided into,
// and what open_question_templates.legal_area is derived from.
//
// The tail is restricted to a bare name because the SKELETONS THEMSELVES are
// divided into חלק א' / חלק ב' — "חלק א' — כותרת )תקנה 10(" is the first line
// of the כתב תביעה body. Matching that as a part heading silently retitles
// every following template and truncates the body it was cut from. A book part
// names a field of law and nothing else: no digits, no brackets, no reference.
const PART_RE = /^חלק\s+[א-י]["'׳]?\s*[–—-]\s*[^()[\]0-9]{2,40}$/;
// "3. בקשה לסעד זמני" — a numbered entry in the book's own ordering.
const NUMBERED_TITLE_RE = /^(\d{1,2})[.)]\s+(.{2,60})$/;
// ]blanks[ and rules of ____ are what a skeleton BODY is made of, so a line
// carrying them is never a title.
const BLANK_RE = /[[\]]|_{3,}/;

/** Short, unpunctuated and blank-free — the shape of "כתב הגנה". */
function looksLikeTitle(text) {
  return text.length >= 2 && text.length <= 60 && !/[.:,]$/.test(text) && !BLANK_RE.test(text);
}

/**
 * Lines to templates, in the shape open_question_templates holds.
 *
 * A template is a title, the part it is printed under, and everything printed
 * beneath it until the next title. Titles are recognised two ways because a
 * book gives them two ways and OCR keeps whichever it can see: as a Markdown
 * heading, or as a numbered entry. Requiring both would miss half of them.
 *
 * template_subjects, is_generic and legal_area are NOT set here. They are facts
 * about how a template is matched to a question, not about what the page says,
 * and the migration already derives legal_area from the part.
 */
function parseTemplates(blocks) {
  const templates = [];
  const warnings = [];
  let part = "";
  let current = null;
  let seq = 0;

  const flush = () => {
    if (!current) return;
    const lines = current.body;
    // The book prints a sentence of description under the title before the
    // skeleton proper starts. It is prose — no blanks, ends in a full stop —
    // which is exactly what distinguishes it from the first line of a form.
    let summary = "";
    if (lines.length > 1 && !BLANK_RE.test(lines[0]) && lines[0].length <= 240 && /[.:]$/.test(lines[0])) {
      summary = lines.shift();
    }
    const body = lines.join("\n").trim();
    if (!body) warnings.push(`"${current.title}": no body followed the title`);
    if (!part) warnings.push(`"${current.title}": no part heading came before it`);
    templates.push({ number: current.number, part, title: current.title, summary, body });
    current = null;
  };

  for (const { level, text } of blocks) {
    if (PART_RE.test(text)) {
      flush();
      part = text;
      continue;
    }

    const numbered = NUMBERED_TITLE_RE.exec(text);
    if (numbered && looksLikeTitle(numbered[2])) {
      flush();
      seq = Number(numbered[1]);
      current = { number: seq, title: numbered[2].trim(), body: [] };
      continue;
    }

    if (level > 0 && looksLikeTitle(text)) {
      flush();
      current = { number: ++seq, title: text, body: [] };
      continue;
    }

    // Anything before the first title is the book's front matter, and belongs
    // to no template — dropping it is the point.
    if (current) current.body.push(text);
  }
  flush();

  return { templates, warnings };
}

// ------------------------------------------------------------------ main

// Exported so the two halves can be exercised without a network call: the
// wrapper against a known JPEG, the parser against known Markdown. `main` runs
// only when this file is the entry point, so importing it converts nothing.
export { jpegInfo, pdfFromJpegs, toLines, parse, toBlocks, parseTemplates, proofSheet };

async function main() {
  if (inputs.length === 0 || argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/jpeg2json.mjs <folder|file...> --out=<dir>\n" +
        "       [--exam=<name>] [--mode=questions|templates] [--ocr=firecrawl|claude]\n" +
        "       [--rotate=0|90|180|270] [--html] [--dry-run] [--keep-pdf]\n" +
        "       [--keep-md] [--force]"
    );
    process.exit(inputs.length === 0 ? 2 : 0);
  }

  const { images, rejected } = collectImages(inputs);

  if (images.length === 0) {
    console.error(`no JPEG found in ${inputs.join(", ")}`);
    if (rejected.length) console.error(`  ignored: ${rejected.slice(0, 8).join(", ")}`);
    process.exit(1);
  }

  const exam = examName ?? basename(resolve(inputs[0])).replace(/\.(jpe?g|jfif|jpe)$/i, "");
  console.log(`${images.length} page(s) — ${basename(images[0])} … ${basename(images[images.length - 1])}`);
  if (rejected.length) console.log(`  ignored ${rejected.length} non-JPEG file(s)`);

  const { pdf, pages, notes } = pdfFromJpegs(images);
  const px = pages.map((p) => `${p.info.width}x${p.info.height}`);
  console.log(`wrapped into a ${(pdf.length / 1e6).toFixed(1)} MB image-only PDF (${px[0]}${px.length > 1 ? ", …" : ""})`);
  if (rotate) console.log(`  every page turned ${((rotate % 360) + 360) % 360}° before the OCR reads it`);
  if (notes.length) {
    console.log(
      `  note: ${notes.length} of ${pages.length} page(s) are progressive JPEGs. They embed and ` +
        `render here,
        but the PDF spec only guarantees baseline — check the pages with --dry-run.`
    );
  }

  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const stem = join(outDir ?? ".", exam);

  if (keepPdf) {
    writeFileSync(`${stem}.pdf`, pdf);
    console.log(`  wrote ${stem}.pdf`);
  }

  if (dryRun) {
    console.log("\ndry run: the PDF was built and nothing was uploaded.");
    console.log("Open it and check the pages are upright and readable, then run without --dry-run.");
    process.exit(0);
  }

  const jsonPath = `${stem}.json`;
  if (existsSync(jsonPath) && !force) {
    console.error(`\n${jsonPath} already exists — pass --force to overwrite it.`);
    process.exit(1);
  }

  let markdown;
  // Per page where the engine works page by page; null when it does not.
  let pageTexts = null;

  if (ocrEngine === "claude") {
    // The images go straight to the model; the PDF above was built only so
    // --dry-run and --keep-pdf still let you check the pages first.
    console.log(`\nreading ${images.length} page(s) with ${model} …`);
    try {
      pageTexts = await ocrWithClaude(images);
      markdown = pageTexts.join("\n\n---\n\n");
    } catch (error) {
      console.error(`\nFAILED — ${error.message}`);
      process.exit(1);
    }
  } else {
    let toMarkdownBytes;
    try {
      ({ toMarkdownBytes } = await import("@firecrawl/anydoc"));
    } catch {
      console.error("\n@firecrawl/anydoc is not installed. Run:\n  npm install @firecrawl/anydoc");
      process.exit(1);
    }

    console.log("\nsending the PDF to Firecrawl Parse for OCR (ocr: 'hosted') …");
    try {
      markdown = await toMarkdownBytes(pdf, "pdf", {
        ocr: "hosted",
        ...(process.env.FIRECRAWL_API_KEY ? { apiKey: process.env.FIRECRAWL_API_KEY } : {}),
      });
    } catch (error) {
      // These are anydoc's own codes; each says something different about the fix.
      const hint = {
        unsupported: "the wrapped file was not recognised as a PDF — this is a bug in the wrapper",
        hosted: "Firecrawl Parse could not be reached. Check the network, or set FIRECRAWL_API_KEY",
        needsOcr: "OCR was refused — 'hosted' did not take effect",
        malformed: "no readable content came back; check the PDF with --dry-run --keep-pdf",
        encrypted: "the PDF is encrypted, which the wrapper never produces",
        resourceLimit: "the document crossed a safety limit — convert fewer pages at a time",
      }[error.code];
      console.error(`\nFAILED (${error.code ?? "unknown"}) — ${error.message}`);
      if (hint) console.error(`  ${hint}`);
      process.exit(1);
    }
  }

  // The measurement that told us Firecrawl had failed, run automatically. A
  // Hebrew page that comes back under a few per cent Hebrew was not read, and
  // saying so here costs nothing and saves reading the JSON to find out.
  const hebrew = (markdown.match(/[֐-׿]/g) ?? []).length;
  const share = markdown.length ? (100 * hebrew) / markdown.length : 0;
  if (share < 5) {
    console.log(
      `\n  warning: only ${share.toFixed(1)}% of the ${markdown.length} characters returned are Hebrew ` +
        `(${hebrew} of them).\n  The pages were probably not read. Check the .md — and if this was ` +
        `--ocr=firecrawl, try --ocr=claude.`
    );
  }

  if (keepMd) {
    writeFileSync(`${stem}.md`, markdown, "utf8");
    console.log(`  wrote ${stem}.md`);
  }

  if (wantHtml) {
    // Firecrawl returns one block for the whole document, so it gets one row
    // holding everything rather than a false per-page split.
    const perPage = pageTexts ?? [markdown, ...images.slice(1).map(() => "")];
    writeFileSync(`${stem}.html`, proofSheet(images, perPage, exam), "utf8");
    console.log(`  wrote ${stem}.html — open it to check the transcription against the photos`);
  }

  const templatesMode = mode === "templates";
  const { questions, templates, warnings } = templatesMode
    ? { questions: [], ...parseTemplates(toBlocks(markdown)) }
    : { templates: [], ...parse(toLines(markdown)) };

  const envelope = {
    source_file: images.length === 1 ? basename(images[0]) : `${images.length} JPEG pages`,
    exam,
    language: "he",
  };
  const out = templatesMode
    ? { ...envelope, template_count: templates.length, templates, ...(warnings.length ? { warnings } : {}) }
    : { ...envelope, question_count: questions.length, questions, ...(warnings.length ? { warnings } : {}) };

  writeFileSync(jsonPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  const found = templatesMode ? `${templates.length} template(s)` : `${questions.length} question(s)`;
  console.log(`\nwrote ${jsonPath} — ${found}`);

  if (templatesMode) {
    const parts = [...new Set(templates.map((t) => t.part).filter(Boolean))];
    if (parts.length) console.log(`  across ${parts.length} part(s): ${parts.join(" · ")}`);
    if (warnings.length) {
      console.log(`\n${warnings.length} template(s) came out incomplete:`);
      for (const w of warnings) console.log(`  - ${w}`);
    }
  } else {
    const short = questions.filter((q) => q.options.length !== 4);
    if (short.length) {
      console.log(`\n${short.length} question(s) did not come out with 4 options:`);
      for (const w of warnings) console.log(`  - ${w}`);
    }
  }

  if (templates.length === 0 && questions.length === 0) {
    console.log("\nNothing was recognised. Before blaming the parser, open the .md: if it is");
    console.log("gibberish the pages are probably sideways — try --rotate=90/180/270. If it");
    console.log(`reads correctly, the pages may not be ${templatesMode ? "skeletons" : "an exam paper"} at all.`);
  } else if (!templatesMode && warnings.length) {
    console.log("\nOCR on a scan is not the same as reading a text PDF. Check those against");
    console.log("the image before loading, and rerun with --keep-md to see what came back.");
  }
}

// Entry-point guard: `node jpeg2json.mjs …` runs it, `import(…)` does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
