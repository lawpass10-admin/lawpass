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
  /**
   * Still produced by the server, and no longer drawn: the card's three
   * summary figures were replaced by the chart itself, which shows every score
   * rather than three of them.
   */
  average: number | null;
  lowest: number | null;
  highest: number | null;
  /**
   * The mark every sitting was scored out of, when they all share one — 20 for
   * the writing task (4 לשון + 4 ארגון + 12 תוכן).
   *
   * Set only where a points scale exists and is the SAME for every sitting: the
   * card then plots `exams[].points` against it, so a candidate reads the number
   * the exam gave them (15.5) rather than a percentage of it (77.5%). Null for
   * the two multiple-choice subjects, which have no points, and null the moment
   * two sittings were marked out of different totals — one axis cannot honestly
   * carry both. The chart falls back to the percentage in that case.
   */
  pointsMax: number | null;
  /**
   * Every scored sitting, OLDEST FIRST — the series the card's chart plots, one
   * point per exam. An index in this array is the exam's number on the x-axis
   * ("מבחן 3" is `exams[2]`), which is why the server orders its reads by
   * created_at rather than leaving the row order to the database.
   *
   * `date` is the sitting's `created_at`, printed under its point. Null where a
   * row carries none, which the chart leaves unlabelled rather than guessing.
   *
   * Empty for a subject with no scored sitting; never null, so the chart can
   * branch on length alone.
   */
  exams: {
    score: number;
    date: string | null;
    /** Points awarded, out of `pointsMax`. Null where the subject has none. */
    points: number | null;
  }[];
};
