#!/usr/bin/env python3
"""
parse_docx.py — Extract the embedded ```json question blocks from a Sharon /
Nevo-produced Word document.

Input:  a .docx file. Each block sits inside a triple-backtick code fence,
        prefixed by the question number ("21.", "22.", ...).
Output: stdout JSON array of {question_number, raw_json, parse_error}.

Known docx quirks handled here:
  * Variable backtick fence counts (3..6).
  * Marker line ("21.") and fence opener ("```json") sometimes merged onto
    one paragraph by Word's soft line breaks; or split across multiple
    paragraphs by manual breaks.
  * Smart-quotes and embedded straight double-quotes inside Hebrew strings
    (Sharon's templates frequently have "תשס"ו" which breaks JSON parsing).
  * Trailing commas, stray Markdown escapes (`\\_`, `\\.`).

This script does NOT try to repair invalid JSON — it returns the raw block
and a parse_error string per block. Repairs live in normalize.py so each
fix is auditable on its own.

USAGE:
    python3 scripts/ingestion/parse_docx.py path/to/file.docx > blocks.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Iterator

import docx  # python-docx


# Matches an opening triple+ backtick fence with optional "json" tag.
# Backtick run length varies — Word docx sometimes substitutes for one of
# the backticks during paste, so we accept 3..10.
FENCE_OPEN_RE = re.compile(r"`{3,10}\s*json\b", re.IGNORECASE)
FENCE_CLOSE_RE = re.compile(r"`{3,10}\s*$")

# Question-number marker. Accepts "21.", "21 .", "21\n.", and (defensively)
# the same digits without a trailing period — some Sharon documents drop the
# period for the round-number questions ("10", "20") because Word's autoformat
# silently absorbed it during paste. Bare digits would over-match, so we
# require either:
#   (a) a trailing period, OR
#   (b) the digits are the ENTIRE line content (no surrounding text).
# Both forms are line-anchored via re.MULTILINE.
Q_MARKER_RE = re.compile(r"^\s*(\d{1,3})\s*\.?\s*$", re.MULTILINE)


def iter_paragraph_text(doc: docx.document.Document) -> Iterator[str]:
    """Yield each paragraph's text in order, preserving blank paragraphs."""
    for para in doc.paragraphs:
        yield para.text


def extract_full_text(path: Path) -> str:
    """Read the .docx into one big newline-joined text blob."""
    doc = docx.Document(str(path))
    return "\n".join(iter_paragraph_text(doc))


def split_into_blocks(text: str) -> list[tuple[int, str]]:
    """
    Walk the text once, return a list of (question_number, raw_block_text)
    tuples.

    Strategy: scan for fence-opens. For each, look backwards for the nearest
    "NN." marker (the question number) and forwards for the matching
    fence-close.
    """
    blocks: list[tuple[int, str]] = []
    cursor = 0
    text_len = len(text)

    while cursor < text_len:
        m_open = FENCE_OPEN_RE.search(text, cursor)
        if not m_open:
            break

        # Find the closing fence after the opener.
        # FENCE_CLOSE_RE is anchored to end-of-line — search line-by-line.
        body_start = m_open.end()
        close_idx = _find_close_fence(text, body_start)
        if close_idx is None:
            # No matching close fence — record the rest as one block and stop.
            blocks.append((_lookup_question_number(text, m_open.start()), text[body_start:].strip()))
            break

        block_text = text[body_start:close_idx].strip()
        qnum = _lookup_question_number(text, m_open.start())
        blocks.append((qnum, block_text))

        cursor = close_idx + 1

    return blocks


def _find_close_fence(text: str, start: int) -> int | None:
    """Return the index of the next closing fence after `start`, or None."""
    for m in re.finditer(r"`{3,10}", text[start:]):
        # Make sure we don't return an opening fence with "json" tag.
        run_start = start + m.start()
        run_end = start + m.end()
        # Check what's after the run on the same line
        tail = text[run_end:].splitlines()[0] if run_end < len(text) else ""
        if re.match(r"\s*json\b", tail, re.IGNORECASE):
            continue
        return run_start
    return None


def _lookup_question_number(text: str, fence_open_idx: int) -> int:
    """
    Look backwards from the fence opener for the nearest "NN." marker
    (within the previous ~400 chars). Return the integer; 0 if not found.
    """
    window_start = max(0, fence_open_idx - 400)
    window = text[window_start:fence_open_idx]
    matches = list(Q_MARKER_RE.finditer(window))
    if not matches:
        return 0
    return int(matches[-1].group(1))


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: parse_docx.py <file.docx>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"file not found: {path}", file=sys.stderr)
        return 2

    text = extract_full_text(path)
    blocks = split_into_blocks(text)

    out = []
    for qnum, raw in blocks:
        # Best-effort JSON parse (we use the same un-escape pass that
        # normalize.py will apply — but ONLY for the parse-check, not for
        # the persisted value).
        cleaned = (
            raw.replace("\\`", "`")
               .replace("\\_", "_")
               .replace("\\.", ".")
               .replace("\\-", "-")
               .replace("\\[", "[").replace("\\]", "]")
               .replace("\\(", "(").replace("\\)", ")")
               .replace("\\<", "<").replace("\\>", ">")
        )
        parse_error: str | None = None
        try:
            json.loads(cleaned)
        except Exception as e:  # noqa: BLE001 — just report, don't fail
            parse_error = f"{type(e).__name__}: {e}"

        out.append({
            "question_number_marker": qnum,
            "raw_block": raw,
            "cleaned_block": cleaned,
            "parse_error": parse_error,
        })

    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    print()  # trailing newline
    return 0


if __name__ == "__main__":
    sys.exit(main())
