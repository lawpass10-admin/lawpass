"use strict";

// Data access for grading a writing-task submission.
//
// EVERY QUERY HERE RUNS UNDER THE SERVICE-ROLE CLIENT, and that is deliberate
// rather than convenient. The grader needs three things a student may not read
// (the rubric, our model answer, the writer-only question fields) in order to
// mark one thing a student owns (their answer), and it runs with no user session
// at all — a background worker has no token to scope. Authorization is therefore
// this file's own business: nothing here takes a user id from a caller, and the
// only row it ever writes is the answer row it was handed.

/**
 * Everything needed to mark one submission, in one round trip.
 *
 * Returns null when the answer does not exist, and a `blocked` reason when it
 * exists but cannot be marked — no approved rubric, most often. Those are
 * different outcomes: the first is a bad id, the second is a question nobody
 * finished setting up, and the worker reports them differently.
 */
async function getGradingContext(admin, answerId) {
  const { data: answer, error } = await admin
    .from("open_question_answers")
    .select(
      // hand_writing is here so the runner can tell an EMPTY submission from a
      // photographed one. Both have no text; only one of them is a mistake.
      "answer_id, user_id, open_question_id, answer_body, hand_writing, attempt_number, grading_status, score, created_at"
    )
    .eq("answer_id", answerId)
    .maybeSingle();

  if (error) throw error;
  if (!answer) return null;

  const { data: question, error: qErr } = await admin
    .from("open_questions")
    .select("open_question_id, question, answers, subject")
    .eq("open_question_id", answer.open_question_id)
    .maybeSingle();

  if (qErr) throw qErr;
  // Both `blocked` reasons carry a [category] tag. describeStoredFailure reads
  // the tag to decide what the student is told and whether a retry is offered;
  // untagged, a blocked answer was reported as an unexpected, retryable failure.
  if (!question) {
    return { answer, blocked: "[question_missing] the question this answer belongs to no longer exists" };
  }

  const { data: rubricRow, error: rErr } = await admin
    .from("open_question_rubrics")
    .select("rubric_id, rubric, version")
    .eq("open_question_id", answer.open_question_id)
    .eq("status", "approved")
    .maybeSingle();

  if (rErr) throw rErr;
  if (!rubricRow) {
    return {
      answer,
      question,
      blocked: "[no_rubric] this question has no approved rubric — generate one and load it with --approve",
    };
  }

  return {
    answer,
    question: question.question,
    modelAnswer: question.answers,
    rubric: rubricRow.rubric,
    rubricId: rubricRow.rubric_id,
    rubricVersion: rubricRow.version,
  };
}

/**
 * How long a claim is honoured before another worker may take it over.
 *
 * Must comfortably exceed a real marking run or a healthy grading gets stolen
 * and marked twice. Measured runs are 88-218 seconds, so 15 minutes is roughly
 * four times the worst observed case — long enough that only a dead worker
 * trips it, short enough that a student is not left waiting a shift.
 */
const CLAIM_LEASE_MINUTES = 15;

const leaseCutoff = (minutes) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

/**
 * Move one submission to `grading`, and report whether we got it.
 *
 * The status is part of the WHERE clause, not just the SET: two workers racing
 * for the same row both issue this update, and only the one that arrives while
 * the row still says `pending` gets a row back. The loser sees zero rows and
 * moves on rather than paying for a second marking of an answer already in hand.
 *
 * ── The lease ──────────────────────────────────────────────────────────────
 * A claim has to outlive the process that took it, or it would not prevent
 * anything — which means a worker killed mid-call leaves the row claimed
 * forever. `grading_started_at` bounds that: a claim older than the lease is
 * treated as abandoned and may be taken over here.
 *
 * Recovery is therefore AUTOMATIC. It used to require someone noticing and
 * running `--requeue-stale` by hand, which is the same as saying a stuck answer
 * stayed stuck until a human looked.
 *
 * The takeover is two separate statements rather than one `.or()` because a
 * PostgREST or-filter has to embed the timestamp in its own comma-separated
 * grammar, and that is a quoting bug waiting to happen for no gain — this path
 * only runs when a claim actually failed, which is rare.
 */
async function claimForGrading(admin, answerId, { leaseMinutes = CLAIM_LEASE_MINUTES } = {}) {
  const claim = {
    grading_status: "grading",
    grading_error: null,
    grading_started_at: new Date().toISOString(),
  };

  // The ordinary path: nobody holds it.
  const { data, error } = await admin
    .from("open_question_answers")
    .update(claim)
    .eq("answer_id", answerId)
    .eq("grading_status", "pending")
    .select("answer_id");

  if (error) throw error;
  if ((data ?? []).length > 0) return true;

  // Claimed by someone. Take it over only if the lease has run out — an
  // expired lease means the holder is gone, because a live worker's claim is
  // never this old.
  const { data: expired, error: expiredErr } = await admin
    .from("open_question_answers")
    .update(claim)
    .eq("answer_id", answerId)
    .eq("grading_status", "grading")
    .lt("grading_started_at", leaseCutoff(leaseMinutes))
    .select("answer_id");

  if (expiredErr) throw expiredErr;
  if ((expired ?? []).length > 0) return true;

  // Claimed before grading_started_at existed, so its age is unknowable. Those
  // rows are the pre-existing stuck ones — no live worker can be holding a
  // claim it never stamped.
  const { data: unstamped, error: unstampedErr } = await admin
    .from("open_question_answers")
    .update(claim)
    .eq("answer_id", answerId)
    .eq("grading_status", "grading")
    .is("grading_started_at", null)
    .select("answer_id");

  if (unstampedErr) throw unstampedErr;
  return (unstamped ?? []).length > 0;
}

