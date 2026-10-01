// set_runner.mjs — running ONE set, end to end.
//
// Extracted from generate_sets.mjs for the same reason set_plan.mjs was: more
// than one caller now drives a set. The production runner generates new ones;
// regenerate_legacy_sets.mjs rebuilds ones written under an older prompt. Two
// copies of this sequence would drift, and the drift would show up as a set
// that reached the database without a rubric — which is the one outcome the
// completeness gate below exists to prevent.
//
// THE SEQUENCE IS DATA, NOT STRAIGHT-LINE CODE, because there are now two
// drivers. generateSet() blocks and streams child output straight to the
// terminal, which is what a one-at-a-time run wants. generateSetAsync() does not
// block, so a caller can drive several sets at once with each set's output going
// to its own log — seven children sharing one stdout is unreadable, and an
// unreadable log is how a failure goes unexplained. Writing the six stages twice
// would reintroduce exactly the drift this file was extracted to prevent, so
// stagesFor() states them once and both drivers walk the same list.
//
// No side effects on import — nothing here reads argv, prompts, or writes.

import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..', '..', '..');
const serverDir = join(appRoot, 'lawpass_server');
const sourcesDir = join(here, 'sources');
const generatedDir = join(here, 'generated');

// ------------------------------------------------------------- the stages

/**
 * Everything one set runs, in order, and the files each stage has to produce.
 *
 * Pure — it computes paths and returns a list. Nothing here spawns anything, so
 * a caller can print a set's plan without running it.
 */
function stagesFor(step) {
  const { source, angle } = step;
  const base = `${source.id}-${angle}`;

  // NOTE FOR PARALLEL CALLERS: this path is keyed by the SOURCE PAPER, not by
  // the angle — generate_from_source.mjs rewrites it on every set. Two sets on
  // the same paper running at the same time would therefore write and read one
  // file concurrently. The content is identical for a given paper, so the worst
  // case is a torn read rather than wrong data, but it is still a race. The
  // lane runner avoids it by construction: it groups sets by paper and runs a
  // paper's sets one after another, so two sets sharing this file are never in
  // flight together.
  const sourceFile = join(sourcesDir, `${source.id}.source.json`);

  const questionJson = join(generatedDir, `${base}.generated.json`);
  const answerJson = join(generatedDir, `${base}.answer.json`);
  const rubricJson = join(generatedDir, `${base}.rubric.json`);

  const stages = [
    // 1. adapt + question + answer. generate_from_source.mjs writes the adapted
    //    source file the two renderers and the loader then read.
    {
      at: 'generation',
      script: join(here, 'generate_from_source.mjs'),
      args: [`--folder=${source.folder}`, `--angle=${angle}`],
      produces: [questionJson, answerJson],
      onFail: 'rejected or failed — see generated/rejected/',
    },

    // 2. the marking scheme, derived from the question and the answer together.
    //    Runs here rather than after the renders so that a set which cannot be
    //    marked is known before anything is loaded — a question in the table with
    //    no rubric is a task a student can sit and nobody can grade.
    {
      at: 'rubric',
      script: join(serverDir, 'scripts', 'generate-rubric.js'),
      args: [answerJson],
      cwd: serverDir,
      produces: [rubricJson],
      onFail: 'rejected or failed — see generated/rejected/',
    },

    // 3 & 4. HTML for the exam paper and for the model answer. No PDF.
    {
      at: 'question html',
      script: join(serverDir, 'scripts', 'render-open-question-pdf.js'),
      args: [questionJson, sourceFile, '--html-only'],
      cwd: serverDir,
      onFail: 'renderer failed',
    },
    {
      at: 'answer html',
      script: join(serverDir, 'scripts', 'render-open-answer-pdf.js'),
      args: [answerJson, sourceFile, '--html-only'],
      cwd: serverDir,
      onFail: 'renderer failed',
    },

    // 5. the row. The loader re-validates, attaches the quote bank, inherits the
    //    subject from the parent source row and skips anything already present.
    //
    //    `gate` runs THE COMPLETENESS GATE first — see completeness() below.
    {
      at: 'database',
      gate: true,
      script: join(here, 'load_generated_questions.mjs'),
      args: [`${base}.answer.json`, '--commit'],
      onFail: 'load failed — the JSON and HTML are still on disk',
    },

    // 6. the rubric row, into open_question_rubrics — a separate table, not a
    //    column here, because open_questions is student-readable and RLS is
    //    row-level: a rubric beside the question would be one direct query away
    //    from being the answer key in a student's browser.
    //
    //    Loaded as a DRAFT, with no --approve. A draft grades nothing, which is
    //    the same promise the rest of this runner makes: generated content reaches
    //    a student only after a human has read it.
    //
    //    This is the one stage that can leave the database half-written: the
    //    rubric row is looked up by the question row, so the question has to be
    //    inserted first and the two cannot go in as one transaction. A failure
    //    here is reported as PARTIAL rather than as a plain failure, because the
    //    fix is different — the question is already in the table and only the
    //    rubric has to be loaded, not the whole set regenerated.
    {
      at: 'database',
      script: join(here, 'load_rubric.mjs'),
      args: [`${base}.rubric.json`, '--commit'],
      partialOnFail: true,
      onFail:
        'rubric load failed — the QUESTION ROW IS IN THE TABLE and its rubric is not. ' +
        `Load it with: node scripts/ingestion/open_questions/load_rubric.mjs ${base}.rubric.json --commit`,
    },
  ];

  // The three parts the completeness gate insists on.
  const parts = [
    ['question', questionJson],
    ['answer', answerJson],
    ['rubric', rubricJson],
  ];

  return { base, parts, stages };
}

