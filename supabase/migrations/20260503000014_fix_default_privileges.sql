-- Migration 0014: Replace blanket default privileges with explicit per-table grants.
-- The blanket ALTER DEFAULT PRIVILEGES in 0012 applied to ALL TABLES which
-- includes materialized views — a data leak for RLS-bypassed objects.

-- Step 1: Revoke the blanket default privileges from 0012
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;

-- Step 2: Revoke blanket grants from 0012 on all tables, then re-grant per table.
-- This ensures MViews (and any future SECURITY DEFINER views) stay locked.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Step 3: Re-grant DML on regular tables only (not MViews).
-- anon gets SELECT (RLS handles the rest).
-- authenticated gets SELECT, INSERT, UPDATE, DELETE (RLS handles the rest).

-- profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- chapters
GRANT SELECT, INSERT, UPDATE, DELETE ON chapters TO authenticated;
GRANT SELECT ON chapters TO anon;

-- subtopics
GRANT SELECT, INSERT, UPDATE, DELETE ON subtopics TO authenticated;
GRANT SELECT ON subtopics TO anon;

-- source_questions
GRANT SELECT, INSERT, UPDATE, DELETE ON source_questions TO authenticated;
GRANT SELECT ON source_questions TO anon;

-- source_choices
GRANT SELECT, INSERT, UPDATE, DELETE ON source_choices TO authenticated;
GRANT SELECT ON source_choices TO anon;

-- angle_questions
GRANT SELECT, INSERT, UPDATE, DELETE ON angle_questions TO authenticated;
GRANT SELECT ON angle_questions TO anon;

-- angle_choices
GRANT SELECT, INSERT, UPDATE, DELETE ON angle_choices TO authenticated;
GRANT SELECT ON angle_choices TO anon;

-- practice_sessions
GRANT SELECT, INSERT, UPDATE, DELETE ON practice_sessions TO authenticated;
GRANT SELECT ON practice_sessions TO anon;

-- exam_sessions
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_sessions TO authenticated;
GRANT SELECT ON exam_sessions TO anon;

-- attempts
GRANT SELECT, INSERT, UPDATE, DELETE ON attempts TO authenticated;
GRANT SELECT ON attempts TO anon;

-- payments
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;
GRANT SELECT ON payments TO anon;

-- subscriptions
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO authenticated;
GRANT SELECT ON subscriptions TO anon;

-- bookmarks
GRANT SELECT, INSERT, UPDATE, DELETE ON bookmarks TO authenticated;
GRANT SELECT ON bookmarks TO anon;

-- mistakes
GRANT SELECT, INSERT, UPDATE, DELETE ON mistakes TO authenticated;
GRANT SELECT ON mistakes TO anon;

-- question_notes
GRANT SELECT, INSERT, UPDATE, DELETE ON question_notes TO authenticated;
GRANT SELECT ON question_notes TO anon;

-- question_feedback
GRANT SELECT, INSERT, UPDATE, DELETE ON question_feedback TO authenticated;
GRANT SELECT ON question_feedback TO anon;

-- admin_actions_log
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_actions_log TO authenticated;
GRANT SELECT ON admin_actions_log TO anon;

-- webhook_idempotency_log (service_role only via 0012, no anon/authenticated)
-- Intentionally omitted — no grant needed.
