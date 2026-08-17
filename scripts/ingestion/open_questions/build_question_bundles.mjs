// build_question_bundles.mjs — one question.json per question, beside its answer.
//
// Each exam sitting has ONE question-paper PDF containing TWO questions. The
// PDF sits in that sitting's q1 folder; this script extracts it and writes
// question 1 into the q1 folder and question 2 into the q2 folder, so every
// folder ends up holding a matched question.json + answer.json pair.
//
// Why the split is done here and not by hebrew_pdf_to_json.py: that script
// segments on a `שאלה N` header, and these papers write it as `שאלה מספר :2`
// (the colon lands inside the number after bidi processing), so it finds 0 or 1
// question instead of 2. Rather than loosen the shared extractor's regex — it
// is used by the multiple-choice ingestion too — the page-level split is
// applied here. All five papers have the same layout, verified in the extracted
// text:
//
//     page 1  header + question 1     page 3  "שאלה מספר 2" + question 2
//     page 2  legal sources for Q1    page 4  legal sources for Q2
//
// Quotes: only the 2026 paper comes out with page anchors on its quotes (it is
// the one paper the extractor did segment). For the rest, each quote is located
// by searching the page text for its citation, which is what decides whether it
// belongs to question 1 or 2.
//
// Usage:
//   node scripts/ingestion/open_questions/build_question_bundles.mjs [--dry-run]

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ingestionDir = dirname(here);
const pagesDir = join(here, 'answers', 'pages');
const dryRun = process.argv.includes('--dry-run');

/**
 * One entry per exam sitting. `q1Folder` holds the PDF and receives question 1;
 * `q2Folder` receives question 2.
 *
 * glyphBoxes: the 2021 papers map נ to a glyph poppler drops silently (U+00AA in
 * winter, U+00F0 in summer) — the extractor flags it as DEFECT 5 and the
 * word-box path recovers it. Without the flag the summer paper extracts with the
 * letter נ missing from every word: התנועה reads הת ועה, and because quote
 * locking substitutes the stored bytes verbatim, every generated question would
 * cite case law with letters missing. Leave it off elsewhere; poppler is the
 * better extractor wherever it can see the characters.
 */
const PAPERS = [
  { examId: '2021-W', year: 2021, season: 'winter', q1Folder: '2021-q1-answer',  q2Folder: '2021-q2-answer',  pdf: '2021_חורף_חלק_1_מטלת כתיבה.pdf', glyphBoxes: true },
  { examId: '2021-S', year: 2021, season: 'summer', q1Folder: '2021s-q1-answer', q2Folder: '2021s-q2-answer', pdf: 'מטלת כתיבה שאלות קיץ 2021.pdf', glyphBoxes: true },
  { examId: '2022-W', year: 2022, season: 'winter', q1Folder: '2022-q1-answer',  q2Folder: '2022-q2-answer',  pdf: 'מטלת כתיבה שאלות חורף 2022.pdf', glyphBoxes: false },
  { examId: '2023-S', year: 2023, season: 'summer', q1Folder: '2023-q1-answer',  q2Folder: '2023-q2-answer',  pdf: 'שאלות מטלת כתיבה קייץ 2023.pdf', glyphBoxes: false },
  { examId: '2026-S', year: 2026, season: 'summer', q1Folder: 'q1-answer',       q2Folder: 'q2-answer',       pdf: 'bar_exams_summer_2026_part_1_exam_paper_שאלות פתוחות 2026.pdf', glyphBoxes: false },
];

// "שאלה 2" / "שאלה מספר 2" / "שאלה מספר :2" — the colon may precede the digit.
const Q2_MARKER = /שאלה\s*(?:מספר)?\s*:?\s*2\b/;

