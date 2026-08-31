// generate-diuni-set.mjs — write דין דיוני exam questions from real law.
//
//   node scripts/diuni/generate-diuni-set.mjs                 # 1 question
//   node scripts/diuni/generate-diuni-set.mjs --count=6       # mixed per the params
//   node scripts/diuni/generate-diuni-set.mjs --source=law --count=3
//   node scripts/diuni/generate-diuni-set.mjs --law=2000798   # one statute only
//   node scripts/diuni/generate-diuni-set.mjs --case=78546-08-25
//   node scripts/diuni/generate-diuni-set.mjs --area=banking_law --effort=max
//   node scripts/diuni/generate-diuni-set.mjs --dry-run       # show the prompt, call nothing
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
// --source=law|verdict forces one kind for the whole run, overriding the mix.
// --law=<law_id> narrows the statute pool to one law.
const SOURCE_KIND = flag("source");
const LAW_ID = flag("law");
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

  const order =
    params.selection.order === "random"
      ? "random()"
      : params.selection.order === "oldest"
        ? "decided_on ASC NULLS LAST"
        : "decided_on DESC NULLS LAST";

  const { rows } = await client.query(
    `SELECT verdict_id, case_number, court, doc_type, decided_on,
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
function pickExemplars(pool, n) {
  if (params.exemplars.pick === "first") return pool.slice(0, n);
  if (params.exemplars.pick === "random") {
    return [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  }
  const step = Math.max(1, Math.floor(pool.length / n));
  return Array.from({ length: n }, (_, i) => pool[i * step]).filter(Boolean);
}
const exemplars = pickExemplars(allExemplars, params.exemplars.count);

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

// Candidate pools rather than exactly COUNT rows: material already written is
// filtered out below, so asking for exactly COUNT would keep returning the same
// already-used sources. 200 of each is a pool, not a limit on either table.
let verdictPool = [];
let lawPool = [];
try {
  const plan = planGrounding(COUNT);
  if (plan.includes("verdict")) verdictPool = await fetchVerdicts(client, 200);
  if (plan.includes("law")) lawPool = await fetchLawSections(client, 200);
  var groundingPlan = plan;
} finally {
  await client.end();
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
const countFor = (key) => existing.filter((f) => f.startsWith(`${key}-Q`)).length;

const FORCE = has("force");

/**
 * Fill the plan from the pools, skipping material already used.
 *
 * A kind whose pool runs dry falls back to the other rather than dropping the
 * question: with 39 laws and 364 judgments loaded, "no unused statute left"
 * should produce one more judgment question, not a short batch and no
 * explanation.
 */
const items = [];
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

if (items.length === 0) {
  console.error("nothing left to build from — every candidate source already has a question (--force to redo)");
  process.exit(1);
}

const verdictN = items.filter((i) => i.kind === "verdict").length;
console.log(`model      : ${MODEL} (effort ${EFFORT})`);
console.log(`exemplars  : ${exemplars.map((e) => e.number).join(", ")}`);
console.log(`grounding  : ${verdictN} verdict, ${items.length - verdictN} law`);
console.log(`sources    : ${items.map(sourceKeyOf).join(", ")}`);
console.log(`360 cards  : ${VARIATIONS}`);
console.log("");

if (DRY_RUN) {
  const sys = buildSystemPrompt(exemplars, items[0].kind);
  console.log(`=== SYSTEM (${items[0].kind}) ===`);
  for (const b of sys) console.log(b.text.slice(0, 1200) + "\n---");
  const user = buildUserPrompt(items[0], targetLetterFor(0, alreadyWritten));
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
    console.log(`  [${it.kind}] ${sourceKeyOf(it)} → ${targetLetterFor(i, alreadyWritten) ?? "free"}`)
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

let written = 0;
for (const [i, item] of items.entries()) {
  const target = targetLetterFor(i, alreadyWritten);
  const key = sourceKeyOf(item);
  const label = `${i + 1}/${items.length} [${item.kind}] ${key}`;
  process.stdout.write(`[${label}] generating${target ? ` (answer → ${target})` : ""}… `);
  const started = Date.now();

  let message;
  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: params.model.max_tokens,
      thinking: { type: "adaptive" },
      output_config: {
        effort: EFFORT,
        format: helpers.zodOutputFormat(QuestionSchema),
      },
      system: systemFor(item.kind),
      messages: [{ role: "user", content: buildUserPrompt(item, target) }],
    });
    message = await stream.finalMessage();
  } catch (error) {
    const detail = error?.error?.error?.message ?? error?.message ?? String(error);
    console.log(`FAILED — ${detail}`);
    continue;
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

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (answerProblem || badQuotes.length || leaks.length) {
    console.log(`REJECTED after ${secs}s`);
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
          decided_on: item.source.decided_on,
          judgment_area: item.source.judgment_area,
          judgment_area_id: item.source.judgment_area_id,
        };

  const payload = {
    generated_from: {
      ...provenance,
      model: MODEL,
      effort: EFFORT,
      prompt_version: params.generation.prompt_version,
      answer_letter: q.correct_answer,
      answer_placement: target ? (remapped ? "remapped" : "as_asked") : "free",
      exemplars: exemplars.map((e) => e.number),
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

  const seq = countFor(key) + 1;
  const outPath = join(outDir, `${key}-Q${seq}.json`);
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  written++;
  console.log(
    `ok in ${secs}s — answer ${q.correct_answer}${remapped ? " (remapped)" : ""}, ` +
      `${q.grounding_quotes.length} quotes verified → ${outPath}`
  );
}

console.log(`\n${written}/${items.length} written to ${outDir}`);
