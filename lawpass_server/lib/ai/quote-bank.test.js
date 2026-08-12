"use strict";

// node --test lib/ai/
//
// Proves the quote lock does what it claims, using the real extracted quotes.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildBank,
  renderTokens,
  validateGenerated,
  findQuoteLeaks,
} = require("./quote-bank");

const FIXTURE = path.resolve(
  __dirname,
  "../../../scripts/ingestion/open_questions/sources/2025-12-part1-writing.json"
);

const data = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const bank = buildBank(data.quotes, "2025-D-W-Q1");
const V1 = bank.find((q) => q.id === "V1");
const L1 = bank.find((q) => q.id === "L1");

test("bank holds exactly the source question's quotes", () => {
  assert.deepStrictEqual(
    bank.map((q) => q.id),
    ["L1", "V1", "V2", "V3"]
  );
});

test("{{ID}} renders the citation, {{ID.text}} renders the exact quote", () => {
  assert.strictEqual(renderTokens("ראו {{V1}}", bank), `ראו ${V1.citation}`);
  assert.strictEqual(renderTokens("{{L1.text}}", bank), `"${L1.text}"`);
});

test("rendered quote text is byte-identical to the bank", () => {
  const rendered = renderTokens("{{V1.text}}", bank);
  assert.ok(rendered.includes(V1.text), "substituted text must match the stored bytes");
  assert.strictEqual(rendered.length, V1.text.length + 2); // + the wrapping quotes
});

test("unknown placeholder is rejected, not silently dropped", () => {
  assert.throws(() => renderTokens("{{V9}}", bank), /unknown quote placeholder/);
  const { ok, errors } = validateGenerated({ a: "{{V9}}" }, bank);
  assert.strictEqual(ok, false);
  assert.strictEqual(errors[0].type, "unknown_placeholder");
});

test("a model that retypes quote text is caught", () => {
  // a genuine 12-word run lifted out of V1 — exactly the failure mode we fear
  const lifted = V1.text.split(" ").slice(0, 12).join(" ");
  const leaks = findQuoteLeaks(lifted, bank);
  assert.strictEqual(leaks.length, 1);
  assert.strictEqual(leaks[0].quote_id, "V1");

  const { ok, errors } = validateGenerated(
    { legal_topic_analysis: `כפי שנפסק, ${lifted}` },
    bank
  );
  assert.strictEqual(ok, false);
  assert.ok(errors.some((e) => e.type === "quote_leak"));
});

test("the same content via a placeholder passes", () => {
  const { ok } = validateGenerated(
    { legal_topic_analysis: "כפי שנפסק ב{{V1}}: {{V1.text}}" },
    bank
  );
  assert.strictEqual(ok, true);
});

test("citing a source by name is not mistaken for a leak", () => {
  const { ok } = validateGenerated(
    { legal_topic_analysis: `הלכת ${V1.citation} חלה כאן, וכן {{L1}}` },
    bank
  );
  assert.strictEqual(ok, true);
});

test("recycling a name from the source question is caught", () => {
  const { ok, errors } = validateGenerated(
    { fact_pattern: "ביום 1.1.2020 הגיש ריף תביעה" },
    bank,
    { forbiddenTerms: ["ריף", "גל", "דקר"] }
  );
  assert.strictEqual(ok, false);
  assert.strictEqual(errors[0].type, "reused_source_term");
});

test("a clean generated question passes every check", () => {
  const { ok, errors } = validateGenerated(
    {
      fact_pattern: "ביום 3.4.2019 נפגע מר אלון כרמי בתאונה במפעל.",
      legal_topic_analysis: "תקופת ההתיישנות נקבעת ב{{L1}} ומרוצה נעצר לפי {{V1}}.",
      quote_usage: [{ quote_id: "V2", role_in_answer: "השתהות אינה ויתור" }],
    },
    bank,
    { forbiddenTerms: ["ריף", "גל", "דקר", "שונית"] }
  );
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(ok, true);
});
