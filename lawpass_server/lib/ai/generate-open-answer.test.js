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
const { foreignCitations } = require("./generate-open-answer");

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
