"use strict";

// Write the grading rubric (מחוון) for one generated writing task.
//
// ── Two different things are called "rubric" in this codebase ───────────────
// The ANSWER generator takes `rubricText` — the exam board's official מחוון,
// used as the standard a model answer must satisfy. That is an INPUT here too,
// but under the name `exemplarRubricText`, because it plays a different part:
// the official document is itself a rubric adapted to one specific question
// ("מחוון מותאם לשאלה 1"), so it is the worked example of the artifact this
// module produces for OUR question.
//
// ── Why this exists ────────────────────────────────────────────────────────
// Grading a student's answer with nothing but the generic criteria table gives
// a different standard on every run: the לשון and ארגון descriptors are generic
// (0–4, same wording for any question), but ממד התוכן is 12 points split across
// the content details THIS question expects, and that split is question-specific.
// Written down once, reviewed by a human, and frozen, it makes two students'
// scores comparable, makes one student's two attempts comparable item by item,
// and makes the whole prompt cacheable — the rubric is identical for every
// student, so only the answer text varies.
//
// ── The invariant that matters ─────────────────────────────────────────────
// The scale is not the model's to choose: לשון 4 + ארגון 4 + תוכן 12 = 20, and
// the content items must sum to exactly 12. A rubric that sums to 11 or 13 is
// rejected rather than normalised — silently rescaling would mean a score that
// no longer matches the marking the examiners actually use.
//
// The rubric is answer-key material: it names what a full answer contains. It
// is stored on the question row and served to the grader, never to a student.

const { getClient } = require("./client");

const PROMPT_VERSION = "open-rubric/1";

/** The three dimensions and their ceilings. Fixed by the exam board, not tunable. */
const SCALE = {
  language: { key: "לשון", max: 4 },
  organization: { key: "ארגון", max: 4 },
  content: { key: "תוכן", max: 12 },
};
const TOTAL_POINTS = SCALE.language.max + SCALE.organization.max + SCALE.content.max;

/**
 * The banding for לשון and ארגון, from the official מחוון's own note: those two
 * dimensions are graded חלש (0 or 1), בינוני (2 or 3), גבוה (4). Held here as a
 * constant so the model writes the DESCRIPTORS and cannot move the band edges —
 * a rubric that scored בינוני as 2–4 would quietly inflate every grade.
 */
const BANDS = [
  { label: "חלש", min: 0, max: 1 },
  { label: "בינוני", min: 2, max: 3 },
  { label: "גבוה", min: 4, max: 4 },
];

/**
 * The heading the model answer's opening is shown under.
 *
 * The opening is a sentence, not a section, so it has no heading of its own —
 * but it is a real place a content item can live (the sentence stating what the
 * court is asked to do carries the relief). Shown to the model under this name
 * and accepted back under it, so the item lands on a named target instead of
 * one the model invents and the grounding check then rejects.
 */
const OPENING_HEADING = "פתיחה";

const CORE_RULES = `You write the marking rubric (מחוון) for one question in the Israeli bar exam writing task (מטלת כתיבה).

You are given three things: the official rubric for a DIFFERENT question (the worked example of what you are producing), the question itself, and the model answer we treat as full marks.

Produce the rubric for the given question.

## The scale is fixed

לשון is worth 4 points, ארגון 4, תוכן 12 — twenty in total. The content items you write must sum to EXACTLY 12. Nothing else is a valid rubric: a marker using it has to arrive at the same total the examiners would.

לשון and ארגון are graded in bands — חלש (0–1), בינוני (2–3), גבוה (4). Those two dimensions are generic: their criteria are the same for every question in the exam, so take their descriptors from the official rubric and restate them cleanly. The extracted text you are given came out of a PDF and carries bidi damage — words in reversed order, numbers detached from their brackets. Repair it into correct Hebrew; do not copy the damage forward, and do not invent criteria the official document does not state.

## The content items are the work

ממד התוכן is where the question actually differs. Split its 12 points across the content details this specific question expects — the identifying particulars, the legal source of the remedy, each element of the legal test that has to be argued, the treatment of the attached sources, the relief, and so on. Derive them from the question and the model answer together.

Write each item as what the STUDENT MUST DO, not as what our answer happens to say. A student who reaches the same point by a different route, citing the same source in different words or ordering the argument differently, earns the item in full. An item phrased as "matches the model answer" is a wrong item.

Weight by what the question is really testing. An item that is mechanical (naming the court) is worth less than the one carrying the legal difficulty. Do not spread the 12 points evenly to make the arithmetic easy.

Give each item its partial-credit rule: what earns half of it rather than all of it. A marker without that rule scores everything all-or-nothing, and no real answer is all-or-nothing.

## Deductions

The official rubric ends with a הורדת נקודות section — the things that cost points inside ממד התוכן however good the rest is (padding the answer with irrelevant facts, quoting a source instead of applying it, relief that does not follow from the argument). Adapt those to this question. Each deduction states the fault and how many points come off.

## Output

Hebrew, in the register of the official document. Every string you write is read by a marker and quoted back to the student in their feedback, so write them to be read by the person who lost the point — precise about what was required, not about who failed.

Never use a source placeholder ({{V1}}, {{L1-Q1}}) in the rubric. The marker sees rendered text, not placeholders, and a rubric item nobody can read is an item nobody can mark.`;

