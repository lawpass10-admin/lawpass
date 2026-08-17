// build_answer_bundles.mjs — one self-contained answer.json per page folder.
//
// Each folder under answers/pages/ holds the rendered page images of one
// official model answer (תשובה מוצעת). The text for those pages was already
// extracted from the source PDF into answers/*.json — this script joins the
// two and writes the whole answer as a single file inside its own folder, so
// nothing downstream has to know the answers/ ↔ pages/ naming relationship.
//
// The folder names are not self-describing (`2021-q1-answer` is winter,
// `2021s-q1-answer` is summer, `q1-answer` is 2026), so the mapping is spelled
// out below rather than inferred. It was verified by comparing the first line
// of each page01.png against the extracted text.
//
// Note on the source files: 6 of the 11 have an empty `questions[]` — the
// PDF→JSON step extracted their page text but never ran the segmentation pass.
// The page text is complete in all 11, so that is what we bundle from.
//
// Usage:
//   node scripts/ingestion/open_questions/build_answer_bundles.mjs [--dry-run]

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const answersDir = join(here, 'answers');
const pagesDir = join(answersDir, 'pages');
const dryRun = process.argv.includes('--dry-run');

/** page-folder → source JSON + identity. Verified against the page images. */
const MAP = [
  { folder: '2021-q1-answer',  json: '2021-winter-q1-answer.json',  year: 2021, season: 'winter', assignment: 1, kind: 'model_answer' },
  { folder: '2021-q2-answer',  json: '2021-winter-q2-answer.json',  year: 2021, season: 'winter', assignment: 2, kind: 'model_answer' },
  { folder: '2021s-q1-answer', json: '2021-summer-q1-answer.json',  year: 2021, season: 'summer', assignment: 1, kind: 'model_answer' },
  { folder: '2021s-q2-answer', json: '2021-summer-q2-answer.json',  year: 2021, season: 'summer', assignment: 2, kind: 'model_answer' },
  { folder: '2022-q1-answer',  json: '2022-winter-q1-answer.json',  year: 2022, season: 'winter', assignment: 1, kind: 'model_answer' },
  { folder: '2022-q2-answer',  json: '2022-winter-q2-answer.json',  year: 2022, season: 'winter', assignment: 2, kind: 'model_answer' },
  { folder: '2023-q1-answer',  json: '2023-summer-q1-answer.json',  year: 2023, season: 'summer', assignment: 1, kind: 'model_answer' },
  { folder: '2023-q2-answer',  json: '2023-summer-q2-answer.json',  year: 2023, season: 'summer', assignment: 2, kind: 'model_answer' },
  { folder: 'q1-answer',       json: '2026-summer-q1-answer.json',  year: 2026, season: 'summer', assignment: 1, kind: 'model_answer' },
  { folder: 'q2-answer',       json: '2026-summer-q2-answer.json',  year: 2026, season: 'summer', assignment: 2, kind: 'model_answer' },
  { folder: 'rubric',          json: 'answers_table_tamplete.json', year: 2026, season: 'summer', assignment: 1, kind: 'rubric' },
];

const seasonCode = (s) => (s === 'summer' ? 'S' : 'W');

let written = 0;
const problems = [];

for (const entry of MAP) {
  const folderPath = join(pagesDir, entry.folder);
  const jsonPath = join(answersDir, entry.json);

  if (!existsSync(folderPath)) { problems.push(`missing folder: ${entry.folder}`); continue; }
  if (!existsSync(jsonPath))   { problems.push(`missing source json: ${entry.json}`); continue; }

  const src = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const srcPages = Array.isArray(src.pages) ? src.pages : [];
  const images = readdirSync(folderPath).filter((f) => /\.png$/i.test(f)).sort();

  // The page images and the extracted pages must line up 1:1, or the bundle
  // would silently pair text with the wrong image.
  if (images.length !== srcPages.length) {
    problems.push(`${entry.folder}: ${images.length} images but ${srcPages.length} extracted pages — skipped`);
    continue;
  }

  const pages = srcPages.map((p, i) => ({
    page: p.page ?? i + 1,
    image: images[i],
    text: p.text ?? '',
  }));

  const emptyPages = pages.filter((p) => !p.text.trim()).map((p) => p.page);
  if (emptyPages.length) problems.push(`${entry.folder}: no text on page(s) ${emptyPages.join(', ')}`);

  const idBase = `${entry.year}-${seasonCode(entry.season)}-A${entry.assignment}`;
  const question = src.questions?.[0] ?? null;

  const bundle = {
    answer_id: entry.kind === 'rubric' ? `${idBase}-RUBRIC` : idBase,
    external_id: question?.external_id ?? `${idBase}-Q${entry.assignment}`,
    kind: entry.kind,
    exam: { year: entry.year, season: entry.season, assignment: entry.assignment, part: 1 },
    source: {
      pdf: src.document?.source_file ?? null,
      json: `answers/${entry.json}`,
      pages_folder: `answers/pages/${entry.folder}`,
    },
    page_count: pages.length,
    pages,
    // Whole answer as one string, pages joined in order — this is the field the
    // ingestion step reads into open_questions.answers.
    text: pages.map((p) => p.text).join('\n'),
    global_instructions: src.document?.global_instructions ?? null,
    // Carried through so the segmented files keep the structure they already
    // have; null for the 6 that were never segmented.
    question_fields: question,
    extraction: src.document?.extraction ?? null,
    // Nothing here has been checked by a human against the PDF yet.
    needs_review: true,
  };

  const outPath = join(folderPath, 'answer.json');
  if (!dryRun) writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  written++;
  console.log(
    `${dryRun ? 'would write' : 'wrote'}  ${entry.folder}/answer.json  ` +
    `${pages.length}pp  ${bundle.text.length} chars  ${question ? 'segmented' : 'pages-only'}`
  );
}

console.log(`\n${written}/${MAP.length} bundles ${dryRun ? 'planned' : 'written'}`);
if (problems.length) {
  console.log('\nproblems:');
  for (const p of problems) console.log(`  - ${p}`);
}
