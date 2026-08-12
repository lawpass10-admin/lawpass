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
const { mergeParams } = require("./generate-open-question");

const PROMPT_VERSION = "open-answer/1";

const CORE_RULES = `You write model answers (פתרון לדוגמה) for the Israeli bar exam writing task (מטלת כתיבה).

You are given one question, the legal sources attached to it, real model answers from a different sitting as style exemplars, and the official marking rubric (מחוון).

Write the document the question asks for — a כתב טענות addressed to the court, not an essay about the law.

## The sources are immutable

Refer to a source only through its placeholder:
- {{V1}}       renders as the citation
- {{V1.text}}  renders as the verbatim quoted text

Never type a source's words yourself. Output containing seven consecutive words from any source is rejected in full.

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

const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "document_type",
    "court",
    "case_number",
    "parties",
    "opening",
    "sections",
    "exhibits",
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
      required: ["applicant", "respondent", "applicant_role", "respondent_role"],
      properties: {
        applicant: { type: "string" },
        respondent: { type: "string" },
        applicant_role: { type: "string", description: "e.g. התובע / המשיב" },
        respondent_role: { type: "string", description: "e.g. הנתבע / המבקש" },
      },
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
            items: { type: "string" },
          },
        },
      },
    },
    exhibits: {
      type: "array",
      description: "Documents to attach. Empty if the pleading rests on law alone.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["marker", "description"],
        properties: {
          marker: { type: "string", description: "e.g. 1" },
          description: { type: "string" },
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

async function generateAnswer({
  question,
  bank,
  rubricText,
  exemplars = [],
  forbiddenTerms = [],
  params: paramsOverride = {},
}) {
  const client = getClient();
  const params = mergeParams(paramsOverride);

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
    system: [{ type: "text", text: CORE_RULES }, stableBlock],
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
  });

  const foreign = findForeignCitations(
    generated,
    foreignCitations(exemplars.map((e) => e.text || ""), bank)
  );
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
      prompt_version: PROMPT_VERSION,
      effort: params.model.effort,
      max_tokens: params.model.max_tokens,
      question_external_id: question.external_id,
    },
  };
}

module.exports = {
  generateAnswer,
  foreignCitations,
  findForeignCitations,
  PROMPT_VERSION,
  ANSWER_SCHEMA,
  CORE_RULES,
};
