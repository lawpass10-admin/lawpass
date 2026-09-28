// compare-conversion.mjs — the source and LawPass's version, side by side.
//
//   node scripts/ingestion/compare-conversion.mjs <source.json> <out.lawpass.json> --out=<dir>
//
// WHY A SEPARATE VIEW. The checks in rewrite-source.mjs answer "did anything
// leak" with a number. They cannot answer "is this actually a different piece
// of writing", which is a judgement, and a judgement needs both texts in front
// of you. This puts them in one table: the fact that had to survive, and the
// two explanations of it that must not resemble each other.
//
// INTERNAL ONLY. This file embeds the SOURCE text — the copyrighted expression
// the whole pipeline exists to keep out of published output. It is a review
// artefact for the operator's own machine. Do not ship it, do not put it behind
// the app, do not commit it. The banner at the top of the page says so, and the
// filename ends in .internal.html to make an accident less likely.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const outDir = flagOf("out");
const inputs = argv.filter((a) => !a.startsWith("--"));

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ------------------------------------------------------------- similarity

/** Content words, with the Hebrew function words that appear in any sentence removed. */
const STOP = new Set([
  "של", "את", "עם", "על", "אל", "מן", "מ", "ב", "ל", "ו", "כ", "ש", "זה", "זו", "הוא", "היא",
  "הם", "הן", "לא", "כי", "אם", "או", "גם", "רק", "כל", "יש", "אין", "היה", "הייתה", "אינו",
  "אינה", "כך", "כדי", "אך", "אבל", "לפי", "בין", "אחרי", "לפני", "אשר", "ה",
]);

