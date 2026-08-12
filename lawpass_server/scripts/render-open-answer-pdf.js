"use strict";

// Render a generated model answer as a filed-pleading PDF.
//
//   node scripts/render-open-answer-pdf.js <answer.json> <source-questions.json>
//
// Example:
//   node scripts/render-open-answer-pdf.js \
//     ../scripts/ingestion/open_questions/generated/2025-D-W-Q1-A.answer.json \
//     ../scripts/ingestion/open_questions/sources/2025-12-part1-writing.json
//
// Layout follows the real Bar Association model answers (פתרון): case number and
// court at the head, the party block, the pleading title, numbered paragraphs
// under sub-headings, exhibits, and a signature line.
//
// Quotes are rendered from the quote bank, not from the stored preview — the PDF
// is generated from the locked source every time, same as the question renderer.

const fs = require("node:fs");
const path = require("node:path");

const { buildBank, renderTokens } = require("../lib/ai/quote-bank");
const { esc, printHtmlToPdf } = require("../lib/pdf/print");

function buildHtml({ answer, bank, label }) {
  const r = (s) => esc(renderTokens(s ?? "", bank));

  // Paragraphs run continuously across sections, as in the real answers.
  let n = 0;
  const sections = (answer.sections || [])
    .map((s) => {
      const items = (s.paragraphs || [])
        .map((p) => `<li><span class="num">${++n}.</span> ${r(p)}</li>`)
        .join("\n");
      return `
      <h2>${esc(s.heading)}</h2>
      <ol class="para">${items}</ol>`;
    })
    .join("\n");

  const exhibits = (answer.exhibits || []).length
    ? `<ul class="exhibits">${(answer.exhibits || [])
        .map((x) => `<li>${r(x.description)} ומסומן ${esc(x.marker)}</li>`)
        .join("\n")}</ul>`
    : "";

  const p = answer.parties || {};

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(answer.document_type || "פתרון")}</title>
<style>
  @page { size: A4; margin: 20mm 20mm 16mm 20mm; }

  html, body {
    font-family: Arial, "Segoe UI", sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #000;
    margin: 0;
  }

  .caseline { font-weight: bold; margin-bottom: 1mm; }
  .court { font-weight: bold; margin: 4mm 0 5mm 0; }

  .party { margin-bottom: 2.5mm; }
  .versus { text-align: center; font-weight: bold; letter-spacing: 2pt; margin: 3mm 0; }
  .roles { margin: 3mm 0 6mm 0; }
  .roles div { display: flex; gap: 4mm; }
  .roles .k { min-width: 26mm; }

  h1 {
    font-size: 12pt;
    font-weight: bold;
    text-align: center;
    text-decoration: underline;
    margin: 7mm 0 5mm 0;
  }
  h2 {
    font-size: 11pt;
    font-weight: bold;
    margin: 6mm 0 2.5mm 0;
    break-after: avoid;
  }

  p, li { text-align: justify; }
  .opening { margin-bottom: 2mm; }

  ol.para { list-style: none; padding: 0; margin: 0; }
  ol.para li { margin-bottom: 3mm; break-inside: avoid; }
  ol.para .num { font-weight: bold; margin-left: 1.5mm; }

  ul.exhibits { list-style: none; padding: 0; margin: 3mm 0 3mm 6mm; }
  ul.exhibits li { margin-bottom: 1.5mm; }
  ul.exhibits li::before { content: "• "; font-weight: bold; }

  /* Closing and signature travel together — a signature stranded alone on a
     trailing page reads as an unfinished document. */
  .tail { break-inside: avoid; margin-top: 6mm; }
  .closing { margin: 0; }
  .signature { margin-top: 10mm; text-align: left; }
  .signature .rule { display: inline-block; border-top: .8pt solid #000; width: 55mm; padding-top: 1.5mm; }

  .colophon {
    margin-top: 12mm;
    padding-top: 3mm;
    border-top: .5pt solid #bbb;
    text-align: center;
    font-size: 8.5pt;
    color: #666;
  }
</style>
</head>
<body>

  <div class="caseline">${esc(answer.case_number)}</div>
  <div class="court">${esc(answer.court)}</div>

  <div class="party">${esc(p.applicant)} באמצעות ב"כ עו"ד ____________ שכתובתה ___________________
    טלפון: ________ פקס: ________ דוא"ל: ________</div>
  <div class="versus">- נ ג ד -</div>
  <div class="party">${esc(p.respondent)}</div>

  <div class="roles">
    <div><span class="k">${esc(p.applicant_role)}</span></div>
    <div><span class="k">${esc(p.respondent_role)}</span></div>
  </div>

  <h1>${esc(answer.document_type)}</h1>

  <p class="opening">${r(answer.opening)}</p>

  ${sections}

  ${exhibits}

  <div class="tail">
    <p class="closing">${r(answer.closing)}</p>
    <div class="signature"><span class="rule">${esc(answer.signature_line)}</span></div>
  </div>

  <div class="colophon">${label}</div>

</body>
</html>`;
}

function main() {
  const [answerPath, sourcePath] = process.argv.slice(2);
  if (!answerPath || !sourcePath) {
    console.error(
      "usage: node scripts/render-open-answer-pdf.js <answer.json> <source-questions.json>"
    );
    process.exit(2);
  }

  const payload = JSON.parse(fs.readFileSync(answerPath, "utf8"));
  const answer = payload.answers?.[0] || payload.generated;
  if (!answer) throw new Error(`no answer found in ${answerPath}`);

  const question = payload.questions?.[0] || {};
  const sourceId =
    payload.generated_from?.source_external_id ||
    question.parent_question_id ||
    payload.question_external_id;

  const sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const bank = buildBank(sourceData.quotes, sourceId);

  const isDraft = Boolean(payload.answers);
  const state = isDraft ? "טיוטה לבדיקה" : "לא אושרה";
  const label =
    `פתרון לדוגמה · נוצר אוטומטית · ${state} · ` +
    `לשאלה <bdi dir="ltr">${esc(question.external_id || sourceId)}</bdi>`;

  const html = buildHtml({ answer, bank, label });

  const base = path.join(
    path.dirname(path.resolve(answerPath)),
    path.basename(answerPath).replace(/\.json$/, "")
  );
  const { htmlPath, pdfPath } = printHtmlToPdf(html, base);

  console.log(`sources rendered from bank: ${bank.map((q) => q.id).join(", ")}`);
  console.log(`html : ${htmlPath}`);
  console.log(`pdf  : ${pdfPath}`);
}

main();
