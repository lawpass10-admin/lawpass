// embed-real-questions.mjs — put real Bar questions into a generated דין מהותי
// paper, in place of generated ones.
//
//   node scripts/mahoti/embed-real-questions.mjs --set=<question_id>            # dry run
//   node scripts/mahoti/embed-real-questions.mjs --set=<id> --count=7 --commit
//   node scripts/mahoti/embed-real-questions.mjs --set=<id> --replace-unfit --commit
//   node scripts/mahoti/embed-real-questions.mjs --set=<id> --any-law      # ignore the notebook
//
// SAFE BY DEFAULT: without --commit this reports exactly which questions would
// leave the paper and which would replace them, and writes nothing. A --commit
// writes the paper's previous questions and reviews to scripts/mahoti/backups/
// first, because the generated question a swap displaces is not stored anywhere
// else and the row holds no history.
//
// THE PAPER STAYS INSIDE ITS NOTEBOOK, SECTION BY SECTION. A generated מהותי
// paper is built from one notebook, and a notebook is not a list of laws — it is
// a SAMPLE of sections from 25 laws, because every section of 25 laws is ~120 A4
// pages and a candidate is given 70–90. A generated question is held to that
// sample twice over: generate-mahoti-set.mjs refuses one whose cited section is
// not in the notebook, and refuses one whose quote is not verbatim in that
// section's text.
//
// An embedded real question is held to the same line, as far as the source
// allows: the law its answer turns on must be in the notebook, AND every section
// that law's citation names must be in it too. Matching on the law alone is not
// enough and looks fine — of 26 pool questions whose law was in one notebook,
// only 11 had all their cited sections in it; the other 15 asked about text the
// candidate was never given.
//
// The filter reads mahoti_real_questions.law_id and .cited_sections, which
// scripts/mahoti/map-real-question-laws.mjs fills from the Bar's printed
// citation. `--any-law` drops to no filter at all and `--laws-only` to the weaker
// law-level one; both exist so that choosing them is visible.
//
// WHY REPLACE RATHER THAN ADD. The paper is 40 questions because the real one
// is. Adding seven would make it 47; replacing seven keeps the paper the size a
// candidate is training for, and every number stays where it was — question 12
// is still question 12, so a link to a sitting mid-exam does not shift under it.
//
// WHICH SEVEN LEAVE. `--pick=random` (the default here) draws by seed.
// `--pick=longest` instead retires the generated questions with the longest
// fact patterns, which is what /diuni defaults to because its generated median
// ran near three times the real one. This generator does not have that problem
// — its fact patterns average 343 characters against the real papers' 264 — so
// there is no length argument for choosing, and a seeded draw is the honest
// way to pick.
//
// THE REVIEW TRAVELS WITH THE QUESTION. A real question is only eligible once
// scripts/mahoti/generate-real-reviews.mjs has written its 360° review; this
// refuses to draw one without it rather than leaving a question in the paper
// that explains nothing. Run this as a dry run first, feed the ids it prints to
// that script, then run it again with --commit.

import dotenv from "dotenv";
import pg from "pg";
import { mkdirSync, writeFileSync } from "node:fs";
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
const pick = flagOf("pick") ?? "random";
const seed = Number(flagOf("seed") ?? 1);
const anyLaw = argv.includes("--any-law");
// Fall back to matching the law and ignoring which of its sections the notebook
// actually holds — what this did before section matching existed.
const lawsOnly = argv.includes("--laws-only");
// Repair mode: take OUT the embedded real questions whose law is not in this
// paper's notebook, and put fitting ones in their slots. Without it an
// already-embedded question is left alone, which is right when adding and wrong
// when the ones already there do not belong.
const replaceUnfit = argv.includes("--replace-unfit");
// Bring the `sources` of questions ALREADY embedded up to date from the pool,
// swapping nothing. A question embedded before a source field existed carries
// the older shape, and a paper whose seven sources are three shapes is one
// nobody can read a rule out of. Cheap, idempotent, and it never touches a
// question's text, options, answer or review.
const refreshSources = argv.includes("--refresh-sources");