/**
 * THE COMPLETENESS GATE. Nothing reaches the database unless all three parts of
 * the set exist: question, answer, and the rubric that marks them. The stages
 * already stop on their own failures, but the invariant is restated here as one
 * check because it is the one that matters — a question row without a rubric is
 * a task a student can sit and nobody can grade, and it is far easier to never
 * write it than to find it later.
 */
function completeness(set) {
  const missing = set.parts.filter(([, p]) => !existsSync(p)).map(([name]) => name);
  if (!missing.length) return null;
  return {
    ok: false,
    at: 'incomplete set',
    detail: `missing ${missing.join(', ')} — nothing was loaded to the database`,
  };
}

/** A stage's verdict: a failure outcome, or null to carry on. */
function verdict(stage, status) {
  if (status !== 0) {
    return stage.partialOnFail
      ? { ok: false, partial: true, at: stage.at, detail: stage.onFail }
      : { ok: false, at: stage.at, detail: stage.onFail };
  }
  // A zero exit that produced nothing is still a failure, and a more confusing
  // one, so it is named rather than left to the next stage to trip over.
  for (const path of stage.produces ?? []) {
    if (!existsSync(path)) {
      return { ok: false, at: stage.at, detail: `${basename(path)} was not written` };
    }
  }
  return null;
}

// ------------------------------------------------------------ the drivers

/**
 * Run one stage, blocking. Output streams through so the long model calls show
 * progress. Returns the exit status rather than exiting, so one bad set does not
 * take the rest of the run down with it.
 */
export function run(script, args, cwd = appRoot) {
  const res = spawnSync('node', [script, ...args], { cwd, stdio: 'inherit' });
  return res.status ?? 1;
}

/**
 * The same, without blocking, with output written to `out` instead of inherited.
 *
 * `out` is a writable stream the CALLER owns and ends — one per set. Piping with
 * { end: false } matters: the default would close the stream when the first
 * stage's stdout finished and every later stage would write to a dead handle.
 *
 * Never rejects. A spawn failure resolves as a non-zero status, so a caller
 * driving several sets does not lose the others to one unhandled rejection.
 */
export function runAsync(script, args, cwd = appRoot, out = null) {
  return new Promise((resolve) => {
    const child = spawn('node', [script, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (out) {
      child.stdout.pipe(out, { end: false });
      child.stderr.pipe(out, { end: false });
    } else {
      child.stdout.resume();
      child.stderr.resume();
    }
    child.on('error', (error) => {
      out?.write(`\n[could not spawn node ${script}] ${error.message}\n`);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** One set, blocking, output to the terminal. */
export function generateSet(step) {
  const set = stagesFor(step);

  for (const stage of set.stages) {
    if (stage.gate) {
      const incomplete = completeness(set);
      if (incomplete) return incomplete;
    }
    const failure = verdict(stage, run(stage.script, stage.args, stage.cwd ?? appRoot));
    if (failure) return failure;
  }

  return { ok: true, base: set.base };
}

/**
 * One set, without blocking, output to `opts.out`.
 *
 * `opts.onStage(at)` is called as each stage starts, so a parallel caller can
 * show which stage each lane is on without reading the logs. Both options are
 * optional; with neither this is generateSet() with the output discarded.
 */
export async function generateSetAsync(step, { out = null, onStage = null } = {}) {
  const set = stagesFor(step);

  for (const stage of set.stages) {
    if (stage.gate) {
      const incomplete = completeness(set);
      if (incomplete) return incomplete;
    }
    onStage?.(stage.at);
    out?.write(`\n──── ${set.base} — ${stage.at} ────\n`);
    const status = await runAsync(stage.script, stage.args, stage.cwd ?? appRoot, out);
    const failure = verdict(stage, status);
    if (failure) return failure;
  }

  return { ok: true, base: set.base };
}
