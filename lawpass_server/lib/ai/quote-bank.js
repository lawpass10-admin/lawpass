"use strict";

// Quote locking.
//
// The model is never trusted to reproduce a law or verdict quote. It receives the
// quotes as a read-only bank and may refer to them ONLY through placeholders:
//
//   {{V1}}        -> the citation            ("רע\"א 123-23 אמנון נ' סלמון")
//   {{V1.text}}   -> the verbatim quote text (substituted here, server-side)
//
// So fidelity is structural, not probabilistic: the quote text in the output is
// the same bytes we read out of the PDF, because the model never typed it.
//
// Two failure modes are guarded:
//   1. an unknown placeholder id            -> render throws
//   2. the model retyping a quote inline    -> findQuoteLeaks flags it

const TOKEN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*(\.text)?\s*\}\}/g;

// Hebrew letters + digits only; everything else becomes a separator. Punctuation
// is deliberately ignored — the PDF's bidi layer moves it around, and a leak is
// about words, not commas.
function normalize(s) {
  return String(s)
    .replace(/[^א-ת0-9]+/g, " ")
    .trim();
}

function words(s) {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

function shingles(text, size) {
  const w = words(text);
  const out = new Set();
  for (let i = 0; i + size <= w.length; i++) {
    out.add(w.slice(i, i + size).join(" "));
  }
  return out;
}

/** Quotes belonging to one question, keyed by id. */
function buildBank(allQuotes, questionExternalId) {
  const bank = allQuotes.filter(
    (q) => q.question_external_id === questionExternalId
  );
  if (bank.length === 0) {
    throw new Error(`no quotes found for question ${questionExternalId}`);
  }
  return bank;
}

/** What the model sees: ids, citations, text — explicitly marked immutable. */
function bankForPrompt(bank) {
  return bank.map((q) => ({
    id: q.id,
    type: q.type,
    citation: q.citation,
    text: q.text,
  }));
}

/** Replace every placeholder with the exact stored text. Throws on unknown id. */
function renderTokens(str, bank) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  return String(str).replace(TOKEN, (match, id, dotText) => {
    const quote = byId.get(id);
    if (!quote) {
      throw new Error(`unknown quote placeholder ${match} (known: ${[...byId.keys()].join(", ")})`);
    }
    return dotText ? `"${quote.text}"` : quote.citation;
  });
}

/** Every placeholder id used anywhere in a value tree. */
function collectTokenIds(value, found = new Set()) {
  if (typeof value === "string") {
    for (const m of value.matchAll(TOKEN)) found.add(m[1]);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectTokenIds(v, found));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectTokenIds(v, found));
  }
  return found;
}

/**
 * Detect the model retyping source text instead of using a placeholder.
 *
 * Placeholders and citations are stripped first — repeating a citation is
 * legitimate. What is left is compared against the quotes at word-shingle level.
 */
function findQuoteLeaks(str, bank, shingleSize = 7) {
  let candidate = String(str).replace(TOKEN, " ");
  for (const q of bank) {
    const cite = normalize(q.citation);
    if (cite) candidate = normalize(candidate).split(cite).join(" ");
  }
  const candidateShingles = shingles(candidate, shingleSize);
  if (candidateShingles.size === 0) return [];

  const leaks = [];
  for (const q of bank) {
    for (const sh of shingles(q.text, shingleSize)) {
      if (candidateShingles.has(sh)) {
        leaks.push({ quote_id: q.id, excerpt: sh });
        break; // one hit per quote is enough to reject
      }
    }
  }
  return leaks;
}

/** Walk every string in the tree, applying fn(path, value). */
function walkStrings(value, fn, path = "") {
  if (typeof value === "string") {
    fn(path, value);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walkStrings(v, fn, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      walkStrings(v, fn, path ? `${path}.${k}` : k);
    }
  }
}

/**
 * Gate a generated question before anything downstream touches it.
 * Returns { ok, errors } — never throws on model output, only on programmer error.
 */
function validateGenerated(generated, bank, options = {}) {
  const { forbiddenTerms = [], shingleSize = 7 } = options;
  const knownIds = new Set(bank.map((q) => q.id));
  const errors = [];

  // 1. every placeholder resolves
  for (const id of collectTokenIds(generated)) {
    if (!knownIds.has(id)) {
      errors.push({ type: "unknown_placeholder", detail: `{{${id}}} is not in the quote bank` });
    }
  }

  // 2. no quote text was retyped
  walkStrings(generated, (path, value) => {
    for (const leak of findQuoteLeaks(value, bank, shingleSize)) {
      errors.push({
        type: "quote_leak",
        detail: `${path} reproduces ${leak.quote_id} inline instead of using {{${leak.quote_id}.text}}: "${leak.excerpt}"`,
      });
    }
  });

  // 3. the new question must not recycle the source's people/places
  if (forbiddenTerms.length) {
    walkStrings(generated, (path, value) => {
      const n = normalize(value);
      for (const term of forbiddenTerms) {
        const t = normalize(term);
        if (t && n.split(" ").includes(t)) {
          errors.push({
            type: "reused_source_term",
            detail: `${path} reuses "${term}" from the source question`,
          });
        }
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

/** Substitute placeholders across the whole tree, returning a rendered copy. */
function renderGenerated(generated, bank) {
  if (typeof generated === "string") return renderTokens(generated, bank);
  if (Array.isArray(generated)) return generated.map((v) => renderGenerated(v, bank));
  if (generated && typeof generated === "object") {
    return Object.fromEntries(
      Object.entries(generated).map(([k, v]) => [k, renderGenerated(v, bank)])
    );
  }
  return generated;
}

module.exports = {
  buildBank,
  bankForPrompt,
  renderTokens,
  renderGenerated,
  validateGenerated,
  findQuoteLeaks,
  collectTokenIds,
  normalize,
};
