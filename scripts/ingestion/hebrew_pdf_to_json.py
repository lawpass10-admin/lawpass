# -*- coding: utf-8 -*-
"""
Hebrew exam PDF -> JSON, as preparation for an LLM pass.

    python hebrew_pdf_to_json.py <input.pdf> [-o out.json] [--images DIR] [--strict]

WHY THIS EXISTS
---------------
Hebrew PDFs corrupt in ways that are invisible unless you look for them. Every
defect handled here was found in a real Bar Association paper:

  1. Broken ToUnicode tables. In these exam PDFs the letter נ is mapped to U+00F0
     (ð), so a naive extraction yields "שארגðה". Silent, and it poisons every
     downstream use.
  2. Bidi control characters (U+202A..U+202E) wrapped around every RTL run.
  3. Reversed numeric runs. Poppler emitted the case number 678-09-25 as
     25-09-678 because it was stored as separate text objects.
  4. PyMuPDF's raw text is unusable here — it emits spans in stored order, which
     interleaves RTL runs into unreadable word salad. Poppler applies bidi
     correctly, so pdftotext is the extractor and PyMuPDF is used only to render
     page images for human review.
  5. A letter mapped to a glyph poppler DISCARDS. The 2022 winter answer papers
     map נ to U+00AA, which poppler normalises to a space: "תקנה" comes out as
     "תק ה" and the letter is gone beyond recovery. Defect 1 is loud (you see ð);
     this one is silent. Extraction warns when a very common letter is missing
     from the whole document; --glyph-boxes then re-extracts from PyMuPDF word
     boxes, which keep the glyph, and rebuilds reading order geometrically
     (group by line, then right-to-left) instead of trusting either extractor's
     span order.

WHAT IT GUARANTEES vs WHAT IT GUESSES
-------------------------------------
Deterministic and trustworthy: per-page clean text, defect repair, defect report.
Best-effort heuristics: splitting into questions, and separating citations from
quoted source text. Those are marked `needs_review` and are meant as a skeleton
for an LLM (or a human) to confirm — never as finished data.

Output matches the open-questions schema: document / questions / quotes, with
quotes carrying `question_external_id` as a foreign key.
"""

import argparse
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

# ---------------------------------------------------------------- text cleanup

BIDI_CONTROLS = dict.fromkeys(
    [0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
     0x2066, 0x2067, 0x2068, 0x2069],
    None,
)

# Confirmed broken ToUnicode mappings. Add to this only after verifying the
# correct character against a rendered page image.
GLYPH_REPAIRS = {
    "ð": "נ",       # U+00F0 — the letter נ in the Bar Association exam papers
    "ª": "נ",       # U+00AA — the letter נ in the 2022 winter answer papers.
                    # Poppler turns this one into a space, so it survives only
                    # on the --glyph-boxes path (defect 5).
    "": "•",  # U+F0B7 — Symbol-font bullet, from Word-generated documents
}

HEBREW = "֐-׿"
# Characters that legitimately appear besides Hebrew: ASCII, punctuation, dashes.
# Includes the targets of GLYPH_REPAIRS — otherwise a repaired character gets
# re-flagged as suspicious on the very next check.
EXPECTED_EXTRA = set("–—‘’“”…€₪°×•§¶·") | set(GLYPH_REPAIRS.values())


def strip_bidi(text: str) -> str:
    return text.translate(BIDI_CONTROLS)


def repair_glyphs(text: str):
    """
    Apply known repairs; report anything else suspicious rather than hiding it.

    Returns (text, repaired, unknown) as counts per character, so the caller can
    total them across pages — a defect on page 4 matters as much as one on page 1.
    """
    repaired = {}
    for bad, good in GLYPH_REPAIRS.items():
        n = text.count(bad)
        if n:
            text = text.replace(bad, good)
            repaired[bad] = n

    unknown = {}
    for ch in text:
        if ord(ch) > 127 and not re.match(f"[{HEBREW}]", ch) and ch not in EXPECTED_EXTRA:
            unknown[ch] = unknown.get(ch, 0) + 1

    return text, repaired, unknown


# ------------------------------------------------------------------ extraction

