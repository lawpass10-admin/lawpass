#!/usr/bin/env python3
"""
generate_migration.py — Emit one Supabase migration .sql from normalized
question JSON + classification mapping.

Inputs:
  --normalized           one or more *_normalized.json files (from normalize.py)
  --classifications      JSON mapping external_id → {chapter, subtopic, needs_review, note}
  --created-by           UUID to stamp into source_questions.created_by
  --migration-name       e.g. "add_2024_winter_substantive_q1_to_q28"
  --out                  output .sql path

Output structure: one DO $$ block per question, mirroring the prior
batch (migration 20260518000001). Each block:
  1. Selects an existing external_id → RAISE NOTICE + RETURN if found
     (DB-level idempotency).
  2. Looks up subtopic_id by code (RAISE EXCEPTION if missing — taxonomy
     gap, surfaces loudly).
  3. Looks up chapter_id by code (same).
  4. INSERTs source_questions + 4 source_choices.
  5. INSERTs each angle_question + its angle_choices (variable count).

Content duplicates within the batch are dropped via the classification's
`_drops` list (declared in the JSON, not inferred here — keeps the SQL
generator strictly mechanical).
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path
from typing import Any


def sql_escape(s: str | None) -> str:
    """Escape a string for inclusion in a single-quoted SQL literal."""
    if s is None:
        return "NULL"
    return s.replace("'", "''")


def sql_str(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + sql_escape(s) + "'"


def sql_jsonb(value: Any) -> str:
    """Emit a JSONB literal."""
    if value is None:
        return "NULL::jsonb"
    js = json.dumps(value, ensure_ascii=False)
    return "'" + sql_escape(js) + "'::jsonb"


def sql_bool(v: Any) -> str:
    return "true" if bool(v) else "false"


def sql_int(v: Any) -> str:
    return "NULL" if v is None else str(int(v))


def emit_question_block(q: dict, cls: dict, created_by: str) -> str:
    """Emit one DO $$ block for one question."""
    ext_id = q["external_id"]
    qnum = q["source_metadata"]["exam_question_number"]
    chapter_code = cls["chapter"]
    subtopic_code = cls["subtopic"]
    needs_review = cls.get("needs_review", False)
    cls_note = cls.get("note", "")
    review_note_orig = q.get("review_note") or ""
    original_chapter = q.get("__original_chapter") or ""
    original_subtopic = q.get("__original_subtopic") or ""

    # Compose notes_for_admin per the prior batch convention
    # ("needs_review=true | note: ...").
    note_pieces: list[str] = []
    if needs_review:
        note_pieces.append("needs_review=true")
    classification_review = (
        f"classification_review: original chapter='{original_chapter}' "
        f"subtopic='{original_subtopic}' → mapped chapter='{chapter_code}' "
        f"subtopic='{subtopic_code}'"
    )
    note_pieces.append(classification_review)
    if cls_note:
        note_pieces.append(f"classifier_note: {cls_note}")
    if review_note_orig:
        note_pieces.append(f"source_review_note: {review_note_orig}")
    notes_for_admin = " | ".join(note_pieces)

    # Generate UUIDs at python time so each block has stable IDs (gen_random_uuid()
    # could also work, but inline UUIDs make the SQL fully deterministic and
    # easier to diff).
    sq_id = str(uuid.uuid4())
    group_id = str(uuid.uuid4())

    angles = q.get("angles") or []
    angle_uuids = [str(uuid.uuid4()) for _ in angles]

    lines: list[str] = []
    lines.append("-- ============================================================")
    lines.append(
        f"-- Q{qnum:02d} — {ext_id} — chapter={chapter_code} subtopic={subtopic_code}"
        + (f"  [needs_review]" if needs_review else "")
    )
    if cls_note:
        lines.append(f"-- classifier_note: {cls_note}")
    lines.append("-- ============================================================")
    lines.append("DO $$")
    lines.append("DECLARE")
    lines.append(f"  v_sq_id uuid := '{sq_id}'::uuid;")
    lines.append(f"  v_group_id uuid := '{group_id}'::uuid;")
    lines.append("  v_chapter_id uuid;")
    lines.append("  v_subtopic_id uuid;")
    lines.append("  v_existing_id uuid;")
    for i, a_uuid in enumerate(angle_uuids):
        lines.append(f"  v_ang_{i} uuid := '{a_uuid}'::uuid;")
    lines.append("BEGIN")
    lines.append(
        f"  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '{ext_id}';"
    )
    lines.append("  IF v_existing_id IS NOT NULL THEN")
    lines.append(
        f"    RAISE NOTICE 'Q% skipped: external_id % already exists', {qnum}, '{ext_id}';"
    )
    lines.append("    RETURN;")
    lines.append("  END IF;")
    lines.append("")
    lines.append(
        f"  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = '{chapter_code}';"
    )
    lines.append("  IF v_chapter_id IS NULL THEN")
    lines.append(f"    RAISE EXCEPTION 'Chapter code % not found', '{chapter_code}';")
    lines.append("  END IF;")
    lines.append("")
    lines.append(
        f"  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = '{subtopic_code}' AND chapter_id = v_chapter_id;"
    )
    lines.append("  IF v_subtopic_id IS NULL THEN")
    lines.append(
        f"    RAISE EXCEPTION 'Subtopic code % not found under chapter %', '{subtopic_code}', '{chapter_code}';"
    )
    lines.append("  END IF;")
    lines.append("")

    # source_questions insert
    insert_cols = [
        "id", "question_group_id", "version", "is_current", "external_id",
        "chapter_id", "subtopic_id", "question_text", "source_metadata",
        "legal_topic_analysis", "full_explanation", "common_pitfall",
        "concepts_and_skills", "quick_thinking_360", "summary_for_memory",
        "references_list", "notes_for_admin", "status", "created_by",
    ]
    values = [
        "v_sq_id", "v_group_id", "1", "true",
        sql_str(ext_id), "v_chapter_id", "v_subtopic_id",
        sql_str(q.get("question_text")),
        sql_jsonb(q.get("source_metadata")),
        sql_str(q.get("legal_topic_analysis")),
        sql_str(q.get("full_explanation")),
        sql_str(q.get("common_pitfall")),
        sql_jsonb(q.get("concepts_and_skills")),
        sql_str(q.get("quick_thinking_360")),
        sql_str(q.get("summary_for_memory")),
        sql_jsonb(q.get("references_list")),
        sql_str(notes_for_admin),
        "'active'",
        sql_str(created_by),
    ]
    lines.append("  INSERT INTO public.source_questions (")
    lines.append("    " + ", ".join(insert_cols))
    lines.append("  ) VALUES (")
    # Wrap values across lines for readability (2 per line).
    for i in range(0, len(values), 4):
        chunk = ", ".join(values[i : i + 4])
        suffix = "," if i + 4 < len(values) else ""
        lines.append(f"    {chunk}{suffix}")
    lines.append("  );")
    lines.append("")

    # source_choices
    for choice in q.get("source_choices") or []:
        letter = choice.get("letter")
        choice_text = choice.get("choice_text")
        is_correct = bool(choice.get("is_correct"))
        analysis = choice.get("distractor_analysis") or choice.get("display_analysis") or ""
        display_order = int(choice.get("display_order") or 0)
        lines.append(
            "  INSERT INTO public.source_choices "
            "(source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) "
            f"VALUES (v_sq_id, {sql_str(letter)}, {sql_str(choice_text)}, {sql_bool(is_correct)}, {sql_str(analysis)}, {sql_int(display_order)});"
        )
    lines.append("")

    # angle_questions + angle_choices
    for i, angle in enumerate(angles):
        var = f"v_ang_{i}"
        a_letter = angle.get("angle_letter") or angle.get("letter")
        a_title = angle.get("angle_title") or angle.get("title")
        a_order = int(angle.get("display_order") or i + 1)
        a_cols = [
            "id", "source_question_id", "angle_letter", "angle_title",
            "display_order", "question_text",
            "legal_topic_analysis", "full_explanation", "common_pitfall",
            "concepts_and_skills", "quick_thinking_360", "summary_for_memory",
            "references_list",
        ]
        a_vals = [
            var, "v_sq_id", sql_str(a_letter), sql_str(a_title),
            sql_int(a_order), sql_str(angle.get("question_text")),
            sql_str(angle.get("legal_topic_analysis")),
            sql_str(angle.get("full_explanation")),
            sql_str(angle.get("common_pitfall")),
            sql_jsonb(angle.get("concepts_and_skills")),
            sql_str(angle.get("quick_thinking_360")),
            sql_str(angle.get("summary_for_memory")),
            sql_jsonb(angle.get("references_list")),
        ]
        lines.append("  INSERT INTO public.angle_questions (")
        lines.append("    " + ", ".join(a_cols))
        lines.append("  ) VALUES (")
        for j in range(0, len(a_vals), 4):
            chunk = ", ".join(a_vals[j : j + 4])
            suffix = "," if j + 4 < len(a_vals) else ""
            lines.append(f"    {chunk}{suffix}")
        lines.append("  );")
        for ac in angle.get("angle_choices") or []:
            ac_letter = ac.get("letter")
            ac_text = ac.get("choice_text")
            ac_correct = bool(ac.get("is_correct"))
            ac_analysis = ac.get("distractor_analysis") or ac.get("display_analysis") or ""
            ac_order = int(ac.get("display_order") or 0)
            lines.append(
                "  INSERT INTO public.angle_choices "
                "(angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) "
                f"VALUES ({var}, {sql_str(ac_letter)}, {sql_str(ac_text)}, {sql_bool(ac_correct)}, {sql_str(ac_analysis)}, {sql_int(ac_order)});"
            )
        lines.append("")

    lines.append(f"  RAISE NOTICE 'Q% inserted: external_id %', {qnum}, '{ext_id}';")
    lines.append("END")
    lines.append("$$;")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--normalized", nargs="+", required=True)
    ap.add_argument("--classifications", required=True)
    ap.add_argument("--created-by", required=True)
    ap.add_argument("--migration-name", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    # Load classifications.
    cls_payload = json.loads(Path(args.classifications).read_text(encoding="utf-8"))
    classifications: dict[str, dict] = cls_payload["classifications"]
    drops = {d["external_id"] for d in cls_payload.get("_drops", []) if "external_id" in d}

    # Load all normalized questions from all inputs.
    all_q: list[dict] = []
    for npath in args.normalized:
        d = json.loads(Path(npath).read_text(encoding="utf-8"))
        all_q.extend(d.get("questions", []))

    # Sort by exam_question_number for stable diffs.
    all_q.sort(key=lambda q: q["source_metadata"]["exam_question_number"])

    # Build the SQL.
    header = f"""-- Migration: {args.migration_name}
