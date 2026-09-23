// generate-real-reviews.mjs — write the 360° review for the REAL questions in
// public.diuni_real_questions, so a generated paper can put one in front of a
// candidate and still explain it.
//
//   node scripts/diuni/generate-real-reviews.mjs --dry-run   # show one prompt, call nothing
//   node scripts/diuni/generate-real-reviews.mjs --limit=5
//   node scripts/diuni/generate-real-reviews.mjs             # every question still missing one
//   node scripts/diuni/generate-real-reviews.mjs --redo      # rewrite reviews that exist
//
// WHY THIS EXISTS. The question itself is the Bar's, and is never rewritten —
// its fact pattern, its four options and its answer letter are reproduced exactly
// as the paper set them. What the paper does NOT publish is the teaching around
// it: why the answer is right, why each distractor is wrong, the trap, the
// variations. Those are what the review screen shows after every other question,
// and a real question without them would be the one question in the paper that
// explains nothing.
//
// THE ANSWER IS GIVEN, NOT ASKED FOR. The model is told which letter is correct
// and writes the explanation for it. It is not invited to decide — a model that
// disagreed with the Bar's own answer key would produce a review arguing against
// the question it accompanies.
//
// ONE CALL PER QUESTION, WRITTEN ONCE. The result is stored on the row and
// reused by every paper that draws it, so the 106 questions cost 106 calls in
// total rather than once per exam.
//
// Same review shape as a generated question (see generate-diuni-set.mjs), so
// load-diuni-questions.mjs and the practice panel treat the two identically.

import dotenv from "dotenv";
import pg from "pg";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

