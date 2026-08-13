"use strict";

// Write a model answer (פתרון) for a generated open writing-task question.
//
// Three inputs shape the output:
//   1. the question itself, with its locked quote bank
//   2. real Bar Association model answers, as structure/register exemplars
//   3. the official rubric (מחוון), as the standard to satisfy
//
// The same quote lock as the question generator applies: the answer cites law
// heavily, and every one of those citations comes from storage, not the model.
//
// A second gate matters here. The exemplars answer a DIFFERENT exam question and
// carry their own sources. An answer that cites a source it was never given is
// simply wrong, so any exemplar citation appearing in the output is rejected.

const { getClient } = require("./client");
const {
  bankForPrompt,
  validateGenerated,
  renderGenerated,
  normalize,
} = require("./quote-bank");

const PROMPT_VERSION = "open-answer/1";

const CORE_RULES = `You write model answers (פתרון לדוגמה) for the Israeli bar exam writing task (מטלת כתיבה).

You are given one question, the legal sources attached to it, real model answers from a different sitting as style exemplars, and the official marking rubric (מחוון).

Write the document the question asks for — a כתב טענות addressed to the court, not an essay about the law.

## The sources are immutable

Refer to a source only through its placeholder:
- {{V1}}       renders as the citation
- {{V1.text}}  renders as the verbatim quoted text

Prefer the placeholder over typing a source's words. Reproducing the wording exactly is accepted and recorded — it is accurate. Reproducing it ALMOST exactly, with a word altered, is rejected: a misstated holding that reads as binding authority is worse than no quotation at all. If unsure of the wording, use {{V1.text}} or paraphrase properly, in clearly different words.

Prefer {{V1}} with the rule stated in your own words, and apply it to these facts. The rubric penalises copying quotations in place of argument, so quote verbatim only where the exact wording carries the point.

## Only the attached sources exist

You may cite ONLY the sources in the quote bank for this question. The exemplar answers cite their own authorities from a different exam — those do not exist here. Citing a source that was not attached is a wrong answer, however apt it seems.

## Use the exemplars for form, not content

Take from them: the heading block, the party designations, numbered paragraphs, sub-headings, how sources are woven into the argument, the closing and signature. Take nothing of their facts, their authorities, or their legal conclusions.

## Use the rubric as the standard

The rubric has three dimensions: לשון (register and precision), ארגון (structure and coherence), and תוכן (legal content and application). Its content checklist was written for a different question — extract the standard it sets, then satisfy the equivalent for this question.

Two things it marks down hard: reciting a source instead of applying it to the facts, and leaning on the question's spoken-register wording instead of writing proper legal Hebrew. Cite each authority in full the first time it appears.

## Output

Hebrew, in the register of a filed pleading. Every paragraph must do work — state a proposition, ground it in a source, apply it to these facts.

Where the answer depends on a document the client would attach, name it as an exhibit rather than inventing its contents.`;

// Answer-side defaults. The tunable file is
// scripts/ingestion/open_questions/llm-params-answers.json.
const DEFAULT_ANSWER_PARAMS = {
  model: { id: "claude-opus-5", max_tokens: 24000, effort: "high" },
  generation: { prompt_version: PROMPT_VERSION, prompt_cache: true },
  authoring: {
    header_block: "",
    facts_discipline: "",
    exhibits_style: "",
    party_perspective: "",
    argument_pattern: "",
    adverse_authority: "",
    register: "",
    structure: "",
    citation_style: "",
    length: "match_exemplars",
    extra_instructions: "",
  },
  validation: {
    leak_shingle_size: 7,
    enforce_forbidden_terms: true,
    reject_foreign_citations: true,
    misquote_window: 8,
    misquote_max_edits: 2,
  },
  forbidden_terms: {},
};

function mergeAnswerParams(overrides = {}) {
  const merged = {};
  for (const section of Object.keys(DEFAULT_ANSWER_PARAMS)) {
    merged[section] = {
      ...DEFAULT_ANSWER_PARAMS[section],
      ...(overrides[section] || {}),
    };
  }
  return merged;
}

const LENGTH_RULE = {
  match_exemplars: "Aim for the length of the exemplar answers.",
  shorter: "Keep it tighter than the exemplars — every paragraph must earn its place.",
  longer: "You may run longer than the exemplars where the extra reasoning is doing real work.",
};

/**
 * Authoring direction for answers, from llm-params-answers.json.
 *
 * The numbered rules come first and under their own heading: they are the
 * marking criteria taken from a reviewed answer, and they decide the score.
 * Style preferences follow.
 */
