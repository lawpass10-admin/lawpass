-- Migration: Fix NULLS DISTINCT bug in bookmarks and mistakes unique constraints
--
-- Problem: The existing unique constraints use Postgres-default NULLS DISTINCT,
-- which means rows with NULL values in any constrained column are treated as
-- distinct. Our schema uses XOR (source_question_group_id OR angle_question_id,
-- not both), so the constraint never fires — ON CONFLICT becomes a no-op.
-- Verified live (May 11, 2026) via pg_index.indnullsnotdistinct = false on
-- both bookmarks_user_id_question_type_*_key and mistakes_user_id_question_type_*_key.
--
-- Without this fix, every wrong answer in Phase 3 will insert a duplicate
-- mistakes row instead of incrementing mistakes_count, and every double-click
-- on the bookmark icon will insert a duplicate bookmark row.
--
-- Solution: Replace each broken constraint with two partial unique indexes,
-- one per question_type. Each index covers only the non-NULL column for that
-- type, so ON CONFLICT (user_id, source_question_group_id) WHERE
-- question_type='source' resolves cleanly.

-- Drop existing broken constraints (and their backing unique indexes).
ALTER TABLE bookmarks
  DROP CONSTRAINT IF EXISTS bookmarks_user_id_question_type_source_question_group_id_an_key;

ALTER TABLE mistakes
  DROP CONSTRAINT IF EXISTS mistakes_user_id_question_type_source_question_group_id_ang_key;

-- Create partial unique indexes for bookmarks.
CREATE UNIQUE INDEX bookmarks_unique_source
  ON public.bookmarks (user_id, source_question_group_id)
  WHERE question_type = 'source';

CREATE UNIQUE INDEX bookmarks_unique_angle
  ON public.bookmarks (user_id, angle_question_id)
  WHERE question_type = 'angle';

-- Create partial unique indexes for mistakes.
CREATE UNIQUE INDEX mistakes_unique_source
  ON public.mistakes (user_id, source_question_group_id)
  WHERE question_type = 'source';

CREATE UNIQUE INDEX mistakes_unique_angle
  ON public.mistakes (user_id, angle_question_id)
  WHERE question_type = 'angle';

-- Document the indexes.
COMMENT ON INDEX bookmarks_unique_source IS
  'Partial unique: one bookmark per user per source question group. Replaces broken NULLS DISTINCT constraint.';
COMMENT ON INDEX bookmarks_unique_angle IS
  'Partial unique: one bookmark per user per angle question. Replaces broken NULLS DISTINCT constraint.';
COMMENT ON INDEX mistakes_unique_source IS
  'Partial unique: enables ON CONFLICT DO UPDATE for mistakes_count increment on source questions.';
COMMENT ON INDEX mistakes_unique_angle IS
  'Partial unique: enables ON CONFLICT DO UPDATE for mistakes_count increment on angle questions.';
