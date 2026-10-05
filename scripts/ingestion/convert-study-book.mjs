// convert-study-book.mjs — a scanned study book into LawPass's own material,
// under scripts/ingestion/diuni_and_mhuti-LLM-params.json.
//
//   node scripts/ingestion/convert-study-book.mjs "מהותי 7" --dry-run
//   node scripts/ingestion/convert-study-book.mjs "מהותי 7" --commit
//   node scripts/ingestion/convert-study-book.mjs --all --text-field=mahoti --commit
//
// TWO PASSES, AND THE SECOND NEVER SEES THE BOOK.
//
//   Pass A   book pages -> bare learning points      (reads the source)
//   Pass B   learning points + statute -> a chapter  (R9: source withheld)
//
// Pass B's prompt is assembled from the learning points and from statute read
// out of public.mahoti_laws. study_material.original_text has no path into it.
// That is the contract's R1/R9 made mechanical rather than aspirational.
//
// WHY PAGE CHUNKS FOR PASS A. The book's own chapter divisions are part of its
// arrangement (R2), so they are not used as structure. They are used only to
// locate facts — a chunk of pages is a window onto the source, and what comes
// out of it is a list of facts with section numbers attached. The OUTPUT is
// organised by the law's chapters, which are the legislature's, not the
// publisher's.
//
// COST, measured on one chapter of מהותי 7 with Sonnet: $0.32 for 16 pages,
// 143s. A 91-page book is about $1.80; all eight מהותי books about $24.

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import pg from "pg";
import { mkdirSync, writeFileSync } from "node:fs";

import { deepStatuteText, sharedSpans, summarise, toWords } from "./lib/span-check.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
dotenv.config({ path: join(ROOT, ".env.local") });
dotenv.config({ path: join(ROOT, ".env") });

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const bookArg = argv.find((a) => !a.startsWith("--"));
const all = argv.includes("--all");
const commit = argv.includes("--commit");
const textField = flagOf("text-field") ?? "mahoti";
const MODEL = flagOf("model") ?? "claude-sonnet-5-5";
const PAGES_PER_CHUNK = Number(flagOf("chunk") ?? 16);
const CONCURRENCY = Number(flagOf("concurrency") ?? 3);
const OUT = flagOf("out") ?? join(HERE, "tmp", "converted");

/**
 * Hard cap on a learning point, in words.
 *
 * 20 was already the instruction; what was missing was anything enforcing it.
 * A "fact" long enough to be a sentence is long enough to be someone's
 * sentence, and that is exactly how the ten long findings reached the output.
 */
const MAX_POINT_WORDS = 20;
let droppedOverLong = 0;
const blockedBooks = [];
const emptyBooks = [];
let fatal = null;

/** Failures that will repeat for every remaining call, so the run should stop
 *  rather than spend the queue discovering the same thing. */
const FATAL = /credit balance is too low|authentication_error|invalid x-api-key|permission_error/i;

const RATE = MODEL.includes("haiku")
  ? { input: 1, output: 5 }
  : MODEL.includes("sonnet")
    ? { input: 2, output: 10 }
    : { input: 5, output: 25 };

if (!bookArg && !all) {
  console.error('usage: node scripts/ingestion/convert-study-book.mjs "מהותי 7" [--commit]\n       … --all --text-field=mahoti --commit');
  process.exit(2);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const client = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await client.connect();

/** Statute text at every depth. The corpus nests paragraphs inside
 *  subsections, and a flat read loses more than half of a long section. */
const deepText = (s) => {
  const out = [s.text ?? ""];
  for (const sub of s.subsections ?? []) {
    out.push(sub.text ?? "");
    for (const p of sub.paragraphs ?? []) out.push(p.text ?? "");
  }
  return out.filter(Boolean).join("\n");
};

const parse = (raw, arrayKey) => {
  const body = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(body);
  } catch {
    // A long extraction can hit max_tokens mid-object. Everything before that
    // is good data; salvage the complete objects rather than lose the call.
    if (!arrayKey) return null;
    const objects = [];
    for (const m of body.matchAll(/\{[^{}]*\}/g)) {
      try { objects.push(JSON.parse(m[0])); } catch { /* truncated tail */ }
    }
    return objects.length ? { [arrayKey]: objects, _truncated: true } : null;
  }
};

let inTok = 0, outTok = 0;
async function ask(system, user, maxTokens) {
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const message = await stream.finalMessage();
  inTok += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0);
  outTok += message.usage.output_tokens;
  return message.content.find((b) => b.type === "text")?.text ?? "";
}

const EXTRACT_SYSTEM =
  "אתה מחלץ עובדות משפטיות. אתה מחזיר עובדות בלבד — לעולם לא ניסוח, הסבר, דוגמה או אופן הצגה של המקור.";

