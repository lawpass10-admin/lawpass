-- Undo one over-reach of 20260914000005.
--
-- That migration moved a full stop that had been carried to the front of the
-- following word ("בהליך השיפוטי ." -> "בהליך השיפוטי."). The rule did not
-- exempt an ELLIPSIS, so where the paper prints
--
--     בתקנות אלה – " ...החלטה" – פסק דין
--
-- it took the first dot of the "..." to be such a stop and produced
--
--     בתקנות אלה – ". ..החלטה" – פסק דין
--
-- which is worse than what it started from. This restores the ellipsis. The
-- rule itself is fixed at the source in scripts/ingestion/hebrew_pdf_to_json.py,
-- where the stop-before-word pattern now refuses to match a dot followed by
-- another dot.
--
-- Only this one text is affected. The other ". ." in the corpus
-- ("מהסכמה הדדית'.. .חוזה עבודה אישי") predates today's migrations — it is in
-- the snapshot taken before any of them ran — and is left alone, because it is
-- extraction damage whose correct form is not recoverable without the PDF.
--
-- Letters and digits are untouched: this moves one space.

BEGIN;

UPDATE public.open_questions AS o
SET question = jsonb_set(
      o.question,
      '{quotes}',
      (
        SELECT jsonb_agg(
                 CASE
                   WHEN quote->>'text' LIKE '%". ..החלטה"%'
                     THEN jsonb_set(
                            quote,
                            '{text}',
                            to_jsonb(replace(quote->>'text', '". ..החלטה"', '" ...החלטה"'))
                          )
                   ELSE quote
                 END
                 ORDER BY ordinality
               )
        FROM jsonb_array_elements(o.question->'quotes') WITH ORDINALITY AS t(quote, ordinality)
      )
    )
-- Matched through the extracted text, not `question::text`: the serialised JSON
-- escapes every quotation mark, so a LIKE carrying one never matches there.
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(o.question->'quotes', '[]'::jsonb)) AS quote
  WHERE quote->>'text' LIKE '%". ..החלטה"%'
);

DO $$
DECLARE
  left_over integer;
BEGIN
  SELECT count(*) INTO left_over
  FROM public.open_questions o,
       jsonb_array_elements(COALESCE(o.question->'quotes', '[]'::jsonb)) AS quote
  WHERE quote->>'text' LIKE '%". ..החלטה"%';

  IF left_over > 0 THEN
    RAISE EXCEPTION 'the split ellipsis survives in % quote(s)', left_over;
  END IF;
END $$;

COMMIT;
