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

test("verbatim source text is detected", () => {
  const lifted = V1.text.split(" ").slice(0, 12).join(" ");
  const leaks = findQuoteLeaks(lifted, bank);
  assert.strictEqual(leaks.length, 1);
  assert.strictEqual(leaks[0].quote_id, "V1");
});

test("a word-for-word reproduction passes, and is recorded as verified", () => {
  // Accurate law. Rejecting it threw away correct work; it is recorded instead
  // so a reviewer can see which spans came from the source.
  const lifted = V1.text.split(" ").slice(0, 12).join(" ");
  const { ok, errors, verified } = validateGenerated(
    { legal_topic_analysis: `כפי שנפסק, ${lifted}` },
    bank
  );
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(ok, true);
  assert.strictEqual(verified.length, 1);
  assert.strictEqual(verified[0].quote_id, "V1");
});

test("a MISQUOTE — the holding with one word altered — is rejected", () => {
  // The dangerous case: it reads as binding authority but misstates it.
  const altered = V1.text.replace("חריג", "נדיר");
  const { ok, errors } = validateGenerated({ analysis: altered }, bank);
  assert.strictEqual(ok, false);
  const m = errors.find((e) => e.type === "misquote");
  assert.ok(m, "an altered holding must be rejected");
  assert.match(m.detail, /V1/);
});

test("a connective joined to a quote is not mistaken for a misquote", () => {
  // "וסילוק" for "סילוק" differs only at the window edge — normal legal writing.
  const joined = "ו" + V1.text.slice(V1.text.indexOf("סילוק"));
  const { ok, errors } = validateGenerated({ analysis: joined }, bank);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(ok, true);
});

test("lead-in words before a quotation are not a misquote", () => {
  // The real false positive: the model wrote its own "...במועד זה, וכי" before
  // reproducing the holding. Those differ from the source's "...תומכים בכך",
  // but they sit outside the quotation, not inside it.
  const holding = V1.text.slice(V1.text.indexOf("סילוק"));
  const { ok, errors } = validateGenerated(
    { analysis: `אף אם הנתבע כלל לא ידע עליה במועד זה, וכי ${holding}` },
    bank
  );
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(ok, true);
});

test("a genuine paraphrase is left alone", () => {
  const { ok } = validateGenerated(
    {
      analysis:
        "סילוק על הסף שמור למקרים נדירים בלבד, שכן הוא חוסם את דרכו של תובע לבית המשפט",
    },
    bank
  );
  assert.strictEqual(ok, true);
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
