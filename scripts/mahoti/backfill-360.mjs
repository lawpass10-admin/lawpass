// backfill-360.mjs — give existing מהותי questions the 4-card חשיבה 360°
// that /diuni has and that generate-mahoti-set.mjs now produces.
//
//   node scripts/mahoti/backfill-360.mjs                    # plan + cost, spends nothing
//   node scripts/mahoti/backfill-360.mjs --go               # rewrite the newest paper
//   node scripts/mahoti/backfill-360.mjs --set-id=<uuid> --go
//   node scripts/mahoti/backfill-360.mjs --go --batch-api   # half price
//
// WHY THIS EXISTS RATHER THAN "JUST REGENERATE THE PAPER". The questions in the
// row are already written, already quote-verified against the notebook, and
// already paid for. Only one field of their review is in the wrong shape. A
// full regeneration would throw away 40 good questions to fix a formatting
// difference, cost about six times as much, and hand the candidate a different
// paper than the one they have been sitting.
//
// So this rewrites ONE FIELD, in place: `question_review.questions[].
// quick_thinking_360`, from a paragraph of prose to the four Q&A cards
// `<Learning360Panel>` renders. Nothing else in the row is touched — not the
// questions, not the notebook, not the other review sections.
//
// SAFE BY DEFAULT: without --go it prints what it would rewrite and what that
// would cost, and calls nothing.
//
// ALREADY-CONVERTED QUESTIONS ARE SKIPPED. A question whose 360 already carries
// the `**וריאציה N — …:**` markers is left alone, so the script is safe to
// re-run and a partial run can be finished by running it again.

import dotenv from "dotenv";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const GO = argv.includes("--go");
const BATCH_API = argv.includes("--batch-api");
const SET_ID = flag("set-id") ?? null;
const MODEL = flag("model") ?? "claude-opus-5";
const EFFORT = flag("effort") ?? "medium";

/** Four cards, matching /diuni and the generator's own VARIATIONS_360. */
const VARIATIONS_360 = 4;

/** A 360 that already carries the panel's markers needs no work. */
const ALREADY_CONVERTED = /\*\*וריאציה\s*\d+/;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(2);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// --------------------------------------------------------------- schema

const Variation = z.object({
  title: z.string().min(2).max(60),
  question: z.string().min(8),
  answer: z.string().min(4),
});
const ReplySchema = z.object({
  quick_thinking_360: z.array(Variation).length(VARIATIONS_360),
});

/** The exact string `<Learning360Panel>` parses into cards. */
function serialise360(variations) {
  return variations
    .map((v, i) => `**וריאציה ${i + 1} — ${v.title}:** ${v.question} ← ${v.answer}`)
    .join("\n");
}

const SYSTEM_PROMPT = `אתה עורך תוכן לבחינת ההסמכה בלשכת עורכי הדין בישראל, לחלק ג' — דין מהותי.

מוצגת לך שאלת רב-ברירה קיימת, התשובה הנכונה שלה, וההסבר המשפטי שלה. משימתך אחת בלבד: לכתוב ${VARIATIONS_360} וריאציות "חשיבה 360°".

כללים:
1. בדיוק ${VARIATIONS_360} וריאציות. כל אחת שאלה קצרה ותשובה קצרה.
2. כל וריאציה בודקת את אותו כלל משפטי מזווית אחרת: שינוי בתנאי מתנאי הסעיף, החלפה בזהות הצד, מה היה הדין אילו התנאי לא היה מתקיים, או גבול התחולה של הסעיף.
3. אל תחזור על ניסוח השאלה המקורית ואל תשנה את הדין. הוריאציות נשענות על אותו סעיף חוק שהשאלה נשענת עליו.
4. עברית משפטית תקנית, קצרה. השאלה עד כשני משפטים, התשובה עד כשני משפטים.
5. title הוא תווית קצרה לזווית (למשל "שינוי בזהות הצד"), לא משפט.`;

function buildUserPrompt(q, review) {
  const sources = (q.sources ?? [])
    .map((s) => `${s.law_name}, סעיף ${s.section_number}: "${s.source_quote}"`)
    .join("\n");

  return `השאלה:
${q.fact_pattern}

${q.stem}

האפשרויות:
${(q.options ?? []).map((o) => `${o.letter}. ${o.text}`).join("\n")}

התשובה הנכונה: ${q.correct_answer}

המקור:
${sources}

ההסבר המשפטי:
${review?.explanation ?? ""}

כתוב ${VARIATIONS_360} וריאציות חשיבה 360° לשאלה הזו.`;
}

// ----------------------------------------------------------------- read

async function loadRow(setId) {
  const query = supabase
    .from("mahoti_questions")
    .select("question_id, questions, question_review, created_at")
    .not("questions", "is", null);

  const { data, error } = setId
    ? await query.eq("question_id", setId).maybeSingle()
    : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (error) throw new Error(`failed to read the paper: ${error.message}`);
  if (!data) throw new Error(setId ? `no row ${setId}` : "no mahoti paper with questions yet");
  return data;
}

const row = await loadRow(SET_ID);
const questions = row.questions?.questions ?? [];
const reviews = row.question_review?.questions ?? [];
const reviewByNumber = new Map(reviews.map((r) => [r.number, r]));

const todo = [];
const skipped = [];
for (const q of questions) {
  const review = reviewByNumber.get(q.number);
  if (!review) continue; // no review to patch
  if (ALREADY_CONVERTED.test(String(review.quick_thinking_360 ?? ""))) {
    skipped.push(q.number);
    continue;
  }
  todo.push({ q, review });
}

