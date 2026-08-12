"use strict";

// Render a generated open question as an exam-style PDF.
//
//   node scripts/render-open-question-pdf.js <generated-or-rejected.json> <source-questions.json>
//
// Example:
//   node scripts/render-open-question-pdf.js \
//     ../scripts/ingestion/open_questions/generated/2025-D-W-Q1-A.generated.json \
//     ../scripts/ingestion/open_questions/sources/2025-12-part1-writing.json
//
// The .html and .pdf are written beside the input JSON, i.e. in generated/.
//
// Produces the candidate-facing paper only: the scenario, the task, and the
// attached sources. The exam-writer fields (legal_topic_analysis,
// model_answer_outline, common_pitfall) are deliberately excluded.
//
// The quotes are rendered from the quote bank, NOT from the model's output —
// same guarantee as everywhere else in this pipeline.
//
// Layout mirrors the Bar Association writing-task papers. The Bar's logo and
// branding are deliberately NOT reproduced: this is practice material, and a
// synthetic question carrying an official mark would be a forgery.

const fs = require("node:fs");
const path = require("node:path");

const { buildBank, renderTokens } = require("../lib/ai/quote-bank");
const { esc, paragraphs, printHtmlToPdf } = require("../lib/pdf/print");

function buildHtml({ question, bank, label }) {
  // Placeholders in candidate-facing text resolve to citations; the sources
  // themselves are printed verbatim from the bank below.
  const factPattern = renderTokens(question.fact_pattern, bank);
  const taskInstructions = renderTokens(question.task_instructions, bank);

  const sources = bank
    .map(
      (q) => `
      <p class="source">
        <span class="cite">${esc(q.citation)}</span>: &rdquo;${esc(q.text)}&ldquo;
      </p>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${esc(question.angle_title || "שאלה")}</title>
<style>
  @page { size: A4; margin: 22mm 20mm 18mm 20mm; }

  html, body {
    font-family: Arial, "Segoe UI", sans-serif;
    font-size: 11.5pt;
    line-height: 1.62;
    color: #000;
    margin: 0;
  }

  .masthead {
    text-align: center;
    padding-bottom: 6mm;
    margin-bottom: 8mm;
    border-bottom: 1.2pt solid #1f3864;
  }
  .masthead .brand {
    font-size: 15pt;
    font-weight: bold;
    color: #1f3864;
    letter-spacing: .5pt;
  }
  .masthead .kind { font-size: 11pt; margin-top: 1.5mm; }
  .masthead .practice {
    font-size: 9pt;
    color: #555;
    margin-top: 2.5mm;
  }

  p { text-align: justify; margin: 0 0 3.2mm 0; }

  .lead { font-weight: bold; margin-bottom: 6mm; }
  h1 {
    font-size: 11.5pt;
    font-weight: bold;
    text-decoration: underline;
    margin: 0 0 4mm 0;
  }

  /* The paper prints its operative instructions in bold. */
  .instructions { font-weight: bold; margin-top: 6mm; }

  .sources { margin-top: 7mm; }
  .source { margin-bottom: 4mm; }
  .cite { font-weight: bold; }

  .notices { margin-top: 10mm; text-align: center; }
  .notices p { text-align: center; text-decoration: underline; margin-bottom: 4mm; }
  .goodluck {
    text-align: center;
    font-weight: bold;
    text-decoration: underline;
    letter-spacing: 3pt;
    margin-top: 9mm;
  }

  /* A closing colophon, not a running footer: Chromium's handling of
     position:fixed across printed pages overlaps body text. */
  .colophon {
    margin-top: 12mm;
    padding-top: 3mm;
    border-top: .5pt solid #bbb;
    text-align: center;
    font-size: 8.5pt;
    color: #666;
  }

  /* Never strand a heading or a citation alone at a page boundary. */
  h1, .cite { break-after: avoid; }
  .source { break-inside: avoid; }
</style>
</head>
<body>

  <div class="masthead">
    <div class="brand">LawPass — הכנה לבחינת לשכת עורכי הדין</div>
    <div class="kind">חלק ראשון — מטלת כתיבה</div>
    <div class="practice">${label}</div>
  </div>

  <p class="lead">ענו על שאלה אחת בלבד מבין השאלות שלפניכם.</p>

  <h1>שאלה 1:</h1>

  ${paragraphs(factPattern)}

  ${paragraphs(taskInstructions, "instructions")}

  <div class="sources">
    ${sources}
  </div>

  <div class="notices">
    <p>לידיעתכם, מדבקת הזיהוי ופרטי הזיהוי בראש טופס התשובות הינם לשימוש פנימי ואינם מוצגים לבודק המטלה.</p>
    <p>לתשומת לבך! חל איסור לכלול בגוף התשובה פרטים מזהים כלשהם.</p>
  </div>

  <div class="goodluck">בהצלחה!</div>

  <div class="colophon">${label}</div>

</body>
</html>`;
}

function main() {
  const [generatedPath, sourcePath] = process.argv.slice(2);
  if (!generatedPath || !sourcePath) {
    console.error(
      "usage: node scripts/render-open-question-pdf.js <generated.json> <source-questions.json>"
    );
    process.exit(2);
  }

  const payload = JSON.parse(fs.readFileSync(generatedPath, "utf8"));
  const sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

  // Accept either a promoted draft (questions[0]) or a rejected payload (generated).
  const question = payload.questions?.[0] || payload.generated;
  if (!question) {
    throw new Error("no question found in the input file");
  }
  const sourceId =
    payload.generated_from?.source_external_id || payload.source_external_id;
  const bank = buildBank(sourceData.quotes, sourceId);

  // The id is Latin/digits inside an RTL line — isolate it, or bidi reorders it
  // on screen (the same class of bug that corrupted the source PDF's case number).
  const isDraft = Boolean(payload.questions);
  const state = isDraft ? "טיוטה לבדיקה" : "לא אושרה";
  const label =
    `שאלת תרגול · נוצרה אוטומטית · ${state} · ` +
    `מבוססת על <bdi dir="ltr">${esc(sourceId)}</bdi>`;

  const html = buildHtml({ question, bank, label });

  const base = path.join(
    path.dirname(path.resolve(generatedPath)),
    path.basename(generatedPath).replace(/[.]json$/, "")
  );
  const { htmlPath, pdfPath } = printHtmlToPdf(html, base);

  console.log(`sources printed verbatim from bank: ${bank.map((q) => q.id).join(", ")}`);
  console.log(`html : ${htmlPath}`);
  console.log(`pdf  : ${pdfPath}`);
}

main();
