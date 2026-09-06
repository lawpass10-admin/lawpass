/**
 * One subject square on the personal dashboard.
 *
 * Produced by lawpass_server/db/subject-stats.js and rendered by
 * app/(app)/dashboard/_components/subject-stats-row.tsx.
 *
 * `average`, `lowest` and `highest` are NULL when the candidate has no scored
 * attempt in that subject. Null is not zero — a subject never sat has no
 * average, and rendering it as 0% would show the candidate a failure they never
 * earned. The card draws a dash for null.
 */
export type SubjectStat = {
  key: "mahoti" | "diuni" | "writing";
  label: string;
  /** Where the card links to — the study surface for that subject. */
  href: string;
  /** Scored sittings. For the writing task, graded answers. */
  attempts: number;
  /** Questions actually answered — not papers opened, not questions skipped. */
  questions: number;
  average: number | null;
  lowest: number | null;
  highest: number | null;
};
