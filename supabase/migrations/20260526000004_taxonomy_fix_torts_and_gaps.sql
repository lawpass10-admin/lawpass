-- Phase 4 — Substantive taxonomy fix.
--
-- The 2024-W-S substantive batch surfaced taxonomy gaps: 12 questions had
-- no correct home and were filed into the closest available subtopic with
-- a needs_review flag baked into notes_for_admin. This migration closes
-- the five real gaps (torts, youth_law, consumer_protection, trusts,
-- constitutional_rights), re-files the 5 questions that had a wrong home,
-- and clears the needs_review flag on the 7 questions that were already
-- correctly placed (the flag was just caution).
--
-- Additive for chapters / subtopics. The 12 UPDATEs target ONLY the named
-- 2024-W-S questions by external_id — nothing else is touched. The 74
-- procedural questions, the 6 procedural chapters, and every angle/choice
-- row are untouched.
--
-- Idempotency:
--   * Chapter/subtopic inserts use ON CONFLICT (code) / (chapter_id,code)
--     DO NOTHING.
--   * The UPDATEs gate on `notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%'`
--     so a re-run doesn't double-prefix or undo the move.
--
-- Maintenance bundled in this migration: backfill schema_migrations rows
-- for two prior content migrations (20260517000001 + 20260518000001) that
-- were applied to the DB but never registered.

-- ============================================================
-- Step 1 — New substantive chapter: torts (דיני נזיקין) at display_order 16
-- ============================================================

INSERT INTO public.chapters (code, title, display_order, track) VALUES
  ('torts', 'דיני נזיקין', 16, 'substantive')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.subtopics (chapter_id, code, title, display_order)
SELECT c.id, v.code, v.title, v.display_order
FROM (VALUES
  ('torts', 'negligence',             'רשלנות',                          1),
  ('torts', 'road_accident_victims',  'נפגעי תאונות דרכים (פלת"ד)',     2),
  ('torts', 'defamation',             'לשון הרע',                       3),
  ('torts', 'nuisance_trespass',      'מטרדים והסגת גבול',              4),
  ('torts', 'product_liability',      'אחריות מוצרים פגומים',           5),
  ('torts', 'strict_liability_torts', 'עוולות אחריות חמורה',            6),
  ('torts', 'damages_assessment',     'הערכת נזק ופיצויים',             7)
) AS v(chapter_code, code, title, display_order)
JOIN public.chapters c ON c.code = v.chapter_code
ON CONFLICT (chapter_id, code) DO NOTHING;

-- ============================================================
-- Step 2 — New subtopics inside existing chapters
-- Pre-flight observation: max(display_order) was 8 / 14 / 5 for
-- criminal_substantive / contracts / administrative respectively, so the
-- new subtopics take 9 / 15 / 16 / 6.
-- ============================================================

INSERT INTO public.subtopics (chapter_id, code, title, display_order)
SELECT c.id, v.code, v.title, v.display_order
FROM (VALUES
  ('criminal_substantive', 'youth_law',             'דיני נוער',             9),
  ('contracts',            'consumer_protection',   'הגנת הצרכן',           15),
  ('contracts',            'trusts',                'דיני נאמנות',          16),
  ('administrative',       'constitutional_rights', 'זכויות יסוד והגבלתן',   6)
) AS v(chapter_code, code, title, display_order)
JOIN public.chapters c ON c.code = v.chapter_code
ON CONFLICT (chapter_id, code) DO NOTHING;

-- ============================================================
-- Step 3 — Re-file the 5 affected source_questions.
--
-- Each UPDATE resolves chapter_id + subtopic_id at write time so we don't
-- depend on hardcoded UUIDs. The WHERE clause excludes rows already
-- migrated (`notes_for_admin LIKE 'RESOLVED (Phase 4):%'`) so a re-run is
-- a no-op. Status is conditionally normalized to 'active' if it had been
-- set to 'needs_review' — defensive (none currently are, but the spec
-- mandates the guard).
-- ============================================================

UPDATE public.source_questions sq
SET chapter_id  = (SELECT id FROM public.chapters WHERE code = 'torts'),
    subtopic_id = (SELECT s.id FROM public.subtopics s
                    JOIN public.chapters c ON c.id = s.chapter_id
                   WHERE c.code = 'torts' AND s.code = 'road_accident_victims'),
    notes_for_admin = 'RESOLVED (Phase 4): ' || COALESCE(sq.notes_for_admin, ''),
    status = CASE WHEN sq.status = 'needs_review' THEN 'active' ELSE sq.status END