if (!setId) {
  console.error("--set=<question_id> is required (the mahoti_questions row to edit)");
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

/**
 * The text a candidate reads as the question's facts.
 *
 * A question that belonged to a run carries the passage the run shared, and in
 * the source paper that passage sat above it on the page. Drawn into a
 * generated paper it has no page to sit on, so it is folded into the fact
 * pattern — otherwise the candidate gets "הניחו כי לנתונים שהובאו בשאלה לעיל"
 * and no לעיל to read.
 */
function factsFor(real) {
  return [real.shared_passage, real.fact_pattern]
    .filter((part) => String(part ?? "").trim())
    .join("\n\n");
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
    `SELECT question_id, questions, question_review, question_notebook->'laws' AS notebook_laws
       FROM public.mahoti_questions WHERE question_id = $1`,
    [setId]
  );
  if (paper.rows.length === 0) throw new Error(`no mahoti_questions row ${setId}`);

  const row = paper.rows[0];
  const questions = row.questions?.questions ?? [];
  const reviews = row.question_review?.questions ?? [];
  if (questions.length === 0) throw new Error("that paper has no questions");

  // What this paper was actually written from: not 25 laws, but a named set of
  // sections within each of them.
  const notebookIds = new Set((row.notebook_laws ?? []).map((l) => Number(l.law_id)));
  const notebookSections = new Map(
    (row.notebook_laws ?? []).map((l) => [
      Number(l.law_id),
      new Set((l.sections ?? []).map((s) => String(s.number).trim())),
    ])
  );
  if (!anyLaw && notebookIds.size === 0) {
    throw new Error("that paper's notebook lists no laws — rerun with --any-law to embed anyway");
  }

  const isReal = (q) => (q.sources ?? []).some((s) => s?.origin === "real_exam");

  /**
   * Is this pool question grounded in the notebook?
   *
   * A citation that names the law but pins no section to it fails: nothing can
   * be checked, and "unverifiable" is not "verified". That costs 2 of the 157
   * and buys a filter that means what it says.
   */
  const groundedIn = (lawId, citedSections) => {
    if (anyLaw) return true;
    if (!notebookIds.has(Number(lawId))) return false;
    if (lawsOnly) return true;
    const lead = (citedSections ?? [])[0];
    if (!lead || lead.sections.length === 0) return false;
    const held = notebookSections.get(Number(lawId)) ?? new Set();
    return lead.sections.every((s) => held.has(String(s)));
  };

  const embedded = questions.filter(isReal);
  const generated = questions.filter((q) => !isReal(q));

  // An embedded question is judged against the pool row it came from, not
  // against what the paper recorded: a question embedded before section
  // matching existed carries no sections in its source, and reading only the
  // paper would call it fit for the reason it was wrongly called fit before.
  const embeddedKeys = embedded.map((q) => {
    const s = (q.sources ?? []).find((x) => x?.origin === "real_exam");
    return { number: q.number, paper: s?.paper, srcNumber: s?.number };
  });
  const poolForEmbedded = embeddedKeys.length
    ? (
        await client.query(
          // law_name is selected because --refresh-sources writes it back. Leave
          // it out and the spread sets law_name: undefined, which JSON drops —
          // silently deleting the name from every source it touches.
          `SELECT paper, number, law_id, law_name, cited_sections
             FROM public.mahoti_real_questions
            WHERE (paper, number) IN (${embeddedKeys
              .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}::int)`)
              .join(", ")})`,
          embeddedKeys.flatMap((k) => [k.paper, k.srcNumber])
        )
      ).rows
    : [];
  const poolByKey = new Map(poolForEmbedded.map((r) => [`${r.paper}#${r.number}`, r]));

  const unfit = embedded.filter((q) => {
    const s = (q.sources ?? []).find((x) => x?.origin === "real_exam");
    const row = poolByKey.get(`${s?.paper}#${s?.number}`);
    if (!row) return true; // not in the pool any more — nothing vouches for it
    return !groundedIn(row.law_id, row.cited_sections);
  });

  if (refreshSources) {
    let changed = 0;
    const refreshed = questions.map((q) => {
      if (!isReal(q)) return q;
      const s = (q.sources ?? []).find((x) => x?.origin === "real_exam");
      const poolRow = poolByKey.get(`${s?.paper}#${s?.number}`);
      const sections = poolRow?.cited_sections?.[0]?.sections ?? [];
      const next = {
        ...s,
        ...(poolRow?.law_id ? { law_id: poolRow.law_id, law_name: poolRow.law_name } : {}),
        ...(sections.length ? { sections } : {}),
      };
      if (JSON.stringify(next) === JSON.stringify(s)) return q;
      changed++;
      console.log(
        `  #${String(q.number).padStart(2)}  ${s.paper} #${s.number}  ` +
          `sections ${sections.length ? sections.join(",") : "(none cited)"}`
      );
      return { ...q, sources: [next, ...(q.sources ?? []).filter((x) => x !== s)] };
    });

    console.log(`\n${changed} source(s) would be brought up to date.`);
    if (changed === 0 || !commit) {
      console.log(commit ? "" : "dry run — nothing written. Pass --commit to apply.");
      process.exit(0);
    }
    await client.query(`UPDATE public.mahoti_questions SET questions = $1::jsonb WHERE question_id = $2`, [
      JSON.stringify({ ...row.questions, questions: refreshed }),
      setId,
    ]);
    console.log(`COMMITTED — ${changed} source(s) refreshed in ${setId}.`);
    process.exit(0);
  }
  const already = replaceUnfit ? embedded.filter((q) => !unfit.includes(q)) : embedded;

  console.log(
    `paper ${setId} — ${row.questions?.exam?.title ?? "(no title)"}\n` +
      `  ${questions.length} questions — ${generated.length} generated, ${embedded.length} real` +
      (embedded.length ? ` (${unfit.length} outside the notebook)` : "") +
      `\n  notebook: ${notebookIds.size} laws${anyLaw ? "  (--any-law: filter off)" : ""}`
  );

  if (!replaceUnfit && unfit.length > 0) {
    console.log(
      `\n  ${unfit.length} embedded question(s) sit outside this paper's notebook.\n` +
        `  Re-run with --replace-unfit to swap them for ones that belong.`
    );
  }

  const wanted = replaceUnfit ? unfit.length : Math.max(0, count - already.length);
  if (wanted === 0) {
    console.log(
      replaceUnfit
        ? `\nnothing to do — every embedded question already belongs to the notebook.`
        : `\nnothing to do — the paper already carries ${already.length} real question(s).`
    );
    process.exit(0);
  }

  // The outgoing ones. In repair mode they are decided already: the unfit ones,
  // and nothing generated is touched.
  const random = rng(seed);
  const outgoing = replaceUnfit
    ? unfit
    : pick === "longest"
      ? [...generated]
          .sort((a, b) => String(b.fact_pattern ?? "").length - String(a.fact_pattern ?? "").length)
          .slice(0, wanted)
      : shuffle(generated, random).slice(0, wanted);

  // The incoming ones: reviewed real questions whose law is in the notebook,
  // spread across the sittings rather than taken from one paper — a seeded
  // shuffle over the pool does that on its own.
  // The law filter runs in SQL; the section filter runs here, because "every
  // section this key names is one the notebook holds" is a set comparison
  // against a payload, not a predicate the index can help with. The pool is
  // 157 rows.
  const poolWhere = anyLaw
    ? "review IS NOT NULL"
    : "review IS NOT NULL AND law_id = ANY($1::bigint[])";
  const poolArgs = anyLaw ? [] : [[...notebookIds]];
  const poolAll = await client.query(
    `SELECT real_question_id, paper, number, shared_passage, fact_pattern, stem,
            options, correct_answer, source_citation, law_id, law_name,
            cited_sections, review
       FROM public.mahoti_real_questions
      WHERE ${poolWhere}
      ORDER BY paper, number`,
    poolArgs
  );
  const pool = { rows: poolAll.rows.filter((r) => groundedIn(r.law_id, r.cited_sections)) };

  // Never the same real question twice in one paper. The unfit ones on their
  // way out are excluded by the notebook filter already.
  const usedKeys = new Set(
    already.flatMap((q) =>
      (q.sources ?? [])
        .filter((s) => s?.origin === "real_exam")
        .map((s) => `${s.paper}#${s.number}`)
    )
  );
  const eligible = pool.rows.filter((r) => !usedKeys.has(`${r.paper}#${r.number}`));
  const incoming = shuffle(eligible, rng(seed)).slice(0, wanted);

  const filterName = anyLaw ? "no filter" : lawsOnly ? "law-level" : "section-level";
  console.log(
    `\n  ${pool.rows.length} reviewed real question(s) fit this notebook (${filterName})` +
      (anyLaw ? "" : `, out of ${poolAll.rows.length} on its laws`)
  );

  if (incoming.length < wanted) {
    // The ids are printed so the review step can be pointed straight at them.
    // Drawn from the SAME filtered set with the SAME seed, so once they are
    // reviewed a re-run of this command picks exactly these.
    const missingWhere = anyLaw
      ? "review IS NULL"
      : "review IS NULL AND law_id = ANY($1::bigint[])";
    const missing = await client.query(
      `SELECT real_question_id, paper, number, law_name, law_id, cited_sections
         FROM public.mahoti_real_questions
        WHERE ${missingWhere} ORDER BY paper, number`,
      poolArgs
    );
    const grounded = missing.rows.filter((r) => groundedIn(r.law_id, r.cited_sections));
    const need = shuffle(grounded, rng(seed)).slice(0, wanted - incoming.length);
    if (need.length === 0) {
      console.error(
        `\nonly ${incoming.length} of the ${wanted} needed questions are available, and no ` +
          `unreviewed question fits this notebook either. Widen the notebook or pass --any-law.`
      );
      process.exit(1);
    }
    console.error(
      `\nonly ${incoming.length} of the ${wanted} needed real questions have a review.\n` +
        `Write the missing ones first:\n\n` +
        `  node scripts/mahoti/generate-real-reviews.mjs --ids=${need
          .map((r) => r.real_question_id)
          .join(",")}\n\n` +
        `(${need.map((r) => `${r.paper} #${r.number}`).join(", ")})`
    );
    process.exit(1);
  }

  console.log(`\n  out (${pick} draw over the generated questions):`);
  for (const q of outgoing) {
    console.log(
      `    #${String(q.number).padStart(2)}  ${String(q.fact_pattern ?? "").length} chars  ${String(q.stem).slice(0, 44)}`
    );
  }
  console.log("\n  in (real questions):");
  for (const r of incoming) {
    console.log(
      `    ${r.paper} #${String(r.number).padStart(3)}  ${String(factsFor(r).length).padStart(4)} chars  ` +
        `${(r.law_name ?? "(unclassified)").slice(0, 34).padEnd(34)}  ${r.stem.slice(0, 34)}`
    );
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
      fact_pattern: factsFor(real),
      stem: real.stem,
      options: real.options,
      correct_answer: real.correct_answer,
      // Provenance in the same `sources` array the generated questions use, so
      // one reader handles both. The shape differs, and has to: a generated
      // source carries a section number and a quote VERIFIED against the
      // notebook, and this question was not built from the notebook. Inventing
      // a source_quote for it would put an unverifiable quotation in the same
      // field every other quote in the paper was checked in.
      //
      // `origin: "real_exam"` is the marker a later run reads to leave an
      // already-embedded question alone, and lib/db/mahoti.ts renders the
      // reference from `citation` — the provision the Bar's own key cites.
      //
      // law_id, when mapped, is what the dashboard's topic charts read
      // (lawpass_server/db/mahoti.js). Nothing is mapped yet, so these
      // questions report as ללא סיווג — honest: nothing has classified them.
      sources: [
        {
          origin: "real_exam",
          paper: real.paper,
          number: real.number,
          citation: real.source_citation,
          ...(real.law_id ? { law_id: real.law_id, law_name: real.law_name } : {}),
          // The sections the key pins to that law, carried onto the question so
          // check-real-question-fit.mjs can re-verify the grounding from the
          // paper alone — without it the paper cannot say why it believes this
          // question belongs, only that something once did.
          ...(real.cited_sections?.[0]?.sections?.length
            ? { sections: real.cited_sections[0].sections }
            : {}),
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
      quick_thinking_360_items: r.quick_thinking_360_items,
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
    const review = nextReviews.find((r) => r.number === q.number);
    if (!review) throw new Error(`question ${q.number} has no review`);
    // The stem is the invariant, not the fact pattern. A knowledge question —
    // "?מהו הכלל בדבר נטלי הראיה בתביעת ביטוח רכוש" — has no facts and never
    // did, and both the workspace and the review screen already drop the empty
    // half before rendering ([fact_pattern, stem].filter(...).join). Requiring
    // facts here would refuse 16 of the 157 real questions over a field the
    // paper they came from did not have either.
    if (!String(q.stem ?? "").trim()) throw new Error(`question ${q.number} lost its stem`);
    if (!`${q.fact_pattern ?? ""}${q.stem ?? ""}`.trim()) {
      throw new Error(`question ${q.number} lost its text`);
    }
    if ((q.options ?? []).length !== 4) throw new Error(`question ${q.number} has ${q.options?.length} options`);
    if (!q.options.some((o) => o.letter === q.correct_answer)) {
      throw new Error(`question ${q.number}: correct_answer ${q.correct_answer} names no option`);
    }
    // The panel renders one distractor analysis per option letter; a review
    // missing one draws a blank card under an answer.
    for (const option of q.options) {
      if (!String(review.distractor_analysis?.[option.letter] ?? "").trim()) {
        throw new Error(`question ${q.number}: review has no analysis for option ${option.letter}`);
      }
    }
  }

  // mahoti_questions has no generation_meta column (diuni_questions does), so
  // the record of what was swapped lives in the questions payload beside the
  // generation block it belongs with.
  const nextPayload = {
    ...row.questions,
    questions: nextQuestions,
    real_questions_embedded: [
      ...(row.questions?.real_questions_embedded ?? []),
      {
        at: new Date().toISOString(),
        pick,
        seed,
        swapped: outgoing.map((q, i) => ({
          number: q.number,
          replaced_generated_chars: String(q.fact_pattern ?? "").length,
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

  // The generated question a swap displaces is not stored anywhere else: the
  // row holds no history, and once `questions` is overwritten its previous
  // contents are gone. Written before the UPDATE, so a bad swap is recoverable
  // from a file rather than from a regeneration that would not reproduce it.
  const backupDir = join(here, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `${setId}-embed-${Date.now()}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        _readme: "Pre-swap snapshot written by scripts/mahoti/embed-real-questions.mjs.",
        question_id: setId,
        taken_at: new Date().toISOString(),
        questions: row.questions,
        question_review: row.question_review,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`\nbacked up the paper as it stands to ${backupPath}`);

  await client.query(
    `UPDATE public.mahoti_questions
        SET questions = $1::jsonb,
            question_review = jsonb_set($2::jsonb, '{questions}', $3::jsonb)
      WHERE question_id = $4`,
    [
      JSON.stringify(nextPayload),
      JSON.stringify(row.question_review),
      JSON.stringify(nextReviews),
      setId,
    ]
  );

  console.log(`\nCOMMITTED — ${wanted} real question(s) embedded in ${setId}.`);
} finally {
  await client.end();
}
