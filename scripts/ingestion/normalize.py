#!/usr/bin/env python3
"""
normalize.py — Repair + mechanical fixes for parsed question blocks.

Pipeline:
  blocks.json  →  normalized.json
                  with one record per question:
                    { qnum, raw_block, repaired_json, fixes_applied[], parse_ok }

Repairs (textual, pre-JSON-parse):
  1. Hebrew-abbreviation quote escape — `(?<=Heb)"(?=Heb)` → `\"`.
     Catches the universal Sharon docx bug where תשס"ו, ע"א, ב"כ etc embed
     a literal " inside a string without escaping it.
  2. Control-character escape — literal \n, \t, \r INSIDE a string get
     escaped to \\n, \\t, \\r. JSON strict mode forbids raw control chars
     in strings; Sharon docs frequently have wrapped paragraphs that left
     newlines inside `legal_topic_analysis` and `full_explanation`.

Mechanical fixes (post-JSON-parse, structural):
  3. `external_id: "PENDING"` → derived ID from (year/season/track/qnum).
  4. `source_metadata` → overwritten from the DERIVED exam identity passed in
     via CLI args. The original 2019/summer values in the JSON are a stale
     Nevo template default — always wrong.
  5. `display_analysis` → `distractor_analysis` key rename (mistyped in some
     batches). Operates on every choice in `source_choices` and inside
     every `angle.angle_choices`.

USAGE:
  python3 scripts/ingestion/normalize.py \\
    --blocks scripts/ingestion/tmp/q1_20_blocks.json \\
    --start-qnum 1 \\
    --year 2024 --season winter --part 2 --track substantive \\
    --external-id-prefix 2024-W-S \\
    --out scripts/ingestion/tmp/q1_20_normalized.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

HEB = r"֐-׿"
HEBREW_ABBREV_RE = re.compile(rf'(?<=[{HEB}])"(?=[{HEB}])')


def repair_hebrew_abbrev(s: str) -> tuple[str, int]:
    """Escape unescaped " between two Hebrew letters. Returns (str, n_fixes)."""
    fixes = 0

    def _sub(_m: re.Match[str]) -> str:
        nonlocal fixes
        fixes += 1
        return r"\""

    return HEBREW_ABBREV_RE.sub(_sub, s), fixes


def repair_control_chars(s: str) -> tuple[str, int]:
    """
    Escape literal newlines / tabs / CR INSIDE JSON strings.

    State machine: tracks `in_string` and `escape`. Replacement only fires
    when the control char appears inside a string (between unescaped quotes).
    """
    out: list[str] = []
    in_string = False
    escape = False
    fixes = 0
    for c in s:
        if escape:
            # Previous char was a backslash — emit verbatim, clear flag.
            out.append(c)
            escape = False
            continue
        if c == "\\":
            out.append(c)
            escape = True
            continue
        if in_string:
            if c == "\n":
                out.append("\\n")
                fixes += 1
                continue
            if c == "\r":
                out.append("\\r")
                fixes += 1
                continue
            if c == "\t":
                out.append("\\t")
                fixes += 1
                continue
            if c == '"':
                in_string = False
        else:
            if c == '"':
                in_string = True
        out.append(c)
    return "".join(out), fixes


def apply_text_repairs(raw: str) -> tuple[str, dict[str, int]]:
    """Run repairs in order. Hebrew quotes first (purely textual), then
    control chars (state-machine — boundaries stay stable either way)."""
    s, n_heb = repair_hebrew_abbrev(raw)
    s, n_ctl = repair_control_chars(s)
    return s, {"hebrew_quote_escape": n_heb, "control_char_escape": n_ctl}


