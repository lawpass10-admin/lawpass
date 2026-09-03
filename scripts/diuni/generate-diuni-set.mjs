// generate-diuni-set.mjs — write דין דיוני exam questions from real law.
//
//   node scripts/diuni/generate-diuni-set.mjs                 # 1 question
//   node scripts/diuni/generate-diuni-set.mjs --count=6       # mixed per the params
//   node scripts/diuni/generate-diuni-set.mjs --source=law --count=3
//   node scripts/diuni/generate-diuni-set.mjs --law=2000798 --section=112
//   node scripts/diuni/generate-diuni-set.mjs --case=78546-08-25
//   node scripts/diuni/generate-diuni-set.mjs --area=banking_law --effort=max
//   node scripts/diuni/generate-diuni-set.mjs --dry-run       # show the prompt, call nothing
//   node scripts/diuni/generate-diuni-set.mjs --count=27 --batch-api   # half price
//   node scripts/diuni/generate-diuni-set.mjs --list-batches           # resumable jobs
//   node scripts/diuni/generate-diuni-set.mjs --resume=msgbatch_123    # collect one
//
// THE SHAPE OF THE THING. One piece of real legal material goes in; one
// multiple-choice question in the Bar's דין דיוני format comes out, together
// with the nine-section 360° review the practice screen renders. Tunables live
// in diuni-LLM-Params.json; style comes from exemplars.json, which holds the
// real lawyer-authored questions extracted from the June 2026 paper.
//
// TWO KINDS OF MATERIAL, because the real paper tests both. A JUDGMENT from
// public.verdict_list gives a question about how a rule was actually applied; a
// SECTION from public.mahoti_laws gives one about the rule itself. How a batch
// splits between them is grounding.mix in the params — the counts are worked
// out for the batch and then shuffled, so the ratio holds while which question
// is which does not.
//
// WHY THE MATERIAL IS THE ONLY SOURCE. The model is shown one judgment, or one
// section, and told to build a question answerable from it. That is the same
// discipline the mahoti generator applies with its legislation notebook, and
// for the same reason: a question grounded in a document we hold can be CHECKED
// against that document, and one grounded in the model's memory of Israeli
// procedure cannot. Every passage the question leans on is quoted, and every
// quote is verified verbatim against its source before the question is written.
//
// WHAT IS DELIBERATELY NOT AUTOMATED. Nothing here writes to a table a student
// reads. Output lands in scripts/diuni/generated/ for a lawyer to review, which
// is the same gate the writing-task and mahoti pipelines use.

import dotenv from "dotenv";
import pg from "pg";
import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

// ---------------------------------------------------------------------------
// CLI + params
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const has = (name) => argv.includes(`--${name}`);

const params = JSON.parse(
  readFileSync(join(here, "diuni-LLM-Params.json"), "utf8")
);

const COUNT = Number(flag("count") ?? 1);
const EFFORT = flag("effort") ?? params.model.effort;
const MODEL = flag("model") ?? params.model.id;
const CASE = flag("case");
const AREA = flag("area") ?? (params.selection.only_areas[0] ?? null);
const DRY_RUN = has("dry-run");
/**
 * Send the whole run through the Batch API instead of one live call per
 * question. Half price on input and output; the questions are identical.
 *
 * The trade is different here than it is for mahoti. This script is sequential
 * and prints each question as it lands, so a long run is watchable and a bad
 * prompt shows itself on question 1. Batching gives that up: nothing returns
 * until every question is done. Worth it for a settled prompt and a large
 * --count, not while iterating.
 *
 * ON THE PROMPT CACHE. Unlike mahoti, caching here is real — the exemplar
 * prefix is ~12.7k tokens and every question of the same kind reuses it. The
 * cache still applies inside a batch, but requests may start together rather
 * than in a queue, so more of them can write the prefix instead of reading it.
 * That claws back part of the discount; it does not reverse it, because the
 * prefix is a small share of a run dominated by output tokens. See --estimate
 * on the wrapper for the arithmetic.
 */
const BATCH_API = has("batch-api");
// --source=law|verdict forces one kind for the whole run, overriding the mix.
// --law=<law_id> narrows the statute pool to one law.
const SOURCE_KIND = flag("source");
const LAW_ID = flag("law");
// --section=<n> pins the statutory section, which is what makes a like-for-like
// re-generation possible: without it --law picks a random section of that law
// and any comparison is measuring two different questions.
const SECTION = flag("section");
if (SOURCE_KIND && !["verdict", "law"].includes(SOURCE_KIND)) {
  console.error("--source must be verdict or law");
  process.exit(1);
}

const LETTERS = params.structure.option_letters;
const VARIATIONS = params.structure.variations_360;

