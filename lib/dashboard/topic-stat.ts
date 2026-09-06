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
  /** The sitting's headline score, as stored on the row. */
  score: number | null;
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
  /** Empty for the writing task — it has answers, not sittings. */
  sittings: TopicSitting[];
};

/** The three tabs, in the order the dashboard shows them. */
export type SubjectKey = "mahoti" | "diuni" | "writing";

export type TopicStatsBySubject = Record<SubjectKey, SubjectTopics>;