function buildAnswerSystemPrompt(authoring) {
  const rules = [
    authoring.header_block,
    authoring.facts_discipline,
    authoring.exhibits_style,
    authoring.party_perspective,
    authoring.argument_pattern,
    authoring.adverse_authority,
  ].filter((s) => s && String(s).trim());

  const style = [
    authoring.structure,
    authoring.citation_style,
    LENGTH_RULE[authoring.length] || LENGTH_RULE.match_exemplars,
    authoring.register ? `Register: ${authoring.register}` : "",
    authoring.extra_instructions,
  ].filter((s) => s && String(s).trim());

  let out = CORE_RULES;
  if (rules.length) {
    out += `\n\n## Marking rules — these decide the score\n\n${rules.join("\n\n")}`;
  }
  if (style.length) {
    out += `\n\n## Authoring direction\n\n${style.join("\n\n")}`;
  }
  return out;
}

const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "document_type",
    "court",
    "case_number",
    "parties",
    "service_date",
    "response_deadline",
    "opening",
    "sections",
    "closing",
    "signature_line",
    "sources_used",
    "rubric_coverage",
  ],
  properties: {
    document_type: { type: "string", description: "Hebrew title of the pleading, e.g. תגובה לבקשה לסילוק על הסף" },
    court: { type: "string", description: "Hebrew name of the court" },
    case_number: { type: "string", description: "The case number from the question" },
    parties: {
      type: "object",
      additionalProperties: false,
      description: "Our client comes first in the caption block (RULE 1).",
      required: ["client_name", "client_role", "opposing_name", "opposing_role"],
      properties: {
        client_name: { type: "string", description: "Our client, from the question's facts" },
        client_role: { type: "string", description: "e.g. המשיב/התובע" },
        opposing_name: { type: "string", description: "The other side, from the question's facts" },
        opposing_role: { type: "string", description: "e.g. המבקש/הנתבע" },
      },
    },
    service_date: {
      type: "string",
      description: "מועד המצאת הבקשה — the date from the question, or ??? if it does not say",
    },
    response_deadline: {
      type: "string",
      description: "מועד אחרון להגשת תגובה — the date from the question, or ??? if it does not say",
    },
    opening: { type: "string", description: "The opening sentence stating what the court is asked to do" },
    sections: {
      type: "array",
      description: "The body, in order. Mirrors the exemplars' sub-heading structure.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "paragraphs"],
        properties: {
          heading: { type: "string", description: "Hebrew sub-heading, e.g. הרקע לבקשה / הטיעון המשפטי / לסיכום" },
          paragraphs: {
            type: "array",
            description: "Numbered on render — do not write the numbers yourself.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "exhibit_description", "exhibit_marker"],
              properties: {
                text: { type: "string", description: "The paragraph, in Hebrew" },
                exhibit_description: {
                  type: "string",
                  description:
                    "RULE 2: what the attached document shows, e.g. מסמכים המעידים על אשפוז המשיב. " +
                    "Empty string when this paragraph rests on no document.",
                },
                exhibit_marker: {
                  type: "string",
                  description: "The exhibit number, e.g. 1. Empty string when there is no exhibit.",
                },
              },
            },
          },
        },
      },
    },
    closing: { type: "string", description: "Closing line, e.g. whether an affidavit supports the pleading" },
    signature_line: { type: "string" },
    sources_used: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["quote_id", "role"],
        properties: {
          quote_id: { type: "string" },
          role: { type: "string", description: "Hebrew. What this source does in the argument." },
        },
      },
    },
    rubric_coverage: {
      type: "array",
      description: "How the answer meets the rubric, for the reviewer",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimension", "requirement", "how_met"],
        properties: {
          dimension: { type: "string", enum: ["לשון", "ארגון", "תוכן"] },
          requirement: { type: "string" },
          how_met: { type: "string" },
        },
      },
    },
  },
};

/** Citation-shaped tokens, used to detect authorities borrowed from the exemplars. */
const CITATION_TOKEN =
  /(?:ע"א|רע"א|ת"א|תא|בג"ץ|בש"א|רע"פ|ע"פ|תמ"ש|בר"ע|דנ"א)\s*[\d]+[\d\-/]*/g;

/**
 * Authorities that appear in the exemplars but not in this question's bank.
 * Citing one means the answer invented a source it was never given.
 */
function foreignCitations(exemplarTexts, bank) {
  const mine = new Set();
  for (const q of bank) {
    for (const m of String(q.citation).matchAll(CITATION_TOKEN)) {
      mine.add(normalize(m[0]));
    }
  }

  const foreign = new Map();
  for (const text of exemplarTexts) {
    for (const m of String(text).matchAll(CITATION_TOKEN)) {
      const key = normalize(m[0]);
      if (key && !mine.has(key)) foreign.set(key, m[0].trim());
    }
  }
  return [...foreign.values()];
}

/**
 * Reject an answer that cites an authority borrowed from the exemplars.
 *
 * Matched on token boundaries, not substrings: normalised, the exemplar's
 * "ע\"א 123-23" is a substring of our bank's "רע\"א 123-23", so a plain
 * includes() would reject an answer for correctly citing its own source.
 */
