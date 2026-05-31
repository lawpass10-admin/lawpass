-- Slice 24 — per-session practice timer budget.
--
-- This file documents the migration that has ALREADY been applied to
-- the live DB by the PM (ledger version 20260531000001). It is here
-- so the migrations folder stays in sync with what's on the server;
-- DO NOT re-run.
--
-- The model is wall-clock: `remaining = max(0, session_duration_seconds
-- - (NOW() - started_at))` on each play-page server render. Time keeps
-- elapsing whether the tab is open or not; resume flows just re-derive
-- the same expression. 0 = "no timer" (the off state in the builder),
-- which is the natural default that keeps every pre-Slice-24 row
-- behaving exactly as before.

ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER NOT NULL DEFAULT 0
  CHECK (session_duration_seconds >= 0 AND session_duration_seconds <= 14400);

COMMENT ON COLUMN practice_sessions.session_duration_seconds IS
  'Slice 24 — per-session timer budget in seconds. 0 = no timer ' ||
  '(the "ללא טיימר" UX setting). Remaining time on read is wall-' ||
  'clock derived: max(0, session_duration_seconds - (NOW() - ' ||
  'started_at)). Capped at 14400s (4h) to bound the input.';
