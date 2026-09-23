// law-matching.mjs — resolve the prose citation a Bar answer key prints to a
// law_id in public.mahoti_laws.
//
// WHY THIS IS NOT A ONE-LINE COMPARE. The corpus and the Bar's key write the
// same law four ways:
//
//   corpus  פקודת הנזיקין [נוסח חדש]          key  פקודת הנזיקין ( נוסח חדש)
//   corpus  חוק התכנון והבנייה, התשכ"ה-1965   key  חוק התכנון והבניה, התשכ"ה-1965
//   corpus  חוק־יסוד: חופש העיסוק              key  חוק יסוד: חופש העיסוק
//   corpus  חוק ההתיישנות, התשי״ח-1958        key  חוק ההתיישנות, התשי"ח- 1958
//
// Bracket shape, כתיב מלא/חסר, maqaf against space, and the gershayim
// codepoint. None of the four differences mean anything, and all four make a
// naive equality say "different law". Flattening them takes the match rate on
// the 157 real questions from 128 to 153.
//
// WHAT IS DELIBERATELY NOT DONE: guessing. A citation that names no law this
// corpus holds resolves to nothing, and the caller records NULL — "not yet
// classified" rather than a plausible wrong id.

const LSQ = String.fromCharCode(0x5b); // [
const RSQ = String.fromCharCode(0x5d); // ]

/** Flatten every spelling difference that carries no meaning. */
export function normaliseLawText(s) {
  return String(s ?? "")
    .replace(/[״"“”]/g, '"')
    .replace(/[׳'’]/g, "'")
    .replace(/[־–—−-]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .split(LSQ)
    .join("(")
    .split(RSQ)
    .join(")")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    // חוק־יסוד (corpus) and חוק יסוד (key) are the same phrase.
    .replace(/חוק-יסוד/g, "חוק יסוד")
    // כתיב מלא vs חסר — הבנייה / הבניה. Collapsing a doubled yod settles it on
    // both sides at once, and no two laws in the corpus differ only by one.
    .replace(/יי/g, "י")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The part of a law's name that a citation actually reproduces: everything
 * before the year clause. "חוק ההתיישנות, התשי״ח-1958" -> "חוק ההתיישנות".
 */
export function lawNameCore(lawName) {
  const n = normaliseLawText(lawName);
  const cut = n.indexOf(",");
  return (cut === -1 ? n : n.slice(0, cut)).trim();
}

/**
 * Index a corpus for matching. `laws` is [{ law_id, law_name }].
 *
 * Sorted longest-core-first so that a name which contains another — כללי לשכת
 * עורכי הדין (אתיקה מקצועית) contains כללי לשכת עורכי הדין — is tried first and
 * wins the span.
 */
export function buildLawIndex(laws) {
  return laws
    .map((l) => ({ law_id: Number(l.law_id), law_name: l.law_name, core: lawNameCore(l.law_name) }))
    .filter((l) => l.core.length >= 4)
    .sort((a, b) => b.core.length - a.core.length);
}

/**
 * Every law a citation names, in the order it names them.
 *
 * Order is the point: a key that cites a statute and then a judgment, or a
 * statute and the regulations under it, leads with the one the answer turns on.
 * The caller takes `[0]`.
 */
export function lawsInCitation(citation, index) {
  const n = normaliseLawText(citation);
  const hits = [];
  const spans = [];
  for (const law of index) {
    const at = n.indexOf(law.core);
    if (at === -1) continue;
    // A shorter name sitting inside an already-claimed span is the same mention.
    if (spans.some(([s, e]) => at >= s && at + law.core.length <= e)) continue;
    spans.push([at, at + law.core.length]);
    hits.push({ ...law, at });
  }
  return hits.sort((a, b) => a.at - b.at);
}

/** "סעיף", "סעיפים", "תקנה", "תקנות", "כלל", "כללים" — what precedes the numbers. */
const SECTION_WORD =
  /(?:סעיפים|סעיף|תקנות|תקנה|כללים|כלל)/g;
/** 14, 18ב, 25יב, 49ב — a number with an optional Hebrew letter suffix. */
const SECTION_NUMBER = /\d+[א-ת]*/g;

/**
 * The sections a citation names, per law.
 *
 * HEBREW PUTS THE SECTIONS BEFORE THE LAW: "סעיפים 7, 8 לחוק פיצויים…". So the
 * numbers belonging to a law are the ones in the text between the previous law
 * mention and this one. That is the whole rule, and it is why this takes the
 * law hits rather than re-finding them.
 *
 * Ranges are expanded — "סעיפים 252 - 254" is three sections, and a filter that
 * read it as two would pass a question whose middle section is missing. A range
 * endpoint carrying a letter suffix (18ב) is not expanded, because the sequence
 * between two such is not knowable from the text.
 *
 * Returns [{ law_id, law_name, sections: string[] }], sections possibly empty
 * when the key named a law without pinning a section to it.
 */
export function sectionsInCitation(citation, lawHits) {
  const n = normaliseLawText(citation);
  const out = [];
  let from = 0;
  for (const law of lawHits) {
    const segment = n.slice(from, law.at);
    const sections = [];
    // Only numbers that follow a section word count. Without this, the year in
    // "התשל\"ג-1973" and a docket number read as sections.
    SECTION_WORD.lastIndex = 0;
    let word;
    while ((word = SECTION_WORD.exec(segment)) !== null) {
      // Up to the next section word, or the end of this law's segment.
      SECTION_WORD.lastIndex = word.index + word[0].length;
      const nextWord = SECTION_WORD.exec(segment);
      const tail = segment.slice(word.index + word[0].length, nextWord ? nextWord.index : segment.length);
      SECTION_WORD.lastIndex = word.index + word[0].length;

      const tokens = tail.match(SECTION_NUMBER) ?? [];
      for (let i = 0; i < tokens.length; i++) {
        sections.push(tokens[i]);
        // "252-254": a hyphen between two bare numbers is a range.
        const between = tail.slice(
          tail.indexOf(tokens[i]) + tokens[i].length,
          tokens[i + 1] ? tail.indexOf(tokens[i + 1], tail.indexOf(tokens[i]) + tokens[i].length) : undefined
        );
        if (tokens[i + 1] && /^-$/.test(between.trim()) && /^\d+$/.test(tokens[i]) && /^\d+$/.test(tokens[i + 1])) {
          const a = Number(tokens[i]);
          const b = Number(tokens[i + 1]);
          if (b > a && b - a <= 50) for (let k = a + 1; k < b; k++) sections.push(String(k));
        }
      }
    }
    out.push({
      law_id: law.law_id,
      law_name: law.law_name,
      sections: [...new Set(sections)],
    });
    from = law.at + law.core.length;
  }
  return out;
}
