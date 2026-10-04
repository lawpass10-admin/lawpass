// build-mahoti-exam.mjs — complete דין מהותי papers, end to end, in one command:
// notebook, 40 questions, the 360° reviews, 7 real Bar questions swapped in, and
// the row stored in `mahoti_questions`. One paper by default, or as many as
// --exams says.
//
//   node scripts/mahoti/build-mahoti-exam.mjs                       # price it, spend nothing
//   node scripts/mahoti/build-mahoti-exam.mjs --commit              # build one paper
//   node scripts/mahoti/build-mahoti-exam.mjs --exams=3 --commit    # build three
//   node scripts/mahoti/build-mahoti-exam.mjs --set-id=<uuid> --commit   # resume one
//
// WHY THIS EXISTS. The three scripts it calls already work. What did not work
// was the ORDER, and the handover between them:
//
//   generate-mahoti-set.mjs ends by trying to swap 7 real questions in, and
//   that swap refuses any real question whose 360° review has not been written.
//   On 2026-10-04 it generated all 40 questions, then stopped at the swap with
//   "only 2 of the 7 needed real questions have a review" and printed a command
//   to run by hand. The paper was finished and the last step silently was not.
//   Nothing was wrong except that the reviews had to exist first, and nobody
//   knew that until the end of an eight-minute run.
//
// So this inverts it: generate WITHOUT the built-in swap, then ask the swap
// what it is missing, write exactly those reviews, then swap. Each paper either
// comes out complete or says which step could not be completed.
//
// WHAT "33 + 7" MEANS. The paper is 40 questions because the real exam is 40.
// 40 are generated first and 7 of them are then REPLACED by real ones, which
// leaves 33 generated — rather than generating 33 and appending 7, which would
// let the sampler cover less of the notebook and would renumber the paper. Every
// question keeps the number it was given.
//
// IT STOPS AT THE DATABASE, NOT AT THE CANDIDATE. Every paper is stored as a
// DRAFT. Publishing is a separate step (scripts/mahoti/publish-exam.mjs), so a
// paper reaches candidates because someone read it, not because a script
// finished. That is the whole point of `exam_status` — see the migration
// 20261004000001_mahoti_exam_publication.sql.
//
// SAFE BY DEFAULT. Without --commit nothing is generated, nothing is written and
// nothing is billed: the plan is printed and the generator's own --estimate is
// run, which is free and counts the real tokens rather than guessing.
//
// COST, at list price for a clean run: roughly $6-8 PER PAPER for the 40
// questions, plus about $0.30-0.60 for each real-question review that still has
// to be written (up to 7 per paper, and far fewer once the pool fills up).
// --exams=5 is therefore a $30-40 command; the dry run prices it first.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const commit = argv.includes("--commit");
const keepGoing = argv.includes("--keep-going");
const setIdIn = flagOf("set-id");
const EXAMS = Number(flagOf("exams") ?? 1);
const GENERATED = Number(flagOf("generated") ?? 33);
const REAL = Number(flagOf("real") ?? 7);
const TOTAL = GENERATED + REAL;
const SEED = flagOf("seed") === null ? null : Number(flagOf("seed"));

/**
 * How many times to go round the "ask what is missing, write those reviews"
 * loop before giving up on a paper.
 *
 * Two, not unlimited. One pass is the normal case: the swap names the reviews
 * it needs, they get written, the swap runs. A second pass covers a review that
 * failed to write. A third would mean something is wrong that writing more
 * reviews will not fix — a question whose law is not in this notebook, say —
 * and looping on it would spend money per attempt.
 */
const MAX_REVIEW_ROUNDS = 2;

/** The budget a review is retried at when it hits generate-real-reviews.mjs's
 *  default ceiling of 16000. The number that script's own error message tells
 *  you to use. */
const BIGGER_MAX_TOKENS = 24000;

/** Flags handed straight to generate-mahoti-set.mjs when present. `seed` is
 *  NOT here: with several papers it has to differ per paper (see seedFor). */
const PASS_THROUGH = [
  "laws",
  "min-pages",
  "max-pages",
  "batch",
  "concurrency",
  "model",
  "effort",
  "max-attempts",
  "title",
];

