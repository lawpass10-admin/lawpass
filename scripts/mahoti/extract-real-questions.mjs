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
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
    paper: "2020-08-27",
    label: "קיץ 2020",
    exam: "bar_exams_august_2020_part_3_exam_paper.pdf",
    key: "bar_exams_august_2020_part_3_solution_and_reference.pdf",
  },
  {
    paper: "2020-12-23",
    label: "חורף 2020",
    exam: "bar_exams_december_2020_part_3_exam_paper.pdf",
    key: "bar_exams_december_2020_part_3_solution_and_reference.pdf",
  },
  {
    paper: "2021-06-29",
    label: "קיץ 2021",
    exam: "bar_exams_summer_2021_part_3_exam_paper.pdf",
    key: "bar_exams_summer_2021_part_3_solution_and_reference.pdf",
  },
  {
    paper: "2021-12-28",
    label: "חורף 2021",
    exam: "bar_exams_winter_2021_part_3_exam_paper.pdf",
    // Its פתרון is a scan with no text layer, so the key lives in
    // keys-transcribed.json instead. That file records how it was read.
    transcribedKey: true,
  },
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
LEAD_DIGITS = re.compile(r'^(\d{1,4})')
SEP_AFTER_NUM = re.compile(r'^[.)]?\s*')
# The letter may be glued to its text ("א.מכיוון"), spaced from it ("א  לגבות"),
# carry a stray gap before the dot ("ג . מכיוון"), or sit ALONE on its line with
# the text on the next — the קיץ 2020 layout.
OPT_RE = re.compile(r'^([א-ה])(?:\s*[.)]\s*|\s{2,}|\s*$)')
# A line that introduces a passage several following questions share.
INTRO_RE = re.compile(r'^(?:ענו|ענה|קראו|קרא|השיבו|השב).*שאלות')
END_RE = re.compile(r'^[-–—\s]*ב\s*ה\s*צ\s*ל\s*ח\s*ה[!.\s\-–—]*$')
GROUP_N_RE = re.compile(r'(\d+)\s+ה?שאלות')
GROUP_RANGE_RE = re.compile(r'שאלות\s*(\d+)\s*[-–—]\s*(\d+)')
GROUP_WORDS = {'שתי': 2, 'שתיים': 2, 'שלוש': 3, 'שלושה': 3,
               'ארבע': 4, 'ארבעה': 4, 'חמש': 5, 'חמישה': 5}
DROP_RE = [re.compile(r'^\d+\s*/\s*\d+$'),
           # The running header ONLY. Requiring the date word too is what stops
           # it eating a question whose own text opens with the same words.
           re.compile(r'^לשכת עורכי.{0,12}בישראל.*תאריך'),
           re.compile(r'^חלק ג.{0,4}דין מהותי'),
           re.compile(r'^\d+$')]
STEM_RE = re.compile(r'([^.?!\n]*[?:])\s*$')


def group_size(intro):
    """How many questions a group header covers.

      "והשיבו על 2 השאלות הבאות"   -> the digit before שאלות
      "השיבו לשאלות 12-15:"        -> the range after it
      "השיבו על שלוש השאלות הבאות" -> a Hebrew number word
    """
    m = GROUP_RANGE_RE.search(intro)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        if 1 <= abs(b - a) + 1 <= 10:
            return abs(b - a) + 1
    m = GROUP_N_RE.search(intro)
    if m and 1 <= int(m.group(1)) <= 10:
        return int(m.group(1))
    for word, n in GROUP_WORDS.items():
        if word in intro:
            return n
    return 1


