-- Correct what law_id says about itself.
--
-- 20260923000004 described the column as "NULL until mapped by hand", copying
-- diuni_real_questions (20260923000002), where seven ids were in fact written
-- by hand. That is no longer how this table is filled, and the column should
-- not tell the next reader to do it the slow way.
--
-- scripts/mahoti/map-real-question-laws.mjs resolves the citation the Bar's
-- answer key printed against public.mahoti_laws by name, flattening the four
-- spelling differences between the corpus and the key (bracket shape, כתיב
-- מלא/חסר, maqaf against space, and the gershayim codepoint — see
-- scripts/mahoti/law-matching.mjs). It matches names; it does not infer. 153 of
-- the 157 rows resolve; the 4 that do not cite laws this corpus does not hold,
-- or cite a judgment alone, and stay NULL.
--
-- Nothing about the data changes here, only what the column claims.

COMMENT ON COLUMN public.mahoti_real_questions.law_id IS
  'mahoti_laws.law_id of the law the answer turns on, resolved from source_citation by scripts/mahoti/map-real-question-laws.mjs. Also what embed-real-questions.mjs filters on, so an embedded question belongs to its paper''s notebook. NULL = the citation names no law in this corpus.';
