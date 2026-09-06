"use strict";

// legal-areas.js — one vocabulary for "which area of law is this question about",
// and which reporting bucket that area rolls up into.
//
// THE MAPPING ITSELF LIVES IN ../lib/buckets_mapping.json, not here. It is
// product knowledge — which law belongs to which field, which fields belong
// together on a chart — and it is edited far more often than this code. Keeping
// it as data means it can be changed without touching JavaScript.
//
// ── The two problems this solves ──────────────────────────────────────────
//
// 1. TWO NAMING SYSTEMS. Questions arrive labelled differently depending on what
//    they were built from. A statute-grounded question knows its LAW
//    ("חוק המקרקעין, התשכ\"ט-1969"); a judgment-grounded one knows its AREA
//    ("דיני מקרקעין"), classified on verdict_list. Grouping a history by
//    whichever label happened to be attached put the same subject under two
//    names — חוק המקרקעין beside דיני מקרקעין, פקודת הנזיקין beside דיני נזיקין.
//    `law_areas` maps every law onto the area vocabulary the judgments use.
//
// 2. TOO MANY AREAS TO READ. Even unified, one real diuni paper came out as 23
//    judgment-grounded questions across 23 areas — every one a singleton, and a
//    topic with one question can only ever average 0% or 100%. `buckets` groups
//    the ~74 areas into ~14 categories coarse enough for an average to mean
//    something.
//
// APPLIED AT READ TIME. Nothing is stored: `areaOf` / `getAnswerKey` resolve the
// bucket when a sitting is read. Editing the JSON therefore re-groups every
// attempt already filed as well as every future paper, with no backfill and no
// regeneration.
//
// KEYED BY law_id, NOT BY NAME. The Knesset id is stable; the printed name
// carries punctuation and year formatting that varies between sources, and a map
// keyed on it would start missing silently the first time a name was re-scraped.

const path = require("node:path");

const MAPPING_PATH = path.join(__dirname, "..", "lib", "buckets_mapping.json");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mapping = require(MAPPING_PATH);

/**
 * Fail loudly on a malformed mapping, at load, naming the problem.
 *
 * This file is edited by hand now, so the realistic failure is a typo: an area
 * listed under two buckets, or a law pointing at an area no bucket contains.
 * Both would otherwise degrade quietly — questions filed under the wrong
 * heading, or dropped into "unclassified" — and a wrong number on a revision
 * chart is worse than a server that refuses to start and says why.
 */
function validateMapping(m) {
  const problems = [];

  if (!m || typeof m !== "object") problems.push("the file is not a JSON object");
  if (!m?.buckets || typeof m.buckets !== "object") problems.push("`buckets` is missing");
  if (!m?.law_areas || typeof m.law_areas !== "object") problems.push("`law_areas` is missing");
  if (problems.length) {
    throw new Error(`[legal-areas] ${MAPPING_PATH} is unusable: ${problems.join("; ")}`);
  }

  const seen = new Map();
  for (const [bucket, areas] of Object.entries(m.buckets)) {
    if (!Array.isArray(areas)) {
      problems.push(`bucket "${bucket}" is not an array of areas`);
      continue;
    }
    for (const area of areas) {
      if (seen.has(area)) {
        problems.push(`area "${area}" is in two buckets: "${seen.get(area)}" and "${bucket}"`);
      }
      seen.set(area, bucket);
    }
  }

  for (const [lawId, entry] of Object.entries(m.law_areas)) {
    const area = entry?.area;
    if (!area) {
      problems.push(`law ${lawId} has no "area"`);
      continue;
    }
    // A law may point at an area with no bucket — it then reports under its own
    // name, which is visible rather than wrong. Worth a warning, not an error.
    if (!seen.has(area)) {
      problems.push(
        `law ${lawId} (${entry.law ?? "?"}) points at area "${area}", which is in no bucket`
      );
    }
  }

  if (problems.length) {
    throw new Error(
      `[legal-areas] ${MAPPING_PATH} has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`
    );
  }

  return seen;
}

/** area -> bucket, flattened once at load for O(1) lookup. */
const BUCKET_BY_AREA = validateMapping(mapping);

/** law_id -> area name, in the same Hebrew wording verdict_list uses. */
const AREA_BY_LAW_ID = new Map(
  Object.entries(mapping.law_areas).map(([id, entry]) => [Number(id), entry.area])
);

/**
 * verdict_list carries two ids for one area name — `evidence_law` and
 * `criminal_evidence` are both "דיני ראיות". Grouping by NAME already merges
 * them; this exists for any other synonym pair that shows up later.
 */
const AREA_ALIASES = new Map([]);

/** Normalise an area name to its canonical form. */
function canonicalArea(area) {
  if (!area) return null;
  const trimmed = String(area).replace(/\s+/g, " ").trim();
  return AREA_ALIASES.get(trimmed) ?? (trimmed || null);
}

/**
 * The area a law belongs to, or null when the law is not in the mapping.
 *
 * Returns null rather than guessing from the name: an unmapped law is a real gap
 * that should surface as "ללא סיווג" and be fixed in the JSON, not papered over
 * with a keyword match that silently files it wrong.
 */
function areaForLaw(lawId) {
  if (lawId === null || lawId === undefined) return null;
  return AREA_BY_LAW_ID.get(Number(lawId)) ?? null;
}

/**
 * The reporting bucket an area belongs to.
 *
 * An area with no bucket returns ITSELF rather than null. A vocabulary that
 * grows — a new judgment area added to verdict_list — then shows up under its
 * own name and is visible as a gap to be slotted in, instead of silently
 * vanishing into "unclassified" or, worse, into a bucket it does not belong to.
 */
function bucketForArea(area) {
  const canonical = canonicalArea(area);
  if (!canonical) return null;
  return BUCKET_BY_AREA.get(canonical) ?? canonical;
}

module.exports = {
  areaForLaw,
  canonicalArea,
  bucketForArea,
  AREA_BY_LAW_ID,
  AREA_GROUPS_SPEC: mapping.buckets,
  MAPPING_PATH,
};
