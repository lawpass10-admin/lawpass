-- The publishable half of study_material, and only that half.
--
-- WHY A VIEW AND NOT A GRANT ON THE TABLE. public.study_material holds two
-- texts on one row: `original_text`, which is someone else's copyrighted
-- expression, and `lawpass_text`, which LawPass authored under
-- scripts/ingestion/LLM-text-converting.json. Only the second may ever reach a
-- candidate. RLS decides which ROWS a role may read; it cannot hide a COLUMN.
-- So the table stays admin-only and this view is the one thing a candidate's
-- session can see — original_text is not in it, and therefore cannot leak from
-- it however the query is written.
--
-- SECURITY INVOKER IS DELIBERATELY OFF. A view without `security_invoker`
-- evaluates against its owner's privileges, so the base table's admin-only
-- policy does not block a candidate reading through it. That is the whole
-- mechanism, and it is safe here precisely because the view's column list is
-- fixed: whatever the caller asks for, the only source text they can obtain is
-- the one we wrote ourselves.
--
-- (20260503000014 revoked blanket defaults because MATERIALIZED views bypass
-- RLS by accident. This is the same property used on purpose, on a plain view,
-- with a column list chosen so that bypassing RLS exposes nothing private.)
--
-- ROWS WITH NO CONVERSION YET ARE NOT IN THE VIEW. lawpass_text is NULL until
-- the second pipeline stage runs. A candidate should never see an empty study
-- page, so those rows are filtered out here rather than handled on screen.

CREATE OR REPLACE VIEW public.study_material_public AS
SELECT
  study_material_id,
  paper_id,
  text_field,
  -- rewrite-source.mjs wraps the document in run metadata (contract version,
  -- model, cost). The candidate wants the document; the metadata is an
  -- operational record and stays behind the admin table.
  lawpass_text -> 'doc' AS doc,
  updated_at
FROM public.study_material
WHERE lawpass_text IS NOT NULL;

COMMENT ON VIEW public.study_material_public IS
  'The LawPass-authored half of study_material, for candidate-facing reads. original_text is deliberately absent: RLS cannot hide a column, so the safe subset is expressed as a view. Rows without a conversion are excluded.';

-- A candidate reads study material; nothing writes to it from a browser.
GRANT SELECT ON public.study_material_public TO authenticated;