function contentWords(text) {
  return String(text ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * How much of the source explanation's vocabulary reappears in ours.
 *
 * Deliberately generous — it counts a word as shared on an exact match, with no
 * stemming, so Hebrew morphology makes the true overlap lower than this reads.
 * A generous measure that still comes out low is worth more than a strict one
 * that flatters the result.
 */
function overlap(sourceText, ourText) {
  const a = new Set(contentWords(sourceText));
  const b = new Set(contentWords(ourText));
  if (a.size === 0) return { pct: 0, shared: [] };
  const shared = [...a].filter((w) => b.has(w));
  return { pct: (100 * shared.length) / a.size, shared };
}

/** Longest run of consecutive words the two texts share — the phrasing test. */
function longestSharedRun(sourceText, ourText) {
  const a = contentWords(sourceText);
  const b = ourText ? contentWords(ourText).join(" ") : "";
  let best = 0;
  let phrase = "";
  for (let i = 0; i < a.length; i++) {
    for (let n = best + 1; i + n <= a.length; n++) {
      const run = a.slice(i, i + n).join(" ");
      if (b.includes(run)) {
        best = n;
        phrase = run;
      } else break;
    }
  }
  return { length: best, phrase };
}

// ------------------------------------------------------------------ pair

/**
 * Line the two documents up on the one thing they share: the fact.
 *
 * The source is keyed by its "wrong" column and the output by `avoid`, which
 * carries the same string across unchanged — that is the whole point of the
 * pipeline, and it is also what makes this join possible.
 */
function pairUp(source, doc) {
  const rows = [];

  for (const section of source.sections ?? []) {
    for (const table of section.tables ?? []) {
      const cols = table.columns ?? [];
      const wrong = cols.find((c) => /שגוי/.test(c));
      const right = cols.find((c) => /תקין/.test(c));
      const why = cols.find((c) => /למה/.test(c));
      if (!wrong || !right) continue;

      for (const row of table.rows ?? []) {
        const avoid = String(row[wrong] ?? "").trim();
        let ours = null;
        let group = null;
        for (const g of doc.groups ?? []) {
          const hit = (g.items ?? []).find((i) => i.avoid === avoid);
          if (hit) {
            ours = hit;
            group = g;
            break;
          }
        }
        rows.push({
          source_section: section.heading,
          avoid,
          use: String(row[right] ?? "").trim(),
          source_why: why ? String(row[why] ?? "").trim() : "",
          ours,
          group,
        });
      }
    }
  }

  return rows;
}

// ------------------------------------------------------------------ html

function render(rows, source, doc, meta) {
  // v1.1 documents carry no example or exam note, so the column is just our
  // explanation. Promising "+ additions" above an empty space would misreport
  // what the conversion produced.
  const hasAdditions = rows.some((r) => r.ours && (r.ours.example || r.ours.exam_note));
  const srcSections = (source.sections ?? []).map((s) => s.heading).filter(Boolean);
  const ourGroups = (doc.groups ?? []).map((g) => g.heading);

  const overlaps = rows.filter((r) => r.ours).map((r) => overlap(r.source_why, r.ours.reason).pct);
  const avg = overlaps.length ? overlaps.reduce((a, b) => a + b, 0) / overlaps.length : 0;
  const runs = rows.filter((r) => r.ours).map((r) => longestSharedRun(r.source_why, r.ours.reason).length);
  const worstRun = runs.length ? Math.max(...runs) : 0;

  const body = rows
    .map((r, i) => {
      if (!r.ours) {
        return `<tr class="missing"><td>${i + 1}</td><td colspan="4">
          <b>${esc(r.avoid)}</b> — לא נמצא בגרסת LawPass</td></tr>`;
      }
      const ov = overlap(r.source_why, r.ours.reason);
      const run = longestSharedRun(r.source_why, r.ours.reason);
      const band = ov.pct < 15 ? "good" : ov.pct < 30 ? "mid" : "bad";
      return `<tr>
  <td class="n">${i + 1}</td>
  <td class="fact">
    <div class="avoid">${esc(r.avoid)}</div>
    <div class="arrow">↓</div>
    <div class="use">${esc(r.ours.use)}</div>
    <div class="same">זהה בשני הצדדים</div>
  </td>
  <td class="src">
    <div class="tag">${esc(r.source_section)}</div>
    <p>${esc(r.source_why) || "<i>(ללא הסבר)</i>"}</p>
  </td>
  <td class="ours">
    <div class="tag">${esc(r.group.heading)}</div>
    <p>${esc(r.ours.reason)}</p>
    ${r.ours.example ? `<p class="ex">${esc(r.ours.example)}</p>` : ""}
    ${r.ours.exam_note ? `<p class="note">${esc(r.ours.exam_note)}</p>` : ""}
  </td>
  <td class="metric ${band}">
    <div class="pct">${ov.pct.toFixed(0)}%</div>
    <div class="sub">מילים משותפות</div>
    <div class="sub">רצף: ${run.length}</div>
  </td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<title>השוואה — מקור מול גרסת LawPass</title>
<style>
  :root { color-scheme: light dark; --line: #d9d9d9; --good: #1e8449; --mid: #b9770e; --bad: #c0392b; --dim: #6b6b6b; }
  body { font-family: "Segoe UI", Arial, sans-serif; max-width: 1500px; margin: 0 auto; padding: 20px 20px 60px; line-height: 1.65; }
  .warn { background: #c0392b; color: #fff; padding: 10px 14px; border-radius: 6px; font-weight: 600; margin-bottom: 18px; }
  h1 { font-size: 20px; margin: 0 0 6px; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 22px; }
  .card { border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; min-width: 150px; }
  .card .big { font-size: 22px; font-weight: 700; }
  .card .lbl { font-size: 12px; color: var(--dim); }
  .struct { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
  .struct > div { border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
  .struct h3 { font-size: 14px; margin: 0 0 6px; }
  .struct li { font-size: 13.5px; }
  table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  th, td { border: 1px solid var(--line); padding: 8px 10px; vertical-align: top; text-align: start; }
  th { background: #00000008; position: sticky; top: 0; }
  td.n { color: var(--dim); width: 32px; }
  td.fact { width: 165px; text-align: center; }
  .avoid { color: var(--bad); text-decoration: line-through; font-weight: 600; }
  .use { color: var(--good); font-weight: 700; }
  .arrow { color: var(--dim); font-size: 12px; }
  .same { font-size: 11px; color: var(--dim); margin-top: 6px; }
  td.src { width: 30%; background: #c0392b0a; }
  td.ours { width: 38%; background: #1e84490a; }
  .tag { font-size: 11px; color: var(--dim); border: 1px solid var(--line); border-radius: 99px; padding: 1px 8px; display: inline-block; margin-bottom: 6px; }
  td p { margin: 0 0 6px; }
  .ex { font-style: italic; color: var(--dim); }
  .note { font-size: 12.5px; color: var(--dim); border-inline-start: 3px solid var(--line); padding-inline-start: 8px; }
  td.metric { width: 92px; text-align: center; }
  td.metric .pct { font-size: 18px; font-weight: 700; }
  td.metric .sub { font-size: 11px; color: var(--dim); }
  .good .pct { color: var(--good); } .mid .pct { color: var(--mid); } .bad .pct { color: var(--bad); }
  tr.missing td { background: #c0392b18; color: var(--bad); }
  footer { margin-top: 26px; font-size: 12.5px; color: var(--dim); }
</style>

<div class="warn">⚠ מסמך פנימי בלבד — מכיל את הטקסט המקורי המוגן. לא לפרסום, לא להעלאה לאפליקציה, לא ל־git.</div>

<h1>השוואה: המקור מול גרסת LawPass</h1>
<p style="color:var(--dim);margin:0">${esc(meta.source_file)} · ${esc(meta.contract ?? "")} · ${esc(meta.model ?? "")}</p>

<div class="summary">
  <div class="card"><div class="big">${rows.length}</div><div class="lbl">עובדות במקור</div></div>
  <div class="card"><div class="big">${rows.filter((r) => r.ours).length}</div><div class="lbl">נשמרו בגרסה שלנו</div></div>
  <div class="card"><div class="big">${srcSections.length} → ${ourGroups.length}</div><div class="lbl">מקטעים → קבוצות</div></div>
  <div class="card"><div class="big" style="color:${avg < 15 ? "var(--good)" : "var(--bad)"}">${avg.toFixed(0)}%</div><div class="lbl">חפיפת מילים ממוצעת</div></div>
  <div class="card"><div class="big" style="color:${worstRun < 6 ? "var(--good)" : "var(--bad)"}">${worstRun}</div><div class="lbl">הרצף המשותף הארוך ביותר</div></div>
</div>

<div class="struct">
  <div>
    <h3>המקור — מסודר לפי חלקי דיבר</h3>
    <ol>${srcSections.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
  </div>
  <div>
    <h3>LawPass — מסודר לפי סיבת השגיאה</h3>
    <ol>${ourGroups.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
  </div>
</div>

<table>
  <thead><tr>
    <th>#</th><th>העובדה (נשמרת)</th><th>ההסבר במקור</th><th>${hasAdditions ? "ההסבר שלנו + תוספות" : "ההסבר שלנו"}</th><th>חפיפה</th>
  </tr></thead>
  <tbody>
${body}
  </tbody>
</table>

<footer>
  חפיפת מילים נמדדת על מילות תוכן בלבד, ללא מילות יחס, ובהתאמה מדויקת ללא ניתוח מורפולוגי —
  כלומר המדד נדיב, והחפיפה האמיתית נמוכה ממנו. "רצף" הוא מספר המילים הרצופות הארוך ביותר
  המשותף לשני ההסברים; 6 ומעלה נחשב ממצא.
</footer>
</html>
`;
}

// ------------------------------------------------------------------ main

async function main() {
  if (inputs.length < 2 || argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/compare-conversion.mjs <source.json> <out.lawpass.json> --out=<dir>"
    );
    process.exit(inputs.length < 2 ? 2 : 0);
  }

  const sourcePath = resolve(inputs[0]);
  const ourPath = resolve(inputs[1]);
  const source = JSON.parse(readFileSync(sourcePath, "utf8"));
  const converted = JSON.parse(readFileSync(ourPath, "utf8"));
  const doc = converted.doc ?? converted;

  const rows = pairUp(source, doc);
  if (rows.length === 0) {
    console.error("no usage pairs found in the source — is it a --mode=document extraction?");
    process.exit(1);
  }

  const meta = {
    source_file: source.source_file ?? basename(sourcePath),
    contract: converted.contract,
    model: converted.model,
  };

  const name = basename(ourPath).replace(/\.lawpass\.json$/, "").replace(/\.json$/, "");
  const out = join(outDir ?? dirname(ourPath), `${name}.comparison.internal.html`);
  if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(out, render(rows, source, doc, meta), "utf8");

  const paired = rows.filter((r) => r.ours);
  const avg = paired.length
    ? paired.reduce((a, r) => a + overlap(r.source_why, r.ours.reason).pct, 0) / paired.length
    : 0;
  const worst = paired.length
    ? Math.max(...paired.map((r) => longestSharedRun(r.source_why, r.ours.reason).length))
    : 0;

  console.log(`${rows.length} fact(s), ${paired.length} paired`);
  console.log(`average word overlap: ${avg.toFixed(1)}%`);
  console.log(`longest shared run:   ${worst} word(s)`);
  console.log(`\nwrote ${out}`);
  console.log("INTERNAL — this file embeds the source text. Do not publish or commit it.");
}

export { pairUp, overlap, longestSharedRun };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
