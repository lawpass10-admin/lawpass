-- An explicit reading order for study material.
--
-- WHY. The contents list was ordered by `updated_at DESC`, which is the order
-- the material was last CONVERTED — an accident of the pipeline, not a reading
-- order. It put the examples booklet first because it happened to be loaded
-- last, and it would reshuffle itself every time a document was reconverted.
-- A candidate opening חומר ללימוד wants the order to study in, and that is a
-- property of the curriculum, not of the ingestion log.
--
-- The intended order is: learn how the task works (חוברת מיקוד), then the
-- language it must be written in (טעויות לשון), then worked examples
-- (חוברת הדוגמאות) — general to specific, instruction before imitation.
--
-- DEFAULT 100 so anything loaded later lands after the three curated documents
-- rather than silently jumping to the front, and `updated_at DESC` remains the
-- tiebreak inside a shared rank. Gaps of ten leave room to insert without
-- renumbering.
--
-- NOT DESTRUCTIVE: one nullable-free column with a default, a view replaced in
-- place, and three UPDATEs matched on paper_id. No data is removed.

ALTER TABLE public.study_material
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.study_material.sort_order IS
  'Reading order for the contents list, ascending. Lower is earlier. Default 100 keeps new material after the curated set; ties break on updated_at DESC.';

-- The list is read through the view, so the column has to reach it.
CREATE OR REPLACE VIEW public.study_material_public AS
SELECT
  study_material_id,
  paper_id,
  text_field,
  -- rewrite-source.mjs wraps the document in run metadata (contract version,
  -- model, cost). The candidate wants the document; the metadata is an
  -- operational record and stays behind the admin table.
  lawpass_text -> 'doc' AS doc,
  updated_at,
  -- Appended LAST on purpose: CREATE OR REPLACE VIEW may only add columns at
  -- the end. Putting it before updated_at is read as renaming that column and
  -- fails with "cannot change name of view column".
  sort_order
FROM public.study_material
WHERE lawpass_text IS NOT NULL
  -- Absent provenance reads as 'approved', so rows written before the
  -- publication gate existed are unaffected. Only an explicit hold takes a
  -- row out. See 20260930000001.
  AND COALESCE(lawpass_text -> 'provenance' ->> 'publication', 'approved') = 'approved';

COMMENT ON VIEW public.study_material_public IS
  'The LawPass-authored half of study_material, for candidate-facing reads. original_text is deliberately absent: RLS cannot hide a column, so the safe subset is expressed as a view. Rows without a conversion are excluded, as are rows whose lawpass_text provenance marks publication as pending. Ordered by sort_order at the call site.';

GRANT SELECT ON public.study_material_public TO authenticated;

-- The curated order. Matched on paper_id and idempotent, so re-applying this
-- migration is a no-op rather than a reshuffle.
UPDATE public.study_material SET sort_order = 10
  WHERE paper_id = 'חוברת מיקוד בניסוח משפטי';
UPDATE public.study_material SET sort_order = 20
  WHERE paper_id = 'טעויות_לשון_כתיבה_משפטית';
UPDATE public.study_material SET sort_order = 30
  WHERE paper_id = 'חוברת הדוגמאות בניסוח משפטי';
