// swap-generated-questions.mjs — replace the GENERATED questions of an existing
// דין דיוני paper with fresh drafts, leaving everything else where it is.
//
//   node scripts/diuni/swap-generated-questions.mjs --set=<question_id>              # dry run
//   node scripts/diuni/swap-generated-questions.mjs --set=<id> --commit
//   node scripts/diuni/swap-generated-questions.mjs --set=<id> --drafts=generated/v2
//
// SAFE BY DEFAULT: without --commit this validates everything, prints the
// before/after of every question it would touch, and writes nothing.
//
// WHY THIS EXISTS ALONGSIDE load-diuni-questions.mjs. The loader builds a paper
// FROM a folder: N drafts in, an N-question row out. That is the right tool
// until a paper has something in it the folder does not hold. This one does —
// seven real Bar questions were embedded into it by embed-real-questions.mjs,
// and they live only on the row. Re-running the loader over 33 new drafts would
// produce a 33-question paper and take the real seven with it.
//
// So the operation is a SWAP, not a rebuild: the paper keeps its size, its
// numbering and its real questions, and only the generated ones are exchanged.
// Question 12 is still question 12 afterwards, which matters because a sitting
// already in progress addresses questions by number.
//
// WHICH QUESTIONS ARE GENERATED. The ones whose `sources[0].origin` is not
// "real_exam" — the same marker embed-real-questions.mjs writes and reads, so
// the two scripts cannot disagree about which questions belong to which half.
//
// DRAFTS ARE MATCHED BY ORDER, NOT BY SOURCE. The new drafts are written from
// fresh material, so there is no correspondence between the question that
// leaves and the one that arrives; ascending question number takes the drafts
// in filename order, exactly as the loader numbers them. The count must match
// the number of generated questions in the paper — a short folder would leave
// the paper half old and half new with nothing recording which was which.

import dotenv from "dotenv";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
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
const draftsArg = flagOf("drafts") ?? "generated";

if (!setId) {
  console.error("--set=<question_id> is required (the diuni_questions row to edit)");
  process.exit(2);
}

const draftsDir = isAbsolute(draftsArg) ? draftsArg : join(here, draftsArg);

// Same collection rule as the loader: top-level .json, filename order.
const files = readdirSync(draftsDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`no drafts in ${draftsDir}`);
  process.exit(1);
}

const drafts = files.map((f) => ({
  file: f,
  data: JSON.parse(readFileSync(join(draftsDir, f), "utf8")),
}));

const LETTERS = ["א", "ב", "ג", "ד"];

/** The candidate-facing question, in the loader's shape. See its header note. */
function questionFrom(draft, number) {
  const q = draft.data.question;
  const from = draft.data.generated_from;
  return {
    number,
    fact_pattern: q.fact_pattern,
    stem: q.stem,
    options: q.options,
    correct_answer: q.correct_answer,
    sources: (draft.data.grounding_quotes ?? []).map((g) =>
      from.grounding_kind === "law"
        ? {
            kind: "law",
            law_id: from.law_id,
            law_name: from.law_name,
            section_number: from.section_number,
            role: g.role,
            quote: g.quote,
          }
        : {
            kind: "verdict",
            verdict_id: from.verdict_id,
            case_number: from.case_number,
            role: g.role,
            quote: g.quote,
          }
    ),
  };
}

/** The review payload — `explanation`, mahoti's spelling, not `full_explanation`. */
function reviewFrom(draft, number) {
  const r = draft.data.review;
  return {
    number,
    legal_topic_analysis: r.legal_topic_analysis,
    explanation: r.full_explanation,
    common_pitfall: r.common_pitfall,
    quick_thinking_360: r.quick_thinking_360,
    summary_for_memory: r.summary_for_memory,
    concepts_and_skills: r.concepts_and_skills,
    distractor_analysis: r.distractor_analysis,
  };
}

