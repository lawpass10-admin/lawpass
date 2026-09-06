"use strict";

// attempt-numbering.js — is `attempts` numbered the way both answer tables
// promise it is?
//
// THE INVARIANT, and what it is NOT. Re-sitting is supported: neither
// mahoti_answers nor diuni_answers has a unique constraint on
// (user_id, question_id), and neither caps `attempts`. Sitting one paper five
// times is correct behaviour, and this audit must never report it.
//
// What it checks is that for ONE candidate on ONE paper the numbers run
// 1, 2, 3 … — no gaps, no repeats, no zero. That sequence is assigned by a
// database trigger (MAX+1 under an advisory lock per student+paper), and a
// break in it fails quietly rather than loudly: two sittings both labelled
// "מבחן שני" in the dashboard's picker, or a hole where a sitting should be.
//
// Shared by the unit tests and by scripts/check-attempt-numbering.mjs, so the
// rule is written once and the live database is judged by the same code the
// fixtures are.

/**
 * @param {{user_id: string, question_id: string, attempts: number,
 *          answer_score?: number}[]} rows
 * @returns {{ problems: string[], pairs: number, rows: number }}
 */
function auditAttemptNumbering(rows) {
  const problems = [];
  const byPair = new Map();

  for (const row of rows ?? []) {
    const key = `${row.user_id}|${row.question_id}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(row);

    const score = Number(row.answer_score);
    if (row.answer_score !== null && row.answer_score !== undefined) {
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        problems.push(
          `${short(row.user_id)}/${short(row.question_id)}: score ${row.answer_score} is outside 0-100`
        );
      }
    }
  }

  for (const [key, group] of byPair) {
    const [user, question] = key.split("|");
    const label = `${short(user)}/${short(question)}`;
    const numbers = group.map((r) => Number(r.attempts)).sort((a, b) => a - b);

    for (const n of numbers) {
      if (!Number.isInteger(n) || n < 1) {
        problems.push(`${label}: attempt number ${n} is not a positive integer`);
      }
    }

    const seen = new Set();
    for (const n of numbers) {
      if (seen.has(n)) problems.push(`${label}: attempt ${n} is repeated`);
      seen.add(n);
    }

    const valid = numbers.filter((n) => Number.isInteger(n) && n >= 1);
    if (valid.length === 0) continue;

    if (valid[0] !== 1) {
      problems.push(`${label}: numbering does not start at 1 (starts at ${valid[0]})`);
    }
    // Gaps are checked over the DEDUPED sequence: a repeat is already reported
    // above, and letting it also register as a gap would name one fault twice.
    const unique = [...new Set(valid)].sort((a, b) => a - b);
    for (let i = 1; i < unique.length; i++) {
      if (unique[i] !== unique[i - 1] + 1) {
        problems.push(
          `${label}: gap in numbering — ${unique[i - 1]} is followed by ${unique[i]}`
        );
      }
    }
  }

  return { problems, pairs: byPair.size, rows: (rows ?? []).length };
}

const short = (id) => String(id ?? "").slice(0, 8);

module.exports = { auditAttemptNumbering };
