// build-diuni-exam.mjs — complete דין דיוני papers, end to end, in one command:
// 40 questions with their 360° reviews, 7 real Bar questions drawn at random and
// reviewed, and the row stored in `diuni_questions` as a draft.
//
//   node scripts/diuni/build-diuni-exam.mjs                     # price it, spend nothing
//   node scripts/diuni/build-diuni-exam.mjs --commit            # build one paper
//   node scripts/diuni/build-diuni-exam.mjs --exams=3 --commit  # build three
//   node scripts/diuni/build-diuni-exam.mjs --seed=42 --commit  # reproduce a draw
//
// THE TWIN OF scripts/mahoti/build-mahoti-exam.mjs, against the diuni scripts.
// Kept as a separate file rather than one script with a --part flag, which is
// how the two generators, loaders, embedders and publishers are already arranged.
//
// WHY THIS EXISTS. The five scripts it calls already work. What did not work was
// the ORDER, and the handover between them. On 2026-10-04 מבחן מספר 2 was built
// by running them by hand, and the real-question step quietly did the wrong
// thing: embed-real-questions.mjs drew from the questions that already had a
// review, the pool held exactly seven of those out of 226, and the paper took
// all seven — from two of the six sittings, with the seed making no difference.
// Nothing errored. The paper looked finished and the draw had never happened.
//
// So this inverts it, in both scripts. embed-real-questions.mjs now draws from
// the whole pool first and then demands reviews for whichever came up; this
// script asks it what is missing, writes exactly those, and runs the swap.
//
// WHAT "33 + 7" MEANS. The paper is 40 questions because the real exam is 40.
// 40 are GENERATED first and 7 of them are then REPLACED by real ones, which
// leaves 33 generated — rather than generating 33 and appending 7, which would
// let the sampler cover less of the corpus and would renumber the paper. The
// review payload binds to questions by NUMBER, so a renumbering would attach
// every review to the wrong question instead of failing.
//
// IT STOPS AT THE DATABASE, NOT AT THE CANDIDATE. Every paper is stored as a
// DRAFT. Publishing is a separate step (scripts/diuni/publish-exam.mjs), so a
// paper reaches candidates because someone read it, not because a script
// finished.
//
// SAFE BY DEFAULT. Without --commit nothing is generated, nothing is written and
// nothing is billed: the plan is printed and generate-batch.mjs's own estimate
// is run, which is free.
//
// COST, at list price on claude-opus-5-5: roughly $5-6 per paper for the 40
// questions, plus about $0.30-0.60 for each real-question review that still has
// to be written (up to 7 per paper, and fewer as the pool fills).

import { spawn } from "node:child_process";
import { readdirSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { acquireGeneratedLock } from "./generated-lock.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const generatedDir = join(here, "generated");

dotenv.config({ path: join(appRoot, ".env.local") });
dotenv.config({ path: join(appRoot, ".env") });

/**
 * Most times one answer letter may appear in a 40-question paper before the
 * paper is worth a second look. Even is 10.
 *
 * The generator rotates its own answers, so 40 generated questions come out
 * near-perfectly flat. The 7 real ones bring whatever letters the Bar used and
 * nothing rebalances afterwards, so the swap can undo the rotation: the paper
 * built on 2026-10-04 at seed 1 landed on א6 ב12 ג8 ד14, where blind-guessing
 * ד scores 35%. 13 of 40 is 32.5% — high enough to be worth re-drawing, low
 * enough that ordinary variation does not trip it.
 */
const SPREAD_MAX = 13;

const argv = process.argv.slice(2);
const flagOf = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const commit = argv.includes("--commit");
const keepGoing = argv.includes("--keep-going");
const batchApi = argv.includes("--batch-api") ? ["--batch-api"] : [];
const EXAMS = Number(flagOf("exams") ?? 1);
const GENERATED = Number(flagOf("generated") ?? 33);
const REAL = Number(flagOf("real") ?? 7);
const TOTAL = GENERATED + REAL;
const SEED = flagOf("seed") === null ? null : Number(flagOf("seed"));
const TITLE = flagOf("title") ?? "דין דיוני";

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      "build-diuni-exam.mjs — a complete דין דיוני paper in one command.",
      "",
      "  --exams=N        how many papers            (default 1)",
      "  --generated=N    generated questions kept   (default 33)",
      "  --real=N         real questions swapped in  (default 7; 0 to skip)",
      "  --seed=N         paper 1 draws with N, paper 2 with N+1, …",
      "                   (default: 1 + paper index, as embed-real-questions does)",
      "  --title=TEXT     stored title               (default דין דיוני)",
      "  --batch-api      half price, returns all at once",
      "  --keep-going     carry on to the next paper after one fails",
      "  --commit         actually build. Without it, nothing is billed.",
      "",
      "PER PAPER",
      "  1. generate-batch.mjs        — TOTAL questions, each with its own review",
      "  2. load-diuni-questions.mjs  — collected into one diuni_questions draft",
      "  3. embed-real-questions.mjs  — dry run, to learn which reviews are missing",
      "  4. generate-real-reviews.mjs — write exactly those",
      "  5. embed-real-questions.mjs  — --commit, swapping the real questions in",
      "",
      "Papers are stored as DRAFTS. To put one in front of candidates:",
      "  node scripts/diuni/publish-exam.mjs --set=<uuid> --commit",
    ].join("\n")
  );
  process.exit(0);
}