// Answer-side defaults. The tunable file is
// scripts/ingestion/open_questions/llm-params-rubric.json.
const DEFAULT_RUBRIC_PARAMS = {
  model: { id: "claude-opus-5", max_tokens: 16000, effort: "high" },
  generation: {
    prompt_version: PROMPT_VERSION,
    prompt_cache: true,
    // Same reasoning as the answer generator: the official rubric is identical
    // for every question, a run grades several questions back to back, and the
    // 5-minute window expires in the middle of one. Written once per run.
    prompt_cache_ttl: "1h",
  },
  authoring: {
    granularity: "",
    weighting: "",
    partial_credit: "",
    deduction_policy: "",
    extra_instructions: "",
  },
  validation: {
    min_content_items: 4,
    max_content_items: 16,
    // A rubric whose deductions can wipe out half the content mark turns
    // formalities into the whole grade. Warn past this; it is a review signal,
    // not a hard error, because one question may genuinely justify it.
    max_deduction_total: 6,
    // Points are marked in halves. Thirds and quarters cannot be added up by a
    // human checking the grade, which is the whole point of a published rubric.
    points_step: 0.5,
    require_answer_grounding: true,
  },
};

function mergeRubricParams(overrides = {}) {
  const merged = {};
  for (const section of Object.keys(DEFAULT_RUBRIC_PARAMS)) {
    merged[section] = {
      ...DEFAULT_RUBRIC_PARAMS[section],
      ...(overrides[section] || {}),
    };
  }
  return merged;
}

/** Authoring direction from llm-params-rubric.json, appended to the core rules. */
function buildRubricSystemPrompt(authoring = {}) {
  const direction = [
    authoring.granularity,
    authoring.weighting,
    authoring.partial_credit,
    authoring.deduction_policy,
    authoring.extra_instructions,
  ].filter((s) => s && String(s).trim());

  return direction.length
    ? `${CORE_RULES}\n\n## Authoring direction\n\n${direction.join("\n\n")}`
    : CORE_RULES;
}

const BAND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["label", "min_points", "max_points", "descriptor"],
  properties: {
    label: { type: "string", enum: BANDS.map((b) => b.label) },
    min_points: { type: "integer" },
    max_points: { type: "integer" },
    descriptor: {
      type: "string",
      description:
        "Hebrew. What an answer at this band looks like, from the official rubric, " +
        "repaired into readable Hebrew.",
    },
  },
};

const RUBRIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "challenges",
    "criteria",
    "language_bands",
    "organization_bands",
    "content_items",
    "deductions",
  ],
  properties: {
    challenges: {
      type: "string",
      description:
        "Hebrew. האתגרים הבולטים במטלה — what makes THIS question hard, in one " +
        "or two sentences. The official rubric opens with this line.",
    },
    criteria: {
      type: "object",
      additionalProperties: false,
      description: "The generic criteria list for each dimension, as the official rubric states them.",
      required: ["language", "organization", "content"],
      properties: {
        language: { type: "string", description: "Hebrew. הקריטריונים של ממד הלשון." },
        organization: { type: "string", description: "Hebrew. הקריטריונים של ממד הארגון." },
        content: { type: "string", description: "Hebrew. הקריטריונים של ממד התוכן." },
      },
    },
    // No minItems/maxItems: constrained decoding rejects array length bounds
    // above 1. The fixed count of three is enforced by validateRubric, and a
    // duplicated band is trimmed by dedupeBands() before it gets there.
    language_bands: { type: "array", items: BAND_SCHEMA },
    organization_bands: { type: "array", items: BAND_SCHEMA },
    content_items: {
      type: "array",
      description:
        "The 12 points of ממד התוכן, split across what this question expects. " +
        "Ordered as the answer would present them.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "requirement",
          "points",
          "partial_credit",
          "model_answer_section",
        ],
        properties: {
          id: {
            type: "string",
            description:
              'Stable id, C1 upward in order — "C1", "C2". A student\'s second ' +
              "attempt is compared to the first through these, so they are never renumbered.",
          },
          title: { type: "string", description: "Hebrew. Short label, a few words." },
          requirement: {
            type: "string",
            description:
              "Hebrew. What the student must do to earn this item, stated so that any " +
              "route to it counts. This sentence is shown to the student in their feedback.",
          },
          points: {
            type: "number",
            description: "Points this item is worth. Halves allowed. All items sum to exactly 12.",
          },
          partial_credit: {
            type: "string",
            description:
              "Hebrew. What earns part of the item rather than all of it. Empty string " +
              "only where the item is genuinely all-or-nothing.",
          },
          model_answer_section: {
            type: "string",
            description:
              "The heading of the section in OUR model answer that demonstrates this " +
              "item, copied verbatim. Empty string for items that live in the caption " +
              "or header block rather than a section. This is the link the feedback " +
              "screen follows to show what a full answer said.",
          },
        },
      },
    },
    deductions: {
      type: "array",
      description: "הורדת נקודות בממד התוכן — adapted to this question.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "fault", "points_off"],
        properties: {
          id: { type: "string", description: 'Stable id, D1 upward — "D1", "D2".' },
          fault: { type: "string", description: "Hebrew. The fault, and why it costs points." },
          points_off: { type: "number", description: "Points removed. Halves allowed." },
        },
      },
    },
  },
};

/** The rebalance pass returns ids and points only — no prose crosses back. */
const REBALANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "points"],
        properties: {
          id: { type: "string" },
          points: { type: "number" },
        },
      },
    },
  },
};

const HEBREW = /[֐-׿]/;
const PLACEHOLDER = /\{\{[^}]*\}\}/g;

function empty(s) {
  return !s || !String(s).trim();
}