def find_pdftotext() -> str:
    """
    Locate poppler's pdftotext.

    It ships with Git for Windows but that directory is only on the PATH inside
    Git Bash — from PowerShell or a VS Code terminal the plain name fails. Look in
    the usual places rather than making the caller type an absolute path.
    """
    override = os.environ.get("PDFTOTEXT")
    if override and Path(override).exists():
        return override

    found = shutil.which("pdftotext")
    if found:
        return found

    candidates = [
        r"C:\Program Files\Git\mingw64\bin\pdftotext.exe",
        r"C:\Program Files (x86)\Git\mingw64\bin\pdftotext.exe",
        r"C:\ProgramData\chocolatey\bin\pdftotext.exe",
        r"C:\Program Files\poppler\bin\pdftotext.exe",
        "/usr/bin/pdftotext",
        "/usr/local/bin/pdftotext",
        "/opt/homebrew/bin/pdftotext",
    ]
    candidates += [str(p) for p in Path("C:/Program Files").glob("poppler*/**/pdftotext.exe")]

    for c in candidates:
        if Path(c).exists():
            return c

    raise RuntimeError(
        "pdftotext (poppler) not found. It is required — it is the only extractor that\n"
        "gets Hebrew bidi right.\n"
        "  Looked on PATH and in:\n    " + "\n    ".join(candidates[:4]) + "\n"
        "  Fix: install poppler, or point the PDFTOTEXT environment variable at the exe:\n"
        '    $env:PDFTOTEXT="C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe"'
    )


def extract_pages(pdf_path: Path):
    """Per-page text via poppler. One subprocess call; pages split on form feed."""
    exe = find_pdftotext()
    with tempfile.TemporaryDirectory() as tmp:
        # pdftotext on Windows cannot open non-ASCII paths — stage an ASCII copy.
        staged = Path(tmp) / "in.pdf"
        shutil.copy(pdf_path, staged)
        out = Path(tmp) / "out.txt"

        result = subprocess.run(
            [exe, "-enc", "UTF-8", str(staged), str(out)],
            capture_output=True, text=True,
        )
        if result.returncode != 0 or not out.exists():
            raise RuntimeError(
                "pdftotext failed — is poppler installed and on PATH?\n"
                + (result.stderr or "")
            )
        raw = out.read_text(encoding="utf-8")

    return [p for p in raw.split("\f")][:-1] or [raw]


