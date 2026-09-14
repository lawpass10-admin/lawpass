-- Repair the bidi damage in the attached sources' citations.
--
-- The citation is the heading printed above each source on the paper, and it is
-- also substituted into the generated text wherever a {{L1}} placeholder stands
-- — so a damaged one is read by the student twice, once as a heading and once
-- mid-sentence. 26 of the 32 distinct citations carried at least one of:
--
--   mirrored brackets      ")אגרות("            for "(אגרות)"
--   comma carried forward  "האזרחי ,התשע\"ט"     for "האזרחי, התשע\"ט"
--   colon for the hyphen   "התשס\"ז:2007"        for "התשס\"ז-2007"
--   dropped gershayim      "בגץ", "תא"           for "בג\"ץ", "ת\"א"
--   transposed gershayim   "התש\"נח"             for "התשנ\"ח"
--   the נ' separator       "דרור  'ניסעור"       for "דרור נ' יסעור"
--   a digit run running straight into the next word, and the double spaces the
--   bidi runs leave behind.
--
-- WHY LITERALS RATHER THAN PATTERNS. The damaged set is closed and small, so
-- every rewrite below can be checked by eye against the paper. The general rules
-- that stop this recurring live in scripts/ingestion/hebrew_pdf_to_json.py
-- (repair_citation), applied at extraction; the database only needs the finite
-- repair, and a literal one cannot misfire on a citation it was not tested
-- against.
--
-- WHAT IS DELIBERATELY NOT TOUCHED, because it cannot be fixed without guessing:
--
--   * Case-number ORDER. "ע\"א 23-123 דרור" may be 123-23 reversed by bidi, as
--     the digits are one LTR run inside an RTL line. Reversing them would be an
--     inference about a citation, not a repair of punctuation. Settling it needs
--     the source PDF.
--   * "בג\"ץ 66/17 בית נ' משרד הבינוינ" keeps its trailing נ — a letter arrived
--     in the wrong place and there is no rule that says where it belongs.
--   * "ע\"א 8506/13 זאבי נ' בנק הפועלים …" has a whole paragraph of the judgment
--     inside its citation. That is the citation/quote split failing, not
--     punctuation, and it needs the extraction re-run rather than an UPDATE.
--
-- Rewrites the text in place; the previous values are the left column below.

BEGIN;