const VALID_EFFORT = ["low", "medium", "high", "xhigh", "max"];
if (!VALID_EFFORT.includes(EFFORT)) {
  console.error(`--effort must be one of: ${VALID_EFFORT.join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The output contract
// ---------------------------------------------------------------------------
//
// quick_thinking_360 is modelled as STRUCTURED objects here and serialised to
// the panel's string format at the end. The panel parses
// `**וריאציה N — title:** question ← answer`, and asking a model to emit that
// punctuation reliably is a worse bet than asking for three fields and building
// the string ourselves.

const Variation = z.object({
  title: z.string().min(2).max(60),
  question: z.string().min(8),
  answer: z.string().min(4),
});

const QuestionSchema = z.object({
  fact_pattern: z.string().min(params.structure.fact_pattern_chars.min),
  stem: z.string().min(5),
  options: z
    .array(
      z.object({
        letter: z.enum(LETTERS),
        text: z.string().min(10),
      })
    )
    .length(4),
  correct_answer: z.enum(LETTERS),
  legal_topic_analysis: z.string().min(80),
  full_explanation: z.string().min(200),
  distractor_analysis: z.object(
    Object.fromEntries(LETTERS.map((l) => [l, z.string().min(20)]))
  ),
  common_pitfall: z.string().min(60),
  quick_thinking_360: z.array(Variation).length(VARIATIONS),
  summary_for_memory: z.string().min(40),
  concepts_and_skills: z
    .array(z.string().min(2))
    .min(params.structure.concepts_min)
    .max(params.structure.concepts_max),
  references_list: z.array(z.string().min(5)).min(1),
  grounding_quotes: z
    .array(
      z.object({
        // Deliberately NOT params.validation.min_quote_chars. A length floor in
        // the schema makes the API reject the entire response over one short
        // quote, throwing away a good question and ~100s of generation. The
        // floor is enforced after parsing instead — see checkQuotes — where it
        // can be applied to the SET of quotes rather than to every one of them.
        quote: z.string().min(1),
        role: z.string().min(5),
      })
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * The rules, in two flavours.
 *
 * A paper is built from two kinds of material and they demand different
 * discipline. A JUDGMENT already contains its own answer, so the danger is
 * copying it: the facts have to be reinvented and the parties anonymised, or a
 * candidate can search the case and read the answer off it. A STATUTORY SECTION
 * contains no facts at all, so the danger is the opposite — a question that
 * just asks the candidate to recite the section. There the facts must be
 * invented outright and the section applied to them.
 *
 * Everything else — structure, one-correct-answer, the 360° cards, the Hebrew —
 * is shared, and lives in the common block so the two cannot drift apart.
 */
const SHARED_RULES = `אתה כותב שאלות לבחינת ההסמכה לעריכת דין בישראל, חלק ב' — דין דיוני.

כללי יסוד — הפרה של אחד מהם פוסלת את השאלה:

א. תשובה אחת נכונה. שלוש התשובות האחרות שגויות באופן חד-משמעי, אך כל אחת מהן
   היא התשובה שאליה מגיע מועמד שעשה טעות אחת מזוהה. ציין את הטעות הזו במפורש
   ב-distractor_analysis לכל אות, כולל לאות הנכונה (שם הסבר מדוע היא הנכונה).

ב. המבנה. ארבע אפשרויות בדיוק, מסומנות ${LETTERS.join(", ")}, לפי הסדר.
   ${VARIATIONS} וריאציות בדיוק ב-quick_thinking_360 — כל אחת שאלה קצרה ותשובה
   קצרה, שבודקות את אותו כלל מזווית אחרת (שינוי בערכאה, בשלב הדיוני, בזהות
   הצד, או במה שהיה קורה אילו התנאי לא היה מתקיים).

ג. העברית. עברית משפטית מדויקת. כתוב את תבנית העובדות בקול של הבחינה עצמה,
   כפי שאתה רואה בדוגמאות — לא בקול של פסק דין ולא בקול של ספר לימוד.`;

const VERDICT_RULES = `${SHARED_RULES}

המשימה: מתוך פסק הדין המצורף, כתוב שאלת רב-ברירה אחת בסגנון הבחינה, ואת מלוא חומר הלימוד הנלווה לה.

ד. הביסוס. השאלה חייבת להיות ניתנת לפתרון מתוך פסק הדין שלפניך. אל תסתמך על
   זיכרון שלך מהדין הישראלי כדי לקבוע מה נכון — הסתמך על מה שכתוב בפסק הדין.
   כל טענה משפטית שהשאלה נשענת עליה חייבת להופיע ב-grounding_quotes כציטוט
   מדויק מפסק הדין, מילה במילה, בלי לשנות אות.

ה. אנונימיות. תבנית העובדות חייבת להיות מקרה חדש בהשראת פסק הדין — לא תיאור
   שלו. שנה שמות, מקומות, סכומים ותאריכים. אסור שיופיעו בשאלה שמות הצדדים
   האמיתיים, מספר ההליך או שם בית המשפט מפסק הדין. מועמד שיכול לחפש את פסק
   הדין ולמצוא את התשובה — אינו עונה על השאלה.`;

const LAW_RULES = `${SHARED_RULES}

המשימה: מתוך סעיף החוק המצורף, כתוב שאלת רב-ברירה אחת בסגנון הבחינה, ואת מלוא חומר הלימוד הנלווה לה.

ד. הביסוס. הכלל שהשאלה בודקת חייב להיות כתוב בסעיף שלפניך. אל תסתמך על זיכרון
   שלך מהדין הישראלי כדי לקבוע מה נכון — הסתמך על לשון הסעיף. כל טענה משפטית
   שהשאלה נשענת עליה חייבת להופיע ב-grounding_quotes כציטוט מדויק מן הסעיף,
   מילה במילה, בלי לשנות אות.

ה. יישום, לא שינון. הסעיף אינו כולל עובדות — עליך להמציא אותן. כתוב תבנית
   עובדות קונקרטית של מקרה שהסעיף חל עליו, ושאל מה הדין. השאלה חייבת לדרוש
   יישום של הסעיף על אותן עובדות: מועמד שרק זוכר את לשון הסעיף בעל פה, בלי
   להבין מתי הוא חל, לא אמור לענות נכון. אל תצטט את הסעיף בתוך תבנית העובדות
   ואל תרמוז על מספרו — זיהוי ההוראה החלה הוא חלק מהשאלה.`;

function buildSystemPrompt(exemplars, kind) {
  const shown = exemplars
    .map(
      (q) =>
        `שאלה ${q.number}\n${q.fact_pattern}\n${q.stem}\n` +
        q.options.map((o) => `${o.letter}. ${o.text}`).join("\n") +
        `\nהתשובה הנכונה: ${q.correct_answer}` +
        (q.source_citation ? `\nסימוכין: ${q.source_citation}` : "")
    )
    .join("\n\n---\n\n");

  return [
    { type: "text", text: kind === "law" ? LAW_RULES : VERDICT_RULES },
    {
      type: "text",
      text:
        `להלן שאלות אמיתיות מתוך שאלון הבחינה (${exemplars.length} דוגמאות סגנון). ` +
        `אל תעתיק את תוכנן — למד מהן את הניסוח, האורך, מבנה המסיחים והקול:\n\n${shown}`,
    },
    {
      type: "text",
      text:
        `הנחיות כתיבה נוספות:\n` +
        `רמת קושי: ${params.authoring.difficulty}\n` +
        `אורך תבנית עובדות: ${params.authoring.fact_pattern_length}\n` +
        `${params.authoring.register}\n${params.authoring.extra_instructions}`,
    },
  ];
}

/**
 * Where the correct answer must sit for this question.
 *
 * Left to itself the model strongly favours one letter — the first four
 * questions of this pipeline came out ב, ב, ב, א. That is not a correctness
 * problem (each answer was right) but on a 40-question paper it is a tell: a
 * candidate who always guesses the favoured letter scores far above chance, and
 * the practice statistics inherit the skew.
 *
 * The rotation counts what is ALREADY in generated/, so a second batch carries
 * on from where the first stopped instead of restarting at א.
 */
function targetLetterFor(index, alreadyWritten) {
  const dist = params.structure.answer_distribution;
  if (!dist || dist.mode !== "rotate") return null;
  const seq = dist.sequence;
  return seq[(alreadyWritten + index) % seq.length];
}

/**
 * Put the correct answer on the letter the rotation asked for.
 *
 * The prompt asks for it, and the model usually complies. When it does not,
 * the question is REMAPPED rather than rejected: swapping two options is
 * deterministic and free, where rejecting throws away two minutes of
 * generation over something entirely mechanical.
 *
 * Safe because nothing in the review names a letter — the analysis fields talk
 * about rules and mistakes, and `distractor_analysis` is KEYED by letter, so
 * each explanation travels with the option it belongs to. That was checked
 * across the first four questions before this was written; if a future prompt
 * starts producing "אפשרות ג היא הנכונה" inside the prose, this swap would
 * leave the text disagreeing with the options and would have to go.
 */
function placeAnswerAt(q, target) {
  if (!target || q.correct_answer === target) return false;

  const from = q.correct_answer;
  const textOf = Object.fromEntries(q.options.map((o) => [o.letter, o.text]));
  [textOf[target], textOf[from]] = [textOf[from], textOf[target]];
  q.options = q.options.map((o) => ({ letter: o.letter, text: textOf[o.letter] }));

  const da = q.distractor_analysis;
  [da[target], da[from]] = [da[from], da[target]];

  q.correct_answer = target;
  return true;
}

function buildUserPrompt(item, targetLetter) {
  const placement = targetLetter
    ? `\n\nחשוב: התשובה הנכונה חייבת להיות אפשרות ${targetLetter}. סדר את ארבע האפשרויות כך שהנכונה תהיה ${targetLetter}, ושלוש האחרות יהיו המסיחים.`
    : "";

  if (item.kind === "law") {
    const s = item.source;
    return `סעיף החוק שממנו ייבנה השאלה:

החוק: ${s.law_name}
סעיף: ${s.section_number || "—"}
כותרת שוליים: ${s.heading || "—"}
פרק: ${s.chapter || "—"}

--- נוסח הסעיף ---
${s.text}
--- סוף הסעיף ---

כתוב שאלה אחת לפי הכללים.${placement}`;
  }

  const v = item.source;
  return `פסק הדין שממנו ייבנה השאלה:

בית המשפט: ${v.court ?? "—"}
סוג ההחלטה: ${v.doc_type ?? "—"}
תחום: ${v.judgment_area ?? "—"}
נושא: ${v.judgment_topic ?? "—"}

--- נוסח פסק הדין ---
${v.body}
--- סוף פסק הדין ---

כתוב שאלה אחת לפי הכללים.${placement}`;
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

async function fetchVerdicts(client, limit) {
  const where = ["text_chars >= $1"];
  const args = [params.selection.min_text_chars];
  if (CASE) {
    args.push(CASE);
    where.push(`case_number = $${args.length}`);
  }
  if (AREA) {
    args.push(AREA);
    where.push(`judgment_area_id = $${args.length}`);
  }
  if (params.selection.exclude_areas.length) {
    args.push(params.selection.exclude_areas);
    where.push(`judgment_area_id <> ALL($${args.length})`);
  }

  // `balanced` still draws the CANDIDATE POOL at random — the spread is applied
  // to that pool in JS, where area and category counts are visible. Ordering by
  // anything else here would hand the spread a biased pool to start from.
  const order =
    params.selection.order === "random" || params.selection.order === "balanced"
      ? "random()"
      : params.selection.order === "oldest"
        ? "decided_on ASC NULLS LAST"
        : "decided_on DESC NULLS LAST";

  const { rows } = await client.query(
    `SELECT verdict_id, case_number, court, doc_type, decided_on, category,
            judgment_area, judgment_area_id, judgment_topic,
            full_text->>'body' AS body, text_chars
       FROM public.verdict_list
      WHERE ${where.join(" AND ")}
      ORDER BY ${order}
      LIMIT ${Number(limit)}`,
    args
  );
  return rows;
}

/**
 * Spread a candidate pool across judgment areas and docket categories.
 *
 * WHY THIS EXISTS. `random()` over the whole table looks like it spreads and
 * does not: the first thirteen questions drew 7 of 11 judgments from
 * `תק - תביעה קטנה`, a category that is only ~22% of the pool. That mattered
 * because every small-claims judgment closes with the same appeal-rights
 * paragraph — "זכות לבקש רשות ערעור... תוך 30 יום" — which is the cleanest
 * quotable procedural rule in the document, so the grounding requirement steers
 * the model straight at it. Seven of thirteen questions came out asking how to
 * challenge a judgment. No amount of exemplar tuning moved that; it is a
 * property of what the generator was handed.
 *
 * CATEGORY IS WEIGHTED ABOVE AREA. Two judgments can sit in different legal
 * areas and still both be small claims, and it is the docket type — not the
 * area — that decides which procedural rules are visible in the text.
 *
 * Counts are seeded from the drafts already written, so a second batch
 * continues the spread instead of restarting and re-drawing the same
 * categories.
 */
function spreadByArea(pool, n, seed) {
  const picked = [];
  const seenArea = new Map(seed?.areas ?? []);
  const seenCat = new Map(seed?.categories ?? []);
  const remaining = [...pool];

  while (picked.length < n && remaining.length > 0) {
    let bestAt = 0;
    let bestScore = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const v = remaining[i];
      const a = seenArea.get(v.judgment_area_id ?? "—") ?? 0;
      const c = seenCat.get(v.category ?? "—") ?? 0;
      const score = c * 3 + a;
      if (score < bestScore) {
        bestScore = score;
        bestAt = i;
        if (score === 0) break;
      }
    }
    const [v] = remaining.splice(bestAt, 1);
    picked.push(v);
    seenArea.set(v.judgment_area_id ?? "—", (seenArea.get(v.judgment_area_id ?? "—") ?? 0) + 1);
    seenCat.set(v.category ?? "—", (seenCat.get(v.category ?? "—") ?? 0) + 1);
  }
  return picked;
}

/**
 * Random statutory sections from the mahoti_laws corpus.
 *
 * The corpus is stored one row per law with a `sections_body` array, so the
 * sections are unnested and sampled at the SECTION level rather than the law
 * level. Sampling laws first would over-represent short statutes: חוק העונשין
 * has 484 sections and some laws have a dozen, and picking a law then a section
 * would make a section of the small law ~40x likelier than one of the large.
 *
 * Length bounds do real work. Below the floor a section is a one-line
 * definition with nothing to test; above the ceiling it is really a chapter,
 * and the model would choose its own topic out of it rather than being held to
 * a rule.
 */
async function fetchLawSections(client, limit) {
  const cfg = params.grounding.law;
  const where = [
    "length(s->>'text') BETWEEN $1 AND $2",
    "coalesce(s->>'number', '') <> ''",
  ];
  const args = [cfg.min_section_chars, cfg.max_section_chars];

  if (LAW_ID) {
    args.push(Number(LAW_ID));
    where.push(`l.law_id = $${args.length}`);
    if (SECTION) {
      args.push(String(SECTION));
      where.push(`s->>'number' = $${args.length}`);
    }
  } else {
    if (cfg.only_law_ids.length) {
      args.push(cfg.only_law_ids);
      where.push(`l.law_id = ANY($${args.length})`);
    }
    if (cfg.exclude_law_ids.length) {
      args.push(cfg.exclude_law_ids);
      where.push(`l.law_id <> ALL($${args.length})`);
    }
  }

  const { rows } = await client.query(
    `SELECT l.law_id, l.law_name,
            s->>'number'  AS section_number,
            s->>'heading' AS heading,
            s->>'chapter' AS chapter,
            s->>'text'    AS text
       FROM public.mahoti_laws l
       CROSS JOIN LATERAL jsonb_array_elements(l.sections_body) s
      WHERE ${where.join(" AND ")}
      ORDER BY random()
      LIMIT ${Number(limit)}`,
    args
  );
  return rows;
}

/**
 * How a batch splits between judgments and statute.
 *
 * The counts are worked out for the whole batch and then shuffled. Drawing a
 * kind at random per question would honour the ratio only on average — a run of
 * ten could come out all judgments, which is exactly the run someone would look
 * at and conclude the feature is broken. This way the mix is guaranteed and
 * only the order is chance.
 */
function planGrounding(count) {
  if (SOURCE_KIND) return Array.from({ length: count }, () => SOURCE_KIND);
  const mix = params.grounding.mix;
  const share = mix.law / (mix.verdict + mix.law || 1);
  const lawCount = Math.round(count * share);
  const kinds = [
    ...Array(count - lawCount).fill("verdict"),
    ...Array(lawCount).fill("law"),
  ];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds;
}

/** A stable, filename-safe id for the material a question was built on. */
function sourceKeyOf(item) {
  return item.kind === "law"
    ? `law-${item.source.law_id}-s${String(item.source.section_number).replace(/[^\w.-]/g, "_")}`
    : item.source.case_number;
}

/** The text every grounding quote must be found in. */
function haystackOf(item) {
  return item.kind === "law" ? item.source.text : item.source.body;
}

// ---------------------------------------------------------------------------
// Validation — the part that makes the output trustworthy
// ---------------------------------------------------------------------------

const squash = (s) => s.replace(/\s+/g, " ").trim();

/**
 * Every grounding quote must appear in the source material — the judgment for a
 * verdict question, the section text for a law one.
 *
 * Whitespace is normalised on both sides before comparing: a court document and
 * a scraped statute both carry line breaks a model quoting from them will not
 * reproduce. Nothing else is relaxed — a single changed word fails, which is
 * the point. A quote the model composed rather than copied is the exact failure
 * this catches, and it is the only mechanical proof that a question about
 * procedure is about the procedure that actually exists.
 */
function checkQuotes(question, item) {
  const haystack = squash(haystackOf(item));
  const bad = [];
  for (const q of question.grounding_quotes) {
    if (!haystack.includes(squash(q.quote))) bad.push(q.quote);
  }

  // The length floor guards against a "quote" so short it matches by accident —
  // a single common word appears in any judgment. It is applied to the SET, not
  // to each quote: a genuinely short phrase of statute ("רשימה סגורה") is a
  // legitimate citation when it sits alongside a substantial one, and failing
  // the question over it discards work that is actually grounded.
  const floor = params.validation.min_quote_chars;
  const substantial = question.grounding_quotes.filter(
    (q) => squash(q.quote).length >= floor
  );
  if (substantial.length === 0) {
    bad.push(`no quote reaches ${floor} characters — all are too short to prove grounding`);
  }

  return bad;
}

/**
 * The fact pattern must not carry anything that identifies the judgment.
 *
 * Party names are taken from the judgment's own caption via the case number and
 * court; a candidate who can paste a phrase into a search engine and land on the
 * judgment is reading the answer, not working it out.
 */
function checkAnonymity(question, verdict) {
  if (!params.validation.forbid_verdict_identifiers) return [];
  const hay = question.fact_pattern + " " + question.stem;
  const leaks = [];
  if (verdict.case_number && hay.includes(verdict.case_number)) {
    leaks.push(verdict.case_number);
  }
  if (verdict.court && hay.includes(verdict.court)) leaks.push(verdict.court);
  return leaks;
}

/** The answer key must name one of the four options it was given. */
function checkAnswer(question) {
  const letters = question.options.map((o) => o.letter);
  if (new Set(letters).size !== 4) return "the four options are not lettered distinctly";
  if (letters.join("") !== LETTERS.join("")) return `options must run ${LETTERS.join("")}`;
  if (!letters.includes(question.correct_answer)) return "correct_answer names no option";
  return null;
}

/** Serialise to the exact string the practice panel's parser expects. */
function serialise360(variations) {
  return variations
    .map((v, i) => `**וריאציה ${i + 1} — ${v.title}:** ${v.question} ← ${v.answer}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const exemplarsPath = join(here, params.exemplars.file);
if (!existsSync(exemplarsPath)) {
  console.error(
    `missing ${params.exemplars.file}. Build it first:\n` +
      `  node scripts/diuni/extract-exam-pdf.mjs <exam.pdf> <answers.pdf> -o ${exemplarsPath}`
  );
  process.exit(1);
}
const allExemplars = JSON.parse(readFileSync(exemplarsPath, "utf8")).questions;

/** Spread takes them evenly across the paper so the anchors are not all from
 *  one topic — the first three questions of a Bar paper share a subject. */
/**
 * The stem form a question takes — "מה הדין?", "איזה מבין ההיגדים הבאים…",
 * "האם צדק…? מדוע?" and so on. Normalised to the opening words, because that
 * is what carries the form; the rest of a stem is about the particular facts.
 */
function stemForm(q) {
  return (q.stem || "")
    .replace(/\s+/g, " ")
    .replace(/[?.,;:"'״׳]/g, "")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

/**
 * The instrument a question is about, read off the answer key's citation —
 * "לחוק ההוצאה לפועל", "לתקנות סדר הדין האזרחי".
 *
 * This is the SUBJECT axis, and it exists because form alone was not enough.
 * Picking ten exemplars diverse in form produced a batch where eight of
 * thirteen generated questions asked how to appeal a judgment: three of those
 * ten anchors happened to be forum-and-jurisdiction questions, and the model
 * followed the subject rather than the phrasing. Diversifying the wording while
 * concentrating the topic is worse than not diversifying at all.
 */
function stemTopic(q) {
  const m = (q.source_citation || "").match(
    /ל(?:חוק|תקנות|פקודת|כללי)\s+[^,;]{3,45}/
  );
  return m ? m[0].replace(/\s+/g, " ").trim() : "—";
}

/**
 * Choose the exemplars the model learns the house style from.
 *
 * `balanced` (the default) is a greedy three-axis spread: each pick is the
 * candidate whose stem form, whose statute, and whose sitting are least
 * represented among those already chosen. With 106 exemplars across three
 * sittings that yields ten anchors with ten different forms, close to ten
 * different instruments, and all three papers represented.
 *
 * `form` diversifies phrasing only — kept because it is what produced the
 * appeal-heavy batch, and the comparison is worth being able to re-run.
 * `spread`, `first` and `random` are the earlier strategies.
 */
function pickExemplars(pool, n) {
  const mode = params.exemplars.pick;
  if (mode === "first") return pool.slice(0, n);
  if (mode === "random") {
    return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  }
  if (mode === "spread") {
    const step = Math.max(1, Math.floor(pool.length / n));
    return Array.from({ length: n }, (_, i) => pool[i * step]).filter(Boolean);
  }

  if (mode === "form") {
    const groups = new Map();
    for (const q of pool) {
      const k = stemForm(q);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(q);
    }
    const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
    const picked = [];
    for (let round = 0; picked.length < n; round++) {
      let took = false;
      for (const g of ordered) {
        if (round < g.length && picked.length < n) {
          picked.push(g[round]);
          took = true;
        }
      }
      if (!took) break;
    }
    return picked;
  }

  // balanced: greedy least-represented across three axes.
  const picked = [];
  const seenForm = new Map();
  const seenTopic = new Map();
  const seenPaper = new Map();
  const remaining = [...pool];
  while (picked.length < n && remaining.length > 0) {
    let bestAt = 0;
    let bestScore = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const q = remaining[i];
      const f = seenForm.get(stemForm(q)) ?? 0;
      const t = seenTopic.get(stemTopic(q)) ?? 0;
      const s = seenPaper.get(q.paper ?? "—") ?? 0;
      // Form heaviest, then subject, then sitting. Without the third term the
      // greedy takes all ten anchors from whichever paper sits first in the
      // pool — it walks in order and the first sitting alone can satisfy both
      // other axes. Sittings differ in register and in what they test, and
      // showing the model only one throws that away.
      const score = f * 3 + t * 2 + s;
      if (score < bestScore) {
        bestScore = score;
        bestAt = i;
        if (score === 0) break;
      }
    }
    const [q] = remaining.splice(bestAt, 1);
    picked.push(q);
    seenForm.set(stemForm(q), (seenForm.get(stemForm(q)) ?? 0) + 1);
    seenTopic.set(stemTopic(q), (seenTopic.get(stemTopic(q)) ?? 0) + 1);
    seenPaper.set(q.paper ?? "—", (seenPaper.get(q.paper ?? "—") ?? 0) + 1);
  }
  return picked;
}
const exemplars = pickExemplars(allExemplars, params.exemplars.count);

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

/**
 * --resume=<batch_id> collects a batch that was submitted earlier.
 *
 * WHY A MANIFEST AND NOT JUST THE BATCH ID. The results come back keyed by
 * `custom_id`, which is the question's index — and the index means nothing on
 * its own, because the sources are chosen fresh on every run: `spreadByArea`
 * reorders the pool, and anything already on disk is filtered out. Re-selecting
 * on resume would map index 7 to a different judgment than the one question 7
 * was written from, and `checkQuotes` would then verify the answer against the
 * wrong document — rejecting good questions, or passing bad ones.
 *
 * So the submission writes down exactly what it sent, and resume reads it back
 * instead of choosing again. The manifest also carries the ANSWER TARGETS and
 * the provenance of the run that produced them, because both drift: the letter
 * rotation is keyed to how many drafts existed at submission time, and drafts
 * written in between would rotate it somewhere else.
 */
const RESUME = flag("resume");
const batchesDir = join(here, "generated", ".batches");
const manifestPathFor = (id) => join(batchesDir, `${id}.json`);

// A batch id is a long opaque string that is easy to lose from a terminal that
// has scrolled. The manifests are the record of what was submitted, so listing
// them is the way back to one.
if (has("list-batches")) {
  const files = existsSync(batchesDir)
    ? readdirSync(batchesDir).filter((f) => f.endsWith(".json"))
    : [];
  if (files.length === 0) {
    console.log(`no batch manifests in ${batchesDir}`);
    console.log("Manifests are written when a run is submitted with --batch-api.");
    process.exit(0);
  }
  console.log(`resumable batches in ${batchesDir}:\n`);
  for (const f of files) {
    try {
      const m = JSON.parse(readFileSync(join(batchesDir, f), "utf8"));
      console.log(
        `  ${m.batch_id}\n    ${m.items.length} questions, submitted ${m.submitted_at}, ` +
          `${m.generator.model} effort ${m.generator.effort}`
      );
    } catch {
      console.log(`  ${f} — unreadable manifest`);
    }
  }
  console.log("\nCollect one with --resume=<batch_id>.");
  process.exit(0);
}

let manifest = null;
if (RESUME) {
  const p = manifestPathFor(RESUME);
  if (!existsSync(p)) {
    console.error(`no manifest for batch ${RESUME}.`);
    console.error(`looked in: ${p}`);
    console.error("Only batches submitted by this script with --batch-api can be resumed.");
    process.exit(1);
  }
  manifest = JSON.parse(readFileSync(p, "utf8"));
  console.log(`resuming batch ${RESUME}`);
  console.log(`  submitted  : ${manifest.submitted_at}`);
  console.log(`  questions  : ${manifest.items.length}`);
  console.log(`  model      : ${manifest.generator.model} (effort ${manifest.generator.effort})`);
  console.log("");
}

// Candidate pools rather than exactly COUNT rows: material already written is
// filtered out below, so asking for exactly COUNT would keep returning the same
// already-used sources. 200 of each is a pool, not a limit on either table.
//
// Skipped entirely on resume — the sources are read from the manifest, so there
// is nothing to select and no reason to open a connection.
let verdictPool = [];
let lawPool = [];
let groundingPlan = [];
if (!RESUME) {
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("no DIRECT_URL or DATABASE_URL in .env.local");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const plan = planGrounding(COUNT);
    if (plan.includes("verdict")) verdictPool = await fetchVerdicts(client, 200);
    if (plan.includes("law")) lawPool = await fetchLawSections(client, 200);
    groundingPlan = plan;
  } finally {
    await client.end();
  }
}

const outDirEarly = join(here, "generated");
mkdirSync(outDirEarly, { recursive: true });

/**
 * How many questions already exist for one piece of source material, and
 * therefore what the next one is numbered.
 *
 * Skipping what is already written is the default because a re-run is otherwise
 * a silent re-bill. `--force` regenerates anyway, numbering alongside rather
 * than overwriting — a rejected draft and its replacement are both worth
 * keeping until a human has picked one.
 */
const existing = readdirSync(outDirEarly).filter((f) => f.endsWith(".json"));
const alreadyWritten = existing.length;
const draftsFor = (key) => existing.filter((f) => f.startsWith(`${key}-Q`));
const countFor = (key) => draftsFor(key).length;

/**
 * The next free draft index for a source — HIGHEST existing + 1, not count + 1.
 *
 * Counting breaks as soon as a draft is moved or deleted: with only `-Q2` left,
 * a count of 1 would write `-Q2` again and silently overwrite the very draft
 * that was kept. Reading the numbers off the filenames is the only version of
 * this that survives a human curating the folder, which is exactly what the
 * folder is for.
 */
const nextSeqFor = (key) =>
  draftsFor(key).reduce((max, f) => {
    const n = Number(f.match(/-Q(\d+)\.json$/)?.[1] ?? 0);
    return n > max ? n : max;
  }, 0) + 1;

const FORCE = has("force");

/**
 * Fill the plan from the pools, skipping material already used.
 *
 * A kind whose pool runs dry falls back to the other rather than dropping the
 * question: with 39 laws and 364 judgments loaded, "no unused statute left"
 * should produce one more judgment question, not a short batch and no
 * explanation.
 */
/**
 * What the drafts already written drew on, so a new batch continues the spread
 * rather than restarting it. Without this, two batches of six each spread
 * beautifully within themselves and still hand the paper twelve small-claims
 * judgments between them.
 */
function seedFromDrafts() {
  const areas = new Map();
  const categories = new Map();
  for (const f of existing) {
    try {
      const g = JSON.parse(readFileSync(join(outDirEarly, f), "utf8")).generated_from;
      if (g?.grounding_kind === "law") continue;
      const a = g?.judgment_area_id ?? "—";
      const c = g?.category ?? "—";
      areas.set(a, (areas.get(a) ?? 0) + 1);
      categories.set(c, (categories.get(c) ?? 0) + 1);
    } catch {
      // A draft we cannot read is one we cannot count. Skipping it biases the
      // spread slightly toward its category, which is far better than aborting
      // a run over an unparsable file.
    }
  }
  return { areas: [...areas], categories: [...categories] };
}

let items = [];

if (RESUME) {
  // Straight from the manifest, in submission order. No selection, no spread,
  // no skip-what-exists: the questions were written from these sources and
  // index i has to keep meaning what it meant when the batch was sent.
  items = manifest.items.map(({ kind, source }) => ({ kind, source }));
} else {
  // Order the verdict pool so the batch spreads across areas and docket types.
  // `--case=` pins one judgment, so there is nothing to spread.
  if (!CASE && params.selection.order === "balanced" && verdictPool.length > 1) {
    verdictPool = spreadByArea(verdictPool, verdictPool.length, seedFromDrafts());
  }

  const skipped = [];
  const usedKeys = new Set();
  const takeFrom = (pool, kind) => {
    for (const source of pool) {
      const item = { kind, source };
      const key = sourceKeyOf(item);
      if (usedKeys.has(key)) continue;
      if (!FORCE && countFor(key) > 0) {
        skipped.push(key);
        continue;
      }
      usedKeys.add(key);
      return item;
    }
    return null;
  };

  for (const kind of groundingPlan) {
    const first = kind === "law" ? lawPool : verdictPool;
    const second = kind === "law" ? verdictPool : lawPool;
    const item = takeFrom(first, kind) ?? takeFrom(second, kind === "law" ? "verdict" : "law");
    if (item) items.push(item);
  }

  if (skipped.length) {
    const shown = [...new Set(skipped)].slice(0, 6);
    console.log(
      `skipping ${new Set(skipped).size} already generated: ${shown.join(", ")}` +
        `${new Set(skipped).size > shown.length ? ", …" : ""}  (--force to redo)`
    );
  }
}

if (items.length === 0) {
  console.error("nothing left to build from — every candidate source already has a question (--force to redo)");
  process.exit(1);
}

/**
 * What actually produced these questions, for the draft's provenance.
 *
 * On resume this is the manifest's, not this invocation's. A draft collected
 * today from a batch submitted under effort=xhigh with a different exemplar
 * pick must say so — stamping it with whatever flags the resume happened to
 * carry would make the provenance a record of the collection rather than of
 * the generation, and measure-spread.mjs reads exactly these fields.
 */
const GEN = RESUME
  ? manifest.generator
  : {
      model: MODEL,
      effort: EFFORT,
      prompt_version: params.generation.prompt_version,
      exemplars: exemplars.map((e) => e.number),
      config: {
        exemplars_count: exemplars.length,
        exemplars_pick: params.exemplars.pick,
        selection_order: params.selection.order,
      },
    };

/**
 * The letter this question's answer belongs on.
 *
 * Stored per item at submission and replayed on resume. Recomputing would use
 * today's `alreadyWritten`, and any draft written between submitting and
 * collecting would rotate the whole run onto different letters than the model
 * was actually asked for — quietly undoing the answer-distribution balancing.
 */
const targetAt = (i) =>
  RESUME ? (manifest.items[i]?.target ?? null) : targetLetterFor(i, alreadyWritten);

const verdictN = items.filter((i) => i.kind === "verdict").length;
console.log(`model      : ${GEN.model} (effort ${GEN.effort})`);
console.log(`exemplars  : ${GEN.exemplars.join(", ")}`);
console.log(`grounding  : ${verdictN} verdict, ${items.length - verdictN} law`);
console.log(`sources    : ${items.map(sourceKeyOf).join(", ")}`);
console.log(`360 cards  : ${VARIATIONS}`);
console.log("");

if (DRY_RUN) {
  const sys = buildSystemPrompt(exemplars, items[0].kind);
  console.log(`=== SYSTEM (${items[0].kind}) ===`);
  for (const b of sys) console.log(b.text.slice(0, 1200) + "\n---");
  const user = buildUserPrompt(items[0], targetAt(0));
  console.log("=== USER (head) ===");
  console.log(user.slice(0, 700));
  // The tail matters as much as the head: the judgment sits in the middle, and
  // the instructions that close the prompt — including which letter the answer
  // must land on — are the part a dry run is usually being used to check.
  console.log("\n… judgment text …\n");
  console.log("=== USER (tail) ===");
  console.log(user.slice(-500));
  console.log("\n=== rotation for this run ===");
  items.forEach((it, i) =>
    console.log(`  [${it.kind}] ${sourceKeyOf(it)} → ${targetAt(i) ?? "free"}`)
  );
  process.exit(0);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY is not set in .env.local");
  process.exit(1);
}

const [{ default: Anthropic }, helpers] = await Promise.all([
  import("@anthropic-ai/sdk"),
  import("@anthropic-ai/sdk/helpers/zod"),
]);
const anthropic = new Anthropic({
  apiKey,
  maxRetries: 3,
  timeout: 15 * 60 * 1000,
});

const outDir = outDirEarly;

/**
 * One system prefix per grounding kind, built once and reused.
 *
 * The exemplars and the writing guidance are identical either way; only the
 * rules block differs. Caching them per kind means a mixed batch pays the cache
 * write twice rather than on every question.
 */
const systemByKind = new Map();
function systemFor(kind) {
  if (!systemByKind.has(kind)) {
    const blocks = buildSystemPrompt(exemplars, kind);
    if (params.generation.prompt_cache) {
      blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
    }
    systemByKind.set(kind, blocks);
  }
  return systemByKind.get(kind);
}

/** The request for one question, independent of how it is sent. */
function buildRequestParams(item, target) {
  return {
    model: MODEL,
    max_tokens: params.model.max_tokens,
    thinking: { type: "adaptive" },
    output_config: {
      effort: EFFORT,
      format: helpers.zodOutputFormat(QuestionSchema),
    },
    system: systemFor(item.kind),
    messages: [{ role: "user", content: buildUserPrompt(item, target) }],
  };
}

/**
 * Run every question as one Batch API job.
 *
 * Returns index -> {ok:true, message} | {ok:false, error}, so the loop below
 * keeps its existing per-question validation, rejection and write path exactly
 * as it is. Only the acquisition of `message` changes; nothing downstream of it
 * knows which transport produced it.
 *
 * The targets are computed here, up front, and that is safe: targetLetterFor
 * keys off the question's index and `alreadyWritten`, which is fixed before the
 * run starts. It does not depend on how many questions were accepted, so
 * computing all of them ahead of time gives the same letters the sequential
 * path would have produced.
 *
 * A per-request failure is one bad index, not a dead run — the loop reports it
 * and moves on, the same as a failed live call.
 */
async function runBatchApi(items, existingBatchId) {
  const idFor = (i) => `diuni-q${i}`;

  let batch;
  if (existingBatchId) {
    batch = await anthropic.messages.batches.retrieve(existingBatchId);
    console.log(`batch ${batch.id} is ${batch.processing_status}.`);
  } else {
    const requests = items.map((item, i) => ({
      custom_id: idFor(i),
      params: buildRequestParams(item, targetAt(i)),
    }));

    console.log(`submitting ${requests.length} questions as one batch job…`);
    batch = await anthropic.messages.batches.create({ requests });

    // Written BEFORE anything is awaited on the batch, and this ordering is the
    // point of the file: from here on the work is billable and only the
    // manifest can turn it back into drafts. A manifest written after a
    // successful poll would be missing in exactly the case it exists for.
    mkdirSync(batchesDir, { recursive: true });
    writeFileSync(
      manifestPathFor(batch.id),
      JSON.stringify(
        {
          batch_id: batch.id,
          submitted_at: new Date().toISOString(),
          generator: GEN,
          items: items.map((item, i) => ({
            kind: item.kind,
            target: targetAt(i),
            // The whole source row, not a reference to it. Quote verification
            // reads the source text, so a manifest holding only an id would
            // need the database back — and the reason to resume is usually
            // that something went wrong the first time.
            source: item.source,
          })),
        },
        null,
        2
      ) + "\n",
      "utf8"
    );

    console.log(`batch ${batch.id} accepted — polling every 30s.`);
    console.log(`if this is interrupted, collect it later with:`);
    console.log(`  node scripts/diuni/generate-diuni-set.mjs --resume=${batch.id}`);
  }

  const startedAt = Date.now();
  const mins = () => `${((Date.now() - startedAt) / 60000).toFixed(1)}m`;
  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 30_000));
    status = await anthropic.messages.batches.retrieve(batch.id);
    const c = status.request_counts ?? {};
    process.stdout.write(
      `\r  ${status.processing_status}: ${c.succeeded ?? 0} done, ` +
        `${c.processing ?? 0} running, ${c.errored ?? 0} errored [${mins()}]   `
    );
  }
  process.stdout.write("\n");

  // Default everything to a failure so a custom_id that never comes back —
  // which is what expiry looks like — reads as failed rather than as missing.
  const out = new Map(
    items.map((_, i) => [i, { ok: false, error: "no result returned for this question" }])
  );
  for await (const entry of await anthropic.messages.batches.results(batch.id)) {
    const i = Number(String(entry.custom_id).replace("diuni-q", ""));
    if (!out.has(i)) continue;
    const result = entry.result;
    out.set(
      i,
      result.type === "succeeded"
        ? { ok: true, message: result.message }
        : {
            ok: false,
            error: `batch request ${result.type}: ${
              result.error?.error?.message ?? result.error?.type ?? result.type
            }`,
          }
    );
  }
  return { results: out, seconds: ((Date.now() - startedAt) / 1000).toFixed(0) };
}

