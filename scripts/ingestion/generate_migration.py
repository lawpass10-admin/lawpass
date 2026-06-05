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


def sql_jsonb_array(value: Any) -> str:
    """Emit a JSONB literal for an array column. Coalesces None / non-list
    inputs to `'[]'::jsonb` so NOT-NULL-default-`[]` columns
    (`source_questions.references_list`, `source_questions.concepts_and_skills`,
    `angle_questions.references_list`, `angle_questions.concepts_and_skills`)
    never receive a stray NULL. Caught by Sharon's 2022-W-S Q17 which had
    `references_list: null` in source — the column is
    `NOT NULL DEFAULT '[]'::jsonb` so a NULL literal violates the
    constraint."""
    if not isinstance(value, list):
        return "'[]'::jsonb"
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

    # JSON key is "angle_questions" (matches Sharon's docx output, normalize.py
    # preserves it verbatim). Earlier versions used q.get("angles") which is
    # the WRONG key — `dict.get` silently returns None for a missing key, so
    # the angle-INSERT block became dead code and 152 angle_questions + 608
    # angle_choices got dropped in the first 2024-W-S substantive batch. The
    # post-emit sanity check in main() catches this class of bug now.
    # Also filters out angles with a multi-correct data bug (see
    # _filter_valid_angles) so the DB invariant `idx_angle_ch_one_correct`
    # isn't violated mid-transaction.
    angles = _filter_valid_angles(q)
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
        sql_jsonb_array(q.get("concepts_and_skills")),
        sql_str(q.get("quick_thinking_360")),
        sql_str(q.get("summary_for_memory")),
        sql_jsonb_array(q.get("references_list")),
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
            sql_jsonb_array(angle.get("concepts_and_skills")),
            sql_str(angle.get("quick_thinking_360")),
            sql_str(angle.get("summary_for_memory")),
            sql_jsonb_array(angle.get("references_list")),
        ]
        lines.append("  INSERT INTO public.angle_questions (")
        lines.append("    " + ", ".join(a_cols))
        lines.append("  ) VALUES (")
        for j in range(0, len(a_vals), 4):
            chunk = ", ".join(a_vals[j : j + 4])
            suffix = "," if j + 4 < len(a_vals) else ""
            lines.append(f"    {chunk}{suffix}")
        lines.append("  );")
        for ac_idx, ac in enumerate(angle.get("angle_choices") or []):
            ac_letter = ac.get("letter")
            ac_text = ac.get("choice_text")
            ac_correct = bool(ac.get("is_correct"))
            ac_analysis = ac.get("distractor_analysis") or ac.get("display_analysis") or ""
            # angle_choices entries in Sharon's docx don't carry display_order;
            # derive from position (1-based) to match the existing source_choices
            # convention (1..4 for letters א..ד).
            ac_order = int(ac.get("display_order") or (ac_idx + 1))
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


_skipped_angles: list[dict] = []


def _angle_has_exactly_one_correct(angle: dict) -> bool:
    """Validate angle_choices satisfy DB partial unique `idx_angle_ch_one_correct`
    (exactly one is_correct=true). Skipping invalid angles is preferable to
    a half-applied migration. Skip events are collected globally for the
    post-emit summary."""
    choices = angle.get("angle_choices") or []
    correct = sum(1 for c in choices if c.get("is_correct"))
    return correct == 1


