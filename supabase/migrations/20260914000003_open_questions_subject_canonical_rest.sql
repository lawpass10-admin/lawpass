-- The three remaining bidi-damaged subjects, given their proper names.
--
-- Companion to 20260914000001, which merged the four spellings of
-- "תקנות סדר הדין האזרחי, תשע״ט-2018". These three are not duplicates — each is
-- the only spelling of its statute in the table, so nothing was split — but all
-- three are wrong on screen, and the writing-task picker prints the stored
-- string exactly as it is:
--
--   חוק יסוד :השפיטה                        the colon belongs to the name
--                                           ("חוק-יסוד: השפיטה"), not after it
--   חוק חופש המידע ,התש"נח:1998             comma moved to the front, gershayim
--                                           landed inside the year (התש"נח for
--                                           התשנ"ח), hyphen came out as a colon
--   תקנות בתי המשפט )אגרות( ,התשס"ז:2007    parentheses mirrored, same comma and
--                                           hyphen damage
--
-- WHY IT MATTERS NOW RATHER THAN AS TIDYING. A generated angle inherits its
-- subject from its parent source row (subjectFor in
-- scripts/ingestion/open_questions/load_generated_questions.mjs). These three
-- rows are the parents of 2022-W-Q2, 2023-S-Q2 and 2026-S-Q2, so every new angle
-- written from those papers would be loaded under the damaged name and would
-- open its own entry in the picker — re-splitting it exactly as 20260914000001
-- un-split it.
--
-- Matched on the exact stored string. Unlike 20260914000001 there is no family
-- of spellings to normalise here, so there is nothing for a pattern to be
-- cleverer about: three rows, three names, listed so the change is readable.

BEGIN;

UPDATE public.open_questions
SET subject = 'חוק-יסוד: השפיטה'
WHERE subject = 'חוק יסוד :השפיטה';

UPDATE public.open_questions
SET subject = 'חוק חופש המידע, התשנ"ח-1998'
WHERE subject = 'חוק חופש המידע ,התש"נח:1998';

UPDATE public.open_questions
SET subject = 'תקנות בתי המשפט (אגרות), התשס"ז-2007'
WHERE subject = 'תקנות בתי המשפט )אגרות( ,התשס"ז:2007';

-- No subject may still carry a mark of bidi damage. Each pattern below is a
-- thing extraction DOES and correct Hebrew does not:
--
--   \s,      a space before a comma — the comma was carried to the front of the
--            following word ("האזרחי ,התשע״ט"). A correct name's comma sits
--            against the word before it.
--   \s:      a space before a colon — the Basic Law's "חוק יסוד :השפיטה".
--   :\d      a colon against a digit — the hyphen before the year, rewritten
--            ("התשס״ז:2007").
--   \)[א-ת]  a closing bracket opening a word — mirrored parentheses
--            ("\)אגרות\(").
--
-- Note what is NOT a marker: ", הת" is correct and appears in every proper
-- citation here. An earlier version of this guard tested for it and refused the
-- migration's own output.
DO $$
DECLARE
  damaged text;
BEGIN
  SELECT string_agg(DISTINCT subject, ' | ') INTO damaged
  FROM public.open_questions
  WHERE subject IS NOT NULL
    AND (subject ~ '\s,' OR subject ~ '\s:' OR subject ~ ':\d' OR subject ~ '\)[א-ת]');

  IF damaged IS NOT NULL THEN
    RAISE EXCEPTION 'subjects still look bidi-damaged: %', damaged;
  END IF;
END $$;

COMMIT;