/** Whitespace-insensitive compare, for matching a section heading back to the answer. */
function normalizeHeading(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Trim a repeated band before validation.
 *
 * The count cannot be pinned in the schema — constrained decoding refuses array
 * length bounds above 1 — so the label enum is the only structural guard, and it
 * does not stop the model emitting a fourth band by repeating one. Observed:
 * חלש, בינוני, גבוה, בינוני, where the first three were already correct.
 *
 * Keeps the first entry carrying each expected label, and only when all three
 * are present. Anything else is left to validateRubric: a band array that is
 * wrong in some other way is not a duplicate to be trimmed, and quietly
 * reshaping it would hide a rubric the model got wrong.
 */
function dedupeBands(bands) {
  if (!Array.isArray(bands) || bands.length <= BANDS.length) return null;
  const kept = BANDS.map((expected) =>
    bands.find((b) => b && b.label === expected.label)
  );
  return kept.every(Boolean) ? kept : null;
}

/**
 * Everything that makes a rubric unusable rather than merely imperfect.
 *
 * The point totals are the load-bearing checks: a rubric that does not sum to
 * the exam's own scale produces grades that cannot be defended to a student,
 * and unlike a clumsy sentence it is invisible once the file is loaded.
 */
function validateRubric(rubric, { answerSections = [], params }) {
  const errors = [];
  const warnings = [];
  const v = params.validation;

  const items = Array.isArray(rubric.content_items) ? rubric.content_items : [];

  // ---- the scale ----------------------------------------------------------
  const contentTotal = round2(items.reduce((sum, i) => sum + Number(i.points || 0), 0));
  if (contentTotal !== SCALE.content.max) {
    errors.push({
      type: "point_total",
      detail:
        `content items sum to ${contentTotal}, must be exactly ${SCALE.content.max}. ` +
        `Items: ${items.map((i) => `${i.id}=${i.points}`).join(", ") || "(none)"}`,
    });
  }

  if (items.length < v.min_content_items || items.length > v.max_content_items) {
    errors.push({
      type: "item_count",
      detail:
        `${items.length} content items — expected between ${v.min_content_items} and ` +
        `${v.max_content_items}. Too few cannot discriminate; too many are unmarkable.`,
    });
  }

  const seenIds = new Set();
  items.forEach((item, idx) => {
    const expected = `C${idx + 1}`;
    if (item.id !== expected) {
      errors.push({
        type: "item_id",
        detail: `content_items[${idx}].id is "${item.id}" — must be "${expected}" (sequential from C1)`,
      });
    }
    if (seenIds.has(item.id)) {
      errors.push({ type: "item_id", detail: `duplicate content item id "${item.id}"` });
    }
    seenIds.add(item.id);

    const pts = Number(item.points);
    if (!(pts > 0)) {
      errors.push({ type: "item_points", detail: `${item.id} is worth ${item.points} — must be more than 0` });
    } else if (round2(pts % v.points_step) !== 0) {
      errors.push({
        type: "item_points",
        detail: `${item.id} is worth ${pts} — points must be whole multiples of ${v.points_step}`,
      });
    } else if (pts > SCALE.content.max / 2) {
      warnings.push(
        `${item.id} carries ${pts} of the ${SCALE.content.max} content points — one item holding ` +
          `over half the mark makes the grade nearly binary`
      );
    }

    for (const field of ["title", "requirement"]) {
      if (empty(item[field])) {
        errors.push({ type: "empty_field", detail: `${item.id}.${field} is empty` });
      } else if (!HEBREW.test(item[field])) {
        errors.push({
          type: "not_hebrew",
          detail: `${item.id}.${field} has no Hebrew in it — the student reads this string`,
        });
      }
    }
    if (empty(item.partial_credit)) {
      warnings.push(`${item.id} has no partial-credit rule — it will be marked all-or-nothing`);
    }
  });

  // ---- grounding in our own answer ---------------------------------------
  // An item pointing at a section the answer does not have was not derived from
  // the answer at all. It is the one mechanical check that the rubric describes
  // this question rather than a plausible question.
  if (v.require_answer_grounding && answerSections.length) {
    const headings = new Set(answerSections.map(normalizeHeading));
    for (const item of items) {
      const ref = normalizeHeading(item.model_answer_section);
      if (ref && !headings.has(ref)) {
        errors.push({
          type: "unknown_section",
          detail:
            `${item.id} points at model answer section "${item.model_answer_section}", which ` +
            `the answer does not have. Valid targets: ${[...headings].join(" | ")}`,
        });
      }
    }
    const grounded = items.filter((i) => normalizeHeading(i.model_answer_section)).length;
    if (grounded === 0) {
      warnings.push(
        "no content item names a section of the model answer — nothing links the rubric to " +
          "what a full answer looked like, so the feedback screen has nothing to quote"
      );
    }
  }

  // ---- the two generic dimensions ----------------------------------------
  for (const [field, dimension] of [
    ["language_bands", SCALE.language.key],
    ["organization_bands", SCALE.organization.key],
  ]) {
    const bands = Array.isArray(rubric[field]) ? rubric[field] : [];
    if (bands.length !== BANDS.length) {
      errors.push({
        type: "band_count",
        detail: `${field} has ${bands.length} bands — ממד ${dimension} is graded in exactly ${BANDS.length}`,
      });
      continue;
    }
    BANDS.forEach((expected, idx) => {
      const got = bands[idx] || {};
      if (got.label !== expected.label) {
        errors.push({
          type: "band_label",
          detail: `${field}[${idx}].label is "${got.label}" — expected "${expected.label}" (bands are in fixed order)`,
        });
      }
      if (Number(got.min_points) !== expected.min || Number(got.max_points) !== expected.max) {
        errors.push({
          type: "band_range",
          detail:
            `${field}[${idx}] (${expected.label}) spans ${got.min_points}–${got.max_points}, ` +
            `must be ${expected.min}–${expected.max}. The band edges are the exam's, not the rubric's.`,
        });
      }
      if (empty(got.descriptor) || !HEBREW.test(got.descriptor || "")) {
        errors.push({
          type: "empty_field",
          detail: `${field}[${idx}] (${expected.label}) has no Hebrew descriptor`,
        });
      }
    });
  }

  // ---- deductions ---------------------------------------------------------
  const deductions = Array.isArray(rubric.deductions) ? rubric.deductions : [];
  deductions.forEach((d, idx) => {
    const expected = `D${idx + 1}`;
    if (d.id !== expected) {
      errors.push({ type: "deduction_id", detail: `deductions[${idx}].id is "${d.id}" — must be "${expected}"` });
    }
    const off = Number(d.points_off);
    if (!(off > 0)) {
      errors.push({ type: "deduction_points", detail: `${d.id} removes ${d.points_off} points — must be more than 0` });
    } else if (round2(off % v.points_step) !== 0) {
      errors.push({
        type: "deduction_points",
        detail: `${d.id} removes ${off} — deductions must be whole multiples of ${v.points_step}`,
      });
    }
    if (empty(d.fault) || !HEBREW.test(d.fault || "")) {
      errors.push({ type: "empty_field", detail: `${d.id} has no Hebrew fault description` });
    }
  });
  const deductionTotal = round2(deductions.reduce((sum, d) => sum + Number(d.points_off || 0), 0));
  if (deductionTotal > v.max_deduction_total) {
    warnings.push(
      `deductions can remove ${deductionTotal} of ${SCALE.content.max} content points — past the ` +
        `${v.max_deduction_total} this workspace expects. Check that formalities are not deciding the grade.`
    );
  }

  // ---- prose that has to be readable -------------------------------------
  for (const field of ["challenges"]) {
    if (empty(rubric[field]) || !HEBREW.test(rubric[field] || "")) {
      errors.push({ type: "empty_field", detail: `${field} is empty or not Hebrew` });
    }
  }
  for (const [key, label] of [
    ["language", SCALE.language.key],
    ["organization", SCALE.organization.key],
    ["content", SCALE.content.key],
  ]) {
    const text = rubric.criteria?.[key];
    if (empty(text) || !HEBREW.test(text || "")) {
      errors.push({ type: "empty_field", detail: `criteria.${key} (ממד ${label}) is empty or not Hebrew` });
    }
  }

  // ---- placeholders -------------------------------------------------------
  const stray = [...new Set(JSON.stringify(rubric).match(PLACEHOLDER) ?? [])];
  if (stray.length) {
    errors.push({
      type: "placeholder_leak",
      detail:
        `the rubric still holds ${stray.join(", ")} — the marker and the student see rendered ` +
        `text, so a placeholder here is unreadable to both`,
    });
  }

  return { ok: errors.length === 0, errors, warnings, contentTotal, deductionTotal };
}

/**
 * The system blocks, in the order the API renders them.
 *
 * Same prefix discipline as the answer generator: caching is a prefix match, so
 * the part that repeats across every question in a run — the rules and the
 * official rubric — goes FIRST with the breakpoint after it, and the question
 * and its model answer go last. Reversing them costs the write premium on every
 * call and never reads.
 */
function buildRubricPrompt({ question, answer, exemplarRubricText, params }) {
  const invariantBlock = {
    type: "text",
    text: JSON.stringify(
      {
        official_rubric_for_a_different_question: exemplarRubricText,
        scale: {
          לשון: SCALE.language.max,
          ארגון: SCALE.organization.max,
          תוכן: SCALE.content.max,
          total: TOTAL_POINTS,
        },
        bands: BANDS,
      },
      null,
      2
    ),
  };

  if (params.generation.prompt_cache) {
    invariantBlock.cache_control = {
      type: "ephemeral",
      ttl: params.generation.prompt_cache_ttl,
    };
  }

  return [
    { type: "text", text: buildRubricSystemPrompt(params.authoring) },
    invariantBlock,
    {
      type: "text",
      text: JSON.stringify(
        {
          question: {
            external_id: question.external_id,
            title: question.angle_title || question.title,
            client_role: question.client_role,
            deliverable: question.deliverable,
            fact_pattern: question.fact_pattern,
            task_instructions: question.task_instructions,
            answer_limit: question.answer_limit,
            timeline: question.timeline,
          },
          model_answer: {
            document_type: answer.document_type,
            // Given a heading so it is structurally parallel to a section and
            // can be copied verbatim, like one.
            opening: { heading: OPENING_HEADING, text: answer.opening },
            sections: (answer.sections || []).map((s) => ({
              heading: s.heading,
              paragraphs: (s.paragraphs || []).map((p) => p.text),
            })),
            closing: answer.closing,
            sources_used: answer.sources_used,
            rubric_coverage: answer.rubric_coverage,
          },
        },
        null,
        2
      ),
    },
  ];
}

/**
 * Second pass over the weights alone, when the items are right and the sum is not.
 *
 * The first call reliably produces sensible items and then mis-adds them — the
 * observed failure is a rubric of eleven good items totalling fifteen. Throwing
 * that away and regenerating costs three minutes and a fresh set of items, when
 * the only thing wrong is arithmetic the model can do in isolation.
 *
 * So this sends back nothing but ids, titles and current points, and takes back
 * nothing but ids and points. The Hebrew never makes the round trip, which means
 * a rebalance cannot quietly reword a requirement — the merged rubric is then
 * validated again from scratch, exactly as if it had arrived that way.
 */
async function rebalanceContentPoints(client, { items, params, target }) {
  const stream = client.messages.stream({
    model: params.model.id,
    max_tokens: 2000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: REBALANCE_SCHEMA },
    },
    system: [
      {
        type: "text",
        text:
          "You are correcting the point allocation of a marking rubric. You are given the " +
          "rubric's content items with the points currently attached to each, and a target total.\n\n" +
          "Return the same items, in the same order, with the same ids, and points that add up to " +
          "EXACTLY the target. Every value must be a positive multiple of 0.5.\n\n" +
          "Keep the relative weighting the model already chose: an item currently worth twice " +
          "another should stay worth about twice as much. Take the reduction from the items " +
          "carrying the least legal difficulty — the identifying particulars and the formal " +
          "blocks — before touching the ones carrying the argument.\n\n" +
          "Add your numbers up before answering.",
      },
    ],
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            target_total: target,
            current_total: round2(items.reduce((s, i) => s + Number(i.points || 0), 0)),
            items: items.map((i) => ({ id: i.id, title: i.title, points: i.points })),
          },
          null,
          2
        ),
      },
    ],
  });

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
    return null;
  }
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) return null;

  const corrected = JSON.parse(textBlock.text).items || [];
  const byId = new Map(corrected.map((i) => [i.id, Number(i.points)]));

  // Every original item must come back, or the merge would drop one silently.
  if (items.some((i) => !Number.isFinite(byId.get(i.id)))) return null;

  return {
    items: items.map((i) => ({ ...i, points: byId.get(i.id) })),
    usage: message.usage,
  };
}