def rename_display_analysis_key(obj: Any) -> int:
    """Recursive rename: `display_analysis` → `distractor_analysis`. Returns
    count of fixes applied."""
    fixes = 0
    if isinstance(obj, dict):
        if "display_analysis" in obj and "distractor_analysis" not in obj:
            obj["distractor_analysis"] = obj.pop("display_analysis")
            fixes += 1
        for v in obj.values():
            fixes += rename_display_analysis_key(v)
    elif isinstance(obj, list):
        for item in obj:
            fixes += rename_display_analysis_key(item)
    return fixes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--blocks", required=True, help="Input: parse_docx.py output")
    ap.add_argument("--start-qnum", type=int, required=True, help="Position offset (1 for file 1-20, 21 for file 21-40)")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--season", required=True, choices=["winter", "summer"])
    ap.add_argument("--part", type=int, required=True)
    ap.add_argument("--track", required=True, choices=["procedural", "substantive"])
    ap.add_argument("--external-id-prefix", required=True, help="e.g. '2024-W-S' → '2024-W-S-Q07'")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.blocks, "r", encoding="utf-8") as f:
        blocks = json.load(f)

    out_records: list[dict[str, Any]] = []
    fix_totals: Counter[str] = Counter()
    skipped: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []

    # Marker-driven qnum assignment: the textual marker is authoritative when
    # it matches the expected sequence; positions are unreliable because the
    # docx can carry consecutive-duplicate blocks (Sharon's Q23 in the 21-40
    # batch was pasted twice). Algorithm:
    #   * Track `expected_qnum`, starting from --start-qnum.
    #   * If marker == expected → use marker, advance.
    #   * If marker < expected → previous-question duplicate, SKIP.
    #   * If marker > expected → marker wins (we've apparently skipped some
    #     numbers in source — rare, but recorded).
    expected_qnum = args.start_qnum
    for b in blocks:
        marker = b["question_number_marker"]
        cleaned = b["cleaned_block"]

        if marker == 0:
            # Marker unreadable — fall back to expected.
            qnum = expected_qnum
        elif marker < expected_qnum:
            duplicates.append({
                "qnum_marker": marker,
                "expected_qnum": expected_qnum,
                "reason": "duplicate of previous block",
            })
            continue
        else:
            qnum = marker
            expected_qnum = qnum
        expected_qnum += 1

        repaired, repair_counts = apply_text_repairs(cleaned)

        try:
            obj = json.loads(repaired)
        except json.JSONDecodeError as e:
            skipped.append({
                "qnum_position": qnum,
                "qnum_marker": marker,
                "parse_error": f"{type(e).__name__}: {e}",
                "repaired_preview": repaired[:500],
            })
            continue

        # Mechanical fixes — structural, post-parse.
        ext_id = f"{args.external_id_prefix}-Q{qnum:02d}"
        original_external_id = obj.get("external_id")
        obj["external_id"] = ext_id
        if original_external_id == "PENDING":
            fix_totals["external_id_pending_replaced"] += 1
        else:
            # Loud — wasn't PENDING; something unexpected.
            fix_totals["external_id_was_not_pending"] += 1

        original_meta = obj.get("source_metadata") or {}
        obj["source_metadata"] = {
            "exam_year": args.year,
            "exam_season": args.season,
            "exam_part": args.part,
            "exam_question_number": qnum,
        }
        if (original_meta.get("exam_year") != args.year
                or original_meta.get("exam_season") != args.season):
            fix_totals["source_metadata_overridden"] += 1

        renames = rename_display_analysis_key(obj)
        if renames:
            fix_totals["display_analysis_key_renamed"] += renames

        for k, v in repair_counts.items():
            if v:
                fix_totals[k] += v

        # Capture the JSON's *original* chapter/subtopic for the report. The
        # classifier will OVERWRITE these — we keep the originals so the
        # report can show "original → assigned" rows.
        obj["__original_chapter"] = original_meta.get("chapter") or obj.get("chapter")
        obj["__original_subtopic"] = obj.get("subtopic")
        # And the textual marker, for cross-checks.
        obj["__qnum_position"] = qnum
        obj["__qnum_marker"] = marker

        out_records.append(obj)

    out_payload = {
        "config": {
            "exam_year": args.year,
            "exam_season": args.season,
            "exam_part": args.part,
            "track": args.track,
            "external_id_prefix": args.external_id_prefix,
            "start_qnum": args.start_qnum,
        },
        "fix_totals": dict(fix_totals),
        "duplicates_dropped": duplicates,
        "skipped_blocks": skipped,
        "questions": out_records,
    }

    Path(args.out).write_text(
        json.dumps(out_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"normalized: {len(out_records)} questions, skipped: {len(skipped)}", file=sys.stderr)
    print(f"fix totals: {dict(fix_totals)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
