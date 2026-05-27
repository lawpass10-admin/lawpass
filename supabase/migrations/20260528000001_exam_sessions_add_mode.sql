-- Slice 9 — substantive exam simulation
--
-- exam_sessions tracked only the procedural-mode bar-exam simulation
-- before this slice. Three modes ship with Slice 9:
--   procedural  — 40 Qs from the procedural pool (existing behaviour).
--   substantive — 40 Qs from the substantive pool (new).
--   combined    — 20 procedural + 20 substantive (new).
--
-- Additive only:
--   • New column `mode` on exam_sessions.
--   • DEFAULT 'procedural' backfills existing rows — every session
--     prior to this migration was procedural by construction (no
--     other mode could be sampled). No data migration needed.
--   • CHECK constraint pins the allowlist; new modes require a
--     future migration.
--
-- Pause/resume RPCs (bump_exam_session_time, resume_exam_session,
-- submit_final_exam — migration 20260516000001) only read id /
-- user_id / active_window_token, so this addition doesn't affect
-- the existing RPC contracts. Confirmed via Phase A discovery.

ALTER TABLE public.exam_sessions
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'procedural'
    CHECK (mode IN ('procedural', 'substantive', 'combined'));
