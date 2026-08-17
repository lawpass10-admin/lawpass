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
// Source text in the output is always one of three things:
//   1. substituted from a placeholder  -> safe by construction
//   2. byte-identical to the bank      -> verified, recorded, allowed through
//   3. almost identical to the bank    -> a MISQUOTATION, rejected
//
// (3) is the case that matters. A holding reproduced perfectly is correct law; a
// holding reproduced with one word changed reads as binding authority while
// misstating it. An unknown placeholder id makes render throw.

// The id is whatever the source file calls the quote, and those carry hyphens —
// L1-Q1, V2-Q1, one bank per question in a multi-question source. An id shape
// narrower than the real ids is silent damage: the placeholder matches nothing,
// so render leaves {{L1-Q1}} in the text and validation never sees an id to
// check. Keep this in step with the ids in scripts/ingestion/*/sources/.
const TOKEN = /\{\{\s*([A-Za-z][A-Za-z0-9_-]*)\s*(\.text)?\s*\}\}/g;

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
 * Repair an unambiguous placeholder-id slip.
 *
 * The rules teach the syntax with a worked example, {{V1}}, and a bank whose ids
 * carry a per-question suffix — L1-Q1, V2-Q1 — invites the model to copy the
 * example's SHAPE instead of the real id. That is a naming slip, not a content
 * error: the source it reached for is right, only the label is short.
 *
 * So where exactly one bank id extends what it wrote — {{L1}} against a bank
 * holding L1-Q1 — rewrite it and record the repair. Where two could match, leave
 * it alone: validation then rejects it, which is the right outcome for a
 * genuinely ambiguous reference. Never invent a match, and never touch an id
 * that already resolves.
 *
 * Returns { value, repairs }; `value` is a repaired copy, the input untouched.
 */
function repairPlaceholderIds(generated, bank) {
  const known = new Set(bank.map((q) => q.id));
  const mapping = new Map();
  const repairs = [];

  for (const id of collectTokenIds(generated)) {
    if (known.has(id)) continue;
    const candidates = [...known].filter((b) => b.startsWith(`${id}-`) || b.startsWith(`${id}_`));
    if (candidates.length === 1) {
      mapping.set(id, candidates[0]);
      repairs.push({ from: id, to: candidates[0] });
    }
  }
  if (mapping.size === 0) return { value: generated, repairs };

  const fix = (v) => {
    if (typeof v === "string") {
      return v.replace(TOKEN, (match, id, dotText) =>
        mapping.has(id) ? `{{${mapping.get(id)}${dotText || ""}}}` : match
      );
    }
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)]));
    }
    return v;
  };

  return { value: fix(generated), repairs };
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

/**
 * Find spans that are ALMOST a source quote — the source's sentence with a word
 * swapped inside it.
 *
 * This is the dangerous case, and the exact-match check cannot see it. A model
 * that reproduces a holding perfectly has produced correct law; one that
 * reproduces it with a word altered has produced a misquotation of binding
 * authority, which is worse than no quotation at all.
 *
 * The altered word must fall in the window's INTERIOR. A difference at the edge
 * is nearly always a connective joining the quote into the surrounding sentence
 * — "וסילוק" for "סילוק" — and flagging those would reject correct writing.
 *
 * Detects substitutions, not insertions or deletions: an inserted word shifts
 * every position after it, which reads as wholesale difference rather than as a
 * near-miss. Substitution is the realistic failure mode for a recalled holding.
 */
function findMisquotes(str, bank, options = {}) {
  const { windowSize = 12, maxEdits = 2, minFlank = 4 } = options;

  let candidate = String(str).replace(TOKEN, " ");
  for (const q of bank) {
    const cite = normalize(q.citation);
    if (cite) candidate = normalize(candidate).split(cite).join(" ");
  }
  const cw = words(candidate);
  if (cw.length < windowSize) return [];

  const hits = [];
  for (const q of bank) {
    const qw = words(q.text);
    if (qw.length < windowSize) continue;

    let found = null;
    for (let i = 0; i + windowSize <= cw.length && !found; i++) {
      for (let j = 0; j + windowSize <= qw.length; j++) {
        const diffs = [];
        for (let k = 0; k < windowSize; k++) {
          if (cw[i + k] !== qw[j + k]) {
            diffs.push(k);
            if (diffs.length > maxEdits) break;
          }
        }
        if (diffs.length === 0 || diffs.length > maxEdits) continue;

        // An alteration of the quote sits INSIDE a long matching run: several of
        // the source's words on one side, several on the other. Differences near
        // either edge are the surrounding sentence — the words leading into the
        // quotation, or out of it — and flagging those rejects correct writing.
        if (diffs[0] < minFlank) continue;
        if (diffs[diffs.length - 1] > windowSize - 1 - minFlank) continue;

        found = {
          quote_id: q.id,
          edits: diffs.length,
          written: cw.slice(i, i + windowSize).join(" "),
          source: qw.slice(j, j + windowSize).join(" "),
        };
        break;
      }
    }
    if (found) hits.push(found);
  }
  return hits;
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
 * Gate generated output before anything downstream touches it.
 *
 * Returns { ok, errors, verified } — never throws on model output, only on
 * programmer error.
 *
 * On source text the rule is: substituted, or verified, or rejected.
 *   - a placeholder is substituted from the bank        -> safe by construction
 *   - a span that matches the bank exactly is verified  -> safe, and recorded
 *   - a span that ALMOST matches is a misquotation      -> rejected
 *
 * Rejecting exact matches (the old behaviour) had it backwards: it threw away
 * correct work while leaving the one genuinely dangerous case — a holding
 * reproduced with a word altered — completely undetected.
 */
function validateGenerated(generated, bank, options = {}) {
  const {
    forbiddenTerms = [],
    shingleSize = 7,
    misquoteWindow = 12,
    misquoteMaxEdits = 2,
    misquoteMinFlank = 4,
  } = options;
  const knownIds = new Set(bank.map((q) => q.id));
  const errors = [];
  const verified = [];

  // 1. every placeholder resolves
  for (const id of collectTokenIds(generated)) {
    if (!knownIds.has(id)) {
      errors.push({ type: "unknown_placeholder", detail: `{{${id}}} is not in the quote bank` });
    }
  }

  // 2. source text reproduced verbatim — correct, but record it for review
  walkStrings(generated, (path, value) => {
    for (const leak of findQuoteLeaks(value, bank, shingleSize)) {
      verified.push({
        type: "verified_quotation",
        quote_id: leak.quote_id,
        path,
        detail: `${path} reproduces ${leak.quote_id} word for word: "${leak.excerpt}" — byte-identical to the bank, so it is accurate`,
      });
    }
  });

  // 3. source text reproduced ALMOST verbatim — a misquotation of binding authority
  walkStrings(generated, (path, value) => {
    for (const m of findMisquotes(value, bank, {
      windowSize: misquoteWindow,
      maxEdits: misquoteMaxEdits,
      minFlank: misquoteMinFlank,
    })) {
      errors.push({
        type: "misquote",
        detail:
          `${path} misquotes ${m.quote_id} (${m.edits} word(s) changed).\n` +
          `      wrote : "${m.written}"\n` +
          `      source: "${m.source}"\n` +
          `      Use {{${m.quote_id}.text}} to quote it, or paraphrase further from the source's wording.`,
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

  return { ok: errors.length === 0, errors, verified };
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
  findMisquotes,
  bankForPrompt,
  renderTokens,
  renderGenerated,
  repairPlaceholderIds,
  validateGenerated,
  findQuoteLeaks,
  collectTokenIds,
  normalize,
};
