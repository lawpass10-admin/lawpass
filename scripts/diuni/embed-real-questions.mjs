// embed-real-questions.mjs — put real Bar questions into a generated דין דיוני
// paper, in place of generated ones.
//
//   node scripts/diuni/embed-real-questions.mjs --set=<question_id>            # dry run
//   node scripts/diuni/embed-real-questions.mjs --set=<id> --count=7 --commit
//   node scripts/diuni/embed-real-questions.mjs --set=<id> --pick=random --seed=42
//
// SAFE BY DEFAULT: without --commit this reports exactly which questions would
// leave the paper and which would replace them, and writes nothing.
//
// WHY REPLACE RATHER THAN ADD. The paper is 40 questions because the real one
// is. Adding seven would make it 47; replacing seven keeps the paper the size a
// candidate is training for, and every number stays where it was — question 12
// is still question 12, so a link to a sitting mid-exam does not shift under it.
//
// WHICH SEVEN LEAVE. `--pick=longest` (the default) retires the generated
// questions with the LONGEST fact patterns. Those are the ones that read least
// like the real paper — the generated median was near three times the real one —
// so the swap raises the paper twice: it adds seven genuine questions and drops
// the seven least genuine-looking ones. `--pick=random` instead draws by seed,
// for a paper whose lengths are already in range.
//
// THE REVIEW TRAVELS WITH THE QUESTION. A real question is only eligible once
// scripts/diuni/generate-real-reviews.mjs has written its 360° review; this
// refuses to draw one without it rather than leaving a question in the paper
// that explains nothing. Run this first as a dry run, feed the ids it prints to
// that script, then run it again with --commit.

import dotenv from "dotenv";
import pg from "pg";
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
const commit = argv.includes("--commit");
const setId = flagOf("set");
const count = Number(flagOf("count") ?? 7);
const pick = flagOf("pick") ?? "longest";
const seed = Number(flagOf("seed") ?? 1);

if (!setId) {
  console.error("--set=<question_id> is required (the diuni_questions row to edit)");
  process.exit(2);
}

