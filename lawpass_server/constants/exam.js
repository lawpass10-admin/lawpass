"use strict";

// Ported from ../../lib/exam/clusters.ts. Cluster config is a sampling
// mechanism only (never surfaced to users). The module-load invariant is
// retained — it fails loudly if a future edit over-allocates targets.

const SUBSTANTIVE_CHAPTER_CODES = [
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
];

const PROCEDURAL_CLUSTERS = [
  { code: "א", weight: 0.35, target: 14, chapter_codes: ["civil_proc"] },
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
];

const SUBSTANTIVE_CLUSTERS = [
  {
    code: "מ",
    weight: 1.0,
    target: 40,
    chapter_codes: [...SUBSTANTIVE_CHAPTER_CODES],
  },
];

const COMBINED_CLUSTERS = [
  { code: "א", weight: 0.175, target: 7, chapter_codes: ["civil_proc"] },
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
];

// Back-compat: equal to procedural-mode config.
const EXAM_CLUSTERS = PROCEDURAL_CLUSTERS;

function clustersForMode(mode) {
  switch (mode) {
    case "procedural":
      return PROCEDURAL_CLUSTERS;
    case "substantive":
      return SUBSTANTIVE_CLUSTERS;
    case "combined":
      return COMBINED_CLUSTERS;
    default:
      return PROCEDURAL_CLUSTERS;
  }
}

const EXAM_TOTAL_QUESTIONS = 40;
// 100 minutes. Matches the DB default on exam_sessions.total_duration_seconds.
const EXAM_TOTAL_DURATION_SECONDS = 6000;
// Pass = ≥24 of 40 (60%).
const EXAM_PASS_THRESHOLD = 24;

// Module-load invariant — per-cluster targets must not over-allocate.
{
  const modes = ["procedural", "substantive", "combined"];
  for (const mode of modes) {
    const clusters = clustersForMode(mode);
    const sum = clusters.reduce((acc, c) => acc + c.target, 0);
    if (sum > EXAM_TOTAL_QUESTIONS) {
      throw new Error(
        `clustersForMode("${mode}") targets sum to ${sum}, exceeds EXAM_TOTAL_QUESTIONS=${EXAM_TOTAL_QUESTIONS}.`
      );
    }
    for (const c of clusters) {
      if (c.target < 0) {
        throw new Error(
          `clustersForMode("${mode}")[${c.code}].target = ${c.target} is negative.`
        );
      }
    }
  }
}

module.exports = {
  SUBSTANTIVE_CHAPTER_CODES,
  EXAM_CLUSTERS,
  clustersForMode,
  EXAM_TOTAL_QUESTIONS,
  EXAM_TOTAL_DURATION_SECONDS,
  EXAM_PASS_THRESHOLD,
};