const AUTHOR_SYSTEM = `אתה כותב חומר לימוד מקורי עבור LawPass, פלטפורמה להכנה לבחינת לשכת עורכי הדין.
אתה כותב בקול שלך: פנייה ישירה לנבחן, לשון מסבירה, ממוקדת בבחינה.
אינך רואה שום ספר לימוד ואינך מחקה אף מקור. אתה כותב מתוך עובדות ומתוך לשון החוק הרשמית.`;

/** Pass A — a window of pages becomes bare facts. */
async function extract(pages, lawName) {
  const text = pages.map((s) => [s.heading, ...s.paragraphs].join("\n")).join("\n\n");
  const raw = await ask(
    EXTRACT_SYSTEM,
    `להלן טקסט סרוק מספר לימוד למבחן לשכת עורכי הדין${lawName ? `, בנושא ${lawName}` : ""}.

חלץ ממנו רשימת "נקודות לימוד" — אמירות עובדתיות יבשות בלבד.

כללים מחייבים:
- כל נקודה היא עובדה משפטית: מה הכלל, מהו התנאי, מהו המספר, מהו החריג.
- אל תעתיק ניסוחים מהמקור. אל תשמור על סדר המקור. אל תכלול דוגמאות של המקור.
- אל תכלול הסברים או הערות של מחבר הספר — רק את העובדה עצמה.
- נקודה שהיא ציטוט של לשון החוק — דלג עליה. לשון החוק מגיעה ממקור רשמי.
- ציין לכל נקודה את מספרי הסעיפים שאליהם היא שייכת.
- כתוב בעברית, כל נקודה עד ${MAX_POINT_WORDS} מילים. נקודה ארוכה יותר — פצל לשתיים.
- הגדרה שיש בה רשימה ("X הוא ... כגון א, ב, ג") — אל תעתיק את הרשימה כלשונה.
  כתוב את הכלל בלבד, ואם הרשימה חיונית ציין רק את מספר הפריטים ואת שניים מהם.
- אל תכתוב משפט שלם שאפשר להעתיק ממנו. נקודה היא רשימת עובדה, לא פרוזה.

החזר JSON בלבד:
{"learning_points":[{"id":"lp1","statement":"...","sections":["1"]}]}

הטקסט:
${text}`,
    20000
  );
  const points = parse(raw, "learning_points")?.learning_points ?? [];

  // THE PROMPT IS NOT THE ENFORCEMENT. The first full run asked for 20 words
  // and got statements of 20+ — including definitional enumerations copied
  // whole ("a public institution is a non-profit body engaged in a public
  // purpose such as religion, culture, education…"), which Pass B then wrote
  // out and the span check caught. All ten of the long findings came through
  // this gap.
  //
  // A point over the cap is dropped rather than truncated: half a fact is
  // worse than no fact, and the same fact almost always arrives again from a
  // neighbouring chunk in a shorter form.
  const kept = [];
  let overLong = 0;
  for (const p of points) {
    if (!p || typeof p.statement !== "string") continue;
    const n = (p.statement.match(/\S+/g) ?? []).length;
    if (n > MAX_POINT_WORDS) { overLong += 1; continue; }
    kept.push(p);
  }
  if (overLong > 0) droppedOverLong += overLong;
  return kept;
}

/** Pass B — facts plus official statute become a chapter. No book here. */
async function author(chapterName, lawName, points, statute) {
  const statuteText = statute.map((s) => `§${s.number} ${s.heading}\n${s.text}`).join("\n\n");
  const raw = await ask(
    AUTHOR_SYSTEM,
    `כתוב פרק לימוד בנושא: ${chapterName} — ${lawName}.

יש לך שני מקורות בלבד:

(1) נקודות לימוד — עובדות משפטיות:
${points.map((p) => `- [${(p.sections ?? []).join(",")}] ${p.statement}`).join("\n")}

(2) לשון החוק הרשמית (מהמאגר הרשמי; מצטטים אותה כלשונה):
${statuteText}

כתוב פרק הבנוי כך:
- מבוא קצר: למה הפרק חשוב לנבחן (עד 120 מילים).
- עבור כל סעיף מהותי: כותרת משלך, ציטוט לשון החוק, ואחריו ההסבר שלך (עד 120 מילים) — מה הסעיף עושה, מתי הוא רלוונטי, ומה נבדק בבחינה.
- סדר את הפרק לפי הדרך שבה נבחן פוגש את הסוגיה, לא לפי סדר הסעיפים.

החזר JSON בלבד:
{"title":"...","intro":"...","sections":[{"heading":"...","statute_number":"1","statute_text":"...","explanation":"..."}]}`,
    16000
  );
  return parse(raw, "sections");
}

