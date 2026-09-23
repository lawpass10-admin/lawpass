// extract-real-questions.mjs — turn the Bar Association's חלק ג' (דין מהותי)
// papers and their answer keys into the JSON that load-real-questions.mjs
// puts into public.mahoti_real_questions.
//
//   node scripts/mahoti/extract-real-questions.mjs --bank="<מאגר בחינות dir>"
//   node scripts/mahoti/extract-real-questions.mjs --bank=... -o real-questions.json
//
// This is the מהותי twin of scripts/diuni/extract-exam-pdf.mjs, and the same
// reasoning applies: the only way to hold a generator to "a candidate could not
// tell this from a real one" is to have the real ones, written by the lawyers
// who set the paper. Unlike diuni's, this one does every sitting in one run,
// because the bank hands us four of them at once and they share a key format.
//
// THE THREE PDF DEFECTS THIS HANDLES.
//
//  1. נ IS NOT IN THE TEXT LAYER. Every one of these papers maps the letter to
//     a glyph that extracts as something else, and each sitting picked a
//     different one: U+00F0 (ð) in the 2022 papers, U+00AA (ª) in קיץ 2022,
//     U+F8FF (private use) in the 2024 and 2025 ones. Extract naively and every
//     נ silently vanishes. Repaired here, and VERIFIED — a Hebrew legal paper
//     with no נ after the repair is rejected rather than exported.
//
//  2. THE TEXT LAYER IS IN VISUAL ORDER. Runs come back rightmost-first, so a
//     naive read returns each line back to front — readable enough to look
//     fine, wrong enough to poison everything built on it. The PDF positions
//     every glyph, so the line is rebuilt from `rawdict` character boxes sorted
//     left to right and then reversed, which is the logical order exactly.
//     Digits and Latin are the exception: inside an RTL line they are laid out
//     left-to-right, so that reversal turns 28/12/22 into 22/21/82. Each
//     maximal LTR run is flipped back afterwards. Brackets are mirrored for the
//     same reason — a "(" drawn at a position is a ")" in reading order.
//
//  3. THE ANSWER KEY IS A TABLE, NOT A LIST. A citation cell of three lines
//     puts the row's number in the MIDDLE of them, so "the lines between entry
//     N and entry N+1" assigns the last line of one row to the next one — which
//     is how question 8's statute ends up cited for question 9. Row boundaries
//     are therefore read from the table's own drawn rules.
//
// Extraction is delegated to Python + PyMuPDF, which this machine has and Node
// does not — the same arrangement scripts/diuni/extract-exam-pdf.mjs uses. The
// subprocess prints one JSON document; nothing else.

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The sittings the bank holds a חלק ג' paper AND its key for. `paper` is the
// sitting's date, which is what identifies a question together with its number
// — the same convention diuni_real_questions uses.
//
// מועד דצמבר 2025 is deliberately absent: the bank has its paper but not its
// פתרון, and a pooled question without a correct answer is not a question a
// candidate could sit. Add it here once the key turns up.
const SITTINGS = [
  {
    paper: "2022-06-28",
    label: "קיץ 2022",
    exam: "bar_exams_summer_2022_part_3_exam_paper.pdf",
    key: "bar_exams_summer_2022_part_3_solution_and_reference.pdf",
  },
  {
    paper: "2022-12-28",
    label: "חורף 2022",
    exam: "bar_exams_winter_2022_part_3_exam_paper.pdf",
    key: "bar_exams_winter_2022_part_3_solution_and_reference.pdf",
  },
  {
    paper: "2023-06-26",
    label: "קיץ 2023",
    exam: "bar_exams_summer_2023_part_3_exam_paper.pdf",
    key: "bar_exams_summer_2023_part_3_solution_and_reference.pdf",
  },
  {
    paper: "2024-02-12",
    label: "חורף 2023-2024 (גירסה 1)",
    exam: "bar_exams_winter_2023-2024_part_3_ver1_exam_paper.pdf",
    key: "bar_exams_winter_2023-2024_part_3_solution_and_reference_ver1.pdf",
  },
];

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const outIdx = argv.indexOf("-o");
const outPath = resolve(outIdx !== -1 ? argv[outIdx + 1] : join(here, "real-questions.json"));
const bank = flagOf("bank");