--
-- Source: 2024 winter substantive-law batch (פברואר 2024, חלק ג', דין מהותי).
-- Two .docx files from the LawPass Content Pipeline Drive folder:
--   * (דין מהותי) 1-20  JSON.docx
--   * (דין מהותי) 21-40.docx  (contains Q21–Q40, with one duplicate of Q23)
--
-- Pipeline: scripts/ingestion/{{parse_docx,normalize,generate_migration}}.py +
-- the per-batch classification at scripts/ingestion/classifications/
-- 2024_winter_substantive.json. Re-classifies every question against the
-- substantive taxonomy from migration 20260526000001 (the JSON's own
-- chapter/subtopic — procedural placeholders from a stale Nevo template —
-- is ignored). source_metadata is also derived from the folder path, not
-- from the JSON's stale 2019/summer default.
--
-- Drops:
--   * 2024-W-S-Q20 — exact-content dup of Q18 (same question_text + choices).
--   * 2024-W-S-Q27 — JSON structurally broken beyond automatic repair.
--   * one in-file Q23 duplicate (the second of two consecutive Q23 fences).
--
-- Idempotency: each DO $$ block early-returns (RAISE NOTICE) if its
-- external_id already exists. Safe to re-run.
"""

    blocks: list[str] = [header]
    inserted_count = 0
    skipped_drops = 0
    skipped_unclassified = 0
    for q in all_q:
        ext_id = q["external_id"]
        if ext_id in drops:
            skipped_drops += 1
            continue
        cls = classifications.get(ext_id)
        if not cls:
            skipped_unclassified += 1
            sys.stderr.write(f"WARN: no classification for {ext_id} — skipped\n")
            continue
        blocks.append(emit_question_block(q, cls, args.created_by))
        inserted_count += 1

    Path(args.out).write_text("\n".join(blocks), encoding="utf-8")
    print(
        f"emitted {inserted_count} questions to {args.out}  "
        f"(drops={skipped_drops}, unclassified={skipped_unclassified})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
