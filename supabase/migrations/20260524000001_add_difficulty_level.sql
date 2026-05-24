-- Add difficulty_level: AI-assigned pedagogical difficulty from Nevo (prompt v7).
-- Nullable — the ~80 pre-v7 questions have no rating yet (future backfill).
-- Explicit IS NULL in the CHECK for self-documentation (a plain IN-check also
-- permits NULL, but the explicit form is clearer to the next reader).
-- text + CHECK (not ENUM) so a 4th level can be added later via constraint swap.
-- NOTE: distinct from any empirical difficulty (mv_question_difficulty in SPEC).
-- This column is the a-priori AI rating; the empirical one is computed from
-- real user attempts. They are complementary, not the same thing.

ALTER TABLE public.source_questions
  ADD COLUMN difficulty_level text
  CONSTRAINT source_questions_difficulty_level_check
  CHECK (difficulty_level IS NULL OR difficulty_level IN ('easy','medium','hard'));

ALTER TABLE public.angle_questions
  ADD COLUMN difficulty_level text
  CONSTRAINT angle_questions_difficulty_level_check
  CHECK (difficulty_level IS NULL OR difficulty_level IN ('easy','medium','hard'));
