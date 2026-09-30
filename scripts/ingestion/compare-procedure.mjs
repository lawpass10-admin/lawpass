// compare-procedure.mjs — the source booklet and LawPass's guide, side by side.
//
//   node scripts/ingestion/compare-procedure.mjs <source.json> <out.lawpass.json> --out=<dir>
//   node scripts/ingestion/compare-procedure.mjs --row=<study_material_id> --out=<dir>
//
// THE SIBLING OF compare-conversion.mjs, and it exists because that one cannot
// do this. It lines the two documents up ROW BY ROW on the fact pair, which
// survives a usage_guide conversion unchanged and so makes a join possible. A
// procedure guide has no such key: its requirements were stripped out of 888
// paragraphs, and no paragraph maps onto one rule. So this compares the two
// DOCUMENTS instead — what the booklet says beside what LawPass wrote — and
// marks every run of six words the two share, which is the thing actually worth
// looking at.
//
// INTERNAL ONLY. This file embeds the SOURCE text: the copyrighted expression
// the whole pipeline exists to keep out of published output. It is a review
// artefact for the operator's own machine. Do not ship it, do not put it behind
// the app, do not commit it. The banner at the top of the page says so, and the
// filename ends in .internal.html to make an accident less likely.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(here, "..", "..", ".env.local") });
dotenv.config({ path: join(here, "..", "..", ".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const outDir = flagOf("out");
const rowId = flagOf("row");
const inputs = argv.filter((a) => !a.startsWith("--"));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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
 * How much of the source's vocabulary reappears in ours.
 *
 * Deliberately generous — exact matches only, no stemming, so Hebrew morphology
 * makes the true overlap lower than this reads. A generous measure that still
 * comes out low is worth more than a strict one that flatters the result.
 */
function overlap(sourceText, ourText) {
  const a = new Set(contentWords(sourceText));
  const b = new Set(contentWords(ourText));
  if (a.size === 0) return 0;
  return (100 * [...a].filter((w) => b.has(w)).length) / a.size;
}

/** Every run of `n` consecutive content words the two texts share. */
function sharedRuns(sourceText, ourText, n = 6) {
  const a = contentWords(sourceText);
  const b = contentWords(ourText).join(" ");
  const found = new Set();
  for (let i = 0; i + n <= a.length; i++) {
    const run = a.slice(i, i + n).join(" ");
    if (b.includes(run)) found.add(run);
  }
  return [...found];
}

/** The longest run of consecutive words the two share — the phrasing test. */
function longestSharedRun(sourceText, ourText) {
  const a = contentWords(sourceText);
  const b = contentWords(ourText).join(" ");
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let n = best + 1; i + n <= a.length; n++) {
      if (b.includes(a.slice(i, i + n).join(" "))) best = n;
      else break;
    }
  }
  return best;
}

// ------------------------------------------------------------------ html

function render(source, doc, meta, contract) {
  const srcText = (source.sections ?? [])
    .flatMap((s) => [s.heading, ...(s.paragraphs ?? [])])
    .filter(Boolean)
    .join("\n");

  const ourParts = [];
  for (const stage of doc.stages ?? []) {
    ourParts.push(stage.heading ?? "", stage.why_this_stage ?? "");
    for (const rule of stage.rules ?? []) ourParts.push(rule.do ?? "", rule.pitfall ?? "");
  }
  const ourText = ourParts.join("\n");

  const boiler = (contract?.legal_boilerplate?.phrases ?? []).map((b) =>
    contentWords(b.phrase).join(" ")
  );
  const findings = sharedRuns(srcText, ourText).map((run) => ({
    run,
    boilerplate: boiler.some((f) => f.includes(run)),
  }));
  const real = findings.filter((f) => !f.boilerplate).length;

  // Marking happens on the ESCAPED text. That is safe because a run is a
  // sequence of content words with the punctuation already stripped, so
  // escaping cannot have altered it.
  const mark = (text) => {
    let html = esc(text);
    for (const f of findings) {
      const needle = esc(f.run);
      if (html.includes(needle)) {
        html = html
          .split(needle)
          .join(`<mark class="${f.boilerplate ? "boiler" : "shared"}">${needle}</mark>`);
      }
    }
    return html;
  };

  const rules = (doc.stages ?? []).reduce((n, s) => n + (s.rules ?? []).length, 0);
  const pct = overlap(srcText, ourText);
  const longest = longestSharedRun(srcText, ourText);

  const ourHtml = (doc.stages ?? [])
    .map(
      (stage, i) => `<section>
  <h3>${i + 1}. ${esc(stage.heading)}</h3>
  <p class="why">${mark(stage.why_this_stage)}</p>
  ${(stage.rules ?? [])
    .map(
      (rule) => `<div class="rule">
    <div class="req">${esc(rule.requirement)}</div>
    <p>${mark(rule.do)}</p>
    ${rule.pitfall ? `<p class="pit">${mark(rule.pitfall)}</p>` : ""}
  </div>`
    )
    .join("")}
</section>`
    )
    .join("");

  const srcHtml = (source.sections ?? [])
    .map(
      (s) => `<section>
  ${s.heading ? `<h3>${mark(s.heading)}</h3>` : ""}
  ${(s.paragraphs ?? []).map((t) => `<p>${mark(t)}</p>`).join("")}
</section>`
    )
    .join("");

  return `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<title>השוואה — ${esc(meta.source_file)}</title>
<style>
  :root { color-scheme: light; --line:#ddd; --ink:#1a1a1a; --dim:#666; }
  body { font-family:"Segoe UI",Arial,sans-serif; margin:0; padding:16px; color:var(--ink); line-height:1.7; }
  .warn { background:#b42318; color:#fff; padding:10px 14px; border-radius:8px; font-weight:700; margin-bottom:14px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { color:var(--dim); font-size:13px; margin-bottom:14px; }
  .stats { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
  .stat { border:1px solid var(--line); border-radius:10px; padding:8px 14px; font-size:13px; text-align:center; }
  .stat b { display:block; font-size:22px; }
  .good b { color:#067647; } .bad b { color:#b42318; }
  .split { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
  @media (max-width:980px){ .split{ grid-template-columns:1fr; } }
  .pane { border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .pane > header { padding:8px 14px; border-bottom:1px solid var(--line); background:#00000008; font-weight:700; font-size:14px; }
  .pane .body { max-height:78vh; overflow:auto; padding:12px 16px; }
  section { margin-bottom:18px; }
  h3 { font-size:15px; margin:0 0 6px; }
  p { margin:0 0 8px; font-size:14.5px; }
  .why { color:var(--dim); font-size:13.5px; }
  .rule { border-inline-start:3px solid var(--line); padding-inline-start:10px; margin:0 0 10px; }
  .req { font-weight:700; font-size:14px; }
  .pit { color:var(--dim); font-size:13.5px; }
  mark.shared { background:#ffe08a; }
  mark.boiler { background:#d7ebff; }
  footer { margin-top:16px; color:var(--dim); font-size:12.5px; }
</style>
<div class="warn">פנימי בלבד — הדף מכיל את טקסט המקור המוגן. לא לפרסום, לא להעלאה, לא ל-git.</div>
<h1>השוואה: המקור מול הגרסה של LawPass</h1>
<div class="meta">${esc(meta.source_file)} · ${esc(meta.contract ?? "")} · ${esc(meta.model ?? "")}</div>

<div class="stats">
  <div class="stat"><b>${(source.sections ?? []).length}</b>מקטעים במקור</div>
  <div class="stat"><b>${(doc.stages ?? []).length}</b>שלבים אצלנו</div>
  <div class="stat"><b>${rules}</b>כללים</div>
  <div class="stat ${pct < 30 ? "good" : "bad"}"><b>${pct.toFixed(0)}%</b>חפיפת אוצר מילים</div>
  <div class="stat ${longest < 6 ? "good" : "bad"}"><b>${longest}</b>הרצף המשותף הארוך</div>
  <div class="stat ${real === 0 ? "good" : "bad"}"><b>${real}</b>רצפי 6+ שאינם בויילרפלייט</div>
</div>

<div class="split">
  <div class="pane"><header>הגרסה של LawPass — מה שמתפרסם</header><div class="body">${ourHtml}</div></div>
  <div class="pane"><header>המקור — לבדיקה בלבד</header><div class="body">${srcHtml}</div></div>
</div>

<footer>
  צהוב = רצף של שש מילות תוכן ומעלה המשותף לשני הצדדים. כחול = ניסוח משפטי קבוע שהחוזה מתיר (legal_boilerplate).
  חפיפת אוצר מילים נמדדת על מילות תוכן בלבד, בהתאמה מדויקת וללא נטיות — המדד נדיב, והחפיפה האמיתית נמוכה ממנו.
</footer>
</html>
`;
}

// ------------------------------------------------------------------ main

async function readRow(id) {
  const pg = (await import("pg")).default;
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("neither DIRECT_URL nor DATABASE_URL is set");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const found = await client.query(
      "SELECT paper_id, original_text, lawpass_text FROM public.study_material WHERE study_material_id = $1",
      [id]
    );
    if (found.rowCount === 0) throw new Error(`no study_material row ${id}`);
    return found.rows[0];
  } finally {
    await client.end();
  }
}

