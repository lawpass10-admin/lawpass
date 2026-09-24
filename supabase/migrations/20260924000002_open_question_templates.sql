-- The legal-writing skeletons a candidate fills in for a מטלת כתיבה.
--
-- WHAT THESE ARE. 36 templates in 10 parts — כתב תביעה, כתב הגנה, עתירה מנהלית,
-- סיכומים, and so on — from "שלדי כתיבה משפטית", updated for תקסד"א התשע"ט-2018.
-- Each one is a structure with bracketed blanks, meant to be used directly as
-- the shape of an answer rather than read as prose.
--
-- WHY A TABLE. The writing task screen shows a candidate a question and has to
-- be able to put the right skeleton beside it. That is a lookup, and a lookup
-- needs rows.
--
-- HOW A TEMPLATE FINDS ITS QUESTION. `open_questions.subject` names the LAW a
-- task is built on ("תקנות סדר הדין האזרחי, תשע\"ט-2018"); a template names a
-- DOCUMENT ("כתב תביעה"). The two are not the same axis, and the relation is
-- many-to-many in both directions: one subject needs several templates, and a
-- template — especially the five תבנית כללית ones — serves several subjects. So
-- the link is an ARRAY on this table, and the lookup is
--
--   SELECT * FROM open_question_templates
--    WHERE <the question's subject> = ANY(template_subjects)
--
-- A single text column would have forced the same template to exist as several
-- rows, one per subject, with the body duplicated in each.
--
-- THE MAPPING IS SEEDED, NOT AUTHORITATIVE. Only templates 1-3 state their own
-- legal basis (לפי תקסד"א התשע"ט-2018); for the rest the link is a judgment
-- about legal area, made by matching each part to the subjects now in
-- open_questions. scripts/open-questions/load-templates.mjs holds that mapping
-- and is where to correct it. Parts with no matching subject — פלילי, משפחה,
-- מקרקעין, חדלות פירעון — are seeded EMPTY rather than attached to something
-- approximate: an empty array reads as "not yet mapped", a wrong one reads as
-- an answer.
--
-- NOT ADMIN-ONLY. Unlike the question pools, a template is study material the
-- candidate is meant to read while writing. Any signed-in user may select;
-- only an admin may write.

CREATE TABLE IF NOT EXISTS public.open_question_templates (
  template_id       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Its number in the source document, 1-36. The document is a teaching text
  -- people refer to by number, so the number is preserved and unique rather
  -- than being an accident of insertion order.
  number            integer     NOT NULL,
  -- "חלק א' – הליכים אזרחיים" — the part it belongs to, as printed.
  part              text        NOT NULL,
  title             text        NOT NULL,
  -- The lead line under the title, where the document has one: the scope note
  -- and the regulations the skeleton follows.
  summary           text,
  -- The skeleton itself, newline-separated, as printed. Brackets ] [ mark the
  -- blanks a candidate fills.
  body              text        NOT NULL,

  -- Which open_questions.subject values this template serves. Empty means not
  -- yet mapped. See the note above.
  template_subjects text[]      NOT NULL DEFAULT '{}',
  -- True for the five תבנית כללית templates (32-36), which fit any subject.
  -- Stored rather than derived: it is a property of the template, and the
  -- screen wants to offer them as a fallback when nothing else matches.
  is_generic        boolean     NOT NULL DEFAULT false,

  source_pdf        text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT open_question_templates_number_key UNIQUE (number),
  CONSTRAINT open_question_templates_number_range CHECK (number BETWEEN 1 AND 200),
  CONSTRAINT open_question_templates_body_not_empty CHECK (length(btrim(body)) > 0)
);

-- The lookup above is a containment test on an array, which is what GIN is for.
CREATE INDEX IF NOT EXISTS idx_open_question_templates_subjects
  ON public.open_question_templates USING gin (template_subjects);

ALTER TABLE public.open_question_templates ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user: a template is the skeleton the candidate
-- writes into, and it gives nothing away — it holds no question and no answer.
CREATE POLICY open_question_templates_read
  ON public.open_question_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY open_question_templates_admins_insert
  ON public.open_question_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY open_question_templates_admins_update
  ON public.open_question_templates FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY open_question_templates_admins_delete
  ON public.open_question_templates FOR DELETE TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.open_question_templates IS
  'Legal-writing skeletons for מטלת כתיבה, from "שלדי כתיבה משפטית". Readable by any signed-in user; matched to a question through template_subjects @> the question subject.';
COMMENT ON COLUMN public.open_question_templates.template_subjects IS
  'open_questions.subject values this template serves. Lookup: <subject> = ANY(template_subjects). Empty = not yet mapped; seeded by legal area in scripts/open-questions/load-templates.mjs.';
