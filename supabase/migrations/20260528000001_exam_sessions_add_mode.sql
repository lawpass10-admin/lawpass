-- Slice 9: add mode column to exam_sessions for procedural/substantive/combined simulations
ALTER TABLE public.exam_sessions
  ADD COLUMN mode text NOT NULL DEFAULT 'procedural'
  CONSTRAINT exam_sessions_mode_check CHECK (mode IN ('procedural', 'substantive', 'combined'));