def extract_pages_boxes(pdf_path: Path):
    """
    Per-page text rebuilt from PyMuPDF word boxes — the fallback for defect 5.

    Poppler is the better extractor whenever it can see the characters at all;
    this path exists only for fonts whose ToUnicode maps a letter to something
    poppler drops. PyMuPDF keeps that glyph but orders spans as they are stored,
    so the order is rebuilt from geometry instead: group boxes into lines by y,
    then read each line right-to-left.

    The dropped letter also comes back as its OWN word box, so "תקנה" arrives as
    three boxes. They are re-joined by the gap between them — a real word space
    is several times wider than the gap between two glyphs of one word, and the
    split point is taken from the page rather than hard-coded, since it scales
    with the font size.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError(
            "--glyph-boxes needs PyMuPDF (pip install pymupdf)"
        ) from exc


    def lines_of(page, y_tol=3.0):
        lines = []
        words = [w for w in page.get_text("words") if w[4].strip()]
        for w in sorted(words, key=lambda w: (round(w[1], 1), -w[0])):
            y = (w[1] + w[3]) / 2
            if lines and abs(lines[-1][0] - y) <= y_tol:
                lines[-1][1].append(w)
            else:
                lines.append([y, [w]])
        for ln in lines:
            ln[1].sort(key=lambda w: -w[0])  # RTL: rightmost box first
            ln[1] = unreverse_latin(ln[1])
        return [ln[1] for ln in lines]

    def unreverse_latin(ws):
        """
        Put embedded Latin runs back into left-to-right order.

        Sorting a line right-to-left is correct for Hebrew but reverses any Latin
        phrase inside it, turning the respondent's name YAKOV AZAR — which תקנה
        125 requires in Latin letters — into AZAR YAKOV. Only runs containing
        Latin LETTERS are flipped back; digit groups are left alone, since a case
        number's parts are already emitted in their stored order.
        """
        out, run = [], []
        for w in ws:
            if re.search(r"[A-Za-z]", w[4]):
                run.append(w)
            else:
                out += reversed(run)
                run = []
                out.append(w)
        return out + list(reversed(run))

    def gap(a, b):
        """Horizontal space between two boxes, whichever of them is on the left."""
        return max(b[0] - a[2], a[0] - b[2])

    def gap_threshold(lines):
        gaps = [gap(a, b) for ws in lines for a, b in zip(ws, ws[1:])]
        positive = sorted(g for g in gaps if g > 0)
        if not positive:
            return 0.6
        # Word spaces dominate the positive gaps, so their median sits inside the
        # word-space cluster; half of it lands between the two populations.
        return max(0.6, statistics.median(positive) * 0.5)

    pages = []
    for page in fitz.open(pdf_path):
        lines = lines_of(page)
        if not lines:
            pages.append("")
            continue
        thresh = gap_threshold(lines)
        out = []
        for ws in lines:
            buf = ws[0][4]
            for a, b in zip(ws, ws[1:]):
                buf += ("" if gap(a, b) < thresh else " ") + b[4]
            out.append(buf)
        pages.append("\n".join(out))
    return pages


# Among the most frequent letters in written Hebrew. A document of any real
# length containing NONE of one of these did not simply avoid it — its font maps
# that letter to something the extractor discarded (defect 5).
COMMON_LETTERS = "אבהילמנרשת"


def find_dropped_letters(text: str):
    """
    Common Hebrew letters the extractor appears to have dropped.

    Tested by frequency, not by absence. An exam paper sets its trailing
    boilerplate in a second, intact font, so a few survivors of the dropped
    letter reach the output and a plain `ch not in text` check passes a document
    that lost the letter everywhere that matters. Every letter here is common
    enough that its count stays within a small factor of the others; an order of
    magnitude below the median means the font ate it.
    """
    hebrew_chars = sum(1 for ch in text if re.match(f"[{HEBREW}]", ch))
    if hebrew_chars < 400:
        return []  # too short for the frequencies to mean anything

    counts = {ch: text.count(ch) for ch in COMMON_LETTERS}
    median = statistics.median(counts.values())
    if median <= 0:
        return []
    return [ch for ch, n in counts.items() if n < median * 0.1]


def render_page_images(pdf_path: Path, out_dir: Path):
    """Page PNGs for human verification. Optional: only needed to eyeball output."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return ["PyMuPDF not installed — skipped page image rendering"]

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for i, page in enumerate(doc, 1):
        page.get_pixmap(matrix=fitz.Matrix(1.7, 1.7)).save(out_dir / f"page{i:02d}.png")
    return [f"rendered {doc.page_count} page image(s) to {out_dir}"]


# -------------------------------------------------------------- defect probing

# Israeli case numbers run serial-month-year (678-09-25) or serial-year (123-23).
# Digit-only boundaries: \b fails here because Hebrew letters are word characters,
# so "123דרור" would never match despite 123 being a complete number.
CASE_NUMBER_3 = re.compile(r"(?<!\d)(\d{1,6})-(\d{1,2})-(\d{2,6})(?!\d)")
CASE_NUMBER_2 = re.compile(r"(?<!\d)(\d{1,6})-(\d{2,6})(?!\d)")


def find_reversed_numbers(text: str):
    """
    Flag case numbers that bidi appears to have reversed.

    A genuine number ends in a 2-digit year. If the LAST group is long and the
    FIRST is a 2-digit year, the run was very likely flipped — exactly what
    happened to 678-09-25 in the December 2025 paper.
    """
    warnings = []
    seen = set()

    def report(found, suggested):
        if found in seen:
            return
        seen.add(found)
        warnings.append(
            f"case number {found!r} looks reversed by bidi — expected serial-then-year, "
            f"likely {suggested}. VERIFY against the page image."
        )

    for m in CASE_NUMBER_3.finditer(text):
        a, b, c = m.groups()
        if 1 <= int(b) <= 12 and len(a) == 2 and len(c) >= 3:
            report(m.group(0), f"{c}-{b}-{a}")

    for m in CASE_NUMBER_2.finditer(text):
        a, b = m.groups()
        if len(a) == 2 and len(b) >= 3:
            report(m.group(0), f"{b}-{a}")

    return warnings


# ------------------------------------------------------------- segmentation