WHERE sq.external_id = '2024-W-S-Q35'
  AND sq.notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%';

UPDATE public.source_questions sq
SET chapter_id  = (SELECT id FROM public.chapters WHERE code = 'criminal_substantive'),
    subtopic_id = (SELECT s.id FROM public.subtopics s
                    JOIN public.chapters c ON c.id = s.chapter_id
                   WHERE c.code = 'criminal_substantive' AND s.code = 'youth_law'),
    notes_for_admin = 'RESOLVED (Phase 4): ' || COALESCE(sq.notes_for_admin, ''),
    status = CASE WHEN sq.status = 'needs_review' THEN 'active' ELSE sq.status END
WHERE sq.external_id = '2024-W-S-Q06'
  AND sq.notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%';

UPDATE public.source_questions sq
SET chapter_id  = (SELECT id FROM public.chapters WHERE code = 'contracts'),
    subtopic_id = (SELECT s.id FROM public.subtopics s
                    JOIN public.chapters c ON c.id = s.chapter_id
                   WHERE c.code = 'contracts' AND s.code = 'consumer_protection'),
    notes_for_admin = 'RESOLVED (Phase 4): ' || COALESCE(sq.notes_for_admin, ''),
    status = CASE WHEN sq.status = 'needs_review' THEN 'active' ELSE sq.status END
WHERE sq.external_id = '2024-W-S-Q22'
  AND sq.notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%';

UPDATE public.source_questions sq
SET chapter_id  = (SELECT id FROM public.chapters WHERE code = 'contracts'),
    subtopic_id = (SELECT s.id FROM public.subtopics s
                    JOIN public.chapters c ON c.id = s.chapter_id
                   WHERE c.code = 'contracts' AND s.code = 'trusts'),
    notes_for_admin = 'RESOLVED (Phase 4): ' || COALESCE(sq.notes_for_admin, ''),
    status = CASE WHEN sq.status = 'needs_review' THEN 'active' ELSE sq.status END
WHERE sq.external_id = '2024-W-S-Q28'
  AND sq.notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%';

UPDATE public.source_questions sq
SET chapter_id  = (SELECT id FROM public.chapters WHERE code = 'administrative'),
    subtopic_id = (SELECT s.id FROM public.subtopics s
                    JOIN public.chapters c ON c.id = s.chapter_id
                   WHERE c.code = 'administrative' AND s.code = 'constitutional_rights'),
    notes_for_admin = 'RESOLVED (Phase 4): ' || COALESCE(sq.notes_for_admin, ''),
    status = CASE WHEN sq.status = 'needs_review' THEN 'active' ELSE sq.status END
WHERE sq.external_id = '2024-W-S-Q40'
  AND sq.notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%';

-- ============================================================
-- Step 4 — Clear needs_review flags on the 7 questions that are already
-- correctly classified. NO chapter/subtopic change.
-- ============================================================

UPDATE public.source_questions sq
SET notes_for_admin = 'RESOLVED (Phase 4): ' || COALESCE(sq.notes_for_admin, ''),
    status = CASE WHEN sq.status = 'needs_review' THEN 'active' ELSE sq.status END
WHERE sq.external_id IN (
        '2024-W-S-Q08',
        '2024-W-S-Q09',
        '2024-W-S-Q17',
        '2024-W-S-Q25',
        '2024-W-S-Q31',
        '2024-W-S-Q37',
        '2024-W-S-Q38'
      )
  AND sq.notes_for_admin NOT LIKE 'RESOLVED (Phase 4):%';

-- ============================================================
-- Step 5a (maintenance) — backfill registry for prior content migrations.
-- 20260517000001 (add_2024_winter_q1_to_q20) and 20260518000001
-- (add_2024_winter_q21_to_q40) were applied to the DB but never recorded
-- in supabase_migrations.schema_migrations.
-- ============================================================

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260517000001', 'add_2024_winter_q1_to_q20'),
  ('20260518000001', 'add_2024_winter_q21_to_q40')
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- Register this migration in supabase_migrations.schema_migrations using
-- the file's timestamp (so the registry version matches the filename, not
-- the MCP wall-clock).
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260526000004', 'taxonomy_fix_torts_and_gaps')
ON CONFLICT (version) DO NOTHING;
