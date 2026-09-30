/**
 * One law's line in a subject's aggregate.
 *
 * Produced by lawpass_server/db/subject-stats.js (`getTopicStats`) and drawn by
 * the two charts under each dashboard tab: the pie reads `questions`, the bar
 * reads `percent`.
 *
 * `correct` is null for the writing task, where an answer is scored out of
 * points rather than marked right or wrong — the bar derives its remainder from
 * `percent` in that case rather than from a count.
 */
export type TopicStat = {
  topic: string;
  /** Questions answered in this law. */
  questions: number;
  /** Questions answered correctly. Null for the writing task. */
  correct: number | null;
  /** Average score in this law, 0-100, one decimal. */
  percent: number;
  /**
   * The same average in raw points, out of `SubjectTopics.pointsMax`.
   *
   * Only the writing task carries it — a multiple-choice answer is right or
   * wrong, not worth points — so it is optional rather than nullable: the two
   * exam subjects simply do not send the field.
   */
  points?: number;
  /**
   * The mark THIS row was scored out of, where rows differ from each other.
   *
   * Only the rubric breakdown of a single מטלת כתיבה sets it: תוכן is out
   * of 12 and לשון out of 4, so the two cannot be read against one ceiling.
   * Its presence on every row is what switches the charts into that view — the
   * pie sizes its slices by points scored rather than by questions answered,
   * and each bar runs to its own maximum.
   */
  pointsMax?: number;
};

/**
 * One sitting of a paper, with its own per-law breakdown.
 *
 * `index` is the candidate's own 1-based sitting number for the subject, in the
 * order they sat them — what "מבחן ראשון / שני / …" counts. It is deliberately
 * NOT `attemptOfPaper`, which counts sittings of ONE paper and therefore repeats
 * across papers: two different exams would both call themselves "מבחן ראשון".
 */
export type TopicSitting = {
  index: number;
  /** The stored per-paper attempt number, kept for the label's detail line. */
  attemptOfPaper: number | null;
  questionId: string;
  /** The sitting's headline score as a percentage. */
  score: number | null;
  /**
   * The same score in points, out of `pointsMax` — a marked מטלת כתיבה only.
   * The picker names a task by the mark it was given, which is the number on
   * the marked answer (15.5 נק') rather than a percentage of it.
   */
  points?: number;
  pointsMax?: number;
  /**
   * What this sitting is called — for a מטלת כתיבה, the law it was set on.
   *
   * The only name the task has: `open_questions` carries a subject, not a
   * title. Shown in the picker beside the ordinal and on the chart card, so a
   * candidate reading one task's breakdown can see WHICH task without going
   * back to the list.
   */
  title?: string;
  createdAt: string | null;
  rows: TopicStat[];
};

/**
 * A subject's charts data: the whole history, plus each sitting on its own.
 *
 * Both come from one pass over the same answers on the server, so a sitting's
 * rows can never disagree with the total they are part of.
 */
export type SubjectTopics = {
  all: TopicStat[];
  /**
   * One entry per sitting, oldest first — for the writing task, one per marked
   * answer, numbered as the card's trend line numbers them.
   *
   * What a chosen entry's `rows` hold differs by subject, because the two
   * things break down differently: an exam paper into the areas of law it
   * covered, a written answer into the three things it was marked on (תוכן,
   * לשון, ארגון). Picking one law out of a single written task would be a
   * pie with one slice in it.
   *
   * Empty `rows` on a writing entry means that answer was marked before the
   * per-dimension breakdown was stored — the charts show their empty state
   * rather than a task that scored zero on everything.
   */
  sittings: TopicSitting[];
  /**
   * The three rubric metrics averaged over EVERY marked answer — what the
   * candidate scores in תוכן, in לשון, in ארגון across their whole
   * history, each out of its own `pointsMax`.
   *
   * The score chart draws these in the whole-history view, where the pie beside
   * it still breaks the practice down by law: the two cards answer different
   * questions there — which laws have been practised, and which part of writing
   * is weakest — so they no longer share a vocabulary.
   *
   * Empty for the two exam subjects, which have no rubric.
   */
  dimensions: TopicStat[];
  /**
   * The mark every answer was scored out of, when they all share one — 20 for
   * the writing task. The score chart draws points against it instead of
   * percentages; null (both exam subjects, or a history marked out of differing
   * totals) keeps it on percentages. Same rule as `SubjectStat.pointsMax`.
   */
  pointsMax: number | null;
};

/** The three tabs, in the order the dashboard shows them. */
export type SubjectKey = "mahoti" | "diuni" | "writing";

export type TopicStatsBySubject = Record<SubjectKey, SubjectTopics>;
