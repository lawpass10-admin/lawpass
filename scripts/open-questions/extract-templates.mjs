// extract-templates.mjs — turn "שלדי כתיבה משפטית" into the JSON that
// load-templates.mjs puts into public.open_question_templates.
//
//   node scripts/open-questions/extract-templates.mjs --pdf="<path to the pdf>"
//   node scripts/open-questions/extract-templates.mjs --pdf=... -o templates.json
//
// THE DOCUMENT. A cover page, a two-column table of contents, then 36 templates
// in 10 parts. Each template is a numbered heading followed by an optional lead
// line and a skeleton with ] [ blanks.
//
// THE TWO THINGS THAT MAKE IT TRICKY.
//
//  1. THE NUMBER IS GLUED TO THE TITLE. The heading extracts as "1כתב תביעה",
//     not "1. כתב תביעה", because the number sits in its own layout box. So the
//     split is on the expected number rather than on punctuation, and the walk
//     is 1, 2, 3… — which also stops a stray number inside a skeleton from
//     opening a template.
//
//  2. "חלק" MEANS TWO DIFFERENT THINGS, told apart only by the dash. A PART
//     heading is "חלק ב' – דיני עבודה" with an EN dash. A section heading
//     INSIDE a template is "חלק א' — כותרת )תקנה 10(" with an EM dash. Reading
//     both as parts files every template under whatever section heading came
//     last; reading neither leaves all 36 in part א'. The part headings also
//     sit BETWEEN two templates — inside the chunk the walk skips over — so
//     they are pulled out of the chunk rather than looked for at the top level.
//
// Extraction is delegated to Python + PyMuPDF, as the מהותי and דיוני
// extractors do. The subprocess prints one JSON document; nothing else.

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const outIdx = argv.indexOf("-o");
const outPath = resolve(outIdx !== -1 ? argv[outIdx + 1] : join(here, "templates.json"));
const pdf = flagOf("pdf");

if (!pdf) {
  console.error('usage: node scripts/open-questions/extract-templates.mjs --pdf="<file.pdf>" [-o out.json]');
  process.exit(1);
}
if (!existsSync(resolve(pdf))) {
  console.error(`not found — ${resolve(pdf)}`);
  process.exit(1);
}

const PY = String.raw`
# -*- coding: utf-8 -*-
import fitz, re, json, sys

MIRROR = {'(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<'}
LTR_RUN = re.compile(r"[0-9A-Za-z]+(?:[./:,'’\-–%][0-9A-Za-z]+)*")

# A PART heading uses an EN dash; a section heading inside a template uses an EM
# dash. That is the only thing telling them apart.
PART_RE = re.compile("^חלק [א-י]['׳]\s*–\s*(.+)$")
# "1כתב תביעה" glued, or "1 כתב תביעה" once the space reconstruction puts the
# gap back. Both are the same heading.
NUM_TITLE_RE = re.compile(r'^(\d{1,2})\s*([א-ת].*)$')


def visual_to_logical(vis):
    s = ''.join(MIRROR.get(c, c) for c in vis[::-1])
    out, last = [], 0
    for m in LTR_RUN.finditer(s):
        out.append(s[last:m.start()])
        out.append(m.group(0)[::-1])
        last = m.end()
    out.append(s[last:])
    return ''.join(out)


def page_lines(page):
    chars = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for sp in l["spans"]:
                for ch in sp["chars"]:
                    c = ch["c"]
                    if c == ' ':
                        c = ' '
                    if c == '­' or not c:
                        continue
                    x0, y0, x1, y1 = ch["bbox"]
                    chars.append(((y0 + y1) / 2, x0, x1, c))
    if not chars:
        return []
    chars.sort(key=lambda t: (round(t[0], 1), t[1]))
    rows, cur, cury = [], [], None
    for y, x0, x1, c in chars:
        if cury is None:
            cury = y
        if abs(y - cury) <= 3.5:
            cur.append((x0, x1, c))
        else:
            rows.append(cur)
            cur, cury = [(x0, x1, c)], y
    rows.append(cur)
    out = []
    for cur in rows:
        cur.sort()
        glyphs, prev = [], None
        for x0, x1, c in cur:
            if (prev is not None and c != ' ' and glyphs and glyphs[-1] != ' '
                    and (x0 - prev) > (x1 - x0) * 0.25):
                glyphs.append(' ')
            glyphs.append(c)
            prev = x1
        t = visual_to_logical(''.join(glyphs)).strip()
        if t:
            out.append(t)
    return out


doc = fitz.open(sys.argv[1])
pages = [page_lines(p) for p in doc]
# page 1 is the cover, page 2 the table of contents
body = [ln for p in pages[2:] for ln in p]

templates = []
part = None
i = 0
expected = 1
while i < len(body):
    if PART_RE.match(body[i]):
        part = body[i].strip()
        i += 1
        continue
    m = NUM_TITLE_RE.match(body[i])
    if m and int(m.group(1)) == expected:
        title = m.group(2).strip()
        j = i + 1
        while j < len(body):
            m2 = NUM_TITLE_RE.match(body[j])
            if m2 and int(m2.group(1)) == expected + 1:
                break
            j += 1
        # A part heading sits between two templates, inside the chunk about to
        # be skipped. Pull it out here or every template after the first part
        # keeps the first part's name.
        chunk, next_part = [], None
        for x in body[i + 1:j]:
            if PART_RE.match(x):
                next_part = x.strip()
            else:
                chunk.append(x)
        templates.append({
            'number': expected,
            'part': part,
            'title': title,
            'lines': chunk,
        })
        if next_part:
            part = next_part
        expected += 1
        i = j
        continue
    i += 1

sys.stdout.buffer.write(json.dumps(templates, ensure_ascii=False).encode('utf-8'))
`;