function findForeignCitations(generated, foreign) {
  const flat = ` ${normalize(JSON.stringify(generated))} `;
  return foreign
    .filter((c) => flat.includes(` ${normalize(c)} `))
    .map((c) => ({
      type: "foreign_citation",
      detail: `cites "${c}", which is not among this question's attached sources — it belongs to an exemplar answer from a different exam`,
    }));
}

/**
 * Reject an answer that stopped halfway.
 *
 * Structured output guarantees VALID json, not FINISHED json. When generation
 * runs long the model can close the object early, leaving empty sections and
 * empty tail fields — a document that parses, renders, and is useless. That is
 * exactly what a truncated pleading looks like, and `stop_reason` does not
 * always report it, so the content itself has to be checked.
 */
function findIncompleteAnswer(g) {
  const errors = [];
  const empty = (v) => !v || !String(v).trim();

  (g.sections || []).forEach((s, i) => {
    const paras = s.paragraphs || [];
    if (paras.length === 0) {
      errors.push({
        type: "truncated_output",
        detail: `section "${s.heading}" has no paragraphs — generation stopped before writing it. Raise model.max_tokens (or lower model.effort, which shares the same budget) and retry.`,
      });
    }
    paras.forEach((p, j) => {
      if (empty(typeof p === "string" ? p : p.text)) {
        errors.push({
          type: "truncated_output",
          detail: `sections[${i}].paragraphs[${j}] is empty — generation stopped mid-document.`,
        });
      }
      // a marker is a number or a letter; punctuation means a half-written field
      const marker = typeof p === "string" ? "" : p.exhibit_marker;
      if (marker && !/^[\w֐-׿]+$/.test(String(marker).trim())) {
        errors.push({
          type: "truncated_output",
          detail: `sections[${i}].paragraphs[${j}].exhibit_marker is "${marker}", which is not a usable exhibit number.`,
        });
      }
    });
  });

  if (!g.sections || g.sections.length === 0) {
    errors.push({ type: "truncated_output", detail: "the answer has no sections at all" });
  }
  for (const field of ["closing", "signature_line"]) {
    if (empty(g[field])) {
      errors.push({
        type: "truncated_output",
        detail: `${field} is empty — the pleading has no ending. Generation stopped early.`,
      });
    }
  }
  for (const field of ["sources_used", "rubric_coverage"]) {
    if (!Array.isArray(g[field]) || g[field].length === 0) {
      errors.push({
        type: "truncated_output",
        detail: `${field} is empty — generation stopped before completing the answer.`,
      });
    }
  }
  return errors;
}

async function generateAnswer({
  question,
  bank,
  rubricText,
  exemplars = [],
  forbiddenTerms = [],
  params: paramsOverride = {},
}) {
  const client = getClient();
  const params = mergeAnswerParams(paramsOverride);
  const systemPrompt = buildAnswerSystemPrompt(params.authoring);

  const stable = JSON.stringify(
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
      quote_bank: bankForPrompt(bank),
      rubric: rubricText,
      exemplar_answers: exemplars,
    },
    null,
    2
  );

  const stableBlock = { type: "text", text: stable };
  if (params.generation.prompt_cache) {
    stableBlock.cache_control = { type: "ephemeral" };
  }

  const stream = client.messages.stream({
    model: params.model.id,
    max_tokens: params.model.max_tokens,
    system: [{ type: "text", text: systemPrompt }, stableBlock],
    output_config: {
      effort: params.model.effort,
      format: { type: "json_schema", schema: ANSWER_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content:
          "Write the model answer for this question, satisfying the rubric. " +
          "Use only the attached sources, through their placeholders.",
      },
    ],
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
    misquoteWindow: params.validation.misquote_window,
    misquoteMaxEdits: params.validation.misquote_max_edits,
  });

  for (const e of findIncompleteAnswer(generated)) {
    validation.ok = false;
    validation.errors.push(e);
  }

  const foreign = params.validation.reject_foreign_citations
    ? findForeignCitations(
        generated,
        foreignCitations(exemplars.map((e) => e.text || ""), bank)
      )
    : [];
  if (foreign.length) {
    validation.ok = false;
    validation.errors.push(...foreign);
  }

  return {
    generated,
    rendered: validation.ok ? renderGenerated(generated, bank) : null,
    validation,
    usage: message.usage,
    meta: {
      model: params.model.id,
      prompt_version: params.generation.prompt_version,
      effort: params.model.effort,
      max_tokens: params.model.max_tokens,
      leak_shingle_size: params.validation.leak_shingle_size,
      authoring: params.authoring,
      question_external_id: question.external_id,
    },
  };
}

module.exports = {
  generateAnswer,
  findIncompleteAnswer,
  mergeAnswerParams,
  buildAnswerSystemPrompt,
  DEFAULT_ANSWER_PARAMS,
  foreignCitations,
  findForeignCitations,
  PROMPT_VERSION,
  ANSWER_SCHEMA,
  CORE_RULES,
};
