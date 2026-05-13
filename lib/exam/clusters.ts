/**
 * Slice 3 — Exam cluster config.
 *
 * Maps LawPass chapters (the 6 codes in `public.chapters.code`) onto the
 * 3 official bar-exam clusters (א / ב / ג). PM-confirmed split:
 *   - אשכול א' (35%, 14 questions): civil_proc
 *   - אשכול ב' (27.5%, 11 questions): criminal_proc + evidence + constitutional_intl
 *   - אשכול ג' (32.5%, 13 questions): execution + insolvency_arbitration
 *
 * This file is a config single-source. Future remapping (e.g. moving
 * `evidence` into cluster ג, or adding cluster ד) = config edit here.
 *
 * The module-load invariant at the bottom fails loudly if any future
 * edit breaks the per-cluster target sum. Catches the kind of edit
 * where someone tweaks one target without rebalancing the others.
 */

export type ExamClusterCode = "א" | "ב" | "ג";

export type ExamCluster = {
  code: ExamClusterCode;
  /** Target proportion of EXAM_TOTAL_QUESTIONS (informational; the
   *  authoritative count is `target`). */
  weight: number;
  /** Integer count of questions per exam from this cluster. Must sum
   *  across all clusters to EXAM_TOTAL_QUESTIONS. */
  target: number;
  /** LawPass `chapters.code` values that belong to this cluster. */
  chapter_codes: string[];
};

export const EXAM_CLUSTERS: readonly ExamCluster[] = [
  {
    code: "א",
    weight: 0.35,
    target: 14,
    chapter_codes: ["civil_proc"],
  },
  {
    code: "ב",
    weight: 0.275,
    target: 11,
    chapter_codes: ["criminal_proc", "evidence", "constitutional_intl"],
  },
  {
    code: "ג",
    weight: 0.325,
    target: 13,
    chapter_codes: ["execution", "insolvency_arbitration"],
  },
] as const;

export const EXAM_TOTAL_QUESTIONS = 40;

/** 100 minutes. Matches the DB default on `exam_sessions.total_duration_seconds`. */
export const EXAM_TOTAL_DURATION_SECONDS = 6000;

/** Pass = ≥24 of 40 (60%). */
export const EXAM_PASS_THRESHOLD = 24;

// Module-load invariant — verified once at import time. Fail loudly if a
// future edit drifts the per-cluster targets away from the total. This
// runs once per server boot; cost is negligible.
{
  const sum = EXAM_CLUSTERS.reduce((acc, c) => acc + c.target, 0);
  if (sum !== EXAM_TOTAL_QUESTIONS) {
    throw new Error(
      `EXAM_CLUSTERS targets sum to ${sum}, expected ${EXAM_TOTAL_QUESTIONS}. ` +
        "Check lib/exam/clusters.ts."
    );
  }
}
