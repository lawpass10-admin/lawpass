-- display_name on attempts, completing 20260909000001.
--
-- That migration deliberately skipped this table and explained why; this one
-- adds it at the founder's request. The reasoning is recorded rather than
-- reversed, because the trade-off is real but is about SCALE, and the scale is
-- not here yet:
--
--   measured 2026-09-09 — attempts: 1,089 rows, busiest candidate 486.
--
-- A rename rewrites that candidate's rows only, through idx_attempts_user, so
-- today it is a few hundred indexed updates inside a profile edit. CLAUDE.md
-- projects this table at tens of millions of rows, and at THAT size the same
-- statement becomes a multi-thousand-row UPDATE inside a user's own request,
-- plus the name stored tens of millions of times.
--
-- What to do when that day comes — do not discover it under load:
--   * drop trg_fill_display_name from attempts and read the name via JOIN, or
--   * keep the column but move the rename sync out of the request path, into
--     a queued job.
-- The read path (SELECT display_name) does not change in either case, so this
-- is reversible without touching application code.
--
-- attempts is NOT added to the answers_with_name view. That view is the three
-- exam subjects, which share a shape: one question_id and one score. An
-- attempt has source_question_id OR angle_question_id and is_correct rather
-- than a percentage; forcing it in would mean inventing a score that does not
-- exist.

-- Nullable, for the same reason as the other three: a backfill cannot invent a
-- name for a row whose profile is gone.
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.attempts.display_name IS
  'Candidate name, copied from profiles.full_name by trigger. Never written by '
  'the application. See 20260909000002 for the scale caveat.';

UPDATE public.attempts a
   SET display_name = p.full_name
  FROM public.profiles p
 WHERE p.id = a.user_id
   AND (a.display_name IS NULL OR a.display_name = '');

-- Reuses the function from 20260909000001 unchanged: it reads NEW.user_id and
-- writes NEW.display_name, naming no table, so it fits any table with those
-- two columns.
DROP TRIGGER IF EXISTS trg_fill_display_name ON public.attempts;
CREATE TRIGGER trg_fill_display_name
  BEFORE INSERT ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.fill_answer_display_name();

-- Extend the rename sync to cover the fourth table. Replaced whole because
-- CREATE OR REPLACE FUNCTION takes the entire body — a function defined in two
-- places would drift.
CREATE OR REPLACE FUNCTION public.sync_answer_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.mahoti_answers
     SET display_name = NEW.full_name
   WHERE user_id = NEW.id AND display_name IS DISTINCT FROM NEW.full_name;

  UPDATE public.diuni_answers
     SET display_name = NEW.full_name
   WHERE user_id = NEW.id AND display_name IS DISTINCT FROM NEW.full_name;

  UPDATE public.open_question_answers
     SET display_name = NEW.full_name
   WHERE user_id = NEW.id AND display_name IS DISTINCT FROM NEW.full_name;

  -- The expensive one at scale. Driven by idx_attempts_user, and the
  -- IS DISTINCT FROM guard means a no-op rename touches nothing.
  UPDATE public.attempts
     SET display_name = NEW.full_name
   WHERE user_id = NEW.id AND display_name IS DISTINCT FROM NEW.full_name;

  RETURN NEW;
END;
$$;