const templates = JSON.parse(
  execFileSync("python", ["-c", PY, resolve(pdf)], { maxBuffer: 32 * 1024 * 1024 }).toString("utf8")
);

// The lead under a title is a scope/authority note — prose ABOUT the template,
// not part of the skeleton. Where the document has one it can wrap over several
// lines, so the summary is every leading line up to the first line that starts
// the skeleton proper: a section heading ("חלק א' — כותרת )תקנה 10("), a
// lettered item ("א.") or a numbered one ("1."). Taking only the first line cut
// template 1's note in half and left the rest heading its body.
// A blank to fill is written ]like this[ — the brackets come out mirrored
// because the line is RTL. Any line carrying one is skeleton, never prose, and
// that is what stops the summary from swallowing a template's heading block
// ("בבית המשפט ]השלום/המחוזי[…") when the skeleton opens with it instead of
// with a lettered section.
const startsBody = (line) =>
  /[[\]]/.test(line ?? "") ||
  /^חלק [א-י]['׳]\s*—/.test(line ?? "") ||
  /^([א-ת][.)]|\d+\s*\.)/.test(line ?? "");

const rows = templates.map((t) => {
  const lines = t.lines ?? [];
  let lead = 0;
  while (lead < lines.length && !startsBody(lines[lead])) lead++;
  const summary = lead > 0 ? lines.slice(0, lead).join(" ").trim() : "";
  // A real lead note is a sentence about the template. Template 36 opens with a
  // bare heading word before its first blank, which is skeleton, not prose — so
  // anything too short to be a sentence goes back where it came from.
  const isNote = summary.length >= 40;
  return {
    number: t.number,
    part: t.part,
    title: t.title,
    summary: isNote ? summary : null,
    body: (isNote ? lines.slice(lead) : lines).join("\n").trim(),
    is_generic: /^תבנית כללית/.test(t.title),
  };
});

const problems = [];
if (rows.length !== 36) problems.push(`${rows.length} templates, expected 36`);
rows.forEach((r, i) => {
  if (r.number !== i + 1) problems.push(`#${i + 1}: numbered ${r.number}`);
  if (!r.part) problems.push(`#${r.number}: no part`);
  if (!r.title) problems.push(`#${r.number}: no title`);
  if (r.body.length < 40) problems.push(`#${r.number}: body is ${r.body.length} chars`);
});

const byPart = new Map();
for (const r of rows) byPart.set(r.part, [...(byPart.get(r.part) ?? []), r.number]);
for (const [p, ns] of byPart) console.log(`  ${String(ns.length).padStart(2)}  ${p}  ${ns[0]}-${ns[ns.length - 1]}`);
console.log(`\n${rows.length} template(s), ${rows.filter((r) => r.is_generic).length} generic`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

writeFileSync(
  outPath,
  JSON.stringify(
    {
      _readme: [
        'Legal-writing skeletons from "שלדי כתיבה משפטית", 36 templates in 10 parts.',
        "Loaded into public.open_question_templates by scripts/open-questions/load-templates.mjs,",
        "which also holds the template -> subject mapping.",
        "Regenerate with scripts/open-questions/extract-templates.mjs --pdf=...",
      ],
      source_pdf: resolve(pdf).split(/[\\/]/).pop(),
      templates: rows,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`written to ${outPath}`);
