// Build a standalone HTML page for eyeballing a study_material row's OCR.
//
//   node scripts/inspect-study-material.mjs <study_material_id> [--out path.html]
//   node scripts/inspect-study-material.mjs <id> --field lawpass_text
//
// WHAT THIS IS FOR. `original_text` is Google Vision's reading of a scanned
// book — 100+ pages of Hebrew legal text that nobody has looked at since it
// was ingested. The warnings stored on the row say it plainly: "scattered
// single-letter errors are expected (כ/ב, ז/ו)". The only way to trust a
// passage is to read it, and reading 200KB of JSON in a database client is
// not reading.
//
// So the page is built around the two questions an inspection actually asks:
// WHERE is the OCR least sure of itself, and WHAT does the text say there.
// Sections carry their confidence as a colour, the threshold is adjustable,
// and search filters paragraphs in place.
//
// SELF-CONTAINED OUTPUT: one file, no network, no build step. It opens from
// the filesystem, which is the point — it is a throwaway you can keep open in
// a tab beside the PDF.
//
// The output is NOT committed; see the .gitignore entry for study-material-*.html.
// It is a copy of licensed book content, and it belongs on your disk only.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const pg = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith("--"));
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

if (!id) {
  console.error(
    "usage: node scripts/inspect-study-material.mjs <study_material_id> [--out file.html] [--field original_text|lawpass_text]"
  );
  process.exit(2);
}

const field = flag("field", "original_text");
if (field !== "original_text" && field !== "lawpass_text") {
  console.error(`--field must be original_text or lawpass_text (got "${field}")`);
  process.exit(2);
}
const outPath = path.resolve(flag("out", `study-material-${id}.html`));

/* ------------------------------------------------------------------ data */

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
await client.connect();
const { rows } = await client.query(
  `SELECT study_material_id, paper_id, text_field, sort_order, created_at, updated_at,
          ${field} AS doc
     FROM public.study_material
    WHERE study_material_id = $1`,
  [id]
);
await client.end();

if (rows.length === 0) {
  console.error(`No study_material row with study_material_id = ${id}`);
  process.exit(1);
}

const row = rows[0];
const doc = row.doc ?? {};
const sections = Array.isArray(doc.sections) ? doc.sections : [];

if (sections.length === 0) {
  console.error(`Row found, but ${field} has no sections array to render.`);
  process.exit(1);
}

/* --------------------------------------------------------------- helpers */

/** Everything interpolated into the page goes through this. OCR text is not trusted markup. */
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const confidences = sections
  .map((s) => s.ocr_confidence)
  .filter((n) => typeof n === "number");
const mean = confidences.length
  ? confidences.reduce((a, b) => a + b, 0) / confidences.length
  : null;
const paragraphCount = sections.reduce(
  (n, s) => n + (Array.isArray(s.paragraphs) ? s.paragraphs.length : 0),
  0
);

/**
 * Confidence bands. The thresholds are read off this corpus rather than
 * invented: the floor here is 0.895 and the mean 0.967, so "below 0.95" is
 * the bottom of the real distribution and worth a second look — not an
 * absolute statement about OCR quality.
 */
function band(c) {
  if (typeof c !== "number") return "none";
  if (c < 0.93) return "low";
  if (c < 0.96) return "mid";
  return "high";
}