def _filter_valid_angles(q: dict) -> list[dict]:
    """Return only the angles that satisfy the DB invariants. Records skips
    in module-level `_skipped_angles` for sanity-check + report.

    Two invariants enforced here:
      1. `idx_angle_ch_one_correct` — angle_choices must contain exactly one
         `is_correct=true`. Sharon's 2024-W Q32 had angles with 2 and 3
         correct choices, which would UNIQUE-violate at insert time.
      2. `(source_question_id, angle_letter)` UNIQUE AND
         `(source_question_id, display_order)` UNIQUE — no two angles for the
         same source may share a letter or a display_order. Sharon's 2022-S
         Q24 has 6 angles where letters א/ב are each used twice and
         display_order 2 is used twice; the duplicates are NOT semantic
         duplicates (different titles + content) but copy-paste editorial
         errors during authoring.

    The DB also enforces angle_letter ∈ {א, ב, ג, ד, ה} and
    display_order ∈ [1, 5]. Angles outside those ranges are also rejected
    here so a value-error doesn't trip the migration mid-DO-block.

    First-seen wins — earlier angles in the source list are kept; later
    angles that conflict are dropped.
    """
    ext_id = q["external_id"]
    kept: list[dict] = []
    seen_letters: set[str] = set()
    seen_orders: set[int] = set()
    allowed_letters = {"א", "ב", "ג", "ד", "ה"}
    for a in q.get("angle_questions") or []:
        letter = a.get("angle_letter")
        order_raw = a.get("display_order")
        try:
            order = int(order_raw) if order_raw is not None else None
        except (TypeError, ValueError):
            order = None

        if not _angle_has_exactly_one_correct(a):
            correct_count = sum(
                1 for c in (a.get("angle_choices") or []) if c.get("is_correct")
            )
            _skipped_angles.append({
                "external_id": ext_id,
                "angle_letter": letter,
                "display_order": order,
                "reason": (
                    "violates idx_angle_ch_one_correct "
                    f"(expected exactly 1 is_correct=true; found {correct_count})"
                ),
            })
            continue

        if letter not in allowed_letters:
            _skipped_angles.append({
                "external_id": ext_id,
                "angle_letter": letter,
                "display_order": order,
                "reason": (
                    f"angle_letter {letter!r} not in {{א, ב, ג, ד, ה}} "
                    "(DB CHECK constraint)"
                ),
            })
            continue

        if order is None or order < 1 or order > 5:
            _skipped_angles.append({
                "external_id": ext_id,
                "angle_letter": letter,
                "display_order": order,
                "reason": (
                    f"display_order {order!r} outside [1,5] (DB CHECK constraint)"
                ),
            })
            continue

        if letter in seen_letters:
            _skipped_angles.append({
                "external_id": ext_id,
                "angle_letter": letter,
                "display_order": order,
                "reason": (
                    "duplicate angle_letter within source (violates "
                    "UNIQUE(source_question_id, angle_letter)); first occurrence kept"
                ),
            })
            continue

        if order in seen_orders:
            _skipped_angles.append({
                "external_id": ext_id,
                "angle_letter": letter,
                "display_order": order,
                "reason": (
                    "duplicate display_order within source (violates "
                    "UNIQUE(source_question_id, display_order)); first occurrence kept"
                ),
            })
            continue

        seen_letters.add(letter)
        seen_orders.add(order)
        kept.append(a)
    return kept