/** Run jobs with a small pool — these are long calls, not CPU work. */
async function pool(items, worker, size) {
  const queue = items.map((item, i) => [i, item]);
  const out = new Array(items.length);
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const [i, item] = next;
        try {
          out[i] = await worker(item, i);
        } catch (error) {
          const message = String(error.message ?? error);
          out[i] = { error: message };
          console.error(`    ! ${message}`);
          // SOME FAILURES WILL NEVER SUCCEED ON THE NEXT CALL. A refused
          // credit balance or a bad key fails identically for every remaining
          // chunk, and on 2026-10-05 the pool ground through 13 more doomed
          // requests and then wrote two empty books. Emptying the queue stops
          // the run at the first one.
          if (FATAL.test(message)) {
            fatal ??= message;
            queue.length = 0;
            return;
          }
        }
      }
    })
  );
  return out;
}

// Which books to convert.
const { rows: books } = await client.query(
  all
    ? `SELECT study_material_id, paper_id, original_text FROM public.study_material WHERE text_field=$1 ORDER BY sort_order`
    : `SELECT study_material_id, paper_id, original_text FROM public.study_material WHERE text_field=$1 AND paper_id LIKE $2 ORDER BY sort_order`,
  all ? [textField] : [textField, `${bookArg}%`]
);
if (books.length === 0) { console.error("no matching book"); await client.end(); process.exit(1); }

const { rows: laws } = await client.query(`SELECT law_id, law_name, sections_body FROM public.mahoti_laws`);
mkdirSync(OUT, { recursive: true });

console.log(`model ${MODEL} · ${books.length} book(s) · chunk ${PAGES_PER_CHUNK} pages · concurrency ${CONCURRENCY}\n`);