function renderTable(table) {
  const rowsArr = Array.isArray(table) ? table : table?.rows;
  if (!Array.isArray(rowsArr)) {
    return `<pre class="raw">${esc(JSON.stringify(table, null, 2))}</pre>`;
  }
  return `<table class="tbl">${rowsArr
    .map(
      (r) =>
        `<tr>${(Array.isArray(r) ? r : [r])
          .map((cell) => `<td>${esc(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("")}</table>`;
}

const sectionHtml = sections
  .map((s, i) => {
    const c = s.ocr_confidence;
    const pct = typeof c === "number" ? `${(c * 100).toFixed(1)}%` : "—";
    const paragraphs = Array.isArray(s.paragraphs) ? s.paragraphs : [];
    const tables = Array.isArray(s.tables) ? s.tables : [];
    return `
<section class="sec" data-band="${band(c)}" data-conf="${typeof c === "number" ? c : ""}" data-page="${esc(s.page)}" id="p${esc(s.page)}">
  <div class="sec-head">
    <span class="page">עמ׳ ${esc(s.page)}</span>
    <h2>${esc(s.heading) || "<ללא כותרת>"}</h2>
    <span class="conf band-${band(c)}" title="ביטחון OCR לסעיף">${pct}</span>
  </div>
  ${
    paragraphs.length
      ? paragraphs.map((p) => `<p class="para">${esc(p)}</p>`).join("")
      : `<p class="empty">— אין פסקאות בסעיף הזה —</p>`
  }
  ${tables.map(renderTable).join("")}
  <div class="sec-foot">סעיף ${i + 1} מתוך ${sections.length} · ${paragraphs.length} פסקאות</div>
</section>`;
  })
  .join("\n");

const warnings = Array.isArray(doc.warnings) ? doc.warnings : [];
const excluded = Array.isArray(doc.pages_excluded) ? doc.pages_excluded : [];
const gaps = Array.isArray(doc.pages_with_gaps) ? doc.pages_with_gaps : [];

const metaRows = [
  ["source_file", doc.source_file],
  ["paper_id", row.paper_id],
  ["text_field", row.text_field],
  ["study_material_id", row.study_material_id],
  ["sort_order", row.sort_order],
  ["שדה שמוצג", field],
  ["שפה", doc.language],
  ["עמודים בקובץ", doc.page_count],
  ["עמודים שנטענו", doc.pages_loaded],
  ["סעיפים", doc.section_count ?? sections.length],
  ["פסקאות", paragraphCount],
  ["מנוע OCR", doc.ocr?.engine],
  ["DPI", doc.ocr?.dpi],
  ["נקרא בתאריך", doc.ocr?.read_at],
  ["בלוקים שהושמטו", doc.ocr?.dropped_blocks],
  ["ביטחון ממוצע", mean === null ? "—" : `${(mean * 100).toFixed(1)}%`],
  [
    "טווח ביטחון",
    confidences.length
      ? `${(Math.min(...confidences) * 100).toFixed(1)}% – ${(Math.max(...confidences) * 100).toFixed(1)}%`
      : "—",
  ],
  ["עמודים שהוחרגו", excluded.length ? excluded.join(", ") : "—"],
  ["עמודים עם פערים", gaps.length ? gaps.join(", ") : "—"],
  ["עודכן", row.updated_at?.toISOString?.() ?? String(row.updated_at ?? "")],
]
  .filter(([, v]) => v !== undefined && v !== null && v !== "")
  .map(
    ([k, v]) =>
      `<div class="kv"><dt>${esc(k)}</dt><dd dir="auto">${esc(v)}</dd></div>`
  )
  .join("");

/* ----------------------------------------------------------------- page */

const html = `<!doctype html>
<html lang="he" dir="rtl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>בדיקת OCR — ${esc(row.paper_id)}</title>
<style>
  :root {
    --navy: #1E3A8A; --ink: #16233f; --dim: #5b6680; --line: #e3e7ef;
    --bg: #f6f7fb; --card: #fff; --gold: #C9A149;
    --low: #d14343; --mid: #b4761a; --high: #2f8a4f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.75 "Segoe UI", Arial, sans-serif;
  }
  header.top {
    position: sticky; top: 0; z-index: 10; background: var(--navy); color: #fff;
    padding: 14px 20px; box-shadow: 0 2px 12px rgba(0,0,0,.18);
  }
  header.top h1 { margin: 0 0 6px; font-size: 18px; font-weight: 700; }
  header.top .sub { font-size: 13px; opacity: .8; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 20px; }
  .panel {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 16px; margin-bottom: 16px;
  }
  .panel h3 { margin: 0 0 10px; font-size: 14px; color: var(--navy); }
  dl.meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 6px 18px; margin: 0; }
  .kv { display: flex; gap: 8px; font-size: 13px; border-bottom: 1px dotted var(--line); padding: 3px 0; }
  .kv dt { color: var(--dim); min-width: 118px; }
  .kv dd { margin: 0; font-weight: 600; word-break: break-word; }
  ul.warn { margin: 0; padding-inline-start: 20px; }
  ul.warn li { font-size: 13.5px; color: #8a4b12; margin-bottom: 4px; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 13px; }
  .tools input[type=search] { flex: 1; min-width: 220px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; font: inherit; }
  .tools label { display: inline-flex; align-items: center; gap: 6px; }
  .count { color: var(--dim); }
  .sec { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; }
  .sec[data-band=low]  { border-inline-start: 4px solid var(--low); }
  .sec[data-band=mid]  { border-inline-start: 4px solid var(--mid); }
  .sec[data-band=high] { border-inline-start: 4px solid var(--high); }
  .sec-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
  .sec-head h2 { margin: 0; font-size: 15px; color: var(--navy); flex: 1; }
  .page { font-size: 12px; font-weight: 700; color: #fff; background: var(--navy); border-radius: 6px; padding: 2px 8px; }
  .conf { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .band-low { color: var(--low); } .band-mid { color: var(--mid); } .band-high { color: var(--high); }
  .para { margin: 0 0 9px; white-space: pre-wrap; }
  .para mark { background: #ffe9a8; }
  .empty { color: var(--dim); font-style: italic; }
  .sec-foot { margin-top: 8px; font-size: 11.5px; color: var(--dim); border-top: 1px dotted var(--line); padding-top: 6px; }
  .tbl { border-collapse: collapse; margin: 8px 0; font-size: 14px; }
  .tbl td { border: 1px solid var(--line); padding: 4px 8px; }
  pre.raw { background: #f0f2f7; padding: 8px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  .hidden { display: none !important; }
</style>

<header class="top">
  <h1>בדיקה ויזואלית — ${esc(row.paper_id)}</h1>
  <div class="sub">${esc(field)} · ${sections.length} סעיפים · ${paragraphCount} פסקאות · ביטחון ממוצע ${mean === null ? "—" : (mean * 100).toFixed(1) + "%"}</div>
</header>

<div class="wrap">
  <div class="panel">
    <h3>פרטי המקור</h3>
    <dl class="meta">${metaRows}</dl>
  </div>

  ${
    warnings.length
      ? `<div class="panel" style="border-color:#e8c88a;background:#fffaf0">
           <h3 style="color:#8a4b12">אזהרות מהטעינה (${warnings.length})</h3>
           <ul class="warn">${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
         </div>`
      : ""
  }

  <div class="panel tools">
    <input type="search" id="q" placeholder="חיפוש בטקסט… (מסנן פסקאות)" autocomplete="off">
    <label><input type="checkbox" id="onlyLow"> רק ביטחון נמוך</label>
    <label>סף: <input type="range" id="thr" min="90" max="99" value="95" style="vertical-align:middle"> <span id="thrVal">95%</span></label>
    <span class="count" id="count"></span>
  </div>

  <main id="sections">
${sectionHtml}
  </main>
</div>

<script>
  // Plain DOM filtering — the whole document is already in the page, so a
  // search is a class toggle rather than a re-render. 100 sections and ~2,600
  // paragraphs is small enough that this stays instant.
  const secs = [...document.querySelectorAll('.sec')];
  const q = document.getElementById('q');
  const onlyLow = document.getElementById('onlyLow');
  const thr = document.getElementById('thr');
  const thrVal = document.getElementById('thrVal');
  const count = document.getElementById('count');

  function apply() {
    const needle = q.value.trim();
    const limit = Number(thr.value) / 100;
    thrVal.textContent = thr.value + '%';
    let shown = 0;

    for (const sec of secs) {
      const conf = parseFloat(sec.dataset.conf);
      const failsConf = onlyLow.checked && !(conf < limit);
      let matches = true;

      if (needle) {
        matches = false;
        for (const p of sec.querySelectorAll('.para')) {
          const text = p.dataset.raw ?? (p.dataset.raw = p.textContent);
          const at = text.indexOf(needle);
          if (at >= 0) {
            matches = true;
            // Rebuilt from the stored raw text every time, so repeated
            // searches cannot nest <mark> inside the previous result.
            p.innerHTML = '';
            p.append(
              text.slice(0, at),
              Object.assign(document.createElement('mark'), { textContent: needle }),
              text.slice(at + needle.length)
            );
          } else if (p.dataset.raw !== undefined) {
            p.textContent = text;
          }
        }
      } else {
        for (const p of sec.querySelectorAll('.para')) {
          if (p.dataset.raw !== undefined) p.textContent = p.dataset.raw;
        }
      }

      const show = matches && !failsConf;
      sec.classList.toggle('hidden', !show);
      if (show) shown++;
    }
    count.textContent = shown + ' מתוך ' + secs.length + ' סעיפים';
  }

  q.addEventListener('input', apply);
  onlyLow.addEventListener('change', apply);
  thr.addEventListener('input', apply);
  apply();
</script>
</html>`;

fs.writeFileSync(outPath, html, "utf8");

console.log(`study_material_id  ${row.study_material_id}`);
console.log(`paper_id           ${row.paper_id}`);
console.log(`field              ${field}`);
console.log(`sections           ${sections.length}`);
console.log(`paragraphs         ${paragraphCount}`);
console.log(
  `confidence         ${mean === null ? "—" : (mean * 100).toFixed(1) + "% mean"}` +
    (confidences.length
      ? `, ${(Math.min(...confidences) * 100).toFixed(1)}%–${(Math.max(...confidences) * 100).toFixed(1)}% range`
      : "")
);
console.log(`warnings           ${warnings.length}`);
console.log(`\nwrote              ${outPath}`);
console.log(`                   ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB`);