function usage(code) {
  console.log(
    [
      "build-mahoti-exam.mjs — complete מהותי papers, generator through DB loader.",
      "",
      "  node scripts/mahoti/build-mahoti-exam.mjs                     # price it, spends nothing",
      "  node scripts/mahoti/build-mahoti-exam.mjs --commit            # build one",
      "  node scripts/mahoti/build-mahoti-exam.mjs --exams=3 --commit  # build three",
      "",
      "FLAGS",
      "  --exams=N            how many complete papers to build        (default 1)",
      "  --commit             actually generate and write. Without it, nothing is billed.",
      "  --generated=N        generated questions kept in each paper   (default 33)",
      "  --real=N             real Bar questions embedded in each      (default 7)",
      "  --seed=N             paper 1 uses N, paper 2 N+1, …  (default: random per paper)",
      "  --set-id=UUID        resume into an existing row (only with --exams=1)",
      "  --keep-going         carry on to the next paper after one fails",
      "  --batch-api          send the question waves through the Batch API (half price,",
      "                       no live progress — an error surfaces at the end of a wave)",
      "  --any-law            let the real-question draw ignore the notebook's laws",
      "  --help",
      "",
      "  Also accepted and passed through to generate-mahoti-set.mjs:",
      `    ${PASS_THROUGH.map((f) => `--${f}`).join(", ")}`,
      "",
      "PER PAPER",
      "  1. generate-mahoti-set.mjs   — notebook + N questions, WITHOUT its own swap,",
      "                                 stored in mahoti_questions as a draft",
      "  2. embed-real-questions.mjs  — dry run, to learn which reviews are missing",
      "  3. generate-real-reviews.mjs — write exactly those",
      "  4. embed-real-questions.mjs  — --commit, swapping the real questions in",
      "",
      "Papers are stored as DRAFTS. To put one in front of candidates:",
      "  node scripts/mahoti/publish-exam.mjs --set=<uuid> --commit",
    ].join("\n")
  );
  process.exit(code);
}

/**
 * Run one of the sibling scripts: its output appears as it happens AND is
 * collected for this script to read.
 *
 * It has to be both. The row id and the list of missing reviews are parsed out
 * of what the children print, so the output must be captured — but `spawnSync`
 * with pipes captures silently, and the first version of this script used it
 * for the question step. The result was that the longest step of the run, eight
 * to fifteen minutes of generation, showed nothing at all until it finished:
 * during the first real run there was no way to tell progress from a hang.
 *
 * So: async spawn, forwarding each chunk to this process's own stdout/stderr as
 * it arrives while accumulating it. Nothing is hidden and nothing is lost.
 */
function run(script, args) {
  const file = join(here, script);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    child.on("error", (err) => resolve({ code: 1, stdout, stderr: `${stderr}${err.message}` }));
  });
}

/** The row id, from whichever line the generator printed it on. */
function setIdFrom(output) {
  const inserted = output.match(/Inserted mahoti_questions row ([0-9a-f-]{36})/i);
  if (inserted) return inserted[1];
  const reused = output.match(/Reusing notebook from row ([0-9a-f-]{36})/i);
  return reused ? reused[1] : null;
}

/**
 * The real-question ids whose reviews are missing.
 *
 * embed-real-questions.mjs prints them as a ready-to-run command on stderr and
 * exits 1. Reading them back out of that message is deliberate rather than
 * lazy: it keeps ONE implementation of "which questions fit this notebook and
 * lack a review", inside the script that owns the question, instead of a second
 * copy here that could drift from it and pick different questions.
 */
