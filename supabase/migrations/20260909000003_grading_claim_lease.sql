-- grading_started_at — when the claim was taken, so a dead worker's claim expires.
--
-- ── The bug this fixes ─────────────────────────────────────────────────────
-- Grading claims a row by setting grading_status = 'grading', and that claim is
-- what stops two workers marking the same answer twice. It has to outlive the
-- process that took it, so nothing releases it automatically — a worker killed
-- mid-call leaves the row saying 'grading' forever, and the student watches a
-- spinner that will never stop.
--
-- There IS a recovery path (listStaleClaims / --requeue-stale), but it measured
-- staleness against created_at — the SUBMISSION time. That is the wrong clock
-- and it fails in both directions:
--
--   * an answer submitted two hours ago and claimed ten seconds ago looks stale
--     immediately, so a healthy run in progress gets released and re-graded —
--     a double marking, and double the spend, on a run that was fine;
--   * a fresh submission that genuinely hangs is invisible until 15 minutes
--     after it was SUBMITTED, not 15 minutes after it got stuck.
--
-- created_at cannot answer "how long has this been grading" because it does not
-- know when grading started. This column does.
--
-- NULLABLE, and NULL means "claimed before this column existed" — treated as
-- expired by the reclaim logic, because a row sitting in 'grading' from before
-- this migration is exactly the stuck row we are trying to recover.

ALTER TABLE public.open_question_answers
  ADD COLUMN IF NOT EXISTS grading_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.open_question_answers.grading_started_at IS
  'When the current grading claim was taken. Set by claimForGrading, cleared on '
  'every terminal state. A claim older than the lease is reclaimable — see '
  'lawpass_server/db/grading.js. NULL while not grading.';

-- Partial index: the reclaim scan asks only about rows currently grading, which
-- is a handful at any moment out of a table that grows without bound. Indexing
-- just that slice keeps the scan cheap and the index tiny.
CREATE INDEX IF NOT EXISTS idx_open_question_answers_grading_lease
  ON public.open_question_answers (grading_started_at)
  WHERE grading_status = 'grading';

-- Rows already stuck in 'grading' keep grading_started_at = NULL and are
-- therefore reclaimable immediately, which is the intended behaviour: they are
-- the backlog this migration exists to clear.
