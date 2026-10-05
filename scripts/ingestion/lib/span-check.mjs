// max_shared_ngram, as diuni_and_mhuti-LLM-params.json v1.1.0 defines it.
//
// One implementation, used by the converter at run time and by the standalone
// reporter. A check that lives only in a reporting script is a check the
// pipeline does not actually apply — which is exactly what v1.1.0's `status`
// had to admit before this file existed.
//
// MAXIMAL SPANS, NOT N-GRAMS. A 9-word shared run contains four overlapping
// 6-grams and is one phrase. Counting grams inflated the first measurement of
// the מהותי books from 319 phrases to 657 findings.

/** Tier boundaries from the contract. Only 12+ blocks a run. */
export const TIERS = {
  report: 6,
  review: 9,
  block: 12,
};

export const normalise = (s) =>
  String(s ?? "")
    .replace(/[”“״"'׳]/g, "")
    .replace(/[־–—-]/g, " ");

export const toWords = (s) => (normalise(s).match(/[֐-׿]+|\d+/g) ?? []);

/** Statute text at every depth — the corpus nests paragraphs inside
 *  subsections, and a flat read loses more than half of a long section. */
export const deepStatuteText = (section) => {
  const out = [section.text ?? ""];
  for (const sub of section.subsections ?? []) {
    out.push(sub.text ?? "");
    for (const p of sub.paragraphs ?? []) out.push(p.text ?? "");
  }
  return out.filter(Boolean).join("\n");
};

const gramSet = (words, n) => {
  const set = new Set();
  for (let i = 0; i + n <= words.length; i += 1) set.add(words.slice(i, i + n).join(" "));
  return set;
};

/**
 * Every maximal run of >= TIERS.report words that appears in both texts and is
 * not statutory language.
 *
 * `statuteWords` is excluded because both sides quote the same law; a match
 * there is correctness, not copying.
 */
export function sharedSpans(authored, sourceWords, statuteWords) {
  const a = toWords(authored);
  const n = TIERS.report;
  const statGrams = gramSet(statuteWords, n);

  // Index the source by its n-grams so each authored position has anchors to
  // extend from, rather than scanning the whole book per position.
  const index = new Map();
  for (let j = 0; j + n <= sourceWords.length; j += 1) {
    const key = sourceWords.slice(j, j + n).join(" ");
    let at = index.get(key);
    if (!at) index.set(key, (at = []));
    if (at.length < 24) at.push(j); // a handful of anchors finds the longest run
  }

  const spans = [];
  let i = 0;
  while (i + n <= a.length) {
    const key = a.slice(i, i + n).join(" ");
    const anchors = index.get(key);
    if (!anchors) { i += 1; continue; }
    let best = n;
    for (const j of anchors) {
      let len = n;
      while (i + len < a.length && j + len < sourceWords.length && a[i + len] === sourceWords[j + len]) len += 1;
      if (len > best) best = len;
    }
    const text = a.slice(i, i + best).join(" ");
    // Wholly statutory runs are not findings.
    let anyNonStatutory = false;
    for (let k = 0; k + n <= best; k += 1) {
      if (!statGrams.has(text.split(" ").slice(k, k + n).join(" "))) { anyNonStatutory = true; break; }
    }
    if (anyNonStatutory) spans.push({ text, length: best, tier: tierOf(best) });
    i += best - n + 1;
  }
  return spans;
}

export function tierOf(length) {
  if (length >= TIERS.block) return "block";
  if (length >= TIERS.review) return "review";
  return "report";
}

/** Tally by tier, and whether the run passes the contract. */
export function summarise(spans) {
  const by = { report: 0, review: 0, block: 0 };
  for (const s of spans) by[s.tier] += 1;
  return {
    ...by,
    total: spans.length,
    passes: by.block === 0,
    blocking: spans.filter((s) => s.tier === "block"),
    needsReview: spans.filter((s) => s.tier === "review"),
  };
}
