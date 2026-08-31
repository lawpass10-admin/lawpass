// extract-exam-pdf.mjs — turn a Bar Association דין דיוני paper (question PDF
// + answer-key PDF) into the exemplar JSON the diuni generator learns style from.
//
//   node scripts/diuni/extract-exam-pdf.mjs <exam.pdf> <answers.pdf> [-o out.json]
//
// WHY THIS EXISTS. The generator is asked to write a question a candidate could
// not tell from a real one. The only way to hold it to that is to show it real
// ones — written by the lawyers who set the paper — rather than describing the
// style in prose. This turns the two PDFs into those exemplars.
//
// THE PDF DEFECT THIS HANDLES. Both papers map the letter נ to a glyph the text
// layer does not carry as נ: the question paper uses U+F8FF (private use), the
// answer key uses U+00F0 (ð). Extract naively and every נ silently vanishes —
// "הבחינה" comes out "הבחי" — which poisons everything downstream without
// looking wrong. Same class of defect scripts/ingestion/hebrew_pdf_to_json.py
// documents for the Bar's other papers, different codepoint. Both are repaired
// here, and the repair is VERIFIED: a paper that still has no נ after it is
// rejected rather than exported.
//
// Extraction itself is delegated to Python + PyMuPDF, which this machine has and
// Node does not. The subprocess prints one JSON document; nothing else.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const outFlag = argv.findIndex((a) => a === "-o");
const outPath =
  outFlag !== -1 ? resolve(argv[outFlag + 1]) : join(here, "exemplars.json");
const files = argv.filter((a, i) => !a.startsWith("-") && i !== outFlag + 1);

if (files.length !== 2) {
  console.error(
    "usage: node extract-exam-pdf.mjs <exam.pdf> <answers.pdf> [-o out.json]"
  );
  process.exit(1);
}
const [examPdf, answersPdf] = files.map((f) => resolve(f));

/**
 * Page text via PyMuPDF, in LOGICAL order, with the נ glyph repaired.
 *
 * THE BIDI PROBLEM, AND WHY THIS IS DONE BY GEOMETRY. The text layer stores
 * each line's runs in VISUAL order (rightmost first for Hebrew), and PyMuPDF
 * hands them back in that order merged into one span. Read naively, a line
 * comes out with its fragments back to front — the sentence-final full stop
 * arrives first — which is readable enough to look fine and wrong enough to
 * poison every exemplar built from it. The repaired-נ runs make it worse: each
 * one starts a new run, so a sentence is shuffled at every נ.
 *
 * There is no bidi algorithm available here (poppler, which the sibling
 * ingestion script leans on, is not installed on this machine). But the PDF
 * positions every glyph, and for a right-to-left line the logical order IS the
 * order of decreasing x. So the line is rebuilt from `rawdict` character
 * boxes, sorted right to left. That reconstructs Hebrew exactly.
 *
 * Digits and Latin are the exception: inside an RTL line they are laid out
 * left-to-right, so the same sort reverses them — "2026" becomes "6202" and a
 * case number turns into a different case number. Each maximal run of
 * LTR-natured characters is therefore flipped back after the sort. That pair of
 * operations is the whole bidi rule this text needs.
 *
 * Spaces are reconstructed from gaps rather than trusted: the stored stream
 * often omits them at run boundaries, which is what glues "נגד" to the word
 * before it.
 */