// When batching, every call is made and collected before the loop starts; the
// loop then validates and writes exactly as it does for live calls.
const batched = BATCH_API || RESUME ? await runBatchApi(items, RESUME) : null;

let written = 0;
for (const [i, item] of items.entries()) {
  const target = targetAt(i);
  const key = sourceKeyOf(item);
  const label = `${i + 1}/${items.length} [${item.kind}] ${key}`;
  process.stdout.write(
    `[${label}] ${batched ? "checking" : "generating"}${target ? ` (answer → ${target})` : ""}… `
  );
  const started = Date.now();

  let message;
  if (batched) {
    const outcome = batched.results.get(i);
    if (!outcome.ok) {
      console.log(`FAILED — ${outcome.error}`);
      continue;
    }
    message = outcome.message;
  } else {
    try {
      const stream = anthropic.messages.stream(buildRequestParams(item, target));
      message = await stream.finalMessage();
    } catch (error) {
      const detail = error?.error?.error?.message ?? error?.message ?? String(error);
      console.log(`FAILED — ${detail}`);
      continue;
    }
  }

  if (message.stop_reason === "refusal") {
    console.log(`refused (${message.stop_details?.category ?? "unknown"})`);
    continue;
  }
  if (message.stop_reason === "max_tokens") {
    console.log("hit max_tokens — raise model.max_tokens in the params file");
    continue;
  }

  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  let parsed;
  try {
    parsed = QuestionSchema.safeParse(JSON.parse(text));
  } catch (error) {
    console.log(`response was not JSON — ${error.message}`);
    continue;
  }
  if (!parsed.success) {
    console.log(`schema rejected — ${parsed.error.issues[0].message} at ${parsed.error.issues[0].path.join(".")}`);
    continue;
  }

  const q = parsed.data;
  const remapped = placeAnswerAt(q, target);
  const answerProblem = checkAnswer(q);
  const badQuotes = params.validation.require_verbatim_quote ? checkQuotes(q, item) : [];
  // Anonymity applies to judgments only — a statutory section has no parties
  // to expose and no case number to leak.
  const leaks = item.kind === "verdict" ? checkAnonymity(q, item.source) : [];

  // In batch mode every question arrived at once, so `started` measures the
  // validation and nothing else. Report the job's wall time and label it,
  // rather than printing a per-question "0s" that is true of nothing.
  const secs = batched
    ? `${batched.seconds}s (whole batch)`
    : `${((Date.now() - started) / 1000).toFixed(0)}s`;
  if (answerProblem || badQuotes.length || leaks.length) {
    console.log(`REJECTED after ${secs}`);
    if (answerProblem) console.log(`  answer key : ${answerProblem}`);
    for (const b of badQuotes) console.log(`  quote not found verbatim: "${b.slice(0, 80)}…"`);
    for (const l of leaks) console.log(`  leaks judgment identifier: ${l}`);
    continue;
  }

  // Provenance is shaped by the kind of material: a judgment is identified by
  // its case, a statute by (law_id, section). Both carry `grounding_kind` so a
  // reader — and the loader that assembles a paper — never has to infer which
  // set of fields is present.
  const provenance =
    item.kind === "law"
      ? {
          grounding_kind: "law",
          law_id: item.source.law_id,
          law_name: item.source.law_name,
          section_number: item.source.section_number,
          section_heading: item.source.heading || null,
        }
      : {
          grounding_kind: "verdict",
          verdict_id: item.source.verdict_id,
          case_number: item.source.case_number,
          court: item.source.court,
          category: item.source.category,
          decided_on: item.source.decided_on,
          judgment_area: item.source.judgment_area,
          judgment_area_id: item.source.judgment_area_id,
        };

  const payload = {
    generated_from: {
      ...provenance,
      model: GEN.model,
      effort: GEN.effort,
      prompt_version: GEN.prompt_version,
      answer_letter: q.correct_answer,
      answer_placement: target ? (remapped ? "remapped" : "as_asked") : "free",
      exemplars: GEN.exemplars,
      // The settings this draft was written under. Recorded because the draft
      // NUMBER does not identify the configuration: a brand-new source gets
      // `-Q1` whatever the params were, so a `-Q1` from today and a `-Q1` from
      // the first batch look alike on disk and were generated very differently.
      // measure-spread.mjs reads these rather than guessing from the filename.
      config: GEN.config,
      usage: message.usage,
    },
    question: {
      number: i + 1,
      fact_pattern: q.fact_pattern,
      stem: q.stem,
      options: q.options,
      correct_answer: q.correct_answer,
    },
    review: {
      number: i + 1,
      legal_topic_analysis: q.legal_topic_analysis,
      full_explanation: q.full_explanation,
      distractor_analysis: q.distractor_analysis,
      common_pitfall: q.common_pitfall,
      // Both forms: the structured one a human reviews, and the exact string
      // the practice panel parses.
      quick_thinking_360_items: q.quick_thinking_360,
      quick_thinking_360: serialise360(q.quick_thinking_360),
      summary_for_memory: q.summary_for_memory,
      concepts_and_skills: q.concepts_and_skills,
      references_list: q.references_list,
    },
    grounding_quotes: q.grounding_quotes,
  };

  const seq = nextSeqFor(key);
  const outPath = join(outDir, `${key}-Q${seq}.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  written++;
  console.log(
    `ok in ${secs} — answer ${q.correct_answer}${remapped ? " (remapped)" : ""}, ` +
      `${q.grounding_quotes.length} quotes verified → ${outPath}`
  );
}

console.log(`\n${written}/${items.length} written to ${outDir}`);
