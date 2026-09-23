-- Give a real question the law it tests, so an embedded one classifies like
-- every other question on the dashboard.
--
-- THE GAP THIS CLOSES. A generated question carries the id of the law or the
-- judgment it was built from, and the "תחום התמחות" charts resolve a topic from
-- that id (lawpass_server/db/legal-areas.js). A real question carries only the
-- citation the paper printed — "סעיף 23א לפקודת סדר הדין הפלילי (מעצר וחיפוש)
-- [נוסח חדש], תשכ״ט-1969" — which is prose, not an id. Embed seven of those in
-- a forty-question paper and seven of its questions report as "ללא סיווג".
--
-- The id is stored on the POOL row, not on the paper: it is a fact about the
-- question, so every paper that ever draws it inherits the classification, and
-- the mapping is done once per question rather than once per exam.
--
-- MAPPED BY HAND, and only where the citation names a law the corpus holds.
-- Several citations name two authorities — a statute and a judgment, or a
-- statute and the regulations under it — and the id recorded is the one the
-- ANSWER turns on. Left NULL where nothing matches, which reads as "not yet
-- classified" rather than as a guess.

ALTER TABLE public.diuni_real_questions
  ADD COLUMN IF NOT EXISTS law_id   integer,
  ADD COLUMN IF NOT EXISTS law_name text;

COMMENT ON COLUMN public.diuni_real_questions.law_id IS
  'mahoti_laws.law_id of the law the answer turns on, for the dashboard topic charts. NULL = not yet classified.';

-- The seven the first paper draws on. Each id was checked against
-- public.mahoti_laws by name before being written here.
UPDATE public.diuni_real_questions SET law_id = 2000952,
  law_name = 'פקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ״ט–1969'
 WHERE paper = '2025-04-28' AND number = 73;

UPDATE public.diuni_real_questions SET law_id = 2000249,
  law_name = 'חוק ההוצאה לפועל, תשכ״ז–1967'
 WHERE paper = '2025-04-28' AND number = 74;

UPDATE public.diuni_real_questions SET law_id = 1974064863,
  law_name = 'צו בתי המשפט (סוגי החלטות שלא תינתן בהן רשות ערעור), התשס״ט–2009'
 WHERE paper = '2025-04-28' AND number = 100;

UPDATE public.diuni_real_questions SET law_id = 1905833919,
  law_name = 'תקנות בתי המשפט (גישור), התשנ״ג–1993'
 WHERE paper = '2025-12-23' AND number = 43;

UPDATE public.diuni_real_questions SET law_id = 1931212498,
  law_name = 'תקנות סדר הדין האזרחי, התשע״ט–2018'
 WHERE paper = '2025-12-23' AND number IN (54, 69);

UPDATE public.diuni_real_questions SET law_id = 2000140,
  law_name = 'חוק בתי המשפט [נוסח משולב], התשמ״ד–1984'
 WHERE paper = '2026-06-23' AND number = 8;

-- Seven questions, six distinct laws (two cite תקנות סדר הדין האזרחי).
DO $$
DECLARE
  mapped integer;
BEGIN
  SELECT count(*) INTO mapped FROM public.diuni_real_questions WHERE law_id IS NOT NULL;
  IF mapped <> 7 THEN
    RAISE EXCEPTION 'expected 7 classified real questions, found %', mapped;
  END IF;
END $$;