WITH repair(before, after) AS (VALUES
  ('בג"ץ  111/10אלף  ''נשר האוצר', 'בג"ץ 111/10 אלף נ'' שר האוצר'),
  ('בג"ץ  66/17בית  ''נמשרד הבינוינ', 'בג"ץ 66/17 בית נ'' משרד הבינוינ'),
  ('מתוך בגץ 415/19 לוי נ שר הפנ''ים', 'מתוך בג"ץ 415/19 לוי נ'' שר הפנים'),
  ('מתוך בגץ 4790/14 יהדות התורה נ'' השר לשירותי דת', 'מתוך בג"ץ 4790/14 יהדות התורה נ'' השר לשירותי דת'),
  ('מתוך בגץ 6536/17 התנועה למען איכות השלטון בישראל נ'' משטרת ישראל', 'מתוך בג"ץ 6536/17 התנועה למען איכות השלטון בישראל נ'' משטרת ישראל'),
  ('מתוך בגץ 7190/05 לובל נ'' ממשלת ישראל', 'מתוך בג"ץ 7190/05 לובל נ'' ממשלת ישראל'),
  ('מתוך חוק בתי המשפט ]נוסח משולב[ ,התשמ"ד1984', 'מתוך חוק בתי המשפט [נוסח משולב], התשמ"ד-1984'),
  ('מתוך חוק החוזים )חלק כללי(, התשל"ג-1973', 'מתוך חוק החוזים (חלק כללי), התשל"ג-1973'),
  ('מתוך חוק חופש המידע ,התש"נח:1998', 'מתוך חוק חופש המידע, התשנ"ח-1998'),
  ('מתוך חוק יסוד :השפיטה', 'מתוך חוק יסוד: השפיטה'),
  ('מתוך ע"א 83893/1 אינבנקום נ מפרק ריט טכנ''ולוגיה בע"מ', 'מתוך ע"א 83893/1 אינבנקום נ'' מפרק ריט טכנולוגיה בע"מ'),
  ('מתוך ע"ע )ארצי( 111/11 כהן – חברה בע"מ', 'מתוך ע"ע (ארצי) 111/11 כהן – חברה בע"מ'),
  ('מתוך ע"ע )ארצי( 350/03 מדינת ישראל-משרד העבודה והרווחה – אברהם גרינשפן', 'מתוך ע"ע (ארצי) 350/03 מדינת ישראל-משרד העבודה והרווחה – אברהם גרינשפן'),
  ('מתוך פקודת הראיות ]נוסח חדש[ ,התשל"א1971', 'מתוך פקודת הראיות [נוסח חדש], התשל"א-1971'),
  ('מתוך תקנות בתי המשפט )אגרות( ,התשס"ז:2007', 'מתוך תקנות בתי המשפט (אגרות), התשס"ז-2007'),
  ('מתוך תקנות סדר הדין האזרחי ,התשע"ט:2018', 'מתוך תקנות סדר הדין האזרחי, התשע"ט-2018'),
  ('מתוך תקנות סדר הדין האזרחי ,התשע"ט2018', 'מתוך תקנות סדר הדין האזרחי, התשע"ט-2018'),
  ('ע"א  23-123דרור  ''ניסעור', 'ע"א 23-123 דרור נ'' יסעור'),
  ('עת"מ  11-12-13גימל  ''נמשרד הגימלאים', 'עת"מ 11-12-13 גימל נ'' משרד הגימלאים'),
  ('רע"א  21-456פרפור נ ''נשר', 'רע"א 21-456 פרפור נ'' נשר'),
  ('רע"א  234-21פ"ו  ''נד"ב', 'רע"א 234-21 פ"ו נ'' ד"ב'),
  ('רע"א  678/22גימל  ''נדלת...', 'רע"א 678/22 גימל נ'' דלת...'),
  ('רע"א נ 777-03גר  ''נבנאי', 'רע"א 777-03 נגר נ'' בנאי'),
  ('ת"א  666/83אלף  ''נבית', 'ת"א 666/83 אלף נ'' בית'),
  ('ת"א )י-ם(  56-7-21פז  ''נגז', 'ת"א (י-ם) 56-7-21 פז נ'' גז'),
  ('תא  23-2-111פלוני  ''נרוחות השמיים', 'ת"א 23-2-111 פלוני נ'' רוחות השמיים')
)
UPDATE public.open_questions AS o
SET question = jsonb_set(
      o.question,
      '{quotes}',
      (
        SELECT jsonb_agg(
                 CASE
                   WHEN r.after IS NOT NULL
                     THEN jsonb_set(quote, '{citation}', to_jsonb(r.after))
                   ELSE quote
                 END
                 -- Quote ids are referenced by position in the generated text,
                 -- so the array order has to survive the rebuild.
                 ORDER BY ordinality
               )
        FROM jsonb_array_elements(o.question->'quotes') WITH ORDINALITY AS t(quote, ordinality)
        LEFT JOIN repair r ON r.before = quote->>'citation'
      )
    )
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(o.question->'quotes', '[]'::jsonb)) AS quote
  JOIN repair r ON r.before = quote->>'citation'
);

-- Nothing may still carry a marker the repair above was written to remove. The
-- three exceptions documented at the top are not matched by these patterns.
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(DISTINCT citation, ' | ') INTO bad
  FROM (
    SELECT quote->>'citation' AS citation
    FROM public.open_questions o,
         jsonb_array_elements(COALESCE(o.question->'quotes', '[]'::jsonb)) AS quote
  ) c
  WHERE citation ~ '\s,' OR citation ~ '\s:' OR citation ~ ':\d'
     OR citation ~ '\)[א-ת]' OR citation ~ '\s''[א-ת]' OR citation ~ '\s\s';

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'citations still damaged: %', bad;
  END IF;
END $$;

COMMIT;