// ----------------------------------------------------------------- plan

// Measured shape of this call: a short reply (4 short Q&A pairs) over a prompt
// carrying one question, its options, its source quote and its explanation.
const PER_QUESTION = { input: 1_600, output: 700 };
const RATES = BATCH_API ? { input: 2.5, output: 12.5 } : { input: 5, output: 25 };
const cost =
  (todo.length * PER_QUESTION.input * RATES.input) / 1e6 +
  (todo.length * PER_QUESTION.output * RATES.output) / 1e6;

console.log(`paper            : ${row.question_id}`);
console.log(`questions        : ${questions.length}`);
console.log(`already 4-card   : ${skipped.length}${skipped.length ? ` (${skipped.slice(0, 8).join(", ")}${skipped.length > 8 ? "…" : ""})` : ""}`);
console.log(`to convert       : ${todo.length}`);
console.log(`model            : ${MODEL} (effort ${EFFORT})`);
console.log(`transport        : ${BATCH_API ? "Batch API — half price, returns all at once" : "live calls (--batch-api halves it)"}`);
console.log(`EST. COST        : $${cost.toFixed(2)}`);
console.log("");

if (todo.length === 0) {
  console.log("Nothing to do — every question already has the 4-card format.");
  process.exit(0);
}

if (!GO) {
  console.log("DRY RUN — nothing generated, nothing written, nothing billed.");
  console.log("Pass --go to run it.");
  process.exit(0);
}

if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(2);
}

// ------------------------------------------------------------------ run

const [{ default: Anthropic }, helpers] = await Promise.all([
  import("@anthropic-ai/sdk"),
  import("@anthropic-ai/sdk/helpers/zod"),
]);
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  maxRetries: 2,
  timeout: 10 * 60 * 1000,
});

const paramsFor = (entry) => ({
  model: MODEL,
  max_tokens: 4000,
  output_config: {
    effort: EFFORT,
    format: helpers.zodOutputFormat(ReplySchema),
  },
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: buildUserPrompt(entry.q, entry.review) }],
});

function parseReply(message) {
  if (message.stop_reason === "refusal") throw new Error("the model declined this question");
  if (message.stop_reason === "max_tokens") throw new Error("hit max_tokens");
  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = ReplySchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "schema mismatch");
  return parsed.data.quick_thinking_360;
}

/** number -> the four variations, for everything that succeeded. */
const converted = new Map();

if (BATCH_API) {
  console.log(`submitting ${todo.length} questions as one batch job…`);
  const batch = await anthropic.messages.batches.create({
    requests: todo.map((entry) => ({
      custom_id: `q${entry.q.number}`,
      params: paramsFor(entry),
    })),
  });
  console.log(`batch ${batch.id} accepted — polling every 30s.`);

  let status = batch;
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 30_000));
    status = await anthropic.messages.batches.retrieve(batch.id);
    const c = status.request_counts ?? {};
    process.stdout.write(
      `\r  ${status.processing_status}: ${c.succeeded ?? 0} done, ${c.errored ?? 0} errored   `
    );
  }
  process.stdout.write("\n");

  for await (const entry of await anthropic.messages.batches.results(batch.id)) {
    const number = Number(String(entry.custom_id).replace("q", ""));
    if (entry.result.type !== "succeeded") {
      console.log(`  Q${number}: ${entry.result.type}`);
      continue;
    }
    try {
      converted.set(number, parseReply(entry.result.message));
    } catch (error) {
      console.log(`  Q${number}: ${error.message}`);
    }
  }
} else {
  for (const entry of todo) {
    process.stdout.write(`  Q${entry.q.number}… `);
    try {
      const message = await anthropic.messages.create(paramsFor(entry));
      converted.set(entry.q.number, parseReply(message));
      console.log("ok");
    } catch (error) {
      console.log(`FAILED — ${error?.message ?? error}`);
    }
  }
}

if (converted.size === 0) {
  console.error("\nnothing was converted — the row is untouched.");
  process.exit(1);
}

// ---------------------------------------------------------------- write
//
// The whole review array is rewritten in one update, because the column is a
// single jsonb document. Only the 360 field of the converted entries changes;
// everything else is carried through byte for byte.

const nextReviews = reviews.map((r) => {
  const variations = converted.get(r.number);
  if (!variations) return r;
  return {
    ...r,
    quick_thinking_360_items: variations,
    quick_thinking_360: serialise360(variations),
  };
});

// A copy of what the column held, before anything is written. This script edits
// content a human reviewed; being able to put it back without a database
// restore is worth one small file.
const backupDir = join(here, "backups");
mkdirSync(backupDir, { recursive: true });
const backupPath = join(backupDir, `${row.question_id}-question_review-${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(row.question_review, null, 2) + "\n", "utf8");
console.log(`\nprevious question_review saved to ${backupPath}`);

const { error } = await supabase
  .from("mahoti_questions")
  .update({ question_review: { ...row.question_review, questions: nextReviews } })
  .eq("question_id", row.question_id);

if (error) {
  console.error(`\nfailed to write: ${error.message}`);
  console.error(`the row is unchanged; the backup at ${backupPath} is still valid.`);
  process.exit(1);
}

console.log(`converted ${converted.size}/${todo.length} question(s) on paper ${row.question_id}.`);
if (converted.size < todo.length) {
  console.log("Re-run to retry the ones that failed — converted questions are skipped.");
}