/** Oldest first — a student who submitted an hour ago waited longest. */
async function listPendingAnswers(admin, limit = 20) {
  const { data, error } = await admin
    .from("open_question_answers")
    .select("answer_id, open_question_id, attempt_number, created_at")
    .eq("grading_status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Rows stuck in `grading` because the worker died mid-call.
 *
 * MEASURED FROM grading_started_at, NOT created_at. It used to use created_at —
 * the submission time — which is the wrong clock in both directions: an answer
 * submitted hours ago and claimed seconds ago looked stale at once (releasing a
 * healthy run, so it got marked and paid for twice), while a fresh submission
 * that genuinely hung stayed invisible until 15 minutes after submission rather
 * than 15 minutes after it stuck.
 *
 * A NULL stamp counts as stale: the row was claimed before the column existed,
 * so its age cannot be known, and a live worker would have stamped it.
 *
 * Claims now expire on their own inside claimForGrading, so this is no longer
 * the only route back — it remains for `--requeue-stale`, which is how you see
 * and clear a backlog deliberately rather than one row at a time.
 */
async function listStaleClaims(admin, olderThanMinutes = CLAIM_LEASE_MINUTES) {
  const cutoff = leaseCutoff(olderThanMinutes);
  const { data, error } = await admin
    .from("open_question_answers")
    .select("answer_id, created_at, grading_started_at")
    .eq("grading_status", "grading")
    .order("created_at", { ascending: true });

  if (error) throw error;
  // Filtered here rather than in the query so the NULL case and the age case
  // read as one rule. The candidate set is every row currently grading, which
  // is a handful at any moment however large the table gets.
  return (data ?? []).filter(
    (row) => !row.grading_started_at || row.grading_started_at < cutoff
  );
}

async function releaseClaim(admin, answerId) {
  const { error } = await admin
    .from("open_question_answers")
    // Cleared with the status: a stamp left on a row that is no longer grading
    // would make the next reclaim scan read a stale age.
    .update({ grading_status: "pending", grading_started_at: null })
    .eq("answer_id", answerId)
    .eq("grading_status", "grading");
  if (error) throw error;
}

async function saveScore(admin, answerId, { score, rubricId }) {
  const { error } = await admin
    .from("open_question_answers")
    .update({
      score,
      grading_status: "graded",
      graded_at: new Date().toISOString(),
      graded_with_rubric_id: rubricId,
      grading_error: null,
      // The claim is over. Left set, the row would carry an age that means
      // nothing and could be misread by a future reclaim scan.
      grading_started_at: null,
    })
    .eq("answer_id", answerId);

  if (error) throw error;
}

/**
 * The answer text stays; only the marking failed. A failed row is retryable by
 * moving it back to `pending`, which is why the message is stored rather than
 * just logged — whoever retries needs to know what went wrong last time.
 */
async function markGradingFailed(admin, answerId, message) {
  const { error } = await admin
    .from("open_question_answers")
    .update({
      grading_status: "failed",
      grading_error: String(message || "unknown error").slice(0, 2000),
      grading_started_at: null,
    })
    .eq("answer_id", answerId);

  if (error) throw error;
}

/**
 * Put a failed submission back in the queue, and report whether it moved.
 *
 * `failed` is in the WHERE clause for the same reason `pending` is in
 * claimForGrading's: two retry clicks racing each other both issue this update,
 * and only the first finds the row still failed. The second changes nothing, so
 * one click is one marking run however many requests arrive.
 *
 * The old error is cleared with the status. The new run writes its own if it
 * fails too, and a stale reason left on a row that is grading again would be
 * reported to the student as the reason for a failure that has not happened.
 */
async function requeueFailed(admin, answerId) {
  const { data, error } = await admin
    .from("open_question_answers")
    .update({ grading_status: "pending", grading_error: null, grading_started_at: null })
    .eq("answer_id", answerId)
    .eq("grading_status", "failed")
    .select("answer_id");

  if (error) throw error;
  return (data ?? []).length > 0;
}

module.exports = {
  CLAIM_LEASE_MINUTES,
  getGradingContext,
  claimForGrading,
  listPendingAnswers,
  listStaleClaims,
  releaseClaim,
  requeueFailed,
  saveScore,
  markGradingFailed,
};