const argv = process.argv.slice(2);
const flagOf = (n) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : null;
};
const dryRun = argv.includes("--dry-run");
const redo = argv.includes("--redo");
const limit = Number(flagOf("limit") ?? 0);
// `--ids=uuid,uuid` — write reviews for exactly these questions. What
// embed-real-questions.mjs prints when it has chosen which ones a paper will
// draw: the whole pool takes hours, and a paper needs seven of them.
const only = (flagOf("ids") ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const params = JSON.parse(readFileSync(join(here, "diuni-LLM-Params.json"), "utf8"));
const MODEL = flagOf("model") ?? params.model.id;
const EFFORT = flagOf("effort") ?? params.model.effort;

const LETTERS = ["א", "ב", "ג", "ד"];
const VARIATIONS = params.structure.variations_360 ?? 4;

// The review half of the generated-question schema, field for field. Kept in
// step with QuestionSchema in generate-diuni-set.mjs: the two feed the same
// loader and the same panel, so a field that exists in one and not the other
// shows up as an empty section on screen with no error anywhere.
const Variation = z.object({
  title: z.string().min(2).max(60),
  question: z.string().min(8),
  answer: z.string().min(4),
});

const ReviewSchema = z.object({
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
});

/** The exact string the practice panel parses. Same format as the generator. */
function serialise360(variations) {
  return variations
    .map((v, i) => `**וריאציה ${i + 1} — ${v.title}:** ${v.question} ← ${v.answer}`)
    .join("\n");
}

const SYSTEM_PROMPT = `אתה כותב חומר לימוד לבחינת ההסמכה של לשכת עורכי הדין בישראל, לחלק ב' — דין דיוני.

לפניך שאלה אמיתית מתוך בחינה שכבר נערכה, בדיוק כפי שנוסחה על ידי מחברי הבחינה, והתשובה הנכונה שנקבעה על ידם.

חוקי ברזל:
1. התשובה הנכונה נתונה ואינה נתונה לוויכוח. כתוב את ההסבר לכך שהיא הנכונה. אם לדעתך תשובה אחרת עדיפה — אינך רשאי לומר זאת; נסח את ההסבר לפי מפתח התשובות של הבחינה.
2. אין לשנות, לתקן או לנסח מחדש את השאלה, את עובדותיה או את החלופות. אתה כותב רק את חומר הבדיקה שסביבה.
3. distractor_analysis חייב לכלול את כל ארבע האותיות א, ב, ג, ד — כולל האות הנכונה, שבה תסביר מדוע היא הנכונה. לכל אות שגויה הסבר מדוע היא שגויה, ובמה בדיוק היא מכשילה.
4. הסתמך על הדין הדיוני הישראלי כפי שהוא, וציין את מקורות הדין (חוק, תקנה, כלל או פסיקה) ב-references_list. אם בשאלה צוין מקור — התייחס אליו.
5. כתוב בעברית משפטית מדויקת, באותו משלב שבו כתובה הבחינה עצמה.
6. quick_thinking_360: ${VARIATIONS} וריאציות קצרות — שינוי אחד בעובדות ומה הוא משנה בתוצאה.
7. אורכים מזעריים, והם נאכפים: full_explanation לפחות 200 תווים; legal_topic_analysis לפחות 80; summary_for_memory לפחות 40; וכל אחד מארבעת ההסברים ב-distractor_analysis לפחות 20 תווים. שאלה שהתשובה בה פשוטה אינה עילה לקצר — הסבר מדוע החלופה מפתה ומה בדיוק שגוי בה. תשובה שאינה עומדת באורכים נדחית במלואה ונכתבת מחדש.`;

function buildUserPrompt(row) {
  const options = row.options
    .map((o) => `${o.letter}. ${o.text}`)
    .join("\n");

  return [
    `שאלה אמיתית מתוך הבחינה מיום ${row.paper} (שאלה ${row.number} באותה בחינה).`,
    "",
    "עובדות:",
    row.fact_pattern,
    "",
    "השאלה:",
    row.stem,
    "",
    "החלופות:",
    options,
    "",
    `התשובה הנכונה על פי מפתח התשובות של הבחינה: ${row.correct_answer}`,
    row.source_citation ? `המקור שצוין בבחינה: ${row.source_citation}` : "",
    "",
    "כתוב את חומר הבדיקה המלא לשאלה הזו.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const where = [];
if (!redo) where.push("review IS NULL");
if (only.length > 0) where.push(`real_question_id = ANY($1::uuid[])`);

const { rows } = await client.query(
  `SELECT real_question_id, paper, number, fact_pattern, stem, options,
          correct_answer, source_citation
     FROM public.diuni_real_questions
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY paper, number
    ${limit > 0 ? `LIMIT ${limit}` : ""}`,
  only.length > 0 ? [only] : []
);

console.log(
  `${rows.length} question(s) to write a review for` +
    (redo ? " (--redo: existing reviews will be overwritten)" : "")
);

if (rows.length === 0) {
  await client.end();
  console.log("nothing to do — every real question already carries a review.");
  process.exit(0);
}

if (dryRun) {
  console.log(`\nmodel ${MODEL} · effort ${EFFORT}\n`);
  console.log("--- system ---");
  console.log(SYSTEM_PROMPT);
  console.log("\n--- user (first question) ---");
  console.log(buildUserPrompt(rows[0]));
  console.log("\ndry run: nothing was sent, nothing was written");
  await client.end();
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
const anthropic = new Anthropic({ apiKey, maxRetries: 3, timeout: 15 * 60 * 1000 });

let written = 0;
let failed = 0;

for (const [i, row] of rows.entries()) {
  const label = `[${i + 1}/${rows.length}] ${row.paper} #${row.number}`;
  const started = Date.now();

  let message;
  try {
    message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: params.model.max_tokens,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT, format: helpers.zodOutputFormat(ReviewSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(row) }],
    });
  } catch (error) {
    failed++;
    console.log(`${label} FAILED — ${error.message}`);
    continue;
  }

  if (message.stop_reason === "refusal") {
    failed++;
    console.log(`${label} refused (${message.stop_details?.category ?? "unknown"})`);
    continue;
  }
  if (message.stop_reason === "max_tokens") {
    failed++;
    console.log(`${label} hit max_tokens — raise model.max_tokens in diuni-LLM-Params.json`);
    continue;
  }

  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  let parsed;
  try {
    parsed = ReviewSchema.safeParse(JSON.parse(text));
  } catch (error) {
    failed++;
    console.log(`${label} response was not JSON — ${error.message}`);
    continue;
  }
  if (!parsed.success) {
    failed++;
    const issue = parsed.error.issues[0];
    console.log(`${label} schema rejected — ${issue.message} at ${issue.path.join(".")}`);
    continue;
  }

  const r = parsed.data;
  // Stored in the loader's spelling — `explanation`, not `full_explanation` —
  // so a drawn question needs no translation on its way into a paper. Both
  // forms of the 360 travel, as the generator does it: the structured items for
  // a human to read, and the string the panel parses.
  const review = {
    legal_topic_analysis: r.legal_topic_analysis,
    explanation: r.full_explanation,
    common_pitfall: r.common_pitfall,
    quick_thinking_360_items: r.quick_thinking_360,
    quick_thinking_360: serialise360(r.quick_thinking_360),
    summary_for_memory: r.summary_for_memory,
    concepts_and_skills: r.concepts_and_skills,
    distractor_analysis: r.distractor_analysis,
    references_list: r.references_list,
    generated: {
      model: MODEL,
      effort: EFFORT,
      at: new Date().toISOString(),
      usage: message.usage,
    },
  };

  await client.query(
    `UPDATE public.diuni_real_questions SET review = $1::jsonb WHERE real_question_id = $2`,
    [JSON.stringify(review), row.real_question_id]
  );

  written++;
  const secs = Math.round((Date.now() - started) / 100) / 10;
  console.log(`${label} ok in ${secs}s`);
}

const total = await client.query(
  `SELECT count(*)::int all_rows,
          count(*) FILTER (WHERE review IS NOT NULL)::int reviewed
     FROM public.diuni_real_questions`
);
await client.end();

console.log(
  `\n${written} written, ${failed} failed — ` +
    `${total.rows[0].reviewed}/${total.rows[0].all_rows} real questions now carry a review.`
);
process.exit(failed > 0 ? 1 : 0);