function missingReviewIdsFrom(output) {
  const m = output.match(/generate-real-reviews\.mjs --ids=([0-9a-f,-]+)/i);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * The notebook seed for paper `index` (1-based), or null to let the generator
 * draw its own.
 *
 * Passing one --seed straight through to every paper would be the obvious
 * thing and would be a bug: the seed IS the law sample, so three papers built
 * with seed 1234 are three copies of one notebook, and the questions would
 * cover the same sections three times over. Omitting it entirely is the normal
 * case — the generator defaults to a random seed, so papers differ. --seed is
 * for reproducing a run, and then each paper needs its own offset.
 */
function seedFor(index) {
  return SEED === null ? null : SEED + index - 1;
}

/**
 * The real-question draw's seed, which is NOT the notebook seed.
 *
 * embed-real-questions.mjs defaults to --seed=1, so every paper would shuffle
 * its eligible pool identically and the papers that share laws would embed the
 * same real questions. One seed per paper spreads the draw instead. Within a
 * paper it must stay constant — the probe and the commit have to agree on which
 * seven questions they are talking about.
 */
function drawSeedFor(index) {
  return (SEED ?? 1) + index - 1;
}

/** Build one complete paper. Returns what happened, for the closing summary. */
async function buildOne(index, { passed, batchApi, anyLaw }) {
  const label = EXAMS > 1 ? `paper ${index}/${EXAMS}  ` : "";
  const notebookSeed = seedFor(index);
  const drawSeed = String(drawSeedFor(index));

  // ---- 1. the questions, WITHOUT the generator's own real-question swap -----
  //
  // --embed-real=0 is the point of this script: the swap is run below, after
  // the reviews it depends on exist. Left at its default the generator would
  // attempt the swap at the end of the run and stop short, which is the failure
  // this file was written to remove.
  console.log(`\n── ${label}1/4  questions ───────────────────────────────────\n`);
  const gen = await run(
    "generate-mahoti-set.mjs",
    [
      `--questions=${TOTAL}`,
      "--embed-real=0",
      ...(setIdIn ? [`--set-id=${setIdIn}`] : []),
      ...(notebookSeed === null ? [] : [`--seed=${notebookSeed}`]),
      ...batchApi,
      ...passed,
    ],
  );
  if (gen.code !== 0) {
    return { index, setId: null, ok: false, note: "the question step failed" };
  }

  const setId = setIdIn ?? setIdFrom(gen.stdout);
  if (!setId) {
    return {
      index,
      setId: null,
      ok: false,
      note: "generated, but printed no row id — find the row and resume with --set-id",
    };
  }

  if (REAL === 0) {
    return { index, setId, ok: true, note: `${TOTAL} generated` };
  }

  // ---- 2-3. ask what is missing, write exactly that ------------------------
  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round += 1) {
    console.log(
      `\n── ${label}2/4  which real questions are ready? (round ${round}) ──\n`
    );
    const probe = await run(
      "embed-real-questions.mjs",
      [`--set=${setId}`, `--count=${REAL}`, `--seed=${drawSeed}`, ...anyLaw],
    );
    if (probe.code === 0) break;

    const ids = missingReviewIdsFrom(probe.stderr + probe.stdout);
    if (ids.length === 0) {
      return {
        index,
        setId,
        ok: false,
        note: "stored, but no real question fits this notebook — see the message above",
      };
    }

    console.log(`\n── ${label}3/4  writing ${ids.length} missing review(s) ────\n`);
    let reviews = await run("generate-real-reviews.mjs", [`--ids=${ids.join(",")}`]);

    // A review that ran out of room is not a failed run, it is a review that
    // needed a bigger budget — generate-real-reviews.mjs says so itself ("hit
    // max_tokens — rerun with --max-tokens=24000") and its default is 16000. On
    // 2026-10-04 one such question stopped a three-paper run two papers in, so
    // the advice the child already prints is taken here instead of being left
    // on screen for someone to read an hour later. Re-running is safe and
    // cheap: the script skips questions that already carry a review, so only
    // the one that ran out is re-asked.
    if (reviews.code !== 0 && /max_tokens/.test(reviews.stdout + reviews.stderr)) {
      console.log(`\n   a review hit the token ceiling — retrying those at ${BIGGER_MAX_TOKENS}\n`);
      reviews = await run("generate-real-reviews.mjs", [
        `--ids=${ids.join(",")}`,
        `--max-tokens=${BIGGER_MAX_TOKENS}`,
      ]);
    }

    if (reviews.code !== 0) {
      return { index, setId, ok: false, note: "stored, but writing the reviews failed" };
    }
  }

  // ---- 4. the swap ---------------------------------------------------------
  console.log(`\n── ${label}4/4  embedding the real questions ────────────────\n`);
  const embed = await run(
    "embed-real-questions.mjs",
    [`--set=${setId}`, `--count=${REAL}`, `--seed=${drawSeed}`, "--commit", ...anyLaw],
  );
  if (embed.code !== 0) {
    return {
      index,
      setId,
      ok: false,
      note: `stored as ${TOTAL} generated, but the real-question swap failed`,
    };
  }

  return { index, setId, ok: true, note: `${GENERATED} generated + ${REAL} real` };
}