function pdfText(path) {
  const py = String.raw`
import fitz, json, sys, re

NUN_GLYPHS = {'': 'נ', 'ð': 'נ'}
LTR = re.compile(r'[0-9A-Za-z]')

def flip_ltr_runs(s):
    # After the RTL sort, digit/Latin runs sit backwards. Flip each one back.
    # Interior punctuation (./-/:/,) is carried along so 23.6.2026 and 78546-08-25
    # survive as written rather than splitting into flipped pieces.
    out, i, n = [], 0, len(s)
    while i < n:
        if LTR.match(s[i]):
            j = i
            while j < n and (LTR.match(s[j]) or (s[j] in './-:,' and j + 1 < n and LTR.match(s[j+1]))):
                j += 1
            out.append(s[i:j][::-1])
            i = j
        else:
            out.append(s[i]); i += 1
    return ''.join(out)

def line_text(line):
    chars = [c for sp in line['spans'] for c in sp['chars']]
    if not chars:
        return ''
    # Right-to-left: logical order is decreasing x.
    chars.sort(key=lambda c: -c['bbox'][0])
    out, prev, prev_substituted = [], None, False
    for c in chars:
        ch = NUN_GLYPHS.get(c['c'], c['c'])
        substituted = c['c'] in NUN_GLYPHS
        if prev is not None and not substituted and not prev_substituted:
            # A gap wider than a quarter of the glyph box is a space the stream
            # did not record. prev's LEFT edge minus this glyph's RIGHT edge,
            # because we are walking right to left.
            gap = prev['bbox'][0] - c['bbox'][2]
            if gap > (c['bbox'][2] - c['bbox'][0]) * 0.25 and ch != ' ' and out and out[-1] != ' ':
                out.append(' ')
        out.append(ch)
        prev, prev_substituted = c, substituted
    return flip_ltr_runs(''.join(out))

d = fitz.open(sys.argv[1])
pages = []
for page in d:
    lines = []
    for blk in page.get_text('rawdict')['blocks']:
        for ln in blk.get('lines', []):
            t = line_text(ln).rstrip()
            if t.strip():
                lines.append(t)
    pages.append('\n'.join(lines))
sys.stdout.buffer.write(json.dumps(pages, ensure_ascii=False).encode('utf-8'))
`;
  const out = execFileSync("python", ["-c", py, path], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.toString("utf8"));
}

// --------------------------------------------------------------- questions
//
// The paper's layout, once the bidi run is flattened by the extractor:
//
//   .1                      <- the number, digits-then-dot reversed
//   <fact pattern, several lines>
//   ?מה הדין                <- the stem, always ends in a question mark
//   א.
//   <option text>
//   ב.
//   ...
//
// Splitting on the number markers is what makes this tractable: everything
// between marker N and marker N+1 is question N, and the four option markers
// inside it are unambiguous because they are the only single Hebrew letters
// that ever sit alone on a line followed by a dot.

const LETTERS = ["א", "ב", "ג", "ד"];

function parseQuestions(allPages) {
  // Joining before splitting is deliberate: a question can straddle a page
  // break, and per-page parsing would truncate it. The cover and instruction
  // pages are NOT sliced off first — they are rejected by the option test in
  // the scan below, which is a stronger filter than any page heuristic. Both
  // carry numbered lists AND א./ב./ג./ד. sub-items, so "the page that looks
  // like questions" cannot be told apart by shape alone.
  const body = allPages
    .join("\n")
    .split("\n")
    .filter((line) => !/^\s*חלק ב-\s*\d/.test(line)) // running header
    .filter((line) => !/^\s*\d+\/\d+\s*$/.test(line)) // page footer "4/15"
    .join("\n");

  const questions = [];
  // `.N` at line start — the reversed "N." of the source. The marker is
  // sometimes alone on its line and sometimes GLUED to the first words of the
  // question ("2. משה פונה מדירתו…"), so this must not anchor to end-of-line.
  // `(?!\d)` stops a year like "1962." matching as marker 19.
  const allMarkers = [...body.matchAll(/^(\d{1,2})\.(?!\d)/gm)];

  // Walk the numbers 1, 2, 3… accepting a marker only when the text after it
  // actually looks like a question: four option markers, lettered א ב ג ד in
  // order. That test is what separates a real question from an instruction
  // item — the front matter is numbered too, and its sub-items are lettered
  // too, but no instruction item carries all four in sequence.
  //
  // A candidate that fails the test does not consume its number, so the scan
  // walks past thirteen numbered instructions and still opens the paper at 1.
  const findOptions = (chunk) => {
    const starts = [];
    for (const om of chunk.matchAll(/^([אבגד])\s*\.(?!\d)/gm)) {
      starts.push({ letter: om[1], at: om.index, len: om[0].length });
    }
    if (starts.length !== 4) return null;
    if (starts.map((o) => o.letter).join("") !== LETTERS.join("")) return null;
    return starts;
  };

  let expected = 1;
  for (const [idx, m] of allMarkers.entries()) {
    if (Number(m[1]) !== expected) continue;

    const number = expected;
    const start = m.index + m[0].length;
    // Run to the next marker bearing the number we would accept NEXT. Using the
    // next marker of any number would cut a question in half at the first
    // stray "3." inside its own facts.
    const nextIdx = allMarkers.findIndex(
      (x, k) => k > idx && Number(x[1]) === expected + 1
    );
    const end = nextIdx === -1 ? body.length : allMarkers[nextIdx].index;
    const chunk = body.slice(start, end).trim();

    const optionStarts = findOptions(chunk);
    if (!optionStarts) continue;
    expected++;

    const head = chunk.slice(0, optionStarts[0].at).trim();
    const options = optionStarts.map((o, k) => ({
      letter: o.letter,
      text: chunk
        .slice(o.at + o.len, k + 1 < optionStarts.length ? optionStarts[k + 1].at : chunk.length)
        .trim()
        .replace(/\s*\n\s*/g, " "),
    }));

    // The stem is the last question-mark line of the head; everything before it
    // is the facts. A head with no question mark is all facts and no stem —
    // reported rather than guessed at.
    const lines = head.split("\n").map((l) => l.trim()).filter(Boolean);
    let stemAt = -1;
    for (let k = lines.length - 1; k >= 0; k--) {
      if (lines[k].includes("?")) { stemAt = k; break; }
    }

    questions.push({
      number,
      fact_pattern: (stemAt === -1 ? lines : lines.slice(0, stemAt)).join(" "),
      stem: stemAt === -1 ? "" : lines.slice(stemAt).join(" "),
      options,
    });
  }
  return questions;
}