# Poppler renders "שאלה 1:" as "שאלה :1" (the colon crosses the RTL boundary).
QUESTION_MARKER = re.compile(r"שאלה\s*:?\s*(\d+)\s*:?")

# Where the attached sources begin. Anchoring on a marker is far more reliable
# than hunting for citations, because the fact pattern itself cites case numbers
# (e.g. "ת״א 1234-03-26").
#
# Two layouts seen so far:
#   Bar Association papers close the task with an answer-limit sentence.
#   Other papers use an explicit "המקורות המשפטיים" heading.
#
# Note "המקורות המצורפים" is NOT usable — it appears inside the task instructions
# themselves ("יש לבסס אך ורק על המקורות המצורפים") and would cut in the wrong place.
SOURCES_ANCHORS = [
    re.compile(r"תשובתך\s+מוגבלת[^.]*\."),
    re.compile(r"^[ \t]*ה?מקורות\s+(?:ה)?משפטיים[ \t]*:?[ \t]*$", re.MULTILINE),
]


def find_sources_anchor(text: str):
    """First anchor that matches, so the Bar layout keeps priority."""
    for rx in SOURCES_ANCHORS:
        m = rx.search(text)
        if m:
            return m
    return None

# "מתוך" optionally precedes a statute/regulation heading.
# The leading boundary is essential: without it "תא" matches the tail of פלוגתא
# and "חוק" matches inside החוק, cutting the sources at nonsense positions.
CITATION_START = re.compile(
    r"(?:(?<=^)|(?<=\s))(?:מתוך\s+)?("
    r"חוק\s|תקנות\s|פקודת\s|צו\s|"
    r'ע"א\s|רע"א\s|ת"א\s|תא\s|בג"ץ\s|בג"צ\s|בש"א\s|רע"פ\s|ע"פ\s|ה"פ\s|תמ"ש\s|בר"ע\s|דנ"א\s|ע"ר\s|'
    r'עת"ם\s|עע"ם\s|עמ"נ\s|עת"א\s'
    r")"
)

STATUTE_HEAD = re.compile(r"^(?:מתוך\s+)?(חוק|תקנות|פקודת|צו)\s")
# Hebrew year + Gregorian year closes a statute heading: "התשע\"ט-2018".
STATUTE_YEAR = re.compile(r'\d{4}\s*[-–]?\s*:?|:\s*\d{4}\s*[-–]?')

TASK_START = re.compile(r"(יש ל|עליך ל|עלייך ל|נדרש ל|התבקשת ל)")

# Hebrew gershayim/geresh are used interchangeably with ASCII quotes in these
# papers. Normalise ONLY for matching — 1:1 so string indices still line up with
# the original, which is what gets stored.
PUNCT_FOLD = str.maketrans({"״": '"', "׳": "'", "“": '"', "”": '"'})


def fold(text: str) -> str:
    return text.translate(PUNCT_FOLD)


def split_citation_and_quote(block: str):
    """
    Split a source block into citation + quoted text.

    Splitting on the colon rather than pairing quote marks, because bidi moves the
    opening mark to the wrong side of the colon ('...רוחות השמיים" :כדי') and
    sometimes drops it entirely. The colon survives reliably.
    """
    folded = fold(block)

    # A statute/regulation heading closes with its year, not a colon — and bidi
    # routinely rewrites "התשע\"ט-2018:" as "התשע\"ט:2018-", so the colon is
    # useless here. Split just after the year instead.
    if STATUTE_HEAD.match(folded):
        y = STATUTE_YEAR.search(folded)
        if y:
            citation = block[: y.end()].strip().strip(":-–").strip()
            quote = block[y.end():].strip().strip('"').strip()
            if citation and quote:
                return citation, quote

    # Skip colons inside numbers/times; take the first that separates prose.
    for m in re.finditer(r":", folded):
        i = m.start()
        if i + 1 < len(folded) and folded[i + 1].isdigit():
            continue  # e.g. "התשע\"ט-2018:2018"
        citation = block[:i].strip().strip('"').strip()
        quote = block[i + 1:].strip().strip('"').strip()
        if citation and quote:
            return citation, quote
    return block.strip(), None