if (!bank) {
  console.error('usage: node scripts/mahoti/extract-real-questions.mjs --bank="<מאגר בחינות dir>" [-o out.json]');
  process.exit(1);
}

const PY = String.raw`
# -*- coding: utf-8 -*-
import fitz, re, json, sys

# Each sitting broke נ differently; ­ and the non-breaking space are noise.
FIXMAP = {'ð': 'נ', 'ª': 'נ', '': 'נ',
          ' ': ' ', '­': ''}
MIRROR = {'(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<'}
LTR_RUN = re.compile(r"[0-9A-Za-z]+(?:[./:,'’\-–%][0-9A-Za-z]+)*")
LETTERS = ['א', 'ב', 'ג', 'ד']
HE = 'ה'

# "1." glued to the first word (the 2024/2025 layout) or "1" + two spaces
# (2022/2023). The \s* before the dot is not cosmetic: the space this script
# reconstructs from glyph gaps sometimes lands between the marker and its dot
# ("ג . מכיוון"), and a marker regex that refuses that reads a whole paper as
# having no options at all.
Q_RE = re.compile(r'^(\d{1,2})\s*(?:\.(?=\S)|[.)]?\s{1,})')
OPT_RE = re.compile(r'^([א-ה])(?:\s*[.)]\s*|\s{2,})')
# A line that introduces a passage several following questions share.
INTRO_RE = re.compile(r'^(?:ענו|ענה|קראו|קרא).*שאלות')
END_RE = re.compile(r'^[-–—\s]*בהצלחה[-–—\s]*$')
GROUP_N_RE = re.compile(r'(\d+)\s+ה?שאלות')
DROP_RE = [re.compile(r'^\d+\s*/\s*\d+$'),
           re.compile(r'^לשכת עורכי'),
           re.compile(r'^חלק ג.{0,4}דין מהותי'),
           re.compile(r'^\d+$')]
STEM_RE = re.compile(r'([^.?!\n]*[?:])\s*$')
# A key row: the number, then the answer letter with its geresh. A question the
# Bar struck after the sitting has no letter — some keys print אבגד there and
# some print only נפסלה — and both spellings must still register as a ROW, or
# the number vanishes from the key and the paper looks two questions short for
# a reason the output never states.
ENTRY_RE = re.compile(r"^(\d{1,2})\s*\.?\s*(?:([א-ד])\s*['׳’]"
                      r"|(אבגד|נפסלה|בוטלה))\s*(.*)$")
ANNULLED_RE = re.compile(r'נפסלה|בוטלה')


def visual_to_logical(vis):
    """vis = glyphs in left-to-right screen order -> logical (reading) order."""
    s = ''.join(MIRROR.get(c, c) for c in vis[::-1])
    out, last = [], 0
    for m in LTR_RUN.finditer(s):
        out.append(s[last:m.start()])
        out.append(m.group(0)[::-1])
        last = m.end()
    out.append(s[last:])
    return ''.join(out)


def raw_lines(page):
    """[(y, text, paragraph_gap_before)] for one page, de-mangled, in reading order."""
    chars = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            for sp in l["spans"]:
                for ch in sp["chars"]:
                    c = FIXMAP.get(ch["c"], ch["c"])
                    if not c:
                        continue
                    x0, y0, x1, y1 = ch["bbox"]
                    chars.append(((y0 + y1) / 2, x0, x1, c, y1 - y0))
    if not chars:
        return []
    chars.sort(key=lambda t: (round(t[0], 1), t[1]))
    rows, cur, cury, h = [], [], None, 10.0
    for y, x0, x1, c, ch_h in chars:
        if cury is None:
            cury = y
        if abs(y - cury) <= 3.5:
            cur.append((x0, x1, c))
            h = max(h, ch_h)
        else:
            rows.append((cury, h, cur))
            cur, cury, h = [(x0, x1, c)], y, ch_h
    rows.append((cury, h, cur))

    out, prev_y, prev_h = [], None, None
    for y, hh, cur in rows:
        cur.sort()
        # The stream omits some spaces at run boundaries, which glues words
        # together in the קיץ 2022 key. A gap wider than a quarter of a glyph
        # is one of them, put back from the geometry.
        glyphs, prev_x1 = [], None
        for x0, x1, c in cur:
            if (prev_x1 is not None and c != ' ' and glyphs and glyphs[-1] != ' '
                    and (x0 - prev_x1) > (x1 - x0) * 0.25):
                glyphs.append(' ')
            glyphs.append(c)
            prev_x1 = x1
        txt = visual_to_logical(''.join(glyphs)).strip()
        gap = prev_y is not None and (y - prev_y) > 1.75 * max(prev_h, 8)
        prev_y, prev_h = y, hh
        out.append((y, txt, gap))
    return out


def join(chunks):
    """Join line chunks, keeping a real vertical gap as a paragraph break."""
    s = ''
    for i, (txt, gap) in enumerate(chunks):
        s = txt if i == 0 else s + ('\n' if gap else ' ') + txt
    return re.sub(r'[ \t]{2,}', ' ', s).strip()


def paper_lines(path):
    lines = []
    for page in fitz.open(path):
        for _, txt, gap in raw_lines(page):
            if txt and not any(r.match(txt) for r in DROP_RE):
                lines.append((txt, gap))
    return lines


def parse_questions(lines):
    """Walk the numbers 1, 2, 3... accepting a marker only when what follows
    really is a question: four options, lettered א ב ג ד in order, with no ה
    after them. That test is what separates a question from the four pages of
    front matter in the 2024/2025 papers, which are numbered 1., 2., 3. too and
    whose sub-items are lettered א. through ז."""
    questions, i, expected, pending = [], 0, 1, []
    while i < len(lines):
        m = Q_RE.match(lines[i][0])
        if not m or int(m.group(1)) != expected:
            pending.append(lines[i])
            i += 1
            continue

        start, j = i, i + 1
        while j < len(lines):
            m2 = Q_RE.match(lines[j][0])
            if m2 and int(m2.group(1)) == expected + 1:
                break
            j += 1
        block = lines[start:j]

        idx = {}
        for k, (txt, _) in enumerate(block):
            om = OPT_RE.match(txt)
            if om:
                idx.setdefault(om.group(1), k)
        ok = (all(l in idx for l in LETTERS)
              and idx[LETTERS[0]] < idx[LETTERS[1]] < idx[LETTERS[2]] < idx[LETTERS[3]])
        if ok and HE in idx and idx[HE] > idx[LETTERS[3]]:
            ok = False
        if not ok:
            pending.append(lines[i])
            i += 1
            continue

        # Text trailing option ד already introduces the NEXT question's passage.
        tail = []
        for k in range(idx[LETTERS[3]] + 1, len(block)):
            if INTRO_RE.match(block[k][0]) or END_RE.match(block[k][0]):
                tail = block[k:]
                block = block[:k]
                break
        tail = [t for t in tail if not END_RE.match(t[0])]

        head = block[:idx[LETTERS[0]]]
        head[0] = (Q_RE.sub('', head[0][0], count=1).strip(), head[0][1])
        text = join(head)

        opts = []
        for n, letter in enumerate(LETTERS):
            a = idx[letter]
            b = idx[LETTERS[n + 1]] if n < 3 else len(block)
            chunk = list(block[a:b])
            chunk[0] = (OPT_RE.sub('', chunk[0][0], count=1).strip(), chunk[0][1])
            opts.append({"letter": letter, "text": join(chunk)})

        # The stem is the closing sentence: "?מה הדין" usually, but a knowledge
        # question ends in a colon instead ("...הם:"), and a paper that dropped
        # those would lose real questions over punctuation.
        sm = STEM_RE.search(text)
        stem = sm.group(1).strip() if sm else ''
        facts = text[:sm.start(1)].strip() if sm else text

        questions.append({
            "number": expected,
            "shared_passage": join(pending) if pending and INTRO_RE.match(pending[0][0]) else "",
            "linked_numbers": [],
            "fact_pattern": facts,
            "stem": stem,
            "options": opts,
        })
        pending = list(tail)
        expected += 1
        i = j

    # "קראו את הקטע שלהלן והשיבו על 3 השאלות הבאות (29-31)" — the passage is
    # copied onto every question of the run, and they are told about each other,
    # because one of them alone ("הניחו כי לנתונים שהובאו בשאלה לעיל...") cannot
    # be answered. Collected before any is written: a question that received a
    # copy must not then be read as the start of another group.
    groups = []
    for pos, q in enumerate(questions):
        if q["shared_passage"]:
            m = GROUP_N_RE.search(q["shared_passage"].splitlines()[0])
            groups.append((pos, q["shared_passage"], int(m.group(1)) if m else 1))
    for pos, passage, size in groups:
        grp = questions[pos:pos + size]
        nums = [g["number"] for g in grp]
        # Two kinds of run, and they need opposite treatment.
        #
        # "קראו את הקטע שלהלן..." puts the facts in the passage itself, so every
        # member is answerable from it and copying it is the whole job.
        #
        # "ענו על 2 השאלות הבאות הקשורות זו לזו:" is a bare instruction — the
        # facts are in the FIRST question, and the second opens "הניחו כי
        # לנתונים שהובאו בשאלה לעיל מתווספות העובדות הבאות". Drawn on its own
        # that question refers to a fact pattern the candidate was never shown.
        # So a member of a chained run inherits the facts of the members before
        # it, and the pool holds no question that depends on a neighbour.
        chained = len(passage.splitlines()) == 1 and len(grp) > 1
        for k, g in enumerate(grp):
            g["linked_numbers"] = nums if len(nums) > 1 else []
            if chained and k > 0:
                g["shared_passage"] = '\n'.join(
                    [passage] + [p["fact_pattern"] for p in grp[:k] if p["fact_pattern"]]
                )
            else:
                g["shared_passage"] = passage
    return questions


def parse_key(path):
    """{number: {letter, source}} from a solution_and_reference PDF."""
    key = {}
    for page in fitz.open(path):
        rules = set()
        for dr in page.get_drawings():
            for it in dr["items"]:
                if it[0] == "l" and abs(it[1].y - it[2].y) < 0.6:
                    rules.add(round(it[1].y, 1))
                elif it[0] == "re":
                    rules.add(round(it[1].y0, 1))
                    rules.add(round(it[1].y1, 1))
        rules = sorted(rules)
        # A table border is drawn as two hairlines a fraction apart; collapse them.
        borders = [r for i, r in enumerate(rules) if i == 0 or r - rules[i - 1] > 1.0]

        cells = {}
        for y, t, _ in raw_lines(page):
            if not t:
                continue
            for i in range(len(borders) - 1):
                if borders[i] <= y < borders[i + 1]:
                    cells.setdefault(i, []).append((y, t))
                    break
            # anything outside the rules is the header block above the table

        for band, rows in cells.items():
            rows.sort()
            number = letter = None
            parts = []
            for _, t in rows:
                m = ENTRY_RE.match(t)
                if m and number is None:
                    number, letter = int(m.group(1)), m.group(2)
                    if m.group(4).strip():
                        parts.append(m.group(4).strip())
                else:
                    parts.append(t)
            if number is None:
                continue
            source = re.sub(r'\s+', ' ', ' '.join(parts)).strip()
            # A question the Bar struck after the sitting prints אבגד and
            # (נפסלה) where the letter would be. It keeps its row so the numbers
            # still line up, and is dropped at the merge.
            if ANNULLED_RE.search(source) or letter is None:
                letter = None
                source = ANNULLED_RE.sub('', source).replace('()', '').strip()
            key[number] = {"letter": letter, "source": source}
    return key


sittings = json.loads(sys.argv[1])
out = []
for s in sittings:
    q_lines = paper_lines(s['exam'])
    # The repair check. A Hebrew legal paper without a single נ did not
    # extract — it lost a letter, and everything downstream inherits that
    # silently.
    for label, blob in (('exam', ' '.join(t for t, _ in q_lines)),):
        if 'נ' not in blob:
            sys.stderr.write(s['paper'] + ' ' + label + ': no נ after glyph repair\n')
            sys.exit(3)
    questions = parse_questions(q_lines)
    key = parse_key(s['key'])
    if not any(v['letter'] for v in key.values()):
        sys.stderr.write(s['paper'] + ' key: no answer letters found\n')
        sys.exit(3)
    out.append({'paper': s['paper'], 'label': s['label'],
                'questions': questions,
                'key': {str(k): v for k, v in key.items()}})
sys.stdout.buffer.write(json.dumps(out, ensure_ascii=False).encode('utf-8'))
`;