// --------------------------------------------------------------- answer key
//
// The key is a table flattened to a line stream: a number, then the letter in
// quotes ('ב), then the citation running over several lines until the next
// number. Only the number and the letter are parsed strictly; the citation is
// everything between, cleaned up — it is reference material for a human, and
// over-parsing it would drop the parts that do not fit a pattern.

function parseAnswerKey(pages) {
  const lines = pages.join("\n").split("\n").map((l) => l.trim());
  const key = new Map();

  let current = null;
  let buffer = [];
  const flush = () => {
    if (current !== null) {
      key.set(current.number, {
        letter: current.letter,
        source: buffer.join(" ").replace(/\s+/g, " ").trim(),
      });
    }
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const numOnly = lines[i].match(/^(\d{1,2})\s*\.?\s*$/);
    const nextLetter = lines.slice(i + 1, i + 4).find((l) => /^[אבגד]'/.test(l));
    if (numOnly && nextLetter) {
      flush();
      current = { number: Number(numOnly[1]), letter: nextLetter[0] };
      continue;
    }
    if (current && !/^[אבגד]'/.test(lines[i])) buffer.push(lines[i]);
  }
  flush();
  return key;
}

// --------------------------------------------------------------- run

const examPages = pdfText(examPdf);
const answerPages = pdfText(answersPdf);

// The repair check. A Hebrew legal paper without a single נ did not extract —
// it lost a letter, and every downstream use would inherit that silently.
for (const [label, pages] of [["exam", examPages], ["answers", answerPages]]) {
  const joined = pages.join("");
  if (!joined.includes("נ")) {
    console.error(`${label}: no נ after glyph repair — the PDF maps it to something new. Aborting.`);
    process.exit(1);
  }
}

const questions = parseQuestions(examPages);
const key = parseAnswerKey(answerPages);

const merged = questions.map((q) => {
  const k = key.get(q.number);
  return {
    ...q,
    correct_answer: k?.letter ?? null,
    source_citation: k?.source ?? null,
  };
});

const withAnswer = merged.filter((q) => q.correct_answer);
const complete = withAnswer.filter(
  (q) => q.fact_pattern && q.stem && q.options.every((o) => o.text)
);

writeFileSync(
  outPath,
  JSON.stringify(
    {
      _readme: [
        "Real Bar Association דין דיוני questions, extracted from the lawyer-authored",
        "PDFs. Style exemplars for the diuni generator — never served to candidates.",
        "Regenerate with scripts/diuni/extract-exam-pdf.mjs.",
      ],
      exam: { paper: "diuni_23_06_26", date: "2026-06-23", part: "חלק ב' — דין דיוני" },
      questions: complete,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(`question markers found : ${questions.length}`);
console.log(`answer-key entries     : ${key.size}`);
console.log(`merged with an answer  : ${withAnswer.length}`);
console.log(`complete (usable)      : ${complete.length}`);
console.log(`written                : ${outPath}`);
