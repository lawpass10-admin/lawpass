// set_lanes.mjs — running several sets at once, grouped into lanes by source paper.
//
// Extracted from regenerate_legacy_sets.mjs when the production runner needed the
// same thing, for the reason set_plan.mjs and set_runner.mjs were extracted
// before it: a second copy of this would drift, and the drift would show up as
// two lanes handed the same angle letter, one overwriting the other's output.
//
// WHY LANES ARE GROUPED BY SOURCE PAPER, AND SEQUENTIAL INSIDE A LANE.
// generate-open-question.js calls loadExistingAngles() and tells the model which
// angles on this paper already exist, so it does not write the same one twice. It
// reads them OFF DISK when the question stage starts. Four angles of one paper
// running together would each see only what existed before all four began —
// none would know the others were being written — and the likely result is two
// near-identical questions. Keeping a paper's sets in one sequential lane means
// each still sees its predecessor.
//
// It also removes a file race for free: sources/<id>.source.json is keyed by the
// paper, not the angle, and every set rewrites it. Two sets on one paper are
// never in flight together here, so nothing reads it while it is being written.
//
// WHEN EVERY SET IS ON A DIFFERENT PAPER — a run of ten over ten bundles, which
// is what the shuffled plan produces on its first pass — every lane holds one set
// and the grouping costs nothing at all. The constraint only bites once a run is
// long enough to come back to a paper for a second angle.
//
// THE SPEEDUP IS BOUNDED BY THE LONGEST LANE, not by the number of sets: inside a
// set, question -> answer -> rubric is strictly sequential and there is nothing to
// overlap.
//
// EACH LANE WRITES ITS OWN LOG, because several children sharing one stdout
// produce a transcript nobody can read, and an unreadable transcript is how a
// failure goes unexplained. The console gets one line per stage per lane.
//
// No side effects on import — nothing here reads argv, prompts, or writes.

import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { generateSetAsync } from './set_runner.mjs';

export const mmss = (ms) =>
  `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/**
 * Group steps into lanes by source paper, longest lane first.
 *
 * Longest-first matters when the pool is narrower than the number of lanes:
 * starting a four-set lane last would have the short lanes finish and sit idle
 * while it runs on alone.
 *
 * `sourceIdOf` is a function because the two callers hold the source id in
 * different places — the production runner on step.source.id, the legacy one on
 * step.row.source_id.
 */
export function laneize(steps, sourceIdOf) {
  const bySource = new Map();
  for (const step of steps) {
    const id = sourceIdOf(step);
    if (!bySource.has(id)) bySource.set(id, { source: id, steps: [] });
    bySource.get(id).steps.push(step);
  }
  return [...bySource.values()].sort((a, b) => b.steps.length - a.steps.length);
}

/**
 * How long a parallel run should take, in minutes.
 *
 * Takes whichever is larger: the longest single lane, or the work divided by the
 * workers. With a pool narrower than the lane count the wall clock is set by the
 * busiest worker, not by one long lane.
 */
export function estimateMinutes({ lanes, workers, setCount, minutesPerSet }) {
  if (!lanes.length) return 0;
  const longest = Math.max(...lanes.map((l) => l.steps.length));
  const perWorker = Math.ceil(setCount / Math.max(workers, 1));
  return Math.max(longest, perWorker) * minutesPerSet;
}

/** How many lanes actually run at once. */
export function laneWorkers(lanes, limit) {
  return Math.max(1, Math.min(limit, lanes.length));
}

/**
 * One lane: its sets in order, each writing into the lane's own log.
 *
 * Never throws. A lane that died would otherwise take the whole Promise.all with
 * it and lose every other lane's results.
 */
async function runLane(lane, { logsDir, stamp, labelOf, onSet, startedAt, results }) {
  const logPath = join(logsDir, `lane-${lane.source}-${stamp}.log`);
  const out = createWriteStream(logPath, { flags: 'a' });
  const say = (m) => console.log(`[${lane.source}] ${m}`);

  try {
    for (const [i, step] of lane.steps.entries()) {
      const label = labelOf(step);
      const position = `${i + 1}/${lane.steps.length}`;
      say(`${position} ${label} — started   (elapsed ${mmss(Date.now() - startedAt)})`);

      const began = Date.now();
      let outcome;
      try {
        outcome = await generateSetAsync(step, {
          out,
          onStage: (at) => say(`${position} ${label} — ${at}`),
        });
      } catch (error) {
        // generateSetAsync is written not to throw; if it ever does, the lane
        // records it and carries on rather than vanishing.
        outcome = { ok: false, at: 'runner', detail: error.message };
      }

      const took = mmss(Date.now() - began);
      const record = { step, outcome, took, lane: lane.source, log: logPath };
      results.push(record);

      if (outcome.ok) say(`${label} — loaded in ${took} (question row + rubric row, draft)`);
      else if (outcome.partial) say(`${label} — PARTIAL after ${took}: ${outcome.detail}`);
      else say(`${label} — FAILED at ${outcome.at} after ${took}: ${outcome.detail}`);

      // Awaited, so a caller can do its own per-set follow-up work — retiring a
      // superseded row, for instance — before the lane moves on.
      if (onSet) await onSet(record, say);
    }
  } finally {
    out.end();
    say(`lane finished — log: ${logPath}`);
  }
}

/**
 * Run the lanes, at most `workers` at a time.
 *
 * Returns one record per set: { step, outcome, took, lane, log }, in completion
 * order — a caller that prints them should sort back into plan order first.
 */
export async function runLanes({ lanes, workers, logsDir, stamp, labelOf, onSet = null, startedAt = Date.now() }) {
  mkdirSync(logsDir, { recursive: true });

  const results = [];
  const queue = [...lanes];

  // A worker pool over LANES rather than a batch per wave: each worker takes the
  // next lane as soon as it is free, so the pool stays full instead of idling on
  // the slowest lane of a batch.
  await Promise.all(
    Array.from({ length: laneWorkers(lanes, workers) }, async () => {
      while (queue.length) {
        const lane = queue.shift();
        if (lane) await runLane(lane, { logsDir, stamp, labelOf, onSet, startedAt, results });
      }
    })
  );

  return results;
}
