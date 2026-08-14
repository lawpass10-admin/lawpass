"use strict";

// node --test lib/ai/generate-open-answer.test.js
//
// The answer generator adds one gate the question generator does not have:
// an answer may cite ONLY the sources attached to its own question. These tests
// pin that gate, including the near-miss that makes a naive check wrong.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { buildBank } = require("./quote-bank");
const { foreignCitations, findIncompleteAnswer } = require("./generate-open-answer");

const OQ = path.resolve(__dirname, "../../../scripts/ingestion/open_questions");
const source = JSON.parse(
  fs.readFileSync(path.join(OQ, "sources/2025-12-part1-writing.json"), "utf8")
);
const bank = buildBank(source.quotes, "2025-D-W-Q1");

const exemplarText = [
  "2026-summer-q1-answer.json",
  "2026-summer-q2-answer.json",
].map((f) =>
  JSON.parse(fs.readFileSync(path.join(OQ, "answers", f), "utf8"))
    .pages.map((p) => p.text)
    .join("\n")
);

test("exemplar authorities are identified as foreign", () => {
  const foreign = foreignCitations(exemplarText, bank);
  const flat = foreign.join(" | ");
  assert.match(flat, /1234\/25/, "the איגוד הקבלנים appeal belongs to the 2026 exam");
  assert.match(flat, /456-21/, "פרפור נ' נשר belongs to the 2026 exam");
});

test("the question's own authorities are never treated as foreign", () => {
  const foreign = foreignCitations(exemplarText, bank).map((c) =>
    c.replace(/\s+/g, " ")
  );
  // 8877/16 and 2233-14 are ours; they must not appear in the foreign list.
  assert.ok(!foreign.some((c) => c.includes("8877/16")));
  assert.ok(!foreign.some((c) => c.includes("2233-14")));
});

test("a bank citation is not flagged by a shorter foreign one it contains", () => {
  // Normalised, the exemplar's ע"א 123-23 is a substring of our רע"א 123-23.
  // Boundary matching is what stops a correct answer being rejected.
  const { findForeignCitations } = require("./generate-open-answer");
  if (!findForeignCitations) return; // not exported; covered via generateAnswer

  const answer = { body: "כפי שנקבע ברע\"א 123-23 אמנון נ' סלמון, מרוץ ההתיישנות נעצר בהגשה." };
  const hits = findForeignCitations(answer, ['ע"א 123-23']);
  assert.deepStrictEqual(hits, [], "citing our own רע\"א must not match the foreign ע\"א");
});

test("a truncated answer is rejected, a complete one passes", () => {
  // The real failure: generation stopped after the facts, leaving הטיעון המשפטי
  // empty. Structured output kept the JSON valid, so only a content check sees it.
  //
  // The damaged shape is built here rather than read from the run that produced
  // it — that file gets regenerated, and a test must not depend on a bad output
  // staying bad.
  const complete = JSON.parse(
    fs.readFileSync(path.join(OQ, "generated/2025-D-W-Q1-A.answer.json"), "utf8")
  ).answers[0];

  assert.deepStrictEqual(
    findIncompleteAnswer(complete),
    [],
    "a finished answer must pass"
  );

  const truncated = JSON.parse(JSON.stringify(complete));
  truncated.sections[truncated.sections.length - 1].paragraphs = [];
  truncated.closing = "";
  truncated.signature_line = "";
  truncated.sources_used = [];
  truncated.rubric_coverage = [];

  const bad = findIncompleteAnswer(truncated);
  assert.ok(bad.length > 0, "an answer with an empty section must be rejected");
  assert.ok(bad.every((e) => e.type === "truncated_output"));
  assert.ok(bad.some((e) => /has no paragraphs/.test(e.detail)));
  assert.ok(bad.some((e) => /closing is empty/.test(e.detail)));
});

test("a חוות דעת is not rejected for having no signature block", () => {
  // The official 2021 winter answer to question 2 is an opinion for the client,
  // not a filed pleading: no court, no parties, no relief, no signature, ending
  // at מסקנות. The pleading tail check would otherwise reject it as truncated.
  const para = { text: "טקסט", exhibit_description: "", exhibit_marker: "" };
  const opinion = {
    document_type: "חוות דעת בעניין עיכוב ביצוע פסק הדין",
    court: "",
    sections: [
      { heading: "רקע ועובדות המקרה", paragraphs: [para] },
      { heading: "מן הכלל אל הפרט", paragraphs: [para] },
      { heading: "מסקנות", paragraphs: [para] },
    ],
    closing: "",
    signature_line: "",
    sources_used: [{}],
    rubric_coverage: [{}],
  };
  assert.deepStrictEqual(findIncompleteAnswer(opinion), [], "an opinion must pass");

  // A pleading still has to carry both — the relaxation is scoped, not general.
  const pleading = {
    ...opinion,
    document_type: "בקשה לעיכוב הליכים",
    court: "בבית משפט השלום",
  };
  const bad = findIncompleteAnswer(pleading);
  assert.ok(bad.some((e) => /signature_line is empty/.test(e.detail)));
  assert.ok(bad.some((e) => /closing is empty/.test(e.detail)));
});

test("a punctuation exhibit marker is treated as truncation", () => {
  // The run also produced "exhibit_marker": "," — a field caught mid-write.
  const g = {
    sections: [
      {
        heading: "העובדות",
        paragraphs: [{ text: "טקסט", exhibit_description: "", exhibit_marker: "," }],
      },
    ],
    closing: "x",
    signature_line: "x",
    sources_used: [{}],
    rubric_coverage: [{}],
  };
  const bad = findIncompleteAnswer(g);
  assert.ok(bad.some((e) => /not a usable exhibit number/.test(e.detail)));
});
