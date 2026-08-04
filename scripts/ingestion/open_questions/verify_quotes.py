# -*- coding: utf-8 -*-
"""
Verify every locked quote in an extracted open-questions JSON against the source PDF.

Compares on Hebrew letters + digits only. Punctuation and whitespace are ignored
because the PDF's bidi layer shifts punctuation across RTL/LTR boundaries; a wrong,
missing, or hallucinated WORD still fails, which is what we actually care about.

Usage:
    python verify_quotes.py <questions.json> <source.pdf>

Exit code 0 = every quote verified. Non-zero = at least one mismatch (do not ingest).
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

GLYPH_FIX = {"ð": "נ"}  # broken ToUnicode: ð -> נ
KEEP = re.compile(r"[^א-ת0-9]")  # Hebrew letters + digits only


def normalize(s: str) -> str:
    for bad, good in GLYPH_FIX.items():
        s = s.replace(bad, good)
    return KEEP.sub("", s)


def pdf_pages(path: str) -> dict[int, str]:
    """Page number (1-based) -> normalized text.

    Uses poppler's pdftotext, which applies bidi reordering correctly. PyMuPDF is
    NOT usable here: it emits raw span order, which for this file interleaves RTL
    runs and would fail every comparison for the wrong reason.
    """
    with tempfile.TemporaryDirectory() as tmp:
        # pdftotext on Windows can't open non-ASCII paths — stage an ASCII copy
        staged = Path(tmp) / "in.pdf"
        shutil.copy(path, staged)

        pages: dict[int, str] = {}
        n = 1
        while True:
            out = Path(tmp) / f"p{n}.txt"
            r = subprocess.run(
                ["pdftotext", "-enc", "UTF-8", "-f", str(n), "-l", str(n),
                 str(staged), str(out)],
                capture_output=True, text=True,
            )
            if r.returncode != 0 or not out.exists():
                break
            text = out.read_text(encoding="utf-8")
            if n > 1 and not text.strip():
                break
            pages[n] = normalize(text)
            n += 1

        if not pages:
            raise RuntimeError("pdftotext produced no pages — is poppler installed?")
        return pages


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    json_path, pdf_path = sys.argv[1], sys.argv[2]
    data = json.load(open(json_path, encoding="utf-8"))
    pages = pdf_pages(pdf_path)
    whole = "".join(pages[k] for k in sorted(pages))

    failures = []
    checked = 0

    question_ids = {q["external_id"] for q in data["questions"]}

    # structural integrity of the questions <-> quotes link
    seen_ids: set[str] = set()
    for quote in data["quotes"]:
        if quote["id"] in seen_ids:
            failures.append(("-", quote["id"], "duplicate quote id"))
        seen_ids.add(quote["id"])
        if quote["question_external_id"] not in question_ids:
            failures.append((quote["question_external_id"], quote["id"],
                             "question_external_id does not match any question"))

    for quote in data["quotes"]:
        if not quote.get("locked"):
            continue
        checked += 1
        qid = quote["question_external_id"]
        needle = normalize(quote["text"])
        page = quote.get("page")

        if page and needle in pages.get(page, ""):
            where = f"page {page}"
        elif needle in whole:
            where = "document (WRONG PAGE recorded)"
            failures.append((qid, quote["id"], "quote found but page number is wrong"))
        else:
            failures.append((qid, quote["id"], "NOT FOUND in PDF"))
            continue
        print(f"  ok  {qid} / {quote['id']:<3} {len(needle):>4} chars  [{where}]")

    # the narrative is extracted prose, not a locked quote, but a missing
    # paragraph is still a silent data-loss bug worth catching
    for q in data["questions"]:
        fp = normalize(q.get("fact_pattern", ""))
        if fp and fp not in whole:
            failures.append((q["external_id"], "fact_pattern", "does not match PDF text"))

    print(f"\n{len(data['questions'])} questions, {len(data['quotes'])} quotes; "
          f"{checked} locked quotes checked.")
    if failures:
        print(f"\n{len(failures)} FAILURE(S):")
        for qid, part, why in failures:
            print(f"  FAIL  {qid} / {part}: {why}")
        return 1

    print("All locked quotes verified byte-for-byte (letters + digits).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