// --- subject ---------------------------------------------------------------
// The subject is the NAME of the question's first legal source, with the
// bookkeeping stripped off: "מתוך בגץ 6536/17 התנועה למען איכות השלטון בישראל נ'
// משטרת ישראל" becomes "התנועה למען איכות השלטון בישראל נ' משטרת ישראל".
// A statute keeps its full name including the year, since that IS its name.
const SUBJECT_STRIPS = [
  // "מתוך" — the word introducing a source, not part of its name.
  /^מתוך\s+/,
  // Court abbreviation. Longest-first so ע"א cannot match inside רע"א.
  /^(?:רע"א|רע"פ|בר"ע|דנ"א|עת"ם|עת"מ|עע"ם|עע"מ|עמ"נ|עת"א|תמ"ש|בש"א|בג"ץ|בג"צ|בגץ|ע"א|ע"ע|ע"פ|ע"ר|ת"א|ה"פ|תא)\s*/,
  // Forum qualifier: ")ארצי(" — bidi renders the parens reversed.
  /^\)[^)(]{1,14}\(\s*/,
  // A lone Hebrew letter stranded before the docket number. The geresh of "נ'"
  // migrates during bidi processing and leaves its נ in front of the number
  // ("רע"א נ 777-03גר"), which would otherwise be read as part of the name.
  /^[א-ת]\s+(?=\d)/,
  // Docket number: 6536/17, 777-03, 23-2-111. Often glued to the first name
  // word by the extractor, so no trailing space is required.
  /^\d{1,6}\s*[/\-–]\s*\d{1,4}(?:\s*[-–]\s*\d{1,4})?\s*/,
];

/** First quote's citation, reduced to the source's name. Null if no quotes. */
function deriveSubject(quotes) {
  const citation = quotes?.[0]?.citation;
  if (!citation) return null;
  let s = citation.replace(/\s+/g, ' ').trim();
  for (const rx of SUBJECT_STRIPS) s = s.replace(rx, '').trim();
  return s || null;
}

const tmp = mkdtempSync(join(tmpdir(), 'qbundle-'));
const problems = [];
let written = 0;