/**
 * Build the rubric request without sending it. Same split as the question and
 * answer generators.
 */
function buildRubricRequest({
  question,
  answer,
  exemplarRubricText,
  params: paramsOverride = {},
}) {
  const params = mergeRubricParams(paramsOverride);

  return {
    request: {
    model: params.model.id,
    max_tokens: params.model.max_tokens,
    system: buildRubricPrompt({ question, answer, exemplarRubricText, params }),
    output_config: {
      effort: params.model.effort,
      format: { type: "json_schema", schema: RUBRIC_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content:
          "Write the marking rubric for this question. You have exactly " +
          `${SCALE.content.max} points to distribute across the content items — write the ` +
          "items first, then set the weights and add them up before you answer. A rubric " +
          `whose items total anything other than ${SCALE.content.max} is not usable. ` +
          `Each item states what the student must ` +
          "do, in a way that a student who got there by another route still earns it. " +
          "Name, for each item, the part of the model answer that demonstrates it — " +
          `copy that heading verbatim from the answer above, using "${OPENING_HEADING}" ` +
          "for an item the opening demonstrates. Leave it empty only where the item " +
          "belongs to the caption or header block, which has no heading.",
      },
    ],
    },
    context: { params, question, answer },
  };
}

/**
 * Validate a finished rubric message.
 *
 * ASYNC, AND IT MAY CALL THE MODEL. The one repair this stage makes — the
 * arithmetic rebalance below — depends on the rubric that just came back, so it
 * cannot be part of the same batch. It stays a live call in both transports:
 * it is conditional, small, and rare, and paying list price for the occasional
 * fix is better than either skipping the repair or holding a whole second batch
 * open for it.
 */
