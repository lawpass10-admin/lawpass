/**
 * Slice 3 — Exam cluster config.
 * Slice 9 — Multi-mode (procedural / substantive / combined).
 *
 * Maps LawPass chapters (rows in `public.chapters.code`) onto the
 * bar-exam clusters. Three modes ship in Slice 9, each with its own
 * cluster config. All three modes total EXAM_TOTAL_QUESTIONS=40.
 *
 *   procedural (existing): 3 clusters across the procedural pool.
 *     - אשכול א' (35%, 14 questions): civil_proc
 *     - אשכול ב' (27.5%, 11 questions): criminal_proc + evidence + constitutional_intl
 *     - אשכול ג' (32.5%, 13 questions): execution + insolvency_arbitration
 *
 *   substantive (new): 1 cluster spanning all 10 substantive chapter
 *     codes. Target 40 — pool-wide sampling, no per-chapter quota.
 *
 *   combined (new): 4 clusters — the 3 procedural clusters at reduced
 *     targets (7 / 6 / 7) plus 1 substantive cluster at target 20.
 *     Sums to 40 exactly.
 *
 * This file is a config single-source. Future remapping = config edit
 * here. The module-load invariant at the bottom fails loudly if any
 * future edit breaks the per-cluster target sum (for any mode).
 */

export type ExamMode = "procedural" | "substantive" | "combined";

/** Cluster codes used in the UI (procedural א/ב/ג) plus the substantive
 *  cluster code "מ" (used in substantive + combined modes). String-typed
 *  to remain open for future cluster additions without a type widening
 *  edit in every consumer. */
export type ExamClusterCode = string;

export type ExamCluster = {
  code: ExamClusterCode;
  /** Target proportion of EXAM_TOTAL_QUESTIONS (informational; the
   *  authoritative count is `target`). */
  weight: number;
  /** Integer count of questions per exam from this cluster. Must sum
   *  across all clusters to ≤ EXAM_TOTAL_QUESTIONS (any shortfall is
   *  picked up by the global padding pass). */
  target: number;
  /** LawPass `chapters.code` values that belong to this cluster. */
  chapter_codes: string[];
};

/** All 10 substantive chapter codes. PM-locked in Slice 9 Phase A. */
export const SUBSTANTIVE_CHAPTER_CODES = [
  "contracts",
  "property",
  "criminal_substantive",
  "corporate",
  "labor",
  "family_inheritance",
  "administrative",
  "tax",
  "ethics",
  "torts",
] as const;

const PROCEDURAL_CLUSTERS: readonly ExamCluster[] = [
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

const SUBSTANTIVE_CLUSTERS: readonly ExamCluster[] = [
  {
    code: "מ",
    weight: 1.0,
    target: 40,
    chapter_codes: [...SUBSTANTIVE_CHAPTER_CODES],
  },
] as const;

const COMBINED_CLUSTERS: readonly ExamCluster[] = [
  {
    code: "א",
    weight: 0.175,
    target: 7,
    chapter_codes: ["civil_proc"],
  },
  {
    code: "ב",
    weight: 0.15,
    target: 6,
    chapter_codes: ["criminal_proc", "evidence", "constitutional_intl"],
  },
  {
    code: "ג",
    weight: 0.175,
    target: 7,
    chapter_codes: ["execution", "insolvency_arbitration"],
  },
  {
    code: "מ",
    weight: 0.5,
    target: 20,
    chapter_codes: [...SUBSTANTIVE_CHAPTER_CODES],
  },
] as const;

/** Back-compat export — the original Slice 3 surface. Equal to the
 *  procedural-mode cluster config. Existing callers (and the slice-3
 *  test suite) keep working unchanged. */
export const EXAM_CLUSTERS: readonly ExamCluster[] = PROCEDURAL_CLUSTERS;

/** Returns the cluster config for the requested exam mode. The result
 *  is `readonly` — callers must not mutate. */
export function clustersForMode(mode: ExamMode): readonly ExamCluster[] {
  switch (mode) {
    case "procedural":
      return PROCEDURAL_CLUSTERS;
    case "substantive":
      return SUBSTANTIVE_CLUSTERS;
    case "combined":
      return COMBINED_CLUSTERS;
  }
}

export const EXAM_TOTAL_QUESTIONS = 40;

/** 100 minutes. Matches the DB default on `exam_sessions.total_duration_seconds`. */
export const EXAM_TOTAL_DURATION_SECONDS = 6000;

/** Pass = ≥24 of 40 (60%). */
export const EXAM_PASS_THRESHOLD = 24;

// Module-load invariant — verified once at import time. For every mode
// the per-cluster integer targets must sum to ≤ EXAM_TOTAL_QUESTIONS.
// In procedural mode the weights (35% / 27.5% / 32.5%) sum to 95%, so
// targets sum to 38 and the remaining 2 slots come from the global
// padding pass inside `bucketAndShuffleExamPool`. The invariant
// therefore enforces "targets must not OVER-allocate" rather than
// equality — over-allocation would break the per-cluster picker before
// padding ever runs. Negative targets are also rejected.
{
  const modes: ExamMode[] = ["procedural", "substantive", "combined"];
  for (const mode of modes) {
    const clusters = clustersForMode(mode);
    const sum = clusters.reduce((acc, c) => acc + c.target, 0);
    if (sum > EXAM_TOTAL_QUESTIONS) {
      throw new Error(
        `clustersForMode("${mode}") targets sum to ${sum}, exceeds ` +
          `EXAM_TOTAL_QUESTIONS=${EXAM_TOTAL_QUESTIONS}. ` +
          "Check lib/exam/clusters.ts."
      );
    }
    for (const c of clusters) {
      if (c.target < 0) {
        throw new Error(
          `clustersForMode("${mode}")[${c.code}].target = ${c.target} ` +
            "is negative. Check lib/exam/clusters.ts."
        );
      }
    }
  }
}