def emit_angles_only_block(q: dict, ext_id_lookup: str | None = None) -> str:
    """
    Emit a DO $$ block that ONLY backfills angles + angle_choices for an
    existing source_question. Used by `--angles-only`.

    Idempotency model: per-angle SELECT-then-INSERT inside the DO block.
    If the angle row already exists for (source_question_id, angle_letter),
    we capture its existing id and skip the angle_choices INSERT (choices
    are owned by their angle — a re-run on a complete row would otherwise
    UNIQUE-violate on angle_choices.angle_question_id + letter anyway).

    Validation: skips any angle whose angle_choices don't satisfy the
    DB invariant of exactly one is_correct=true (the partial unique index
    `idx_angle_ch_one_correct`). Skip events are recorded in
    `_skipped_angles` and surfaced in the post-emit summary.

    Safe to re-run: nothing changes once the angles are present.
    """
    ext_id = ext_id_lookup or q["external_id"]
    qnum = q["source_metadata"]["exam_question_number"]
    angles = _filter_valid_angles(q)

    lines: list[str] = []
    lines.append("-- ============================================================")
    lines.append(f"-- Q{qnum:02d} — angles backfill for {ext_id} ({len(angles)} angles)")
    lines.append("-- ============================================================")
    lines.append("DO $$")
    lines.append("DECLARE")
    lines.append("  v_sq_id uuid;")
    lines.append("  v_ang_id uuid;")
    lines.append("BEGIN")
    lines.append(
        f"  SELECT id INTO v_sq_id FROM public.source_questions WHERE external_id = '{ext_id}';"
    )
    lines.append("  IF v_sq_id IS NULL THEN")
    lines.append(
        f"    RAISE NOTICE 'parent source % not found, skipping angles', '{ext_id}';"
    )
    lines.append("    RETURN;")
    lines.append("  END IF;")
    lines.append("")

    for angle in angles:
        a_letter = angle.get("angle_letter") or angle.get("letter")
        a_title = angle.get("angle_title") or angle.get("title")
        a_order = int(angle.get("display_order") or 0)

        lines.append(f"  -- Angle {a_letter}")
        lines.append(
            "  SELECT id INTO v_ang_id FROM public.angle_questions "
            f"WHERE source_question_id = v_sq_id AND angle_letter = {sql_str(a_letter)};"
        )
        lines.append("  IF v_ang_id IS NULL THEN")
        a_cols = [
            "source_question_id", "angle_letter", "angle_title",
            "display_order", "question_text",
            "legal_topic_analysis", "full_explanation", "common_pitfall",
            "concepts_and_skills", "quick_thinking_360", "summary_for_memory",
            "references_list",
        ]
        a_vals = [
            "v_sq_id", sql_str(a_letter), sql_str(a_title),
            sql_int(a_order), sql_str(angle.get("question_text")),
            sql_str(angle.get("legal_topic_analysis")),
            sql_str(angle.get("full_explanation")),
            sql_str(angle.get("common_pitfall")),
            sql_jsonb_array(angle.get("concepts_and_skills")),
            sql_str(angle.get("quick_thinking_360")),
            sql_str(angle.get("summary_for_memory")),
            sql_jsonb_array(angle.get("references_list")),
        ]
        lines.append("    INSERT INTO public.angle_questions (")
        lines.append("      " + ", ".join(a_cols))
        lines.append("    ) VALUES (")
        for j in range(0, len(a_vals), 4):
            chunk = ", ".join(a_vals[j : j + 4])
            suffix = "," if j + 4 < len(a_vals) else ""
            lines.append(f"      {chunk}{suffix}")
        lines.append("    ) RETURNING id INTO v_ang_id;")

        for ac_idx, ac in enumerate(angle.get("angle_choices") or []):
            ac_letter = ac.get("letter")
            ac_text = ac.get("choice_text")
            ac_correct = bool(ac.get("is_correct"))
            ac_analysis = ac.get("distractor_analysis") or ac.get("display_analysis") or ""
            # angle_choices entries in Sharon's docx don't carry display_order;
            # derive from position (1-based) to match the existing source_choices
            # convention (1..4 for letters א..ד).
            ac_order = int(ac.get("display_order") or (ac_idx + 1))
            lines.append(
                "    INSERT INTO public.angle_choices "
                "(angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) "
                f"VALUES (v_ang_id, {sql_str(ac_letter)}, {sql_str(ac_text)}, {sql_bool(ac_correct)}, {sql_str(ac_analysis)}, {sql_int(ac_order)});"
            )
        lines.append("  ELSE")
        lines.append(
            f"    RAISE NOTICE 'angle % already exists for %, skipping', '{a_letter}', '{ext_id}';"
        )
        lines.append("  END IF;")
        lines.append("")

    lines.append(f"  RAISE NOTICE 'Q% angles backfilled: external_id %', {qnum}, '{ext_id}';")
    lines.append("END")
    lines.append("$$;")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--normalized", nargs="+", required=True)
    ap.add_argument("--classifications", required=True)
    ap.add_argument(
        "--created-by",
        default="b9ecdde2-d07e-4761-96ab-05f0ad32d4e3",
        help="Admin UUID stamped into source_questions.created_by (full mode only).",
    )
    ap.add_argument("--migration-name", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--angles-only",
        action="store_true",
        help=(
            "Emit ONLY angle_questions + angle_choices for already-ingested "
            "sources (resolves parent by external_id). Use this for backfill "
            "after a prior partial run."
        ),
    )
    ap.add_argument(
        "--migration-version",
        help="Optional: register the migration in supabase_migrations.schema_migrations. "
        "If given, appends an INSERT ... ON CONFLICT DO NOTHING.",
    )
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

    # Override the header in angles-only mode so its purpose is unambiguous
    # when read in isolation (and so re-runs can identify themselves).
    if args.angles_only:
        header = f"""-- Migration: {args.migration_name}
--
-- ANGLES-ONLY backfill for the 2024 winter substantive batch. The original
-- ingestion (migration 20260526000002) dropped every nested
-- `angle_questions` array because `generate_migration.py` used the wrong
-- dict key (`q.get("angles")` instead of `q.get("angle_questions")`).
-- Sources + source_choices already landed; this migration adds only the
-- missing angle rows.
--
-- Idempotency: each angle is guarded by a SELECT-then-INSERT against the
-- (source_question_id, angle_letter) unique key. Choices fire only when
-- the parent angle is newly inserted. Re-running is a no-op (each block
-- RAISE NOTICEs that the angle already exists).
"""

    blocks: list[str] = [header]
    inserted_count = 0
    skipped_drops = 0
    skipped_unclassified = 0
    included_questions: list[dict] = []
    for q in all_q:
        ext_id = q["external_id"]
        if ext_id in drops:
            skipped_drops += 1
            continue
        if args.angles_only:
            # Angles-only mode does NOT require a classification — the source
            # is already in the DB and the only thing we need from it is
            # `external_id` to look the parent up.
            blocks.append(emit_angles_only_block(q))
            included_questions.append(q)
            inserted_count += 1
            continue
        cls = classifications.get(ext_id)
        if not cls:
            skipped_unclassified += 1
            sys.stderr.write(f"WARN: no classification for {ext_id} — skipped\n")
            continue
        blocks.append(emit_question_block(q, cls, args.created_by))
        included_questions.append(q)
        inserted_count += 1

    # Optionally register in supabase_migrations.schema_migrations.
    if args.migration_version:
        blocks.append("")
        blocks.append(
            "-- ============================================================"
        )
        blocks.append(
            "-- Register this migration in Supabase's schema_migrations registry."
        )
        blocks.append(
            "-- Idempotent: ON CONFLICT DO NOTHING in case the file is re-applied."
        )
        blocks.append(
            "-- ============================================================"
        )
        blocks.append(
            "INSERT INTO supabase_migrations.schema_migrations (version, name)"
        )
        blocks.append(
            f"VALUES ('{args.migration_version}', '{args.migration_name}')"
        )
        blocks.append("ON CONFLICT (version) DO NOTHING;")

    out_sql = "\n".join(blocks)
    Path(args.out).write_text(out_sql, encoding="utf-8")

    # -------------------------------------------------------------------
    # Post-emit sanity check — loud failure if INSERT counts don't match
    # what the source JSON requires. Catches the dropped-angles class of
    # bug (where a wrong key name silently zeroes a section). Counts INSERT
    # statements in the emitted SQL and compares against expected counts
    # tallied from the included questions.
    # -------------------------------------------------------------------
    def count_inserts(text: str, table: str) -> int:
        return text.count(f"INSERT INTO public.{table}")

    expected_sources = 0 if args.angles_only else len(included_questions)
    expected_source_choices = (
        0
        if args.angles_only
        else sum(len(q.get("source_choices") or []) for q in included_questions)
    )
    # Expected angle counts EXCLUDE any angle filtered out by
    # _filter_valid_angles. We can't derive this from the global skipped
    # list (`_skipped_angles`) because that holds skip events — and the
    # duplicate-letter check skips LATER occurrences only, so the same
    # letter may appear both as "kept" and "skipped" for one question.
    # The robust approach is to re-run the filter and count its kept
    # output directly — that's exactly what the SQL emitter saw.
    # Filter is idempotent and side-effect-only via _skipped_angles (which
    # is already populated by the emit pass); save/restore to avoid
    # double-recording.
    _stash = list(_skipped_angles)
    _skipped_angles.clear()
    valid_angles_per_q: dict[str, list[dict]] = {}
    for q in included_questions:
        valid_angles_per_q[q["external_id"]] = _filter_valid_angles(q)
    _skipped_angles.clear()
    _skipped_angles.extend(_stash)
    expected_angles = sum(len(v) for v in valid_angles_per_q.values())
    expected_angle_choices = sum(
        len(a.get("angle_choices") or [])
        for v in valid_angles_per_q.values()
        for a in v
    )

    emitted_sources = count_inserts(out_sql, "source_questions")
    emitted_source_choices = count_inserts(out_sql, "source_choices")
    emitted_angles = count_inserts(out_sql, "angle_questions")
    emitted_angle_choices = count_inserts(out_sql, "angle_choices")

    mismatches: list[str] = []
    for label, expected, emitted in [
        ("source_questions", expected_sources, emitted_sources),
        ("source_choices", expected_source_choices, emitted_source_choices),
        ("angle_questions", expected_angles, emitted_angles),
        ("angle_choices", expected_angle_choices, emitted_angle_choices),
    ]:
        if expected != emitted:
            mismatches.append(
                f"  {label}: expected={expected} emitted={emitted}  (delta={emitted - expected})"
            )

    sys.stderr.write(
        f"\nINSERT counts (emitted vs expected from JSON):\n"
        f"  source_questions : {emitted_sources}/{expected_sources}\n"
        f"  source_choices   : {emitted_source_choices}/{expected_source_choices}\n"
        f"  angle_questions  : {emitted_angles}/{expected_angles}\n"
        f"  angle_choices    : {emitted_angle_choices}/{expected_angle_choices}\n"
    )
    if _skipped_angles:
        sys.stderr.write(
            f"\nSKIPPED ANGLES ({len(_skipped_angles)}) — failed editorial validation:\n"
        )
        for s in _skipped_angles:
            sys.stderr.write(
                f"  {s['external_id']} angle {s['angle_letter']}: {s['reason']}\n"
            )

    if mismatches:
        sys.stderr.write(
            "\nFATAL: emitted INSERT counts do not match the source JSON. "
            "This is exactly the dropped-angles class of bug the post-emit "
            "check exists to catch. Aborting before any apply step.\n"
        )
        for m in mismatches:
            sys.stderr.write(m + "\n")
        return 2

    print(
        f"emitted {inserted_count} questions to {args.out}  "
        f"(drops={skipped_drops}, unclassified={skipped_unclassified})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
