"use strict";

// Grade one student answer to a writing task (מטלת כתיבה) against the question's
// approved rubric.
//
// ── What the model decides, and what it does not ───────────────────────────
// The model decides ONE thing per rubric item: did this student earn it, in full,
// in part, or not at all — and it must quote the student's own words as evidence.
// It does not decide the total. Every sum here is computed in code from the item
// awards, because arithmetic is the one part of this the model has already been
// observed to get wrong (twice, during rubric generation), and a wrong total is
// invisible to a reader who only sees the number.
//
// ── Grading the requirement, not the resemblance ───────────────────────────
// The model answer is supplied as context, and that is a real risk: an answer
// that reaches the same conclusion by another route can look "wrong" beside it.
// The prompt is explicit that the rubric item is the standard and the model
// answer is one way of satisfying it. The evidence quote is what keeps this
// honest — a point awarded or denied has to point at something the student
// actually wrote.
//
// ── Never shown a student's identity ───────────────────────────────────────
// The grader receives the answer text and nothing else about who wrote it.

const { getClient } = require("./client");

const PROMPT_VERSION = "open-grade/1";

const CORE_RULES = `You mark one candidate's answer to the Israeli bar exam writing task (מטלת כתיבה).

You are given the question, the official marking rubric for it, a model answer that would earn full marks, and the candidate's answer.

## Mark against the rubric, not against the model answer

The rubric item is the standard. The model answer shows one way of satisfying it — one route among several. A candidate who reaches the same point by a different route, citing the same source in different words, ordering the argument differently, or arguing it more briefly, earns the item IN FULL. Never deduct for departing from the model answer's structure, phrasing or emphasis.

Deduct only what the rubric describes.

## Every award needs evidence

For each item, quote the candidate's own words — verbatim, copied exactly from their answer — that earned it. If you cannot find words that earn the item, that is the finding: award nothing and leave the quote empty. Do not paraphrase the candidate, do not repair their Hebrew, and never quote the model answer.

An item earns partial credit only where the rubric's partial-credit rule describes what the candidate actually did.

## The two generic dimensions

Mark לשון and ארגון by choosing the band whose descriptor fits the answer as a whole, then the points within that band. These are about how it is written, not about whether the law is right — an answer that reaches the wrong conclusion in flawless legal Hebrew still scores well on לשון.

## Deductions

Apply a deduction only when the fault it describes is actually present, and say where. A deduction is not a second penalty for something an item already scored low.

## Writing the comments

Hebrew, addressed to the candidate, in the second person. Say what was required and what their answer did — not "the candidate failed to". Where a point was lost, the comment should tell them what would have earned it. This text appears on their results screen exactly as you write it.`;

const DEFAULT_GRADE_PARAMS = {
  model: { id: "claude-opus-5", max_tokens: 16000, effort: "high" },
  generation: {
    prompt_version: PROMPT_VERSION,
    prompt_cache: true,
    // The question, rubric and model answer are identical for every student
    // sitting this task, so the cached prefix is read by every submission after
    // the first. An hour holds across a burst of students working together.
    prompt_cache_ttl: "1h",
  },
  validation: {
    points_step: 0.5,
    // An evidence quote that is not in the answer means the grader described
    // something the student did not write. The award is kept but flagged rather
    // than dropped: a real misquote is usually a lightly-normalised quote, and
    // deleting the award would punish the student for the grader's tidying.
    require_verbatim_evidence: true,
  },
};

function mergeGradeParams(overrides = {}) {
  const merged = {};
  for (const section of Object.keys(DEFAULT_GRADE_PARAMS)) {
    merged[section] = { ...DEFAULT_GRADE_PARAMS[section], ...(overrides[section] || {}) };
  }
  return merged;
}

const GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["content_items", "deductions_applied", "language", "organization", "summary"],
  properties: {
    content_items: {
      type: "array",
      description: "One entry for EVERY item in the rubric, in the rubric's order. Never invent an item.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "verdict", "points_awarded", "evidence", "comment"],
        properties: {
          id: { type: "string", description: "The rubric item id, e.g. C3." },
          verdict: {
            type: "string",
            enum: ["full", "partial", "none"],
            description: "full = the item is satisfied; partial = the rubric's partial rule fits; none = not earned.",
          },
          points_awarded: {
            type: "number",
            description: "Between 0 and the item's maximum, in steps of 0.5.",
          },
          evidence: {
            type: "string",
            description:
              "The candidate's own words that earned this, copied EXACTLY from their answer. " +
              "Empty string when nothing in the answer earns it.",
          },
          comment: {
            type: "string",
            description:
              "Hebrew, to the candidate. What was required and what their answer did. " +
              "Where points were lost, what would have earned them.",
          },
        },
      },
    },
    deductions_applied: {
      type: "array",
      description: "Only deductions from the rubric that genuinely apply. Usually empty or one.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "reason"],
        properties: {
          id: { type: "string", description: "The rubric deduction id, e.g. D2." },
          reason: { type: "string", description: "Hebrew. Where in the answer the fault appears." },
        },
      },
    },
    language: {
      type: "object",
      additionalProperties: false,
      required: ["band", "points", "comment"],
      properties: {
        band: { type: "string", enum: ["חלש", "בינוני", "גבוה"] },
        points: { type: "number" },
        comment: { type: "string", description: "Hebrew, to the candidate." },
      },
    },
    organization: {
      type: "object",
      additionalProperties: false,
      required: ["band", "points", "comment"],
      properties: {
        band: { type: "string", enum: ["חלש", "בינוני", "גבוה"] },
        points: { type: "number" },
        comment: { type: "string", description: "Hebrew, to the candidate." },
      },
    },
    summary: {
      type: "string",
      description:
        "Hebrew, two or three sentences to the candidate: the strongest thing about the " +
        "answer and the one change that would gain the most marks next time.",
    },
  },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Whitespace-insensitive containment, for checking a quote came from the answer. */
