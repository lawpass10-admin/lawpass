-- Record WHICH SECTIONS a real question's answer key cites, not just which law.
--
-- THE GAP THIS CLOSES. A generated question is grounded at section level and
-- verified there: generate-mahoti-set.mjs refuses one whose cited section is not
-- in the notebook, and refuses one whose quote is not verbatim in that section's
-- text. An embedded real question was being checked only against the notebook's
-- LIST OF LAWS — so a question on חוק ההתיישנות passed even when it turned on a
-- section of that law the notebook never sampled.
--
-- That gap is not academic. A notebook holds a SAMPLE of each law's sections,
-- because every section of 25 laws is ~120 A4 pages and a candidate is given
-- 70–90. Of the 26 pool questions whose law is in one notebook, only 11 have
-- every cited section in it. The other 15 ask about text the candidate was
-- never given.
--
-- SHAPE: [{ "law_id": 2000281, "law_name": "…", "sections": ["15","16"] }, …]
-- one entry per law the key names, in the order it names them, so the first is
-- the one the answer turns on — the same ordering law_id follows.
--
-- Filled by scripts/mahoti/map-real-question-laws.mjs, which parses the Bar's
-- prose ("סעיפים 252 - 254 לחוק החברות") with scripts/mahoti/law-matching.mjs.
-- Ranges are expanded, because a filter that read "252 - 254" as two sections
-- would pass a question whose middle section is missing.
--
-- NULL means the citation was never parsed; an entry with an empty `sections`
-- array means the key named that law without pinning a section to it, which is
-- a different fact and is not treated as "all sections are present".

ALTER TABLE public.mahoti_real_questions
  ADD COLUMN IF NOT EXISTS cited_sections jsonb;

COMMENT ON COLUMN public.mahoti_real_questions.cited_sections IS
  'Sections the answer key cites, per law, in the order cited: [{law_id, law_name, sections[]}]. Parsed from source_citation by scripts/mahoti/map-real-question-laws.mjs; used by embed-real-questions.mjs so an embedded question is grounded in the notebook at section level, as a generated one is. NULL = not parsed.';