/**
 * How many times to go round the "ask what is missing, write those reviews"
 * loop before giving up on a paper.
 *
 * Two, not unlimited. One pass is the normal case: the swap names the reviews it
 * needs, they get written, the swap runs. A second covers a review that failed
 * to write. A third would mean something is wrong that writing more reviews will
 * not fix, and looping on it would spend money per attempt.
 */
const MAX_REVIEW_ROUNDS = 2;

/** The budget a review is retried at when it hits the default 16000 ceiling —
 *  the number generate-real-reviews.mjs's own error message tells you to use. */
const BIGGER_MAX_TOKENS = 24000;

function run(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, script), ...args], {
      cwd: appRoot,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
      process.stderr.write(d);
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * The real-question ids whose reviews are missing.
 *
 * embed-real-questions.mjs prints them as a ready-to-run command and exits 1.
 * Reading them back out of that message is deliberate rather than lazy: it keeps
 * ONE implementation of "which seven did this paper draw, and which of them lack
 * a review" inside the script that owns the draw, instead of a second copy here
 * that could drift from it and write reviews for different questions.
 */
function missingReviewIdsFrom(output) {
  const m = output.match(/generate-real-reviews\.mjs --ids=([0-9a-f,-]+)/i);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

/** The question_id load-diuni-questions.mjs prints when it writes the row. */
function setIdFrom(output) {
  const m = output.match(/COMMITTED\s+—\s+question_id\s+([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

/**
 * The finished paper's answer spread, checked rather than assumed.
 *
 * Read from the stored row, not from the generated files: the files are what
 * the generator rotated, and the spread that matters is the one left AFTER the
 * real questions were swapped in.
 */
async function answerSpread(setId) {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT questions FROM public.diuni_questions WHERE question_id = $1`,
      [setId]
    );
    const qs = rows[0]?.questions?.questions ?? [];
    const spread = {};
    for (const q of qs) spread[q.correct_answer] = (spread[q.correct_answer] ?? 0) + 1;
    const worst = Math.max(0, ...Object.values(spread));
    const letter = Object.keys(spread).find((k) => spread[k] === worst);
    return { spread, worst, letter, total: qs.length, flagged: worst > SPREAD_MAX };
  } catch (err) {
    // A failed check must not fail a paper that is otherwise built and stored —
    // but it must not pass silently either, or a skewed paper looks checked.
    console.log(`\n   (answer-spread check could not run: ${err.message})`);
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * The real-question draw's seed.
 *
 * embed-real-questions.mjs defaults to --seed=1, so without this every paper
 * would shuffle the pool identically and embed the same real questions. One seed
 * per paper spreads the draw. Within a paper it must stay CONSTANT — the probe
 * and the commit have to agree on which seven they are talking about, and the
 * reviews written in between are written for the probe's seven.
 */
function drawSeedFor(index) {
  return (SEED ?? 1) + index - 1;
}

/**
 * generated/ must be empty before a paper starts.
 *
 * load-diuni-questions.mjs collects EVERY file in that directory into one row,
 * so leftovers from a previous paper would silently be loaded into this one —
 * an 80-question "40-question paper". Left-behind drafts are archived rather
 * than deleted: they cost real money to produce.
 */
function clearGenerated(index) {
  const files = readdirSync(generatedDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return null;
  const stamp = new Date().toISOString().slice(0, 10);
  let dest = join(generatedDir, `superseded-${stamp}`);
  let n = 2;
  while (existsSync(dest)) dest = join(generatedDir, `superseded-${stamp}-${n++}`);
  mkdirSync(dest, { recursive: true });
  for (const f of files) renameSync(join(generatedDir, f), join(dest, f));
  return { moved: files.length, dest };
}

/** Build one complete paper. Returns what happened, for the closing summary. */
async function buildOne(index) {
  const label = EXAMS > 1 ? `paper ${index}/${EXAMS}  ` : "";
  const drawSeed = String(drawSeedFor(index));

  const cleared = clearGenerated(index);
  if (cleared) {
    console.log(`\n   archived ${cleared.moved} leftover draft(s) -> ${cleared.dest}`);
  }

  // ---- 1. the questions, each carrying its own review ----------------------
  console.log(`\n── ${label}1/5  questions ─────────────────────────────────\n`);
  const gen = await run("generate-batch.mjs", [`--target=${TOTAL}`, "--go", ...batchApi]);
  if (gen.code !== 0) {
    return { index, setId: null, ok: false, note: "the question step failed" };
  }

  // ---- 2. collect them into one row ----------------------------------------
  console.log(`\n── ${label}2/5  storing the paper ──────────────────────────\n`);
  const load = await run("load-diuni-questions.mjs", [`--title=${TITLE}`, "--commit"]);
  if (load.code !== 0) {
    return { index, setId: null, ok: false, note: "generated, but the load failed" };
  }
  const setId = setIdFrom(load.stdout);
  if (!setId) {
    return {
      index,
      setId: null,
      ok: false,
      note: "loaded, but printed no row id — find the row and finish it by hand",
    };
  }

  if (REAL === 0) {
    return { index, setId, ok: true, note: `${TOTAL} generated, no real questions` };
  }

  // ---- 3-4. ask what the draw needs, write exactly that ---------------------
  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round += 1) {
    console.log(`\n── ${label}3/5  which drawn real questions are ready? (round ${round}) ──\n`);
    const probe = await run("embed-real-questions.mjs", [
      `--set=${setId}`,
      `--count=${REAL}`,
      `--seed=${drawSeed}`,
    ]);
    if (probe.code === 0) break;

    const ids = missingReviewIdsFrom(probe.stderr + probe.stdout);
    if (ids.length === 0) {
      return {
        index,
        setId,
        ok: false,
        note: "stored, but the real-question draw could not be satisfied — see above",
      };
    }

    console.log(`\n── ${label}4/5  writing ${ids.length} missing review(s) ───────\n`);
    let reviews = await run("generate-real-reviews.mjs", [`--ids=${ids.join(",")}`]);

    // A review that ran out of room is not a failed run, it is a review that
    // needed a bigger budget — generate-real-reviews.mjs says so itself. Taking
    // its advice here beats leaving it on screen for someone to read an hour
    // later. Re-running is cheap: it skips questions that already have a review.
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

  // ---- 5. the swap ----------------------------------------------------------
  console.log(`\n── ${label}5/5  embedding the real questions ───────────────\n`);
  const embed = await run("embed-real-questions.mjs", [
    `--set=${setId}`,
    `--count=${REAL}`,
    `--seed=${drawSeed}`,
    "--commit",
  ]);
  if (embed.code !== 0) {
    return { index, setId, ok: false, note: "stored, but the real-question swap failed" };
  }

  // The paper is built; now say whether it is BALANCED. A skewed answer key is
  // not a failure — the paper is correct and usable — so this reports rather
  // than returning ok:false. Re-drawing is a judgement call, and cheap: the
  // reviews are already written, so another --seed costs nothing.
  const sp = await answerSpread(setId);
  if (sp) {
    const asText = ["א", "ב", "ג", "ד"].map((l) => `${l}${sp.spread[l] ?? 0}`).join(" ");
    console.log(`\n   answer spread: ${asText}   (even would be ${Math.round(sp.total / 4)} each)`);
    if (sp.flagged) {
      console.log(
        `   ⚠ SKEWED — '${sp.letter}' appears ${sp.worst} of ${sp.total} ` +
          `(${Math.round((sp.worst / sp.total) * 100)}%, threshold ${SPREAD_MAX}).\n` +
          `     Re-draw the real questions at another seed — free, the reviews exist:\n` +
          `       node scripts/diuni/embed-real-questions.mjs --set=${setId} --count=${REAL} --seed=<n> --commit`
      );
    }
    return {
      index, setId, ok: true,
      note: `${GENERATED} generated + ${REAL} real   spread ${asText}${sp.flagged ? "  ⚠ SKEWED" : ""}`,
      flagged: sp.flagged,
    };
  }

  return { index, setId, ok: true, note: `${GENERATED} generated + ${REAL} real` };
}

// --------------------------------------------------------------- plan

console.log(`papers            : ${EXAMS}`);
console.log(`questions each    : ${TOTAL} generated, ${REAL} replaced by real -> ${GENERATED} + ${REAL}`);
console.log(`draw seed         : ${EXAMS > 1 ? `${drawSeedFor(1)}…${drawSeedFor(EXAMS)} (one per paper)` : drawSeedFor(1)}`);
console.log(`title             : ${TITLE}`);
console.log(`stored as         : draft (publish-exam.mjs puts it in front of candidates)`);

const leftover = readdirSync(generatedDir).filter((f) => f.endsWith(".json")).length;
if (leftover) {
  console.log(`generated/        : ${leftover} leftover draft(s) — will be archived, not loaded`);
}

if (!commit) {
  console.log(`\n── cost of the question step (free to ask) ──\n`);
  await run("generate-batch.mjs", [`--target=${TOTAL}`]);
  if (leftover) {
    console.log(
      `\n  (ignore its "-> ${leftover + TOTAL} when done" line: that count assumes the ${leftover}` +
        `\n   leftover draft(s) stay put. A real run archives them first, so the paper is ${TOTAL}.)`
    );
  }
  // Measured on 2026-10-04 over the 7 reviews written so far: 2389 input and
  // 7131 output tokens each, which at claude-opus-5-5 list price is $0.152.
  // The mahoti header's $0.30-0.60 is its own figure at Opus 5 rates; quoting
  // it here would have overstated a diuni run by roughly three times.
  const REVIEW_COST = 0.152;
  console.log(
    `\nthat is ONE paper's questions. This run builds ${EXAMS}:` +
      `\n  questions   ~${EXAMS} x that figure` +
      `\n  reviews     up to ${REAL} per paper at ~$${REVIEW_COST.toFixed(2)} each` +
      ` (measured), so <= $${(EXAMS * REAL * REVIEW_COST).toFixed(2)} in total` +
      `\n              — only for drawn questions never reviewed before, so this` +
      `\n                falls as the pool fills.`
  );
  console.log("\nDRY RUN — nothing generated, nothing written, nothing billed.");
  console.log("Pass --commit to build.");
  process.exit(0);
}

// --------------------------------------------------------------- run

// Taken BEFORE the first paper, because the damage starts at the archive step —
// a second run moving this run's half-written files aside is what produced the
// 55- and 64-question papers on 2026-10-04.
try {
  acquireGeneratedLock(generatedDir, `build-diuni-exam --exams=${EXAMS}`);
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}

const results = [];
for (let i = 1; i <= EXAMS; i += 1) {
  const r = await buildOne(i);
  results.push(r);
  if (!r.ok && !keepGoing && i < EXAMS) {
    console.error(`\npaper ${i} did not complete — stopping. Pass --keep-going to carry on.`);
    break;
  }
}

console.log(`\n${"═".repeat(60)}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? "ok  " : "FAIL"}  paper ${r.index}  ${r.setId ?? "(no row)"}  ${r.note}`);
}
const ok = results.filter((r) => r.ok);
console.log(`\n${ok.length}/${results.length} paper(s) complete, stored as drafts.`);

const skewed = ok.filter((r) => r.flagged);
if (skewed.length) {
  console.log(
    `\n⚠ ${skewed.length} paper(s) have a skewed answer key (one letter above ${SPREAD_MAX} of 40).` +
      `\n  They are correct and usable; re-drawing the real questions at another --seed` +
      `\n  costs nothing, because their reviews are already written.`
  );
}

if (ok.length) {
  console.log(`\nTo publish one:`);
  for (const r of ok) console.log(`  node scripts/diuni/publish-exam.mjs --set=${r.setId} --commit`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
