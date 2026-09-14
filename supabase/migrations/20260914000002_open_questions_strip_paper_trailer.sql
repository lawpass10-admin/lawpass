-- Cut the exam paper's closing notice out of the attached-source quotes.
--
-- WHAT IT IS. Every Bar writing-task paper ends with a notice addressed to the
-- candidate, not to any question:
--
--   לידיעתכם, מדבקת הזיהוי הינה לשימוש פנימי ואינה מוצגת לבודק המטלה.
--   לתשומת לבך! חל איסור לכלול בגוף התשובה פרטים מזהים כלשהם. בהצלחה!
--
-- HOW IT GOT INTO A JUDGMENT. scripts/ingestion/hebrew_pdf_to_json.py cuts the
-- sources region at each citation start, so the LAST source's block runs to the
-- end of the text — and the notice is at the end of the text. It was therefore
-- appended to the last quote of a paper and printed to students inside the
-- bordered source card, reading as the closing words of the judgment quoted
-- above it. Seven quotes across seven rows carry it, four of them 'source' rows
-- and three papers generated from them.
--
-- The extractor now strips this before anything is split off the question body
-- (strip_paper_trailer / PAPER_TRAILER), so it cannot recur. This migration is
-- for the rows already loaded.
--
-- WHAT IS REMOVED. Everything from the notice's opening words to the end of the
-- quote, plus a bare page number immediately before it (one quote ends
-- '...עד עצם היום הזה". 4 לידיעתכם'). The notice is always last, so nothing of
-- the judgment or the statute can sit after it. Anchored on the opening words
-- rather than matched whole, because the wording varies between papers and bidi
-- extraction moves the comma to the wrong side of לידיעתכם.
--
-- Text is rewritten in place and the removed words are not kept. They are
-- reproduced above in full, which is the whole of what any row loses.

BEGIN;

UPDATE public.open_questions AS o
SET question = jsonb_set(
      o.question,
      '{quotes}',
      (
        SELECT jsonb_agg(
                 CASE
                   WHEN quote->>'text' ~ '(לידיעתכם|לתשומת\s+לבך|בהצלחה\s*!)'
                     THEN jsonb_set(
                            quote,
                            '{text}',
                            to_jsonb(
                              regexp_replace(
                                quote->>'text',
                                '\s*\d*\s*(לידיעתכם\s*,?\s*מדבקת\s+הזיהוי|לתשומת\s+לבך\s*!|בהצלחה\s*!).*$',
                                ''
                              )
                            )
                          )
                   ELSE quote
                 END
                 -- Sources are printed in the order the paper prints them, and
                 -- the quote ids (L1-Q1, V2-Q1) are referenced by position in
                 -- the generated text. jsonb_agg without ORDER BY may not keep
                 -- it.
                 ORDER BY ordinality
               )
        FROM jsonb_array_elements(o.question->'quotes') WITH ORDINALITY AS t(quote, ordinality)
      )
    )
WHERE o.question ? 'quotes'
  AND o.question->>'quotes' ~ '(לידיעתכם|לתשומת\s+לבך|בהצלחה\s*!)';

-- Nothing may be left carrying it. A quote that still matches means the
-- pattern missed a wording, which is worth failing the migration over: the
-- alternative is believing the paper is clean when a student is still being
-- shown the notice as law.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM public.open_questions o,
       jsonb_array_elements(COALESCE(o.question->'quotes', '[]'::jsonb)) AS quote
  WHERE quote->>'text' ~ '(לידיעתכם|לתשומת\s+לבך|בהצלחה\s*!)';

  IF remaining > 0 THEN
    RAISE EXCEPTION 'the paper trailer is still present in % quote(s)', remaining;
  END IF;
END $$;

COMMIT;