async function main() {
  if (argv.includes("--help") || argv.includes("-h")) usage(0);

  for (const [name, value] of [
    ["exams", EXAMS],
    ["generated", GENERATED],
    ["real", REAL],
  ]) {
    if (!Number.isInteger(value) || value < 0) {
      console.error(`--${name} must be a whole number. Got: ${flagOf(name)}`);
      process.exit(2);
    }
  }
  if (EXAMS < 1) {
    console.error("--exams must be at least 1.");
    process.exit(2);
  }
  if (SEED !== null && !Number.isInteger(SEED)) {
    console.error(`--seed must be a whole number. Got: ${flagOf("seed")}`);
    process.exit(2);
  }
  // One row cannot hold two papers, and silently building the second one
  // somewhere else would be worse than refusing.
  if (setIdIn && EXAMS > 1) {
    console.error(
      "--set-id resumes ONE paper into ONE row, so it cannot be combined with --exams>1."
    );
    process.exit(2);
  }

  const passed = PASS_THROUGH.filter((f) => flagOf(f) !== null).map(
    (f) => `--${f}=${flagOf(f)}`
  );
  const batchApi = argv.includes("--batch-api") ? ["--batch-api"] : [];
  const anyLaw = argv.includes("--any-law") ? ["--any-law"] : [];

  console.log(
    [
      "",
      "plan",
      `  papers           ${EXAMS}`,
      `  each             ${TOTAL} questions — ${GENERATED} generated + ${REAL} real`,
      `  notebook         ${setIdIn ? `reuse ${setIdIn}` : "a new sample per paper"}`,
      `  seed             ${SEED === null ? "random per paper" : `${SEED}…${SEED + EXAMS - 1}`}`,
      `  transport        ${batchApi.length ? "Batch API (half price, waves)" : "streamed"}`,
      `  real-question    ${anyLaw.length ? "ANY law (notebook filter off)" : "inside each notebook's laws"}`,
      `  on completion    stored as draft — publish-exam.mjs puts a paper in the picker`,
      "",
    ].join("\n")
  );

  if (!commit) {
    // The generator's own estimator is free and measures the real token counts,
    // so the dry run ends with a price rather than a guess. Run once: every
    // paper is the same size, and only the law sample differs between them.
    console.log(
      `dry run — pricing ONE paper, writing nothing${EXAMS > 1 ? ` (multiply by ${EXAMS})` : ""}:\n`
    );
    await run("generate-mahoti-set.mjs", [`--questions=${TOTAL}`, "--estimate", ...passed]);
    console.log(
      `\nThat is per paper, and ${EXAMS} paper(s) are planned.\n` +
        `Add up to ${REAL} real-question review(s) each, at roughly $0.30-0.60 apiece,\n` +
        "for those that do not have one yet — fewer each time, as the pool fills up.\n\n" +
        "Re-run with --commit to build."
    );
    return;
  }

  const results = [];
  for (let i = 1; i <= EXAMS; i += 1) {
    const result = await buildOne(i, { passed, batchApi, anyLaw });
    results.push(result);
    if (!result.ok && !keepGoing) {
      // Stop by default. A failure is usually systemic rather than particular
      // to one paper — an expired key, a billing block, a model outage — and
      // the 2026-10-01 outage burned a run's worth of calls discovering that
      // one paper at a time. --keep-going is there for when it is not.
      console.error(
        `\npaper ${i} failed, stopping. Pass --keep-going to carry on to the rest.`
      );
      break;
    }
  }

  console.log("\n" + "─".repeat(64));
  for (const r of results) {
    console.log(
      `  ${r.ok ? "ok    " : "FAILED"}  paper ${r.index}  ${r.setId ?? "(no row)"}  ${r.note}`
    );
  }

  const built = results.filter((r) => r.ok);
  if (built.length > 0) {
    console.log(
      `\n${built.length} of ${EXAMS} paper(s) complete, stored as drafts. Review each one:\n` +
        built.map((r) => `  /mahoti?set=${r.setId}`).join("\n") +
        "\n\nThen publish the ones worth offering, as the next מבחן מספר N:\n" +
        built
          .map((r) => `  node scripts/mahoti/publish-exam.mjs --set=${r.setId} --commit`)
          .join("\n")
    );
  }

  if (built.length !== results.length || results.length !== EXAMS) process.exit(1);
}

await main();