const started = Date.now();
for (const book of books) {
  const doc = book.original_text;
  const pages = doc.sections ?? [];
  const chunks = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_CHUNK) chunks.push(pages.slice(i, i + PAGES_PER_CHUNK));

  // The laws this book covers — used to find the statute in the corpus, never
  // reproduced as structure.
  //
  // MATCHED ON THE WHOLE TEXT, NOT THE RUNNING HEADERS. Headers worked for the
  // מהותי books, whose header is the law ("חוק העונשין, התשל״ז-1977"). The
  // דיוני books head their pages with the SUBJECT instead ("דיני הוצאה לפועל"),
  // which matches no law name, and 7 of the 8 books resolved to no laws at all
  // — a run that would have billed for extraction and produced no chapters.
  //
  // The threshold and the cap are what keep this from matching everything: a
  // procedural book cites half the statute book once in passing, and
  // תקנות סדר הדין האזרחי turns up in four books that are not about it.
  const bookText = pages.map((p) => [p.heading, ...p.paragraphs].join("\n")).join("\n");
  const MIN_MENTIONS = 3;
  const MAX_LAWS = 8;
  const countOf = (needle) => {
    let hits = 0;
    for (let at = 0; ; ) {
      const i = bookText.indexOf(needle, at);
      if (i < 0) break;
      hits += 1;
      at = i + needle.length;
    }
    return hits;
  };

  const covered = laws
    .map((l) => {
      const full = l.law_name.split(",")[0].split("[")[0].trim();
      const words = full.split(/\s+/);
      // LONGEST NAME FIRST, then shorter prefixes. Books cite a statute by its
      // short name: דיוני 15 writes "חוק חדלות פירעון" 208 times and the full
      // "חוק חדלות פירעון ושיקום כלכלי" twice, so matching only on the corpus's
      // full name missed the one statute that book is about.
      //
      // Taking the FIRST needle that clears the threshold rather than the
      // highest count keeps precision where the full name is used, and falls
      // back only where it is not.
      const needles = [full, words.slice(0, 4).join(" "), words.slice(0, 3).join(" ")];
      for (const needle of needles) {
        // A short needle would match anything; below 10 characters it is not
        // evidence of coverage.
        if (needle.length < 10) continue;
        const hits = countOf(needle);
        if (hits >= MIN_MENTIONS) return { law: l, hits };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_LAWS)
    .map((x) => x.law);
  const lawName = covered[0]?.law_name ?? "";

  console.log(`── ${book.paper_id}`);
  console.log(`   ${pages.length} pages, ${chunks.length} chunk(s), laws: ${covered.map((l) => l.law_name.slice(0, 28)).join(" | ") || "(none matched)"}`);

  if (!commit) {
    console.log(`   [dry run] would run ${chunks.length} extraction + chapter calls\n`);
    continue;
  }

  const pointSets = await pool(chunks, (chunk) => extract(chunk, lawName), CONCURRENCY);
  const points = pointSets.flat().filter((p) => p && p.statement);
  console.log(`   pass A: ${points.length} learning point(s)${droppedOverLong ? `, ${droppedOverLong} dropped over ${MAX_POINT_WORDS} words` : ""}`);

  // Group by the LAW's chapters — the legislature's arrangement, not the book's.
  const byChapter = new Map();
  for (const law of covered) {
    for (const s of law.sections_body ?? []) {
      const text = deepText(s).trim();
      if (text.length < 40) continue;
      const key = `${law.law_name}§${s.chapter || "(ללא פרק)"}`;
      if (!byChapter.has(key)) byChapter.set(key, { law: law.law_name, chapter: s.chapter || "(ללא פרק)", statute: [] });
      byChapter.get(key).statute.push({ number: s.number, heading: s.heading ?? "", text });
    }
  }
  const chapters = [...byChapter.values()].map((ch) => ({
    ...ch,
    points: points.filter((p) => (p.sections ?? []).some((n) => ch.statute.some((s) => s.number === String(n)))),
  })).filter((ch) => ch.points.length > 0);

  console.log(`   ${chapters.length} chapter(s) with facts to write about`);
  // A book that produced nothing is a FAILED book, however quiet the failure
  // was. The span check reports "0 blocking — passes" on an empty document,
  // which is true and useless: there is nothing in it to share a phrase with.
  // Without this the run exits 0 and the loader publishes an empty book.
  if (chapters.length === 0) {
    emptyBooks.push(book.paper_id);
    console.error(`   ! produced no chapters — ${points.length} learning point(s) extracted`);
  }
  const written = await pool(chapters, async (ch) => ({
    chapter: ch.chapter, law: ch.law, statute: ch.statute, points: ch.points,
    output: await author(ch.chapter, ch.law, ch.points, ch.statute),
  }), CONCURRENCY);

  // THE CHECK RUNS HERE, not in a separate script someone may forget.
  // diuni_and_mhuti-LLM-params.json v1.1.0: 6-8 words report, 9-11 need a
  // recorded decision, 12+ block. The source text is read locally and was
  // never in a prompt.
  const NL = "\n";
  const sourceWords = toWords(pages.map((p) => [p.heading, ...p.paragraphs].join(NL)).join(NL));
  const statuteWords = toWords(laws.flatMap((l) => (l.sections_body ?? []).map(deepStatuteText)).join(NL));
  const authoredText = written
    .flatMap((ch) => [
      ch.output?.intro ?? "",
      ...(ch.output?.sections ?? []).map((x) => `${x.heading}${NL}${x.explanation}`),
    ])
    .join(NL);
  const check = summarise(sharedSpans(authoredText, sourceWords, statuteWords));
  console.log(
    `   check: ${check.report} report, ${check.review} to review, ${check.block} BLOCKING` +
      ` — ${check.passes ? "passes" : "DOES NOT PASS"}`
  );
  for (const b of check.blocking) console.log(`     blocking (${b.length}w): ${b.text.slice(0, 70)}`);
  if (!check.passes) blockedBooks.push(book.paper_id);

  const dest = join(OUT, `${book.paper_id}.lawpass.json`);
  writeFileSync(dest, JSON.stringify({ paper_id: book.paper_id, model: MODEL, chapters: written, check: { report: check.report, review: check.review, block: check.block, passes: check.passes, blocking: check.blocking, needsReview: check.needsReview } }, null, 1), "utf8");
  const cost = (inTok / 1e6) * RATE.input + (outTok / 1e6) * RATE.output;
  console.log(`   -> ${dest}`);
  console.log(`   running total: $${cost.toFixed(4)}, ${((Date.now() - started) / 60000).toFixed(1)} min\n`);
}

await client.end();
const cost = (inTok / 1e6) * RATE.input + (outTok / 1e6) * RATE.output;
console.log(`tokens ${inTok.toLocaleString()} in, ${outTok.toLocaleString()} out`);
console.log(`cost   $${cost.toFixed(4)}`);
console.log(`time   ${((Date.now() - started) / 60000).toFixed(1)} min`);

if (fatal) {
  console.error(`\nrun stopped: ${fatal}`);
}

if (emptyBooks.length > 0) {
  console.error(
    [
      "",
      `${emptyBooks.length} book(s) produced no chapters at all:`,
      ...emptyBooks.map((b) => `  ${b}`),
      "These are failures, not empty sources. Re-run them.",
    ].join("\n")
  );
}

if (blockedBooks.length > 0 || emptyBooks.length > 0 || fatal) {
  // A non-zero exit is the only thing a shell script or a CI step will notice.
  console.error(
    [
      "",
      `${blockedBooks.length} book(s) carry a 12+ word shared span and do NOT pass the contract:`,
      ...blockedBooks.map((b) => `  ${b}`),
      "Rewrite those chapters before loading into lawpass_text.",
    ].join("\n")
  );
  process.exit(1);
}