async function processRubricMessage(message, context) {
  const { params, answer } = context;
  const client = getClient();

  if (message.stop_reason === "refusal") {
    throw new Error(`[ai] request refused: ${JSON.stringify(message.stop_details)}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("[ai] output truncated at max_tokens — raise max_tokens and retry");
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("[ai] no text block in response");

  const generated = JSON.parse(textBlock.text);
  // The opening counts as a target whenever the answer actually has one — it is
  // shown to the model under OPENING_HEADING, so refusing it back would reject
  // the model for reading the prompt correctly.
  const answerSections = [
    ...(String(answer.opening || "").trim() ? [OPENING_HEADING] : []),
    ...(answer.sections || []).map((s) => s.heading),
  ];
  const repairs = [];

  // The model tends to open `challenges` with the official document's own
  // heading — "האתגרים הבולטים במטלה: ...". Every surface that shows the field
  // prints that heading itself, so left in it renders twice. Stored without it;
  // the label belongs to the view, not to the data.
  if (typeof generated.challenges === "string") {
    generated.challenges = generated.challenges
      .replace(/^\s*האתגרים\s+הבולטים\s+במטלה\s*[:：-]?\s*/u, "")
      .trim();
  }

  for (const field of ["language_bands", "organization_bands"]) {
    const deduped = dedupeBands(generated[field]);
    if (!deduped) continue;
    repairs.push(
      `${field}: dropped ${generated[field].length - BANDS.length} repeated band(s) — ` +
        `kept ${BANDS.map((b) => b.label).join(", ")}`
    );
    generated[field] = deduped;
  }

  let validation = validateRubric(generated, { answerSections, params });

  // One rebalance attempt, and only for the arithmetic. Any other failure means
  // the rubric is wrong about the question rather than about addition, and no
  // amount of re-adding fixes that.
  if (!validation.ok && validation.errors.some((e) => e.type === "point_total")) {
    const before = validation.contentTotal;
    const fixed = await rebalanceContentPoints(client, {
      items: generated.content_items,
      params,
      target: SCALE.content.max,
    });
    if (fixed) {
      generated.content_items = fixed.items;
      validation = validateRubric(generated, { answerSections, params });
      repairs.push(
        `content points rebalanced ${before} -> ${validation.contentTotal} ` +
          `(${fixed.usage?.output_tokens ?? "?"} extra output tokens)`
      );
    }
  }

  return {
    generated,
    validation,
    repairs,
    usage: message.usage,
    meta: {
      model: params.model.id,
      effort: params.model.effort,
      prompt_version: params.generation.prompt_version,
      scale: { לשון: SCALE.language.max, ארגון: SCALE.organization.max, תוכן: SCALE.content.max },
    },
  };
}

/**
 * Write one rubric. Same signature and return value as before — now the
 * composition of the two halves above.
 */
async function generateRubric(args) {
  const client = getClient();
  const { request, context } = buildRubricRequest(args);
  const stream = client.messages.stream(request);
  const message = await stream.finalMessage();
  return processRubricMessage(message, context);
}

module.exports = {
  generateRubric,
  buildRubricRequest,
  processRubricMessage,
  validateRubric,
  dedupeBands,
  buildRubricPrompt,
  mergeRubricParams,
  RUBRIC_SCHEMA,
  SCALE,
  BANDS,
  OPENING_HEADING,
  TOTAL_POINTS,
  PROMPT_VERSION,
};