const jobs = SITTINGS.map((s) => {
  const exam = join(bank, s.exam);
  const key = join(bank, s.key);
  for (const [what, path] of [["paper", exam], ["key", key]]) {
    if (!existsSync(path)) {
      console.error(`${s.paper}: ${what} not found — ${path}`);
      process.exit(1);
    }
  }
  return { paper: s.paper, label: s.label, exam, key };
});

const extracted = JSON.parse(
  execFileSync("python", ["-c", PY, JSON.stringify(jobs)], {
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8")
);

const questions = [];
const papers = [];

for (const sitting of extracted) {
  let annulled = 0;
  let incomplete = 0;
  const kept = [];

  for (const q of sitting.questions) {
    const entry = sitting.key[String(q.number)];
    if (!entry || !entry.letter) {
      annulled++;
      continue;
    }
    if (!q.stem || q.options.length !== 4 || q.options.some((o) => !o.text)) {
      incomplete++;
      continue;
    }
    kept.push({
      paper: sitting.paper,
      number: q.number,
      shared_passage: q.shared_passage || null,
      linked_numbers: q.linked_numbers.length > 0 ? q.linked_numbers : null,
      fact_pattern: q.fact_pattern || null,
      stem: q.stem,
      options: q.options,
      correct_answer: entry.letter,
      source_citation: entry.source || null,
    });
  }

  // No run-level filter: the extractor has already made every member of a run
  // answerable on its own, so an annulled question costs exactly itself.
  questions.push(...kept);
  papers.push({
    paper: sitting.paper,
    label: sitting.label,
    extracted: sitting.questions.length,
    questions: kept.length,
    annulled,
    incomplete,
  });

  console.log(
    `${sitting.paper}  ${sitting.label}\n` +
      `   parsed ${sitting.questions.length}, key ${Object.keys(sitting.key).length}` +
      `, annulled ${annulled}, incomplete ${incomplete}  ->  ${kept.length} usable`
  );
}

writeFileSync(
  outPath,
  JSON.stringify(
    {
      _readme: [
        "Real Bar Association חלק ג' (דין מהותי) questions with their official",
        "answer key, extracted from the lawyer-authored PDFs.",
        "Loaded into public.mahoti_real_questions by scripts/mahoti/load-real-questions.mjs.",
        "Regenerate with scripts/mahoti/extract-real-questions.mjs --bank=...",
        "source_citation is kept as the key prints it, bidi damage and all: it is a",
        "record of the source paper, not a display string.",
      ],
      papers,
      questions,
    },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(`\n${questions.length} question(s) written to ${outPath}`);
