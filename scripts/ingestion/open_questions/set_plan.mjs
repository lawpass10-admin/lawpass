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

/** The plan, before a single token is spent. */
export function plan(count, sources) {
  const claimed = new Set();
  return Array.from({ length: count }, (_, i) => {
    const source = sources[i % sources.length];
    return { n: i + 1, source, angle: nextAngle(source.id, claimed) };
  });
}