async function main() {
  if ((inputs.length < 2 && !rowId) || argv.includes("--help")) {
    console.log(
      "usage: node scripts/ingestion/compare-procedure.mjs <source.json> <out.lawpass.json> --out=<dir>\n" +
        "       node scripts/ingestion/compare-procedure.mjs --row=<study_material_id> --out=<dir>\n\n" +
        "Writes <name>.comparison.internal.html — the two documents side by side,\n" +
        "with shared 6-word runs marked. INTERNAL: it embeds the source text."
    );
    process.exit(rowId || inputs.length >= 2 ? 0 : 2);
  }

  let source;
  let converted;
  let name;

  if (rowId) {
    const row = await readRow(rowId);
    source = row.original_text;
    converted = row.lawpass_text;
    name = row.paper_id;
    if (!converted) {
      console.error(`row ${rowId} has no lawpass_text yet — nothing to compare against.`);
      process.exit(1);
    }
  } else {
    source = JSON.parse(readFileSync(resolve(inputs[0]), "utf8"));
    converted = JSON.parse(readFileSync(resolve(inputs[1]), "utf8"));
    name = basename(inputs[1]).replace(/\.lawpass\.json$/, "").replace(/\.json$/, "");
  }

  const doc = converted.doc ?? converted;
  if (!Array.isArray(doc.stages)) {
    console.error(
      "this document has no stages — it is not a procedure guide.\n" +
        "For a usage guide use compare-conversion.mjs, which joins on the fact pair."
    );
    process.exit(1);
  }

  let contract = null;
  try {
    contract = JSON.parse(readFileSync(join(here, "LLM-text-converting.json"), "utf8"));
  } catch {
    // The boilerplate legend is a nicety; the page is correct without it.
  }

  const meta = {
    source_file: source.source_file ?? name,
    contract: converted.contract,
    model: converted.model,
  };

  const dir = outDir ?? join(here, "tmp");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = join(dir, `${name}.comparison.internal.html`);
  writeFileSync(out, render(source, doc, meta, contract), "utf8");

  console.log(`wrote ${out}`);
  console.log("INTERNAL ONLY — this file embeds the source text. Do not commit or publish it.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
