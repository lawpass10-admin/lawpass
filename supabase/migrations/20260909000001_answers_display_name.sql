-- display_name on the answer tables — the candidate's name alongside user_id.
--
-- Applies to mahoti_answers, diuni_answers and open_question_answers.
--
-- ── This is a deliberate duplicate, handled the way the last one was ───────
-- The name already exists, once, on profiles.full_name. Copying it onto every
-- answer row is denormalisation, and the cost of denormalisation is always the
-- same: the copy goes stale. 20260827000001 made exactly this trade for
-- profiles.user_email and wrote down the rule that makes it safe — the copy is
-- maintained by the DATABASE, never by the app, so an insert cannot disagree
-- with the source because it is not asked what to write.
--
-- The same two triggers appear here, and they are the two that migration
-- needed (the second of which was missing until 20260907000003, which is worth
-- remembering — a sync trigger on UPDATE alone silently never fires for new
-- rows):
--
--   1. BEFORE INSERT on each answer table  — fill it as the row is written
--   2. AFTER UPDATE OF full_name on profiles — follow a later rename
--
-- ── Why NOT `attempts` ─────────────────────────────────────────────────────
-- `attempts` is the other table that stores answers, so "all the answer
-- tables" arguably includes it. It is deliberately left out. CLAUDE.md sizes
-- it at tens of millions of rows, and at that size this pattern turns bad:
-- the name is duplicated tens of millions of times, and trigger 2 rewrites
-- every row a renaming candidate owns — one profile edit becoming a
-- multi-thousand-row UPDATE inside the user's own request. For that table a
-- JOIN to profiles is the right answer. Say the word if you want it anyway.
--
-- ── Column position ────────────────────────────────────────────────────────
-- Postgres appends; ADD COLUMN cannot place display_name physically beside
-- user_id, and reordering means rebuilding the table. It lands last. If what
-- you want is the two side by side when reading, that is the SELECT list — or
-- the view at the bottom of this file, which spells the order out.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The column, the backfill, and the insert trigger — same three steps per
--    table, so written once and looped rather than copied three times.
-- ─────────────────────────────────────────────────────────────────────────────

-- Shared by all three insert triggers. SECURITY DEFINER because the row may be
-- written by a role that cannot read the profiles row it needs: RLS on
-- profiles is "your own row only", and an admin or service path inserting on
-- someone's behalf is not that person. search_path pinned, as for any definer
-- function.
CREATE OR REPLACE FUNCTION public.fill_answer_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only when the caller did not supply one, so an explicit value is never
  -- overwritten.
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    SELECT p.full_name INTO NEW.display_name
      FROM public.profiles p
     WHERE p.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fill_answer_display_name() IS
  'Copies profiles.full_name into <table>.display_name as the answer row is '
  'created. Paired with trg_sync_answer_display_name on profiles, which '
  'follows later renames.';

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mahoti_answers', 'diuni_answers', 'open_question_answers']
  LOOP
    -- NULLABLE on purpose. A backfill cannot invent a name for a row whose
    -- profile is gone, and NOT NULL over live data would fail the migration
    -- rather than tell you which rows are the problem.
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS display_name TEXT', t);

    EXECUTE format($f$
      COMMENT ON COLUMN public.%I.display_name IS
        'Candidate name, copied from profiles.full_name by trigger. Never '
        'written by the application. Read-only for display and export.'
    $f$, t);

    -- Backfill existing rows.
    EXECUTE format($f$
      UPDATE public.%I a
         SET display_name = p.full_name
        FROM public.profiles p
       WHERE p.id = a.user_id
         AND (a.display_name IS NULL OR a.display_name = '')
    $f$, t);

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_fill_display_name ON public.%I', t);
    EXECUTE format($f$
      CREATE TRIGGER trg_fill_display_name
        BEFORE INSERT ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.fill_answer_display_name()
    $f$, t);
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Follow a rename
-- ─────────────────────────────────────────────────────────────────────────────

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_answer_display_name ON public.profiles;
-- UPDATE OF full_name, so an unrelated profile edit — a phone number, an exam
-- date — does not touch the answer tables at all.
CREATE TRIGGER trg_sync_answer_display_name
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_answer_display_name();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. One place that answers "who answered what"
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The column order you asked for, across all three subjects, without having to
-- remember which table calls its question column what. Handy for exports and
-- admin queries.
--
-- security_invoker: the view is checked against the RLS of whoever selects
-- from it, not its owner. Without it a view over RLS tables becomes a way to
-- read everyone's answers, which is the classic way to leak a table you
-- carefully protected.

CREATE OR REPLACE VIEW public.answers_with_name
WITH (security_invoker = true) AS
  SELECT 'mahoti'::text AS subject, a.answer_id, a.user_id, a.display_name,
         a.question_id, a.answer_score AS score, a.attempts, a.created_at
    FROM public.mahoti_answers a
  UNION ALL
  SELECT 'diuni'::text, a.answer_id, a.user_id, a.display_name,
         a.question_id, a.answer_score, a.attempts, a.created_at
    FROM public.diuni_answers a
  UNION ALL
  -- open_question_answers scores a rubric, not a percentage, and has no
  -- attempts column — NULLs keep the shape without pretending otherwise.
  SELECT 'open'::text, a.answer_id, a.user_id, a.display_name,
         a.open_question_id, NULL::double precision, NULL::integer, a.created_at
    FROM public.open_question_answers a;

COMMENT ON VIEW public.answers_with_name IS
  'Every answer across the three subjects with the candidate name beside '
  'user_id. security_invoker: RLS of the caller applies.';
