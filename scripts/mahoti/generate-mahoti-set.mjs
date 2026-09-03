// scripts/mahoti/generate-mahoti-set.mjs
//
// One script for the whole דין־מהותי pipeline. It replaces the separate
// notebook / questions / review / loader steps with a single run:
//
//   1. NOTEBOOK  — reads `mahoti_laws` (the 39 scraped laws), samples
//                  --laws of them (default 25), then samples SECTIONS from
//                  those laws until the notebook lands inside the page
//                  budget (default 70–90 A4 pages), and builds the notebook
//                  JSON the study screen renders. Taking every section of 25
//                  laws is ~120 pages — more than a candidate can hold.
//   2. ROW       — writes that notebook to `mahoti_questions` immediately,
//                  with `questions` still NULL. That is a documented,
//                  supported intermediate state (see the migration), so a
//                  run that dies mid-generation leaves a resumable row
//                  rather than nothing.
//   3. QUESTIONS — asks Claude for --questions items (default 40) in
//                  batches of --batch (default 5, so 8 calls), each item
//                  carrying BOTH the question and its review. Generating
//                  them together is what guarantees the two payloads line up
//                  by `number`; the split into two columns happens here,
//                  after the model has spoken.
//   4. VERIFY    — every cited quote must appear verbatim in the notebook
//                  section it cites. Anything that fails is thrown away and
//                  re-asked. The model never sees law text that is not in
//                  the notebook, so a verified quote proves the paper is
//                  grounded in real legislation and not in its memory.
//   5. STORE     — every verified batch is written to the row as soon as it
//                  lands, not held to the end. A run that dies at batch 7
//                  therefore keeps the six batches already paid for, and
//                  re-running with --set-id resumes from what the row holds
//                  instead of regenerating it. The row is always a complete,
//                  readable paper — just a shorter one while a run is
//                  in flight.
//
// USAGE
//   node scripts/mahoti/generate-mahoti-set.mjs                    # 40 questions, 25 laws
//   node scripts/mahoti/generate-mahoti-set.mjs --questions=10     # shorter paper
//   node scripts/mahoti/generate-mahoti-set.mjs --questions=40 --laws=25 --seed=1234
//   node scripts/mahoti/generate-mahoti-set.mjs --inspect          # print corpus shape, write nothing
//   node scripts/mahoti/generate-mahoti-set.mjs --notebook-only    # stop after step 2
//   node scripts/mahoti/generate-mahoti-set.mjs --set-id=<uuid>    # generate into an existing notebook row
//   node scripts/mahoti/generate-mahoti-set.mjs --dry-run          # generate, print, write nothing
//
// FLAGS
//   --questions=N     how many questions to produce           (default 40)
//   --laws=N          how many laws go into the notebook      (default 25)
//   --min-pages=N     smallest acceptable notebook, A4 pages  (default 70)
//   --max-pages=N     largest acceptable notebook, A4 pages   (default 90)
//   --batch=N         questions per model call                (default 5)
//   --concurrency=N   model calls in flight at once           (default 4)
//   --batch-api       send each wave through the Batch API — half price on
//                     input and output, no effect on the questions. Trades
//                     live progress for cost: a wave returns all at once.
//   --seed=N          makes the law sample reproducible       (default: random)
//   --model=ID        Claude model id                         (default claude-opus-5)
//   --effort=LEVEL    low | medium | high | xhigh | max       (default high)
//   --max-attempts=N  extra passes to refill rejected items   (default 4)
//   --title=TEXT      exam title stored in questions.exam     (default "דיון מהותי")
//   --set-id=UUID     reuse an existing notebook row
//   --notebook-only   build + store the notebook, then stop
//   --inspect         describe the corpus and exit
//   --estimate        price the run before making it, then exit
//   --dry-run         do everything except write to Supabase
//
// ENV (read from .env.local, then .env)
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY   service-role write access
//   ANTHROPIC_API_KEY                                the model call
//
// The Anthropic SDK is not a dependency of the Next app, only of
// lawpass_server. Install it once at the repo root before the first run:
//   pnpm add -D @anthropic-ai/sdk

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

dotenv.config({ path: ".env.local" });
dotenv.config();

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Every flag this script accepts. An unknown flag is a hard error, not a
 *  no-op: `--dryrun` for `--dry-run` would otherwise be silently ignored and
 *  the run would write to the database the user was trying to protect. */
const KNOWN_FLAGS = new Set([
  "questions",
  "laws",
  "min-pages",
  "max-pages",
  "batch",
  "batch-api",
  "concurrency",
  "seed",
  "model",
  "effort",
  "max-attempts",
  "title",
  "set-id",
  "notebook-only",
  "inspect",
  "estimate",
  "dry-run",
  "help",
]);

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      console.error(`Unrecognised argument: ${arg}`);
      process.exit(1);
    }
    if (!KNOWN_FLAGS.has(match[1])) {
      console.error(
        `Unknown flag --${match[1]}. Known flags: ${[...KNOWN_FLAGS].map((f) => `--${f}`).join(", ")}`
      );
      process.exit(1);
    }
    out[match[1]] = match[2] ?? "true";
  }
  return out;
}

function intArg(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER, name }) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    console.error(`--${name} must be a whole number between ${min} and ${max}. Got: ${value}`);
    process.exit(1);
  }
  return n;
}

const args = parseArgs(process.argv.slice(2));

const QUESTION_COUNT = intArg(args.questions, 40, { max: 200, name: "questions" });
const LAW_COUNT = intArg(args.laws, 25, { max: 200, name: "laws" });
const MIN_PAGES = intArg(args["min-pages"], 70, { max: 1000, name: "min-pages" });
const MAX_PAGES = intArg(args["max-pages"], 90, { max: 1000, name: "max-pages" });

if (MIN_PAGES > MAX_PAGES) {
  console.error(`--min-pages (${MIN_PAGES}) cannot exceed --max-pages (${MAX_PAGES}).`);
  process.exit(1);
}
const BATCH_SIZE = intArg(args.batch, 5, { max: 10, name: "batch" });
const CONCURRENCY = intArg(args.concurrency, 4, { max: 10, name: "concurrency" });
/**
 * Send each wave through the Batch API instead of as live streamed calls.
 *
 * Half price on both input and output, for one trade: a batch is not
 * interactive. The whole wave is submitted, then polled, and nothing comes back
 * until every request in it has finished — so a wave takes as long as its
 * slowest member with no partial output on the way. Anthropic's ceiling is 24h;
 * in practice a mahoti wave lands in roughly the same time the streamed path
 * takes, because that path is already gated on its slowest call at the
 * `Promise.allSettled` barrier.
 *
 * Off by default. The streamed path prints progress and fails fast, which is
 * what you want while iterating on a prompt; this is what you want when the
 * prompt is settled and you are paying for 40 questions.
 *
 * NOT COMBINED WITH PROMPT CACHING, and that is not an oversight — see the note
 * above `lawsForBatch`.
 */
