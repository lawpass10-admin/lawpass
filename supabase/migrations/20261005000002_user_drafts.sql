-- user_drafts — a candidate's own scratch page.
--
-- A free-text pad reachable from every screen, for whatever a student wants to
-- keep while studying: a half-formed answer, a rule they keep forgetting, a
-- question to look up later. It belongs to the student and nobody else reads
-- it — which is the difference between this and user_feedback, where the whole
-- point is that we read it.
--
-- WHY A ROW PER DRAFT AND NOT ONE ROW PER STUDENT. A single row would mean
-- every save overwrites the last, and a scratch pad whose previous contents
-- vanish is a scratch pad people learn not to trust. Separate rows also make
-- "my drafts" a list later without a migration.

CREATE TABLE IF NOT EXISTS public.user_drafts (
  draft_id   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- profiles.id is auth.users.id, so this is the identity RLS compares against
  -- auth.uid(). CASCADE: a deleted account takes its private notes with it.
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- The draft itself. NOT NULL with a length floor rather than a nullable
  -- column: an empty draft is a row nobody meant to create, and the server
  -- refuses to write one.
  text       text        NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- The ceiling matches the Zod schema in app/(app)/_actions.ts. Generous: this
  -- is a page someone may type an essay into, unlike a feedback box.
  CONSTRAINT user_drafts_text_length CHECK (char_length(btrim(text)) BETWEEN 1 AND 20000)
);

-- Hardening rule #2: a B-tree index on every column used in an RLS clause.
-- Also the index "my drafts, newest first" will want.
CREATE INDEX IF NOT EXISTS user_drafts_user_id_created_at_idx
  ON public.user_drafts (user_id, created_at DESC);

ALTER TABLE public.user_drafts ENABLE ROW LEVEL SECURITY;

-- ── Policies ───────────────────────────────────────────────────────────────
-- `(SELECT auth.uid())` rather than bare auth.uid() throughout — hardening
-- rule #2 — so the planner evaluates it once per statement instead of per row.
--
-- NO ADMIN POLICY, deliberately, and this is the one real difference from
-- user_feedback. Feedback is addressed to us; a draft is the student's own
-- notebook. An admin-read policy would mean staff could read private study
-- notes, which nobody asked for and no feature needs. Service-role access
-- still bypasses RLS for operational work, as everywhere.

DROP POLICY IF EXISTS user_drafts_students_insert_own ON public.user_drafts;
CREATE POLICY user_drafts_students_insert_own
  ON public.user_drafts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_drafts_students_select_own ON public.user_drafts;
CREATE POLICY user_drafts_students_select_own
  ON public.user_drafts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- UPDATE and DELETE are granted here, unlike user_feedback: these are the
-- student's own notes and editing or discarding them is the point. Both carry
-- the ownership test on each side, so a row cannot be edited into someone
-- else's name.
DROP POLICY IF EXISTS user_drafts_students_update_own ON public.user_drafts;
CREATE POLICY user_drafts_students_update_own
  ON public.user_drafts FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_drafts_students_delete_own ON public.user_drafts;
CREATE POLICY user_drafts_students_delete_own
  ON public.user_drafts FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_drafts TO authenticated;

COMMENT ON TABLE public.user_drafts IS
  'A candidate''s private scratch page. Row per saved draft, readable only by its owner — no admin policy, unlike user_feedback.';
