/**
 * One subject's line in the score table.
 *
 * Produced by the server (lawpass_server/lib/marking/topic-breakdown.js) and
 * rendered identically by /mahoti and /diuni. Declared here rather than in
 * either feature's API module because both import it and neither owns it — the
 * shape is the contract between the marking on the server and the one modal
 * that draws it.
 *
 * `topic` is the law the question was built from (mahoti, and diuni's
 * statute-grounded questions) or the judgment's area of practice (diuni's
 * judgment-grounded ones). Questions whose source carries no subject arrive
 * grouped under a single "ללא סיווג" row rather than being guessed at.
 */
export type TopicScore = {
  topic: string;
  correct: number;
  total: number;
  /** correct/total as a percentage, one decimal — 3/4 -> 75. */
  percent: number;
};