function metaFrom(draft, number) {
  const from = draft.data.generated_from;
  return {
    number,
    file: draft.file,
    grounding_kind: from.grounding_kind ?? "verdict",
    case_number: from.case_number ?? null,
    judgment_area_id: from.judgment_area_id ?? null,
    law_id: from.law_id ?? null,
    section_number: from.section_number ?? null,
    model: from.model,
    effort: from.effort,
    prompt_version: from.prompt_version,
    answer_placement: from.answer_placement ?? null,
    usage: from.usage ?? null,
  };
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("set DIRECT_URL or DATABASE_URL (they live in .env.local)");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const paper = await client.query(
    `SELECT question_id, verdict_ids, questions, question_review, generation_meta
       FROM public.diuni_questions WHERE question_id = $1`,
    [setId]
  );
  if (paper.rows.length === 0) throw new Error(`no diuni_questions row ${setId}`);

  const row = paper.rows[0];
  const questions = row.questions?.questions ?? [];
  const reviews = row.question_review?.questions ?? [];
  if (questions.length === 0) throw new Error("that paper has no questions");

  const isReal = (q) => (q.sources ?? [])[0]?.origin === "real_exam";
  const generatedNumbers = questions.filter((q) => !isReal(q)).map((q) => q.number).sort((a, b) => a - b);
  const realNumbers = questions.filter(isReal).map((q) => q.number);

  console.log(`paper ${setId}`);
  console.log(`  ${questions.length} questions — ${generatedNumbers.length} generated, ${realNumbers.length} real`);
  console.log(`  real questions stay at: ${realNumbers.sort((a, b) => a - b).join(", ")}`);
  console.log(`  drafts: ${files.length} in ${draftsDir}`);

  if (files.length !== generatedNumbers.length) {
    throw new Error(
      `${files.length} draft(s) for ${generatedNumbers.length} generated question(s) — ` +
        `the counts must match, or the paper ends up part old and part new`
    );
  }

  // number -> draft, ascending number against filename order.
  const assigned = new Map(generatedNumbers.map((n, i) => [n, drafts[i]]));

  const nextQuestions = questions.map((q) => {
    const draft = assigned.get(q.number);
    return draft ? questionFrom(draft, q.number) : q;
  });
  const nextReviews = reviews.map((review) => {
    const draft = assigned.get(review.number);
    return draft ? reviewFrom(draft, review.number) : review;
  });

  // ------------------------------------------------------------- validate
  //
  // Every one of these fails QUIETLY on screen — an empty review heading, a
  // question with no correct choice — so it is checked here, before the write.
  const problems = [];

  for (const q of nextQuestions) {
    const letters = (q.options ?? []).map((o) => o.letter);
    if (letters.join("") !== LETTERS.join("")) {
      problems.push(`Q${q.number}: options are ${letters.join("")}, expected ${LETTERS.join("")}`);
    }
    if (!letters.includes(q.correct_answer)) {
      problems.push(`Q${q.number}: correct_answer ${q.correct_answer} names no option`);
    }
    if (!String(q.fact_pattern ?? "").trim() || !String(q.stem ?? "").trim()) {
      problems.push(`Q${q.number}: empty fact_pattern or stem`);
    }
    if (!nextReviews.some((r) => r.number === q.number)) {
      problems.push(`Q${q.number}: has no review`);
    }
  }

  const numbers = new Set(nextQuestions.map((q) => q.number));
  for (const r of nextReviews) {
    if (!numbers.has(r.number)) problems.push(`review ${r.number} has no question`);
    for (const field of [
      "legal_topic_analysis",
      "explanation",
      "common_pitfall",
      "quick_thinking_360",
      "summary_for_memory",
    ]) {
      if (!r[field] || !String(r[field]).trim()) problems.push(`Q${r.number}: review.${field} is empty`);
    }
    if (!Array.isArray(r.concepts_and_skills) || r.concepts_and_skills.length === 0) {
      problems.push(`Q${r.number}: review.concepts_and_skills is empty`);
    }
    for (const l of LETTERS) {
      if (!r.distractor_analysis?.[l]) problems.push(`Q${r.number}: no distractor_analysis for ${l}`);
    }
    // The panel's own parser, so a row that would render as one unparsed blob
    // is caught here rather than on screen.
    const cards = String(r.quick_thinking_360).split(/\*\*וריאציה\s*\d+[\s\S]*?\*\*/).slice(1);
    if (cards.length === 0) {
      problems.push(`Q${r.number}: quick_thinking_360 has no **וריאציה N — …:** markers`);
    }
  }

  // ------------------------------------------------------------- report
  const chars = (t) => String(t ?? "").length;
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
  };

  console.log("\n  swapped (old chars → new chars):");
  for (const n of generatedNumbers) {
    const before = questions.find((q) => q.number === n);
    const after = nextQuestions.find((q) => q.number === n);
    console.log(
      `    #${String(n).padStart(2)}  ${String(chars(before.fact_pattern)).padStart(4)} → ` +
        `${String(chars(after.fact_pattern)).padStart(4)}  ${assigned.get(n).file}`
    );
  }

  const oldLens = generatedNumbers.map((n) => chars(questions.find((q) => q.number === n).fact_pattern));
  const newLens = generatedNumbers.map((n) => chars(nextQuestions.find((q) => q.number === n).fact_pattern));
  const realLens = realNumbers.map((n) => chars(questions.find((q) => q.number === n).fact_pattern));
  const span = (xs) => `min ${Math.min(...xs)} · median ${median(xs)} · max ${Math.max(...xs)}`;
  console.log(`\n  generated before : ${span(oldLens)}`);
  console.log(`  generated after  : ${span(newLens)}`);
  if (realLens.length) console.log(`  real (untouched) : ${span(realLens)}`);

  const spread = nextQuestions.reduce((m, q) => ((m[q.correct_answer] = (m[q.correct_answer] ?? 0) + 1), m), {});
  console.log(`  answer spread    : ${JSON.stringify(spread)}`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s) — nothing written:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("  validation       : ok");

  // ------------------------------------------------------------- write
  //
  // verdict_ids is rebuilt rather than added to: the judgments behind the
  // outgoing questions are no longer in the paper, and leaving their ids on the
  // row would claim coverage the paper no longer has.
  const verdictIds = [
    ...new Set(drafts.map((d) => d.data.generated_from.verdict_id).filter(Boolean)),
  ];

  const oldMeta = row.generation_meta ?? {};
  const metaByNumber = new Map((oldMeta.questions ?? []).map((m) => [m.number, m]));
  for (const n of generatedNumbers) metaByNumber.set(n, metaFrom(assigned.get(n), n));

  const meta = {
    ...oldMeta,
    questions: [...metaByNumber.values()].sort((a, b) => a.number - b.number),
    regenerated: [
      ...(oldMeta.regenerated ?? []),
      {
        at: new Date().toISOString(),
        drafts_dir: draftsArg,
        numbers: generatedNumbers,
        files: generatedNumbers.map((n) => assigned.get(n).file),
        fact_pattern_chars_before: { median: median(oldLens), max: Math.max(...oldLens) },
        fact_pattern_chars_after: { median: median(newLens), max: Math.max(...newLens) },
      },
    ],
  };

  if (!commit) {
    console.log("\ndry run — nothing written. Pass --commit to apply.");
    process.exit(0);
  }

  await client.query(
    `UPDATE public.diuni_questions
        SET verdict_ids = $1,
            questions = jsonb_set($2::jsonb, '{questions}', $3::jsonb),
            question_review = jsonb_set($4::jsonb, '{questions}', $5::jsonb),
            generation_meta = $6::jsonb
      WHERE question_id = $7`,
    [
      verdictIds,
      JSON.stringify(row.questions),
      JSON.stringify(nextQuestions),
      JSON.stringify(row.question_review),
      JSON.stringify(nextReviews),
      JSON.stringify(meta),
      setId,
    ]
  );

  console.log(`\nCOMMITTED — ${generatedNumbers.length} generated question(s) replaced in ${setId}.`);
} catch (err) {
  console.error(`\nFAILED — ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