def segment(pages, exam_id):
    """Best-effort split into questions and their attached sources."""
    warnings = []
    full = "\n".join(pages)

    # Which page each question starts on, for page_range.
    page_of = {}
    for pno, ptext in enumerate(pages, 1):
        for m in QUESTION_MARKER.finditer(ptext):
            page_of.setdefault(int(m.group(1)), pno)

    marks = list(QUESTION_MARKER.finditer(full))

    # A paper carrying a single question often has no "שאלה N" header at all. If
    # it still has a sources marker it is a question paper, so treat the whole
    # document as question 1 rather than giving up.
    single = None
    if not marks and find_sources_anchor(full):
        warnings.append(
            "no 'שאלה N' header found, but a sources marker is present — treating the "
            "whole document as a single question."
        )
        single = True
    elif not marks:
        warnings.append(
            "no 'שאלה N' markers found — this does not look like an exam question paper "
            "(a model answer or rubric?). The cleaned per-page text in `pages` is still "
            "correct and is the useful output here; `questions`/`quotes` are empty."
        )
        return [], [], warnings, ""

    if single:
        # one synthetic mark covering the whole document
        class _M:
            def __init__(self, t): self._t = t
            def group(self, _): return "1"
            def start(self): return 0
            def end(self): return 0
        marks = [_M(full)]

    lead = full[: marks[0].start()].strip().splitlines()
    global_instructions = next(
        (ln.strip() for ln in lead if "ענו על" in ln or "השאלות שלפניכם" in ln), ""
    )

    questions, quotes = [], []
    for idx, m in enumerate(marks):
        number = int(m.group(1))
        body = full[m.end(): marks[idx + 1].start() if idx + 1 < len(marks) else len(full)]
        external_id = f"{exam_id}-Q{number}"

        # The sources begin after the answer-limit sentence, which may sit
        # mid-line. Anything before it is the scenario + task instructions.
        anchor = find_sources_anchor(fold(body))
        if anchor:
            prose, sources_region = body[: anchor.end()], body[anchor.end():]
        else:
            prose, sources_region = body, ""
            warnings.append(
                f"{external_id}: no sources marker found (neither the answer-limit sentence nor a \"המקורות המשפטיים\" heading) — sources could not be separated"
            )

        prose = prose.strip()
        t = TASK_START.search(prose)
        fact_pattern = prose[: t.start()].strip() if t else prose
        task_instructions = prose[t.start():].strip() if t else ""
        if not task_instructions:
            warnings.append(f"{external_id}: could not locate the task instructions")

        # Cut the sources region at each citation start, wherever it falls.
        flat = " ".join(ln.strip() for ln in sources_region.splitlines() if ln.strip())
        starts = [m.start() for m in CITATION_START.finditer(fold(flat))]
        blocks = [
            flat[s: starts[i + 1] if i + 1 < len(starts) else len(flat)].strip()
            for i, s in enumerate(starts)
        ]

        for n, block in enumerate(blocks, 1):
            citation, quote = split_citation_and_quote(block)
            if not quote:
                warnings.append(
                    f"{external_id}: source {n} has no quoted text — check the split: {citation[:60]!r}"
                )
            kind = "statute" if STATUTE_HEAD.match(fold(citation)) else "case_law"
            quotes.append({
                "id": f"{'L' if kind == 'statute' else 'V'}{n}-Q{number}",
                "question_external_id": external_id,
                "type": kind,
                "citation": citation,
                "text": quote or "",
                "page": page_of.get(number),
                "locked": True,
                "needs_review": True,
            })

        if not blocks:
            warnings.append(f"{external_id}: no attached sources detected")

        questions.append({
            "external_id": external_id,
            "question_number": number,
            "origin": "core",
            "parent_question_id": None,
            "question_type": "open_writing_task",
            "page_range": [page_of.get(number), page_of.get(number + 1, len(pages))],
            "title": "",
            "legal_topics": [],
            "client_role": "",
            "deliverable": "",
            "fact_pattern": fact_pattern,
            "task_instructions": task_instructions,
            "answer_limit": "",
            "timeline": [],
            "needs_review": True,
        })

    return questions, quotes, warnings, global_instructions


