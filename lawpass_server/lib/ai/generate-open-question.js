"use strict";

// Generate a new "angle" of an open writing-task question: same legal principle,
// same sources, brand-new facts.
//
// The quotes are NOT regenerated. They are handed to the model read-only and
// referenced through placeholders, then substituted server-side — see lib/ai/quote-bank.js.

const { getClient } = require("./client");
const {
  bankForPrompt,
  validateGenerated,
  renderGenerated,
} = require("./quote-bank");

// Fallbacks used when no params file is supplied. The params file
// (scripts/ingestion/open_questions/llm-params.json) is the intended place to tune.
const DEFAULT_PARAMS = {
  model: { id: "claude-opus-5", max_tokens: 24000, effort: "high" },
  generation: { prompt_version: "open-question-angle/2", prompt_cache: true },
  authoring: {
    difficulty: "match_source",
    fact_pattern_length: "match_source",
    setting_variety: "",
    register: "",
    extra_instructions: "",
  },
  validation: { leak_shingle_size: 7, enforce_forbidden_terms: true },
  forbidden_terms: {},
};

const MODEL = DEFAULT_PARAMS.model.id;
const PROMPT_VERSION = DEFAULT_PARAMS.generation.prompt_version;

/** Shallow-merge per section, so a params file may set only the keys it cares about. */
function mergeParams(overrides = {}) {
  const merged = {};
  for (const section of Object.keys(DEFAULT_PARAMS)) {
    merged[section] = { ...DEFAULT_PARAMS[section], ...(overrides[section] || {}) };
  }
  return merged;
}

// The quote-locking contract. Deliberately NOT exposed in the params file: these
// rules are what make the output trustworthy, and a config file is too easy a
// place to delete them from by accident.
const CORE_RULES = `You author practice questions for the Israeli bar exam (בחינת לשכת עורכי הדין), writing-task section (מטלת כתיבה).

You are given ONE source question and its attached legal sources. Write a NEW question that drills the same legal skill using the SAME sources.

## The sources are immutable

The attached sources are the exact statutory and case-law text the exam gave the candidate. You must never reproduce, paraphrase, translate, correct, abbreviate, or re-punctuate them.

Refer to a source only through its placeholder:
- {{V1}}       renders as the citation
- {{V1.text}}  renders as the verbatim quoted text

The real text is substituted after you finish, outside your output. So write the placeholder wherever you would otherwise have typed the source's words:

WRONG — the source's wording typed out:
  כפי שנקבע ברע"א 123-23 אמנון נ' סלמון: "מרוץ ההתיישנות נפסק עם עצם הגשת התובענה בבית המשפט, גם אם דבר הגשתה לא הובא לידיעת הנתבע".

RIGHT — the same sentence, both halves delegated:
  כפי שנקבע ב{{V1}}: {{V1.text}}

Default to the citation form {{V1}} on its own and state the legal rule in your own words. Reach for {{V1.text}} only where the exact wording is what the argument turns on.

This is checked mechanically: output containing seven consecutive words from any source is rejected in full and nothing is saved. The check does not care whether your reproduction was accurate — the point is that the source's words come from storage, never from you.

## What to preserve

Identify what makes the source question legally hard — the specific tension a competent answer must resolve — and rebuild that same tension from different facts. The new question must be answerable using only the attached sources, at the same level of difficulty, testing the same doctrine.

Where the source turns on dates, sums, or intervals, the new facts must be internally consistent and must recreate the same arithmetic pressure. Compute the dates deliberately: if the source hinged on an act falling just inside or just outside a period, yours must too.

## What to change

New people, new places, new dates, new amounts, new factual setting. Do not reuse any name from the source question. The scenario should read as a plausible Israeli case, not as a relabelled copy of the original.

## Output

Write in Hebrew, in the register of a bar-exam paper. The fact pattern should be comparable in length to the source and must contain no quoted source text at all — it is a story, not an analysis.

fact_pattern, task_instructions, timeline, client_role, deliverable are what the candidate sees.
legal_topic_analysis, model_answer_outline, common_pitfall are for the exam writer and are where placeholders belong.`;

const DIFFICULTY_RULE = {
  match_source: "Pitch the difficulty at the same level as the source question.",
  easy: "Pitch this slightly easier than the source: the same doctrine, with the key facts less buried.",
  medium: "Pitch this at a moderate difficulty.",
  hard: "Pitch this harder than the source: the decisive fact should take real work to spot.",
};

const LENGTH_RULE = {
  match_source: "The fact pattern should be about as long as the source's.",
  shorter: "Keep the fact pattern noticeably shorter than the source's — trim colour, keep every legally operative fact.",
  longer: "The fact pattern may run somewhat longer than the source's, if the extra detail is legally operative.",
};

/** Authoring taste, assembled from the params file and appended to the core rules. */
function buildSystemPrompt(authoring) {
  const lines = [
    DIFFICULTY_RULE[authoring.difficulty] || DIFFICULTY_RULE.match_source,
    LENGTH_RULE[authoring.fact_pattern_length] || LENGTH_RULE.match_source,
    authoring.setting_variety,
    authoring.register ? `Register: ${authoring.register}` : "",
    authoring.extra_instructions,
  ].filter((s) => s && String(s).trim());

  return `${CORE_RULES}\n\n## Authoring direction\n\n${lines.join("\n\n")}`;
}

const ANGLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "angle_letter",
    "angle_title",
    "difficulty_level",
    "client_role",
    "deliverable",
    "fact_pattern",
    "task_instructions",
    "answer_limit",
    "timeline",
    "legal_topic_analysis",
    "model_answer_outline",
    "common_pitfall",
    "quote_usage",
  ],
  properties: {
    angle_letter: { type: "string", description: "Single Hebrew or Latin letter identifying this angle, e.g. A" },
    angle_title: { type: "string", description: "Short Hebrew title for the angle" },
    difficulty_level: { type: "string", enum: ["easy", "medium", "hard"] },
    client_role: { type: "string", description: "Whom the candidate acts for, in Hebrew" },
    deliverable: { type: "string", description: "The document the candidate must write, in Hebrew" },
    fact_pattern: { type: "string", description: "The new scenario in Hebrew. No source quotes." },
    task_instructions: { type: "string", description: "Hebrew instructions to the candidate, mirroring the source's constraints" },
    answer_limit: { type: "string", description: "Length limit, in Hebrew" },
    timeline: {
      type: "array",
      description: "The legally significant dates, in order",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event"],
        properties: {
          date: { type: "string" },
          event: { type: "string" },
        },
      },
    },
    legal_topic_analysis: { type: "string", description: "Hebrew. Why this is the same legal tension as the source. Use placeholders for sources." },
    model_answer_outline: { type: "string", description: "Hebrew. The argument a full-mark answer makes. Use placeholders for sources." },
    common_pitfall: { type: "string", description: "Hebrew. The mistake candidates make here." },
    quote_usage: {
      type: "array",
      description: "One entry per source the answer relies on",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote_id", "role_in_answer"],
        properties: {
          quote_id: { type: "string" },
          role_in_answer: { type: "string", description: "Hebrew. What this source does for the argument." },
        },
      },
    },
  },
};

/**
 * @param {object} args
 * @param {object} args.source            the source question object
 * @param {object[]} args.bank            its quotes (from buildBank)
 * @param {string} [args.angleLetter]     which angle to produce
 * @param {object[]} [args.existingAngles] previously generated angles, to avoid repeats
 * @param {string[]} [args.forbiddenTerms] names from the source that must not reappear
 * @param {string} [args.effort]          low | medium | high | xhigh | max
 */
async function generateAngle({
  source,
  bank,
  angleLetter = "A",
  existingAngles = [],
  forbiddenTerms = [],
  params: paramsOverride = {},
}) {
  const client = getClient();
  const params = mergeParams(paramsOverride);
  const systemPrompt = buildSystemPrompt(params.authoring);

  // Stable prefix: system rules + the source question + the quote bank. Held
  // constant across every angle generated from this source, so the cache breakpoint
  // at the end of it is read rather than rewritten on angles 2..N.
  const sourceBlock = JSON.stringify(
    {
      source_question: {
        external_id: source.external_id,
        title: source.title,
        legal_topics: source.legal_topics,
        client_role: source.client_role,
        deliverable: source.deliverable,
        fact_pattern: source.fact_pattern,
        task_instructions: source.task_instructions,
        answer_limit: source.answer_limit,
        timeline: source.timeline,
      },
      quote_bank: bankForPrompt(bank),
    },
    null,
    2
  );

  const userInstruction = [
    `Write angle ${angleLetter}.`,
    forbiddenTerms.length
      ? `These names appear in the source and must not appear anywhere in your output: ${forbiddenTerms.join(", ")}.`
      : null,
    existingAngles.length
      ? `Angles already written for this source (do not repeat their setting or their twist):\n${existingAngles
          .map((a) => `- ${a.angle_letter}: ${a.angle_title}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const sourceTextBlock = { type: "text", text: sourceBlock };
  if (params.generation.prompt_cache) {
    sourceTextBlock.cache_control = { type: "ephemeral" };
  }

  const stream = client.messages.stream({
    model: params.model.id,
    max_tokens: params.model.max_tokens,
    system: [{ type: "text", text: systemPrompt }, sourceTextBlock],
    output_config: {
      effort: params.model.effort,
      format: { type: "json_schema", schema: ANGLE_SCHEMA },
    },
    messages: [{ role: "user", content: userInstruction }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(`[ai] request refused: ${JSON.stringify(message.stop_details)}`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("[ai] output truncated at max_tokens — raise max_tokens and retry");
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("[ai] no text block in response");

  const generated = JSON.parse(textBlock.text);

  const validation = validateGenerated(generated, bank, {
    forbiddenTerms: params.validation.enforce_forbidden_terms ? forbiddenTerms : [],
    shingleSize: params.validation.leak_shingle_size,
  });
  const rendered = validation.ok ? renderGenerated(generated, bank) : null;

  return {
    generated, // placeholder form — this is what to store
    rendered, // placeholders substituted — what a human reviews
    validation,
    usage: message.usage,
    meta: {
      model: params.model.id,
      prompt_version: params.generation.prompt_version,
      effort: params.model.effort,
      max_tokens: params.model.max_tokens,
      leak_shingle_size: params.validation.leak_shingle_size,
      authoring: params.authoring,
      source_external_id: source.external_id,
      angle_letter: angleLetter,
    },
  };
}

module.exports = {
  generateAngle,
  mergeParams,
  buildSystemPrompt,
  DEFAULT_PARAMS,
  MODEL,
  PROMPT_VERSION,
  ANGLE_SCHEMA,
  CORE_RULES,
};