const BATCH_API = args["batch-api"] === "true";
const MAX_ATTEMPTS = intArg(args["max-attempts"], 4, { max: 20, name: "max-attempts" });
const SEED = intArg(args.seed, Math.floor(Math.random() * 2_147_483_647), {
  min: 0,
  name: "seed",
});
const MODEL = args.model ?? "claude-opus-5";
const EFFORT = args.effort ?? "high";
const TITLE = args.title ?? "דיון מהותי";
const SET_ID = args["set-id"] ?? null;
const NOTEBOOK_ONLY = args["notebook-only"] === "true";
const INSPECT = args.inspect === "true";
const ESTIMATE = args.estimate === "true";
const DRY_RUN = args["dry-run"] === "true";

const VALID_EFFORT = ["low", "medium", "high", "xhigh", "max"];
if (!VALID_EFFORT.includes(EFFORT)) {
  console.error(`--effort must be one of: ${VALID_EFFORT.join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY in .env.local. Aborting."
  );
  process.exit(1);
}
if (!ANTHROPIC_API_KEY && !INSPECT && !NOTEBOOK_ONLY) {
  console.error("Missing ANTHROPIC_API_KEY in .env.local. Aborting.");
  process.exit(1);
}

// Service role: `mahoti_laws` and `mahoti_questions` are both admin-only
// under RLS, and this script is authoring-side tooling, not user traffic.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Deterministic sampling
// ---------------------------------------------------------------------------

/** mulberry32 — small, fast, and seedable, so --seed reproduces a notebook
 *  exactly. Math.random() cannot, and a notebook you cannot rebuild is a
 *  paper you cannot explain after the fact. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Step 1 — the notebook
// ---------------------------------------------------------------------------

/** Whitespace-insensitive compare basis. The scraped text and the model's
 *  quote of it differ in line breaks and runs of spaces far more often than
 *  in words, and a quote check that fails on a newline teaches nothing. */
function normalise(text) {
  return String(text ?? "")
    .replace(/[‎‏‪-‮]/g, "") // bidi marks
    .replace(/["'`״]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `sections_body` is written by the scraper, not by this repo, so every field
 * is read defensively: a section that is missing subsections is a section
 * with none, not a crash. Run with --inspect to see the real shape of a row
 * before trusting this mapping.
 */
function normaliseSection(raw) {
  const subsections = Array.isArray(raw?.subsections) ? raw.subsections : [];
  return {
    number: String(raw?.number ?? raw?.section_number ?? "").trim(),
    heading: String(raw?.heading ?? raw?.title ?? "").trim(),
    text: String(raw?.text ?? raw?.body ?? "").trim(),
    chapter: raw?.chapter ? String(raw.chapter).trim() : null,
    subsections: subsections.map((sub) => ({
      marker: String(sub?.marker ?? sub?.number ?? "").trim(),
      text: String(sub?.text ?? sub?.body ?? "").trim(),
      paragraphs: (Array.isArray(sub?.paragraphs) ? sub.paragraphs : []).map((p) => ({
        marker: String(p?.marker ?? p?.number ?? "").trim(),
        text: String(p?.text ?? p?.body ?? "").trim(),
      })),
    })),
  };
}

/** Everything a quote may be checked against for one section: its own text
 *  plus every subsection and paragraph under it. The model is told it may
 *  quote any of them, so all of them count as the source. */
function sectionHaystack(section) {
  const parts = [section.text];
  for (const sub of section.subsections) {
    parts.push(sub.text);
    for (const para of sub.paragraphs) parts.push(para.text);
  }
  return normalise(parts.filter(Boolean).join(" "));
}

async function fetchCorpus() {
  const { data, error } = await supabase
    .from("mahoti_laws")
    .select("law_id, law_name, sections_body")
    .order("law_name", { ascending: true });

  if (error) throw new Error(`failed to read mahoti_laws: ${error.message}`);
  if (!data?.length) throw new Error("mahoti_laws is empty — nothing to build a notebook from.");
  return data;
}

/** ~3,000 characters to an A4 page of Hebrew body text. A round figure, and
 *  only ever used to say "about this many pages". */
const CHARS_PER_A4_PAGE = 3000;

/**
 * Picks sections until the notebook fills its page budget.
 *
 * Every section of 25 laws is ~1,430 sections and ~120 pages — a reference
 * volume, not something a candidate reads beside an exam. So laws are sampled
 * first (all --laws of them survive), then sections are sampled out of those
 * laws until the budget is met.
 *
 * Two passes, because the order matters:
 *   1. one section from every law, so no sampled law ends up represented by
 *      nothing — a law in the table of contents with no sections under it is
 *      worse than a shorter notebook;
 *   2. round-robin across the laws until the target is reached, which spreads
 *      the remaining budget evenly instead of letting חוק העונשין (400+
 *      sections) eat it before the alphabet gets going.
 *
 * Sections are never truncated to make them fit. Half a section is a quote
 * trap: the model would quote text the verifier can still find in the stored
 * section but the candidate cannot read on screen.
 */
function sampleSections(laws, rng, targetChars, maxChars) {
  // Each law's sections in random order, tagged with their original index so
  // the chosen ones can be put back into document order at the end.
  const queues = laws.map((law) =>
    shuffled(
      law.sections.map((section, index) => ({
        section,
        index,
        cost: sectionHaystack(section).length,
      })),
      rng
    )
  );
  const chosen = laws.map(() => []);
  let used = 0;

  // Pass 1 — guarantee every law is represented, cheapest section first so a
  // law made entirely of enormous sections still gets in.
  for (let i = 0; i < queues.length; i++) {
    const queue = queues[i];
    if (!queue.length) continue;
    let pick = 0;
    for (let j = 1; j < queue.length; j++) {
      if (queue[j].cost < queue[pick].cost) pick = j;
    }
    const [entry] = queue.splice(pick, 1);
    chosen[i].push(entry);
    used += entry.cost;
  }

  // Pass 2 — round-robin fill.
  let placedThisRound = true;
  while (placedThisRound && used < targetChars) {
    placedThisRound = false;
    for (let i = 0; i < queues.length && used < targetChars; i++) {
      const queue = queues[i];
      while (queue.length) {
        const entry = queue.shift();
        if (used + entry.cost > maxChars) {
          // Too big for the room that is left. Drop it and try this law's
          // next section rather than closing the law out entirely.
          placedThisRound = true;
          continue;
        }
        chosen[i].push(entry);
        used += entry.cost;
        placedThisRound = true;
        break;
      }
    }
  }

  return {
    used,
    perLaw: chosen.map((entries) =>
      entries.sort((a, b) => a.index - b.index).map((e) => e.section)
    ),
  };
}

function buildNotebook(corpus) {
  if (corpus.length < LAW_COUNT) {
    throw new Error(
      `--laws=${LAW_COUNT} but mahoti_laws holds only ${corpus.length} laws. ` +
        `Lower --laws, or scrape more legislation first.`
    );
  }

  const rng = makeRng(SEED);

  const all = corpus
    .map((row) => {
      const sections = (Array.isArray(row.sections_body) ? row.sections_body : [])
        .map(normaliseSection)
        // A section with no number cannot be cited, and one with no text
        // cannot be quoted. Either way it is not usable source material.
        .filter((s) => s.number && s.text);
      return {
        law_id: row.law_id,
        law_name: row.law_name,
        sections,
        chars: sections.reduce((n, s) => n + sectionHaystack(s).length, 0),
      };
    })
    .filter((law) => law.sections.length > 0);

  if (all.length < LAW_COUNT) {
    throw new Error(
      `--laws=${LAW_COUNT} but only ${all.length} laws in mahoti_laws have usable sections.`
    );
  }

  const floorChars = MIN_PAGES * CHARS_PER_A4_PAGE;
  const picked = shuffled(all, rng).slice(0, LAW_COUNT);

  // A random draw of 25 can be all short laws — seed 7 lands on a set holding
  // only ~68 pages in total, and no amount of section sampling reaches a
  // 70-page floor from there. Rather than quietly return a thin notebook,
  // trade the smallest picked laws for the biggest unpicked ones until the
  // floor is reachable. Still 25 laws, still seeded and reproducible.
  const pickedIds = new Set(picked.map((law) => law.law_id));
  const bench = all
    .filter((law) => !pickedIds.has(law.law_id))
    .sort((a, b) => b.chars - a.chars);

  let swaps = 0;
  let total = picked.reduce((n, law) => n + law.chars, 0);
  while (total < floorChars && bench.length) {
    picked.sort((a, b) => a.chars - b.chars);
    const incoming = bench[0];
    const outgoing = picked[0];
    // Nothing left on the bench is bigger than what is already in — swapping
    // would only shuffle names around.
    if (incoming.chars <= outgoing.chars) break;
    picked[0] = incoming;
    bench.shift();
    total += incoming.chars - outgoing.chars;
    swaps++;
  }
  if (swaps) {
    console.log(
      `  swapped ${swaps} small law${swaps === 1 ? "" : "s"} for larger ones to clear the ` +
        `${MIN_PAGES}-page floor`
    );
  }

  const availableSections = picked.reduce((n, law) => n + law.sections.length, 0);
  const availableChars = total;

  // Aim at the middle of the band, not at its ceiling: the loop stops on the
  // first section that crosses the target, so aiming at the top would land
  // just over it.
  const targetChars = Math.round(((MIN_PAGES + MAX_PAGES) / 2) * CHARS_PER_A4_PAGE);
  const maxChars = MAX_PAGES * CHARS_PER_A4_PAGE;
  const { used, perLaw } = sampleSections(picked, rng, targetChars, maxChars);

  const laws = picked
    .map((law, i) => ({
      law_id: law.law_id,
      law_name: law.law_name,
      section_count: perLaw[i].length,
      sections: perLaw[i],
    }))
    .filter((law) => law.section_count > 0)
    // Hebrew-alphabetical inside the notebook, so the table of contents reads
    // like a book even though the sample itself was random.
    .sort((a, b) => a.law_name.localeCompare(b.law_name, "he"));

  const pages = Math.max(1, Math.round(used / CHARS_PER_A4_PAGE));

  if (pages < MIN_PAGES) {
    console.warn(
      `  note: the notebook came to ~${pages} pages, under the ${MIN_PAGES}-page floor — ` +
        `the ${LAW_COUNT} sampled laws only hold ` +
        `~${Math.round(availableChars / CHARS_PER_A4_PAGE)} pages of text in total.`
    );
  }

  return {
    notebook: {
      seed: SEED,
      law_count: laws.length,
      section_count: laws.reduce((n, law) => n + law.section_count, 0),
      estimated_a4_pages: pages,
      built_at: new Date().toISOString(),
      // Sampling parameters travel with the notebook, so a paper can be
      // explained — and rebuilt — from the row alone.
      page_budget: { min: MIN_PAGES, max: MAX_PAGES, chars_per_page: CHARS_PER_A4_PAGE },
      sections_available: availableSections,
    },
    laws,
  };
}

// ---------------------------------------------------------------------------
// Step 3 — the model
// ---------------------------------------------------------------------------

const LETTERS = ["א", "ב", "ג", "ד"];

const SourceSchema = z.object({
  law_id: z.number().int(),
  law_name: z.string(),
  section_number: z.string(),
  source_quote: z.string(),
});

const ItemSchema = z.object({
  fact_pattern: z.string(),
  stem: z.string(),
  options: z
    .array(z.object({ letter: z.enum(LETTERS), text: z.string() }))
    .length(4),
  correct_answer: z.enum(LETTERS),
  sources: z.array(SourceSchema).min(1),
  review: z.object({
    legal_topic_analysis: z.string(),
    explanation: z.string(),
    common_pitfall: z.string(),
    quick_thinking_360: z.string(),
    summary_for_memory: z.string(),
    concepts_and_skills: z.array(z.string()).min(1),
    distractor_analysis: z.object({
      א: z.string(),
      ב: z.string(),
      ג: z.string(),
      ד: z.string(),
    }),
  }),
});

const BatchSchema = z.object({ items: z.array(ItemSchema) });

const SYSTEM_PROMPT = `אתה כותב שאלות רב-ברירה לבחינת ההסמכה בלשכת עורכי הדין בישראל, לחלק ג' — דין מהותי.

חוקי ברזל:
1. מותר להסתמך אך ורק על לשון החוק שמופיעה במחברת שמצורפת להודעת המשתמש. אין להסתמך על ידע חיצוני, על פסיקה, או על נוסח שאינו מופיע במחברת.
2. לכל שאלה חייב להיות לפחות מקור אחד, ובו law_id ו-section_number בדיוק כפי שהם מופיעים במחברת, וכן source_quote — ציטוט מילה במילה מתוך אותו סעיף. הציטוט חייב להיות רצף תווים שמופיע ככתבו בטקסט הסעיף. אל תקצר, אל תנסח מחדש ואל תוסיף נקודות השמטה.
3. ארבע אפשרויות בדיוק, באותיות א, ב, ג, ד. תשובה נכונה אחת. שלושת המסיחים חייבים להיות שגויים לפי לשון החוק, אך סבירים למי שלמד ברפרוף — טעות מושגית נפוצה, החלפה בין סעיפים, או תנאי שהושמט.
4. מסכת עובדות קצרה וקונקרטית: שמות, תאריכים וסכומים. שאלה שהיא ציטוט חוק בתחפושת אינה שאלת בחינה.
5. השאלה נכתבת בעברית משפטית תקנית, בגוף שלישי, ללא פנייה לנבחן.
6. אין לחזור על נושא, על סעיף או על מבנה שאלה שכבר נוצרו ברשימה שתימסר לך.

לכל שאלה כתוב גם את תוכן הבדיקה בעברית: ניתוח הנושא המשפטי, הסבר משפטי מלא, ניתוח לכל אחד מארבעת המסיחים (כולל התשובה הנכונה — מדוע היא נכונה), מלכודת נפוצה, חשיבה 360°, מבט מסכם, ורשימת מושגים ומיומנויות.`;

/** The slice of the notebook a single call is allowed to see.
 *
 *  Two reasons not to send all 25 laws every time: cost, and sameness — a
 *  model shown the whole corpus repeatedly gravitates to the same handful of
 *  headline sections. Rotating a window across batches is what spreads
 *  coverage over the notebook instead of over the model's preferences.
 *
 *  WHY THERE IS NO PROMPT CACHING ON THIS SCRIPT. It looks like the obvious
 *  saving and it is worth nothing here, for two independent reasons.
 *
 *  1. The window is different every batch. With 25 laws and a step of 4, the
 *     eight batches of a 40-question run see [0-3], [4-7], [8-11], [12-15],
 *     [16-19], [20-23], [24,0,1,2], [3-6] — no two alike. A cache needs a
 *     repeated prefix and there isn't one, at any TTL. A longer TTL extends
 *     reuse; it cannot create it.
 *  2. What the batches DO share — the system prompt plus the prompt
 *     scaffolding, ~1,230 characters — is under the 1,024-token minimum
 *     cacheable prefix, so a `cache_control` breakpoint there is ignored
 *     rather than merely unhelpful.
 *
 *  Caching would start paying only if consecutive batches were pinned to the
 *  same window, and that is a content change, not a caching one: it trades the
 *  topic spread this rotation exists to produce. If that trade is ever wanted,
 *  it belongs in a deliberate change to the window schedule — with the spread
 *  re-measured afterwards — not smuggled in as an optimisation. The Batch API
 *  (--batch-api) gets the same 50% off with no effect on content at all. */
function lawsForBatch(notebook, batchIndex, lawsPerBatch = 4) {
  const total = notebook.laws.length;
  const start = (batchIndex * lawsPerBatch) % total;
  const window = [];
  for (let i = 0; i < Math.min(lawsPerBatch, total); i++) {
    window.push(notebook.laws[(start + i) % total]);
  }
  return window;
}

/** Hard ceiling on how much law text one call carries. Sections are dropped
 *  from the end of each law rather than truncated mid-sentence — half a
 *  section is a quote trap, since the model would quote text the verifier
 *  can still find but the candidate cannot read. */
function renderLaws(laws, charBudget = 90_000) {
  let used = 0;
  const blocks = [];

  for (const law of laws) {
    const lines = [`### ${law.law_name}  (law_id: ${law.law_id})`];
    for (const section of law.sections) {
      const body = [
        `סעיף ${section.number}${section.heading ? ` — ${section.heading}` : ""}`,
        section.text,
        ...section.subsections.flatMap((sub) => [
          sub.marker ? `(${sub.marker}) ${sub.text}` : sub.text,
          ...sub.paragraphs.map((p) => (p.marker ? `  (${p.marker}) ${p.text}` : `  ${p.text}`)),
        ]),
      ]
        .filter(Boolean)
        .join("\n");

      if (used + body.length > charBudget) break;
      used += body.length;
      lines.push(body);
    }
    if (lines.length > 1) blocks.push(lines.join("\n\n"));
  }

  return blocks.join("\n\n---\n\n");
}

function buildUserPrompt(notebook, batchIndex, wanted, alreadyCovered) {
  const laws = lawsForBatch(notebook, batchIndex);
  const covered = alreadyCovered.length
    ? `\n\nנושאים וסעיפים שכבר נוצרו — אל תחזור עליהם:\n${alreadyCovered
        .map((c) => `- ${c}`)
        .join("\n")}`
    : "";

  return `להלן קטע מתוך מחברת החקיקה. זהו כל החומר שמותר להסתמך עליו.

${renderLaws(laws)}

כתוב ${wanted} שאלות חדשות המבוססות על החומר שלמעלה בלבד.${covered}`;
}

let anthropic = null;
let zodOutputFormat = null;

/** Thrown for errors where trying again cannot help: no credit, bad key, a
 *  malformed request. The wave loop stops on these instead of spending the
 *  rest of its budget discovering the same thing forty times. */
class FatalApiError extends Error {}

async function loadAnthropic() {
  try {
    const [{ default: Anthropic }, helpers] = await Promise.all([
      import("@anthropic-ai/sdk"),
      import("@anthropic-ai/sdk/helpers/zod"),
    ]);
    zodOutputFormat = helpers.zodOutputFormat;
    anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      // These calls are minutes long by nature. The SDK's 10-minute default
      // cut wave 1 off mid-generation on the first real run — and because a
      // timeout is retryable, the default `maxRetries: 2` turned four
      // abandoned calls into up to twelve billed ones. The server finishes
      // and charges for work the client walked away from, so a generous
      // timeout with one retry is both faster and cheaper than a tight
      // timeout with three attempts.
      timeout: 30 * 60 * 1000,
      maxRetries: 1,
    });
  } catch (cause) {
    throw new Error(
      "@anthropic-ai/sdk is not installed at the repo root. Run:\n" +
        "  pnpm add -D @anthropic-ai/sdk\n" +
        `(original error: ${cause.message})`
    );
  }
}

