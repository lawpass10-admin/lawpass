-- One name for one statute: collapse the four spellings of
-- "תקנות סדר הדין האזרחי, תשע״ט-2018" in open_questions.subject into one.
--
-- WHY THERE ARE FOUR. The subject is extracted from the exam PDFs, and Hebrew
-- PDF text extraction reorders what it cannot understand: a comma that belongs
-- at the end of the name arrives at its start, and the hyphen before the year
-- comes out as a colon, as an en dash, or not at all. Four spellings reached
-- the table, all of them the same regulations:
--
--     6 rows   תקנות סדר הדין האזרחי ,התשע"ט:2018     (comma moved, hyphen → colon)
--     1 row    תקנות סדר הדין האזרחי ,התשע"ט2018      (comma moved, no separator)
--     1 row    תקנות סדר הדין האזרחי, התשע"ט – 2018   (en dash, spaced)
--     2 rows   תקנות סדר הדין האזרחי, תשע"ט-2018      ← the correct one
--
-- The last is the form scripts/ingestion/open_questions/load_generated_questions.mjs
-- is run with, so it is the one everything new already arrives as.
--
-- WHY IT MATTERS. The writing-task subject list is built by grouping the
-- stored strings (lawpass_server/db/open-questions.js), so each spelling is its
-- own row in the picker: the student sees the same regulations offered three
-- times with the questions split between them. Nothing normalises at read time
-- and nothing should — the fix belongs in the data.
--
-- HOW THE ROWS ARE MATCHED. Not by listing the three damaged strings, which
-- would leave the next spelling out, and not by LIKE '%תקנות סדר הדין האזרחי%',
-- which would also catch a DIFFERENT set of regulations whose name begins the
-- same way ("תקנות סדר הדין האזרחי (אכיפת פסקי־חוץ)"). Instead the subject is
-- reduced to Hebrew letters and digits — dropping exactly the punctuation and
-- spacing the extraction damages — and compared whole. Only these regulations
-- reduce to those two keys, with or without the ה of התשע״ט.
--
-- Reversible only in the sense that the damaged spellings are recorded above:
-- this rewrites a text column in place and the previous values are not kept.

BEGIN;

UPDATE public.open_questions
SET subject = 'תקנות סדר הדין האזרחי, תשע"ט-2018'
WHERE subject IS NOT NULL
  AND regexp_replace(subject, '[^0-9א-ת]', '', 'g') IN (
        'תקנותסדרהדיןהאזרחיהתשעט2018',
        'תקנותסדרהדיןהאזרחיתשעט2018'
      )
  AND subject <> 'תקנות סדר הדין האזרחי, תשע"ט-2018';

-- Fail the whole migration rather than leave the picker half-merged: after the
-- UPDATE there must be exactly one spelling left for these regulations.
DO $$
DECLARE
  spellings integer;
BEGIN
  SELECT count(DISTINCT subject) INTO spellings
  FROM public.open_questions
  WHERE subject IS NOT NULL
    AND regexp_replace(subject, '[^0-9א-ת]', '', 'g') IN (
          'תקנותסדרהדיןהאזרחיהתשעט2018',
          'תקנותסדרהדיןהאזרחיתשעט2018'
        );

  IF spellings > 1 THEN
    RAISE EXCEPTION
      'expected one spelling of תקנות סדר הדין האזרחי after the merge, found %',
      spellings;
  END IF;
END $$;

COMMIT;
