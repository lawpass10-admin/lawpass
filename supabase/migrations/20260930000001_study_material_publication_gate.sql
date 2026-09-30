-- A publication gate on study_material_public.
--
-- WHY. Until now `lawpass_text IS NOT NULL` meant two things at once: the
-- conversion has run, and the text may be shown to a candidate. That held while
-- every lawpass_text came out of scripts/ingestion/rewrite-source.mjs, which
-- only ever produces LawPass's own authored text under
-- LLM-text-converting.json.
--
-- It stops holding the moment anything else writes that column. The first case
-- is חוברת הדוגמאות בניסוח משפטי: a booklet of worked example documents with no
-- unprotectable layer to convert, held to be official published material, and
-- therefore stored VERBATIM rather than rewritten. Verbatim source in
-- lawpass_text is a different kind of thing from authored text, and whether it
-- may be published is a legal question with an answer that is not in this
-- repository.
--
-- So publication becomes explicit rather than implied. A row carrying
-- `lawpass_text->'provenance'->>'publication' = 'pending_legal_review'` is held
-- back from the candidate-facing view; everything else — including every row
-- written before this migration, which has no provenance key at all — keeps
-- exactly the behaviour it had, by COALESCE defaulting to 'approved'.
--
-- To publish a held row, set that one field to 'approved'. No data moves.
--
-- NOT DESTRUCTIVE: CREATE OR REPLACE on a view, no column dropped, no row
-- touched. The only change is that a row whose provenance says it is awaiting
-- review stops being served.

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
WHERE lawpass_text IS NOT NULL
  -- Absent provenance reads as 'approved', so rows written before this gate
  -- existed are unaffected. Only an explicit hold takes a row out.
  AND COALESCE(lawpass_text -> 'provenance' ->> 'publication', 'approved') = 'approved';

COMMENT ON VIEW public.study_material_public IS
  'The LawPass-authored half of study_material, for candidate-facing reads. original_text is deliberately absent: RLS cannot hide a column, so the safe subset is expressed as a view. Rows without a conversion are excluded, as are rows whose lawpass_text provenance marks publication as pending.';

GRANT SELECT ON public.study_material_public TO authenticated;
