-- Stop a candidate rewriting their own exam result and their own clock.
--
-- THE HOLE, and it is the same shape as 20261001000009 on profiles: a FOR ALL
-- policy over a row the user owns, sitting on a table-wide GRANT.
--
--   20260503000014:50  GRANT SELECT, INSERT, UPDATE, DELETE ON exam_sessions
--                      TO authenticated;
--   20260503000005     CREATE POLICY "users_own_exam_sessions" ON exam_sessions
--                        FOR ALL USING ((SELECT auth.uid()) = user_id
--                                       AND public.has_active_subscription());
--
-- The policy is right about the ROW and silent about the COLUMNS, so the person
-- being examined could PATCH their own session:
--
--   final_score, passed, questions_correct   → award yourself a pass
--   started_at, total_paused_seconds         → unlimited time
--   status                                   → reopen a finished sitting
--
-- `started_at` is the sharp one. Migration 20260927000001 moved the timer onto
-- wall-clock arithmetic and made `started_at` the authority precisely so a
-- reload could not rewind the clock. That only holds while the candidate cannot
-- write the column, and until now they could — the fix moved the authority onto
-- a field its subject controlled.
--
-- `attempts` had the same grant and the same FOR ALL policy, so answer history
-- — and every dashboard statistic, mastery score and materialized view built on
-- it — could be rewritten after the fact.
--
-- WHY THIS IS SAFE FOR GAMEPLAY. Every function that writes these two tables is
-- SECURITY DEFINER and therefore runs with its owner's privileges, untouched by
-- the grants below. All of them were checked before this was written:
--   exam_sessions:  increment_exam_session_counters, submit_exam_answer,
--                   bump_exam_session_time (pause), resume_exam_session,
--                   submit_final_exam
--   attempts:       record_exam_attempt, submit_exam_answer, submit_final_exam
-- Answering, skipping, pausing, resuming and submitting therefore keep working.
-- What stops working is writing those columns from outside the RPCs.
--
-- WHAT THE APP STILL WRITES DIRECTLY, which is where the grant lists come from:
--   app/(app)/exam/_actions.ts:91,163  + exam.controller.js:48,102
--       status, last_activity_at                    (abandon an old sitting)
--   app/(app)/exam/_actions.ts:103     + exam.controller.js:57
--       user_id, question_list, total_duration_seconds, time_used_seconds,
--       status, active_window_token, mode           (start an exam)
--   app/(app)/exam/_actions.ts:567     + exam.controller.js:360
--       active_window_token, last_activity_at       (claim the window)
--   practice/play/_actions.ts:148      + practice.controller.js:560
--       the eleven attempt columns below            (file a practice answer)
--
-- NOT DESTRUCTIVE: no row, column or policy is dropped. Privileges narrow and
-- one CHECK is added. Re-runnable.

-- ── exam_sessions ────────────────────────────────────────────────────────────

-- DELETE is revoked and not given back. No DELETE policy exists for users, so
-- RLS was already refusing it; the grant should not outlive the policy that
-- happens to be covering for it.
REVOKE INSERT, UPDATE, DELETE ON public.exam_sessions FROM authenticated;

-- Starting an exam. `final_score`, `passed`, `questions_correct`,
-- `questions_answered`, `started_at`, `paused_at`, `completed_at` and
-- `total_paused_seconds` are all absent: a forged session can therefore only
-- ever begin now, empty and unscored, which is the same thing a real one does.
GRANT INSERT (
  user_id,
  question_list,
  total_duration_seconds,
  time_used_seconds,
  status,
  active_window_token,
  mode
) ON public.exam_sessions TO authenticated;

-- Abandoning a sitting and claiming the window. Three columns, none of which
-- carries a result or a time.
--
-- `active_window_token` stays writable on purpose — claim-window is a
-- last-tab-wins UX guard against two open tabs, not an integrity control, and
-- the app rotates the token on every claim.
GRANT UPDATE (
  status,
  last_activity_at,
  active_window_token
) ON public.exam_sessions TO authenticated;

-- `total_duration_seconds` is still named by the INSERT above, so it is still
-- client-supplied, and "start a 10-hour exam" is the same cheat as moving
-- `started_at` by another route. Every exam the app creates uses
-- EXAM_TOTAL_DURATION_SECONDS (6000, lib/exam/clusters.ts:148); the bound below
-- is deliberately far wider than that so a future shorter or longer paper does
-- not need a migration, while still refusing an absurd one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.exam_sessions'::regclass
       AND conname  = 'exam_sessions_duration_sane'
  ) THEN
    ALTER TABLE public.exam_sessions
      ADD CONSTRAINT exam_sessions_duration_sane
      CHECK (total_duration_seconds BETWEEN 60 AND 21600);
  END IF;
END
$$;

-- ── attempts ─────────────────────────────────────────────────────────────────

-- NO UPDATE AND NO DELETE, GIVEN BACK TO NOBODY. An attempt is a record of what
-- happened; nothing in the app has ever updated or deleted one (verified across
-- app/, lib/ and lawpass_server/), and an answer history that can be edited
-- after the fact is not a history. Soft-removal of a mistake is a write to
-- `mistakes`, not to this table.
REVOKE INSERT, UPDATE, DELETE ON public.attempts FROM authenticated;

-- Filing a practice answer. `exam_session_id` is deliberately NOT here: exam
-- attempts are written only by record_exam_attempt and submit_exam_answer,
-- both SECURITY DEFINER, so leaving it out costs nothing and stops an attempt
-- being attached to an exam sitting from outside those functions.
GRANT INSERT (
  user_id,
  question_type,
  source_question_id,
  angle_question_id,
  selected_choice_id,
  selected_letter,
  is_correct,
  mode,
  practice_session_id,
  duration_seconds,
  was_skipped
) ON public.attempts TO authenticated;

-- SELECT is unchanged on both tables: the existing policies are the right
-- boundary for reads.
--
-- WHAT THIS DOES NOT FIX, recorded so it is not mistaken for covered:
-- `is_correct` is still client-supplied on a practice insert. The server
-- actions compute it, but a direct PostgREST call can assert it, so a
-- determined user can still file a correct-looking practice answer. Closing
-- that means moving the practice insert into an RPC that marks the answer
-- itself, the way the exam path already does — a larger change than this one,
-- and on a P1 flow.
