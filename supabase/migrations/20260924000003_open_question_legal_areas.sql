-- Match a writing task to its skeletons by LEGAL AREA, not by subject.
--
-- WHY THE SUBJECT KEY DID NOT HOLD UP. `open_questions.subject` names the law a
-- task is built on, and `open_question_templates.template_subjects` listed the
-- subjects a template serves. That made every template carry a copy of the
-- subject list, so:
--
--   * a new subject meant editing up to 36 template rows before any question
--     using it could find a skeleton;
--   * 18 of the 36 templates had an EMPTY list, because no existing subject was
--     in their area — criminal, family, property, insolvency, appeals,
--     summations, letters — and they were therefore unreachable;
--   * the same fact ("civil procedure work uses the civil skeletons") was
--     written 7 times instead of once.
--
-- AREA IS THE THING BOTH SIDES ACTUALLY HAVE. A template already states its
-- area — it is the part it is printed under ("חלק ב' – דיני עבודה"). A subject
-- belongs to an area too, and that is a fact about the law, not about any one
-- question. So each side names its area, and the join is between them. Adding a
-- subject is now ONE row in open_question_subject_areas, and every template in
-- that area becomes reachable at once.
--
-- CROSS-CUTTING PARTS ARE 'general'. Appeals, summations and letters are not a
-- field of law — an appeal is an appeal in a civil, labour or administrative
-- matter alike — so they are marked 'general' and offered for every area, as
-- the five תבנית כללית skeletons already were.
--
-- template_subjects is left in place but is no longer read by anything. It is
-- not dropped here: dropping a populated column is data-losing and belongs in a
-- statement someone has looked at. See the comment on the column.

-- ── the areas both sides name ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.open_question_legal_areas (
  legal_area text PRIMARY KEY,
  label      text NOT NULL
);

INSERT INTO public.open_question_legal_areas (legal_area, label) VALUES
  ('civil',          'הליכים אזרחיים'),
  ('labour',         'דיני עבודה'),
  ('administrative', 'משפט מנהלי'),
  ('criminal',       'משפט פלילי'),
  ('family',         'דיני משפחה'),
  ('property',       'מקרקעין'),
  ('insolvency',     'חדלות פירעון'),
  ('general',        'כללי')
ON CONFLICT (legal_area) DO UPDATE SET label = EXCLUDED.label;

-- ── which area a template belongs to ─────────────────────────────────────────
ALTER TABLE public.open_question_templates
  ADD COLUMN IF NOT EXISTS legal_area text
    REFERENCES public.open_question_legal_areas (legal_area);

-- Derived from the part it is printed under, which is where this fact already
-- lived. Written once here rather than kept only in the loader so that the
-- column is correct the moment the migration lands.
UPDATE public.open_question_templates SET legal_area =
  CASE
    WHEN part LIKE 'חלק א%' THEN 'civil'
    WHEN part LIKE 'חלק ב%' THEN 'labour'
    WHEN part LIKE 'חלק ג%' THEN 'administrative'
    WHEN part LIKE 'חלק ד%' THEN 'criminal'
    WHEN part LIKE 'חלק ה%' THEN 'family'
    WHEN part LIKE 'חלק ו%' THEN 'property'
    WHEN part LIKE 'חלק ז%' THEN 'insolvency'
    -- ח' ערעורים · ט' סיכומים · י' מכתב משפטי: document stages, not fields of
    -- law. Offered everywhere.
    ELSE 'general'
  END
WHERE legal_area IS NULL;

ALTER TABLE public.open_question_templates
  ALTER COLUMN legal_area SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_open_question_templates_area
  ON public.open_question_templates (legal_area);

-- ── which area a subject belongs to ──────────────────────────────────────────
--
-- One row per subject, and the ONLY thing to add when a new subject appears. A
-- subject with no row here falls back to the 'general' skeletons, which is why
-- a missing row degrades rather than breaks.
CREATE TABLE IF NOT EXISTS public.open_question_subject_areas (
  subject    text PRIMARY KEY,
  legal_area text NOT NULL REFERENCES public.open_question_legal_areas (legal_area),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.open_question_subject_areas (subject, legal_area, note) VALUES
  ('תקנות סדר הדין האזרחי, תשע"ט-2018', 'civil',
   'The civil-procedure rules themselves.'),
  ('תקנות בתי המשפט (אגרות), התשס"ז-2007', 'civil',
   'Court fees are paid in a civil proceeding; a fee task is drafted as a בקשה in one.'),
  ('חוק חופש המידע, התשנ"ח-1998', 'administrative',
   'A refusal under it is challenged by עתירה מנהלית.'),
  ('חוק-יסוד: השפיטה', 'administrative',
   'Public law; tasks on it are petitions rather than pleadings.'),
  ('התנועה למען איכות השלטון בישראל נ'' משטרת ישראל', 'administrative',
   'A בג"ץ judgment.'),
  ('מילפלדר נ'' בית הדין הארצי לעבודה', 'labour',
   'A labour-court judgment.')
ON CONFLICT (subject) DO UPDATE
  SET legal_area = EXCLUDED.legal_area, note = EXCLUDED.note;

ALTER TABLE public.open_question_legal_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_question_subject_areas ENABLE ROW LEVEL SECURITY;

-- Both are reference data a candidate's own session reads while the page picks
-- a skeleton, so SELECT is open to any signed-in user; writes are admin-only.
CREATE POLICY open_question_legal_areas_read
  ON public.open_question_legal_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY open_question_legal_areas_admins_write
  ON public.open_question_legal_areas FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY open_question_subject_areas_read
  ON public.open_question_subject_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY open_question_subject_areas_admins_write
  ON public.open_question_subject_areas FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMENT ON TABLE public.open_question_subject_areas IS
  'open_questions.subject -> legal area. One row per subject; this is the only place to edit when a new subject appears. A subject with no row falls back to the general skeletons.';
COMMENT ON COLUMN public.open_question_templates.legal_area IS
  'The field of law this skeleton belongs to, from the part it is printed under. Matched against open_question_subject_areas.legal_area; ''general'' is offered for every area.';
COMMENT ON COLUMN public.open_question_templates.template_subjects IS
  'SUPERSEDED by legal_area (20260924000003) and no longer read. Kept so the mapping is not lost; safe to drop once you are happy with the area matching.';