def marker(line, expected):
    """Is 'line' the start of question 'expected'? -> the text after the marker.

    Four layouts, all real:

      "28. נגד נדב"  a dot and a space
      "28נגד נדב"    the number glued to the word
      "28."          the number alone, its question starting on the next line
      "628 חברי"     FUSED: question 28 whose own text opens with "6 חברי כנסת"

    The last is not a typo. The number sits at the right edge of an RTL line and
    the sentence's first digit sits beside it, so the two land in one
    left-to-right run and come back as one number. Splitting on 'expected'
    resolves it, and only on 'expected'.
    """
    m = LEAD_DIGITS.match(line)
    if not m:
        return None
    digits, rest = m.group(1), line[m.end():]
    want = str(expected)

    if digits == want:
        # "25.3.2014." is a date and "12.5" a number; neither is a marker.
        if rest[:1] == '.' and rest[1:2].isdigit():
            return None
        tail = SEP_AFTER_NUM.sub('', rest, count=1)
        if tail:
            return tail
        return '' if rest.strip() else None
    if len(digits) > len(want) and digits.endswith(want):
        # marker second: the leading digits are the question's own text
        return (digits[: len(digits) - len(want)] + rest).strip()
    # NO startswith branch. "12.הוראות כלליות" would read as question 1 with the
    # text "2.הוראות…", which is how pages of exam instructions get adopted as
    # question 1. A longer run that merely BEGINS with the number we want is a
    # different number.
    return None


def starts_question(lines, i, expected, unmarked):
    """Does question 'expected' begin at lines[i]? -> its first line's text.

    Normally a numbered marker. But a group header can swallow the first
    question's number — the חורף 2020 paper prints "השיבו לשאלות 12-15:" and
    then question 12 with no marker — so a line directly after such a header
    starts that question too. That fallback applies ONLY to a number with no
    marker anywhere in the paper: without the guard it fires on
    "קראו את הקטע... (6-5):", whose range mentions 5, and swallows the shared
    passage into question 5.

    Used for BOTH finding a question and finding where it ends. Using it for
    only the first is how question 11 came to swallow the rest of a paper.
    """
    text = marker(lines[i][0], expected)
    if text is not None:
        return text
    if i > 0 and expected in unmarked:
        prev = lines[i - 1][0]
        if INTRO_RE.match(prev) and re.search(r'(?<!\d)' + str(expected) + r'(?!\d)', prev):
            return lines[i][0]
    return None
# A key row: the number, then the answer letter with its geresh. A question the
# Bar struck after the sitting has no letter — some keys print אבגד there and
# some print only נפסלה — and both spellings must still register as a ROW, or
# the number vanishes from the key and the paper looks two questions short for
# a reason the output never states.
ENTRY_RE = re.compile(r"^(\d{1,2})\s*\.?\s*(?:([א-ד])\s*['׳’]"
                      r"|(אבגד|נפסלה|בוטלה))\s*(.*)$")