function normalizeText(s) {
  return String(s || "")
    .replace(/[‎‏]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Turn the model's per-item findings into a score.
 *
 * Every total here is arithmetic this function performs. The model's own view of
 * the totals is never read, and the schema does not even ask for it.
 */
function buildScore(graded, rubric, studentText, params) {
  const errors = [];
  const warnings = [];
  const v = params.validation;

  const items = rubric?.dimensions?.content?.items ?? [];
  const deductions = rubric?.deductions ?? [];
  const contentMax = Number(rubric?.dimensions?.content?.max_points ?? 12);
  const languageMax = Number(rubric?.dimensions?.language?.max_points ?? 4);
  const organizationMax = Number(rubric?.dimensions?.organization?.max_points ?? 4);

  const byId = new Map(items.map((i) => [i.id, i]));
  const graded_by_id = new Map();
  for (const entry of graded.content_items ?? []) {
    if (!byId.has(entry.id)) {
      errors.push(`graded an item "${entry.id}" that is not in the rubric`);
      continue;
    }
    if (graded_by_id.has(entry.id)) {
      errors.push(`item ${entry.id} graded twice`);
      continue;
    }
    graded_by_id.set(entry.id, entry);
  }
  for (const item of items) {
    if (!graded_by_id.has(item.id)) errors.push(`item ${item.id} (${item.title}) was not graded`);
  }
  if (errors.length) return { ok: false, errors, warnings, score: null };

  const answerNormalized = normalizeText(studentText);

  const scoredItems = items.map((item) => {
    const entry = graded_by_id.get(item.id);
    const max = Number(item.points);
    let awarded = Number(entry.points_awarded);

    if (!Number.isFinite(awarded) || awarded < 0) {
      warnings.push(`${item.id}: awarded ${entry.points_awarded}, read as 0`);
      awarded = 0;
    }
    if (awarded > max) {
      warnings.push(`${item.id}: awarded ${awarded} of a possible ${max} — capped`);
      awarded = max;
    }
    if (round2(awarded % v.points_step) !== 0) {
      const snapped = Math.round(awarded / v.points_step) * v.points_step;
      warnings.push(`${item.id}: awarded ${awarded}, snapped to ${snapped}`);
      awarded = snapped;
    }
    // A verdict and an award that disagree confuse the reader more than either
    // alone; the number is what counts, so the verdict is derived from it.
    const verdict = awarded >= max ? "full" : awarded > 0 ? "partial" : "none";
    if (verdict !== entry.verdict) {
      warnings.push(`${item.id}: verdict "${entry.verdict}" did not match ${awarded}/${max} — shown as "${verdict}"`);
    }

    let evidence = String(entry.evidence || "").trim();
    let evidenceVerified = true;
    if (evidence && v.require_verbatim_evidence) {
      evidenceVerified = answerNormalized.includes(normalizeText(evidence));
      if (!evidenceVerified) {
        warnings.push(`${item.id}: evidence quote is not verbatim in the answer`);
      }
    }

    return {
      id: item.id,
      title: item.title,
      requirement: item.requirement,
      points_awarded: round2(awarded),
      points_max: max,
      verdict,
      comment: String(entry.comment || "").trim(),
      evidence,
      evidence_verified: evidenceVerified,
      model_answer_section: item.model_answer_section || "",
    };
  });

  const deductionById = new Map(deductions.map((d) => [d.id, d]));
  const appliedDeductions = [];
  for (const applied of graded.deductions_applied ?? []) {
    const d = deductionById.get(applied.id);
    if (!d) {
      warnings.push(`deduction "${applied.id}" is not in the rubric — ignored`);
      continue;
    }
    if (appliedDeductions.some((x) => x.id === d.id)) continue;
    appliedDeductions.push({
      id: d.id,
      fault: d.fault,
      points_off: Number(d.points_off),
      reason: String(applied.reason || "").trim(),
    });
  }

  const itemsTotal = round2(scoredItems.reduce((s, i) => s + i.points_awarded, 0));
  const deductionTotal = round2(appliedDeductions.reduce((s, d) => s + d.points_off, 0));
  // Deductions cannot push a dimension below zero — the rubric's own ceiling is
  // 12, and a negative content mark is not a thing the exam recognises.
  const contentAwarded = round2(Math.max(0, Math.min(contentMax, itemsTotal - deductionTotal)));

  const band = (dimension, given, max) => {
    const bands = rubric?.dimensions?.[dimension]?.bands ?? [];
    const chosen = bands.find((b) => b.label === given.band);
    let points = Number(given.points);
    if (!Number.isFinite(points)) {
      warnings.push(`${dimension}: points "${given.points}" unreadable, read as 0`);
      points = 0;
    }
    // The band the grader named is authoritative over the number it typed: the
    // descriptors are what it actually reasoned about.
    if (chosen && (points < chosen.min_points || points > chosen.max_points)) {
      const clamped = Math.min(chosen.max_points, Math.max(chosen.min_points, points));
      warnings.push(`${dimension}: ${points} is outside band "${given.band}" (${chosen.min_points}-${chosen.max_points}) — set to ${clamped}`);
      points = clamped;
    }
    points = Math.max(0, Math.min(max, Math.round(points)));
    return {
      awarded: points,
      max,
      band: given.band,
      comment: String(given.comment || "").trim(),
    };
  };

  const language = band("language", graded.language ?? {}, languageMax);
  const organization = band("organization", graded.organization ?? {}, organizationMax);

  const total = round2(contentAwarded + language.awarded + organization.awarded);
  const max = round2(contentMax + languageMax + organizationMax);

  return {
    ok: true,
    errors,
    warnings,
    score: {
      total,
      max,
      dimensions: {
        content: {
          awarded: contentAwarded,
          max: contentMax,
          items_total: itemsTotal,
          deductions_total: deductionTotal,
          criteria: rubric?.dimensions?.content?.criteria ?? "",
          items: scoredItems,
          deductions_applied: appliedDeductions,
        },
        language: { ...language, criteria: rubric?.dimensions?.language?.criteria ?? "" },
        organization: { ...organization, criteria: rubric?.dimensions?.organization?.criteria ?? "" },
      },
      summary: String(graded.summary || "").trim(),
    },
  };
}

/**
 * The system blocks, in render order.
 *
 * Everything about the QUESTION — paper, rubric, model answer — is identical for
 * every student sitting this task, so it goes first behind the cache breakpoint
 * and is read rather than rewritten from the second submission onward. The
 * student's answer, the only part that varies, goes last.
 */
function buildGradePrompt({ question, modelAnswer, rubric, params }) {
  const invariantBlock = {
    type: "text",
    text: JSON.stringify(
      {
        question: {
          title: question.angle_title || question.title,
          client_role: question.client_role,
          deliverable: question.deliverable,
          fact_pattern: question.fact_pattern,
          task_instructions: question.task_instructions,
          answer_limit: question.answer_limit,
          timeline: question.timeline,
        },
        rubric,
        model_answer: modelAnswer
          ? {
              document_type: modelAnswer.document_type,
              opening: modelAnswer.opening,
              sections: (modelAnswer.sections || []).map((s) => ({
                heading: s.heading,
                paragraphs: (s.paragraphs || []).map((p) => p.text ?? p),
              })),
              closing: modelAnswer.closing,
            }
          : null,
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

  return [{ type: "text", text: CORE_RULES }, invariantBlock];
}

async function gradeAnswer({
  question,
  modelAnswer,
  rubric,
  studentText,
  params: paramsOverride = {},
}) {
  if (!rubric?.dimensions?.content?.items?.length) {
    throw new Error("[grade] the rubric has no content items — nothing to mark against");
  }
  if (!String(studentText || "").trim()) {
    throw new Error("[grade] the answer is empty");
  }

  const client = getClient();
  const params = mergeGradeParams(paramsOverride);

  const stream = client.messages.stream({
    model: params.model.id,
    max_tokens: params.model.max_tokens,
    system: buildGradePrompt({ question, modelAnswer, rubric, params }),
    output_config: {
      effort: params.model.effort,
      format: { type: "json_schema", schema: GRADE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content:
          "Mark the candidate's answer below against the rubric. Return one entry for every " +
          "rubric item, in the rubric's order, each with the candidate's own words as evidence.\n\n" +
          "--- CANDIDATE'S ANSWER ---\n" +
          studentText,
      },
    ],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`[grade] request refused: ${JSON.stringify(message.stop_details)}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("[grade] output truncated at max_tokens — raise max_tokens and retry");
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("[grade] no text block in response");

  const result = buildScore(JSON.parse(textBlock.text), rubric, studentText, params);
  if (!result.ok) {
    throw new Error(`[grade] unusable marking: ${result.errors.join("; ")}`);
  }

  return {
    score: {
      ...result.score,
      meta: {
        model: params.model.id,
        effort: params.model.effort,
        prompt_version: params.generation.prompt_version,
        warnings: result.warnings,
      },
    },
    warnings: result.warnings,
    usage: message.usage,
  };
}

module.exports = {
  gradeAnswer,
  buildScore,
  buildGradePrompt,
  mergeGradeParams,
  GRADE_SCHEMA,
  PROMPT_VERSION,
};