# ------------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("-o", "--output", help="output JSON (default: <pdf name>.json beside the PDF)")
    ap.add_argument("--exam-id", help="id prefix for questions, e.g. 2026-S-W (default: derived)")
    ap.add_argument("--images", help="also render page PNGs to this directory for review")
    ap.add_argument("--strict", action="store_true", help="exit non-zero if any warning was raised")
    ap.add_argument(
        "--glyph-boxes",
        action="store_true",
        help="defect 5: rebuild text from PyMuPDF word boxes instead of poppler. "
        "Use when extraction warns that a common Hebrew letter is missing.",
    )
    args = ap.parse_args()

    pdf_path = Path(args.pdf).resolve()
    if not pdf_path.exists():
        sys.exit(f"not found: {pdf_path}")

    method = (
        "PyMuPDF word boxes + geometric RTL reorder + glyph repair (hebrew_pdf_to_json.py --glyph-boxes)"
        if args.glyph_boxes
        else "poppler pdftotext + bidi strip + glyph repair (hebrew_pdf_to_json.py)"
    )
    raw_pages = extract_pages_boxes(pdf_path) if args.glyph_boxes else extract_pages(pdf_path)

    pages, all_warnings = [], []
    repaired_total, unknown_pages = {}, {}
    for pno, raw in enumerate(raw_pages, 1):
        text, repaired, unknown = repair_glyphs(strip_bidi(raw))
        pages.append(text.strip())
        for ch, n in repaired.items():
            repaired_total[ch] = repaired_total.get(ch, 0) + n
        for ch, n in unknown.items():
            entry = unknown_pages.setdefault(ch, {"count": 0, "pages": []})
            entry["count"] += n
            entry["pages"].append(pno)

    for ch, n in sorted(repaired_total.items(), key=lambda kv: -kv[1]):
        all_warnings.append(
            f"repaired {n} occurrence(s) of U+{ord(ch):04X} -> {GLYPH_REPAIRS[ch]!r} "
            f"(broken ToUnicode table in the source font)"
        )
    for ch, info in sorted(unknown_pages.items(), key=lambda kv: -kv[1]["count"]):
        pgs = ", ".join(str(p) for p in info["pages"])
        all_warnings.append(
            f"UNKNOWN suspicious character U+{ord(ch):04X} ({ch!r}) x{info['count']} "
            f"on page(s) {pgs} — check a rendered page; it may be another broken glyph mapping"
        )

    all_warnings += find_reversed_numbers("\n".join(pages))

    dropped = find_dropped_letters("\n".join(pages))
    if dropped:
        all_warnings.append(
            f"DEFECT 5: the letter(s) {' '.join(dropped)} appear NOWHERE in this document. "
            + (
                "That is not a property of Hebrew — the font maps them to something the "
                "extractor discards. Re-run with --glyph-boxes."
                if not args.glyph_boxes
                else "Still missing on the --glyph-boxes path — check a rendered page image; "
                "the glyph may need a new entry in GLYPH_REPAIRS."
            )
        )

    exam_id = args.exam_id or re.sub(r"[^A-Za-z0-9]+", "-", pdf_path.stem)[:24].strip("-")
    questions, quotes, seg_warnings, global_instructions = segment(pages, exam_id)
    all_warnings += seg_warnings

    if args.images:
        all_warnings += render_page_images(pdf_path, Path(args.images))

    payload = {
        "document": {
            "source_file": pdf_path.name,
            "page_count": len(pages),
            "global_instructions": global_instructions,
            "extraction": {
                "method": method,
                "warnings": all_warnings,
                "reviewed": False,
            },
        },
        # The source of truth for a downstream LLM pass. Keep it: the segmentation
        # below is heuristic, this is not.
        "pages": [{"page": i, "text": t} for i, t in enumerate(pages, 1)],
        "questions": questions,
        "quotes": quotes,
    }

    out_path = Path(args.output) if args.output else pdf_path.with_suffix(".json")
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"{len(pages)} pages · {len(questions)} question(s) · {len(quotes)} source(s)")
    print(f"-> {out_path}")
    if all_warnings:
        print(f"\n{len(all_warnings)} note(s):")
        for w in all_warnings:
            print(f"  - {w}")
    print("\nEverything is marked needs_review — confirm the segmentation before ingesting.")

    if args.strict and any(w.startswith(("page", "case number")) or "UNKNOWN" in w for w in all_warnings):
        sys.exit(1)


if __name__ == "__main__":
    main()
