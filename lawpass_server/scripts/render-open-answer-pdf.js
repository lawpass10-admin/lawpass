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
// Layout follows the marking rules in llm-params-answers.json:
//   RULE 1 — caption: court name and case number on one line (court right, case
//            number left), then the party block — role labels on the right,
//            party details to their left, -נגד- between the two parties; the
//            advocate's details stay as ??? placeholders. Layout follows the
//            official model answers in scripts/ingestion/open_questions/answers.
//            The מועד המצאה / מועד תגובה lines print only for a pleading that
//            responds to something served — see RULE 1(d) below.
//   RULE 2 — each exhibit line sits directly beneath the paragraph it supports.
//
// Quotes are rendered from the quote bank, not from the stored preview — the PDF
// is generated from the locked source every time, same as the question renderer.

const fs = require("node:fs");
const path = require("node:path");

const { buildBank, renderTokens } = require("../lib/ai/quote-bank");
const { esc, printHtmlToPdf } = require("../lib/pdf/print");

// RULE 1: the advocate's own details stay as ??? for the candidate to fill in.
const ADVOCATE =
  'באמצעות ב"כ עו"ד ??? (מ"ר ???) מרחוב ???<br>' +
  "טל': ???; פקס: ???; דוא\"ל: ???";

function buildHtml({ answer, bank, label }) {
  const r = (s) => esc(renderTokens(s ?? "", bank));

  // Paragraphs are numbered continuously across sections, as in the real
  // answers. RULE 2: an exhibit line follows the paragraph that relies on it.
  let n = 0;
  const sections = (answer.sections || [])
    .map((sec) => {
      const items = (sec.paragraphs || [])
        .map((para) => {
          const isPlain = typeof para === "string";
          const text = isPlain ? para : para.text;
          const desc = isPlain ? "" : para.exhibit_description;
          const marker = isPlain ? "" : para.exhibit_marker;

          const exhibit =
            desc && String(desc).trim()
              ? `<div class="exhibit">***&#9;העתק ${r(desc)} מצ"ב <b>כנספח ${esc(
                  marker
                )}</b>.</div>`
              : "";

          return `<li><span class="num">${++n}.</span> ${r(text)}${exhibit}</li>`;
        })
        .join("");

      return `<h2>${esc(sec.heading)}</h2><ol class="para">${items}</ol>`;
    })
    .join("");

  const p = answer.parties || {};

  // RULE 1(d) — the two date lines belong only to a pleading that RESPONDS to
  // something already served. An initiating pleading (עתירה, כתב תביעה) opens
  // the proceeding: nothing was served and no response is due, so the model
  // returns "" for both and the block is dropped rather than printed empty.
  // A responding pleading carries them, with ??? where the question is silent.
  const dateLine = (label, value) =>
    String(value ?? "").trim() ? `<div>${label}: ${esc(value)}</div>` : "";

  // RULE 1(b) — an interlocutory application carries TWO designations per party:
  // the role in the case (התובע/הנתבעת) and the role in this application
  // (המבקש/המשיב), stacked. The model separates them with a newline. The
  // official answers underline the first only.
  const role = (value) => {
    const parts = String(value ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return "";
    return [`<u>${esc(parts[0])}</u>`, ...parts.slice(1).map(esc)].join("<br>");
  };
  const dates =
    dateLine("מועד המצאת הבקשה", answer.service_date) +
    dateLine("מועד אחרון לתגובה", answer.response_deadline);

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

  /* RULE 1 — the caption block. The court name and the case number share one
     line ABOVE the party block, court on the right and case number on the left.
     In the party block the party's NAME sits on the right and its role label
     (העותר / המשיבות) on the left — house style, set by the founder. Note the
     official Bar Association model answers do it the other way round, label
     rightmost; do not "correct" this back without asking.
     The page is dir="rtl", so the first child in source order renders rightmost
     — hence court before case number, and td.main before td.side. */
  .topline { display: flex; justify-content: space-between; margin-bottom: 4mm; }
  .topline .court { font-weight: bold; }

  table.caption { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
  table.caption td { border: .8pt solid #000; padding: 2mm 2.5mm; vertical-align: top; }
  table.caption td.side { width: 26%; }
  table.caption td.mid { width: 22%; text-align: center; vertical-align: middle; }
  table.caption td.main { width: 52%; }

  .dates { margin: 4mm 0 2mm 0; }

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

  /* RULE 2 — exhibit line, anchored under its paragraph */
  .exhibit { margin: 2mm 0 0 0; }

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

  <div class="topline">
    <span class="court">${esc(answer.court)}</span>
    <span class="case">${esc(answer.case_number)}</span>
  </div>

  <table class="caption">
    <tr>
      <td class="main">${esc(p.client_name)}<br>${ADVOCATE}</td>
      <td class="mid"></td>
      <td class="side">${role(p.client_role)}</td>
    </tr>
    <tr>
      <td class="main"></td>
      <td class="mid"><b>-נגד-</b></td>
      <td class="side"></td>
    </tr>
    <tr>
      <td class="main">${esc(p.opposing_name)}<br>${ADVOCATE}</td>
      <td class="mid"></td>
      <td class="side">${role(p.opposing_role)}</td>
    </tr>
  </table>

  ${dates ? `<div class="dates">${dates}</div>` : ""}

  <h1>${esc(answer.document_type)}</h1>

  <p class="opening">${r(answer.opening)}</p>

  ${sections}

  <div class="tail">
    <p class="closing">${r(answer.closing)}</p>
    <div class="signature"><span class="rule">${esc(answer.signature_line)}</span></div>
  </div>

  <div class="colophon">${label}</div>

</body>
</html>`;
}

function main() {
  const args = process.argv.slice(2);
  const htmlOnly = args.includes("--html-only");
  const [answerPath, sourcePath, sourceIdArg] = args.filter((a) => !a.startsWith("--"));
  if (!answerPath || !sourcePath) {
    console.error(
      "usage: node scripts/render-open-answer-pdf.js <answer.json> <source-questions.json> [source_external_id] [--html-only]"
    );
    process.exit(2);
  }

  const payload = JSON.parse(fs.readFileSync(answerPath, "utf8"));
  const answer = payload.answers?.[0] || payload.generated;
  if (!answer) throw new Error(`no answer found in ${answerPath}`);

  const question = payload.questions?.[0] || {};
  // A generated angle carries generated_from/parent; a CORE question is its own
  // source and has neither, so fall back to the ids the answer itself records.
  const recordedId =
    sourceIdArg ||
    payload.generated_from?.source_external_id ||
    question.parent_question_id ||
    payload.question_external_id ||
    answer.question_external_id ||
    question.external_id;

  const sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

  // A rejected payload records the ANGLE id (2025-D-W-Q1-A), but quotes are
  // keyed by the SOURCE id (2025-D-W-Q1). Fall back to the parent rather than
  // failing — a rejected answer is exactly what you want to look at.
  const known = new Set(sourceData.quotes.map((q) => q.question_external_id));
  let sourceId = recordedId;
  if (!known.has(sourceId)) {
    const parent = String(sourceId || "").replace(/-[A-Za-z0-9]+$/, "");
    if (known.has(parent)) {
      sourceId = parent;
    } else {
      throw new Error(
        `no quotes for ${recordedId} (or ${parent}) in ${path.basename(sourcePath)}. ` +
          `Known: ${[...known].join(", ")}. Pass the source id as a third argument.`
      );
    }
  }

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
  const { htmlPath, pdfPath } = printHtmlToPdf(html, base, { htmlOnly });

  console.log(`sources rendered from bank: ${bank.map((q) => q.id).join(", ")}`);
  console.log(`html : ${htmlPath}`);
  if (pdfPath) console.log(`pdf  : ${pdfPath}`);
}

main();
