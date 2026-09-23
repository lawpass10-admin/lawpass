-- One more real question classified: 2025-04-28 #82.
--
-- WHY IT WAS MISSED. 20260923000002 mapped the seven questions the first paper
-- was going to draw. Writing their reviews then ran out of API credit on the
-- last one (2026-06-23 #8), so the draw moved on to the next eligible question
-- — #82 — which had no law_id. The lesson is in the ordering: which questions a
-- paper draws is decided by which ones have a REVIEW, so the mapping has to
-- follow the reviews rather than a list made before they were written.
--
-- Its citation names the same statute as #74: "סעיפים 38, 80 לחוק ההוצאה לפועל,
-- התשכ״ז-1967" -> 2000249, already carrying the area הוצאה לפועל in
-- buckets_mapping.json.

UPDATE public.diuni_real_questions SET law_id = 2000249,
  law_name = 'חוק ההוצאה לפועל, תשכ״ז–1967'
 WHERE paper = '2025-04-28' AND number = 82;

-- Every question a paper can currently draw — that is, every REVIEWED one —
-- must be classified, or it reaches the dashboard as ללא סיווג.
DO $$
DECLARE
  unclassified integer;
BEGIN
  SELECT count(*) INTO unclassified
  FROM public.diuni_real_questions
  WHERE review IS NOT NULL AND law_id IS NULL;

  IF unclassified > 0 THEN
    RAISE EXCEPTION '% reviewed real question(s) have no law_id', unclassified;
  END IF;
END $$;