try {
  for (const paper of PAPERS) {
    const q1Dir = join(pagesDir, paper.q1Folder);
    const q2Dir = join(pagesDir, paper.q2Folder);
    const pdfPath = join(q1Dir, paper.pdf);

    if (!existsSync(pdfPath)) { problems.push(`${paper.examId}: PDF not found — ${paper.pdf}`); continue; }
    if (!existsSync(q2Dir))   { problems.push(`${paper.examId}: missing folder ${paper.q2Folder}`); continue; }

    // --- extract ---------------------------------------------------------
    const extractedPath = join(tmp, `${paper.examId}.json`);
    const args = ['hebrew_pdf_to_json.py', pdfPath, '--exam-id', paper.examId, '-o', extractedPath];
    if (paper.glyphBoxes) args.push('--glyph-boxes');
    try {
      execFileSync('python', args, { cwd: ingestionDir, stdio: 'pipe' });
    } catch (err) {
      problems.push(`${paper.examId}: extraction failed — ${err.message.split('\n')[0]}`);
      continue;
    }

    const src = JSON.parse(readFileSync(extractedPath, 'utf8'));
    const pages = Array.isArray(src.pages) ? src.pages : [];
    if (!pages.length) { problems.push(`${paper.examId}: no pages extracted`); continue; }

    // --- split -----------------------------------------------------------
    const splitAt = pages.findIndex((p) => Q2_MARKER.test(p.text ?? ''));
    if (splitAt <= 0) {
      problems.push(`${paper.examId}: "שאלה 2" marker not found (or on page 1) — cannot split, skipped`);
      continue;
    }
    const halves = [pages.slice(0, splitAt), pages.slice(splitAt)];
    if (halves.some((h) => !h.length || !h.some((p) => (p.text ?? '').trim()))) {
      problems.push(`${paper.examId}: split produced an empty half — skipped`);
      continue;
    }

    // Assign each quote to the half whose page text contains its citation.
    // The 2026 paper already carries a page number; trust that when present.
    const quotes = Array.isArray(src.quotes) ? src.quotes : [];
    const placed = quotes.map((quote) => {
      if (quote.page) return { half: quote.page <= splitAt ? 0 : 1, how: 'page-anchor' };
      const needle = (quote.citation ?? '').trim();
      if (needle) {
        for (let h = 0; h < 2; h++) {
          if (halves[h].some((p) => (p.text ?? '').includes(needle))) return { half: h, how: 'citation-match' };
        }
      }
      return null;
    });

    // A quote whose citation matches no page is almost always a fragment the
    // extractor sheared off the source block above it (it warns "source N has
    // no quoted text" for exactly these). The quote list is in document order,
    // so the nearest placed neighbour is the right home — dropping them would
    // lose source text.
    for (let i = 0; i < placed.length; i++) {
      if (placed[i]) continue;
      let neighbour = null;
      for (let d = 1; d < placed.length && !neighbour; d++) {
        neighbour = placed[i - d] ?? placed[i + d] ?? null;
      }
      if (neighbour) {
        placed[i] = { half: neighbour.half, how: 'inferred-from-neighbour' };
        problems.push(`${paper.examId}: quote ${quotes[i].id} has no matching page text — placed on Q${neighbour.half + 1} by document order, verify`);
      } else {
        problems.push(`${paper.examId}: quote ${quotes[i].id} could not be placed and has no placed neighbour — dropped`);
      }
    }

    const quoteHalves = [[], []];
    quotes.forEach((q, i) => {
      if (placed[i]) quoteHalves[placed[i].half].push({ ...q, placement: placed[i].how });
    });

    // --- write -----------------------------------------------------------
    const code = paper.season === 'summer' ? 'S' : 'W';
    for (let n = 0; n < 2; n++) {
      const half = halves[n];
      const outDir = n === 0 ? q1Dir : q2Dir;
      const bundle = {
        question_id: `${paper.examId}-Q${n + 1}`,
        external_id: `${paper.examId}-Q${n + 1}`,
        // The matching answer bundle in this same folder, so the pair can be
        // loaded into open_questions as one row.
        answer_external_id: `${paper.year}-${code}-A${n + 1}-Q${n + 1}`,
        kind: 'question',
        // Named to match the open_questions.subject column it will be loaded
        // into. Derived, not authored — verify it before trusting it.
        subject: deriveSubject(quoteHalves[n]),
        exam: { year: paper.year, season: paper.season, assignment: n + 1, part: 1 },
        source: {
          pdf: paper.pdf,
          pdf_folder: `answers/pages/${paper.q1Folder}`,
          pages_folder: `answers/pages/${n === 0 ? paper.q1Folder : paper.q2Folder}`,
        },
        page_range: [half[0].page, half[half.length - 1].page],
        pages: half.map((p) => ({ page: p.page, text: p.text ?? '' })),
        text: half.map((p) => p.text ?? '').join('\n'),
        quotes: quoteHalves[n],
        // The extractor's segmented question object — fact_pattern,
        // task_instructions, title, legal_topics, client_role, deliverable,
        // answer_limit, timeline. generateAngle() reads exactly these fields off
        // the source, so a bundle without them cannot drive generation.
        question_fields:
          src.questions?.find((q) => q.external_id === `${paper.examId}-Q${n + 1}`) ?? null,
        global_instructions: src.document?.global_instructions ?? null,
        extraction: src.document?.extraction ?? null,
        needs_review: true,
      };
      if (!dryRun) writeFileSync(join(outDir, 'question.json'), JSON.stringify(bundle, null, 2) + '\n', 'utf8');
      written++;
      console.log(
        `${dryRun ? 'would write' : 'wrote'}  ${basename(outDir)}/question.json  ` +
        `pp${bundle.page_range.join('-')}  ${bundle.text.length} chars  ${bundle.quotes.length} quotes`
      );
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${written}/${PAPERS.length * 2} question bundles ${dryRun ? 'planned' : 'written'}`);
if (problems.length) {
  console.log('\nproblems:');
  for (const p of problems) console.log(`  - ${p}`);
}
