// set_plan.mjs — which source paper and which angle each set of a run uses.
//
// Extracted from generate_sets.mjs so the sequential runner and the batched one
// plan runs identically. This is not incidental: the plan decides which paper a
// set is written from and which angle letter its files are named with, so two
// runners with two copies of it would eventually allocate the same letter twice
// and have one set silently overwrite another's output.
//
// No side effects on import — nothing here reads argv, prompts, or writes.

import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = join(here, 'answers', 'pages');
const generatedDir = join(here, 'generated');

/**
 * Every bundle that can drive generation, newest sitting first.
 *
 * Ordering comes off the external_id (2026-S-Q1), not the folder name, which is
 * inconsistent — the 2026 papers sit in q1-answer/q2-answer while the rest carry
 * their year. Within a year the summer sitting (S/קיץ) is the later one, so it
 * ranks above winter (W/חורף).
 */
export function rotation() {
  const entries = [];

  for (const dir of readdirSync(pagesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const questionPath = join(pagesDir, dir.name, 'question.json');
    if (!existsSync(questionPath)) continue; // rubric/ holds an answer only

    const bundle = JSON.parse(readFileSync(questionPath, 'utf8'));
    const id = bundle.external_id;
    const m = /^(\d{4})-([SW])-Q(\d+)$/.exec(id ?? '');
    if (!m) {
      console.warn(`  ignoring ${dir.name}: external_id "${id}" is not <year>-<S|W>-Q<n>`);
      continue;
    }
    entries.push({
      folder: dir.name,
      id,
      year: Number(m[1]),
      season: m[2],
      number: Number(m[3]),
      subject: bundle.subject ?? null,
    });
  }

  return entries.sort(
    (a, b) =>
      b.year - a.year ||
      (a.season === b.season ? 0 : a.season === 'S' ? -1 : 1) ||
      a.number - b.number
  );
}

/**
 * The next angle letter free for a source, counting what is already on disk AND
 * what this run has already allocated. Reusing a letter would have the question
 * generator overwrite the earlier angle's files.
 */
export function nextAngle(sourceId, claimed) {
  const onDisk = new Set(
    readdirSync(generatedDir)
      .map((f) => new RegExp(`^${sourceId}-([A-Z])\\.(generated|answer)\\.json$`).exec(f)?.[1])
      .filter(Boolean)
  );
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const key = `${sourceId}-${letter}`;
    if (!onDisk.has(letter) && !claimed.has(key)) {
      claimed.add(key);
      return letter;
    }
  }
  throw new Error(`${sourceId} already has angles A-Z — nothing left to allocate`);
}

/**
 * A seeded pseudo-random generator — mulberry32.
 *
 * Seeded rather than Math.random so a run can be reproduced. When a set comes
 * out wrong, "which paper did set 7 use" has to be answerable afterwards, and
 * with an unseeded shuffle the only record is whatever the log happened to
 * print. The seed is reported by the runner and can be passed back in.
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, on a copy. */
function shuffled(list, next) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The plan, before a single token is spent.
 *
 * THREE WAYS TO CHOOSE THE SOURCES, and the difference is not order but coverage.
 *
 *   pick: "spread"       (default) Shuffle the whole list and walk it; reshuffle
 *                        on each wrap. The ORDER is random and the COVERAGE is
 *                        even — every source is used once before any is used
 *                        twice. A run of ten over ten bundles therefore touches
 *                        each paper exactly once, which looks systematic from
 *                        outside even though the order and the angle letters
 *                        differ every run.
 *
 *   pick: "independent"  Draw a source at random for every set, independently.
 *                        This is random in the everyday sense, and it clusters:
 *                        over ten sets expect six or seven distinct papers, one
 *                        of them taken three times, and three or four never
 *                        touched at all.
 *
 *   pick: "subject"      Spread across SUBJECTS rather than papers: shuffle the
 *                        distinct subjects, take one paper from each in turn, and
 *                        rotate within a subject so its papers are used evenly
 *                        too.
 *
 *   random: false        The old newest-first walk. Still the right choice when
 *                        you want the newest sittings covered first, predictably.
 *
 * WHY "subject" EXISTS, AND WHY "spread" IS NOT ENOUGH. Papers and subjects are
 * not the same thing, and in this corpus they are badly out of step: five of the
 * ten bundles carry תקנות סדר הדין האזרחי. So "spread", which touches every paper
 * once, still puts half of a ten-set run on that one subject — it buys breadth of
 * PAPER and nothing else. A candidate revising across the syllabus feels subjects,
 * not source documents, so a run meant to broaden the question bank wants this
 * mode.
 *
 * NO MODE IS SIMPLY BEST. "subject" buys breadth of legal area. "spread" buys
 * even use of the source material. "independent" buys genuine unpredictability,
 * at the cost of leaving part of the corpus untouched in any given run.
 *
 * `excludeSubjects` drops any bundle whose subject contains one of the given
 * strings — a substring match, because these subjects come off PDFs and their
 * punctuation is not reliably identical. It applies before every mode.
 *
 * All modes are reproducible from the seed, which the runner prints.
 */
export function plan(
  count,
  sources,
  { random = true, seed = Date.now(), pick = 'spread', excludeSubjects = [] } = {}
) {
  if (!['spread', 'independent', 'subject'].includes(pick)) {
    throw new Error(`unknown pick mode "${pick}" — expected "spread", "independent" or "subject"`);
  }

  const usable = sources.filter(
    (s) => !excludeSubjects.some((x) => String(s.subject ?? '').includes(x))
  );
  if (!usable.length) {
    throw new Error(
      `every source was excluded — ${sources.length} bundle(s) all match one of: ` +
        excludeSubjects.map((x) => `"${x}"`).join(', ')
    );
  }

  const claimed = new Set();
  const next = rng(seed);

  // Pre-build the order for every set, so the whole plan can be printed and
  // approved before a single token is spent.
  const order = [];
  if (!random) {
    while (order.length < count) order.push(...usable);
  } else if (pick === 'independent') {
    for (let i = 0; i < count; i++) order.push(usable[Math.floor(next() * usable.length)]);
  } else if (pick === 'subject') {
    // One bucket per subject, each bucket shuffled once so a subject's papers are
    // used evenly but not in a fixed order.
    const buckets = new Map();
    for (const s of usable) {
      const key = String(s.subject ?? '(no subject)');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(s);
    }
    for (const [key, papers] of buckets) buckets.set(key, shuffled(papers, next));

    const cursor = new Map([...buckets.keys()].map((k) => [k, 0]));
    while (order.length < count) {
      for (const key of shuffled([...buckets.keys()], next)) {
        if (order.length >= count) break;
        const papers = buckets.get(key);
        const i = cursor.get(key);
        order.push(papers[i % papers.length]);
        cursor.set(key, i + 1);
      }
    }
  } else {
    while (order.length < count) order.push(...shuffled(usable, next));
  }

  return Array.from({ length: count }, (_, i) => {
    const source = order[i];
    return { n: i + 1, source, angle: nextAngle(source.id, claimed) };
  });
}