/** mulberry32 — seeded, so the same --seed picks the same questions. */
function rng(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const paper = await client.query(
    `SELECT question_id, questions, question_review, generation_meta
       FROM public.diuni_questions WHERE question_id = $1`,
    [setId]
  );
  if (paper.rows.length === 0) throw new Error(`no diuni_questions row ${setId}`);

  const row = paper.rows[0];
  const questions = row.questions?.questions ?? [];
  const reviews = row.question_review?.questions ?? [];
  if (questions.length === 0) throw new Error("that paper has no questions");

  // Already-embedded real questions are left alone: re-running must not swap a
  // real question out for another real one, which would churn the paper and
  // waste the review already written for it.
  const isReal = (q) => (q.sources ?? [])[0]?.origin === "real_exam";
  const already = questions.filter(isReal);
  const generated = questions.filter((q) => !isReal(q));

  console.log(
    `paper ${setId}\n  ${questions.length} questions — ${generated.length} generated, ${already.length} already real`
  );

  const wanted = Math.max(0, count - already.length);
  if (wanted === 0) {
    console.log(`\nnothing to do — the paper already carries ${already.length} real question(s).`);
    process.exit(0);
  }

  // The outgoing ones.
  const random = rng(seed);
  const outgoing =
    pick === "random"
      ? shuffle(generated, random).slice(0, wanted)
      : [...generated]
          .sort((a, b) => String(b.fact_pattern ?? "").length - String(a.fact_pattern ?? "").length)
          .slice(0, wanted);

  // The incoming ones: reviewed real questions, spread across the sittings
  // rather than taken from one paper — a seeded shuffle over the whole pool
  // does that on its own.
  const pool = await client.query(
    `SELECT real_question_id, paper, number, fact_pattern, stem, options,
            correct_answer, source_citation, law_id, law_name, review
       FROM public.diuni_real_questions
      WHERE review IS NOT NULL
      ORDER BY paper, number`
  );

  // Never the same real question twice in one paper.
  const usedKeys = new Set(
    already.map((q) => `${(q.sources ?? [])[0]?.paper}#${(q.sources ?? [])[0]?.number}`)
  );
  const eligible = pool.rows.filter((r) => !usedKeys.has(`${r.paper}#${r.number}`));
  const incoming = shuffle(eligible, rng(seed)).slice(0, wanted);

  console.log(`\n  ${pool.rows.length} real question(s) in the pool carry a review`);

  if (incoming.length < wanted) {
    // The ids are printed so the review step can be pointed straight at them.
    const missing = await client.query(
      `SELECT real_question_id, paper, number FROM public.diuni_real_questions
        WHERE review IS NULL ORDER BY paper, number`
    );
    const need = shuffle(missing.rows, rng(seed)).slice(0, wanted - incoming.length);
    console.error(
      `\nonly ${incoming.length} of the ${wanted} needed real questions have a review.\n` +
        `Write the missing ones first:\n\n` +
        `  node scripts/diuni/generate-real-reviews.mjs --ids=${need
          .map((r) => r.real_question_id)
          .join(",")}\n\n` +
        `(${need.map((r) => `${r.paper} #${r.number}`).join(", ")})`
    );
    process.exit(1);
  }

  console.log("\n  out (longest generated fact patterns):");
  for (const q of outgoing) {
    console.log(`    #${String(q.number).padStart(2)}  ${String(q.fact_pattern).length} chars  ${String(q.stem).slice(0, 40)}`);
  }
  console.log("\n  in (real questions):");
  for (const r of incoming) {
    console.log(`    ${r.paper} #${String(r.number).padStart(3)}  ${r.fact_pattern.length} chars  ${r.stem.slice(0, 40)}`);
  }

  // Swap in place, keeping each question's NUMBER: the review payload aligns to
  // `questions` by number, so a renumbering here would attach every review to
  // the wrong question rather than fail.
  const outByNumber = new Map(outgoing.map((q, i) => [q.number, incoming[i]]));

  const nextQuestions = questions.map((q) => {
    const real = outByNumber.get(q.number);
    if (!real) return q;
    return {
      number: q.number,
      fact_pattern: real.fact_pattern,
      stem: real.stem,
      options: real.options,
      correct_answer: real.correct_answer,
      // Provenance in the same `sources` shape the generated questions use, so
      // one reader handles both.
      //
      // `kind: "law"` with a law_id is what the dashboard's topic charts read
      // (lawpass_server/db/legal-areas.js) — the paper cites its authority as
      // prose, so the id comes from diuni_real_questions.law_id, mapped once per
      // question. A question with no id stays "real_exam" and reports as
      // ללא סיווג, which is honest: nothing has classified it yet.
      //
      // `origin` rather than `kind` marks it as embedded, so the marker survives
      // whichever kind the source turns out to be — that is what a later run
      // reads to leave an already-embedded question alone.
      sources: [
        real.law_id
          ? {
              kind: "law",
              law_id: real.law_id,
              law_name: real.law_name,
              origin: "real_exam",
              paper: real.paper,
              number: real.number,
              citation: real.source_citation,
            }
          : {
              kind: "real_exam",
              origin: "real_exam",
              paper: real.paper,
              number: real.number,
              citation: real.source_citation,
            },
      ],
    };
  });

  const nextReviews = reviews.map((review) => {
    const real = outByNumber.get(review.number);
    if (!real) return review;
    const r = real.review;
    return {
      number: review.number,
      legal_topic_analysis: r.legal_topic_analysis,
      explanation: r.explanation,
      common_pitfall: r.common_pitfall,
      quick_thinking_360: r.quick_thinking_360,
      summary_for_memory: r.summary_for_memory,
      concepts_and_skills: r.concepts_and_skills,
      distractor_analysis: r.distractor_analysis,
    };
  });

  // Every question keeps a review and every review a question, aligned by
  // number. Checked rather than assumed: a mismatch here is invisible on screen
  // — the panel renders empty sections — and this is the one moment it can be
  // caught.
  const numbers = new Set(nextQuestions.map((q) => q.number));
  for (const review of nextReviews) {
    if (!numbers.has(review.number)) throw new Error(`review ${review.number} has no question`);
  }
  for (const q of nextQuestions) {
    if (!nextReviews.some((r) => r.number === q.number)) {
      throw new Error(`question ${q.number} has no review`);
    }
    if (!String(q.fact_pattern ?? "").trim()) throw new Error(`question ${q.number} lost its text`);
    if ((q.options ?? []).length !== 4) throw new Error(`question ${q.number} has ${q.options?.length} options`);
  }

  const meta = {
    ...(row.generation_meta ?? {}),
    real_questions_embedded: [
      ...((row.generation_meta ?? {}).real_questions_embedded ?? []),
      {
        at: new Date().toISOString(),
        pick,
        seed,
        swapped: outgoing.map((q, i) => ({
          number: q.number,
          replaced_generated_chars: String(q.fact_pattern).length,
          real_paper: incoming[i].paper,
          real_number: incoming[i].number,
          real_question_id: incoming[i].real_question_id,
        })),
      },
    ],
  };

  if (!commit) {
    console.log("\ndry run — nothing written. Pass --commit to apply.");
    process.exit(0);
  }

  await client.query(
    `UPDATE public.diuni_questions
        SET questions = jsonb_set($1::jsonb, '{questions}', $2::jsonb),
            question_review = jsonb_set($3::jsonb, '{questions}', $4::jsonb),
            generation_meta = $5::jsonb
      WHERE question_id = $6`,
    [
      JSON.stringify(row.questions),
      JSON.stringify(nextQuestions),
      JSON.stringify(row.question_review),
      JSON.stringify(nextReviews),
      JSON.stringify(meta),
      setId,
    ]
  );

  console.log(`\nCOMMITTED — ${wanted} real question(s) embedded in ${setId}.`);
} finally {
  await client.end();
}