/** A 400/401/403/404 means the request itself is wrong or the account cannot
 *  serve it. Re-sending an identical request changes nothing. */
function isFatalStatus(status) {
  return status === 400 || status === 401 || status === 403 || status === 404;
}

/**
 * The request one batch makes, independent of how it is sent.
 *
 * Shared by the streamed path and the Batch API path so the two cannot drift:
 * a model or effort change that reached only one of them would show up as an
 * unexplained quality difference between two runs of the same script.
 */
function buildRequestParams(notebook, batchIndex, wanted, covered) {
  return {
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: EFFORT,
      format: zodOutputFormat(BatchSchema),
    },
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildUserPrompt(notebook, batchIndex, wanted, covered) },
    ],
  };
}

/**
 * Turn a finished message into items, or throw with the reason it cannot be.
 *
 * Both transports reach this with the same object: a Batch API result carries
 * a `message` of exactly the shape `stream.finalMessage()` resolves to, so the
 * refusal / truncation / schema checks are written once.
 */
function parseBatchMessage(message) {
  if (message.stop_reason === "refusal") {
    throw new Error(
      `the model declined this batch (${message.stop_details?.category ?? "unknown"})`
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("hit max_tokens mid-answer — rerun with a smaller --batch");
  }

  const text = message.content.find((block) => block.type === "text")?.text ?? "";
  let parsed;
  try {
    parsed = BatchSchema.safeParse(JSON.parse(text));
  } catch (error) {
    throw new Error(`response was not JSON: ${error.message}`);
  }
  if (!parsed.success) {
    throw new Error(`response did not match the schema: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data.items;
}

async function requestBatch(notebook, batchIndex, wanted, covered) {
  let message;
  try {
    // Streamed, not `messages.parse`. A non-streaming call of this size ran
    // past the HTTP timeout on the first real run; streaming holds the
    // connection open for as long as the model needs. `output_config.format`
    // still constrains the shape server-side — the difference is transport.
    const stream = anthropic.messages.stream(
      buildRequestParams(notebook, batchIndex, wanted, covered)
    );
    message = await stream.finalMessage();
  } catch (error) {
    if (isFatalStatus(error?.status)) {
      // Strip the JSON envelope the API returns so the terminal shows the
      // sentence a human needs, not a wall of escaped braces.
      const detail = error?.error?.error?.message ?? error?.message ?? String(error);
      throw new FatalApiError(detail);
    }
    throw error;
  }

  return parseBatchMessage(message);
}

/**
 * Send a whole wave through the Batch API. Half price, one round trip.
 *
 * RETURNS THE SHAPE `Promise.allSettled` RETURNS — `{status, value}` /
 * `{status, reason}`, in wave order — because the folding loop below already
 * handles per-batch success and failure correctly, and a second result shape
 * would mean a second copy of that logic. The transport changes; nothing
 * downstream of it does.
 *
 * A per-request failure inside the batch is one rejected slot, not a dead run:
 * the Batch API reports `errored`, `canceled` and `expired` per `custom_id`,
 * so a wave of four that loses one still folds in the other three. Only a
 * failure to submit or to poll takes the wave down, and an auth or billing
 * refusal at submit time is raised as FatalApiError so the run stops instead
 * of resubmitting the same rejected wave until `maxBatches` runs out.
 */
async function requestWaveViaBatchApi(notebook, wave, wanted, covered) {
  // custom_id has to survive the round trip as the only link back to which
  // batch a result belongs to — results come back in completion order, not
  // submission order.
  const idFor = (batchIndex) => `mahoti-b${batchIndex}`;

  let batch;
  try {
    batch = await anthropic.messages.batches.create({
      requests: wave.map((batchIndex) => ({
        custom_id: idFor(batchIndex),
        params: buildRequestParams(notebook, batchIndex, wanted, covered),
      })),
    });
  } catch (error) {
    if (isFatalStatus(error?.status)) {
      const detail = error?.error?.error?.message ?? error?.message ?? String(error);
      throw new FatalApiError(detail);
    }
    throw error;
  }

  // Poll rather than stream. 20s is chosen against the work, not the API: a
  // mahoti batch is minutes long, so a tighter interval buys no earlier finish
  // and only spends rate limit on questions whose answer has not changed.
  const POLL_MS = 20_000;
  // This function's own clock. The run-level `elapsed()` is a local of the
  // generate step and is not in scope here.
  const submittedAt = Date.now();
  const waiting = () => `${((Date.now() - submittedAt) / 60000).toFixed(1)}m`;
  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    status = await anthropic.messages.batches.retrieve(batch.id);
    const c = status.request_counts ?? {};
    process.stdout.write(
      `\r    batch job ${batch.id}: ${status.processing_status} ` +
        `(${c.succeeded ?? 0} done, ${c.processing ?? 0} running, ${c.errored ?? 0} errored) [${waiting()}]   `
    );
  }
  process.stdout.write("\n");

  // Default every slot to a rejection. A custom_id that never comes back —
  // which is what expiry looks like — then reads as a failed batch rather than
  // as a silently missing one.
  const bySlot = new Map(
    wave.map((batchIndex) => [
      idFor(batchIndex),
      { status: "rejected", reason: new Error("no result returned for this batch") },
    ])
  );

  for await (const entry of await anthropic.messages.batches.results(batch.id)) {
    if (!bySlot.has(entry.custom_id)) continue;
    const result = entry.result;
    if (result.type !== "succeeded") {
      const detail =
        result.error?.error?.message ?? result.error?.type ?? result.type;
      bySlot.set(entry.custom_id, {
        status: "rejected",
        reason: new Error(`batch request ${result.type}: ${detail}`),
      });
      continue;
    }
    try {
      bySlot.set(entry.custom_id, {
        status: "fulfilled",
        value: parseBatchMessage(result.message),
      });
    } catch (error) {
      bySlot.set(entry.custom_id, { status: "rejected", reason: error });
    }
  }

  return wave.map((batchIndex) => bySlot.get(idFor(batchIndex)));
}

// ---------------------------------------------------------------------------
// Step 4 — verification
// ---------------------------------------------------------------------------

/** law_id -> section_number -> searchable text, built once per run. */
function indexNotebook(notebook) {
  const index = new Map();
  for (const law of notebook.laws) {
    const sections = new Map();
    for (const section of law.sections) {
      sections.set(section.number.trim(), sectionHaystack(section));
    }
    index.set(law.law_id, { law_name: law.law_name, sections });
  }
  return index;
}

/**
 * Returns null when the item is good, or a human-readable reason when it is
 * not. Rejections are counted and reported: a run where half the questions
 * were thrown away is a run whose prompt needs work, and silently topping the
 * count back up would hide that.
 */
function rejectionReason(item, index) {
  const letters = item.options.map((o) => o.letter);
  if (new Set(letters).size !== 4) return "options are not א/ב/ג/ד exactly once";
  if (!letters.includes(item.correct_answer)) return "correct_answer names no option";

  for (const source of item.sources) {
    const law = index.get(source.law_id);
    if (!law) return `cites law_id ${source.law_id}, which is not in the notebook`;

    const haystack = law.sections.get(String(source.section_number).trim());
    if (haystack === undefined) {
      return `cites ${law.law_name} סעיף ${source.section_number}, which is not in the notebook`;
    }

    const needle = normalise(source.source_quote);
    if (needle.length < 8) return "source_quote is too short to prove anything";
    if (!haystack.includes(needle)) {
      return `quote not found verbatim in ${law.law_name} סעיף ${source.section_number}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step 5 — payloads and storage
// ---------------------------------------------------------------------------

function toPayloads(items, stats) {
  const questions = items.map((item, i) => ({
    number: i + 1,
    fact_pattern: item.fact_pattern,
    stem: item.stem,
    options: item.options.map((o) => ({ letter: o.letter, text: o.text })),
    correct_answer: item.correct_answer,
    sources: item.sources,
  }));

  const review = items.map((item, i) => ({
    number: i + 1,
    legal_topic_analysis: item.review.legal_topic_analysis,
    explanation: item.review.explanation,
    common_pitfall: item.review.common_pitfall,
    quick_thinking_360: item.review.quick_thinking_360,
    summary_for_memory: item.review.summary_for_memory,
    concepts_and_skills: item.review.concepts_and_skills,
    distractor_analysis: item.review.distractor_analysis,
  }));

  return {
    questions: {
      exam: {
        title: TITLE,
        part: "חלק ג' – דין מהותי",
        generated_at: new Date().toISOString(),
        question_count: questions.length,
      },
      generation: {
        model: MODEL,
        effort: EFFORT,
        seed: SEED,
        law_count: LAW_COUNT,
        batch_size: BATCH_SIZE,
        requested: QUESTION_COUNT,
      },
      validation: {
        quote_verified: questions.length,
        rejected: stats.rejected,
        rejection_reasons: stats.reasons,
      },
      questions,
    },
    question_review: { questions: review },
  };
}

async function insertNotebookRow(notebook) {
  const { data, error } = await supabase
    .from("mahoti_questions")
    .insert({ question_notebook: notebook })
    .select("question_id")
    .single();

  if (error) throw new Error(`failed to insert notebook row: ${error.message}`);
  return data.question_id;
}

async function loadRow(questionId) {
  const { data, error } = await supabase
    .from("mahoti_questions")
    .select("question_id, question_notebook, questions, question_review")
    .eq("question_id", questionId)
    .maybeSingle();

  if (error) throw new Error(`failed to read row ${questionId}: ${error.message}`);
  if (!data) throw new Error(`no mahoti_questions row with question_id ${questionId}`);
  return data;
}

/**
 * Rebuilds the in-memory item shape from a row's two payloads.
 *
 * The row is the resume point — questions live in one column and their
 * reviews in another, so picking a run back up means re-joining them by
 * `number`, the same key that split them. Anything whose review is missing
 * is still returned: a stored question is paid for and verified, and a thin
 * review is worth more than regenerating the question underneath it.
 */
function itemsFromRow(row) {
  const reviews = new Map(
    (row.question_review?.questions ?? []).map((entry) => [entry.number, entry])
  );
  return (row.questions?.questions ?? []).map((question) => {
    const review = reviews.get(question.number) ?? {};
    return {
      fact_pattern: question.fact_pattern ?? "",
      stem: question.stem ?? "",
      options: question.options ?? [],
      correct_answer: question.correct_answer,
      sources: question.sources ?? [],
      review: {
        legal_topic_analysis: review.legal_topic_analysis ?? "",
        explanation: review.explanation ?? "",
        common_pitfall: review.common_pitfall ?? "",
        quick_thinking_360: review.quick_thinking_360 ?? "",
        summary_for_memory: review.summary_for_memory ?? "",
        concepts_and_skills: review.concepts_and_skills ?? [],
        distractor_analysis: review.distractor_analysis ?? {},
      },
    };
  });
}

async function storePayloads(questionId, payloads) {
  const { error } = await supabase
    .from("mahoti_questions")
    .update({
      questions: payloads.questions,
      question_review: payloads.question_review,
    })
    .eq("question_id", questionId);

  if (error) throw new Error(`failed to store payloads: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function inspectCorpus() {
  const corpus = await fetchCorpus();
  const totalSections = corpus.reduce(
    (n, row) => n + (Array.isArray(row.sections_body) ? row.sections_body.length : 0),
    0
  );

  console.log(`mahoti_laws: ${corpus.length} laws, ${totalSections} sections total\n`);
  for (const row of corpus) {
    const count = Array.isArray(row.sections_body) ? row.sections_body.length : 0;
    console.log(`  ${String(row.law_id).padEnd(9)} ${String(count).padStart(4)} sections  ${row.law_name}`);
  }

  const sample = corpus.find((r) => Array.isArray(r.sections_body) && r.sections_body.length);
  if (sample) {
    const section = sample.sections_body[0];
    console.log(`\nShape of one section (from ${sample.law_name}):`);
    console.log(`  keys: ${Object.keys(section).join(", ")}`);
    console.log("\nAfter normalisation this script turns it into:");
    console.log(JSON.stringify(normaliseSection(section), null, 2).slice(0, 1200));
  }
}

// ---------------------------------------------------------------------------
// --estimate — what will this run cost?
// ---------------------------------------------------------------------------

/** Published per-million-token rates. Kept here rather than fetched so the
 *  estimate works offline; check the pricing page if a number looks stale. */
const PRICES = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15, note: "intro rate $2/$10 through 2026-08-31" },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const money = (n) => `$${n.toFixed(2)}`;

/**
 * Measures rather than guesses, on both sides:
 *
 *   input  — builds the real batch prompt and counts it with the API's own
 *            token counter, which is free and exact. Hebrew tokenises far
 *            worse than English, so a chars/4 rule of thumb would be wrong
 *            by a wide margin here.
 *   output — counts the questions + review of a set already in the table.
 *            Nothing predicts the size of this deliverable better than the
 *            same deliverable, already made.
 *
 * What stays an estimate is thinking. It is billed as output but never
 * returned, so it cannot be measured from a stored row — hence a range.
 */
async function estimateCost(notebook) {
  const listed = PRICES[MODEL];
  if (!listed) {
    throw new Error(
      `no published price on file for ${MODEL}. Known: ${Object.keys(PRICES).join(", ")}`
    );
  }

  // The Batch API is half price on both input and output. Applied to the rate
  // rather than to the total so every line below is the price this run will
  // actually pay — an estimate printed at list price for a run submitted at
  // half is a wrong number, not a conservative one.
  const price = BATCH_API
    ? { ...listed, input: listed.input / 2, output: listed.output / 2 }
    : listed;

  await loadAnthropic();

  // --- Input: the real prompt for a real batch ---------------------------
  const batches = Math.ceil(QUESTION_COUNT / BATCH_SIZE);
  const samples = [];
  for (const batchIndex of [0, 1, 2]) {
    const counted = await anthropic.messages.countTokens({
      model: MODEL,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(notebook, batchIndex, BATCH_SIZE, []),
        },
      ],
    });
    samples.push(counted.input_tokens);
  }
  const inputPerBatch = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const inputTotal = inputPerBatch * batches;

  // --- Output: measured from a finished set ------------------------------
  const { data: prior } = await supabase
    .from("mahoti_questions")
    .select("question_id, questions, question_review")
    .not("questions", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let perQuestionOut;
  let outputBasis;
  const priorCount = prior?.questions?.questions?.length ?? 0;

  if (priorCount) {
    const asText = JSON.stringify({
      questions: prior.questions.questions,
      review: prior.question_review?.questions ?? [],
    });
    const counted = await anthropic.messages.countTokens({
      model: MODEL,
      messages: [{ role: "user", content: asText }],
    });
    perQuestionOut = Math.round(counted.input_tokens / priorCount);
    outputBasis = `measured from row ${prior.question_id} (${priorCount} questions)`;
  } else {
    perQuestionOut = 1400;
    outputBasis = "no finished set in the table — using a 1,400-token placeholder";
  }

  const visibleOut = perQuestionOut * QUESTION_COUNT;

  // Adaptive thinking at effort=high on a task this constrained (quote
  // verbatim, four options, no repeats) reasons a good deal. Billed as
  // output, invisible in the response, so it is bracketed rather than stated.
  const thinkingRange = { low: 0.3, high: 1.0 };

  const line = (label, value) => console.log(`  ${label.padEnd(34)} ${value}`);

  console.log(`\nCost estimate — ${QUESTION_COUNT} questions, ${MODEL}, effort ${EFFORT}\n`);
  console.log(
    BATCH_API
      ? `TRANSPORT  Batch API — rates halved to $${price.input}/$${price.output} per M\n`
      : `TRANSPORT  live streamed calls at list price. --batch-api halves both rates.\n`
  );
  console.log("INPUT (measured with the API token counter)");
  line("tokens per batch call", inputPerBatch.toLocaleString());
  line(`batches (${QUESTION_COUNT} / --batch=${BATCH_SIZE})`, String(batches));
  line("input tokens total", inputTotal.toLocaleString());
  line("input cost", money((inputTotal / 1e6) * price.input));

  console.log("\nOUTPUT");
  line("tokens per question", perQuestionOut.toLocaleString());
  line("  basis", outputBasis);
  line("visible output tokens", visibleOut.toLocaleString());
  line(
    "thinking, billed as output",
    `${Math.round(visibleOut * thinkingRange.low).toLocaleString()}–` +
      `${Math.round(visibleOut * thinkingRange.high).toLocaleString()} (estimated)`
  );

  const outLow = visibleOut * (1 + thinkingRange.low);
  const outHigh = visibleOut * (1 + thinkingRange.high);
  const costLow = (inputTotal / 1e6) * price.input + (outLow / 1e6) * price.output;
  const costHigh = (inputTotal / 1e6) * price.input + (outHigh / 1e6) * price.output;

  console.log("\nTOTAL for one clean run (no rejected questions)");
  line("estimate", `${money(costLow)} – ${money(costHigh)}`);

  // Rejections cost a full batch and return nothing, so they scale the whole
  // per-run figure rather than adding to it.
  console.log("\nWith retries, since failed quote checks re-ask a whole batch");
  for (const overhead of [0.25, 0.5, 1.0]) {
    line(
      `+${Math.round(overhead * 100)}% batches`,
      `${money(costLow * (1 + overhead))} – ${money(costHigh * (1 + overhead))}`
    );
  }

  if (price.note) console.log(`\n  note: ${price.note}`);
  console.log(
    `\n  Rates used: $${price.input}/M input, $${price.output}/M output.` +
      `\n  No generation was run — the token counter is free.`
  );
}

async function main() {
  if (INSPECT) {
    await inspectCorpus();
    return;
  }

  // --- Steps 1 & 2 ---------------------------------------------------------
  let notebook;
  let questionId = SET_ID;
  let existingRow = null;

  if (SET_ID) {
    existingRow = await loadRow(SET_ID);
    notebook = existingRow.question_notebook;
    console.log(
      `Reusing notebook from row ${SET_ID}: ` +
        `${notebook.notebook.law_count} laws, ${notebook.notebook.section_count} sections`
    );
  } else {
    const corpus = await fetchCorpus();
    console.log(`Corpus: ${corpus.length} laws in mahoti_laws`);
    notebook = buildNotebook(corpus);
    console.log(
      `Notebook (seed ${SEED}): ${notebook.notebook.law_count} laws, ` +
        `${notebook.notebook.section_count} of ${notebook.notebook.sections_available} ` +
        `available sections, ~${notebook.notebook.estimated_a4_pages} A4 pages ` +
        `(budget ${MIN_PAGES}–${MAX_PAGES})`
    );

    if (ESTIMATE || DRY_RUN) {
      console.log(
        ESTIMATE ? "[estimate] not inserting the notebook row" : "[dry-run] not inserting the notebook row"
      );
    } else {
      questionId = await insertNotebookRow(notebook);
      console.log(`Inserted mahoti_questions row ${questionId} (questions still NULL)`);
    }
  }

  if (ESTIMATE) {
    await estimateCost(notebook);
    return;
  }

  if (NOTEBOOK_ONLY) {
    console.log("--notebook-only: stopping here.");
    return;
  }

  // --- Steps 3 & 4 ---------------------------------------------------------
  await loadAnthropic();
  const index = indexNotebook(notebook);

  const accepted = [];
  const reasons = [];
  let rejected = 0;
  let batchIndex = 0;

  // The row is the resume point: whatever it already holds was generated,
  // verified and paid for by an earlier run, so it is never made twice.
  if (existingRow?.questions?.questions?.length) {
    accepted.push(...itemsFromRow(existingRow));
    console.log(
      `Row already holds ${accepted.length} question${accepted.length === 1 ? "" : "s"} — ` +
        `generating the remaining ${Math.max(0, QUESTION_COUNT - accepted.length)}.`
    );
  }

  const maxBatches = Math.ceil(QUESTION_COUNT / BATCH_SIZE) * MAX_ATTEMPTS;
  let stoppedBy = null;
  let storedBatches = 0;
  const startedAt = Date.now();
  const elapsed = () => `${((Date.now() - startedAt) / 60000).toFixed(1)}m`;

  console.log(
    `\nGenerating with ${MODEL} (effort ${EFFORT}): ${BATCH_SIZE} questions per call, ` +
      `${CONCURRENCY} calls at a time.\n` +
      `A single call takes a few minutes; a wave finishes when its slowest call does.\n`
  );

  // Which sections already carry a question. Batches in the same wave cannot
  // see each other's output, so the "do not repeat" hint in the prompt is
  // advisory only — this is the rule that actually enforces it, after the
  // fact and across waves.
  const usedSections = new Set();
  const sectionKey = (source) => `${source.law_id}:${String(source.section_number).trim()}`;
  for (const item of accepted) {
    for (const source of item.sources) usedSections.add(sectionKey(source));
  }

  while (accepted.length < QUESTION_COUNT && batchIndex < maxBatches) {
    const remaining = QUESTION_COUNT - accepted.length;
    // Never open more calls than there is work for: at 3 questions left and a
    // batch size of 4, one call is the whole job.
    const waveSize = Math.max(
      1,
      Math.min(CONCURRENCY, Math.ceil(remaining / BATCH_SIZE), maxBatches - batchIndex)
    );
    const wave = [];
    for (let i = 0; i < waveSize; i++) wave.push(batchIndex++);

    const hints = [...usedSections].slice(-40).map((key) => {
      const [lawId, section] = key.split(":");
      return `${index.get(Number(lawId))?.law_name ?? lawId} סעיף ${section}`;
    });

    // Printed BEFORE the calls, not after: a model call is minutes long, and
    // a terminal that says nothing for that long is indistinguishable from
    // one that has hung.
    process.stdout.write(
      `  batches ${wave[0] + 1}-${wave[wave.length - 1] + 1} in parallel, ` +
        `${accepted.length}/${QUESTION_COUNT} done… [${elapsed()}] `
    );

    const waveStart = Date.now();
    // Both branches settle per batch rather than throwing for the wave, so one
    // failed call costs its own questions and not its neighbours'.
    //
    // The `.catch` is what keeps the two equivalent at the wave level: a
    // failure to submit or to poll is one throw for the whole wave, where the
    // streamed path would have produced N rejections. Mapping it back onto
    // per-slot rejections means a fatal error still reaches the `fatal` check
    // below and the run exits having saved what it already has, instead of
    // taking the accepted questions down with it.
    const settled = BATCH_API
      ? await requestWaveViaBatchApi(notebook, wave, BATCH_SIZE, hints).catch(
          (error) => wave.map(() => ({ status: "rejected", reason: error }))
        )
      : await Promise.allSettled(
          wave.map((i) => requestBatch(notebook, i, BATCH_SIZE, hints))
        );
    const took = ((Date.now() - waveStart) / 1000).toFixed(0);

    console.log(`done in ${took}s`);

    let fatal = null;

    // Results are folded in wave order, not completion order, so the same
    // seed and the same responses produce the same paper. Each batch is
    // verified and stored on its own, so one bad batch cannot cost a good one.
    for (let slot = 0; slot < settled.length; slot++) {
      const result = settled[slot];
      const batchNo = wave[slot] + 1;

      if (result.status === "rejected") {
        if (result.reason instanceof FatalApiError) fatal ??= result.reason.message;
        console.log(`      batch ${batchNo}: failed — ${result.reason?.message ?? result.reason}`);
        continue;
      }

      const keptItems = [];
      for (const item of result.value) {
        if (accepted.length + keptItems.length >= QUESTION_COUNT) break;

        const reason = rejectionReason(item, index);
        if (reason) {
          rejected++;
          reasons.push(reason);
          continue;
        }
        // Two questions on the same section is one question and a near-copy.
        if (item.sources.every((source) => usedSections.has(sectionKey(source)))) {
          rejected++;
          reasons.push("duplicate — every cited section already has a question");
          continue;
        }

        for (const source of item.sources) usedSections.add(sectionKey(source));
        keptItems.push(item);
      }

      if (!keptItems.length) {
        console.log(`      batch ${batchNo}: 0/${result.value.length} survived verification`);
        continue;
      }

      accepted.push(...keptItems);

      // Written the moment it is verified, not at the end of the run. The
      // full payload is rewritten each time rather than appended to, so the
      // write is idempotent — a retry cannot double-insert, and there is no
      // read-modify-write window to lose a batch in.
      if (DRY_RUN) {
        console.log(
          `      batch ${batchNo}: kept ${keptItems.length}/${result.value.length} ` +
            `[dry-run, not stored]`
        );
        continue;
      }

      try {
        await storePayloads(questionId, toPayloads(accepted, { rejected, reasons: summarise(reasons) }));
        storedBatches++;
        console.log(
          `      batch ${batchNo}: kept ${keptItems.length}/${result.value.length} — ` +
            `${storedBatches} batch${storedBatches === 1 ? "" : "es"} loaded successfully to DB ` +
            `(${accepted.length}/${QUESTION_COUNT} stored)`
        );
      } catch (error) {
        // The questions are still in memory and still correct; only the write
        // failed. Keep going — the next batch's write rewrites the whole
        // payload, so a transient failure here heals itself.
        console.error(`      batch ${batchNo}: STORE FAILED — ${error.message}`);
      }
    }

    // Retrying an out-of-credit or bad-key error only discovers the same
    // thing again, once per remaining batch. Stop and say so.
    if (fatal) {
      stoppedBy = fatal;
      break;
    }
  }

  if (stoppedBy) {
    console.error(`\nStopped: ${stoppedBy}`);
    if (accepted.length) {
      console.error(
        `${accepted.length} verified question(s) are already stored in row ${questionId} — ` +
          `fix the above and re-run the same command to continue from there.`
      );
    }
  } else if (accepted.length < QUESTION_COUNT) {
    console.warn(
      `\nStopping with ${accepted.length}/${QUESTION_COUNT} questions after ${batchIndex} batches. ` +
        `Raise --max-attempts, or widen the notebook with --laws.`
    );
  }

  if (!accepted.length) {
    throw new Error(
      stoppedBy
        ? "nothing was generated — see the reason above."
        : "no question survived quote verification — nothing to store."
    );
  }

  // --- Done ----------------------------------------------------------------
  console.log(
    `\nVerified ${accepted.length} questions, rejected ${rejected}.` +
      (rejected ? ` Reasons: ${JSON.stringify(summarise(reasons))}` : "")
  );

  if (DRY_RUN) {
    const payloads = toPayloads(accepted, { rejected, reasons: summarise(reasons) });
    console.log("\n[dry-run] would have stored:\n");
    console.log(JSON.stringify(payloads.questions.questions[0], null, 2));
    console.log(`\n… and ${accepted.length - 1} more, plus ${accepted.length} review entries.`);
    return;
  }

  // No final write: every batch stored itself as it landed, and the last one
  // wrote the whole payload. A store here would only repeat that.
  console.log(
    `${storedBatches} batch${storedBatches === 1 ? "" : "es"} loaded to ` +
      `mahoti_questions row ${questionId}.`
  );
  console.log(`Open it at: /mahoti?set=${questionId}`);
}

/** Rejection reasons collapse to a count per kind — forty lines of
 *  "quote not found" is one fact, not forty. */
function summarise(reasons) {
  const counts = {};
  for (const reason of reasons) {
    const kind = reason.replace(/ in .*$/, "").replace(/law_id \d+/, "law_id N");
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