# The קיץ 2021 key prints the letter with no geresh at all — "1 א סעיפים…".
# Tried only as a FALLBACK, because without the geresh a citation opening on a
# lettered section ("4א לחוק…") has the same shape as an entry, and in a key
# that does use the geresh the strict form is the one that means it.
ENTRY_BARE_RE = re.compile(r"^(\d{1,2})\s*\.?\s+([א-ד])(?=\s|$)\s*(.*)$")
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
    force_next = False
    # Numbers that never appear as a marker: only these may be recovered from a
    # group header.
    unmarked = {n for n in range(1, 61)
                if not any(marker(t, n) is not None for t, _ in lines)}
    while i < len(lines):
        head_text = starts_question(lines, i, expected, unmarked)
        if head_text is None and force_next:
            # The previous question's block ended at a fresh א…ד group with no
            # number in front of it — question 31 of the קיץ 2020 paper is
            # printed without one. The block boundary is the evidence; take it.
            head_text = lines[i][0]
        force_next = False
        if head_text is None:
            pending.append(lines[i])
            i += 1
            continue

        start = i
        j = i + 1
        while j < len(lines) and starts_question(lines, j, expected + 1, unmarked) is None:
            j += 1
        if j >= len(lines):
            # The next question's number never made it into the text layer.
            # Fall back to the one after it and let the second-group cut below
            # separate the two. Only as a fallback: used eagerly, a line like
            # "25.3.2014." ends the block two questions early.
            j = i + 1
            while j < len(lines) and starts_question(lines, j, expected + 2, unmarked) is None:
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

        # A second complete א…ד group inside this block is the next question,
        # arriving without a number of its own. Cut there rather than folding it
        # into this question's last option.
        second = None
        for k in range(idx[LETTERS[3]] + 1, len(block)):
            om = OPT_RE.match(block[k][0])
            if om and om.group(1) == LETTERS[0]:
                second = k
                break
        if second is not None:
            head_start = second
            while head_start - 1 > idx[LETTERS[3]] and not OPT_RE.match(block[head_start - 1][0]):
                head_start -= 1
            block = block[:head_start]
            j = start + head_start
            force_next = True

        # Text trailing option ד already introduces the NEXT question's passage.
        tail = []
        for k in range(idx[LETTERS[3]] + 1, len(block)):
            if INTRO_RE.match(block[k][0]) or END_RE.match(block[k][0]):
                # The passage a group header introduces can be printed ABOVE the
                # header, which puts it after this question's last option. Walk
                # back: the option's own wrapped lines run until one ENDS a
                # sentence; whatever follows belongs to the next group. Start
                # after the option's first line OF TEXT — when the marker sits
                # alone ("ד."), that line ends in a full stop and would
                # otherwise read as the end of the option.
                first = idx[LETTERS[3]]
                if not OPT_RE.sub('', block[first][0], count=1).strip():
                    first += 1
                cut = k
                m = first + 1
                while m < k:
                    if block[m - 1][0].rstrip().endswith(('.', '?', '!', ':', '"')):
                        cut = m
                        break
                    m += 1
                tail = block[cut:]
                block = block[:cut]
                break
        tail = [t for t in tail if not END_RE.match(t[0])]

        head = block[:idx[LETTERS[0]]]
        head[0] = (head_text, head[0][1])
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
            # The header is not always the FIRST pending line: when the passage
            # is printed above it, the passage comes first. Any pending line
            # being a header is what makes this a preamble rather than noise.
            "shared_passage": join(pending) if any(INTRO_RE.match(t) for t, _ in pending) else "",
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
            # Size comes from the header line itself, wherever it sits — not
            # from the whole passage, which may quote numbers of its own.
            header = next((ln for ln in q["shared_passage"].splitlines() if INTRO_RE.match(ln)),
                          q["shared_passage"].splitlines()[0])
            groups.append((pos, q["shared_passage"], group_size(header)))
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
                # No geresh anywhere in this row — try the bare spelling.
                parts = []
                for _, t in rows:
                    m = ENTRY_BARE_RE.match(t)
                    if m and number is None:
                        number, letter = int(m.group(1)), m.group(2)
                        if m.group(3).strip():
                            parts.append(m.group(3).strip())
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
    if s.get('key'):
        key = parse_key(s['key'])
        if not any(v['letter'] for v in key.values()):
            sys.stderr.write(s['paper'] + ' key: no answer letters found\n')
            sys.exit(3)
    else:
        key = {}   # transcribed key; merged on the JS side
    out.append({'paper': s['paper'], 'label': s['label'],
                'questions': questions,
                'key': {str(k): v for k, v in key.items()}})
sys.stdout.buffer.write(json.dumps(out, ensure_ascii=False).encode('utf-8'))
`;

const jobs = SITTINGS.map((s) => {
  const exam = join(bank, s.exam);
  const key = s.transcribedKey ? null : join(bank, s.key);
  for (const [what, path] of [["paper", exam], ...(key ? [["key", key]] : [])]) {
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

const TRANSCRIBED = JSON.parse(
  readFileSync(join(here, "keys-transcribed.json"), "utf8")
).papers;

for (const sitting of extracted) {
  // A sitting whose key was transcribed has an empty key from Python; fill it
  // from the JSON so everything downstream sees one shape.
  if (Object.keys(sitting.key).length === 0 && TRANSCRIBED[sitting.paper]) {
    const t = TRANSCRIBED[sitting.paper];
    sitting.key = Object.fromEntries(
      [...t.answers].map((letter, k) => [
        String(k + 1),
        { letter, source: t.citations[String(k + 1)] ?? null },
      ])
    );
  }
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
