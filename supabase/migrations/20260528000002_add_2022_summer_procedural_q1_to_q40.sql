-- Migration: add_2022_summer_procedural_q1_to_q40
--
-- Source: 2024 winter substantive-law batch (פברואר 2024, חלק ג', דין מהותי).
-- Two .docx files from the LawPass Content Pipeline Drive folder:
--   * (דין מהותי) 1-20  JSON.docx
--   * (דין מהותי) 21-40.docx  (contains Q21–Q40, with one duplicate of Q23)
--
-- Pipeline: scripts/ingestion/{parse_docx,normalize,generate_migration}.py +
-- the per-batch classification at scripts/ingestion/classifications/
-- 2024_winter_substantive.json. Re-classifies every question against the
-- substantive taxonomy from migration 20260526000001 (the JSON's own
-- chapter/subtopic — procedural placeholders from a stale Nevo template —
-- is ignored). source_metadata is also derived from the folder path, not
-- from the JSON's stale 2019/summer default.
--
-- Drops:
--   * 2024-W-S-Q20 — exact-content dup of Q18 (same question_text + choices).
--   * 2024-W-S-Q27 — JSON structurally broken beyond automatic repair.
--   * one in-file Q23 duplicate (the second of two consecutive Q23 fences).
--
-- Idempotency: each DO $$ block early-returns (RAISE NOTICE) if its
-- external_id already exists. Safe to re-run.

-- ============================================================
-- Q01 — 2022-S-Q01 — chapter=civil_proc subtopic=proceedings
-- classifier_note: Appeal from registrar's fee-exemption decision — civil procedure interlocutory appeal
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '9fe95ea7-c3e5-4ed5-87c7-ba7417465d8a'::uuid;
  v_group_id uuid := '0526b8dc-ebbb-40cc-8f13-b49de87da7db'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'b8238e0a-4d40-45c6-be4b-b70c90f5277d'::uuid;
  v_ang_1 uuid := '626af142-318b-47f6-a730-f30e92b6fd4c'::uuid;
  v_ang_2 uuid := 'fb15ae6d-f51e-4a36-98ba-01966d61dd12'::uuid;
  v_ang_3 uuid := 'acb3db12-84c6-4fca-bbf5-97494744b0c3'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q01';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 1, '2022-S-Q01';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q01', v_chapter_id, v_subtopic_id, 'רשם בית משפט השלום קיבל את בקשת התובע לפטור מתשלום אגרה בעת הגשת התביעה. הנתבע מעוניין לערער על ההחלטה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 1}'::jsonb, 'שאלה זו עוסקת בסמכות הערעור על החלטה אחרת של רשם בית משפט השלום, ובפרט החלטה המעניקה פטור מאגרה. הדין מבחין בין סוגי החלטות וזהות הגורם השיפוטי לצורך קביעת מסלול הערעור.', 'סעיף 96(ב) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע כי ''החלטה אחרת של רשם שאינו רשם בכיר ניתנת לערעור לפני בית המשפט שבו הוא משמש רשם, ורשאי בית המשפט לדון בו בשופט אחד''. החלטה בדבר פטור מאגרה נחשבת ל''החלטה אחרת''. לפיכך, ערעור על החלטת רשם בית משפט השלום בעניין פטור מאגרה יוגש בזכות לבית משפט השלום. ראו גם רע"א 389/19 רוזנבלט נ'' כונס הנכסים הרשמי (28.5.2019) ורע"א 121/12 אברהם פלקסר נ'' בנק אוצר החייל בע"מ (4.6.2012).', 'טעות נפוצה היא לבלבל בין ערעור על ''החלטה אחרת'' של רשם לבין ערעור על ''החלטה אחרת'' של שופט, או בין רשם ''רגיל'' לרשם בכיר, מה שמוביל לבחירת ערכאת ערעור שגויה או לדרישה שגויה לרשות ערעור.',
    '["רשם בית משפט השלום", "החלטה אחרת", "ערעור בזכות", "חוק בתי המשפט", "פטור מאגרה"]'::jsonb, '**וריאציה 1 — רשם שלום - החלטה אחרת?** ← ערעור בזכות לשופט שלום (אותה ערכאה) לפי סעיף 96(ב) לחוק בתי המשפט.
**וריאציה 2 — רשם מחוזי - החלטה אחרת?** ← ערעור בזכות לשופט מחוזי (אותה ערכאה) לפי סעיף 96(ב) לחוק בתי המשפט.
**וריאציה 3 — שופט - החלטה אחרת?** ← בקשת רשות ערעור לערכאת הערעור (לפי סעיפים 41(ב) או 52(ב) לחוק בתי המשפט).', 'החלטה אחרת של רשם בית משפט השלום ← ערעור בזכות ← לבית משפט השלום (שופט יחיד).', '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 96(ב)", "רע\"א 389/19 אביגדור צבי רוזנבלט נ'' כונס הנכסים הרשמי (28.5.2019)", "רע\"א 121/12 אברהם פלקסר נ'' בנק אוצר החייל בע\"מ (4.6.2012)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Appeal from registrar''s fee-exemption decision — civil procedure interlocutory appeal', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'הנתבע רשאי לערער בזכות לבית המשפט המחוזי.', false, 'בחירה זו שגויה מכיוון שהיא מבלבלת בין ערכאת הערעור על החלטת רשם בית משפט השלום לבין ערכאת הערעור על פסק דין של רשם בית משפט השלום, או החלטה אחרת של רשם בכיר.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הנתבע רשאי לערער בזכות לבית משפט השלום.', true, 'החלטה אחרת של רשם בית משפט השלום ניתנת לערעור בזכות בפני שופט של בית משפט השלום שבו מכהן הרשם, בהתאם לסעיף 96(ב) לחוק בתי המשפט.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'הנתבע רשאי להגיש בקשת רשות ערעור לבית המשפט המחוזי.', false, 'בחירה זו שגויה מכיוון שהיא מתייחסת לבקשת רשות ערעור, בעוד שעל החלטה אחרת של רשם בית משפט השלום קיים ערעור בזכות, ולא נדרשת רשות.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הנתבע רשאי להגיש בקשת רשות ערעור לבית משפט השלום.', false, 'בחירה זו שגויה מכיוון שעל החלטה אחרת של רשם בית משפט השלום קיים ערעור בזכות, ולא נדרשת בקשת רשות ערעור. בנוסף, בקשת רשות ערעור מוגשת לערכאת הערעור, ולא לאותה ערכאה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'ערעור על החלטת רשם בית משפט מחוזי בעניין פטור מאגרה',
    1, 'רשם בית משפט מחוזי קיבל את בקשת התובע לפטור מתשלום אגרה בעת הגשת התביעה. הנתבע מעוניין לערער על ההחלטה. מה הדין?', 'שאלה זו בוחנת את הבנת דרך הערעור על ''החלטה אחרת'' של רשם בית משפט מחוזי, ובפרט החלטה בעניין פטור מאגרה. הכלל הוא שערעור על החלטה כזו יוגש בזכות בפני שופט של אותה ערכאה.', 'סעיף 96(ב) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע כי ''החלטה אחרת של רשם שאינו רשם בכיר ניתנת לערעור לפני בית המשפט שבו הוא משמש רשם, ורשאי בית המשפט לדון בו בשופט אחד''. החלטה בעניין פטור מאגרה נחשבת ל''החלטה אחרת''. לכן, ערעור על החלטת רשם בית משפט מחוזי בעניין פטור מאגרה יוגש בזכות לבית המשפט המחוזי. ראו גם רע"א 389/19 רוזנבלט נ'' כונס הנכסים הרשמי (28.5.2019).',
    'טעות נפוצה היא להניח שכל ערעור על החלטת רשם מחוזי יוגש לבית המשפט העליון, או שנדרשת רשות ערעור, בדומה להחלטות שופט.', '["רשם בית משפט מחוזי", "החלטה אחרת", "ערעור בזכות", "חוק בתי המשפט", "פטור מאגרה"]'::jsonb, '**וריאציה 1 — רשם מחוזי - החלטה אחרת?** ← ערעור בזכות לשופט מחוזי (אותה ערכאה) לפי סעיף 96(ב) לחוק בתי המשפט.
**וריאציה 2 — רשם שלום - החלטה אחרת?** ← ערעור בזכות לשופט שלום (אותה ערכאה) לפי סעיף 96(ב) לחוק בתי המשפט.
**וריאציה 3 — שופט - החלטה אחרת?** ← בקשת רשות ערעור לערכאת הערעור (לפי סעיפים 41(ב) או 52(ב) לחוק בתי המשפט).', 'החלטה אחרת של רשם בית משפט מחוזי ← ערעור בזכות ← לבית המשפט המחוזי (שופט יחיד).',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 96(ב)", "רע\"א 389/19 אביגדור צבי רוזנבלט נ'' כונס הנכסים הרשמי (28.5.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'הנתבע רשאי לערער בזכות לבית המשפט המחוזי.', true, 'החלטה אחרת של רשם בית משפט מחוזי ניתנת לערעור בזכות בפני שופט של בית המשפט המחוזי שבו מכהן הרשם, בהתאם לסעיף 96(ב) לחוק בתי המשפט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'הנתבע רשאי לערער בזכות לבית המשפט העליון.', false, 'בחירה זו שגויה מכיוון שערעור בזכות לבית המשפט העליון שמור לפסקי דין של רשם בית משפט מחוזי, ולא להחלטות אחרות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'הנתבע רשאי להגיש בקשת רשות ערעור לבית המשפט המחוזי.', false, 'בחירה זו שגויה מכיוון שעל החלטה אחרת של רשם בית משפט מחוזי קיים ערעור בזכות, ולא נדרשת בקשת רשות ערעור.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'הנתבע רשאי להגיש בקשת רשות ערעור לבית המשפט העליון.', false, 'בחירה זו שגויה מכיוון שעל החלטה אחרת של רשם בית משפט מחוזי קיים ערעור בזכות לבית המשפט המחוזי, ולא נדרשת בקשת רשות ערעור לבית המשפט העליון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'סיווג החלטת רשם המוחקת הליך בשל אי תשלום אגרה',
    2, 'רשם בית משפט מחוזי הורה על מחיקת הליך ערעורי בשל אי תשלום אגרה. כיצד תסווג החלטה זו לצורך ערעור?', 'שאלה זו עוסקת בסיווג המשפטי של החלטת רשם המוחקת הליך ערעורי בשל אי תשלום אגרה או אי הפקדת ערובה. ההלכה הפסוקה התפתחה וקבעה כי החלטה כזו, אף אם נראית כסופית, נחשבת ל''החלטה אחרת'' לצורך ערעור.', 'בית המשפט העליון קבע בהרכב של שלושה שופטים כי החלטת רשם המורה על מחיקת הליך ערעורי מחמת אי-תשלום אגרה או אי-הפקדת ערובה, אף אם הוכתרה כ"פסק דין", היא בגדר "החלטה אחרת". זאת, מאחר שעניינה טפל למחלוקת גופה ואינה סוגרת את הליך הערעור אלא מורה על אי-פתיחתו מעיקרו. לכן, ערעור עליה יוגש לבית המשפט שבו מכהן הרשם, בהתאם לסעיף 96(ב) לחוק בתי המשפט. ראו בע"מ 6162/24 פלוני נ'' פלונית (14.10.2024) וע"א 21063-11-24 אסף שפירא נ'' מכורה - כפר שיתופי בע"מ (20.01.2025).',
    'הטעות הנפוצה היא לסווג החלטה המוחקת הליך כ"פסק דין" באופן אוטומטי, מבלי להתחשב בהבחנה שנקבעה בפסיקה בין מחיקת תובענה למחיקת ערעור, ומבלי להבחין בין מהות ההחלטה לבין סיומה הפורמלי של התיק.', '["פסק דין", "החלטה אחרת", "מחיקת הליך", "אי תשלום אגרה", "סעיף 96 לחוק בתי המשפט", "הלכה מחייבת"]'::jsonb, '**וריאציה 1 — מחיקת הליך ערעורי עקב אגרה/ערובה (רשם)?** ← "החלטה אחרת", ערעור בזכות לאותה ערכאה (סעיף 96(ב) לחוק בתי המשפט).
**וריאציה 2 — הלכה קודמת (עמותת במות)?** ← התייחסה למחיקת תובענה בערכאה דיונית, לא למחיקת ערעור.
**וריאציה 3 — הלכה עדכנית (בע"מ 6162/24)?** ← מחיקת הליך ערעורי עקב אגרה/ערובה היא "החלטה אחרת".', 'החלטת רשם המוחקת הליך ערעורי בשל אי תשלום אגרה או אי הפקדת ערובה ← "החלטה אחרת" ← ערעור בזכות לבית המשפט שבו מכהן הרשם.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 96(ב)", "בע\"מ 6162/24 פלוני נ'' פלונית (14.10.2024)", "ע\"א 21063-11-24 אסף שפירא נ'' מכורה - כפר שיתופי בע\"מ (20.01.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כ"פסק דין" הניתן לערעור בזכות לבית המשפט העליון.', false, 'בחירה זו שגויה. בעבר הייתה קיימת גישה שראתה במחיקת הליך כ"פסק דין", אך ההלכה העדכנית קובעת אחרת במקרים של מחיקת הליך ערעורי בשל אי תשלום אגרה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'כ"החלטה אחרת" הניתנת לערעור בזכות לבית המשפט המחוזי.', true, 'הלכת בית המשפט העליון קובעת כי החלטת רשם המורה על מחיקת הליך ערעורי מחמת אי-תשלום אגרה או אי-הפקדת ערובה, אף אם הוכתרה כ"פסק דין", היא בגדר "החלטה אחרת" שערעור עליה יוגש לבית המשפט שבו מכהן הרשם, בהתאם לסעיף 96(ב) לחוק בתי המשפט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כ"פסק דין" הניתן לערעור ברשות לבית המשפט העליון.', false, 'בחירה זו שגויה. ההלכה העדכנית אינה מסווגת החלטה כזו כ"פסק דין" לצורך ערעור, וגם אם הייתה מסווגת כך, ערעור על פסק דין של רשם מחוזי הוא בזכות, לא ברשות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'כ"החלטה אחרת" הניתנת לערעור ברשות לבית המשפט המחוזי.', false, 'בחירה זו שגויה. אמנם ההחלטה מסווגת כ"החלטה אחרת", אך הערעור עליה הוא בזכות, ולא ברשות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'ערעור על החלטת רשם בענייני בוררות',
    3, 'רשם בית המשפט המחוזי קיבל בקשה למינוי בורר לפי חוק הבוררות. כיצד ניתן לערער על החלטה זו?', 'שאלה זו בוחנת את הידע לגבי הוראות ערעור ספציפיות החלות על החלטות רשם הניתנות מכוח חוק הבוררות. במקרים אלו, הוראות חוק הבוררות גוברות על הכללים הכלליים של סיווג החלטות רשם.', 'סעיף 38 לחוק הבוררות, תשכ"ח-1968, קובע כי החלטה של רשם לפי חוק זה ניתנת לערעור לפי סעיף 96(ב) לחוק בתי המשפט [נוסח משולב]. סעיף 96(ב) קובע כי החלטה אחרת של רשם ניתנת לערעור בזכות לפני בית המשפט שבו הוא משמש רשם. הפסיקה הבהירה כי הוראות אלו עדיפות על פני הוראתו הכללית של סעיף 96(א) לחוק בתי המשפט, וכי המדובר בכל החלטה של רשם לפי חוק הבוררות. ראו רע"א 3736/20 פלוני נ'' זאב רום (20.10.2020) ואורי גורן, בוררות (2018), פרק ו - רשמים, עמ'' 5.',
    'הטעות הנפוצה היא להחיל את הכללים הכלליים של ערעור על החלטות רשם (הבחנה בין ''פסק דין'' ל''החלטה אחרת'') גם על החלטות רשם לפי חוק הבוררות, במקום את ההוראה הספציפית הקבועה בחוק הבוררות.', '["חוק הבוררות", "סעיף 38 לחוק הבוררות", "סעיף 96(ב) לחוק בתי המשפט", "ערעור בזכות", "הוראה ספציפית גוברת"]'::jsonb, '**וריאציה 1 — החלטת רשם לפי חוק הבוררות?** ← ערעור בזכות לבית המשפט שבו מכהן הרשם (סעיף 38 לחוק הבוררות וסעיף 96(ב) לחוק בתי המשפט).
**וריאציה 2 — האם יש הבחנה בין "פסק דין" ל"החלטה אחרת" בחוק הבוררות?** ← לא, סעיף 38 חל על "כל החלטה".
**וריאציה 3 — האם הלכות קודמות סתרו זאת?** ← כן, אך ההלכה המאוחרת קבעה כי סעיף 38 גובר.', 'החלטת רשם לפי חוק הבוררות ← ערעור בזכות ← לבית המשפט שבו מכהן הרשם (הוראה ספציפית גוברת).',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 96(ב)", "רע\"א 3736/20 פלוני נ'' זאב רום (20.10.2020)", "אורי גורן, בוררות (2018), פרק ו - רשמים, עמ'' 5"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'ערעור בזכות לבית המשפט המחוזי.', true, 'סעיף 38 לחוק הבוררות, יחד עם סעיף 96(ב) לחוק בתי המשפט, קובע כי ערעור על כל החלטה של רשם לפי חוק הבוררות הוא בזכות, בפני בית המשפט שבו מכהן הרשם.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'ערעור בזכות לבית המשפט העליון.', false, 'בחירה זו שגויה. הוראות חוק הבוררות קובעות מסלול ערעור ספציפי לבית המשפט שבו מכהן הרשם, ולא לבית המשפט העליון.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בקשת רשות ערעור לבית המשפט המחוזי.', false, 'בחירה זו שגויה. על החלטת רשם לפי חוק הבוררות קיים ערעור בזכות, ולא נדרשת בקשת רשות ערעור.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בקשת רשות ערעור לבית המשפט העליון.', false, 'בחירה זו שגויה. על החלטת רשם לפי חוק הבוררות קיים ערעור בזכות לבית המשפט המחוזי, ולא נדרשת בקשת רשות ערעור לבית המשפט העליון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'פטור מהפקדת ערובה בערעור על החלטת רשם',
    4, 'ראובן הגיש ערעור בזכות על החלטה אחרת של רשם בית משפט השלום. האם ראובן חייב בהפקדת ערובה להבטחת הוצאות המשיב?', 'שאלה זו עוסקת בחובת הפקדת ערובה בערעור על ''החלטה אחרת'' של רשם. הדין קובע פטור סטטוטורי מהפקדת ערובה במקרים אלו, מתוך תפיסה להקל על בעלי דין המבקשים להביא את עניינם בפני שופט לאחר החלטת רשם.', 'התוספת השלישית לתקנות סדר הדין האזרחי, תשע"ט-2018, בפריט 79, קובעת שערעור על החלטת רשם שאינו רשם בכיר פטור מהפקדת ערובה. פטור זה עוגן בתקנות החדשות והוא משקף את הרציונל להקל על בעל דין המבקש לערער על החלטת רשם בפני שופט של אותה ערכאה, ולמנוע ''מעגל דיוני שוטה''. ראו רמ"ש (ת"א) 31279-05-23 מ'' פ'' נ'' ר'' א'' (16.6.2023) ובש"א 9397/11 מועב שירותי מזון בע"מ נ'' חנית נוב עו"ד (5.2.2012).',
    'הטעות הנפוצה היא להניח שחובת הפקדת ערובה חלה באופן גורף על כל הליך ערעורי, מבלי להכיר את הפטור הסטטוטורי הספציפי לערעורים על החלטות רשם.', '["ערובה להוצאות", "פטור מערובה", "ערעור על החלטת רשם", "תקנות סדר הדין האזרחי", "רשם שאינו רשם בכיר"]'::jsonb, '**וריאציה 1 — ערעור על החלטה אחרת של רשם (שאינו בכיר)?** ← פטור מערובה (פריט 79 לתוספת השלישית לתקנות סדר הדין האזרחי).
**וריאציה 2 — ערעור על פסק דין של רשם מחוזי?** ← חייב בערובה (למעט חריגים).
**וריאציה 3 — בקשת רשות ערעור על החלטת שופט?** ← חייב בערובה.', 'ערעור על החלטה אחרת של רשם שאינו רשם בכיר ← פטור סטטוטורי מהפקדת ערובה.',
    '["רמ\"ש (מחוזי תל אבי-יפו) 31279-05-23 מ'' פ'' נ'' ר'' א'' (16.6.2023)", "בש\"א 9397/11 מועב שירותי מזון בע\"מ נ'' חנית נוב עו\"ד (5.2.2012)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, סכומי הערובה להבטחת הוצאות המשיב בערעור (תקנה 135)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, אלא אם בית המשפט פטר אותו מכך מטעמים מיוחדים.', false, 'בחירה זו שגויה. ערעור על החלטה אחרת של רשם שאינו רשם בכיר פטור מהפקדת ערובה באופן סטטוטורי, ולא רק במקרים חריגים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, ערעור על החלטה אחרת של רשם פטור מהפקדת ערובה.', true, 'התוספת השלישית לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת פטור סטטוטורי מהפקדת ערובה בערעור על החלטה אחרת של רשם שאינו רשם בכיר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אך בית המשפט רשאי להפחית את סכום הערובה.', false, 'בחירה זו שגויה. אמנם לבית המשפט שיקול דעת להפחית סכום ערובה, אך במקרה זה קיים פטור מלא וסטטוטורי מהפקדת ערובה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'כן, אלא אם הערעור עוסק בפטור מאגרה, שאז הוא פטור מערובה.', false, 'בחירה זו שגויה. הפטור מהפקדת ערובה בערעור על החלטה אחרת של רשם אינו מוגבל רק למקרים של פטור מאגרה, אלא חל באופן כללי על כל החלטה אחרת של רשם שאינו רשם בכיר.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 1, '2022-S-Q01';
END
$$;

-- ============================================================
-- Q03 — 2022-S-Q03 — chapter=civil_proc subtopic=judge_recusal
-- classifier_note: Expert witness disclosing prior relationship with the judge — recusal grounds
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '806110b0-d18b-4fd4-b257-258cdf41071c'::uuid;
  v_group_id uuid := '4fb5f998-1353-4916-ab8e-89c055b9df57'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'fd738058-9b87-4343-8974-be0612c60c95'::uuid;
  v_ang_1 uuid := 'f807ebc4-75b0-4d2c-a294-e73bc28b02bd'::uuid;
  v_ang_2 uuid := '94eb06dd-e533-48fe-aa9f-5c24a5a12f95'::uuid;
  v_ang_3 uuid := 'f1fad60e-4380-4440-9034-42f79e6318ea'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q03';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 3, '2022-S-Q03';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'judge_recusal' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'judge_recusal', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q03', v_chapter_id, v_subtopic_id, 'ד"ר אבינועם התבקש, בהסכמת הצדדים, לשמש עד מומחה מטעם בית המשפט. ד"ר אבינועם הצהיר כי הוא והשופט הדן בתביעה למדו יחד בבית הספר היסודי 30 שנה קודם לכן. מהו הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 3}'::jsonb, 'שאלה זו עוסקת בסמכות בית המשפט לפסול מומחה מטעמו, ובפרט כאשר מתגלה קשר עבר בין המומחה לשופט. הדין מעניק לבית המשפט שיקול דעת רחב בעניין זה, מתוך מטרה לשמור על אובייקטיביות המומחה ועל מראית פני הצדק.', 'תקנה 89 לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי ''בית המשפט רשאי לפסול מומחה מטעמו אם מצא כי קיימת עילה לכך''. בניגוד לעילות פסלות שופטים המפורטות בסעיף 77א לחוק בתי המשפט, אשר הן רשימה סגורה יחסית, לגבי מומחים לבית המשפט שיקול דעת רחב יותר. קשר עבר בין המומחה לשופט, אף אם אינו מגיע כדי עילת פסלות שופט, יכול להקים חשש למראית עין של משוא פנים או ניגוד עניינים, ובית המשפט רשאי לשקול זאת במסגרת שיקול דעתו לפסול את המומחה. מטרת מינוי מומחה היא לסייע לבית המשפט באופן אובייקטיבי, וכל חשש לפגיעה באובייקטיביות זו מצדיק הפעלת שיקול דעת לפסילה. ראו רע"א 1007/07 בנק דיסקונט לישראל בע"מ נ'' שנפ (2007).', 'טעות נפוצה היא לבלבל בין עילות פסלות שופטים (רשימה סגורה יחסית) לבין עילות פסלות מומחים (שיקול דעת רחב יותר של בית המשפט), או להניח שרק קשרים עכשוויים רלוונטיים לפסילה.',
    '["מומחה מטעם בית המשפט", "פסלות מומחה", "שיקול דעת שיפוטי", "מראית פני הצדק", "תקנות סדר הדין האזרחי", "ניגוד עניינים"]'::jsonb, '**וריאציה 1 — רשם שלום - החלטה אחרת?** ← ערעור בזכות לשופט שלום (אותה ערכאה) לפי סעיף 96(ב) לחוק בתי המשפט.
**וריאציה 2 — רשם מחוזי - החלטה אחרת?** ← ערעור בזכות לשופט מחוזי (אותה ערכאה) לפי סעיף 96(ב) לחוק בתי המשפט.
**וריאציה 3 — שופט - החלטה אחרת?** ← בקשת רשות ערעור לערכאת הערעור (לפי סעיפים 41(ב) או 52(ב) לחוק בתי המשפט).', 'קשר עבר בין מומחה לשופט ← שיקול דעת ביהמ"ש לפסול ← למען מראית פני הצדק (תקנה 89 לתקנות סד"א).', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 89", "חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 77א", "רע\"א 1007/07 בנק דיסקונט לישראל בע\"מ נ'' שנפ, פ\"ד סב(1) 793 (2007)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''judge_recusal'' | classifier_note: Expert witness disclosing prior relationship with the judge — recusal grounds', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית המשפט רשאי לפסול את מינויו של ד"ר אבינועם כמומחה רק אם ביקש זאת אחד מבעלי הדין.', false, 'בחירה זו שגויה. בית המשפט רשאי לפסול מומחה מטעמו גם מיוזמתו, ולא רק לבקשת אחד מבעלי הדין, אם מצא עילה לכך.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט חייב לפסול את מינויו של ד"ר אבינועם אם ביקשו זאת שני הצדדים.', false, 'בחירה זו שגויה. בית המשפט אינו חייב לפסול מומחה מטעמו גם אם שני הצדדים ביקשו זאת, שכן המומחה משמש כזרועו הארוכה של בית המשפט ולא כעד מטעמם.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט רשאי לפסול את מינויו של ד"ר אבינועם כמומחה.', true, 'תקנה 89 לתקנות סדר הדין האזרחי, התשע"ט-2018, מעניקה לבית המשפט שיקול דעת רחב לפסול מומחה מטעמו אם מצא עילה לכך, לרבות חשש למראית עין של משוא פנים עקב קשר עבר עם השופט.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בנסיבות העניין בית המשפט אינו רשאי לפסול את מינוי של ד"ר אבינועם כמומחה.', false, 'בחירה זו שגויה. קשר עבר בין מומחה לשופט, אף אם אינו מגיע כדי עילת פסלות שופט מפורשת, יכול להקים חשש למראית עין של משוא פנים, ובית המשפט רשאי לשקול זאת במסגרת שיקול דעתו לפסול מומחה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'פסילת מומחה מטעם בית המשפט עקב קשר עסקי',
    1, 'ד"ר אבינועם התבקש, בהסכמת הצדדים, לשמש עד מומחה מטעם בית המשפט. התברר כי ד"ר אבינועם הוא שותף עסקי בחברה שבבעלות אחד הצדדים לתביעה. מהו הדין?', 'שאלה זו בוחנת את היקף שיקול הדעת של בית המשפט בפסילת מומחה מטעמו, כאשר קיים חשש ממשי לניגוד עניינים או משוא פנים עקב קשר עסקי עם אחד הצדדים. הדגש הוא על חשיבות האובייקטיביות והיעדר משוא פנים של מומחה בית המשפט.', 'תקנה 89 לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי בית המשפט רשאי לפסול מומחה מטעמו אם מצא כי קיימת עילה לכך. קשר עסקי פעיל עם אחד הצדדים יוצר חשש ממשי למשוא פנים או ניגוד עניינים, ועל כן בית המשפט רשאי, ואף עשוי לפסול, את המומחה. הפסיקה מדגישה את חשיבות מראית פני הצדק ואת אמון הציבור במומחים הממונים על ידי בית המשפט. ראו רע"א 1007/07 בנק דיסקונט לישראל בע"מ נ'' שנפ (2007).',
    'אי הבחנה בין עילות פסלות מפורשות לבין שיקול דעת רחב של בית המשפט במקרים של חשש לניגוד עניינים, או ההנחה שרק עילות פסלות שופטים חלות על מומחים.', '["מומחה מטעם בית המשפט", "ניגוד עניינים", "קשר עסקי", "שיקול דעת שיפוטי", "מראית פני הצדק", "תקנות סדר הדין האזרחי"]'::jsonb, '**וריאציה 1 — מומחה מטעם ביהמ"ש - קשר עסקי עם צד?** ← ביהמ"ש רשאי לפסול (תקנה 89 לתקנות סד"א).
**וריאציה 2 — מטרת מינוי מומחה?** ← סיוע לביהמ"ש באובייקטיביות.
**וריאציה 3 — האם קשר עסקי פוגע באובייקטיביות?** ← כן, יוצר חשש לניגוד עניינים ומראית עין.', 'קשר עסקי של מומחה עם צד ← עילה לפסילה בשיקול דעת ביהמ"ש ← למען אובייקטיביות ומראית עין.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 89", "רע\"א 1007/07 בנק דיסקונט לישראל בע\"מ נ'' שנפ, פ\"ד סב(1) 793 (2007)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'בית המשפט חייב לפסול את מינויו של ד"ר אבינועם כמומחה.', false, 'בחירה זו שגויה. למרות שקשר עסקי הוא עילה חזקה לפסילה, תקנה 89 מעניקה לבית המשפט שיקול דעת, ולא מחייבת פסילה אוטומטית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'בית המשפט רשאי לפסול את מינויו של ד"ר אבינועם כמומחה.', true, 'תקנה 89 לתקנות סדר הדין האזרחי, התשע"ט-2018, מעניקה לבית המשפט שיקול דעת רחב לפסול מומחה מטעמו אם קיים חשש למשוא פנים או ניגוד עניינים, וקשר עסקי הוא עילה מובהקת לכך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'בית המשפט אינו רשאי לפסול את מינויו של ד"ר אבינועם, אלא אם כן ביקשו זאת שני הצדדים.', false, 'בחירה זו שגויה. בית המשפט רשאי לפסול מומחה מטעמו גם מיוזמתו, ולא רק לבקשת הצדדים, אם קיים חשש לניגוד עניינים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'בנסיבות העניין בית המשפט אינו רשאי לפסול את מינוי של ד"ר אבינועם כמומחה.', false, 'בחירה זו שגויה. קשר עסקי פעיל עם אחד הצדדים יוצר חשש ממשי לניגוד עניינים ומשוא פנים, ומהווה עילה ברורה לפסילת מומחה מטעם בית המשפט.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מבחן פסילת מומחה מטעם בית המשפט',
    2, 'מהו המבחן המנחה את בית המשפט בהחלטתו אם לפסול מומחה מטעמו בשל חשש לניגוד עניינים?', 'שאלה זו מתמקדת במבחן המשפטי שנקבע בפסיקה להפעלת שיקול הדעת של בית המשפט בפסילת מומחה מטעמו. המבחן מדגיש את הצורך באובייקטיביות ובשמירה על אמון הציבור במערכת המשפט, גם במקרים בהם לא הוכחה הטיה בפועל.', 'הפסיקה קבעה כי המבחן לפסילת מומחה מטעם בית המשפט הוא מבחן אובייקטיבי של חשש ממשי למשוא פנים או ניגוד עניינים, ולא מבחן סובייקטיבי של המומחה או של הצדדים. המבחן לוקח בחשבון את מראית פני הצדק ואת אמון הציבור במערכת המשפט. אין צורך להוכיח הטיה בפועל, אלא די בחשש אובייקטיבי סביר. ראו רע"א 1007/07 בנק דיסקונט לישראל בע"מ נ'' שנפ (2007).',
    'בלבול בין המבחן האובייקטיבי למבחן הסובייקטיבי, או התמקדות בעילות פסלות שופטים במקום בעילות פסלות מומחים, אשר לגביהן לבית המשפט שיקול דעת רחב יותר.', '["מבחן אובייקטיבי", "חשש ממשי", "ניגוד עניינים", "משוא פנים", "מראית פני הצדק", "אמון הציבור", "פסילת מומחה"]'::jsonb, '**וריאציה 1 — מבחן פסילת מומחה?** ← חשש אובייקטיבי ממשי למשוא פנים/ניגוד עניינים (רע"א 1007/07).
**וריאציה 2 — האם נדרשת הוכחת הטיה בפועל?** ← לא, די בחשש סביר.
**וריאציה 3 — חשיבות מראית פני הצדק?** ← מרכיב מרכזי במבחן, לשמירת אמון הציבור.', 'פסילת מומחה ← מבחן אובייקטיבי של חשש ממשי ← למען מראית פני הצדק.',
    '["רע\"א 1007/07 בנק דיסקונט לישראל בע\"מ נ'' שנפ, פ\"ד סב(1) 793 (2007)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'מבחן סובייקטיבי של המומחה, האם הוא עצמו חש שהוא מוטה.', false, 'בחירה זו שגויה. המבחן אינו סובייקטיבי של המומחה, אלא אובייקטיבי, המתמקד בחשש סביר בעיני הציבור.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'מבחן סובייקטיבי של הצדדים, האם הם חשים שהמומחה מוטה.', false, 'בחירה זו שגויה. המבחן אינו סובייקטיבי של הצדדים, אלא אובייקטיבי, המתמקד בחשש סביר בעיני הציבור.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'מבחן אובייקטיבי של חשש ממשי למשוא פנים או ניגוד עניינים, תוך התחשבות במראית פני הצדק.', true, 'הפסיקה קבעה מבחן אובייקטיבי של חשש ממשי למשוא פנים או ניגוד עניינים, תוך דגש על מראית פני הצדק ואמון הציבור במערכת המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'רק עילות פסלות מפורשות הקבועות בחוק בתי המשפט, בשינויים המחויבים.', false, 'בחירה זו שגויה. עילות פסלות שופטים אינן חלות באופן זהה על מומחים, ולבית המשפט שיקול דעת רחב יותר לפסול מומחה גם ללא עילה מפורשת בחוק.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'פסילת מומחה מטעם בית המשפט בהסכמת הצדדים',
    3, 'ד"ר אבינועם מונה כמומחה מטעם בית המשפט. לאחר מינויו, שני הצדדים הודיעו לבית המשפט כי הם מסכימים לפסול את מינויו של ד"ר אבינועם, ללא נימוק מיוחד. מהו הדין?', 'שאלה זו בוחנת את מעמדה של הסכמת הצדדים לפסילת מומחה מטעם בית המשפט. למרות שהמומחה ממונה בהסכמתם, מרגע מינויו הוא משמש כזרועו הארוכה של בית המשפט, והסכמת הצדדים אינה מחייבת את בית המשפט, אלא מהווה שיקול חשוב.', 'מומחה הממונה מטעם בית המשפט אינו עד מטעם הצדדים, אלא זרועו הארוכה של בית המשפט. לכן, גם אם הצדדים מסכימים לפסול את מינויו, בית המשפט אינו כבול להסכמתם ויש לו שיקול דעת אם להיעתר לבקשה. עם זאת, הסכמה של שני הצדדים היא שיקול כבד משקל שבית המשפט ייתן לו חשיבות רבה, ובדרך כלל ייעתר לבקשה, אלא אם כן יש טעמים מיוחדים שלא לעשות כן. ראו רע"א 1007/07 בנק דיסקונט לישראל בע"מ נ'' שנפ (2007).',
    'ההנחה כי הסכמת הצדדים מחייבת את בית המשפט, בדומה למצב בו הם בוחרים מומחה מטעמם או מסכימים על עניין דיוני אחר.', '["מומחה מטעם בית המשפט", "הסכמת צדדים", "שיקול דעת שיפוטי", "מעמד המומחה", "זרועו הארוכה של בית המשפט", "תקנות סדר הדין האזרחי"]'::jsonb, '**וריאציה 1 — הסכמת צדדים לפסילת מומחה ביהמ"ש?** ← ביהמ"ש רשאי, אך לא חייב (שיקול דעת).
**וריאציה 2 — מדוע ביהמ"ש לא חייב?** ← המומחה הוא זרועו הארוכה של ביהמ"ש, לא של הצדדים.
**וריאציה 3 — האם הסכמה רלוונטית?** ← כן, שיקול כבד משקל, אך לא מחייב.', 'הסכמת צדדים לפסילת מומחה ביהמ"ש ← שיקול דעת ביהמ"ש ← לא מחייב.',
    '["רע\"א 1007/07 בנק דיסקונט לישראל בע\"מ נ'' שנפ, פ\"ד סב(1) 793 (2007)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט חייב לפסול את מינויו של ד"ר אבינועם.', false, 'בחירה זו שגויה. בית המשפט אינו כבול להסכמת הצדדים, שכן המומחה ממונה מטעמו ולא מטעמם, ויש לו שיקול דעת בעניין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בית המשפט אינו רשאי לפסול את מינויו של ד"ר אבינועם, שכן לא קיימת עילת פסלות מפורשת.', false, 'בחירה זו שגויה. לבית המשפט שיקול דעת רחב לפסול מומחה, גם ללא עילה מפורשת, והסכמת הצדדים היא שיקול חשוב.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט רשאי לפסול את מינויו של ד"ר אבינועם, אך אינו חייב לעשות כן.', true, 'מומחה הממונה מטעם בית המשפט הוא זרועו הארוכה של בית המשפט. לכן, גם אם הצדדים מסכימים לפסול את מינויו, בית המשפט אינו כבול להסכמתם ויש לו שיקול דעת אם להיעתר לבקשה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט אינו רשאי לפסול את מינויו של ד"ר אבינועם, אלא אם כן המומחה עצמו ביקש זאת.', false, 'בחירה זו שגויה. בית המשפט רשאי לפסול מומחה מטעמו גם מיוזמתו או לבקשת הצדדים, ואינו תלוי בבקשת המומחה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'ערעור על החלטה בעניין פסילת מומחה',
    4, 'בית המשפט דחה בקשה לפסול מומחה מטעמו. כיצד ניתן לערער על החלטה זו?', 'שאלה זו עוסקת בסיווגה של החלטה הדוחה בקשה לפסול מומחה מטעם בית המשפט, ובדרך הערעור עליה. ההבחנה בין ''פסק דין'' ל''החלטה אחרת'' ובין ערעור בזכות לערעור ברשות היא קריטית בסדר הדין האזרחי.', 'החלטה הדוחה בקשה לפסול מומחה מטעם בית המשפט אינה ''פסק דין'' שכן היא אינה מסיימת את ההתדיינות בתיק. היא נחשבת ל''החלטה אחרת'' כהגדרתה בחוק בתי המשפט. על ''החלטה אחרת'' שאינה סוגרת את התיק, ניתן לערער רק ברשות, בדרך של בקשת רשות ערעור, בהתאם לסעיפים 41(ב) (בשלום) או 52(ב) (במחוזי) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984. בקשת רשות הערעור תוגש לערכאת הערעור המוסמכת (מחוזי על שלום, עליון על מחוזי).',
    'בלבול בין ''פסק דין'' ל''החלטה אחרת'', או בין ערעור בזכות לערעור ברשות, במיוחד בהקשר של החלטות ביניים שאינן סוגרות את התיק.', '["החלטה אחרת", "בקשת רשות ערעור", "פסק דין", "סעיף 41(ב) לחוק בתי המשפט", "סעיף 52(ב) לחוק בתי המשפט", "סיווג החלטות"]'::jsonb, '**וריאציה 1 — החלטה הדוחה פסילת מומחה?** ← ''החלטה אחרת'' (לא סוגרת תיק).
**וריאציה 2 — ערעור על ''החלטה אחרת'' של שופט?** ← בקשת רשות ערעור (סעיפים 41(ב) או 52(ב) לחוק בתי המשפט).
**וריאציה 3 — ערכאת הערעור?** ← הערכאה שמעל הערכאה שנתנה את ההחלטה.', 'החלטה הדוחה פסילת מומחה ← ''החלטה אחרת'' ← ערעור ברשות לערכאה גבוהה יותר.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיפים 41(ב), 52(ב)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'בזכות, כחלק מהערעור על פסק הדין הסופי.', false, 'בחירה זו שגויה. החלטה בעניין פסילת מומחה אינה ''פסק דין'' ואינה ניתנת לערעור בזכות כחלק מערעור על פסק הדין הסופי, אלא כ''החלטה אחרת''.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'בזכות, בדרך של ערעור על ''החלטה אחרת''.', false, 'בחירה זו שגויה. החלטה בעניין פסילת מומחה היא ''החלטה אחרת'', אך ערעור עליה אינו בזכות אלא ברשות, שכן היא אינה סוגרת את התיק.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'ברשות, בדרך של בקשת רשות ערעור על ''החלטה אחרת''.', true, 'החלטה הדוחה בקשה לפסול מומחה היא ''החלטה אחרת'' שאינה סוגרת את התיק. לכן, ערעור עליה טעון רשות, בהתאם לסעיפים 41(ב) או 52(ב) לחוק בתי המשפט, ויוגש לערכאת הערעור המוסמכת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא ניתן לערער על החלטה זו, אלא רק להגיש בקשה לעיון מחדש בפני אותו בית משפט.', false, 'בחירה זו שגויה. ניתן לערער על החלטה זו, אך בדרך של בקשת רשות ערעור, ולא רק בדרך של עיון מחדש.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 3, '2022-S-Q03';
END
$$;

-- ============================================================
-- Q04 — 2022-S-Q04 — chapter=criminal_proc subtopic=charges_withdrawal  [needs_review]
-- classifier_note: Court-appointed defense counsel duration — no 'representation' subtopic in procedural taxonomy; flagged for review
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'fcd4f019-d522-473a-8ba6-842685de5868'::uuid;
  v_group_id uuid := 'f928f2e4-2ef4-4aa4-a22d-7ee49d97105f'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'bd8087d4-6bf2-4412-b355-87d632365ea8'::uuid;
  v_ang_1 uuid := '4871383b-a6e1-44fb-a2b2-02501cff576c'::uuid;
  v_ang_2 uuid := 'aaba329c-d397-4f78-95cc-199c9c5d46fd'::uuid;
  v_ang_3 uuid := '0d1180e6-96f0-4c57-a83d-4a73456539b3'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q04';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 4, '2022-S-Q04';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'charges_withdrawal' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'charges_withdrawal', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q04', v_chapter_id, v_subtopic_id, 'נגד אברהם הוגש כתב אישום לבית המשפט המחוזי בנצרת. אברהם אינו מיוצג על ידי עורך דין, לכן בדיון הראשון מינה בית המשפט את עו"ד ציפורי לייצגו ולא נתן כל הוראה בדבר משך הייצוג. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 4}'::jsonb, 'שאלה זו עוסקת בהיקף הייצוג של סנגור שמונה על ידי בית המשפט בהליך פלילי. סעיף 16 לחוק סדר הדין הפלילי קובע כלל רחב לפיו מינוי כזה חל על כל ההליכים בפני כל בתי המשפט הנוגעים לאותו כתב אישום, לרבות הליכי ערעור, אלא אם ניתנה הוראה מפורשת אחרת.', 'סעיף 16(א) לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע במפורש כי ''מינוי סנגור על ידי בית המשפט חל על כל ההליכים בפני כל בתי המשפט הנוגעים לאותו כתב אישום, לרבות הליכי ערעור, אלא אם כן הורה בית המשפט המוסמך לערעור הוראה אחרת''. כלל זה נועד להבטיח רציפות בייצוג הנאשם ולהגן על זכותו להליך הוגן, מבלי שיצטרך לדאוג למינוי סנגור חדש בכל ערכאה או שלב בהליך. לפיכך, עו"ד ציפורי ימשיך לייצג את אברהם גם בהליכי ערעור, אם יהיו כאלה, אלא אם בית המשפט של הערעור יורה אחרת. ראו גם בש"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019).', 'הטעות הנפוצה היא להניח שמינוי סנגור על ידי בית המשפט מוגבל לערכאה שמינתה אותו, או שאינו כולל הליכי ערעור, בדומה לכללים החלים על ייצוג פרטי או על מינויים אחרים.',
    '["מינוי סנגור", "היקף ייצוג", "חוק סדר הדין הפלילי", "הליכי ערעור", "זכות הייצוג", "רציפות ייצוג"]'::jsonb, '**וריאציה 1 — מינוי סנגור על ידי ביהמ"ש?** ← חל על כל ההליכים וכל בתי המשפט, כולל ערעור (סעיף 16(א) לחסד"פ).
**וריאציה 2 — מי יכול לשנות את היקף הייצוג?** ← רק בית המשפט המוסמך לערעור.
**וריאציה 3 — מה מטרת הכלל?** ← להבטיח רציפות ייצוג והליך הוגן לנאשם.', 'מינוי סנגור על ידי ביהמ"ש ← ייצוג בכל הערכאות ← כולל ערעור (אלא אם ביהמ"ש של הערעור מורה אחרת).', '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 16(א)", "בש\"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''הליכים'' → mapped chapter=''criminal_proc'' subtopic=''charges_withdrawal'' | classifier_note: Court-appointed defense counsel duration — no ''representation'' subtopic in procedural taxonomy; flagged for review', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'עו"ד ציפורי ייצג את אברהם בכל ההליכים בפני בתי המשפט הנוגעים לכתב אישום זה, לרבות בערעור.', true, 'סעיף 16(א) לחוק סדר הדין הפלילי קובע כי מינוי סנגור על ידי בית המשפט חל על כל ההליכים בפני כל בתי המשפט הנוגעים לאותו כתב אישום, לרבות הליכי ערעור.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'עו"ד ציפורי ייצג את אברהם בכל ההליכים הנוגעים לכתב אישום זה ומתנהלים בפני בית המשפט המחוזי בנצרת בלבד.', false, 'בחירה זו שגויה. סעיף 16(א) לחוק סדר הדין הפלילי קובע כי הייצוג חל על כל ההליכים בפני ''כל בתי המשפט'', ולא רק בפני הערכאה הממנה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'עו"ד ציפורי ייצג את אברהם בכל ההליכים הפליליים בפני בית המשפט המחוזי בנצרת.', false, 'בחירה זו שגויה. הייצוג אינו מוגבל רק לבית המשפט המחוזי בנצרת, אלא חל על כל בתי המשפט הנוגעים לכתב האישום, לרבות ערעור.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'עו"ד ציפורי ייצג את אברהם רק בהליך ההקראה של כתב האישום בפני בית המשפט המחוזי בנצרת.', false, 'בחירה זו שגויה. מינוי סנגור על ידי בית המשפט אינו מוגבל להליך ההקראה בלבד, אלא נועד לייצג את הנאשם לאורך כל ההליכים המשפטיים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'ייצוג בערעור פלילי לאחר מינוי בערכאה ראשונה',
    1, 'נגד ראובן הוגש כתב אישום לבית משפט השלום. בית המשפט מינה לו סנגור. ראובן הורשע ומעוניין לערער לבית המשפט המחוזי. האם הסנגור שמונה לו בבית משפט השלום ימשיך לייצגו בערעור?', 'שאלה זו בוחנת את היקף תחולתו של מינוי סנגור על ידי בית המשפט, ובפרט את המשכיות הייצוג לערכאת הערעור. הכלל הוא שהייצוג נמשך, אלא אם ניתנה הוראה מפורשת אחרת מבית המשפט של הערעור.', 'סעיף 16(א) לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי ''מינוי סנגור על ידי בית המשפט חל על כל ההליכים בפני כל בתי המשפט הנוגעים לאותו כתב אישום, לרבות הליכי ערעור, אלא אם כן הורה בית המשפט המוסמך לערעור הוראה אחרת''. מכאן שהסנגור שמונה לראובן בבית משפט השלום ימשיך לייצגו גם בערעור לבית המשפט המחוזי, אלא אם בית המשפט המחוזי יורה אחרת. ראו גם בש"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019).',
    'הטעות הנפוצה היא להניח שמינוי סנגור מוגבל לערכאה שמינתה אותו, בדומה למינוי מומחה או סוגי ייצוג אחרים, מבלי להכיר את ההוראה הספציפית בחוק סדר הדין הפלילי.', '["מינוי סנגור", "היקף ייצוג", "ערעור פלילי", "חוק סדר הדין הפלילי", "המשכיות ייצוג"]'::jsonb, '**וריאציה 1 — מינוי סנגור בערכאה ראשונה?** ← חל גם על ערעור (סעיף 16(א) לחסד"פ).
**וריאציה 2 — מי יכול לשנות זאת?** ← רק בית המשפט של הערעור.

**וריאציה 3 — האם נדרשת בקשה חדשה?** ← לא, הייצוג ממשיך אוטומטית.', 'מינוי סנגור בערכאה ראשונה ← ממשיך לערעור ← אלא אם ערכאת הערעור מורה אחרת.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 16(א)", "בש\"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, אלא אם בית המשפט המחוזי יורה אחרת.', true, 'סעיף 16(א) לחוק סדר הדין הפלילי קובע כי מינוי סנגור חל על כל ההליכים בפני כל בתי המשפט הנוגעים לאותו כתב אישום, לרבות ערעור, אלא אם בית המשפט המוסמך לערעור הורה אחרת.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, מינוי סנגור על ידי בית משפט השלום תקף רק לערכאה זו.', false, 'בחירה זו שגויה. סעיף 16(א) לחוק סדר הדין הפלילי מרחיב את תחולת המינוי לכל בתי המשפט הנוגעים לכתב האישום, כולל ערעור.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק אם בית משפט השלום הורה במפורש על המשך הייצוג בערעור.', false, 'בחירה זו שגויה. המשך הייצוג בערעור הוא ברירת המחדל הקבועה בחוק, ואינו דורש הוראה מפורשת מבית משפט השלום.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, ראובן יצטרך להגיש בקשה חדשה למינוי סנגור לבית המשפט המחוזי.', false, 'בחירה זו שגויה. אין צורך בבקשה חדשה, שכן המינוי המקורי חל גם על הליכי הערעור, אלא אם ניתנה הוראה ספציפית אחרת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאים למינוי סנגור חובה על ידי בית המשפט',
    2, 'באילו מקרים בית המשפט חייב למנות סנגור לנאשם שאינו מיוצג?', 'שאלה זו עוסקת בתנאים המקימים חובה על בית המשפט למנות סנגור לנאשם שאינו מיוצג. מדובר בהוראות יסוד בחוק סדר הדין הפלילי, שמטרתן להבטיח הליך הוגן ולהגן על זכויות נאשמים, במיוחד פגיעים או כאלה העומדים בפני עונשים חמורים.', 'סעיף 15(א) לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, מפרט את המקרים בהם חובה למנות סנגור לנאשם שאינו מיוצג. בין היתר, חובה זו קמה כאשר הנאשם קטין, עיוור, חירש או אילם, או כאשר הוא מואשם בעבירה שעונשה 10 שנות מאסר ומעלה, או כאשר התובע הודיע שיבקש מאסר בפועל. מטרת הוראה זו היא להבטיח ייצוג הולם לנאשמים במקרים בהם זכויותיהם עלולות להיפגע באופן משמעותי. ראו גם בש"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019).',
    'הטעות הנפוצה היא לזכור רק חלק מהעילות למינוי סנגור חובה, או לבלבל בינן לבין סמכות בית המשפט למנות סנגור גם במקרים אחרים (סעיף 15(ב)).', '["סנגור חובה", "זכות הייצוג", "חוק סדר הדין הפלילי", "נאשם קטין", "עבירה חמורה", "מאסר בפועל"]'::jsonb, '**וריאציה 1 — מתי חובה למנות סנגור?** ← סעיף 15(א) לחסד"פ: קטין, עיוור/חירש/אילם, עבירה מעל 10 שנות מאסר, תובע מבקש מאסר בפועל.
**וריאציה 2 — מתי רשאי למנות סנגור?** ← סעיף 15(ב) לחסד"פ: אם ראה לנכון למען עשיית צדק.
**וריאציה 3 — מה ההבדל בין סעיף 15(א) ל-15(ב)?** ← 15(א) - חובה, 15(ב) - שיקול דעת.', 'סנגור חובה ← מקרים ספציפיים בחוק (קטין, עבירה חמורה, מאסר בפועל) ← להבטחת הליך הוגן.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 15(א)", "בש\"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'רק כאשר הנאשם מואשם בעבירה שעונשה מאסר עולם או עונש מוות.', false, 'בחירה זו שגויה. זוהי רק אחת מהעילות למינוי סנגור חובה, וקיימות עילות נוספות המפורטות בחוק.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'כאשר הנאשם קטין, עיוור, חירש או אילם, או מואשם בעבירה שעונשה 10 שנות מאסר ומעלה, או כאשר התובע הודיע שיבקש מאסר בפועל.', true, 'סעיף 15(א) לחוק סדר הדין הפלילי מפרט את המקרים בהם חובה למנות סנגור לנאשם שאינו מיוצג, וכולל את כל העילות המפורטות בתשובה זו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'בכל מקרה שבו הנאשם אינו מיוצג, ללא קשר לסוג העבירה או מצבו האישי.', false, 'בחירה זו שגויה. חובת מינוי סנגור אינה גורפת לכל נאשם שאינו מיוצג, אלא מוגבלת למקרים ספציפיים המפורטים בחוק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'רק כאשר הנאשם ביקש זאת במפורש מבית המשפט.', false, 'בחירה זו שגויה. חובת המינוי קמה גם ללא בקשת הנאשם, במקרים המפורטים בחוק, מתוך הגנה על זכויותיו.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'סיום ייצוג סנגור ממונה ביוזמת הסנגור',
    3, 'עו"ד ציפורי מונה על ידי בית המשפט לייצג את אברהם. לאחר מספר דיונים, עו"ד ציפורי מעוניין להשתחרר מהייצוג. מה עליו לעשות?', 'שאלה זו עוסקת בהליך שחרור סנגור שמונה על ידי בית המשפט מייצוג. הדין מטיל מגבלות על סנגור כזה, שכן הוא משמש כזרועו הארוכה של בית המשפט להבטחת זכות הייצוג של הנאשם, ואינו יכול להשתחרר באופן חד-צדדי.', 'סעיף 17 לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי ''סנגור שמונה על ידי בית המשפט אינו רשאי להשתחרר מייצוג אלא ברשות בית המשפט, לאחר שהגיש בקשה מנומקת בכתב''. בית המשפט ישקול את הבקשה, את טובת הנאשם, את שלבי ההליך ואת הסיבות לשחרור. מטרת הוראה זו היא למנוע פגיעה בזכות הייצוג של הנאשם ולהבטיח רציפות בייצוג. ראו גם בש"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019).',
    'הטעות הנפוצה היא להניח שסנגור ממונה יכול להשתחרר מייצוג באותה קלות כמו סנגור פרטי, מבלי להכיר את ההוראה הספציפית בחוק המגבילה זאת.', '["שחרור מייצוג", "סנגור ממונה", "רשות בית המשפט", "חוק סדר הדין הפלילי", "זכות הייצוג", "רציפות ייצוג"]'::jsonb, '**וריאציה 1 — סנגור ממונה רוצה להשתחרר?** ← רק ברשות ביהמ"ש, בבקשה מנומקת (סעיף 17 לחסד"פ).
**וריאציה 2 — למה נדרשת רשות?** ← להבטיח את זכות הייצוג של הנאשם.
**וריאציה 3 — מה קורה אם ביהמ"ש מאשר?** ← ביהמ"ש ימנה סנגור אחר או יורה על דרך אחרת.', 'סנגור ממונה רוצה להשתחרר ← חייב אישור ביהמ"ש ← בבקשה מנומקת.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 17", "בש\"פ 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'להודיע לבית המשפט ולנאשם על רצונו להשתחרר מהייצוג, והייצוג יסתיים אוטומטית לאחר 7 ימים.', false, 'בחירה זו שגויה. סנגור שמונה על ידי בית המשפט אינו יכול להשתחרר מהייצוג באופן חד-צדדי, אלא נדרש אישור בית המשפט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'להגיש בקשה לבית המשפט בצירוף תצהיר המפרט את הסיבות לבקשה, ובית המשפט יחליט אם לאשר את השחרור.', true, 'סעיף 17 לחוק סדר הדין הפלילי קובע כי סנגור שמונה על ידי בית המשפט אינו רשאי להשתחרר מייצוג אלא ברשות בית המשפט, לאחר שהגיש בקשה מנומקת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'להודיע ללשכת עורכי הדין על רצונו להשתחרר מהייצוג, והלשכה תאשר זאת.', false, 'בחירה זו שגויה. לשכת עורכי הדין אינה הגורם המוסמך לאשר שחרור מייצוג שמונה על ידי בית המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'להודיע לנאשם על רצונו להשתחרר, ובלבד שהנאשם ימצא סנגור חלופי בתוך 30 יום.', false, 'בחירה זו שגויה. שחרור מייצוג ממונה אינו תלוי במציאת סנגור חלופי על ידי הנאשם, אלא באישור בית המשפט.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'ייצוג על ידי הסנגוריה הציבורית',
    4, 'אברהם, נגדו הוגש כתב אישום לבית המשפט המחוזי בנצרת, מעוניין שייצגו אותו עורכי דין מהסנגוריה הציבורית. מה עליו לעשות?', 'שאלה זו עוסקת במסלול הפנייה לקבלת ייצוג משפטי מהסנגוריה הציבורית. הסנגוריה הציבורית היא גוף עצמאי המעניק ייצוג משפטי לנאשמים העומדים בקריטריונים ספציפיים הקבועים בחוק, והפנייה אליה נעשית ישירות.', 'חוק הסנגוריה הציבורית, התשנ"ו-1995, מסדיר את פעילותה של הסנגוריה הציבורית. סעיף 18 לחוק קובע כי נאשם המעוניין בייצוג על ידי הסנגוריה הציבורית יגיש בקשה אליה, והיא תחליט אם לייצגו בהתאם לקריטריונים הקבועים בחוק (כגון עמידה במבחן זכאות כלכלי, סוג העבירה, ועוד). בית המשפט אינו הגורם הממנה את הסנגוריה הציבורית, אלא הסנגוריה עצמה היא הגוף המוסמך להחליט על מתן הייצוג. ראו גם חוק הסנגוריה הציבורית, סעיפים 18-19.',
    'הטעות הנפוצה היא לבלבל בין מינוי סנגור על ידי בית המשפט (לפי חוק סדר הדין הפלילי) לבין ייצוג על ידי הסנגוריה הציבורית (לפי חוק הסנגוריה הציבורית), ולהניח שבית המשפט הוא הגורם המורה לסנגוריה לייצג.', '["סנגוריה ציבורית", "חוק הסנגוריה הציבורית", "בקשה לייצוג", "קריטריוני זכאות", "ייצוג משפטי"]'::jsonb, '**וריאציה 1 — רוצה ייצוג מהסנגוריה הציבורית?** ← פונה ישירות לסנגוריה הציבורית (חוק הסנגוריה הציבורית).
**וריאציה 2 — מי מחליט על הייצוג?** ← הסנגוריה הציבורית, לפי קריטריונים.
**וריאציה 3 — האם ביהמ"ש ממנה את הסנגוריה?** ← לא, ביהמ"ש ממנה סנגור פרטי במקרים מסוימים, אך לא מורה לסנגוריה.', 'ייצוג מהסנגוריה הציבורית ← פנייה ישירה לסנגוריה ← החלטה לפי קריטריונים בחוק.',
    '["חוק הסנגוריה הציבורית, תשנ\"ו-1995, סעיפים 18, 19"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'להגיש בקשה לבית המשפט, ובית המשפט יורה לסנגוריה הציבורית לייצגו.', false, 'בחירה זו שגויה. בית המשפט אינו מורה לסנגוריה הציבורית לייצג, אלא הסנגוריה הציבורית היא הגוף המוסמך להחליט על ייצוג.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'להגיש בקשה לסנגוריה הציבורית, והיא תחליט אם לייצגו בהתאם לקריטריונים הקבועים בחוק.', true, 'חוק הסנגוריה הציבורית, התשנ"ו-1995, קובע כי נאשם המעוניין בייצוג על ידי הסנגוריה הציבורית יגיש בקשה אליה, והיא תחליט על כך בהתאם לקריטריונים הקבועים בחוק.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'להגיש בקשה ללשכת עורכי הדין, והיא תפנה אותו לסנגור מתאים.', false, 'בחירה זו שגויה. לשכת עורכי הדין אינה הגורם המוסמך למינוי סנגורים ציבוריים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'אין באפשרותו לבקש ייצוג מהסנגוריה הציבורית, אלא רק מינוי סנגור על ידי בית המשפט.', false, 'בחירה זו שגויה. הסנגוריה הציבורית היא גוף עצמאי המעניק ייצוג משפטי לנאשמים העומדים בקריטריונים, וניתן לפנות אליה בבקשה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 4, '2022-S-Q04';
END
$$;

-- ============================================================
-- Q05 — 2022-S-Q05 — chapter=civil_proc subtopic=proceedings
-- classifier_note: Temporary receiver (כונס נכסים זמני) appointment — interim relief in civil procedure
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '220626fe-989a-4107-a816-62fe1c38d1e5'::uuid;
  v_group_id uuid := '752d5bb2-c89d-49f5-8d3f-3c693d8719b4'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '5329e9b7-ee40-4818-83de-49ae175e6a9a'::uuid;
  v_ang_1 uuid := 'f378cf5f-7766-4469-90da-edb87f625b28'::uuid;
  v_ang_2 uuid := '6363176b-07ff-427e-8b30-d09225822421'::uuid;
  v_ang_3 uuid := '7a352d88-6487-45df-b56a-d559dfefc6e8'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q05';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 5, '2022-S-Q05';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q05', v_chapter_id, v_subtopic_id, 'באילו מקרים רשאי בית המשפט למנות כונס נכסים זמני על נכסים מסוימים שברשות המשיב?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 5}'::jsonb, 'שאלה זו עוסקת בתנאים למינוי כונס נכסים זמני על פי תקנה 111(א) לתקנות סדר הדין האזרחי, תשע"ט-2018. סעד זה, בהיותו חמור ופוגעני בקניינו של המשיב, ניתן במשורה ורק בהתקיים עילות מוגדרות ורף הוכחה גבוה של חשש ממשי לפגיעה בנכסים או ביכולת מימושם, וכן הכבדה ממשית על ביצוע פסק הדין.', 'תקנה 111(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, מפרטת את התנאים למינוי כונס נכסים זמני. בית המשפט רשאי למנות כונס אם שוכנע כי קיים חשש ממשי לפגיעה ניכרת בערכם של הנכסים או ביכולת מימושם, או לכך שהמשיב או אדם אחר מטעמו עומד להעלים את הנכסים או להשמידם, או כי הנכסים הופקו תוך ביצוע המעשה או המחדל נושא התביעה או שימשו לביצועו, וכי אי-מתן הצו יכביד באופן ממשי על ביצוע פסק הדין. הפסיקה מדגישה כי מדובר בסעד חמור המפקיע את שליטתו של אדם בקניינו עוד בטרם ניתן פסק דין, ולכן יש לתתו במשורה ובזהירות רבה. ראו רע"א 1608/13 ישראל קרויז נ'' יהודה אמיתי (2013) ות"א (מחוזי תל אביב-יפו) 65674-03-24 צמח-נדל"ן ובנין בע"מ נ'' בייקר סטריט וורקשופ גרופ בע"מ (2024).', 'טעות נפוצה היא לבלבל בין רמת החשש הנדרשת ("ממשי" לעומת "סביר") ובין רמת ההכבדה הנדרשת ("ממשי" לעומת "סביר"), או להתעלם מהדרישה הכפולה לקיומו של חשש ממשי והכבדה ממשית.',
    '["כינוס נכסים זמני", "תקנה 111", "חשש ממשי", "הכבדה ממשית", "סעד זמני", "פגיעה בקניין"]'::jsonb, '**וריאציה 1 — תנאי יסוד לכינוס נכסים זמני?** ← חשש ממשי לפגיעה/העלמה + הכבדה ממשית על ביצוע פסק הדין (תקנה 111(א) לתקנות סד"א).
**וריאציה 2 — האם סעד חמור?** ← כן, ניתן במשורה, פוגע בקניין (רע"א 1608/13 קרויז).
**וריאציה 3 — מה ההבדל בין "ממשי" ל"סביר"?** ← "ממשי" דורש רף הוכחה גבוה יותר של חשש וודאות.', 'כינוס נכסים זמני ← חשש ממשי לפגיעה/העלמה + הכבדה ממשית ← סעד חמור הניתן במשורה.', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 111(א)", "רע\"א 1608/13 ישראל קרויז נ'' יהודה אמיתי (8.4.2013)", "ת\"א (מחוזי תל אביב-יפו) 65674-03-24 צמח-נדל\"ן ובנין בע\"מ נ'' בייקר סטריט וורקשופ גרופ בע\"מ (27.5.2024)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Temporary receiver (כונס נכסים זמני) appointment — interim relief in civil procedure', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'אם שוכנע כי קיים חשש ממשי לפגיעה ניכרת בערכם של הנכסים או ביכולת מימושם וכי אי-מתן הצו יכביד באופן ממשי על ביצוע פסק הדין.', true, 'בחירה זו מדויקת ומשקפת את לשון תקנה 111(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, המפרטת את התנאים למינוי כונס נכסים זמני.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'אם שוכנע כי קיים חשש סביר לפגיעה ניכרת בערכם של הנכסים או ביכולת מימושם וכי אי-מתן הצו יכביד באופן ממשי על ביצוע פסק הדין.', false, 'בחירה זו שגויה מכיוון שהיא מציגה דרישה ל"חשש סביר" במקום ל"חשש ממשי", ובכך מורידה את רף ההוכחה הנדרש על פי תקנה 111(א) לתקנות סדר הדין האזרחי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אין אפשרות למנות כונס נכס זמני על פי התקנות החדשות.', false, 'בחירה זו שגויה לחלוטין. תקנות סדר הדין האזרחי, תשע"ט-2018, דווקא מעגנות ומפרטות את הסמכות למינוי כונס נכסים זמני בתקנה 111.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אם שוכנע כי קיים חשש ממשי לפגיעה ניכרת בערכם של הנכסים או ביכולת מימושם וכי אי-מתן הצו יכביד באופן סביר על ביצוע פסק הדין.', false, 'בחירה זו שגויה מכיוון שהיא מציגה דרישה ל"הכבדה באופן סביר" במקום ל"הכבדה באופן ממשי", ובכך מורידה את רף ההוכחה הנדרש על פי תקנה 111(א) לתקנות סדר הדין האזרחי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'מינוי כונס נכסים זמני במקרה של הברחת נכסים',
    1, 'ראובן הגיש תביעה כספית נגד שמעון. ראובן חושש ששמעון מנסה להעלים רכב יקר שבבעלותו כדי לסכל את גביית החוב. מהו הדין?', 'שאלה זו מיישמת את הוראות תקנה 111(א) לתקנות סדר הדין האזרחי על מקרה קונקרטי של חשש להברחת נכסים. היא מדגישה את תפקידו של כינוס הנכסים הזמני כאמצעי למנוע סיכול פסק דין עתידי, תוך שמירה על קניין המשיב.', 'תקנה 111(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי בית המשפט רשאי למנות כונס נכסים זמני אם שוכנע כי קיים חשש ממשי לכך שהמשיב עומד להעלים את הנכסים או להשמידם, וכי אי-מתן הצו יכביד באופן ממשי על ביצוע פסק הדין. הפסיקה תומכת במינוי כונס נכסים במקרים של חשש להברחת נכסים, כפי שניתן לראות בפסקי הדין ת"א (שלום נצרת) 32224-06-22 סבח נ'' רחמים (2022) ות"א (שלום נצרת) 15130-01-25 סבח נ'' אביתר (2025), בהם מונה כונס נכסים זמני על רכבים עקב חשש להעלמה.',
    'הטעות הנפוצה היא להניח שנדרשת הוכחה ודאית להברחה, במקום חשש ממשי, או אי-הבנה שתפקיד הסעד הזמני הוא למנוע את ההברחה ולא רק להגיב לה.', '["כינוס נכסים זמני", "הברחת נכסים", "תקנה 111(א)", "חשש ממשי", "סעד זמני"]'::jsonb, '**וריאציה 1 — חשש להעלמת נכס?** ← עילה לכינוס נכסים זמני (תקנה 111(א) לתקנות סד"א).
**וריאציה 2 — מה רמת החשש הנדרשת?** ← חשש ממשי.
**וריאציה 3 — מה מטרת הצו?** ← למנוע סיכול פסק דין עתידי.', 'חשש להעלמת נכסים ← כינוס נכסים זמני ← למנוע סיכול פסק דין.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 111(א)", "ת\"א (שלום נצרת) 32224-06-22 צ''רלי שלום סבח נ'' רמי(רחמים) רחמים (31.7.2022)", "ת\"א (שלום נצרת) 15130-01-25 צ''רלי סבח נ'' יצחק אביתר (2.2.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'בית המשפט רשאי למנות כונס נכסים זמני על הרכב, אם שוכנע כי קיים חשש ממשי להעלמת הנכס וכי אי-מתן הצו יכביד באופן ממשי על ביצוע פסק הדין.', true, 'בחירה זו מדויקת ומשקפת את לשון תקנה 111(א) לתקנות סדר הדין האזרחי, המציינת במפורש חשש להעלמת נכסים כאחת העילות למינוי כונס נכסים זמני.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'בית המשפט חייב למנות כונס נכסים זמני על הרכב, אם שוכנע כי קיים חשש ממשי להעלמת הנכס.', false, 'בחירה זו שגויה מכיוון שמינוי כונס נכסים זמני הוא סעד הנתון לשיקול דעתו של בית המשפט ("רשאי"), ולא חובה, גם אם מתקיימים התנאים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'בית המשפט רשאי למנות כונס נכסים זמני רק אם הוכח שהרכב כבר הועלם בפועל.', false, 'בחירה זו שגויה. מטרת הסעד הזמני היא למנוע את ההעלמה, ולכן די בחשש ממשי שהנכס "עומד להעלם", ולא נדרשת הוכחה שההעלמה כבר בוצעה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'בית המשפט רשאי למנות כונס נכסים זמני רק אם שווי הרכב עולה על סכום החוב הנתבע.', false, 'בחירה זו שגויה. שווי הנכס הוא שיקול שבית המשפט מביא בחשבון (תקנה 111(ב)), אך אינו תנאי סף יחיד ומכריע למינוי כונס נכסים זמני.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'שיקולים למתן צו כינוס נכסים זמני',
    2, 'בבואו להכריע בבקשה למינוי כונס נכסים זמני, אילו שיקולים נוספים, מעבר לתנאים המפורטים בתקנה 111(א), יביא בית המשפט בחשבון?', 'שאלה זו מתמקדת בשיקולים הספציפיים שעל בית המשפט להביא בחשבון בעת בחינת בקשה למינוי כונס נכסים זמני, כפי שמפורט בתקנה 111(ב) לתקנות סדר הדין האזרחי. היא מדגישה את הצורך באיזון בין האינטרסים של הצדדים ואת חומרת הסעד.', 'תקנה 111(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, מפרטת את השיקולים שבית המשפט הדן בבקשה למינוי כונס נכסים יביא בחשבון. אלה כוללים את סכום החוב או שווי הנושא, את הסכום שהכונס יכול להשיג לפי המשוער ממכירת הנכסים או ניהולם, את העלויות המשוערות הכרוכות במינויו ובביצוע תפקידו, ואת הנזק העלול להיגרם לנתבע עקב מכירת הנכסים או ניהולם בידי כונס. הפסיקה מדגישה כי מדובר בסעד חמור הניתן במשורה, וכי יש לנקוט זהירות רבה. ראו ת"א (מחוזי תל אביב-יפו) 65674-03-24 צמח-נדל"ן ובנין בע"מ נ'' בייקר סטריט וורקשופ גרופ בע"מ (2024).',
    'התעלמות מהשיקולים המפורטים בתקנה 111(ב) והתמקדות רק בתנאים הכלליים למתן סעד זמני (סיכויי תביעה ומאזן נוחות), או אי-הבנה שכל השיקולים המפורטים בתקנה 111(ב) רלוונטיים.', '["כינוס נכסים זמני", "שיקול דעת שיפוטי", "תקנה 111(ב)", "מאזן נוחות", "עלויות כינוס"]'::jsonb, '**וריאציה 1 — שיקולים ספציפיים לכינוס נכסים זמני?** ← סכום חוב/שווי נושא, סכום שהכונס ישיג, עלויות כינוס, נזק לנתבע (תקנה 111(ב) לתקנות סד"א).
**וריאציה 2 — האם אלה בנוסף לשיקולים הכלליים?** ← כן, בנוסף לסיכויי תביעה ומאזן נוחות כללי (תקנה 95).
**וריאציה 3 — מה חשיבות השיקולים הללו?** ← להבטיח שהסעד החמור מוצדק ומידתי.', 'כינוס נכסים זמני ← שיקולים ספציפיים (תקנה 111(ב)) ← בנוסף לשיקולים הכלליים.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 111(ב)", "ת\"א (מחוזי תל אביב-יפו) 65674-03-24 צמח-נדל\"ן ובנין בע\"מ נ'' בייקר סטריט וורקשופ גרופ בע\"מ (27.5.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'סכום החוב או שווי הנושא, הסכום שהכונס יכול להשיג, העלויות הכרוכות במינויו, והנזק העלול להיגרם לנתבע.', true, 'בחירה זו מדויקת ומשקפת את לשון תקנה 111(ב) לתקנות סדר הדין האזרחי, המפרטת את השיקולים הספציפיים שבית המשפט יביא בחשבון בעת בחינת בקשה למינוי כונס נכסים זמני.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'רק את סכום החוב או שווי הנושא.', false, 'בחירה זו שגויה מכיוון שהיא מתעלמת משיקולים חשובים נוספים המפורטים בתקנה 111(ב), כגון העלויות הכרוכות במינוי והנזק לנתבע.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'רק את הסכמת הצדדים למינוי הכונס.', false, 'בחירה זו שגויה. הסכמת הצדדים אינה תנאי סף למינוי כונס נכסים זמני, וגם אם קיימת, בית המשפט עדיין חייב לשקול את מכלול השיקולים המפורטים בתקנה 111(ב).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'רק את סיכויי התביעה ומאזן הנוחות הכללי.', false, 'בחירה זו שגויה. סיכויי התביעה ומאזן הנוחות הם שיקולים כלליים לכל סעד זמני (תקנה 95(ב)), אך תקנה 111(ב) מפרטת שיקולים ספציפיים נוספים לכינוס נכסים זמני.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'זהות בין סעד זמני לסעד עיקרי בכינוס נכסים',
    3, 'חברה הגישה תביעה לסעד הצהרתי לפיו הסכם הקצאת מניות בטל, ולחילופין לסעד של הפרדת כוחות מכוח סעיף 191 לחוק החברות. במקביל, ביקשה החברה למנות כונס נכסים זמני למכירת מניות החברה לצד ג''. מהו הדין?', 'שאלה זו עוסקת בכלל החשוב בסעדים זמניים לפיו אין לתת סעד זמני הזהה במהותו לסעד העיקרי. הכלל נועד למנוע הכרעה מוקדמת של ההליך העיקרי במסגרת הליך ביניים, והוא מקבל משנה תוקף כאשר מדובר בסעד חמור כמו כינוס נכסים זמני.', 'הפסיקה קובעת כי אין לתת סעד זמני הזהה לסעד העיקרי המבוקש, וכי זהות הסעדים כשלעצמה מהווה שיקול שלא להיעתר לבקשה, ולו מפני שאין מקום להכריע בהליך העיקרי במסגרת הליך מקדמי. כלל זה חל במיוחד על סעד של מינוי כונס נכסים זמני, הנחשב לסעד חמור המפקיע את שליטתו של אדם בקניינו. במקרה המתואר, מכירת המניות היא הסעד העיקרי המבוקש, ולכן מינוי כונס נכסים זמני למטרה זו יהווה זהות סעדים. ראו ת"א (מחוזי תל אביב-יפו) 65674-03-24 צמח-נדל"ן ובנין בע"מ נ'' בייקר סטריט וורקשופ גרופ בע"מ (2024) ורע"א 6685/17 הר של הצלחה וברכה בע"מ נ'' בנק הפועלים בע"מ (2017).',
    'הטעות הנפוצה היא להתמקד רק בתנאים הכלליים לכינוס נכסים זמני (חשש לפגיעה, הכבדה) ולהתעלם מהכלל הספציפי בדבר זהות בין הסעד הזמני לסעד העיקרי, אשר מהווה שיקול מכריע במקרים אלו.', '["כינוס נכסים זמני", "זהות סעדים", "סעד עיקרי", "סעד זמני", "הכרעה מוקדמת", "שיקול דעת שיפוטי"]'::jsonb, '**וריאציה 1 — סעד זמני זהה לסעד עיקרי?** ← ככלל, לא יינתן (רע"א 6685/17).
**וריאציה 2 — למה לא יינתן?** ← למנוע הכרעה בהליך העיקרי במסגרת הליך מקדמי.
**וריאציה 3 — האם יש חריגים?** ← לעיתים, במקרים חריגים וקיצוניים, אך הכלל הוא נגד.', 'סעד זמני זהה לעיקרי ← לא יינתן ← למנוע הכרעה מוקדמת.',
    '["ת\"א (מחוזי תל אביב-יפו) 65674-03-24 צמח-נדל\"ן ובנין בע\"מ נ'' בייקר סטריט וורקשופ גרופ בע\"מ (27.5.2024)", "רע\"א 6685/17 הר של הצלחה וברכה בע\"מ נ'' בנק הפועלים בע\"מ (10.9.2017)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט לא ימנה כונס נכסים זמני, שכן קיים כלל לפיו אין לתת סעד זמני הזהה לסעד העיקרי המבוקש.', true, 'בחירה זו נכונה. הפסיקה קובעת כי זהות בין הסעד הזמני לסעד העיקרי מהווה שיקול משמעותי שלא להיעתר לבקשה, במיוחד בסעד חמור ככינוס נכסים, כדי למנוע הכרעה בהליך העיקרי במסגרת הליך מקדמי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בית המשפט ימנה כונס נכסים זמני, שכן מטרת הסעד הזמני היא להבטיח את ביצוע פסק הדין העתידי.', false, 'בחירה זו שגויה. למרות שמטרת הסעד הזמני היא להבטיח את ביצוע פסק הדין, הכלל בדבר זהות בין הסעדים גובר במקרים רבים, במיוחד בסעד חמור כמו כינוס נכסים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט ימנה כונס נכסים זמני רק אם יוכח חשש ממשי לפגיעה בערך המניות.', false, 'בחירה זו שגויה. אף שחשש ממשי לפגיעה בערך הנכסים הוא תנאי למינוי כונס נכסים זמני (תקנה 111(א)), הוא אינו גובר על הכלל בדבר זהות בין הסעד הזמני לסעד העיקרי, המהווה שיקול עצמאי לדחיית הבקשה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט ימנה כונס נכסים זמני רק אם הצדדים הסכימו על כך.', false, 'בחירה זו שגויה. הסכמת הצדדים יכולה להקל על מינוי כונס, אך אינה תנאי הכרחי, וגם בהסכמה, בית המשפט עדיין שוקל את הכלל בדבר זהות בין הסעדים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'מינוי כונס נכסים זמני בפרויקט תמ"א 38',
    4, 'דיירים בפרויקט תמ"א 38 הגישו תביעה נגד היזם בגין איחור משמעותי בהשלמת הפרויקט, מצוקת מגורים ונזקים מתמשכים. הדיירים מבקשים למנות כונס נכסים זמני להשלמת הפרויקט. מהו הדין?', 'שאלה זו בוחנת את יישום סעד כינוס הנכסים הזמני בהקשר הספציפי של פרויקטי התחדשות עירונית (תמ"א 38). הפסיקה הכירה בחיוניותו של סעד זה במקרים של כשל יזמי, איחורים משמעותיים ומצוקת דיירים, תוך איזון בין הפגיעה בקניין היזם לבין הצורך להגן על זכויות הדיירים ולקדם את השלמת הפרויקט.', 'הפסיקה קבעה כי סעד של כינוס נכסים מתאים למצבים בהם אין מנוס מלהפקיע את שליטתו של אדם בנכס כדי להבטיח את שלמותו של הנכס או כדי למנוע את הברחתו. סעד זה, כשהוא ניתן כסעד זמני, הינו סעד שניתן במשורה, אך במקרים של פרויקטי תמ"א 38, כאשר היזם הפר את ההסכם, מיצה את תקופת החסד, וקיים נזק מתמשך לדיירים, בית המשפט רשאי למנות כונס נכסים זמני. המינוי נועד לקידום הפרויקט, מסירת הדירות וקבלת אישור אכלוס. ראו ת"א (מחוזי חי'') 48598-02-22 ורד זיסר נ'' ד.י יעד גלובל אחזקות נדל"ן והשקעות בע"מ (2023) ופר"ק (מחוזי ת"א) 30215-07-24 בנק ירושלים בע"מ נ'' הממונה על הליכי חדלות פירעון ושיקום כלכלי (2024).',
    'הטעות הנפוצה היא להניח שחומרת סעד כינוס הנכסים מונעת את מתן הסעד בפרויקטי תמ"א 38, מבלי להכיר את ההלכה המאפשרת זאת במקרים חריגים של כשל יזמי ומצוקת דיירים.', '["כינוס נכסים זמני", "פרויקט תמ\"א 38", "הפרת הסכם", "נזק מתמשך", "שיקול דעת שיפוטי", "השלמת פרויקט"]'::jsonb, '**וריאציה 1 — כשל יזמי בתמ"א 38?** ← עילה לכינוס נכסים זמני (ת"א (חי'') 48598-02-22).
**וריאציה 2 — מה מטרת הכינוס במקרה זה?** ← קידום והשלמת הפרויקט, מסירת דירות.
**וריאציה 3 — האם זה סעד חריג?** ← כן, אך מוצדק במקרים של הפרה מתמשכת ומצוקת דיירים.', 'כשל יזמי בתמ"א 38 ← כינוס נכסים זמני ← להשלמת הפרויקט והגנה על הדיירים.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 111", "ת\"א (מחוזי חי'') 48598-02-22 ורד זיסר נ'' ד.י יעד גלובל אחזקות נדל\"ן והשקעות בע\"מ (9.2.2023)", "פר\"ק (מחוזי ת\"א) 30215-07-24 בנק ירושלים בע\"מ נ'' הממונה על הליכי חדלות פירעון ושיקום כלכלי (9.12.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'בית המשפט רשאי למנות כונס נכסים זמני, אם שוכנע כי היזם הפר את ההסכם, מיצה את תקופת החסד, וכי מינוי הכונס חיוני לקידום הפרויקט ולמניעת נזק מתמשך לדיירים.', true, 'בחירה זו נכונה. הפסיקה מכירה באפשרות למינוי כונס נכסים זמני בפרויקטי תמ"א 38 במקרים של הפרות יזם, איחורים משמעותיים ומצוקת דיירים, כאשר הסעד חיוני להשלמת הפרויקט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'בית המשפט לא ימנה כונס נכסים זמני, שכן מדובר בסעד חמור המפקיע את שליטתו של היזם בנכסיו עוד בטרם ניתן פסק דין סופי.', false, 'בחירה זו שגויה. אף שכינוס נכסים הוא סעד חמור, הפסיקה קבעה כי במקרים מסוימים, ובמיוחד בפרויקטי תמ"א 38 בהם נגרם נזק מתמשך לדיירים, ניתן למנות כונס נכסים זמני גם לפני פסק דין.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'בית המשפט ימנה כונס נכסים זמני רק אם הדיירים השלימו את מלוא התמורה עבור דירותיהם.', false, 'בחירה זו שגויה. תשלום התמורה על ידי הדיירים הוא שיקול רלוונטי, אך אינו תנאי סף יחיד למינוי כונס נכסים זמני, במיוחד כאשר מדובר בהפרות יזם ואיחורים משמעותיים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'בית המשפט ימנה כונס נכסים זמני רק אם קיים חשש שהיזם עומד להעלים את נכסי הפרויקט.', false, 'בחירה זו שגויה. חשש להעלמת נכסים הוא אחת העילות למינוי כונס נכסים זמני (תקנה 111(א)), אך קיימות עילות נוספות, ובמקרים של פרויקטי בנייה, גם פגיעה ניכרת בערך הנכסים או ביכולת מימושם עקב אי-השלמת הפרויקט יכולה להצדיק מינוי כונס.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 5, '2022-S-Q05';
END
$$;

-- ============================================================
-- Q06 — 2022-S-Q06 — chapter=civil_proc subtopic=third_party_notice
-- classifier_note: Co-defendant filing third-party notice against another co-defendant in fast-track procedure
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '21a0bfd8-99f7-431a-8497-472cc8178f5f'::uuid;
  v_group_id uuid := '9027ba44-9d4f-49bf-8b47-2c46b8243aa7'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '12ecf06a-30b4-456b-b4c7-d5165c941277'::uuid;
  v_ang_1 uuid := 'c7da7261-1891-49ec-b79d-2d8496b3a97c'::uuid;
  v_ang_2 uuid := 'c410e5fa-effe-44a1-bb6a-8427af591ad5'::uuid;
  v_ang_3 uuid := '06498965-a177-49b8-8681-d1316b2be0ec'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q06';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 6, '2022-S-Q06';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'third_party_notice' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'third_party_notice', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q06', v_chapter_id, v_subtopic_id, 'משה הגיש נגד אמיר ונגד דוד תביעה בסדר דין מהיר. אמיר מעוניין להגיש נגד דוד הודעה לצד שלישי. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 6}'::jsonb, 'שאלה זו עוסקת בהליך הגשת הודעה לצד שלישי במסגרת תביעה בסדר דין מהיר, תחת תקנות סדר הדין האזרחי, התשע"ט-2018. הכלל הוא כי בתביעה בסדר דין מהיר, הגשת הודעה לצד שלישי טעונה רשות בית המשפט, וזאת בניגוד לתביעה אזרחית רגילה שאינה דורשת רשות כזו.', 'תקנה 80(ב) לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת במפורש כי ''במסגרת תביעה בדיון מהיר יש לבקש את אישור בית המשפט על מנת לשלוח הודעת צד שלישי''. הוראה זו מבחינה בין סדר דין מהיר לבין תביעה אזרחית רגילה, בה הגשת הודעה לצד שלישי אינה טעונה רשות בית המשפט (תקנה 22). הצורך ברשות בהליך מהיר נובע מהרצון לשמור על יעילות ומהירות ההליך, ולמנוע סרבול מיותר. הפסיקה, כפי שצוין ברע"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע"מ נ'' נתלי רום שושני (2025), אישרה כי גם תחת התקנות החדשות, בהליכים מיוחדים כמו תובענות ייצוגיות (והדבר נכון גם לסדר דין מהיר), נדרשת רשות בית המשפט להגשת הודעה לצד שלישי.', 'הטעות הנפוצה היא להניח כי הכלל החדש בתקנה 22, הפוטר את הנתבע מרשות בית המשפט בתביעה רגילה, חל באופן גורף על כל סוגי ההליכים, ובכך להתעלם מהוראות ספציפיות החלות על הליכים מיוחדים כמו סדר דין מהיר או תובענות ייצוגיות.',
    '["הודעה לצד שלישי", "סדר דין מהיר", "רשות בית המשפט", "תקנה 80(ב) לתקנות סד\"א החדשות", "יעילות דיונית", "הליכים מיוחדים"]'::jsonb, '**וריאציה 1 — הודעה לצד שלישי בסדר דין מהיר?** ← טעונה רשות בית המשפט (תקנה 80(ב) לתקנות סד"א החדשות).
**וריאציה 2 — למה רשות?** ← לשמור על יעילות ומהירות ההליך.
**וריאציה 3 — מה ההבדל מתביעה רגילה?** ← בתביעה רגילה אין צורך ברשות (תקנה 22 לתקנות סד"א החדשות).', 'הודעה לצד שלישי בסדר דין מהיר ← טעונה רשות ביהמ"ש ← לשמירה על יעילות ההליך.', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 80(ב)", "רע\"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע\"מ נ'' נתלי רום שושני (26.6.2025)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''third_party_notice'' | classifier_note: Co-defendant filing third-party notice against another co-defendant in fast-track procedure', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'אמיר רשאי להגיש נגד דוד הודעה לצד שלישי ברשות בית המשפט.', true, 'תקנה 80(ב) לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי במסגרת תביעה בסדר דין מהיר, נדרש אישור בית המשפט לשליחת הודעה לצד שלישי.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'אמיר אינו רשאי להגיש נגד דוד הודעה לצד שלישי, שכן דוד הוא בעל דין בתובענה.', false, 'בחירה זו שגויה. תקנה 22 לתקנות סדר הדין האזרחי, התשע"ט-2018, מאפשרת הגשת הודעה לצד שלישי גם נגד אדם שהוא כבר בעל דין בתובענה, אם מתקיימים התנאים לכך.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בתביעה בסדר דין מהיר לא ניתן להגיש תביעה שכנגד ולא הודעה לצד שלישי.', false, 'בחירה זו שגויה. ניתן להגיש הודעה לצד שלישי בתביעה בסדר דין מהיר, אך הדבר טעון רשות בית המשפט, כאמור בתקנה 80(ב) לתקנות סדר הדין האזרחי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אמיר רשאי להגיש נגד דוד הודעה לצד שלישי, בלא צורך ברשות בית המשפט, ובלבד שנושאה של ההודעה לצד שלישי ונושא התובענה הוא אחד או שהן נובעות מאותן הנסיבות.', false, 'בחירה זו שגויה. אף שתנאי הקשר העובדתי/משפטי רלוונטיים לעצם האפשרות להגיש הודעה לצד שלישי (תקנה 22), בתביעה בסדר דין מהיר נדרשת רשות בית המשפט, בניגוד לתביעה אזרחית רגילה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'הודעה לצד שלישי בתביעה אזרחית רגילה',
    1, 'ראובן הגיש נגד שמעון תביעה כספית בסדר דין רגיל. שמעון מעוניין להגיש נגד לוי הודעה לצד שלישי בטענה לשיפוי. מה הדין?', 'שאלה זו בוחנת את הכלל הבסיסי לגבי הגשת הודעה לצד שלישי בתביעה אזרחית רגילה תחת תקנות סדר הדין האזרחי החדשות. בניגוד להליכים מיוחדים, בתביעה רגילה אין צורך ברשות בית המשפט להגשת הודעה לצד שלישי, וזאת מתוך תכליות של יעילות ומניעת הכרעות סותרות.', 'תקנה 22 לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי נתבע רשאי לתת הודעה לצד שלישי לכל אדם, במקרים שבהם הוא זכאי ממנו להשתתפות, לשיפוי או לביצוע פעולה בנוגע לסעד הנתבע ממנו, או אם מתקיים קשר עובדתי או משפטי משותף בסוגיה שבינו ובין הצד השלישי, הכרוכה בנושא התובענה. בניגוד לתקנות הישנות (תקנה 217), התקנות החדשות ביטלו את הצורך ברשות בית המשפט להגשת הודעה לצד שלישי בתביעה אזרחית רגילה. זאת, למעט הליכים מיוחדים כגון תובענות ייצוגיות או סדר דין מהיר. ראו רע"א 41579-11-25 אביטל פרדו נ'' גיבוי אחזקות בע"מ (2025) ורע"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע"מ נ'' נתלי רום שושני (2025).',
    'הטעות הנפוצה היא להניח שגם בתביעה אזרחית רגילה נדרשת רשות בית המשפט להגשת הודעה לצד שלישי, בלבול הנובע מהכללים שחלו בתקנות הישנות או מהכללים החלים בהליכים מיוחדים.', '["הודעה לצד שלישי", "תקנה 22 לתקנות סד\"א החדשות", "תביעה אזרחית רגילה", "שיפוי והשתתפות", "יעילות דיונית"]'::jsonb, '**וריאציה 1 — הודעה לצד שלישי בתביעה רגילה?** ← ללא רשות בית המשפט (תקנה 22 לתקנות סד"א החדשות).
**וריאציה 2 — מה המטרה?** ← יעילות ומניעת הכרעות סותרות.
**וריאציה 3 — האם יש חריגים?** ← כן, בהליכים מיוחדים כמו ייצוגית או מהיר נדרשת רשות.', 'הודעה לצד שלישי בתביעה רגילה ← ללא רשות ביהמ"ש ← למען יעילות ומניעת הכרעות סותרות.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 22", "רע\"א 41579-11-25 אביטל פרדו נ'' גיבוי אחזקות בע\"מ (18.12.2025)", "רע\"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע\"מ נ'' נתלי רום שושני (26.6.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'שמעון רשאי להגיש נגד לוי הודעה לצד שלישי בלא צורך ברשות בית המשפט.', true, 'תקנה 22 לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי נתבע רשאי לתת הודעה לצד שלישי במקרים המפורטים בה, ללא צורך באישור בית המשפט, בתביעה אזרחית רגילה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'שמעון רשאי להגיש נגד לוי הודעה לצד שלישי רק ברשות בית המשפט.', false, 'בחירה זו שגויה. הצורך ברשות בית המשפט להגשת הודעה לצד שלישי קיים רק בהליכים מסוימים, כגון תובענה ייצוגית או סדר דין מהיר, ולא בתביעה אזרחית רגילה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'שמעון אינו רשאי להגיש נגד לוי הודעה לצד שלישי, אלא עליו להגיש תביעה נפרדת.', false, 'בחירה זו שגויה. הגשת הודעה לצד שלישי היא זכות דיונית המאפשרת לנתבע לצרף צד שלישי להליך הקיים, במקום להגיש תביעה נפרדת, לשם יעילות ומניעת הכרעות סותרות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'שמעון רשאי להגיש נגד לוי הודעה לצד שלישי רק אם לוי אינו בעל דין בתובענה.', false, 'בחירה זו שגויה. תקנה 22 לתקנות סדר הדין האזרחי מאפשרת הגשת הודעה לצד שלישי גם נגד אדם שהוא כבר בעל דין בתובענה, אם מתקיימים התנאים לכך.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תכליות הגשת הודעה לצד שלישי',
    2, 'מהן התכליות העיקריות העומדות בבסיס האפשרות להגיש הודעה לצד שלישי?', 'שאלה זו מתמקדת בתכליות העיקריות של הליך ההודעה לצד שלישי, כפי שהן מודגשות בפסיקה. תכליות אלו, של מניעת הכרעות סותרות וחיסכון במשאבים, הן אבני היסוד להבנת חשיבותו של הליך זה בסדר הדין האזרחי.', 'הפסיקה עמדה על שתי תכליות עיקריות להגשת הודעה לצד שלישי: ראשית, מניעת הכרעות סותרות, שכן ההודעה מאפשרת לקשור את הצד השלישי לתוצאות התובענה העיקרית. שנית, חיסכון במשאבים שיפוטיים ושל בעלי הדין, בכך שנמנע הצורך בניהול הליך נפרד ודומה. תכליות אלו הודגשו בפסקי דין רבים, לרבות רע"א 5635/13 קורל-תל בע"מ נ'' אביהוא רז (2015), רע"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע"מ נ'' נתלי רום שושני (2025), ורע"א 41579-11-25 אביטל פרדו נ'' גיבוי אחזקות בע"מ (2025).',
    'הטעות הנפוצה היא לבלבל בין תכליות ההליך לבין תוצאות לוואי אפשריות שלו (כמו סרבול), או לייחס לו מטרות שאינן חלק מהרציונל המשפטי שלו.', '["הודעה לצד שלישי", "מניעת הכרעות סותרות", "יעילות דיונית", "חיסכון במשאבים", "תביעה על תנאי"]'::jsonb, '**וריאציה 1 — תכליות הודעה לצד שלישי?** ← מניעת הכרעות סותרות וחיסכון במשאבים (רע"א 5635/13 קורל-תל).
**וריאציה 2 — מהי ''תביעה על תנאי''?** ← הודעה לצד שלישי, שכן היא תלויה בתוצאות התביעה העיקרית.
**וריאציה 3 — למה חשוב למנוע הכרעות סותרות?** ← כדי שהנתבע לא ימצא עצמו ''קירח מכאן ומכאן''.', 'הודעה לצד שלישי ← מניעת הכרעות סותרות + חיסכון במשאבים ← תביעה על תנאי.',
    '["רע\"א 5635/13 קורל-תל בע\"מ נ'' אביהוא רז (1.4.2015)", "רע\"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע\"מ נ'' נתלי רום שושני (26.6.2025)", "רע\"א 41579-11-25 אביטל פרדו נ'' גיבוי אחזקות בע\"מ (18.12.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'מניעת הכרעות סותרות וחיסכון במשאבים שיפוטיים ושל בעלי הדין.', true, 'בחירה זו משקפת את שתי התכליות העיקריות של הגשת הודעה לצד שלישי, כפי שנקבעו בפסיקה: מניעת הכרעות סותרות וייעול ההליך המשפטי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'הארכת משך ההליך כדי לאפשר לצדדים להגיע לפשרה.', false, 'בחירה זו שגויה. הגשת הודעה לצד שלישי עלולה לעיתים לסרבל את ההליך, אך זו אינה תכליתה, אלא תוצאה לוואי אפשרית. תכליתה היא דווקא ייעול וחיסכון במשאבים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'העברת נטל ההוכחה מהנתבע לצד השלישי.', false, 'בחירה זו שגויה. הגשת הודעה לצד שלישי אינה משנה את נטל ההוכחה בתביעה העיקרית, אלא יוצרת הליך נפרד בין הנתבע לצד השלישי, בו הנתבע הוא התובע ועליו נטל ההוכחה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'מתן אפשרות לצד שלישי להגיש תביעה שכנגד נגד התובע המקורי.', false, 'בחירה זו שגויה. לצד שלישי יש זכות להתגונן מפני ההודעה ולטעון נגד התביעה העיקרית, אך לא להגיש תביעה שכנגד נגד התובע המקורי במסגרת ההודעה לצד שלישי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'מועד הגשת בקשה להודעה לצד שלישי בתובענה ייצוגית',
    3, 'חברה נתבעה בתובענה ייצוגית. מתי עליה להגיש בקשה לבית המשפט להתיר לה לשלוח הודעה לצד שלישי?', 'שאלה זו מתייחסת למועד הספציפי להגשת בקשה לרשות לשלוח הודעה לצד שלישי בהליך של תובענה ייצוגית. הלכת קורל-תל קבעה מועד זה מתוך שיקולי יעילות דיונית והתאמה למאפיינים הייחודיים של התובענה הייצוגית.', 'הלכת רע"א 5635/13 קורל-תל בע"מ נ'' אביהוא רז (2015) קבעה הסדר ייחודי להגשת הודעה לצד שלישי בתובענה ייצוגית. בין היתר, נקבע כי בקשת הרשות להגיש הודעה לצד שלישי תוגש במועד הגשת תשובת הנתבע לבקשה לאישור התובענה הייצוגית (בדומה לכלל שבהליכים אזרחיים רגילים יש להגישה בעת הגשת כתב ההגנה). מועד זה, שהוא 90 יום מעת שהבקשה לאישור תובענה כייצוגית הומצאה למשיב, נועד לאפשר דיון בבקשה בשלב מוקדם ככל הניתן. ראו רע"א 5635/13 קורל-תל בע"מ נ'' אביהוא רז (2015) ורע"א 5820/19 שופרסל בע"מ נ'' אברהם אלעד גריינר (2020).',
    'הטעות הנפוצה היא לבלבל בין המועד להגשת הודעה לצד שלישי בתביעה רגילה לבין המועד המיוחד שנקבע לתובענה ייצוגית, או להתעלם מהצורך ברשות בית המשפט בהליך הייצוגי.', '["תובענה ייצוגית", "הודעה לצד שלישי", "מועד הגשה", "רשות בית המשפט", "הלכת קורל-תל", "יעילות דיונית"]'::jsonb, '**וריאציה 1 — מועד הגשת בקשה להודעה לצד שלישי בייצוגית?** ← עם תשובת הנתבע לבקשת האישור (הלכת קורל-תל).
**וריאציה 2 — למה מועד זה?** ← יעילות דיונית ודיון מוקדם.
**וריאציה 3 — האם נדרשת רשות?** ← כן, תמיד בהליך ייצוגי.', 'הודעה לצד שלישי בייצוגית ← עם תשובת הנתבע לבקשת האישור ← טעון רשות ביהמ"ש.',
    '["רע\"א 5635/13 קורל-תל בע\"מ נ'' אביהוא רז (1.4.2015)", "רע\"א 5820/19 שופרסל בע\"מ נ'' אברהם אלעד גריינר (30.1.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'במועד הגשת תשובת הנתבע לבקשה לאישור התובענה הייצוגית.', true, 'הלכת קורל-תל (רע"א 5635/13) קבעה כי בתובענה ייצוגית, בקשת הרשות להגיש הודעה לצד שלישי תוגש במועד הגשת תשובת הנתבע לבקשה לאישור התובענה הייצוגית, וזאת לשם יעילות דיונית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בתוך 30 ימים מיום המצאת כתב התביעה.', false, 'בחירה זו שגויה. מועד זה היה רלוונטי לחלק מהמקרים בתקנות סדר הדין האזרחי הישנות (תקנה 217), אך לא להליך הייצוגי, שלגביו נקבע מועד ספציפי בהלכת קורל-תל.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'לאחר אישור התובענה הייצוגית, ובטרם הגשת כתב הגנה בתובענה העיקרית.', false, 'בחירה זו שגויה. המועד שנקבע הוא בשלב בקשת האישור, ולא לאחר אישור התובענה, כדי לאפשר דיון מוקדם ויעיל.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בכל שלב של ההליך, לפי שיקול דעת בית המשפט.', false, 'בחירה זו שגויה. אף שלבית המשפט שיקול דעת להאריך מועדים, קיים מועד מוגדר להגשת הבקשה, וסטייה ממנו דורשת טעמים מיוחדים, במיוחד תחת התקנות החדשות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'ערעור על החלטה הדוחה בקשה להודעה לצד שלישי',
    4, 'בית המשפט דחה בקשה של נתבע לשלוח הודעה לצד שלישי. כיצד ניתן לערער על החלטה זו?', 'שאלה זו עוסקת בסיווגה של החלטה הדוחה בקשה לשלוח הודעה לצד שלישי, ובדרך הערעור עליה. ההבחנה בין ''פסק דין'' ל''החלטה אחרת'' ובין ערעור בזכות לערעור ברשות היא קריטית בסדר הדין האזרחי, והפסיקה קבעה כי החלטה כזו היא ''החלטה אחרת'' הטעונה רשות ערעור.', 'החלטה הדוחה בקשה לשלוח הודעה לצד שלישי אינה ''פסק דין'' שכן היא אינה מסיימת את ההתדיינות בתיק. היא נחשבת ל''החלטה אחרת'' כהגדרתה בחוק בתי המשפט. על ''החלטה אחרת'' שאינה סוגרת את התיק, ניתן לערער רק ברשות, בדרך של בקשת רשות ערעור, בהתאם לסעיפים 41(ב) (בשלום) או 52(ב) (במחוזי) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984. הפסיקה מדגישה כי אף שמדובר בהחלטה דיונית, יש לה היבט מהותי העשוי להצדיק התערבות במקרים מתאימים. ראו רע"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע"מ נ'' נתלי רום שושני (2025), רע"א 8644/15 כלל חברה לביטוח בע"מ נ'' ארנה וייץ (2016) ורע"א 7848/18 מדינת ישראל (משרד התחבורה- רשות הספנות והנמלים) נ'' פלונית (2018).',
    'בלבול בין ''פסק דין'' ל''החלטה אחרת'', או בין ערעור בזכות לערעור ברשות, במיוחד בהקשר של החלטות ביניים שאינן סוגרות את התיק.', '["החלטה אחרת", "בקשת רשות ערעור", "פסק דין", "חוק בתי המשפט", "סיווג החלטות", "היבט מהותי"]'::jsonb, '**וריאציה 1 — החלטה הדוחה הודעה לצד שלישי?** ← ''החלטה אחרת'' (לא סוגרת תיק).

**וריאציה 2 — ערעור על ''החלטה אחרת''?** ← בקשת רשות ערעור (סעיפים 41(ב) או 52(ב) לחוק בתי המשפט).
**וריאציה 3 — האם ערכאת הערעור תתערב בקלות?** ← לא בנקל, אך יש לה היבט מהותי שעשוי להצדיק התערבות במקרים מתאימים.', 'דחיית הודעה לצד שלישי ← ''החלטה אחרת'' ← ערעור ברשות.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיפים 41(ב), 52(ב)", "רע\"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע\"מ נ'' נתלי רום שושני (26.6.2025)", "רע\"א 8644/15 כלל חברה לביטוח בע\"מ נ'' ארנה וייץ (21.2.2016)", "רע\"א 7848/18 מדינת ישראל (משרד התחבורה- רשות הספנות והנמלים) נ'' פלונית (21.12.2018)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'בזכות, כחלק מהערעור על פסק הדין הסופי.', false, 'בחירה זו שגויה. החלטה הדוחה בקשה לשלוח הודעה לצד שלישי היא ''החלטה אחרת'' שאינה סוגרת את התיק, ולכן לא ניתן לערער עליה בזכות כחלק מערעור על פסק הדין הסופי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'ברשות, בדרך של בקשת רשות ערעור על ''החלטה אחרת''.', true, 'החלטה הדוחה בקשה לשלוח הודעה לצד שלישי היא ''החלטה אחרת'' שאינה סוגרת את התיק, ולכן ערעור עליה טעון רשות, בהתאם לסעיפים 41(ב) או 52(ב) לחוק בתי המשפט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'לא ניתן לערער על החלטה זו, אלא רק להגיש בקשה לעיון מחדש בפני אותו בית משפט.', false, 'בחירה זו שגויה. ניתן לערער על החלטה זו, אך בדרך של בקשת רשות ערעור, ולא רק בדרך של עיון מחדש.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'בזכות, בדרך של ערעור על ''החלטה אחרת''.', false, 'בחירה זו שגויה. החלטה הדוחה בקשה לשלוח הודעה לצד שלישי היא אמנם ''החלטה אחרת'', אך ערעור עליה אינו בזכות אלא ברשות, שכן היא אינה סוגרת את התיק.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 6, '2022-S-Q06';
END
$$;

-- ============================================================
-- Q07 — 2022-S-Q07 — chapter=civil_proc subtopic=proceedings
-- classifier_note: Plastic-surgery malpractice — civil claim filing options (procedural advice)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '96cb4df7-4e5f-41a9-9d3e-673e923954bd'::uuid;
  v_group_id uuid := 'edaa78fa-dd65-448e-80b8-77137848a623'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '88dabd3d-2e95-4a34-92bf-b8f85e0c9fca'::uuid;
  v_ang_1 uuid := 'bfc452c6-d44b-4c20-b44b-becd2940308b'::uuid;
  v_ang_2 uuid := '44d6ab7d-4d1f-4963-9430-e3d95424c621'::uuid;
  v_ang_3 uuid := 'ca53b301-7b29-4e13-b0a5-694e52f7496f'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q07';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 7, '2022-S-Q07';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q07', v_chapter_id, v_subtopic_id, 'יוסף הוא מנתח מפורסם בתחום הניתוחים הפלסטיים. נטלי ביקשה לבצע ניתוח פלסטי אצל יוסף, אשר הבטיח לה תוצאות מזהירות. אלא שהניתוח הסתבך, והתוצאה הייתה גרועה בהרבה ממצבה של נטלי לפני הניתוח. נטלי פונה אליכם לקבלת ייעוץ משפטי לתביעה בגין רשלנות רפואית. כיצד תתנהל התביעה?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 7}'::jsonb, 'שאלה זו עוסקת בדרישות הפרוצדורליות הספציפיות להגשת תביעת רשלנות רפואית על פי תקנות סדר הדין האזרחי, התשע"ט-2018. היא מדגישה את חובת צירוף חוות דעת מומחה, כתב ויתור על סודיות רפואית ותצהיר תשובות לשאלון נזקי גוף, וכן את המועד המיוחד להגשת כתב הגנה בתביעות נזקי גוף.', 'תקנות סדר הדין האזרחי, תשע"ט-2018, קובעות דרישות ספציפיות לתביעות רשלנות רפואית. תקנה 9(א) מחייבת צירוף חוות דעת מומחה רפואי לכתב התביעה, שכן עניין הרשלנות הרפואית דורש ידע מקצועי. תקנה 15 מחייבת צירוף כתב ויתור על סודיות רפואית, המאפשר לנתבע גישה לתיקים הרפואיים של התובע. תקנה 17 מחייבת הגשת תצהיר תשובות לשאלון נזקי גוף, המפרט את פרטי הנזק והטיפולים. לבסוף, תקנה 45(א)(2) קובעת מועד מיוחד להגשת כתב הגנה בתביעות נזקי גוף – 120 ימים, וזאת בשל מורכבותן של תביעות אלו והצורך באיסוף חומר רב. ראו גם רע"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019) לעניין חשיבות המסמכים הרפואיים בתביעות אלו.', 'הטעות הנפוצה היא אי-הכרת כלל המסמכים הנדרשים לצירוף בתביעת רשלנות רפואית, או בלבול בין המועדים השונים להגשת כתב הגנה בסוגי תביעות שונים.',
    '["רשלנות רפואית", "תקנות סדר הדין האזרחי", "חוות דעת מומחה", "כתב ויתור על סודיות רפואית", "שאלון נזקי גוף", "מועד הגשת כתב הגנה"]'::jsonb, '**וריאציה 1 — תביעת רשלנות רפואית?** ← חובה לצרף חוות דעת מומחה, כתב ויתור על סודיות רפואית, תצהיר תשובות לשאלון נזקי גוף (תקנות 9, 15, 17).
**וריאציה 2 — מועד הגשת כתב הגנה?** ← 120 ימים (תקנה 45(א)(2)).
**וריאציה 3 — למה דרישות מיוחדות?** ← מורכבות התביעה, צורך במומחיות, הגנה על זכויות הצדדים.', 'רשלנות רפואית ← חוות דעת + ויתור סודיות + שאלון נזקי גוף ← כתב הגנה תוך 120 ימים.', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנות 9, 15, 17, 45(א)(2)", "רע\"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Plastic-surgery malpractice — civil claim filing options (procedural advice)', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על נטלי לצרף לכתב התביעה חוות דעת של מומחה רפואי שבכוונתה להסתמך עליה, כתב ויתור על סודיות רפואית והצהרה בדבר מצבה הבריאותי בסמוך לפני הניתוח. על יוסף להגיש כתב הגנה בתוך 120 ימים.', false, 'בחירה זו שגויה מכיוון שהיא דורשת ''הצהרה בדבר מצבה הבריאותי בסמוך לפני הניתוח'' במקום ''תצהיר תשובות לשאלון נזקי גוף'', ואינה מדויקת לגבי המסמכים הנדרשים על פי התקנות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על נטלי לצרף לכתב התביעה חוות דעת של מומחה רפואי שבכוונתה להסתמך עליה, כתב ויתור על סודיות רפואית והצהרה בדבר מצבה הבריאותי בסמוך לפני הניתוח. על יוסף להגיש כתב הגנה בתוך 60 ימים.', false, 'בחירה זו שגויה הן לגבי המסמכים הנדרשים (כמו באפשרות א'') והן לגבי מועד הגשת כתב ההגנה, שכן בתביעת נזקי גוף המועד הוא 120 ימים ולא 60 ימים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על נטלי לצרף לכתב התביעה חוות דעת של מומחה רפואי שבכוונתה להסתמך עליה, כתב ויתור על סודיות רפואית, וכן להגיש לנתבע תצהיר תשובות לשאלון נזקי גוף. על יוסף להגיש כתב הגנה בתוך 120 ימים.', true, 'בחירה זו מדויקת ומשקפת את הוראות תקנות 9, 15, 17 ו-45(א)(2) לתקנות סדר הדין האזרחי, התשע"ט-2018, לגבי המסמכים שיש לצרף לתביעת רשלנות רפואית ומועד הגשת כתב ההגנה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על נטלי לצרף לכתב התביעה חוות דעת של מומחה רפואי שבכוונתה להסתמך עליה. על יוסף להגיש כתב הגנה בתוך 60 ימים.', false, 'בחירה זו שגויה מכיוון שהיא מתעלמת מהצורך לצרף כתב ויתור על סודיות רפואית ותצהיר תשובות לשאלון נזקי גוף, וכן שגויה לגבי מועד הגשת כתב ההגנה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'צירוף מסמכים בתביעת נזקי גוף שאינה רשלנות רפואית',
    1, 'ראובן נפגע בתאונת דרכים והגיש תביעת נזקי גוף נגד חברת הביטוח. אילו מסמכים עליו לצרף לכתב התביעה?', 'שאלה זו בוחנת את ההבדלים בדרישות צירוף המסמכים לכתב תביעה בנזקי גוף, בין תביעת רשלנות רפואית לתביעה אחרת (כגון תאונת דרכים). הדגש הוא על כך שבתביעות שאינן רשלנות רפואית, אין חובה לצרף חוות דעת מומחה בשלב הגשת התביעה.', 'תקנה 9(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי תובע המבקש להסתמך על חוות דעת מומחה יצרף אותה לכתב התביעה, למעט בתביעת נזקי גוף שאינה רשלנות רפואית. בתביעות נזקי גוף (לרבות תאונת דרכים), חובה לצרף כתב ויתור על סודיות רפואית (תקנה 15) ותצהיר תשובות לשאלון נזקי גוף (תקנה 17). בתביעת תאונת דרכים, מינוי המומחים הרפואיים נעשה על ידי בית המשפט, ולכן התובע אינו נדרש לצרף חוות דעת מטעמו בשלב הגשת התביעה. ראו גם רע"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019) לעניין חשיבות המסמכים הרפואיים.',
    'הטעות הנפוצה היא להניח שכל תביעת נזקי גוף מחייבת צירוף חוות דעת מומחה רפואי לכתב התביעה, מבלי להבחין בין רשלנות רפואית לסוגי נזקי גוף אחרים.', '["תביעת נזקי גוף", "תאונת דרכים", "חוות דעת מומחה", "כתב ויתור על סודיות רפואית", "שאלון נזקי גוף", "תקנות סדר הדין האזרחי"]'::jsonb, '**וריאציה 1 — תביעת נזקי גוף שאינה רשלנות רפואית?** ← חובה לצרף כתב ויתור על סודיות רפואית ותצהיר תשובות לשאלון נזקי גוף (תקנות 15, 17).
**וריאציה 2 — האם חובה לצרף חוות דעת מומחה?** ← לא, אלא אם התובע בוחר להסתמך עליה (תקנה 9(א)).
**וריאציה 3 — מה ההבדל מרשלנות רפואית?** ← ברשלנות רפואית חובה לצרף חוות דעת מומחה (תקנה 9(א)).', 'נזקי גוף (לא רשלנות רפואית) ← ויתור סודיות + שאלון נזקי גוף ← חוות דעת מומחה לא חובה.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנות 9(א), 15, 17", "רע\"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'חוות דעת מומחה רפואי, כתב ויתור על סודיות רפואית ותצהיר תשובות לשאלון נזקי גוף.', false, 'בחירה זו שגויה. בתביעת נזקי גוף שאינה רשלנות רפואית, אין חובה לצרף חוות דעת מומחה רפואי לכתב התביעה בשלב זה, אלא רק כתב ויתור על סודיות רפואית ותצהיר תשובות לשאלון נזקי גוף.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'כתב ויתור על סודיות רפואית ותצהיר תשובות לשאלון נזקי גוף.', true, 'בחירה זו מדויקת. תקנות 15 ו-17 לתקנות סדר הדין האזרחי מחייבות צירוף מסמכים אלו לכל תביעת נזקי גוף, לרבות תאונת דרכים, אך תקנה 9(א) פוטרת מצירוף חוות דעת מומחה בתביעות שאינן רשלנות רפואית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'רק כתב ויתור על סודיות רפואית.', false, 'בחירה זו שגויה. בנוסף לכתב ויתור על סודיות רפואית, יש לצרף גם תצהיר תשובות לשאלון נזקי גוף, בהתאם לתקנה 17 לתקנות סדר הדין האזרחי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'רק חוות דעת מומחה רפואי.', false, 'בחירה זו שגויה. בתביעת נזקי גוף שאינה רשלנות רפואית, אין חובה לצרף חוות דעת מומחה רפואי לכתב התביעה בשלב זה, וכן חסרים מסמכים נוספים הנדרשים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מועד הגשת כתב הגנה בתביעות שאינן נזקי גוף',
    2, 'ראובן הגיש תביעה כספית בסדר דין רגיל נגד שמעון. מהו המועד להגשת כתב הגנה על ידי שמעון?', 'שאלה זו בוחנת את ידיעת המועדים להגשת כתב הגנה, שהם עניין מהותי בסדר הדין האזרחי. יש להבחין בין המועדים השונים הקבועים בתקנות בהתאם לסוג התביעה (רגילה, נזקי גוף, מהירה).', 'תקנה 45(א)(1) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי המועד להגשת כתב הגנה בתביעה בסדר דין רגיל שאינה תביעת נזקי גוף הוא 60 ימים מיום המצאת כתב התביעה. חשוב להבחין בין מועד זה לבין המועד בתביעת נזקי גוף (120 ימים, תקנה 45(א)(2)) או בסדר דין מהיר (30 ימים, תקנה 79(א)).',
    'הטעות הנפוצה היא לבלבל בין המועדים השונים להגשת כתב הגנה, במיוחד בין תביעה רגילה לתביעת נזקי גוף או סדר דין מהיר.', '["כתב הגנה", "מועדים בסדר דין אזרחי", "תביעה כספית", "סדר דין רגיל", "תקנה 45(א)(1)"]'::jsonb, '**וריאציה 1 — מועד הגשת כתב הגנה בתביעה כספית רגילה?** ← 60 ימים (תקנה 45(א)(1) לתקנות סד"א).
**וריאציה 2 — מועד בתביעת נזקי גוף?** ← 120 ימים (תקנה 45(א)(2)).
**וריאציה 3 — מועד בסדר דין מהיר?** ← 30 ימים (תקנה 79(א)).', 'כתב הגנה ← 60 ימים (רגילה) / 120 ימים (נזקי גוף) / 30 ימים (מהיר).',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 45(א)(1)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', '30 ימים מיום המצאת כתב התביעה.', false, 'בחירה זו שגויה. 30 ימים הוא המועד להגשת כתב הגנה בסדר דין מהיר, ולא בסדר דין רגיל.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', '60 ימים מיום המצאת כתב התביעה.', true, 'תקנה 45(א)(1) לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי המועד להגשת כתב הגנה בתביעה בסדר דין רגיל שאינה תביעת נזקי גוף הוא 60 ימים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', '90 ימים מיום המצאת כתב התביעה.', false, 'בחירה זו שגויה. 90 ימים הוא מועד להגשת כתב הגנה במקרים מסוימים, אך לא בתביעה כספית רגילה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', '120 ימים מיום המצאת כתב התביעה.', false, 'בחירה זו שגויה. 120 ימים הוא המועד להגשת כתב הגנה בתביעת נזקי גוף, ולא בתביעה כספית רגילה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'פטור מצירוף חוות דעת מומחה ברשלנות רפואית',
    3, 'באילו מקרים חריגים רשאי בית המשפט להתיר הגשת תביעת רשלנות רפואית ללא צירוף חוות דעת מומחה רפואי?', 'שאלה זו עוסקת בחריגים לכלל המחייב צירוף חוות דעת מומחה בתביעות רשלנות רפואית. חריגים אלו, המעוגנים בפסיקה ובחוק, נועדו למנוע מצב שבו תובע צודק לא יוכל לממש את זכותו לגישה לערכאות עקב קשיים ראייתיים או נסיבות מיוחדות.', 'הכלל הוא שבתביעת רשלנות רפואית יש לצרף חוות דעת מומחה רפואי (תקנה 9(א) לתקנות סדר הדין האזרחי). עם זאת, הפסיקה הכירה בחריגים לכלל זה: א. כאשר מדובר ברשלנות רפואית גסה, שהיא כה ברורה עד שאינה דורשת חוות דעת מומחה. ב. כאשר הנזק מדבר בעד עצמו (סעיף 41 לפקודת הנזיקין), כלומר, נסיבות המקרה מצביעות על כך שהרשלנות היא הגורם הסביר לנזק. ג. כאשר התובע אינו יכול להשיג חוות דעת עקב נזק ראייתי שנגרם על ידי הנתבע. במקרים אלו, בית המשפט רשאי להתיר הגשת התביעה ללא חוות דעת מומחה. ראו ע"א 292/09 כהן נ'' לוי (2011) ורע"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019).',
    'הטעות הנפוצה היא לחשוב שהכלל בדבר צירוף חוות דעת מומחה הוא מוחלט, או לבלבל בין החריגים המוכרים לבין נסיבות שאינן מצדיקות פטור.', '["רשלנות רפואית", "חוות דעת מומחה", "חריגים לכלל", "הדבר מדבר בעד עצמו", "נזק ראייתי", "תקנה 9(א)"]'::jsonb, '**וריאציה 1 — חובה לצרף חוות דעת ברשלנות רפואית?** ← כן, ככלל (תקנה 9(א) לתקנות סד"א).
**וריאציה 2 — מתי יש פטור?** ← רשלנות גסה, הדבר מדבר בעד עצמו, נזק ראייתי (ע"א 292/09).
**וריאציה 3 — מי מחליט על הפטור?** ← בית המשפט, בשיקול דעת.', 'רשלנות רפואית ← חובה חוות דעת מומחה ← חריגים: רשלנות גסה, הדבר מדבר בעד עצמו, נזק ראייתי.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 9(א)", "פקודת הנזיקין [נוסח חדש], סעיף 41", "ע\"א 292/09 כהן נ'' לוי (14.3.2011)", "רע\"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כאשר מדובר ברשלנות רפואית גסה, כאשר הנזק מדבר בעד עצמו, או כאשר התובע אינו יכול להשיג חוות דעת עקב נזק ראייתי.', true, 'בחירה זו משקפת את החריגים המוכרים בפסיקה ובחוק, המאפשרים הגשת תביעת רשלנות רפואית ללא חוות דעת מומחה, מתוך עקרונות של צדק והגינות דיונית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'רק כאשר מדובר ברשלנות רפואית גסה.', false, 'בחירה זו שגויה. רשלנות רפואית גסה היא רק אחד מהחריגים, וקיימים חריגים נוספים כגון דוקטרינת ''הדבר מדבר בעד עצמו'' ונזק ראייתי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'רק כאשר התובע אינו יכול להרשות לעצמו את עלות חוות הדעת.', false, 'בחירה זו שגויה. מצבו הכלכלי של התובע אינו עילה מספקת כשלעצמה לפטור מצירוף חוות דעת מומחה, אם כי בית המשפט יכול למנות מומחה מטעמו במקרים מסוימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בכל מקרה שבו בית המשפט סבור כי אין צורך בחוות דעת מומחה.', false, 'בחירה זו שגויה. הפטור מצירוף חוות דעת מומחה הוא חריג לכלל, וניתן רק במקרים מוגדרים ועל פי אמות מידה שנקבעו בפסיקה, ולא לפי שיקול דעת כללי של בית המשפט.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סמכות עניינית בתביעת רשלנות רפואית',
    4, 'נטלי מעריכה את נזקיה כתוצאה מהרשלנות הרפואית בסך 3,000,000 ש"ח. לאיזה בית משפט תוגש התביעה?', 'שאלה זו בוחנת את כללי הסמכות העניינית בתביעות אזרחיות, ובפרט בתביעות נזקי גוף. הכלל המנחה הוא שווי התביעה, כאשר תביעות מעל סכום מסוים נדונות בבית המשפט המחוזי.', 'כללי הסמכות העניינית נקבעים בחוק בתי המשפט [נוסח משולב], התשמ"ד-1984. סעיף 51(א)(2) לחוק קובע כי לבית משפט השלום סמכות לדון בתביעות כספיות שסכומן אינו עולה על 2,500,000 ש"ח. סעיף 40(1) לחוק קובע כי לבית המשפט המחוזי סמכות שיורית לדון בכל עניין אזרחי שאינו בסמכות בית משפט השלום. מאחר ששווי התביעה של נטלי עומד על 3,000,000 ש"ח, סכום העולה על סמכותו של בית משפט השלום, הרי שהסמכות העניינית נתונה לבית המשפט המחוזי. ראו גם רע"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019) לעניין סמכות עניינית בתביעות נזקי גוף.',
    'הטעות הנפוצה היא לבלבל בין סמכות בית משפט השלום לבית המשפט המחוזי, או לא לזכור את סף הסכום המפריד ביניהם בתביעות כספיות.', '["סמכות עניינית", "חוק בתי המשפט", "שווי תביעה", "בית משפט השלום", "בית המשפט המחוזי", "תביעת נזקי גוף"]'::jsonb, '**וריאציה 1 — תביעה כספית עד 2.5 מיליון ש"ח?** ← בית משפט השלום (סעיף 51(א)(2) לחוק בתי המשפט).
**וריאציה 2 — תביעה כספית מעל 2.5 מיליון ש"ח?** ← בית המשפט המחוזי (סעיף 40(1) לחוק בתי המשפט).
**וריאציה 3 — מהי סמכות שיורית?** ← סמכות לדון בכל עניין שאינו בסמכות ערכאה אחרת.', 'סמכות עניינית ← שווי תביעה ← עד 2.5 מיליון ש"ח (שלום) / מעל 2.5 מיליון ש"ח (מחוזי).',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיפים 40(1), 51(א)(2)", "רע\"א 1009/19 פלוני נ'' מדינת ישראל (20.2.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'לבית משפט השלום.', false, 'בחירה זו שגויה. סמכותו העניינית של בית משפט השלום מוגבלת לתביעות כספיות עד 2.5 מיליון ש"ח.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לבית המשפט המחוזי.', true, 'סעיף 40(1) לחוק בתי המשפט קובע כי לבית המשפט המחוזי סמכות שיורית לדון בכל עניין אזרחי שאינו בסמכות בית משפט השלום, וכן בתביעות כספיות העולות על 2.5 מיליון ש"ח.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'לבית הדין לעבודה.', false, 'בחירה זו שגויה. לבית הדין לעבודה סמכות לדון בעניינים הקשורים ליחסי עבודה וביטוח לאומי, ולא בתביעות רשלנות רפואית אזרחיות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לבית המשפט העליון.', false, 'בחירה זו שגויה. לבית המשפט העליון סמכות שיפוט כערכאת ערעור וכבג"ץ, ולא כערכאה ראשונה בתביעות אזרחיות.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 7, '2022-S-Q07';
END
$$;

-- ============================================================
-- Q08 — 2022-S-Q08 — chapter=civil_proc subtopic=proceedings
-- classifier_note: Required structure of a statement of claim (the third part)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '98a44dec-8a71-48de-a044-1b5d82d11456'::uuid;
  v_group_id uuid := 'bf32b0d9-fbee-48b1-b3b3-3e009db8b59f'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '4f6d0dcb-5deb-4969-8a93-2c8f8b17510a'::uuid;
  v_ang_1 uuid := '5accd1f3-97c4-4ed2-b544-92957d885cfd'::uuid;
  v_ang_2 uuid := '9dc61ac0-dea2-4d99-b4c2-c9e240f33c24'::uuid;
  v_ang_3 uuid := '181d11d5-dd9a-41e5-884f-f7abcfa21efa'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q08';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 8, '2022-S-Q08';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q08', v_chapter_id, v_subtopic_id, 'אבישי מבקש להגיש כתב תביעה, והוא נועץ בכם לגבי הדרישות בתקנות בנוגע למבנה כתב התביעה. מה יכלול חלקו השלישי של כתב התביעה?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 8}'::jsonb, 'שאלה זו עוסקת בדרישות הפרוצדורליות למבנה כתב תביעה, ובפרט בתוכן חלקו השלישי, על פי תקנה 14(א) לתקנות סדר הדין האזרחי, התשע"ט-2018. התקנה מדגישה את חובת פירוט העובדות המהותיות וכל מידע נוסף שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות, כליבת כתב הטענות.', 'תקנה 14(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''חלקו השלישי של כתב הטענות יכלול את פירוט העובדות המשמשות יסוד לכתב הטענות וכל מידע נוסף, שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות שבין בעלי הדין''. חלק זה נחשב ל''ליבו של כתב התביעה'', כפי שמצוין בספרו של יששכר רוזן-צבי הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025). מטרתו היא להציג את ''סיפור המעשה'' המלא והמפורט, בניגוד לחלק השני (תמצית הטענות) המהווה תקציר. דרישה זו לפירוט עובדתי מהותי היא בסיסית וקריטית, ואי-עמידה בה עלולה להוביל למחיקת התביעה, כפי שנדון בת"א (שלום הרצליה) 1797-12-23 יהונתן לביא נ'' ישראייר תעופה ותיירות בע"מ (2024).', 'הטעות הנפוצה היא לבלבל בין שלושת חלקי כתב התביעה (כותרת, תמצית טענות, פירוט טענות) ולייחס לכל חלק תוכן שאינו מתאים לו, או לא להבין את רמת הפירוט הנדרשת בחלק השלישי.',
    '["כתב תביעה", "פירוט עובדתי", "תקנה 14(א)", "תקנות סדר הדין האזרחי", "מבנה כתב טענות", "הבהרת מחלוקת"]'::jsonb, '**וריאציה 1 — מה יכלול חלקו השלישי של כתב התביעה?** ← פירוט העובדות המשמשות יסוד לכתב הטענות וכל מידע נוסף להבהרת המחלוקת (תקנה 14(א) לתקנות סד"א).
**וריאציה 2 — מה מטרת חלק זה?** ← להציג את ''סיפור המעשה'' המלא והמפורט, ליבת התביעה.
**וריאציה 3 — מה ההבדל מחלקו השני?** ← חלק שני הוא תמצית הטענות, חלק שלישי הוא פירוט הטענות.', 'כתב תביעה חלק שלישי ← פירוט עובדות + מידע להבהרת מחלוקת ← ליבת התביעה.', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 14(א)", "יששכר רוזן-צבי הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ג כתבי הטענות", "ת\"א (שלום הרצליה) 1797-12-23 יהונתן לביא נ'' ישראייר תעופה ותיירות בע\"מ (16.6.2024)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Required structure of a statement of claim (the third part)', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'רשימת הסעדים המבוקשים.', false, 'בחירה זו שגויה. רשימת הסעדים המבוקשים נכללת בחלקו הראשון של כתב התביעה (הכותרת) וכן תמצית הסעד בחלקו השני (תמצית הטענות), אך לא בחלקו השלישי, המיועד לפירוט העובדות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הזמנת הנתבע לדין.', false, 'בחירה זו שגויה. הזמנת הנתבע לדין היא חלק מהכותרת של כתב התביעה (חלקו הראשון), בהתאם לתקנה 10(13) לתקנות סדר הדין האזרחי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'העובדות המקנות את הסמכות לבית המשפט.', false, 'בחירה זו שגויה. העובדות המקנות סמכות לבית המשפט נכללות בחלקו השני של כתב התביעה (תמצית הטענות), בהתאם לתקנה 11(4) לתקנות סדר הדין האזרחי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הסבר מפורט של נסיבות המקרה שבגינו תובעים.', true, 'בחירה זו מדויקת. תקנה 14(א) לתקנות סדר הדין האזרחי, התשע"ט-2018, קובעת כי חלקו השלישי של כתב הטענות יכלול את פירוט העובדות המשמשות יסוד לכתב הטענות וכל מידע נוסף, שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'חובת פירוט עובדתי בתביעה מרובת תובעים',
    1, 'קבוצה של 147 תובעים הגישה תביעה נגד חברת תעופה בגין ביטול טיסות, אך כתב התביעה כלל פירוט עובדתי רק לגבי 12 מהם, תוך ציון שהעובדות מובאות על דרך ההדגמה. מהו הדין?', 'שאלה זו מיישמת את הוראות תקנה 14(א) לתקנות סדר הדין האזרחי על מקרה קונקרטי של תביעה מרובת תובעים. היא מדגישה את חובת הפירוט העובדתי האינדיבידואלי לכל תובע, גם כאשר הטיעון המשפטי משותף, ואת הסנקציה של מחיקה על הסף במקרה של חוסר פירוט מהותי.', 'תקנה 14(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי חלקו השלישי של כתב הטענות יכלול את פירוט העובדות המשמשות יסוד לכתב הטענות וכל מידע נוסף, שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות. הפסיקה, כפי שבא לידי ביטוי בת"א (שלום הרצליה) 1797-12-23 יהונתן לביא נ'' ישראייר תעופה ותיירות בע"מ (2024), קבעה כי כתב תביעה שנעדר פירוט עובדתי באשר לרובם הגדול של התובעים, גם אם העובדות מובאות על דרך ההדגמה, אינו עומד בדרישות התקנה ונפל בו פגם מהותי היורד לשורשו של עניין, המצדיק מחיקה על הסף. בית המשפט הדגיש כי פירוט העובדות המהותיות הוא הבסיס והיסוד לכל כתב תביעה, וכי לא ניתן לקבל מצב שבו כתב תביעה נעדר פירוט כזה.',
    'הטעות הנפוצה היא להניח שבתביעה מרובת תובעים, די בפירוט כללי או בהדגמה חלקית של העובדות, במיוחד כאשר עילת התביעה נראית זהה לכולם.', '["פירוט עובדתי", "תביעה מרובת תובעים", "מחיקה על הסף", "תקנה 14(א)", "פגם מהותי", "הבהרת מחלוקת"]'::jsonb, '**וריאציה 1 — תביעה מרובת תובעים ללא פירוט לכל אחד?** ← פגם מהותי, עלול להימחק על הסף (ת"א (שלום הרצליה) 1797-12-23).
**וריאציה 2 — האם הדגמה מספיקה?** ← לא, נדרש פירוט עובדתי לכל תובע.
**וריאציה 3 — מה מטרת הפירוט?** ← להבהיר את המחלוקת ולמקד את הפלוגתות.', 'תביעה מרובת תובעים ← חובה פירוט עובדתי לכל תובע ← אי-פירוט ← מחיקה על הסף.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 14(א)", "ת\"א (שלום הרצליה) 1797-12-23 יהונתן לביא נ'' ישראייר תעופה ותיירות בע\"מ (16.6.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'בית המשפט יורה על מחיקת התביעה על הסף, שכן כתב התביעה נעדר תשתית עובדתית מספקת לגבי רוב התובעים, ואינו עומד בדרישת פירוט העובדות המהותיות.', true, 'בחירה זו נכונה. הפסיקה קובעת כי כתב תביעה חייב לכלול פירוט עובדתי מהותי לכל תובע, ואי-עמידה בדרישה זו, גם אם הטיעון המשפטי זהה, עלולה להוביל למחיקת התביעה על הסף.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'בית המשפט יאפשר לתובעים להשלים את הפירוט העובדתי החסר, אך לא ימחק את התביעה על הסף.', false, 'בחירה זו שגויה. אף שבית המשפט עשוי לאפשר תיקון, במקרים של חוסר פירוט מהותי וחריג, במיוחד לאחר שניתנה הזדמנות לטיעון, מחיקה על הסף היא סנקציה אפשרית, תוך שמירה על זכות התובעים להגיש תביעה מתוקנת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'בית המשפט יקבל את התביעה, שכן העובדות המובאות על דרך ההדגמה מספיקות כאשר הטיעון המשפטי זהה לכל התובעים.', false, 'בחירה זו שגויה. גם אם הטיעון המשפטי זהה, חובת הפירוט העובדתי היא אינדיבידואלית לכל תובע, ואין די בהדגמה חלקית, כפי שנקבע בפסיקה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'בית המשפט ימחק את התביעה רק אם הנתבע יוכיח כי נגרם לו נזק ממשי מחוסר הפירוט.', false, 'בחירה זו שגויה. חובת הפירוט היא חובה עצמאית המוטלת על התובע, ואי-עמידה בה מהווה פגם מהותי היורד לשורשו של עניין, ללא צורך בהוכחת נזק ספציפי לנתבע.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'הבחנה בין עובדות, טענות משפטיות וראיות',
    2, 'מהי ההבחנה בין ''עובדות'', ''טענות משפטיות'' ו''ראיות'' בכתב טענות, וכיצד היא באה לידי ביטוי בתקנות סדר הדין האזרחי החדשות?', 'שאלה זו עוסקת בהבחנה המורכבת בין עובדות, טענות משפטיות וראיות בכתבי טענות, ובפרשנות תקנה 14(א) לתקנות סדר הדין האזרחי החדשות. היא מדגישה את הגישה הגמישה של הפסיקה והספרות המשפטית, ואת המעבר מתפיסה קטגורית נוקשה לדרישה לפירוט שיבהיר וימקד את המחלוקת.', 'הפסיקה והספרות המשפטית, כפי שמצוין בספרו של יששכר רוזן-צבי הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025), ובפסיקה כגון רע"א 2904/95 מדינת ישראל נ'' אל הוזייל, קבעו כי ההבחנה בין ''עובדה'', ''טענה משפטית'' ו''ראיה'' אינה קטגורית. כמעט כל טענה עשויה להיות ''עובדה'' במקרה אחד ו''טענה משפטית'' באחר. תקנה 14(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי חלקו השלישי של כתב הטענות יכלול את פירוט העובדות המשמשות יסוד לכתב הטענות וכל מידע נוסף, שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות. התקנות החדשות השמיטו את האיסור המפורש על ציון ראיות (שהיה בתקנה 71(א) לתקנות הישנות), וכן את תקנה 74(ב) הישנה שפטר מציון הוראות דין. גישה זו, כפי שפורש בת"א (מחוזי תל אביב-יפו) 62085-12-23 סאטוראס בע"מ נ'' Agritech Holdings LLC (2024), מעידה על דרישה לפירוט רחב יותר, הכולל גם טענות משפטיות, במטרה להבהיר את המחלוקת.',
    'הטעות הנפוצה היא לדבוק בהבחנות נוקשות בין עובדות, טענות משפטיות וראיות, כפי שהיו נהוגות תחת התקנות הישנות, מבלי להבין את השינוי בגישה תחת התקנות החדשות המדגישות הבהרה ומיקוד המחלוקת.', '["עובדות מהותיות", "טענות משפטיות", "ראיות", "תקנה 14(א)", "הרפורמה בסדר הדין האזרחי", "הבהרת מחלוקת"]'::jsonb, '**וריאציה 1 — הבחנה בין עובדות, טענות משפטיות וראיות?** ← אינה קטגורית, גמישה (יששכר רוזן-צבי).
**וריאציה 2 — מה דורשת תקנה 14(א)?** ← פירוט עובדות וכל מידע נוסף להבהרת המחלוקת.
**וריאציה 3 — האם מותר לכלול טענות משפטיות/ראיות?** ← התקנות החדשות אינן אוסרות, ואף מעודדות מידע המסייע להבהרה.', 'עובדות, טענות משפטיות, ראיות ← הבחנה גמישה ← תקנה 14(א) ← פירוט להבהרת מחלוקת.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 14(א)", "יששכר רוזן-צבי הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ג כתבי הטענות", "ת\"א (מחוזי תל אביב-יפו) 62085-12-23 סאטוראס בע\"מ נ'' Agritech Holdings LLC (5.4.2024)", "ת\"א (מחוזי ת\"א) 46847-04-22 אברהם דב ראבד נ'' דוד פרוינדליך (19.11.2023)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'ההבחנה בין המושגים היא קטגורית וברורה; התקנות החדשות מחייבות פירוט עובדות בלבד, ואוסרות על ציון טענות משפטיות וראיות.', false, 'בחירה זו שגויה. הפסיקה והספרות המשפטית קבעו כי ההבחנה אינה קטגורית, והתקנות החדשות אינן אוסרות על ציון טענות משפטיות, אלא אף מעודדות מידע המסייע להבהרת המחלוקת.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'ההבחנה בין המושגים אינה קטגורית; התקנות החדשות דורשות פירוט עובדות וכל מידע נוסף שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות, ואינן אוסרות על ציון טענות משפטיות או ראיות.', true, 'בחירה זו נכונה. הפסיקה והספרות המשפטית מדגישות את הגמישות בהבחנה בין עובדות, טענות משפטיות וראיות, ואת הדרישה בתקנה 14(א) לפירוט עובדתי ומידע נוסף להבהרת המחלוקת, ללא איסור גורף על ציון טענות משפטיות או ראיות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'התקנות החדשות ביטלו את הצורך בפירוט עובדתי, ומתמקדות בטענות משפטיות בלבד.', false, 'בחירה זו שגויה לחלוטין. התקנות החדשות, ובמיוחד תקנה 14(א), מדגישות את חשיבות פירוט העובדות המהותיות כבסיס לכתב הטענות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'התקנות החדשות מחייבות פירוט ראיות בלבד, שכן הן אלו המבססות את התביעה.', false, 'בחירה זו שגויה. אף שהתקנות החדשות השמיטו את האיסור המפורש על ציון ראיות, הן עדיין מתמקדות בפירוט העובדות המהותיות ומידע להבהרת המחלוקת, ולא בפירוט ראיות בלבד.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חובת פירוט מוגבר בטענות תרמית',
    3, 'חברה הגישה תביעה נגד יזמים בטענה למצגי שווא ותרמית. כתב התביעה כלל טענות עמומות וחסרות פירוט לגבי המעשים הנטענים. מהו הדין?', 'שאלה זו עוסקת בדרישת הפירוט המוגבר בכתבי טענות המעלים טענות חמורות כגון תרמית ומצגי שווא. היא מדגישה כי גם תחת תקנות סדר הדין האזרחי החדשות, עקרון הפירוט המוגבר נשמר, מכוח תקנה 14(א) ועקרונות היסוד של התקנות, במטרה להבהיר את המחלוקת ולאפשר הגנה הוגנת.', 'הפסיקה קבעה כי טענות מסוג ''תרמית'', ''מצגים כוזבים'' או ''הונאה'' דורשות פירוט עובדתי מוגבר. אף שתקנה 78 לתקנות סדר הדין האזרחי, תשמ"ד-1984, שדרשה פירוט מוגבר בטענות אלו, הושמטה מהתקנות החדשות, הפסיקה ממשיכה לדרוש פירוט כזה. בת"א (מחוזי תל אביב-יפו) 62085-12-23 סאטוראס בע"מ נ'' Agritech Holdings LLC (2024) ובת"א (מחוזי תל אביב-יפו) 48152-03-22 מתי לבנדה נ'' סטיקספיי קומיוניקיישנס בע"מ ואח (2023), נקבע כי דרישה זו מעוגנת כיום בהוראת תקנה 14(א) לתקנות החדשות, הקובעת כי כתב הטענות יכלול פירוט עובדות וכל מידע נוסף שתכליתו לסייע בהבהרת המחלוקת ובמיקוד הפלוגתות. העלאת טענות חמורות ללא פירוט מספק אינה מסייעת להבהרת המחלוקת ושוללת מהצד שכנגד את האפשרות להתגונן כראוי, ועל כן עלולה להוביל למחיקת התביעה או לחיוב בתיקון.',
    'הטעות הנפוצה היא להניח שהשמטת תקנה 78 הישנה מהתקנות החדשות מבטלת את הדרישה לפירוט מוגבר בטענות תרמית, מבלי להבין שהדרישה נשמרת מכוח עקרונות אחרים בתקנות החדשות.', '["פירוט מוגבר", "טענות תרמית", "מצגי שווא", "תקנה 14(א)", "הבהרת מחלוקת", "הגנה הוגנת"]'::jsonb, '**וריאציה 1 — טענות תרמית בכתב תביעה?** ← דורשות פירוט עובדתי מוגבר (ת"א (מחוזי ת"א) 62085-12-23).
**וריאציה 2 — האם השמטת תקנה 78 הישנה שינתה זאת?** ← לא, הדרישה נשמרת מכוח תקנה 14(א) ועקרונות היסוד.
**וריאציה 3 — מה הסנקציה על חוסר פירוט?** ← מחיקה על הסף או חיוב בתיקון כתב התביעה.', 'טענות תרמית ← פירוט מוגבר חובה ← גם בתקנות החדשות ← למען הבהרת מחלוקת והגנה הוגנת.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 14(א)", "ת\"א (מחוזי תל אביב-יפו) 62085-12-23 סאטוראס בע\"מ נ'' Agritech Holdings LLC (5.4.2024)", "ת\"א (מחוזי תל אביב-יפו) 48152-03-22 מתי לבנדה נ'' סטיקספיי קומיוניקיישנס בע\"מ ואח (25.4.2023)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט ידחה את הבקשה למחיקת התביעה, שכן התקנות החדשות ביטלו את הדרישה לפירוט מוגבר בטענות תרמית.', false, 'בחירה זו שגויה. אף שהתקנות החדשות השמיטו את תקנה 78 הישנה, הפסיקה קבעה כי הדרישה לפירוט מוגבר בטענות תרמית עדיין קיימת מכוח תקנה 14(א) ועקרונות היסוד של התקנות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בית המשפט יורה על מחיקת התביעה על הסף, שכן טענות תרמית ומצגי שווא דורשות פירוט עובדתי מוגבר, ואי-פירוט כזה מונע מהנתבעים להתגונן כראוי.', true, 'בחירה זו נכונה. הפסיקה קובעת כי טענות תרמית דורשות פירוט עובדתי מוגבר, וכי חוסר פירוט כזה מנוגד לתכלית תקנה 14(א) ופוגע ביכולת הנתבע להתגונן, ועלול להוביל למחיקה על הסף או לחיוב בתיקון.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט יאפשר לתובעת להשלים את הפירוט, אך לא ימחק את התביעה על הסף, שכן המידע מצוי בידי הנתבעים.', false, 'בחירה זו שגויה. אף שבית המשפט עשוי לאפשר תיקון, הטענה שהמידע מצוי בידי הנתבעים אינה פוטרת את התובע מחובת הפירוט הראשונית, במיוחד בטענות חמורות כמו תרמית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט יקבל את התביעה, שכן טענות תרמית אינן דורשות פירוט מיוחד מעבר לפירוט הכללי הנדרש בכתב תביעה.', false, 'בחירה זו שגויה. טענות תרמית נחשבות לטענות חמורות במיוחד, ולכן הפסיקה דורשת לגביהן פירוט עובדתי מוגבר, מעבר לפירוט הכללי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סילוק על הסף עקב חוסר פירוט',
    4, 'נתבע הגיש בקשה לסילוק על הסף של תביעה בטענה להיעדר פירוט עובדתי מספק בכתב התביעה. מהי הגישה הכללית של בית המשפט לבקשה כזו?', 'שאלה זו עוסקת בסעד הקיצוני של סילוק על הסף (או מחיקה על הסף) עקב חוסר פירוט עובדתי בכתב התביעה. היא מדגישה את הגישה הזהירה של בתי המשפט למתן סעד זה, ואת העדפתם לאפשר תיקון כתב התביעה, אלא אם כן ברור שאין כל סיכוי לתביעה.', 'סילוק על הסף הוא סעד קיצוני המביא לדחייתה או מחיקתה של התביעה עוד בטרם בירורה לגופה. הלכה פסוקה היא כי סעד זה יינתן במקרים חריגים בלבד, כאשר ברור כי גם אם התובע יוכיח את כלל הנטען במסגרת כתב התביעה, לא יעלה בידו לקבל את הסעד המבוקש. במקום שבו נדרש בירור עובדתי על מנת להכריע בבקשה לסילוק על הסף, די בכך כדי להביא לדחיית הבקשה. כך נקבע בת"א (מחוזי ת"א) 2030-08-23 איי.בי.טי. יהלומים בע"מ נ'' יוסי אלון (2025). גם במקרים של חוסר פירוט מהותי, כפי שנדון בת"א (שלום הרצליה) 1797-12-23 יהונתן לביא נ'' ישראייר תעופה ותיירות בע"מ (2024), בית המשפט עשוי למחוק את התביעה על הסף, אך תוך הדגשה שדלתות בית המשפט אינן נסגרות בפני התובעים והם רשאים להגיש תביעה מתוקנת.',
    'הטעות הנפוצה היא לחשוב שכל חוסר פירוט, גם אם אינו מהותי או ניתן לתיקון, יוביל אוטומטית לסילוק על הסף, מבלי להבין את הגישה המצמצמת של בתי המשפט לסעד זה.', '["סילוק על הסף", "מחיקה על הסף", "חוסר פירוט עובדתי", "תיקון כתב תביעה", "סעד קיצוני", "תקנה 43"]'::jsonb, '**וריאציה 1 — בקשה לסילוק על הסף עקב חוסר פירוט?** ← סעד קיצוני, יינתן בחריגים (ת"א (מחוזי ת"א) 2030-08-23).
**וריאציה 2 — מה האלטרנטיבה המועדפת?** ← מתן אפשרות לתקן את כתב התביעה.
**וריאציה 3 — מתי בכל זאת יינתן?** ← כאשר ברור שאין כל סיכוי לתביעה, גם לאחר תיקון אפשרי.', 'חוסר פירוט ← סילוק על הסף (סעד קיצוני) ← עדיפות לתיקון כתב תביעה.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 43", "ת\"א (מחוזי ת\"א) 2030-08-23 איי.בי.טי. יהלומים בע\"מ נ'' יוסי אלון (20.3.2025)", "ת\"א (שלום הרצליה) 1797-12-23 יהונתן לביא נ'' ישראייר תעופה ותיירות בע\"מ (16.6.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'בית המשפט ייעתר לבקשה וימחק את התביעה על הסף, שכן חוסר פירוט עובדתי מהווה פגם מהותי המונע מהנתבע להתגונן.', false, 'בחירה זו שגויה. סילוק על הסף הוא סעד קיצוני, ובית המשפט יעדיף, ככלל, לאפשר לתובע לתקן את כתב התביעה במקום למחוק אותו על הסף, אלא אם כן ברור שאין כל סיכוי לתביעה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'בית המשפט ידחה את הבקשה לסילוק על הסף, שכן סעד זה הוא קיצוני ויינתן רק במקרים חריגים, כאשר ברור כי גם אם התובע יוכיח את כלל הנטען לא יעלה בידו לקבל את הסעד המבוקש.', true, 'בחירה זו נכונה. הפסיקה קובעת כי סילוק על הסף הוא סעד קיצוני, ובית המשפט יעדיף לאפשר תיקון כתב תביעה, אלא אם כן ברור שאין כל סיכוי לתביעה גם לאחר תיקון.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'בית המשפט יורה על תיקון כתב התביעה, ורק אם התובע לא יתקן, ימחק את התביעה על הסף.', false, 'בחירה זו שגויה חלקית. אף שבית המשפט אכן יעדיף לאפשר תיקון, במקרים מסוימים של חוסר פירוט חמור ומהותי, הוא עשוי למחוק על הסף גם ללא מתן הזדמנות לתיקון, במיוחד אם ניתנה הזדמנות לטיעון בעניין.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'בית המשפט יקבל את הבקשה לסילוק על הסף רק אם הנתבע יוכיח כי חוסר הפירוט נבע מחוסר תום לב של התובע.', false, 'בחירה זו שגויה. אף שחוסר תום לב הוא שיקול, סילוק על הסף עקב חוסר פירוט נבחן בעיקר על בסיס הפגם המהותי בכתב התביעה עצמו, ולא רק על בסיס כוונת התובע.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 8, '2022-S-Q08';
END
$$;

-- ============================================================
-- Q09 — 2022-S-Q09 — chapter=civil_proc subtopic=service_of_documents
-- classifier_note: Service of affidavits via fax at 17:00 — service-of-documents rules
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'e9381fc7-c8a6-4bac-aa66-9495683fc5ed'::uuid;
  v_group_id uuid := 'd83482ff-9080-4362-bbd6-d672a4392110'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '51be276b-14ad-416c-9dcf-86fb79f6c859'::uuid;
  v_ang_1 uuid := '42697641-99bd-42be-999f-7c0d4cc3b56c'::uuid;
  v_ang_2 uuid := '00f72e86-9f2e-4ad9-a49e-928e43a91bb5'::uuid;
  v_ang_3 uuid := '0fd0c848-5dba-42fa-828f-aa287051250f'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q09';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 9, '2022-S-Q09';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'service_of_documents' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'service_of_documents', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q09', v_chapter_id, v_subtopic_id, 'במסגרת תביעתו של אייל נגד אורן נדרש אייל להמציא את תצהירי העדות הראשית מטעמו לאורן. עורך דינו של אייל שלח אל עורך דינו של אורן תצהירים בהיקף של 13 עמודים, כולל נספחים, בשעה 17:00 באמצעות מכשיר הפקסימיליה. איזה מהמשפטים הבאים נכון?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 9}'::jsonb, 'שאלה זו עוסקת בכללי ההמצאה בפקסימיליה (פקס) על פי תקנה 161 לתקנות סדר הדין האזרחי, תשע"ט-2018. היא בוחנת את התנאים לתוקף המצאה בדרך זו, לרבות דרישת הווידוא הטלפוני, מגבלות היקף המסמך ומועדי השליחה.', 'תקנה 161(2) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת את הכללים להמצאה בפקסימיליה. סעיף קטן (ג) קובע כי יראו את המועד שצוין באישור משלוח הפקסימיליה כמועד ההמצאה ''ובלבד שבוצע וידוא טלפוני כי המסמך התקבל''. דרישת הווידוא הטלפוני היא תנאי מהותי לתוקף ההמצאה בפקס, למעט חריג ספציפי כאשר השולח הוא בית המשפט (תקנה 161(2)(ג)(2)). בנוסף, תקנה 161(2)(ב) מגבילה את היקף המסמך ל-15 עמודים ואוסרת המצאת כתב תביעה וכתב הגנה בפקס. תקנה 161(2)(ג)(1) קובעת כי מסמך שהומצא לאחר השעה 15:00 יראוהו כאילו הומצא ביום החול שלאחריו, אך אינו מבטל את תוקף ההמצאה. הפסיקה, גם תחת התקנות הישנות (תקנה 497א), הדגישה את חשיבות הווידוא הטלפוני (רע"א 6858/06 מדינת ישראל נ'' אבו שקיר).', 'הטעות הנפוצה היא לבלבל בין התנאים השונים לתוקף המצאה בפקס, כגון היקף המסמך, מועד השליחה ודרישת הווידוא הטלפוני, או להתעלם מההבחנה בין המצאה מעורך דין לבין המצאה מבית המשפט.',
    '["המצאה בפקסימיליה", "וידוא טלפוני", "תקנה 161", "תקנות סדר הדין האזרחי", "מועד המצאה", "היקף מסמך"]'::jsonb, '**וריאציה 1 — המצאה בפקס מעו"ד לעו"ד?** ← חובה וידוא טלפוני (תקנה 161(2)(ג)).
**וריאציה 2 — מה לגבי היקף ומסמכים מסוימים?** ← עד 15 עמודים, אסור לכתב תביעה/הגנה/מסמך ראשון (תקנה 161(2)(ב)).
**וריאציה 3 — מה קורה אם נשלח אחרי 15:00?** ← יראוהו כאילו הומצא ביום החול שלאחריו (תקנה 161(2)(ג)(1)).', 'המצאה בפקס ← וידוא טלפוני חובה (למעט חריג ביהמ"ש) + עד 15 עמודים + לא כתב תביעה/הגנה.', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 161", "רע\"א 6858/06 מדינת ישראל נ'' עטא אחמד אלקאדר אבו שקיר (31.12.2006)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''service_of_documents'' | classifier_note: Service of affidavits via fax at 17:00 — service-of-documents rules', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'היקף כה רחב של תצהירים לא ניתן להמציא באמצעות הפקס.', false, 'בחירה זו שגויה. תקנה 161(2)(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, מגבילה המצאה בפקס למסמך בהיקף של עד 15 עמודים, כך ש-13 עמודים נכללים בהיקף המותר.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'אין תוקף להמצאה באמצעות הפקס הנעשית לאחר השעה 15:00.', false, 'בחירה זו שגויה. המצאה בפקס לאחר השעה 15:00 אינה מבטלת את תוקף ההמצאה, אלא קובעת כי יראוה כאילו הומצאה ביום החול שלאחריו, בהתאם לתקנה 161(2)(ג)(1) לתקנות סדר הדין האזרחי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ההמצאה של תצהירי העדות הראשית בפקס אפשרית רק אם כתב התביעה או כתב ההגנה הומצאו אף הם באמצעות הפקס.', false, 'בחירה זו שגויה. אין דרישה כזו בתקנות. למעשה, תקנה 161(2)(ב) אוסרת המצאת כתב תביעה וכתב הגנה בפקס.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'כדי שלהמצאה בפקס יהיה תוקף, חובה לוודא טלפונית שהמסמך התקבל.', true, 'בחירה זו נכונה. תקנה 161(2)(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי המצאה בפקסימיליה תיחשב כמועד ההמצאה שצוין באישור המשלוח, ובלבד שבוצע וידוא טלפוני כי המסמך התקבל. חריג לכך קיים רק כאשר השולח הוא בית המשפט והנמען לא הגיש תצהיר אי-קבלה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'המצאה אלקטרונית באמצעות דואר אלקטרוני',
    1, 'ראובן שלח מסמך אלקטרוני לעורך דינו של שמעון באמצעות דואר אלקטרוני. עורך הדין של שמעון ציין את כתובת הדוא"ל שלו בכותרת כתב טענותיו. האם ההמצאה כדין?', 'שאלה זו בוחנת את כללי ההמצאה האלקטרונית בין עורכי דין, כפי שנקבעו בתקנות סדר הדין האזרחי, תשע"ט-2018. היא מדגישה את הדרישה לווידוא קבלה כחלק מהתנאים לתוקף ההמצאה בדרך זו.', 'תקנה 161(1)(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''המצאה אלקטרונית של מסמך אלקטרוני מעורך דין לעורך דין תהיה באמצעות משלוח המסמך האלקטרוני לכתובת הדואר האלקטרוני של עורך הדין הנמען שצוינה בכותרת כתב טענותיו ועל עורך הדין השולח לוודא את קבלתו בידי עורך הדין הנמען''. דרישת הווידוא נועדה להבטיח את תכלית ההמצאה – הבאת המסמך לידיעת הנמען. יש לשים לב להבחנה בין המצאה מעורך דין לעורך דין לבין המצאה מבית המשפט, שבה כללי הווידוא שונים (תקנה 161(1)(א)).',
    'הטעות הנפוצה היא להניח שדי בשליחת דואר אלקטרוני לכתובת שצוינה, מבלי להבין את חובת הווידוא המוטלת על עורך הדין השולח, או לבלבל בין כללי המצאה אלקטרונית לבין כללי המצאה בפקס.', '["המצאה אלקטרונית", "דואר אלקטרוני", "וידוא קבלה", "תקנה 161(1)(ג)", "המצאה בין עורכי דין", "תקנות סדר הדין האזרחי"]'::jsonb, '**וריאציה 1 — המצאה בדוא"ל מעו"ד לעו"ד?** ← כן, אם הכתובת צוינה ובוצע וידוא קבלה (תקנה 161(1)(ג)).
**וריאציה 2 — מה אם הכתובת לא צוינה?** ← ההמצאה אינה כדין.
**וריאציה 3 — מה ההבדל מהמצאה מבית המשפט?** ← מבית המשפט, אם הכתובת שמורה בנט המשפט, די במשלוח הודעה אלקטרונית או המסמך עצמו (תקנה 161(1)(א)).', 'המצאה בדוא"ל (עו"ד לעו"ד) ← כתובת צוינה + וידוא קבלה ← כדין.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 161(1)(ג)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, ובלבד שעורך הדין השולח וידא את קבלת המסמך על ידי עורך הדין הנמען.', true, 'תקנה 161(1)(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי המצאה אלקטרונית מעורך דין לעורך דין היא כדין אם נשלחה לכתובת הדוא"ל שצוינה בכותרת כתב הטענות, ובלבד שהשולח וידא את קבלתו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'כן, ללא צורך בווידוא קבלה, שכן כתובת הדוא"ל צוינה בכותרת כתב הטענות.', false, 'בחירה זו שגויה. בניגוד להמצאה מבית המשפט, בהמצאה מעורך דין לעורך דין נדרש וידוא קבלה, כאמור בתקנה 161(1)(ג).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'לא, המצאה אלקטרונית אפשרית רק באמצעות מערכת נט המשפט.', false, 'בחירה זו שגויה. תקנה 161(1)(ג) מאפשרת המצאה אלקטרונית ישירה מעורך דין לעורך דין, בנוסף לאפשרויות דרך נט המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, המצאה אלקטרונית אינה יכולה להחליף המצאה פיזית.', false, 'בחירה זו שגויה. תקנה 161(1) קובעת במפורש דרכים להמצאה אלקטרונית, המהוות המצאה כדין.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'כלל הידיעה מול כלל ההמצאה',
    2, 'פסק דין נשלח לעורך דין בפקס, אך לא בוצע וידוא טלפוני. עורך הדין טוען שההמצאה אינה כדין. האם בית המשפט יקבל את טענתו אם יוכח שידע בפועל על תוכן פסק הדין?', 'שאלה זו עוסקת במתח בין ''כלל ההמצאה'' הפורמלי לבין ''כלל הידיעה'' בפועל, ובאופן שבו הפסיקה מתייחסת לפגמים בהמצאה. היא מדגישה כי אף שכללי ההמצאה חשובים לוודאות, ''חריג הידיעה'' עשוי לחול במקרים חריגים, במיוחד כאשר עולה חשש לחוסר תום לב דיוני.', 'הפסיקה מבחינה בין ''כלל ההמצאה'' הפורמלי, המחייב עמידה מדויקת בכללי ההמצאה הקבועים בתקנות, לבין ''כלל הידיעה'', לפיו אם המסמך הגיע בפועל לידיעת הנמען, הושגה תכלית ההמצאה. ככלל, יש להקפיד על כללי ההמצאה הפורמליים כדי להבטיח וודאות ולמנוע סרבול (רע"א 6858/06 מדינת ישראל נ'' אבו שקיר). עם זאת, ''חריג הידיעה'' ייושם רק במקרים יוצאי דופן, כאשר חובת תום הלב הדיונית מצדיקה זאת, למשל כאשר בעל דין ידע בפועל על קיומה של החלטה אך בחר לשבת בחיבוק ידיים ללא מגבלת זמן (בש"א 4825/16 פלונית נ'' פלוני). בית המשפט לא יאפשר לבעל דין להיבנות מפגם טכני בהמצאה כאשר ידע בפועל על קיומו של המסמך, במיוחד אם התנהלותו מעידה על חוסר תום לב (בש"א 3311/19 מרגלית פפר נ'' יחיאל שטרן).',
    'הטעות הנפוצה היא לחשוב ש''כלל הידיעה'' מבטל את הצורך בהמצאה כדין באופן גורף, או לחילופין, שפגם טכני בהמצאה תמיד יאפשר לבעל דין להתעלם מהמסמך, מבלי להבין את האיזון העדין ואת חשיבות תום הלב הדיוני.', '["כלל ההמצאה", "כלל הידיעה", "פגמים בהמצאה", "תום לב דיוני", "הארכת מועד", "תכלית ההמצאה"]'::jsonb, '**וריאציה 1 — פגם בהמצאה אך יש ידיעה בפועל?** ← ככלל, כלל ההמצאה גובר, אך חריג הידיעה יחול במקרים יוצאי דופן של חוסר תום לב (רע"א 6858/06).
**וריאציה 2 — מהי תכלית ההמצאה?** ← להביא את המסמך לידיעת הנמען.
**וריאציה 3 — האם צפייה בנט המשפט מהווה ידיעה?** ← צפייה יזומה בנט המשפט עשויה להוות אינדיקציה לידיעה, אך אינה בהכרח המצאה כדין אם לא נמסרה כתובת דוא"ל להמצאה (בש"א 4825/16).', 'המצאה כדין ← כלל ההמצאה (פורמלי) מול כלל הידיעה (חריג, תום לב) ← וודאות מול תכלית.',
    '["רע\"א 6858/06 מדינת ישראל נ'' עטא אחמד אלקאדר אבו שקיר (31.12.2006)", "בש\"א 4825/16 פלונית נ'' פלוני (7.9.2016)", "בש\"א 3311/19 מרגלית פפר נ'' יחיאל שטרן (19.11.2019)", "ע\"א 8677/20 יוסף אנייס נ'' עזרא יחיא אדמונד (27.4.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כן, בית המשפט תמיד יעדיף את כלל ההמצאה הפורמלי על פני כלל הידיעה.', false, 'בחירה זו שגויה. אף שכלל ההמצאה הוא הכלל המנחה, הפסיקה הכירה בחריג הידיעה במקרים מסוימים, במיוחד כאשר יש חוסר תום לב דיוני.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לא, ידיעה בפועל על תוכן פסק הדין תמיד תגבר על פגמים בהמצאה.', false, 'בחירה זו שגויה. ידיעה בפועל אינה גוברת תמיד על פגמים בהמצאה. ''כלל הידיעה'' הוא חריג ל''כלל ההמצאה'' ויוחל רק במקרים יוצאי דופן, תוך בחינת תום הלב הדיוני.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'בית המשפט עשוי להחיל את ''כלל הידיעה'' במקרים חריגים ויוצאי דופן, במיוחד כאשר התנהלות עורך הדין מעידה על חוסר תום לב דיוני.', true, 'בחירה זו נכונה. הפסיקה קבעה כי ''חריג הידיעה'' ייושם רק במקרים יוצאי דופן, כאשר חובת תום הלב הדיונית מצדיקה זאת, ואין בכך כדי לאפשר לבעל דין לשבת בחיבוק ידיים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'רק אם עורך הדין הודה במפורש שקיבל את פסק הדין, תגבר ידיעתו על פגמים בהמצאה.', false, 'בחירה זו שגויה. הודאה מפורשת היא אינדיקציה חזקה לידיעה, אך ''כלל הידיעה'' אינו מוגבל רק למקרים של הודאה מפורשת, אלא נבחן על בסיס מכלול הנסיבות ותום הלב הדיוני.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'מסמכים שלא ניתן להמציא בפקסימיליה',
    3, 'עורך דין שלח כתב תביעה בהיקף 10 עמודים באמצעות פקס. האם ההמצאה כדין?', 'שאלה זו מתמקדת בחריגים לכלל ההמצאה בפקסימיליה, ובפרט בסוגי המסמכים שלא ניתן להמציא בדרך זו. היא בוחנת את ידיעת תקנה 161(2)(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, המגבילה את השימוש בפקס למסמכים מסוימים.', 'תקנה 161(2)(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי ''המצאה בפקסימיליה מוגבלת למסמך בהיקף של עד חמישה עשר עמודים והיא אינה חלה על המצאת המסמך הראשון המוגש בתיק ועל כתב תביעה וכתב הגנה''. מכאן, שכתב תביעה, גם אם היקפו עומד בדרישת העמודים, אינו ניתן להמצאה בפקס. איסור זה נועד להבטיח שהמסמכים המהותיים ביותר בהליך יומצאו בדרכים המבטיחות קבלה וידיעה ודאית יותר. ראו גם ע"א 7112/11 יעקובסון אברהם נ'' כונס הנכסים הרשמי (2.2.2012) שדן באיסור המצאת כתב בי-דין ראשון בפקס.',
    'הטעות הנפוצה היא להתמקד רק בהיקף העמודים המותר להמצאה בפקס, ולהתעלם מהאיסור המפורש על המצאת כתבי טענות ראשוניים (כתב תביעה וכתב הגנה) בדרך זו.', '["המצאה בפקסימיליה", "כתב תביעה", "כתב הגנה", "מסמך ראשון בתיק", "תקנה 161(2)(ב)", "היקף מסמך"]'::jsonb, '**וריאציה 1 — האם ניתן להמציא כתב תביעה בפקס?** ← לא, תקנה 161(2)(ב) אוסרת זאת.
**וריאציה 2 — מה לגבי כתב הגנה?** ← גם כתב הגנה אסור להמצאה בפקס.
**וריאציה 3 — מה ההיקף המותר למסמכים אחרים בפקס?** ← עד 15 עמודים (תקנה 161(2)(ב)).', 'המצאה בפקס ← אסור לכתב תביעה/הגנה/מסמך ראשון ← מותר עד 15 עמודים למסמכים אחרים.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 161(2)(ב)", "ע\"א 7112/11 יעקובסון אברהם נ'' כונס הנכסים הרשמי (2.2.2012)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, היקף המסמך עומד בדרישות התקנות.', false, 'בחירה זו שגויה. אף שהיקף המסמך (10 עמודים) עומד בדרישת תקנה 161(2)(ב) המגבילה ל-15 עמודים, כתב תביעה הוא מסמך שלא ניתן להמציא בפקס.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, כתב תביעה אינו נכלל בין המסמכים שניתן להמציא בפקסימיליה.', true, 'בחירה זו נכונה. תקנה 161(2)(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי המצאה בפקסימיליה אינה חלה על המצאת המסמך הראשון המוגש בתיק ועל כתב תביעה וכתב הגנה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, ובלבד שבוצע וידוא טלפוני שהמסמך התקבל.', false, 'בחירה זו שגויה. דרישת הווידוא הטלפוני היא תנאי הכרחי להמצאה בפקס, אך אינה מספיקה כאשר מדובר במסמך שאינו ניתן להמצאה בפקס מלכתחילה, כגון כתב תביעה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, היקף המסמך עולה על המותר להמצאה בפקס.', false, 'בחירה זו שגויה. היקף המסמך (10 עמודים) אינו עולה על המותר (15 עמודים), אך הסיבה לאי-תוקף ההמצאה היא סוג המסמך.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'המצאה על ידי בית המשפט ללא וידוא טלפוני',
    4, 'בית המשפט שלח החלטה לעורך דין בפקס, אך לא בוצע וידוא טלפוני. עורך הדין טוען שלא קיבל את ההחלטה. מה הדין?', 'שאלה זו עוסקת בחריג ספציפי לכלל הווידוא הטלפוני בהמצאה בפקס, כאשר השולח הוא בית המשפט. היא בוחנת את ידיעת תקנה 161(2)(ג)(2) לתקנות סדר הדין האזרחי, תשע"ט-2018, המטילה את הנטל על הנמען להוכיח אי-קבלה בתצהיר.', 'תקנה 161(2)(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי המצאה בפקס דורשת וידוא טלפוני. אולם, תקנה 161(2)(ג)(2) קובעת חריג מפורש לכלל זה: ''אם השולח הוא בית המשפט ולא בוצע וידוא טלפוני, תיחשב השליחה כהמצאה כדין אלא אם כן הגיש הנמען תצהיר בדבר אי-קבלת המסמך בפקסימיליה''. כלל זה מעביר את הנטל על הנמען להוכיח כי לא קיבל את המסמך, וזאת באמצעות תצהיר. הוראה זו שונה מהמצב שקדם לתקנות החדשות, אז נדרש וידוא טלפוני גם בהמצאה מבית המשפט, אלא אם כן הוכח ''כלל הידיעה'' (רע"א 6858/06 מדינת ישראל נ'' אבו שקיר). ראו גם תאד"מ (שלום ראשל"צ) 8166-02-23 רמי מור אלבז נ'' סאני תקשורת סלולרית בע"מ (10.3.2025) ות"ק (תביעות קטנות קריות) 7732-12-24 פליקס כהן נ'' קפיטל מוטורס בע"מ (26.8.2025).',
    'הטעות הנפוצה היא ליישם את הכלל הכללי של וידוא טלפוני גם כאשר השולח הוא בית המשפט, מבלי להכיר את החריג הספציפי הקבוע בתקנה 161(2)(ג)(2) ואת נטל ההוכחה המוטל על הנמען.', '["המצאה בפקסימיליה", "המצאה מבית המשפט", "וידוא טלפוני", "תצהיר אי-קבלה", "תקנה 161(2)(ג)(2)", "נטל הוכחה"]'::jsonb, '**וריאציה 1 — המצאה בפקס מבית המשפט ללא וידוא טלפוני?** ← כדין, אלא אם הנמען הגיש תצהיר אי-קבלה (תקנה 161(2)(ג)(2)).
**וריאציה 2 — מה אם השולח הוא עורך דין?** ← חובה וידוא טלפוני (תקנה 161(2)(ג)).
**וריאציה 3 — מהי חשיבות התצהיר?** ← מעביר את נטל ההוכחה על הנמען להוכיח אי-קבלה.', 'המצאה בפקס מביהמ"ש ← ללא וידוא טלפוני ← כדין, אלא אם תצהיר אי-קבלה.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 161(2)(ג)(2)", "רע\"א 6858/06 מדינת ישראל נ'' עטא אחמד אלקאדר אבו שקיר (31.12.2006)", "תאד\"מ (שלום ראשל\"צ) 8166-02-23 רמי מור אלבז נ'' סאני תקשורת סלולרית בע\"מ (10.3.2025)", "ת\"ק (תביעות קטנות קריות) 7732-12-24 פליקס כהן נ'' קפיטל מוטורס בע\"מ (26.8.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'ההמצאה אינה כדין, שכן וידוא טלפוני הוא תנאי הכרחי לתוקף המצאה בפקס.', false, 'בחירה זו שגויה. אף שווידוא טלפוני הוא תנאי הכרחי בדרך כלל, קיים חריג מפורש כאשר השולח הוא בית המשפט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'השליחה תיחשב כהמצאה כדין, אלא אם כן הגיש עורך הדין תצהיר בדבר אי-קבלת המסמך בפקסימיליה.', true, 'בחירה זו נכונה. תקנה 161(2)(ג)(2) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת חריג לדרישת הווידוא הטלפוני כאשר השולח הוא בית המשפט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'ההמצאה אינה כדין, ועל בית המשפט להמציא את ההחלטה מחדש בדרך אחרת.', false, 'בחירה זו שגויה. בית המשפט אינו חייב להמציא מחדש אם עורך הדין לא הגיש תצהיר אי-קבלה, שכן במקרה כזה ההמצאה נחשבת כדין.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'השליחה תיחשב כהמצאה כדין רק אם עורך הדין ידע בפועל על תוכן ההחלטה.', false, 'בחירה זו שגויה. ''כלל הידיעה'' הוא חריג כללי, אך תקנה 161(2)(ג)(2) קובעת כלל ספציפי לגבי המצאה בפקס מבית המשפט, שאינו תלוי בידיעה בפועל אלא בהגשת תצהיר אי-קבלה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 9, '2022-S-Q09';
END
$$;

-- ============================================================
-- Q11 — 2022-S-Q11 — chapter=execution subtopic=debtor_rights
-- classifier_note: Debtor with 120K NIS debt across multiple files, can't pay — debtor's options
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'af8d975c-8027-4b15-8c59-b3d2dd07d41f'::uuid;
  v_group_id uuid := 'ab598710-71e6-4ed3-a0a3-ce9c2ddf29e2'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'f3bdebb3-d97d-46ad-9ba9-1a0e50958ec5'::uuid;
  v_ang_1 uuid := 'be991b3e-3370-4dd8-8a8e-48d29b7727a0'::uuid;
  v_ang_2 uuid := 'e63a0c53-8c22-423c-a9b0-7bf52b82bbd8'::uuid;
  v_ang_3 uuid := '528d56ee-1222-4f0f-8683-405fa550c843'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q11';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 11, '2022-S-Q11';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'execution';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'execution';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'debtor_rights' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'debtor_rights', 'execution';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q11', v_chapter_id, v_subtopic_id, 'למשרד עורך דין מגיע חייב עם חובות שונים בלשכות ההוצאה לפועל. מתברר כי סך כל החובות הוא 120,000 ש"ח. עקב נסיבות שונות אין לחייב שום אפשרות לשלם את הסכום הזה ואפילו לא חלק קטן ממנו. החייב מסביר לעורך דין שהוא שמע על מסלול הקרוי "חייב מוגבל באמצעים" ושואל אם המסלול הזה יכול להיות פתרון עבורו. מה יענה עורך הדין לפי המצב המשפטי הנוכחי?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 11}'::jsonb, 'שאלה זו עוסקת בשינוי המהותי שחל בדיני ההוצאה לפועל וחדלות הפירעון עם כניסתו לתוקף של חוק חדלות פירעון ושיקום כלכלי, תשע"ח-2018. היא מתמקדת בביטול מוסד ''חייב מוגבל באמצעים'' ובמסלולים החדשים העומדים בפני חייבים שאינם יכולים לפרוע את חובותיהם, תוך הבחנה בין סמכויות הערכאות השונות בהתאם לגובה החוב.', 'עם כניסתו לתוקף של חוק חדלות פירעון ושיקום כלכלי ביום 15.9.2019, בוטלה האפשרות להכריז על חייב כ''חייב מוגבל באמצעים'' (סעיף 69י1 לחוק ההוצאה לפועל, תשכ"ז-1967). כפי שצוין בפסיקה (למשל, רע"א 6455/19 סרגיי ירוחימוביץ נ'' כונס הנכסים הרשמי (2020)), המצב הנורמטיבי החדש מכוון חייבים שאינם יכולים לפרוע את חובותיהם לפנות להליכי חדלות פירעון. החוק מבחין בין שני סוגי חייבים חדלי פירעון: אם סך חובותיו של החייב אינו עולה על 150,000 ש"ח, יראו את הודעתו כבקשה לצו לפתיחת הליכים לפי חוק חדלות פירעון ושיקום כלכלי, וההליכים יתנהלו בפני רשם ההוצאה לפועל (סעיף 7א2(1) לחוק ההוצאה לפועל, וסעיפים 186-187 לחוק חדלות פירעון). אם סך חובותיו עולה על 150,000 ש"ח, תמסור לו לשכת ההוצאה לפועל מידע לגבי האפשרות להגיש בקשה לצו לפתיחת הליכים לממונה על הליכי חדלות פירעון ושיקום כלכלי, וההליכים יתנהלו בפני הממונה ובית משפט השלום (סעיף 7א2(2) לחוק ההוצאה לפועל, וסעיף 104 לחוק חדלות פירעון). במקרה הנדון, סך החובות הוא 120,000 ש"ח, ולכן ההליכים יתנהלו בפני רשם ההוצאה לפועל.', 'הטעות הנפוצה היא לחשוב שמוסד ''חייב מוגבל באמצעים'' עדיין קיים לחייבים חדשים, או לבלבל בין הערכאות המוסמכות לטיפול בהליכי חדלות פירעון ליחידים בהתאם לגובה החוב.',
    '["חייב מוגבל באמצעים", "חוק חדלות פירעון ושיקום כלכלי", "סעיף 69י1 לחוק ההוצאה לפועל", "סעיף 7א2 לחוק ההוצאה לפועל", "רשם ההוצאה לפועל", "הממונה על הליכי חדלות פירעון"]'::jsonb, '**וריאציה 1 — האם ניתן להכריז על חייב חדש כ''מוגבל באמצעים''?** ← לא, המוסד בוטל ב-15.9.2019 (סעיף 69י1 לחוק ההוצאה לפועל).
**וריאציה 2 — מה האלטרנטיבה לחייב שאינו יכול לשלם?** ← הליכי חדלות פירעון (סעיף 7א2 לחוק ההוצאה לפועל).
**וריאציה 3 — מי מטפל בחוב של 120,000 ש"ח?** ← רשם ההוצאה לפועל, כי החוב נמוך מ-150,000 ש"ח (סעיף 7א2(1) לחוק ההוצאה לפועל).', 'מוסד ''חייב מוגבל באמצעים'' בוטל ← חייב חדש שאינו יכול לשלם ← פונה לחדלות פירעון ← רשם הוצל"פ (חוב עד 150k ש"ח) או ממונה + שלום (חוב מעל 150k ש"ח).', '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיפים 7א2, 69י1", "חוק חדלות פירעון ושיקום כלכלי, תשע\"ח-2018, סעיפים 103, 104, 186, 187", "רע\"א 6455/19 סרגיי ירוחימוביץ נ'' כונס הנכסים הרשמי (28.1.2020)", "רער\"צ (שלום ת\"א) 45212-09-20 שלמה אלפסי נ'' בנדא מגנטיק בע\"מ (7.2.2021)", "רער\"צ (שלום ת\"א) 38953-12-21 דוד אריאל פינטו נ'' בנק מזרחי טפחות בע\"מ (27.3.2022)", "רער\"צ (שלום עכו) 5809-09-21 ג''מינה מוסא נ'' גל בדארנה בע\"מ (10.4.2022)", "רער\"צ (שלום עכו) 17687-02-22 ניר בורנשטיין נ'' קיבוץ עין המפרץ (19.4.2022)", "רשם ההוצאה לפועל תל אביב-יפו) 802094-04-21 היחידה - ש.י נ'' (9.8.2022)", "רשם ההוצאה לפועל ירושלים) 12148356 חייב נ'' (17.5.2026)"]'::jsonb,
    'classification_review: original chapter=''הוצאה לפועל'' subtopic=''זכויות החייב'' → mapped chapter=''execution'' subtopic=''debtor_rights'' | classifier_note: Debtor with 120K NIS debt across multiple files, can''t pay — debtor''s options', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'מסלול חייב מוגבל באמצעים יכול להיות פתרון, אם כי בלי לשלם ולו חלק קטן של החוב לא ניתן לדעת מראש אם החייב יקבל הפטר.', false, 'בחירה זו שגויה. מסלול ''חייב מוגבל באמצעים'' בוטל עם כניסתו לתוקף של חוק חדלות פירעון ושיקום כלכלי, ואינו זמין לחייבים חדשים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'אין אפשרות להיות חייב מוגבל באמצעים, ועל החייב לפנות בבקשה לפתיחת הליכי חדלות פירעון. ההליכים יתנהלו בבית משפט השלום.', false, 'בחירה זו שגויה חלקית. אכן אין אפשרות להיות ''חייב מוגבל באמצעים'', ועל החייב לפנות להליכי חדלות פירעון. אולם, מאחר שסך חובותיו של החייב (120,000 ש"ח) אינו עולה על 150,000 ש"ח, ההליכים יתנהלו בפני רשם ההוצאה לפועל, ולא בבית משפט השלום.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אין אפשרות להיות חייב מוגבל באמצעים, ועל החייב להגיש בקשה להליכי חדלות פירעון. ההליכים יתנהלו בפני רשם ההוצאה לפועל.', true, 'בחירה זו נכונה. סעיף 69י1 לחוק ההוצאה לפועל קובע כי מוסד ''חייב מוגבל באמצעים'' בוטל. סעיף 7א2 לחוק ההוצאה לפועל, יחד עם הוראות חוק חדלות פירעון ושיקום כלכלי, קובע כי חייב שאינו יכול לפרוע את חובותיו יופנה להליכי חדלות פירעון. מאחר שסך חובותיו של החייב (120,000 ש"ח) אינו עולה על 150,000 ש"ח, ההליכים יתנהלו בפני רשם ההוצאה לפועל.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אפשר להגיש בקשה להיות מוכרז חייב מוגבל באמצעים, אך אם החייב לא יכול להתחייב לפרוע את כל החובות בתוך 4 שנים, הבקשה תידון בבית משפט השלום כבקשה לחדלות פירעון.', false, 'בחירה זו שגויה. אין אפשרות להגיש בקשה להכרה כ''חייב מוגבל באמצעים'' לחייבים חדשים. בנוסף, ההליכים במקרה זה יתנהלו בפני רשם ההוצאה לפועל ולא בבית משפט השלום.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'תחולת סעיף 7א1 על חייבים מוגבלים באמצעים שהוכרזו לפני 15.9.2019',
    1, 'חייב הוכרז כ''חייב מוגבל באמצעים'' ואוחדו תיקיו בשנת 2018. כעת, רשם ההוצאה לפועל דורש ממנו לעמוד בצו תשלומים בהתאם למגבלות הזמן הקבועות בסעיף 7א1 לחוק ההוצאה לפועל. האם דרישת הרשם כדין?', 'שאלה זו עוסקת בתחולה בזמן של תיקוני חוק ההוצאה לפועל, ובפרט בסעיף 7א1, על חייבים שהוכרזו כ''מוגבלים באמצעים'' לפני כניסת חוק חדלות פירעון לתוקף. היא מדגישה את עקרון התחולה הפרוספקטיבית של החוק ואת ההבחנה בין חייבים ''ישנים'' ל''חדשים''.', 'החל מיום 15.9.2019, עם כניסתו לתוקף של חוק חדלות פירעון ושיקום כלכלי, בוטלה האפשרות להכריז על חייב כ''מוגבל באמצעים'' (סעיף 69י1 לחוק ההוצאה לפועל). הפסיקה, כפי שנקבע ברע"רצ (שלום ת"א) 45212-09-20 שלמה אלפסי נ'' בנדא מגנטיק בע"מ (2021) וברע"רצ (שלום ת"א) 22248-08-19 אילן פז אביטן נ'' אפרים אפי מלכה (2020), קבעה כי ביטול זה הוא פרוספקטיבי. כלומר, חייבים שהוכרזו כ''מוגבלים באמצעים'' לפני 15.9.2019 ממשיכים להתנהל במסגרת איחוד תיקים לפי הדין הישן, ואינם מחויבים לפרוע את חובותיהם במסגרת הזמנים הקבועה בסעיף 7א1 לחוק ההוצאה לפועל, כל עוד הם עומדים בצו התשלומים והכרזתם לא בוטלה. רק במקרים בהם תיק האיחוד פוזר ונדרש צו תשלומים חדש, יחולו מגבלות סעיף 7א1.',
    'הטעות הנפוצה היא להניח שתיקוני החוק חלים באופן גורף על כלל החייבים, מבלי להבחין בין חייבים שהוכרזו כ''מוגבלים באמצעים'' לפני כניסת חוק חדלות פירעון לתוקף לבין חייבים חדשים.', '["חייב מוגבל באמצעים", "חוק חדלות פירעון ושיקום כלכלי", "תחולה פרוספקטיבית", "סעיף 69י1 לחוק ההוצאה לפועל", "סעיף 7א1 לחוק ההוצאה לפועל", "איחוד תיקים"]'::jsonb, '**וריאציה 1 — חייב מוגבל באמצעים מ-2018?** ← ממשיך להתנהל לפי הדין הישן, לא כפוף ל-7א1 (רער"צ (שלום ת"א) 45212-09-20).
**וריאציה 2 — מתי כן יחול 7א1?** ← אם תיק האיחוד פוזר ונדרש צו תשלומים חדש (רער"צ (שלום עכו) 20503-03-21).
**וריאציה 3 — מה משמעות ביטול מוסד חייב מוגבל באמצעים?** ← חל על בקשות שהוגשו מ-15.9.2019 ואילך (רחד"פ (מחוזי ת"א) 34443-11-19).', 'חייב מוגבל באמצעים (לפני 15.9.19) ← לא כפוף ל-7א1 ← ממשיך לפי הדין הישן.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיפים 7א1, 69י1", "רער\"צ (שלום ת\"א) 45212-09-20 שלמה אלפסי נ'' בנדא מגנטיק בע\"מ (7.2.2021)", "רער\"צ (שלום ת\"א) 22248-08-19 אילן פז אביטן נ'' אפרים אפי מלכה (6.10.2020)", "רחד\"פ (מחוזי תל אביב-יפו) 34443-11-19 אילן פז אביטן נ'' הכונס הרשמי והממונה על הליכי חדלות פירעון ושיקום כלכלי (26.7.2020)", "רער\"צ (שלום כ\"ס) 37780-11-19 איוון סטרוב נ'' בנק דיסקונט לישראל בע\"מ (5.3.2020)", "רער\"צ (שלום עכו) 20503-03-21 פתחי חרזאן נ'' רחמים דמתי (18.5.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, סעיף 7א1 חל על כלל החייבים, לרבות אלו שהוכרזו כ''מוגבלים באמצעים'' לפני כניסת חוק חדלות פירעון לתוקף.', false, 'בחירה זו שגויה. הפסיקה קבעה כי סעיף 7א1 אינו חל על חייבים שהוכרזו כ''מוגבלים באמצעים'' לפני 15.9.2019, אלא אם כן תיק האיחוד שלהם פוזר ונדרש צו תשלומים חדש.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, סעיף 7א1 אינו חל על חייבים שהוכרזו כ''מוגבלים באמצעים'' לפני 15.9.2019, והם ממשיכים להתנהל לפי הדין הישן, כל עוד תיק האיחוד שלהם פעיל והם עומדים בצו התשלומים.', true, 'בחירה זו נכונה. הפסיקה קבעה כי ביטול מוסד ''חייב מוגבל באמצעים'' הוא פרוספקטיבי, ומי שהוכרז ככזה לפני 15.9.2019 ממשיך להתנהל לפי הדין הישן ואינו כפוף למגבלות סעיף 7א1, כל עוד תיק האיחוד שלו לא פוזר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק אם החייב לא עמד בצו התשלומים שנקבע לו בתיק האיחוד.', false, 'בחירה זו שגויה. אי-עמידה בצו תשלומים יכולה להוביל לביטול הכרזת ''חייב מוגבל באמצעים'' או פיזור תיק האיחוד, אך אינה הופכת את סעיף 7א1 לתקף רטרואקטיבית על חייבים שהוכרזו לפני 15.9.2019.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, אלא אם כן החייב יפנה להליכי חדלות פירעון מרצון.', false, 'בחירה זו שגויה. פנייה מרצון להליכי חדלות פירעון היא אפשרות העומדת בפני החייב, אך אינה משנה את העובדה שסעיף 7א1 אינו חל עליו באופן אוטומטי מכוח הכרזתו הקודמת כ''חייב מוגבל באמצעים''.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'שיקול דעת רשם ההוצאה לפועל בהפניית חייב לחדלות פירעון',
    2, 'חייב עם חובות בסך 80,000 ש"ח פנה לרשם ההוצאה לפועל בבקשה לצו תשלומים, אך הצהיר כי אינו יכול לעמוד בתשלומים בתקופות הקבועות בסעיף 7א1 לחוק ההוצאה לפועל. רשם ההוצאה לפועל שקל את נסיבותיו האישיות של החייב, את גובה חובותיו הנמוך יחסית, ואת העובדה שהזוכה לא נקט בהליכים במשך שנים, והחליט להפחית את הריביות מכוח סעיף 81א4 לחוק ההוצאה לפועל, במקום להפנות את החייב להליכי חדלות פירעון. האם החלטת הרשם סבירה?', 'שאלה זו בוחנת את שיקול הדעת של רשם ההוצאה לפועל בהתמודדות עם חייבים שאינם יכולים לעמוד בתקופות התשלום הקבועות בחוק. היא מדגישה את הגישה המאפשרת לרשם להפעיל כלים שונים, כגון הפחתת ריביות, במקום להפנות אוטומטית להליכי חדלות פירעון, במיוחד כאשר מדובר בחובות נמוכים.', 'רשם ההוצאה לפועל, בתפקידו כרשם הוצאה לפועל וכרשם חדלות פירעון (בהתאם לסעיף 188 לחוק חדלות פירעון), מוסמך לאזן בין תכליות חוק חדלות פירעון (שיקום החייב והשאת שיעור הפירעון לנושים) ולבחון את הדרך המיטבית למימושן. כפי שצוין בהחלטות רשמים כגון רשם דיין (רשם ההוצאה לפועל תל אביב-יפו) 6348876 (2024) ו-6076611 (2023), הליך חדלות פירעון אינו תמיד ''דרך המלך'' או ברירת המחדל, במיוחד עבור חייבים עם חובות נמוכים. במקרים אלו, הרשם רשאי להשתמש בכלים הקיימים בחוק ההוצאה לפועל, כגון הפחתת ריביות מכוח סעיף 81א4, כדי להשיג את תכליות החוק, תוך התחשבות בנסיבות החייב ובהתנהלות הזוכה (למשל, שיהוי).',
    'הטעות הנפוצה היא לחשוב שעם ביטול מוסד ''חייב מוגבל באמצעים'' וקביעת תקופות תשלום קצובות, כל חייב שאינו עומד בהן חייב לעבור להליכי חדלות פירעון, מבלי להכיר בשיקול הדעת של הרשם ובכלים החלופיים העומדים לרשותו.', '["שיקול דעת רשם ההוצאה לפועל", "הפחתת ריביות", "סעיף 81א4 לחוק ההוצאה לפועל", "חוק חדלות פירעון ושיקום כלכלי", "תכליות החוק", "חובות נמוכים"]'::jsonb, '**וריאציה 1 — חייב לא יכול לעמוד ב-7א1, חוב נמוך?** ← רשם יכול להפחית ריביות במקום להפנות לחדלות פירעון (רשם ההוצאה לפועל תל אביב-יפו) 6348876).
**וריאציה 2 — מה תכלית החלטת הרשם?** ← איזון בין שיקום החייב להשאת שיעור הפירעון לנושים.
**וריאציה 3 — האם חדלות פירעון היא תמיד הדרך המועדפת?** ← לא, במיוחד בחובות נמוכים, יש לבחון כלים אחרים (רשם ההוצאה לפועל תל אביב-יפו) 6076611).', 'חוסר יכולת לעמוד ב-7א1 (חוב נמוך) ← רשם יכול להפחית ריביות (81א4) ← לא בהכרח חדלות פירעון.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיפים 7א1, 81א4", "חוק חדלות פירעון ושיקום כלכלי, תשע\"ח-2018, סעיף 188", "(רשם ההוצאה לפועל תל אביב-יפו) 6348876 חייב נ'' (10.6.2024)", "(רשם ההוצאה לפועל תל אביב-יפו) 6076611 חייב נ'' (12.6.2023)", "(רשם ההוצאה לפועל חיפה) 6269873 זוכה נ'' (26.2.2024)", "(רשם ההוצאה לפועל חיפה) 6318125 חייבת נ'' (11.4.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'לא, רשם ההוצאה לפועל חייב להפנות את החייב להליכי חדלות פירעון אם אינו יכול לעמוד בתקופות הקבועות בסעיף 7א1, שכן זוהי תכלית החוק החדש.', false, 'בחירה זו שגויה. אף שתכלית החוק החדש היא להפנות חייבים לחדלות פירעון, הפסיקה מכירה בשיקול דעת לרשם ההוצאה לפועל, במיוחד בחובות נמוכים, להשתמש בכלים אחרים העומדים לרשותו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'כן, לרשם ההוצאה לפועל שיקול דעת רחב לאזן בין תכליות החוק, והוא רשאי להשתמש בכלים הקיימים בחוק ההוצאה לפועל, כגון הפחתת ריביות, במקום להפנות חייב להליכי חדלות פירעון, במיוחד בחובות נמוכים.', true, 'בחירה זו נכונה. רשמי ההוצאה לפועל, גם כרשמי חדלות פירעון, מוסמכים לאזן בין תכליות החוק (שיקום החייב והשאת שיעור הפירעון לנושים) ולהשתמש בכלים שונים, כולל הפחתת ריביות, במקום להפנות אוטומטית לחדלות פירעון, במיוחד בחובות נמוכים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'לא, הפחתת ריביות אפשרית רק במקרים של חוסר תום לב מצד הזוכה, ולא במקרים של חוסר יכולת של החייב.', false, 'בחירה זו שגויה. הפחתת ריביות מכוח סעיף 81א4 לחוק ההוצאה לפועל אפשרית גם מטעמים מיוחדים אחרים, ולא רק במקרים של חוסר תום לב של הזוכה, אם כי שיהוי של הזוכה הוא בהחלט שיקול רלוונטי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'כן, אך רק אם הזוכה הסכים במפורש להפחתת הריביות.', false, 'בחירה זו שגויה. רשם ההוצאה לפועל מוסמך להפחית ריביות גם ללא הסכמת הזוכה, במקרים המתאימים, מכוח סעיף 81א4 לחוק ההוצאה לפועל.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'פיזור תיק איחוד עקב חוסר תום לב',
    3, 'חייבת שהוכרזה כ''חייבת מוגבלת באמצעים'' לפני 2019, וניהלה תיק איחוד, נחשפה כמי שמסתירה הכנסות, יוצרת חובות חדשים ומנצלת את תיק האיחוד כ''אכסניה'' לחובותיה. הזוכה מבקש לפזר את תיק האיחוד. מה הדין?', 'שאלה זו עוסקת בפיזור תיק איחוד של חייב שהוכרז כ''מוגבל באמצעים'' לפני כניסת חוק חדלות פירעון לתוקף, במקרים של חוסר תום לב וניצול לרעה של ההליך. היא מדגישה את חשיבות תום הלב בהליכי הוצאה לפועל וחדלות פירעון, ואת הסמכות של רשם ההוצאה לפועל לפזר תיק איחוד במקרים אלו.', 'אף שחייבים שהוכרזו כ''מוגבלים באמצעים'' לפני 15.9.2019 ממשיכים להתנהל לפי הדין הישן, אין בכך כדי להקנות להם חסינות מפני פיזור תיק האיחוד במקרים של חוסר תום לב. הפסיקה, כפי שנקבע ברשם ההוצאה לפועל תל אביב-יפו) 7304333 (2024) וברשם ההוצאה לפועל תל אביב-יפו) 9584248 (2025), קובעת כי התנהלות לקויה מצד חייב, כגון הסתרת הכנסות, יצירת חובות חדשים וניצול לרעה של תיק האיחוד כ''אכסניה'' לחובות, מהווה עילה לפיזור תיק האיחוד והסרת ההגנות. במקרים אלו, המשך קיום תיק האיחוד מנציח את החוב ופוגע בנושים, ועל כן יש להפנות את החייב להליכי חדלות פירעון, המהווים את המסלול הראוי לשיקום כלכלי.',
    'הטעות הנפוצה היא לחשוב שמעמד ''חייב מוגבל באמצעים'' שהוכרז לפני 2019 מקנה הגנה מוחלטת מפני פיזור תיק האיחוד, מבלי להכיר בחשיבות תום הלב ובהשלכות של ניצול לרעה של ההליך.', '["פיזור תיק איחוד", "חייב מוגבל באמצעים", "חוסר תום לב", "ניצול לרעה של הליך", "הסתרת הכנסות", "יצירת חובות חדשים"]'::jsonb, '**וריאציה 1 — חייב מוגבל באמצעים מנצל לרעה את תיק האיחוד?** ← רשם רשאי לפזר את התיק ולהסיר הגנות (רשם ההוצאה לפועל תל אביב-יפו) 7304333).
**וריאציה 2 — מהן דוגמאות לניצול לרעה?** ← הסתרת הכנסות, יצירת חובות חדשים, שימוש בתיק כ''אכסניה'' לחובות (רשם ההוצאה לפועל תל אביב-יפו) 9584248).
**וריאציה 3 — מהי התוצאה של פיזור התיק?** ← הסרת הגנות והפנייה אפשרית להליכי חדלות פירעון.', 'תיק איחוד (חייב מוגבל באמצעים) ← חוסר תום לב/ניצול לרעה ← פיזור תיק והסרת הגנות.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967", "(רשם ההוצאה לפועל תל אביב-יפו) 7304333 חייב נ'' (2.12.2024)", "(רשם ההוצאה לפועל תל אביב-יפו) 9584248 חייב נ'' (4.8.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'תיק האיחוד לא יפוזר, שכן החייבת הוכרזה כ''מוגבלת באמצעים'' לפני כניסת חוק חדלות פירעון לתוקף, והיא מוגנת מפני פיזור התיק.', false, 'בחירה זו שגויה. אף שההכרזה הייתה לפני כניסת החוק החדש, התנהלות בחוסר תום לב וניצול לרעה של ההליך מהווים עילה לפיזור תיק איחוד, גם אם החייב הוכרז כ''מוגבל באמצעים'' בעבר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'רשם ההוצאה לפועל רשאי לפזר את תיק האיחוד ולהסיר את ההגנות שניתנו לחייבת, שכן התנהלותה מעידה על חוסר תום לב וניצול לרעה של ההליך, ואינה עולה בקנה אחד עם תכליות החוק.', true, 'בחירה זו נכונה. הפסיקה קובעת כי חוסר תום לב, הסתרת הכנסות ויצירת חובות חדשים תוך ניצול תיק האיחוד, מהווים עילה לפיזור תיק האיחוד והפניית החייב להליכי חדלות פירעון, גם אם הוכרז כ''מוגבל באמצעים'' בעבר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'תיק האיחוד יפוזר רק אם החייבת לא עמדה בצו התשלומים שנקבע לה, ולא עקב הסתרת הכנסות או יצירת חובות חדשים.', false, 'בחירה זו שגויה. אי-עמידה בצו תשלומים היא עילה לפיזור, אך גם הסתרת הכנסות, יצירת חובות חדשים וניצול לרעה של ההליך מהווים עילות עצמאיות לפיזור תיק האיחוד.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'רשם ההוצאה לפועל יורה על הגדלת צו התשלומים, אך לא יפזר את תיק האיחוד, כדי לא לפגוע בשיקום החייבת.', false, 'בחירה זו שגויה. במקרים של חוסר תום לב מהותי, פיזור תיק האיחוד והפנייה לחדלות פירעון נחשבים לדרך הראויה, שכן המשך ההליך במתכונתו הנוכחית מנציח את החוב ופוגע בנושים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סמכות רשם ההוצאה לפועל בהליכי חדלות פירעון ליחידים',
    4, 'חייב עם חובות בסך 180,000 ש"ח מעוניין לפתוח בהליכי חדלות פירעון. לאיזו ערכאה עליו לפנות?', 'שאלה זו עוסקת בחלוקת הסמכויות בין רשם ההוצאה לפועל, הממונה על הליכי חדלות פירעון ובית משפט השלום, בהליכי חדלות פירעון ליחידים, בהתאם לסכום החוב. היא בוחנת את ידיעת הוראות חוק חדלות פירעון ושיקום כלכלי בנוגע לערכאה המוסמכת.', 'חוק חדלות פירעון ושיקום כלכלי, תשע"ח-2018, חולל רפורמה מקיפה בחלוקת הסמכויות בהליכי חדלות פירעון ליחידים. כפי שנקבע בסעיפים 103(א) ו-(ב) לחוק, ובפסיקה כגון רע"א 6455/19 סרגיי ירוחימוביץ נ'' כונס הנכסים הרשמי (2020), הסמכות נקבעת לפי גובה החוב: אם סך חובותיו של היחיד עולה על 150,000 ש"ח, הבקשה ל''צו פתיחת הליכים'' מוגשת ישירות לממונה על הליכי חדלות פירעון ושיקום כלכלי, וההליכים מתנהלים בפני הממונה ובית משפט השלום (סעיף 353 לחוק). אם סך חובותיו נמוך מ-150,000 ש"ח, הבקשה מוגשת לרשם ההוצאה לפועל (סעיפים 186-187 לחוק). במקרה הנדון, סך החובות הוא 180,000 ש"ח, ולכן יש לפנות לממונה ובית משפט השלום.',
    'הטעות הנפוצה היא לבלבל בין סמכויות הערכאות השונות בהליכי חדלות פירעון ליחידים, או לא לזכור את סף החוב הקובע את הערכאה המוסמכת.', '["חדלות פירעון ליחידים", "סמכות עניינית", "רשם ההוצאה לפועל", "הממונה על הליכי חדלות פירעון", "בית משפט השלום", "סף חובות"]'::jsonb, '**וריאציה 1 — חוב מעל 150,000 ש"ח?** ← פנייה לממונה ובית משפט השלום (סעיף 103(א) לחוק חדלות פירעון).
**וריאציה 2 — חוב עד 150,000 ש"ח?** ← פנייה לרשם ההוצאה לפועל (סעיפים 186-187 לחוק חדלות פירעון).
**וריאציה 3 — מהי תכלית הרפורמה?** ← להקל על חייבים לנהל הליך חדלות פירעון שיוביל לשיקומם הכלכלי (סעיף 1 לחוק חדלות פירעון).', 'חדלות פירעון ליחידים ← חוב > 150k ש"ח ← ממונה + שלום; חוב <= 150k ש"ח ← רשם הוצל"פ.',
    '["חוק חדלות פירעון ושיקום כלכלי, תשע\"ח-2018, סעיפים 1, 103, 104, 186, 187, 353", "רע\"א 6455/19 סרגיי ירוחימוביץ נ'' כונס הנכסים הרשמי (28.1.2020)", "חדל\"פ (שלום ראשון לציון) 64224-09-19 מנאר שייח יוסף נ'' ממונה על חדלות פירעון מחוז תל אביב (30.3.2020)", "עחדל\"פ (מחוזי תל אביב-יפו) 1823-10-25 עיזבון המנוח סטניסלב שולמן ז\"ל נ'' הממונה על הליכי חדלות פירעון ושיקום כלכלי (1.3.2026)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'לרשם ההוצאה לפועל, שכן הוא הגורם המטפל בהליכי חדלות פירעון ליחידים.', false, 'בחירה זו שגויה. רשם ההוצאה לפועל מטפל בהליכי חדלות פירעון ליחידים רק כאשר סך החובות אינו עולה על 150,000 ש"ח.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לממונה על הליכי חדלות פירעון ושיקום כלכלי, ולאחר מכן לבית משפט השלום.', true, 'בחירה זו נכונה. כאשר סך חובותיו של יחיד עולה על 150,000 ש"ח, הבקשה לצו פתיחת הליכים מוגשת לממונה, וההליכים מתנהלים בפני הממונה ובית משפט השלום.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'לבית המשפט המחוזי, שכן הוא הערכאה המוסמכת לדון בהליכי חדלות פירעון.', false, 'בחירה זו שגויה. בית המשפט המחוזי טיפל בהליכי פשיטת רגל לפי הפקודה הישנה. כיום, בהליכי חדלות פירעון ליחידים, הסמכות היא לבית משפט השלום (מעל 150,000 ש"ח) או לרשם ההוצאה לפועל (עד 150,000 ש"ח).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לרשם ההוצאה לפועל, ורק אם הוא יחליט להפנות את החייב לבית משפט השלום.', false, 'בחירה זו שגויה. במקרה של חוב העולה על 150,000 ש"ח, הפנייה הראשונית היא לממונה, ולא לרשם ההוצאה לפועל.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 11, '2022-S-Q11';
END
$$;

-- ============================================================
-- Q12 — 2022-S-Q12 — chapter=execution subtopic=file_opening
-- classifier_note: Opening execution file from money judgment with settlement plan; debtor's objection
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '59a17a79-5d58-487e-ba86-5249f7248048'::uuid;
  v_group_id uuid := 'bfdb4587-7855-4a77-ab08-6713fb9889f6'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'ef366dca-3c18-41fe-83cc-c12d153559da'::uuid;
  v_ang_1 uuid := 'dcf82a6b-b099-466d-a698-539fe52ce8ab'::uuid;
  v_ang_2 uuid := '18b392d5-6338-44e8-8058-24c5614764d9'::uuid;
  v_ang_3 uuid := '34643ea9-e358-456f-b87e-19fb8fcb184b'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q12';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 12, '2022-S-Q12';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'execution';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'execution';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'file_opening' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'file_opening', 'execution';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q12', v_chapter_id, v_subtopic_id, 'משה קיבל פסק דין נגד ראובן (החייב) ולפיו עליו לשלם סכום מסוים במסגרת הסדר תשלומים שנקבע. החייב לא שילם את הכספים, ומשה פתח תיק הוצאה לפועל והתחיל לנקוט הליכים. ראובן טוען שאין מקום לנקוט הליכים משום שלטענתו פסק הדין אינו ברור די הצורך בעניין המועדים והדרך שבה יש לממש את הסדר התשלומים. לטענת ראובן, יש לקבל הבהרה מאת בית המשפט שנתן את פסק הדין בטרם יחלו לנקוט הליכים. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 12}'::jsonb, 'שאלה זו עוסקת בסמכות רשם ההוצאה לפועל לפנות לבית המשפט בבקשת הבהרה של פסק דין, בהתאם לסעיף 12 לחוק ההוצאה לפועל, תשכ"ז-1967. היא מדגישה כי היוזמה לפנייה זו נתונה לרשם ההוצאה לפועל בלבד, וכי תפקיד בעל הדין הוא לשכנע את הרשם בצורך בהבהרה, ולא לפנות ישירות לבית המשפט.', 'סעיף 12 לחוק ההוצאה לפועל, תשכ"ז-1967, קובע כי ''היה רשם ההוצאה לפועל סבור שפסק הדין או חלק ממנו טעון הבהרה לשם ביצועו, רשאי הוא לפנות בכתב לבית המשפט שנתנו כדי לקבל הבהרה''. הפסיקה קבעה באופן עקבי כי הסמכות לפנות לבית המשפט בבקשת הבהרה לפי סעיף זה נתונה לרשם ההוצאה לפועל בלבד, ולא לצדדים עצמם (רע"א 2393/17 דפנה ארנון נ'' שלמה פיוטרקובסקי; בר"ע (מחוזי ירושלים) 697/03 חברת המאפיות הערביות בע"מ נ'' רקיהה בדר אלדר). אם בעל דין סבור שפסק הדין דורש הבהרה, עליו לפנות לרשם ההוצאה לפועל ולשכנעו בכך, ורק אם הרשם ישתכנע, הוא יפנה לבית המשפט (רע"א 7711/06 המכללה המשותפת בע"מ נ'' מנדל). הרשם מפעיל שיקול דעת אם אכן קיימת אי בהירות ממשית המונעת את ביצוע פסק הדין, ואין הוא מחויב לפנות להבהרה בכל מקרה (רשם ההוצאה לפועל נצרת) ‏10-99791-12-5‏/ הזוכה נ'' החייבת).', 'הטעות הנפוצה היא לחשוב שבעל דין יכול לפנות ישירות לבית המשפט בבקשת הבהרה, או שרשם ההוצאה לפועל מחויב לפנות להבהרה בכל פעם שבעל דין מבקש זאת, מבלי להבין את שיקול הדעת הנתון לרשם ואת עקרון ''גמר המלאכה'' של בית המשפט.',
    '["סעיף 12 לחוק ההוצאה לפועל", "בקשת הבהרה", "סמכות רשם ההוצאה לפועל", "שיקול דעת רשם", "פניית בעל דין", "אי בהירות בפסק דין"]'::jsonb, '**וריאציה 1 — מי מוסמך לפנות לבית המשפט בבקשת הבהרה לפי סעיף 12?** ← רשם ההוצאה לפועל בלבד (סעיף 12 לחוק ההוצאה לפועל).
**וריאציה 2 — מה תפקיד בעל הדין?** ← לשכנע את רשם ההוצאה לפועל בצורך בהבהרה (רע"א 2393/17).
**וריאציה 3 — האם הרשם חייב לפנות להבהרה?** ← לא, הוא רשאי, לפי שיקול דעתו, אם סבור שפסק הדין טעון הבהרה לשם ביצועו (סעיף 12 לחוק ההוצאה לפועל).', 'הבהרת פסק דין ← רק רשם הוצל"פ פונה לביהמ"ש (סעיף 12) ← בעל דין משכנע את הרשם.', '["פסק-דין הטעון הבהרה | חוק ההוצאה לפועל, תשכ\"ז-1967 סעיף 12", "(רשם ההוצאה לפועל נצרת) ‏10-99791-12-5‏/ הזוכה נ'' החייבת (7.2.2013)", "רע\"א 2393/17 דפנה ארנון נ'' שלמה פיוטרקובסקי (25.2.2018)", "בר\"ע (מחוזי ירושלים) 697/03 חברת המאפיות הערביות בע\"מ נ'' רקיהה בדר אלדר (25.11.2004)"]'::jsonb,
    'classification_review: original chapter=''הוצאה לפועל'' subtopic=''פתיחת תיקים'' → mapped chapter=''execution'' subtopic=''file_opening'' | classifier_note: Opening execution file from money judgment with settlement plan; debtor''s objection', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'החייב הנפגע רשאי לפנות מיוזמתו לבית המשפט שנתן את פסק הדין ולבקש את הבהרתו.', false, 'בחירה זו שגויה. הסמכות לפנות לבית המשפט בבקשת הבהרה לפי סעיף 12 לחוק ההוצאה לפועל נתונה לרשם ההוצאה לפועל בלבד, ולא לצדדים עצמם.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'החייב הנפגע רשאי לפנות מיוזמתו לרשם ההוצאה לפועל ולטעון לצורך בהבהרה. על רשם ההוצאה לפועל לעכב הליכים כדי לתת לחייב אפשרות לפנות לבית המשפט שנתן את פסק הדין ולבקש את הבהרתו.', false, 'בחירה זו שגויה. אף שהחייב רשאי לפנות לרשם ההוצאה לפועל, הרשם אינו מעכב הליכים כדי לאפשר לחייב לפנות לבית המשפט, שכן הסמכות לפנות לבית המשפט נתונה לרשם בלבד.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'החייב הנפגע רשאי לפנות מיוזמתו לרשם ההוצאה לפועל ולטעון לצורך בהבהרה. על רשם ההוצאה לפועל להעביר את השאלה לדיון בפני בית המשפט שנתן את פסק הדין.', false, 'בחירה זו שגויה. רשם ההוצאה לפועל אינו מחויב להעביר את השאלה לבית המשפט, אלא מפעיל שיקול דעת אם פסק הדין אכן טעון הבהרה לשם ביצועו.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'החייב הנפגע רשאי לפנות מיוזמתו לרשם ההוצאה לפועל ולטעון לצורך בהבהרה. לנוכח פנייתו של החייב על רשם ההוצאה להחליט אם יש מקום לפנות לבית המשפט שנתן את פסק הדין בשאלת הבהרה אם לאו.', true, 'בחירה זו נכונה. סעיף 12 לחוק ההוצאה לפועל קובע כי רשם ההוצאה לפועל רשאי לפנות לבית המשפט לקבלת הבהרה אם הוא סבור שפסק הדין טעון הבהרה לשם ביצועו. בעל דין המעוניין בהבהרה צריך לשכנע את הרשם בצורך בכך.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'הבהרת פסק בוררות שאושר',
    1, 'פסק בוררות שאושר על ידי בית המשפט המחוזי הוגש לביצוע בלשכת ההוצאה לפועל. החייב טוען כי פסק הבוררות אינו ברור דיו ודורש הבהרה. מה הדין לעניין סמכות רשם ההוצאה לפועל לפנות להבהרה?', 'שאלה זו בוחנת את תחולת סעיף 12 לחוק ההוצאה לפועל על פסקי בוררות שאושרו על ידי בית המשפט. היא מדגישה כי פסק בוררות שאושר דינו כפסק דין של בית משפט, ולכן ניתן להבהירו באמצעות המנגנון הקבוע בסעיף 12, תוך הבחנה בין הגורם אליו פונה רשם ההוצאה לפועל (בית המשפט) לבין הגורם שיכול לסייע בהבהרה (הבורר).', 'סעיף 23(א) לחוק הבוררות קובע כי ''אושר הפסק - דינו לכל דבר, פרט לערעור, כדין פסק-דין של בית המשפט''. מכאן, שפסק בוררות שאושר על ידי בית המשפט, דינו כפסק דין של בית משפט, ולכן סעיף 12 לחוק ההוצאה לפועל חל גם עליו. משמעות הדברים היא שאם רשם ההוצאה לפועל סבור כי פסק בוררות שאושר טעון הבהרה, עליו לפנות לבית המשפט שאישר את הפסק בבקשה להבהרה. בית המשפט מצדו רשאי, על פי שיקול דעתו, להבהיר את הפסק בעצמו או לפנות לבורר שנתן את פסק הבוררות לצורך קבלת עמדתו בטרם הכרעתו בעניין (רע"א 1672/22 יצחק אוסטרוביצקי נ'' מ.פ. עמית בניה ויזום בע"מ).',
    'הטעות הנפוצה היא להניח שפסק בוררות, גם אם אושר, אינו נחשב כפסק דין לצורך סעיף 12 לחוק ההוצאה לפועל, או לחשוב שרשם ההוצאה לפועל יכול לפנות ישירות לבורר להבהרה.', '["פסק בוררות מאושר", "סעיף 12 לחוק ההוצאה לפועל", "סעיף 23(א) לחוק הבוררות", "סמכות רשם ההוצאה לפועל", "הבהרת פסק דין", "תחולת חוק"]'::jsonb, '**וריאציה 1 — האם סעיף 12 חל על פסק בוררות מאושר?** ← כן, כי דינו כפסק דין של בית משפט (רע"א 1672/22).
**וריאציה 2 — למי פונה רשם ההוצאה לפועל להבהרה?** ← לבית המשפט שאישר את פסק הבוררות (רע"א 1672/22).
**וריאציה 3 — האם בית המשפט יכול לפנות לבורר?** ← כן, בית המשפט רשאי לפנות לבורר לקבלת עמדתו (רע"א 1672/22).', 'פסק בוררות מאושר ← דינו כפסק דין ← רשם הוצל"פ פונה לביהמ"ש להבהרה (סעיף 12).',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 12", "חוק הבוררות, תשכ\"ח-1968, סעיף 23(א)", "רע\"א 1672/22 יצחק אוסטרוביצקי נ'' מ.פ. עמית בניה ויזום בע\"מ (27.11.2022)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'רשם ההוצאה לפועל אינו מוסמך לפנות להבהרה בעניין פסק בוררות, שכן סעיף 12 לחוק ההוצאה לפועל חל רק על פסקי דין של בתי משפט.', false, 'בחירה זו שגויה. סעיף 23(א) לחוק הבוררות קובע כי פסק בוררות שאושר דינו כפסק דין של בית משפט, ולכן סעיף 12 לחוק ההוצאה לפועל חל גם עליו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'רשם ההוצאה לפועל מוסמך לפנות לבית המשפט שאישר את פסק הבוררות בבקשת הבהרה, ובית המשפט רשאי להבהיר את הפסק בעצמו או לפנות לבורר לקבלת עמדתו.', true, 'בחירה זו נכונה. סעיף 12 לחוק ההוצאה לפועל חל גם על פסק בוררות שאושר, והפנייה היא לבית המשפט שאישר אותו, אשר לו שיקול דעת אם להבהיר בעצמו או לפנות לבורר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'רשם ההוצאה לפועל מוסמך לפנות ישירות לבורר שנתן את הפסק בבקשת הבהרה.', false, 'בחירה זו שגויה. חוק ההוצאה לפועל אינו כולל מנגנון להבהרת פסק בורר על ידי הבורר עצמו, והסמכות לפנות להבהרה היא לבית המשפט שאישר את הפסק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'רק הצדדים רשאים לפנות לבורר בבקשת הבהרה, וזאת בטרם אישור פסק הבוררות.', false, 'בחירה זו שגויה. לאחר אישור פסק הבוררות, הסמכות לגביו עוברת לבית המשפט, ובעלי הדין אינם יכולים לפנות ישירות לבורר להבהרה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'גבולות סמכות רשם ההוצאה לפועל בפרשנות פסק דין',
    2, 'זוכה הגיש לביצוע פסק דין שקבע חיוב כספי, אך לא צוין בו במפורש האם הסכום הוא ''ברוטו'' או ''נטו''. רשם ההוצאה לפועל החליט כי מדובר בסכום ''נטו'' ובהתאם לכך הורה על חישוב החוב. האם רשם ההוצאה לפועל פעל בסמכות?', 'שאלה זו עוסקת בגבולות סמכותו של רשם ההוצאה לפועל בפרשנות פסקי דין. היא מדגישה את העיקרון לפיו תפקידו של הרשם הוא ביצועי בלבד, וכי אינו מוסמך להחסיר, להוסיף או לשנות את פסק הדין, אלא לבצעו ככתבו וכלשונו. במקרים של אי בהירות, עליו לפנות לבית המשפט להבהרה, אך לא לפרש בעצמו באופן מהותי.', 'הלכה פסוקה היא כי תפקידו של רשם ההוצאה לפועל הוא להוציא לפועל את האמור בפסקי דין, ואין הוא מוסמך להחסיר או להוסיף לפסק הדין, או לקרוא לתוכו את מה שלא נאמר בו (רע"א 773/97 טנקרידרי ארנקיל בע"מ נ'' חיפה כימיקלים בע"מ; רע"א 1557/06 עו"ד בן ציון שיפטן נ'' עו"ד דוד קירשנבום). כאשר פסק הדין שותק בעניין מסוים, כגון האם סכום הוא ''ברוטו'' או ''נטו'', אין לרשם סמכות לקבוע קביעות מהותיות אלו. הפסיקה קבעה כי ככלל ובהעדר ציון מפורש לפיו החיוב הוא בערכי ''נטו'', המשמעות היא כי הסכום שנפסק הוא סכום ''ברוטו'', ממנו יש לנכות ניכויי חובה כדין (רע"א (מחוזי חי'') 55752-04-25 עו"ד אברהם כצמן נ'' עו"ד מרק צל). סטייה מכלל זה משמעה הוספת חיוב על ידי רשם ההוצאה לפועל, שלא נקבע בפסק הדין, ובכך חריגה מסמכות.',
    'הטעות הנפוצה היא לייחס לרשם ההוצאה לפועל סמכויות פרשניות רחבות, בדומה לבית משפט, מבלי להבין את אופיו הביצועי המוגבל של תפקידו ואת האיסור על הוספה או גריעה מתוכן פסק הדין.', '["סמכות רשם ההוצאה לפועל", "פרשנות פסק דין", "חיוב ברוטו/נטו", "חריגה מסמכות", "אכיפת פסק דין", "הוספה לפסק דין"]'::jsonb, '**וריאציה 1 — רשם ההוצאה לפועל קבע שסכום הוא ''נטו'' כשלא צוין?** ← לא בסמכות, בהיעדר ציון מפורש, הסכום הוא ''ברוטו'' (רע"א (מחוזי חי'') 55752-04-25).
**וריאציה 2 — מה תפקיד רשם ההוצאה לפועל?** ← להוציא לפועל את האמור בפסק הדין ככתבו וכלשונו, לא להחסיר או להוסיף (רע"א 773/97).
**וריאציה 3 — מתי רשם ההוצאה לפועל יפנה להבהרה?** ← רק כאשר פסק הדין אינו ברור וטעון הבהרה לשם ביצועו (סעיף 12 לחוק ההוצאה לפועל).', 'סמכות רשם הוצל"פ ← ביצועית בלבד ← לא מוסיף/גורע ← ''ברוטו'' אלא אם צוין ''נטו''.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 12", "רע\"א 773/97 טנקרידרי ארנקיל בע\"מ נ'' חיפה כימיקלים בע\"מ, נ(5) 657 (30.3.1997)", "רע\"א 1557/06 עו\"ד בן ציון שיפטן נ'' עו\"ד דוד קירשנבום (12.7.2006)", "רע\"א (מחוזי חי'') 55752-04-25 עו\"ד אברהם כצמן נ'' עו\"ד מרק צל (6.7.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כן, לרשם ההוצאה לפועל סמכות לפרש את פסק הדין ככל הנדרש לשם ביצועו, וקביעה זו היא בגדר פרשנות סבירה.', false, 'בחירה זו שגויה. סמכותו של רשם ההוצאה לפועל מוגבלת לאכיפת פסק הדין ככתבו וכלשונו, ואינו מוסמך להוסיף או לגרוע ממנו, או לקבוע קביעות מהותיות שאינן עולות מפסק הדין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לא, רשם ההוצאה לפועל אינו מוסמך להחסיר או להוסיף לפסק הדין. משלא נכתב בפסק הדין כי הסכום הוא ''נטו'', אזי מדובר בחיוב ''ברוטו'', וסטייה מכך מהווה חריגה מסמכות.', true, 'בחירה זו נכונה. תפקידו של רשם ההוצאה לפועל הוא ביצועי בלבד. הוא אינו רשאי להוסיף או לגרוע מפסק הדין. בהיעדר ציון מפורש, סכום שנפסק הוא ''ברוטו'', וקביעה אחרת מהווה חריגה מסמכות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כן, אך רק אם הצדדים הסכימו ביניהם על פרשנות זו של ''נטו''.', false, 'בחירה זו שגויה. גם אם הצדדים הסכימו, על הרשם לפעול לפי פסק הדין כפי שניתן. הסכמה מאוחרת של הצדדים אינה משנה את סמכותו המוגבלת של הרשם לפרש את פסק הדין עצמו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לא, היה על רשם ההוצאה לפועל לפנות לבית המשפט בבקשת הבהרה לפי סעיף 12 לחוק ההוצאה לפועל.', false, 'בחירה זו שגויה. אף שפנייה להבהרה היא אפשרות במקרה של אי בהירות, במקרה של ''ברוטו'' מול ''נטו'' קיימת הלכה ברורה לפיה בהיעדר ציון מפורש, הסכום הוא ''ברוטו'', ולכן אין אי בהירות המצדיקה פנייה להבהרה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הבהרה מיוזמת בית המשפט או בעל דין',
    3, 'לאחר שבית המשפט נתן פסק דין, אחד הצדדים סבור כי פסק הדין אינו ברור ופונה ישירות לבית המשפט בבקשה להבהרה. מה הדין?', 'שאלה זו עוסקת בעקרון ''גמר המלאכה'' (Functus Officio) החל על בתי המשפט לאחר מתן פסק דין, ובמגבלות על פניית בעלי דין ישירות לבית המשפט בבקשת הבהרה. היא מדגישה כי הדרך העיקרית להבהרת פסק דין היא באמצעות פניית רשם ההוצאה לפועל לפי סעיף 12 לחוק ההוצאה לפועל, וכי פנייה ישירה של בעל דין אינה מקובלת, למעט חריגים מסוימים.', 'עקרון יסוד בשיטתנו המשפטית הוא שבית המשפט מסיים את מלאכתו ו''קם מכיסאו'' עם מתן פסק דין (עקרון ''גמר המלאכה'' - Functus Officio). משמעות הדבר היא שבית המשפט אינו מוסמך לשוב ולהידרש לפסק דינו, למעט תיקון טעות סופר (סעיף 81 לחוק בתי המשפט) או במקרה של פניית רשם ההוצאה לפועל לפי סעיף 12 לחוק ההוצאה לפועל (בג"ץ 897/78 אליהו יגאל נ'' בית הדין הארצי לעבודה; רע"א 2393/17 דפנה ארנון נ'' שלמה פיוטרקובסקי). הליך של בקשת הבהרה המוגשת ישירות על ידי בעל דין לבית המשפט אינו קיים בסדרי הדין (בר"ע (מחוזי ירושלים) 802/05 פלוני נ'' פלונית). עם זאת, במקרים בהם פסק הדין אינו ניתן לביצוע בהוצאה לפועל (כגון פסק דין הצהרתי או נגד המדינה), הפסיקה הכירה באפשרות של בעל דין להגיש תובענה לסעד הצהרתי לבית המשפט שנתן את פסק הדין, כדי שיבהיר אותו (עת"מ (מינהליים ת"א) 60876-03-11 ראש עיריית הרצליה הגב'' יעל גרמן נ'' זפרני ואח'').',
    'הטעות הנפוצה היא לחשוב שבעל דין יכול לפנות ישירות לבית המשפט בבקשת הבהרה, בדומה לבקשה לתיקון טעות סופר, מבלי להבין את ההבחנה בין סמכויות בית המשפט לאחר מתן פסק דין ואת הדרך הייחודית הקבועה בסעיף 12 לחוק ההוצאה לפועל.', '["גמר המלאכה (Functus Officio)", "סעיף 12 לחוק ההוצאה לפועל", "סעיף 81 לחוק בתי המשפט", "בקשת הבהרה", "סעד הצהרתי", "סמכות בית המשפט"]'::jsonb, '**וריאציה 1 — האם בעל דין יכול לפנות ישירות לבית המשפט בבקשת הבהרה?** ← לא, הדרך היחידה היא דרך רשם ההוצאה לפועל לפי סעיף 12 (רע"א 2393/17).

**וריאציה 2 — מהו עקרון ''גמר המלאכה''?** ← בית המשפט מסיים את מלאכתו עם מתן פסק הדין ואינו יכול לשוב ולהידרש אליו, למעט חריגים (בג"ץ 897/78).
**וריאציה 3 — מתי ניתן להגיש תובענה לסעד הצהרתי להבהרה?** ← במקרים בהם פסק הדין אינו ניתן לביצוע בהוצאה לפועל (עת"מ 60876-03-11).', 'בעל דין ← לא פונה ישירות לביהמ"ש להבהרה ← רק רשם הוצל"פ לפי סעיף 12 ← חריג: סעד הצהרתי.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 12", "חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 81", "בג\"ץ 897/78 אליהו יגאל נ'' בית הדין הארצי לעבודה, פ\"ד לג(2) 6 (1.3.1979)", "בר\"ע (מחוזי ירושלים) 802/05 פלוני נ'' פלונית (29.11.2005)", "רע\"א 2393/17 דפנה ארנון נ'' שלמה פיוטרקובסקי (25.2.2018)", "עת\"מ (מינהליים ת\"א) 60876-03-11 ראש עיריית הרצליה הגב'' יעל גרמן נ'' זפרני ואח'' (6.3.2016)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט מוסמך להבהיר את פסק דינו מיוזמתו, גם ללא פניית רשם ההוצאה לפועל, אם הוא סבור שיש בכך צורך.', false, 'בחירה זו שגויה. ככלל, בית המשפט מסיים את מלאכתו עם מתן פסק הדין (עקרון ''גמר המלאכה'') ואינו מוסמך להבהירו מיוזמתו, למעט תיקון טעות סופר או פניית רשם ההוצאה לפועל.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בקשה להבהרת פסק דין המוגשת ישירות על ידי בעל דין אינה קיימת בסדרי הדין, למעט במקרים חריגים בהם פסק הדין אינו ניתן לביצוע בהוצאה לפועל ואז ניתן להגיש תובענה לסעד הצהרתי.', true, 'בחירה זו נכונה. הליך של בקשת הבהרה ישירה מבעל דין לבית המשפט אינו קיים, שכן הסמכות לפנות להבהרה לפי סעיף 12 נתונה לרשם ההוצאה לפועל. במקרים חריגים, ניתן להגיש תובענה לסעד הצהרתי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט רשאי להבהיר את פסק דינו לבקשת בעל דין, ובלבד שהבקשה הוגשה תוך 30 יום ממועד מתן פסק הדין.', false, 'בחירה זו שגויה. אין הוראה כזו בסדרי הדין המאפשרת לבעל דין לפנות ישירות לבית המשפט בבקשת הבהרה תוך 30 יום. עקרון ''גמר המלאכה'' מונע זאת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט יפנה את בעל הדין לרשם ההוצאה לפועל, שכן רק לרשם סמכות להבהיר את פסק הדין.', false, 'בחירה זו שגויה. לרשם ההוצאה לפועל אין סמכות להבהיר את פסק הדין, אלא רק לפנות לבית המשפט בבקשת הבהרה. בית המשפט הוא הגורם המבהיר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'פסק דין שאינו בר ביצוע בהוצאה לפועל',
    4, 'זוכה הגיש לביצוע פסק דין שקבע כי החייב ''יפצה את הזוכה על נזקיו''. רשם ההוצאה לפועל נדרש לקבוע את גובה הפיצוי. מה הדין?', 'שאלה זו עוסקת במקרים בהם פסק דין אינו בר ביצוע בלשכת ההוצאה לפועל, בשל היעדר סעד אופרטיבי ברור או צורך בהכרעות עובדתיות/משפטיות נוספות. היא מדגישה את אופיו הביצועי של רשם ההוצאה לפועל ואת מגבלות סמכותו, ואת הצורך של הזוכה לפנות לערכאה השיפוטית המוסמכת לקבלת סעד מתאים.', 'תפקידו של רשם ההוצאה לפועל הוא ביצועי, והוא מוגבל לאכיפת פסק דין ככתבו וכלשונו. כאשר פסק דין אינו כולל סעד אופרטיבי ברור, או שביצועו כרוך בהכרעות עובדתיות או משפטיות נוספות (כגון קביעת גובה פיצוי), הוא אינו ניתן לביצוע בהליכי הוצאה לפועל. במצב כזה, רשם ההוצאה לפועל יפקיע מידי עצמו את ההכרעה ויפנה את הצדדים לבית המשפט המוסמך (עש"א (שלום ראשל"צ) 64793-11-18 עודד סקיזדה נ'' נפתלי גון; רשם ההוצאה לפועל תל אביב-יפו) 512785-08-24 חייב 1 1 נ''). הזוכה, במקרה כזה, יצטרך לפנות לבית המשפט המוסמך (למשל, באמצעות תביעה מתאימה או סעד הצהרתי) על מנת שיקבע את הסעד האופרטיבי החסר (רע"א (מחוזי חי'') 18438-12-18 מוסדות אור שמח מרכז טננבאום נ'' סנונית ישראלי). סעיף 12 לחוק ההוצאה לפועל נועד להבהיר פסק דין קיים, ולא להשלים חסר מהותי בו.',
    'הטעות הנפוצה היא לחשוב שרשם ההוצאה לפועל מוסמך להשלים חסרים מהותיים בפסק דין, או לבלבל בין הבהרה (סעיף 12) לבין השלמה של פסק דין, שהיא מחוץ לסמכותו.', '["פסק דין לא אכיף", "סעד אופרטיבי", "סמכות רשם ההוצאה לפועל", "השלמת פסק דין", "הכרעות עובדתיות/משפטיות", "פנייה לבית המשפט המוסמך"]'::jsonb, '**וריאציה 1 — פסק דין קובע ''פיצוי על נזקים'' ללא סכום?** ← אינו בר ביצוע בהוצאה לפועל, על הזוכה לפנות לבית המשפט המוסמך (עש"א 64793-11-18 סקיזדה).
**וריאציה 2 — מה תפקיד רשם ההוצאה לפועל במקרה כזה?** ← להפקיע מידי עצמו את ההכרעה ולהפנות את הצדדים לבית המשפט (רשם ההוצאה לפועל תל אביב-יפו) 512785-08-24).
**וריאציה 3 — האם סעיף 12 רלוונטי?** ← לא, סעיף 12 נועד להבהרה, לא להשלמת חסר מהותי (רע"א 1672/22).', 'פסק דין חסר סעד אופרטיבי ← לא בר ביצוע בהוצל"פ ← זוכה פונה לביהמ"ש המוסמך.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 12", "רע\"א 1672/22 יצחק אוסטרוביצקי נ'' מ.פ. עמית בניה ויזום בע\"מ (27.11.2022)", "עש\"א (שלום ראשל\"צ) 64793-11-18 עודד סקיזדה נ'' נפתלי גון (18.11.2019)", "רע\"א (מחוזי חי'') 18438-12-18 מוסדות אור שמח מרכז טננבאום נ'' סנונית ישראלי (17.3.2019)", "(רשם ההוצאה לפועל תל אביב-יפו) 512785-08-24 חייב 1 1 נ'' (21.4.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'רשם ההוצאה לפועל יקבע את גובה הפיצוי על בסיס ראיות שיגישו הצדדים, שכן זוהי סמכותו לפרש את פסק הדין.', false, 'בחירה זו שגויה. סמכותו של רשם ההוצאה לפועל אינה כוללת הכרעה במחלוקות עובדתיות או משפטיות מורכבות, כגון קביעת גובה נזק, המצריכות דיון הוכחות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'פסק הדין אינו בר ביצוע בהוצאה לפועל, ועל הזוכה לפנות לבית המשפט המוסמך לקבלת סעד אופרטיבי שיקבע את גובה הפיצוי.', true, 'בחירה זו נכונה. כאשר פסק דין אינו כולל סעד אופרטיבי ברור ודורש הכרעות עובדתיות או משפטיות נוספות, הוא אינו ניתן לביצוע בהוצאה לפועל, ועל הזוכה לפנות לבית המשפט המוסמך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'רשם ההוצאה לפועל יפנה לבית המשפט שנתן את פסק הדין בבקשת הבהרה לפי סעיף 12 לחוק ההוצאה לפועל.', false, 'בחירה זו שגויה. סעיף 12 נועד להבהיר פסק דין קיים, לא להשלים חסר מהותי או לקבוע סעד אופרטיבי שלא נקבע. קביעת גובה פיצוי היא השלמה, לא הבהרה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'הזוכה רשאי להגיש תביעה חדשה לבית המשפט המוסמך לאכיפת פסק הדין, ובית המשפט יקבע את גובה הפיצוי.', false, 'בחירה זו שגויה חלקית. הגשת תביעה חדשה היא אכן הדרך, אך לא ''לאכיפת פסק הדין'' אלא לקבלת סעד אופרטיבי חסר. פסק הדין עצמו אינו אכיף במתכונתו הנוכחית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 12, '2022-S-Q12';
END
$$;

-- ============================================================
-- Q13 — 2022-S-Q13 — chapter=execution subtopic=imprisonment_alimony
-- classifier_note: Interim alimony order; immediate service — alimony enforcement
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '97b2ce16-ef4c-41a9-ae40-e0700bb27f91'::uuid;
  v_group_id uuid := '33bdee3a-2f81-46d4-a2cc-40b931d55bda'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '17e3e60b-2a0c-48e2-8b76-3475b8b6336d'::uuid;
  v_ang_1 uuid := 'ae2129a6-ff90-48f7-aa50-d20a27831ae7'::uuid;
  v_ang_2 uuid := 'd8e0a935-ebea-4a62-8290-65f0a9d7b3cb'::uuid;
  v_ang_3 uuid := '3c8cf5fc-08bc-4c9b-8463-b79e6dfe1998'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q13';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 13, '2022-S-Q13';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'execution';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'execution';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'imprisonment_alimony' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'imprisonment_alimony', 'execution';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q13', v_chapter_id, v_subtopic_id, 'לאה הגישה בקשה למזונות זמניים במסגרת תביעת מזונות בעניין הילדים המשותפים לה ולרפי, בן זוגה, המתנהלת בבית המשפט לענייני משפחה באשדוד. הבקשה הומצאה לרפי בו ביום. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 13}'::jsonb, 'שאלה זו עוסקת בסדרי הדין להגשת תשובה לבקשה למזונות זמניים בבית המשפט לענייני משפחה. היא בוחנת את ידיעת תקנה 33 לתקנות בית המשפט לענייני משפחה (סדרי דין), תשפ"א-2020, הקובעת את המועדים והתנאים להגשת תשובה כזו.', 'תקנה 33(ג) לתקנות בית המשפט לענייני משפמה (סדרי דין), תשפ"א-2020, קובעת במפורש כי ''החליט בית המשפט שהבקשה מצריכה תשובה, המשיב רשאי להשיב לה בתוך ארבעה עשר ימים מיום שהומצאה לו, או בתוך מועד אחר שהורה עליו בית המשפט''. כלומר, הגשת התשובה אינה אוטומטית עם המצאת הבקשה, אלא מותנית בהחלטת בית המשפט כי הבקשה מצריכה תשובה. רק לאחר החלטה כזו, נפתח ''חלון'' של 14 ימים (או מועד אחר שנקבע) להגשת התשובה. תקנה 33(ה) מוסיפה כי ''החלטת בית המשפט בבקשה תינתן מוקדם ככל האפשר'', מה שמדגיש את אופיו הדחוף של סעד המזונות הזמניים.', 'הטעות הנפוצה היא לחשוב שהגשת תשובה לבקשה למזונות זמניים היא אוטומטית וקבועה בזמן (למשל, 10 או 15 ימים), מבלי להבין שהיא מותנית בהחלטת בית המשפט וכי המועד הוא 14 ימים.',
    '["מזונות זמניים", "תקנות בית המשפט לענייני משפחה", "סדרי דין", "מועדים", "הגשת תשובה", "החלטת בית המשפט"]'::jsonb, '**וריאציה 1 — מתי מגישים תשובה לבקשה למזונות זמניים?** ← רק אם בית המשפט החליט שהבקשה מצריכה תשובה (תקנה 33(ג) לתקנות בית המשפט לענייני משפחה).
**וריאציה 2 — מהו המועד להגשת תשובה?** ← 14 ימים מיום ההמצאה, או מועד אחר שקבע בית המשפט (תקנה 33(ג)).
**וריאציה 3 — מה קורה אם לא הוגשה תביעה עיקרית?** ← בית המשפט רשאי לדון בבקשה למזונות זמניים גם אם התביעה העיקרית הוגשה ע"י הצד השני, בפרשנות תכליתית (תלה"מ (י-ם) 62379-12-24).', 'בקשה למזונות זמניים ← תשובה תוך 14 יום ← רק אם ביהמ"ש הורה ← תקנה 33(ג).', '["תקנות בית המשפט לענייני משפחה (סדרי דין), תשפ\"א-2020, תקנה 33", "תלה\"מ (משפחה ירושלים) 62379-12-24 ס. ל נ'' ד. ח. ל (9.6.2025)", "תלה\"מ (משפחה אשדוד) 6180-08-24 א.ל נ'' א.נ.ל (26.9.2024)"]'::jsonb,
    'classification_review: original chapter=''הוצאה לפועל'' subtopic=''מזונות'' → mapped chapter=''execution'' subtopic=''imprisonment_alimony'' | classifier_note: Interim alimony order; immediate service — alimony enforcement', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על רפי להגיש את תשובתו לבקשה בתוך 15 ימים.', false, 'בחירה זו שגויה. המועד להגשת תשובה הוא 14 ימים, ולא 15, וזאת רק אם בית המשפט החליט שהבקשה מצריכה תשובה, כפי שמפורט בתקנה 33(ג) לתקנות בית המשפט לענייני משפחה (סדרי דין).', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'רק אם החליט בית המשפט שהבקשה מצריכה תשובה, יהיה רפי רשאי להגיב לה בתוך 14 ימים או בתוך מועד אחר שקבע בית המשפט.', true, 'בחירה זו נכונה. תקנה 33(ג) לתקנות בית המשפט לענייני משפחה (סדרי דין), תשפ"א-2020, קובעת כי הגשת תשובה מותנית בהחלטת בית המשפט, והמועד להגשתה הוא 14 ימים או מועד אחר שנקבע.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על רפי להגיש את תשובתו לבקשה בתוך 10 ימים.', false, 'בחירה זו שגויה. המועד להגשת תשובה הוא 14 ימים, ולא 10, וזאת רק אם בית המשפט החליט שהבקשה מצריכה תשובה, כפי שמפורט בתקנה 33(ג) לתקנות בית המשפט לענייני משפחה (סדרי דין).', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'רק אם החליט בית המשפט שהבקשה מצריכה תשובה, יהיה רפי רשאי להגיב לה בתוך 30 ימים או בתוך מועד אחר שקבע בית המשפט.', false, 'בחירה זו שגויה. המועד להגשת תשובה הוא 14 ימים, ולא 30, וזאת רק אם בית המשפט החליט שהבקשה מצריכה תשובה, כפי שמפורט בתקנה 33(ג) לתקנות בית המשפט לענייני משפחה (סדרי דין).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'דחיית בקשה למזונות זמניים עקב שיהוי',
    1, 'אם הגישה בקשה למזונות זמניים עבור בתה בת ה-16, לאחר שחלפו שלוש שנים מאז הפירוד מהאב, ובמהלכן לא נתבעו מזונות. האם בית המשפט ייעתר לבקשה?', 'שאלה זו בוחנת את השפעת השיהוי בהגשת בקשה למזונות זמניים על סיכויי קבלתה. היא מדגישה את אופיים של מזונות זמניים כ''עזרה ראשונה'' לשמירת המצב הקיים, ואת הנטל המוגבר המוטל על מבקש הסעד כאשר הבקשה מוגשת לאחר זמן רב.', 'מזונות זמניים נועדו לשמור על המצב הקיים כפי שהיה ערב הפירוד, ומהווים ''עזרה ראשונה'' עד לבירור התביעה העיקרית (בע"מ 74545-12-24 פלונית נ'' פלוני; ע"א 342/83 גלוזמן נ'' גלוזמן). כאשר הבקשה מוגשת לאחר שיהוי ניכר, מתעמעם יסוד הצורך המיידי, והבקשה נצבעת בצבעו של המישור השני – היחסים הכלכליים בין ההורים. במצב כזה, מזונות זמניים לא ייפסקו כדבר שבשגרה, והנטל על המבקש להראות צורך ממשי במישור צורכי הקטין (תלה"מ (נצרת) 65475-07-25 פלונית נ'' אלמוני, פס'' 13). בית המשפט ידחה בקשה שהוגשה בשיהוי קיצוני, במיוחד אם המבקש לא הוכיח צורך חיוני ודחוף (תלה"מ (נצרת) 65475-07-25 פלונית נ'' אלמוני, פס'' 17).',
    'הטעות הנפוצה היא לחשוב שזכות למזונות קטינים היא אבסולוטית ואינה מושפעת משיהוי, מבלי להבחין בין מזונות קבועים למזונות זמניים, ובין צרכים בסיסיים לצרכים שניתן להמתין לגביהם.', '["מזונות זמניים", "שיהוי", "שמירת מצב קיים", "עזרה ראשונה", "נטל הוכחה", "צורכי קטין"]'::jsonb, '**וריאציה 1 — בקשה למזונות זמניים הוגשה לאחר שנים?** ← תידחה, אלא אם הוכח צורך חיוני ודחוף (תלה"מ (נצרת) 65475-07-25).
**וריאציה 2 — מה תכלית מזונות זמניים?** ← שמירת המצב הקיים כ''עזרה ראשונה'' (בע"מ 74545-12-24).
**וריאציה 3 — מה קורה כשהזמן חולף?** ← מתעמעם יסוד הצורך המיידי, והנטל על המבקש להוכיח צורך ממשי (תלה"מ (נצרת) 65475-07-25, פס'' 13).', 'מזונות זמניים ← שיהוי ניכר ← דחייה (אלא אם צורך חיוני).',
    '["תלה\"מ (משפחה נצרת) 65475-07-25 פלונית נ'' אלמוני (23.10.2025)", "בע\"מ 74545-12-24 פלונית נ'' פלוני (2.1.2025)", "ע\"א 342/83 גלוזמן נ'' גלוזמן, פ\"ד לח(4) 105 (1.11.1984)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, זכותה של קטינה למזונות היא אבסולוטית ואינה מושפעת משיהוי בהגשת הבקשה.', false, 'בחירה זו שגויה. אף שזכות הקטינה למזונות חשובה, מזונות זמניים נועדו לשמור על המצב הקיים, ושיהוי ניכר בהגשת הבקשה מחליש את יסוד הדחיפות והצורך המיידי, כפי שנקבע בפסיקה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, בית המשפט ידחה את הבקשה, שכן מזונות זמניים נועדו לשמור על המצב הקיים, ושיהוי ניכר בהגשת הבקשה מחליש את יסוד הצורך המיידי, אלא אם הוכח צורך חיוני ודחוף.', true, 'בחירה זו נכונה. הפסיקה קובעת כי שיהוי ניכר בהגשת בקשה למזונות זמניים, במיוחד כאשר התקבע מצב חדש, מחליש את יסוד הדחיפות, ועל המבקש להוכיח צורך חיוני ודחוף כדי שהבקשה תתקבל.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך בית המשפט יפחית את סכום המזונות הזמניים בשל השיהוי.', false, 'בחירה זו שגויה. במקרה של שיהוי ניכר, בית המשפט נוטה לדחות את הבקשה למזונות זמניים כליל, ולא רק להפחית את סכומם, אלא אם הוכח צורך חיוני ודחוף.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, אלא אם כן האב יוכיח כי השיהוי נבע מחוסר תום לב של האם.', false, 'בחירה זו שגויה. אף שחוסר תום לב הוא שיקול, שיהוי ניכר כשלעצמו, ללא קשר לחוסר תום לב, יכול להוביל לדחיית בקשה למזונות זמניים, שכן הוא סותר את תכליתם כסעד דחוף לשמירת מצב קיים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאים לפסיקת מזונות זמניים בהיעדר תביעה עיקרית',
    2, 'האם הגישה בקשה למזונות זמניים עבור ילדיה, אך תביעת המזונות העיקרית הוגשה על ידי האב. האב טוען כי האם אינה רשאית להגיש בקשה למזונות זמניים, שכן היא לא הגישה תביעה עיקרית למזונות. מה הדין?', 'שאלה זו בוחנת את פרשנות תקנה 33(א) לתקנות בית המשפט לענייני משפחה (סדרי דין), תשפ"א-2020, לעניין הדרישה להגשת תביעה עיקרית כתנאי להגשת בקשה למזונות זמניים. היא מדגישה את הגישה התכליתית של הפסיקה, המאפשרת דיון בבקשה גם אם התביעה העיקרית הוגשה על ידי הצד השני, מטעמי יעילות והגינות דיונית.', 'תקנה 33(א) לתקנות בית המשפט לענייני משפחה (סדרי דין), תשפ"א-2020, קובעת כי ''בעל דין שהגיש תביעה למזונות ומבקש שיפסקו לו מזונות זמניים יגיש בקשה לפסיקת מזונות זמניים''. אף שלשון התקנה יכולה להשתמע כדרישה להגשת תביעה עיקרית על ידי המבקש, הפסיקה קבעה כי יש לפרש אותה באופן תכליתי. אין הצדקה לדרוש מהורה שלא הגיש תביעה למזונות להגיש תביעה כזו רק כדי ''לסלול את הדרך'' לבקשה למזונות זמניים. דרישה זו אינה עולה בקנה אחד עם ''עקרונות היסוד'' שנקבעו בתקנות משפחה (תקנה 2(א)) ועם תקנה 2 לתקנות סדר הדין האזרחי, תשע"ט-2018, הדוגלת בהליך שיפוטי ראוי והוגן, שוויוני, מידתי ויעיל. בנוסף, אין הצדקה לדון בשתי תביעות מזונות נפרדות לאותם צדדים וקטינים (תלה"מ (י-ם) 62379-12-24 ס. ל נ'' ד. ח. ל, פס'' 50-54).',
    'הטעות הנפוצה היא להיצמד לפרשנות מילולית של תקנה 33(א) מבלי להבין את הפרשנות התכליתית שניתנה לה בפסיקה, המבקשת לייעל את ההליך ולמנוע כפל התדיינויות.', '["מזונות זמניים", "תקנה 33(א) לתקנות בית המשפט לענייני משפחה", "פרשנות תכליתית", "עקרונות יסוד", "הליך שיפוטי ראוי והוגן", "יעילות דיונית"]'::jsonb, '**וריאציה 1 — האם חייבים להגיש תביעה עיקרית כדי לבקש מזונות זמניים?** ← לא, אם ההורה השני כבר הגיש תביעה עיקרית, ניתן לפרש את תקנה 33(א) באופן תכליתי (תלה"מ (י-ם) 62379-12-24).
**וריאציה 2 — מה מטרת הפרשנות התכליתית?** ← למנוע עומס מיותר על בית המשפט ולהבטיח הליך יעיל והוגן (תלה"מ (י-ם) 62379-12-24, פס'' 50).
**וריאציה 3 — האם ספקות בסמכות עניינית מונעים סעד זמני?** ← לא, אין בספקות לגבי הסמכות העניינית כדי לשלול את סמכותו של בית המשפט ליתן סעד זמני (רע"א 848/06 קולגר נ'' קוגלר).', 'בקשה למזונות זמניים ← גם אם תביעה עיקרית הוגשה ע"י הצד השני ← פרשנות תכליתית לתקנה 33(א).',
    '["תקנות בית המשפט לענייני משפחה (סדרי דין), תשפ\"א-2020, תקנה 33(א)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 2", "תלה\"מ (משפחה ירושלים) 62379-12-24 ס. ל נ'' ד. ח. ל (9.6.2025)", "רע\"א 848/06 קולגר נ'' קוגלר (6.6.2006)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'האב צודק, תקנה 33(א) לתקנות בית המשפט לענייני משפחה (סדרי דין) מחייבת הגשת תביעה עיקרית כתנאי להגשת בקשה למזונות זמניים.', false, 'בחירה זו שגויה. אף שלשון תקנה 33(א) יכולה להשתמע כך, הפסיקה קבעה פרשנות תכליתית המאפשרת דיון בבקשה למזונות זמניים גם אם התביעה העיקרית הוגשה על ידי הצד השני.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'בית המשפט ידון בבקשה למזונות זמניים, שכן יש לפרש את תקנה 33(א) באופן תכליתי, המאפשר דיון בבקשה גם אם התביעה העיקרית הוגשה על ידי ההורה השני, כדי למנוע עומס מיותר על בית המשפט וכדי להבטיח הליך שיפוטי ראוי והוגן.', true, 'בחירה זו נכונה. הפסיקה קבעה כי יש לפרש את תקנה 33(א) באופן תכליתי, המאפשר דיון בבקשה למזונות זמניים גם אם התביעה העיקרית הוגשה על ידי ההורה השני, בהתאם לעקרונות היסוד של תקנות משפחה ותקנה 2 לתקנות סדר הדין האזרחי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'בית המשפט ידון בבקשה רק אם האב יסכים לכך, שכן מדובר בוויתור על זכות דיונית.', false, 'בחירה זו שגויה. דיון בבקשה אינו מותנה בהסכמת האב, אלא נובע מפרשנות תכליתית של תקנות סדרי הדין, המבקשת לייעל את ההליך ולמנוע כפל התדיינויות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'בית המשפט ידחה את הבקשה, אך יאפשר לאם להגיש תביעה עיקרית למזונות ולאחר מכן להגיש בקשה חדשה למזונות זמניים.', false, 'בחירה זו שגויה. דרישה כזו תטיל עומס מיותר על בית המשפט ועל הצדדים, ואינה עולה בקנה אחד עם עקרונות היסוד של תקנות משפחה ותקנה 2 לתקנות סדר הדין האזרחי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'פסיקת מזונות זמניים בהיעדר תשתית ראייתית מספקת',
    3, 'הוגשה בקשה למזונות זמניים, אך הצדדים לא הניחו תשתית ראייתית מלאה לגבי הכנסותיהם וצרכי הקטינים. האם בית המשפט ידחה את הבקשה בשל כך?', 'שאלה זו עוסקת בשיקול הדעת של בית המשפט לענייני משפחה בפסיקת מזונות זמניים, במיוחד כאשר הצדדים לא הניחו תשתית ראייתית מלאה. היא מדגישה את אופיים של מזונות זמניים כ''סיוע ראשוני'' ואת האפשרות לפסוק אותם על בסיס אומדנה וניסיון חיים, גם בהיעדר ראיות מקיפות.', 'הלכה פסוקה היא כי בשלב בו קובע בית המשפט לענייני משפחה את המזונות הזמניים, אין בידיו להיכנס לעובי הקורה, לערוך בירור מקיף ולהכריע במחלוקות עובדתיות. ההכרעה חייבת להיות מהירה, עניינית ומטבעה נשענת על תמונה חלקית (רמ"ש 27548-05-21 ש. נ'' ש.; ע"א 342/83 גלוזמן נ'' גלוזמן). גם כאשר הצדדים לא הניחו תשתית ראייתית מספקת, מהות תפקידו של השופט היא להכריע, וזאת גם כאשר לא מונחת לפניו תשתית ראייתית מלאה. הדבר נכון ביתר שאת במזונות זמניים, שמטרתם להעניק ''סיוע ראשוני'' לזכאי (תלה"מ (י-ם) 60838-04-25 ת. ו נ'' א. ו, פס'' 36-37). בית המשפט רשאי להסתייע באומדנה, בהתבסס על ניסיון חייו של השופט ועל חזקות שנקבעו בפסיקה (תלה"מ (אשדוד) 59238-09-25 פלונית נ'' אלמוני, פס'' 16).',
    'הטעות הנפוצה היא לחשוב שבית המשפט מחויב לדחות בקשה למזונות זמניים בהיעדר תשתית ראייתית מלאה, מבלי להבין את אופיים המיוחד של מזונות זמניים ואת שיקול הדעת הרחב הנתון לבית המשפט לפסוק על דרך אומדנה.', '["מזונות זמניים", "תשתית ראייתית", "אומדנה", "שיקול דעת שיפוטי", "סיוע ראשוני", "תמונה עובדתית חלקית"]'::jsonb, '**וריאציה 1 — אין תשתית ראייתית מלאה למזונות זמניים?** ← בית המשפט רשאי לפסוק על דרך אומדנה וניסיון חיים (תלה"מ (י-ם) 60838-04-25, פס'' 36-37).
**וריאציה 2 — מה מטרת פסיקה על בסיס תמונה חלקית?** ← להעניק ''סיוע ראשוני'' לזכאי למזונות (תלה"מ (י-ם) 60838-04-25, פס'' 37).
**וריאציה 3 — האם בית המשפט נכנס לעובי הקורה?** ← לא, בשלב מזונות זמניים בית המשפט אינו עורך בירור מקיף (רמ"ש 27548-05-21).', 'מזונות זמניים ← תשתית ראייתית חלקית ← פסיקה באומדנה ← סיוע ראשוני.',
    '["תלה\"מ (משפחה ירושלים) 60838-04-25 ת. ו נ'' א. ו (5.6.2025)", "תלה\"מ (משפחה אשדוד) 59238-09-25 פלונית נ'' אלמוני (1.11.2025)", "רמ\"ש 27548-05-21 ש. נ'' ש. (23.6.2021)", "ע\"א 342/83 גלוזמן נ'' גלוזמן, פ\"ד לח(4) 105 (1.11.1984)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, בית המשפט ידחה את הבקשה, שכן חובה על הצדדים להניח תשתית ראייתית מלאה ומפורטת לצורך פסיקת מזונות זמניים.', false, 'בחירה זו שגויה. אף שרצוי להניח תשתית ראייתית מלאה, הפסיקה מכירה בכך שבשלב המקדמי של מזונות זמניים, בית המשפט נשען על תמונה חלקית ורשאי לפסוק על דרך אומדנה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, בית המשפט רשאי לפסוק מזונות זמניים על בסיס הנתונים החלקיים שהוצגו, תוך שימוש באומדנה וניסיון חיים, שכן מטרתם היא להעניק ''סיוע ראשוני'' לזכאי.', true, 'בחירה זו נכונה. הפסיקה קובעת כי בשלב המקדמי של מזונות זמניים, בית המשפט אינו נכנס לעובי הקורה ורשאי לפסוק על בסיס תמונה חלקית, אומדנה וניסיון חיים, כדי להעניק סיוע ראשוני.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט ידחה את הבקשה, אך יורה לצדדים להשלים את התשתית הראייתית בטרם יחזור וידון בה.', false, 'בחירה זו שגויה. דחיית הבקשה והוראה להשלמת ראיות עלולה לעכב את מתן הסעד הדחוף, ואינה עולה בקנה אחד עם אופיים של מזונות זמניים כ''עזרה ראשונה''.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט יפסוק מזונות זמניים רק אם יוכח כי אי-הגשת התשתית הראייתית נבעה מחוסר תום לב של הצד השני.', false, 'בחירה זו שגויה. פסיקת מזונות זמניים אינה מותנית בהוכחת חוסר תום לב של הצד השני, אלא בצורך של הקטין ובשיקול דעת בית המשפט על בסיס הנתונים הקיימים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'השפעת קצבת נכות על מזונות זמניים',
    4, 'אב המשלם מזונות זמניים לקטין, מקבל קצבת נכות ממשרד הביטחון בסך 14,000 ש"ח לחודש. הוא טוען כי קצבה זו אינה בגדר ''הכנסה'' לצורך חישוב מזונות זמניים. מה הדין?', 'שאלה זו עוסקת בהתחשבות בקצבאות נכות, ובפרט קצבה ממשרד הביטחון, כחלק מיכולת ההשתכרות וההכנסה הפנויה של הורה לצורך חישוב מזונות זמניים. היא מדגישה את הגישה הרחבה של הפסיקה בהערכת יכולת כלכלית, הכוללת את כלל המקורות העומדים לרשות המשלם.', 'הפסיקה קובעת כי בעת הערכת יכולת ההשתכרות של הורה לצורך חישוב מזונות, ההסתכלות היא רחבה וכוללת לא רק משכורת אלא את סך כל המקורות הכלכליים העומדים לרשותו, לרבות נכסים, חסכונות ואף פוטנציאל השתכרות (בע"מ 3432/09 פלוני נ'' פלונית). קצבת נכות ממשרד הביטחון נחשבת כחלק ממקורות אלו, ולכן נלקחת בחשבון בחישוב מזונות זמניים (תלה"מ (י-ם) 54430-03-25 ר. צ. א נ'' י. א, פס'' 25). יש להבחין בין קצבה המשולמת להורה לבין קצבה המשולמת לקטין עצמו: קצבה לקטין נועדה לכסות צרכים מיוחדים, ורק אם נותרה יתרה לאחר כיסויים, ניתן להתחשב בה במזונות הבסיסיים, וזאת לרוב בשלב המזונות הקבועים ולא הזמניים (תלה"מ (י-ם) 32247-09-24 ט. י. ב נ'' י. ב, פס'' 24-25).',
    'הטעות הנפוצה היא לחשוב שקצבת נכות אינה נחשבת כהכנסה, בדומה לפיצויים על נזקי גוף, מבלי להבחין בין תכלית הקצבה לבין השפעתה על היכולת הכלכלית הכוללת של המשלם מזונות.', '["קצבת נכות", "משרד הביטחון", "יכולת השתכרות", "הכנסה פנויה", "מזונות זמניים", "הערכה רחבה"]'::jsonb, '**וריאציה 1 — האם קצבת נכות ממשרד הביטחון נחשבת כהכנסה למזונות?** ← כן, ההסתכלות על יכולת השתכרות היא רחבה וכוללת את כלל המקורות הכלכליים (בע"מ 3432/09; תלה"מ (י-ם) 54430-03-25).
**וריאציה 2 — מה לגבי קצבת נכות המשולמת לקטין?** ← נלקחת בחשבון רק אם נותרה יתרה לאחר כיסוי צרכים מיוחדים, וזאת לרוב במזונות קבועים (תלה"מ (י-ם) 32247-09-24, פס'' 24-25).
**וריאציה 3 — מהי תכלית ההתחשבות בקצבאות?** ← להבטיח שהחיוב במזונות ישקף את היכולת הכלכלית האמיתית של ההורה (תלה"מ (י-ם) 54430-03-25, פס'' 25).', 'קצבת נכות (להורה) ← נחשבת הכנסה למזונות ← קצבת נכות (לקטין) ← רק יתרה לאחר צרכים מיוחדים.',
    '["תלה\"מ (משפחה ירושלים) 54430-03-25 ר. צ. א נ'' י. א (6.4.2025)", "תלה\"מ (משפחה ירושלים) 32247-09-24 ט. י. ב נ'' י. ב (25.3.2025)", "בע\"מ 3432/09 פלוני נ'' פלונית (23.6.2009)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'האב צודק, קצבת נכות אינה נחשבת כהכנסה לצורך חישוב מזונות, שכן היא נועדה לפצות על נזקי גוף ולא על אובדן השתכרות.', false, 'בחירה זו שגויה. הפסיקה קובעת כי קצבת נכות, ובפרט קצבה ממשרד הביטחון, נחשבת כחלק מסך המקורות הכלכליים העומדים לרשות המשלם, ולכן נלקחת בחשבון בחישוב מזונות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'האב אינו צודק, קצבת נכות ממשרד הביטחון נחשבת כחלק מיכולת ההשתכרות של האב, ונלקחת בחשבון בחישוב מזונות זמניים, שכן ההסתכלות על יכולת ההשתכרות היא רחבה וכוללת את כלל המקורות הכלכליים.', true, 'בחירה זו נכונה. הפסיקה קובעת כי קצבת נכות ממשרד הביטחון נחשבת כהכנסה לצורך חישוב מזונות, שכן ההסתכלות על יכולת ההשתכרות היא רחבה וכוללת את כלל המקורות הכלכליים העומדים לרשות המשלם.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'קצבת נכות נלקחת בחשבון רק אם היא עולה על שכר המינימום במשק.', false, 'בחירה זו שגויה. אין קביעה בפסיקה המגבילה את התחשבות בקצבת נכות רק אם היא עולה על שכר המינימום. כל קצבה נלקחת בחשבון כחלק מהכנסותיו של המשלם.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'קצבת נכות נלקחת בחשבון רק אם היא משולמת לקטין עצמו, ולא להורה המשלם.', false, 'בחירה זו שגויה. קצבת נכות המשולמת להורה נלקחת בחשבון כהכנסה שלו. קצבת נכות המשולמת לקטין נלקחת בחשבון רק אם נותרה יתרה לאחר כיסוי צרכיו המיוחדים, וזאת בשלב המזונות הקבועים ולא הזמניים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 13, '2022-S-Q13';
END
$$;

-- ============================================================
-- Q14 — 2022-S-Q14 — chapter=civil_proc subtopic=preliminary_hearing
-- classifier_note: Mandatory attendance of unrepresented party — civil pre-trial procedure
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '677e751b-7860-4d34-a5a5-b74c54eb018f'::uuid;
  v_group_id uuid := 'b3a7b315-54b8-4959-9557-ccf1907f58af'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'a6e7b3d6-4710-4d61-9e21-d9eac124c789'::uuid;
  v_ang_1 uuid := '9e9fa42e-6e80-4ae6-9ee6-425a4e4f511d'::uuid;
  v_ang_2 uuid := '5344bcaf-19a2-461f-b74a-b0b9cb1f313a'::uuid;
  v_ang_3 uuid := '0af8980f-abd2-4e05-bf53-3d9e887ab609'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q14';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 14, '2022-S-Q14';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'preliminary_hearing' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'preliminary_hearing', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q14', v_chapter_id, v_subtopic_id, 'אליאס הגיש תביעה על סך 45,000 ש"ח בבית משפט השלום בתל אביב נגד עופר, בגין נזק שגרם עופר למכונה במפעל של אליאס. עופר אינו מיוצג על ידי עורך דין, אך הוא הגיש כתב הגנה. האם ניתן לחייב את הצדדים להתייצב לפגישת מהו"ת?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 14}'::jsonb, 'שאלה זו עוסקת בחובת קיום פגישת מהו"ת (מידע, היכרות ותיאום) בהליכים אזרחיים, בהתאם לתקנות סדר הדין האזרחי, תשע"ט-2018. היא בוחנת את התנאים לתחולת חובה זו, ובפרט את סכום התביעה, הערכאה השיפוטית ואת מעמדו של בעל הדין (מיוצג או לא מיוצג).', 'תקנה 37(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי פגישת מהו"ת תתקיים בתובענה שסכומה או שווי נושאה עולה על 40,000 ש"ח, המוגשת בבית משפט השלום. חובה זו חלה ''בין אם בעל הדין באותה תובענה מיוצג בידי עורך דין ובין אם לאו''. במקרה הנדון, סכום התביעה הוא 45,000 ש"ח, והיא הוגשה בבית משפט השלום. סוג התביעה (נזק למכונה) אינו נכלל בחריגים המפורטים בתקנה 37(ב) (כגון נזקי גוף או תאונות דרכים) או בתקנה 39(א) (כגון פינוי מושכר או תביעת רכב). לפיכך, חלה חובה על הצדדים להתייצב לפגישת מהו"ת. מטרת פגישת המהו"ת היא לבחון אפשרות ליישוב הסכסוך באמצעות מנגנון חלופי, והיא אינה הליך גישור אלא ''קדם גישור'' (רע"א (מחוזי י-ם) 74870-02-26 יאיר גולן נ'' בנימין נתניהו).', 'הטעות הנפוצה היא לחשוב שבעל דין שאינו מיוצג פטור מחובת התייצבות לפגישת מהו"ת, או לבלבל בין סכום התביעה הקובע (40,000 ש"ח) לבין סכומים אחרים שהיו נהוגים בעבר או בהליכים אחרים.',
    '["פגישת מהו\"ת", "תקנות סדר הדין האזרחי", "סכום תביעה", "בית משפט השלום", "ייצוג עורך דין", "חריגים"]'::jsonb, '**וריאציה 1 — תביעה מעל 40,000 ש"ח בשלום?** ← חובה פגישת מהו"ת (תקנה 37(ב)).
**וריאציה 2 — האם ייצוג משנה?** ← לא, חובה גם אם לא מיוצג (תקנה 37(ב)).
**וריאציה 3 — מהם החריגים העיקריים?** ← נזקי גוף, פלת"ד, פינוי מושכר, תביעת רכב (תקנה 37(ב) ו-39(א)).', 'פגישת מהו"ת חובה ← תביעה מעל 40,000 ש"ח ← בבית משפט השלום ← גם אם לא מיוצג ← למעט חריגים (נזקי גוף, פלת"ד וכו'').', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 37(ב)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 39(א)", "רע\"א (מחוזי י-ם) 74870-02-26 יאיר גולן נ'' בנימין נתניהו (12.5.2026)", "יעקב שקד, סדר הדין האזרחי (2026) | פרק ד הליכים מקדמיים", "נבו - המתמחה, סדר הדין האזרחי (2026) | ו. דיון מקדמי בין בעלי הדין ופגישת מהו\"ת"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''preliminary_hearing'' | classifier_note: Mandatory attendance of unrepresented party — civil pre-trial procedure', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'כן, לאור סוג התביעה וסכומה.', true, 'בחירה זו נכונה. תקנה 37(ב) לתקנות סדר הדין האזרחי קובעת כי פגישת מהו"ת תתקיים בתובענה שסכומה או שוויה עולה על 40,000 ש"ח המוגשת בבית משפט השלום, וזאת בין אם בעל הדין מיוצג ובין אם לאו. התביעה אינה נכללת בחריגים המפורטים בתקנה 37(ב) או 39(א).', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לא, מכיוון שסכום התביעה נמוך מ-50,000 ש"ח.', false, 'בחירה זו שגויה. הסכום הקובע לחובת קיום פגישת מהו"ת הוא 40,000 ש"ח, ולא 50,000 ש"ח, כפי שנקבע בתקנה 37(ב) לתקנות סדר הדין האזרחי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'כן, שכן חובה להשתתף בפגישת מהו"ת בכל תביעה מעל 40,000 ש"ח.', false, 'בחירה זו שגויה חלקית. אף שחובה להשתתף בפגישת מהו"ת בתביעה מעל 40,000 ש"ח, התשובה הנכונה (א) מדויקת יותר בכך שהיא מתייחסת גם לסוג התביעה (שאינה נכללת בחריגים), ולא רק לסכום.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא, מכיוון שעופר אינו מיוצג.', false, 'בחירה זו שגויה. תקנה 37(ב) לתקנות סדר הדין האזרחי קובעת במפורש כי חובת קיום פגישת מהו"ת חלה בין אם בעל הדין מיוצג ובין אם לאו.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'חובת התייצבות תאגיד לפגישת מהו"ת',
    1, 'חברת ''אלפא בע"מ'' הגישה תביעה בבית משפט השלום. נקבעה פגישת מהו"ת, אליה התייצב רק עורך הדין של החברה, בטענה שהוא בקיא בפרטי התביעה ומוסמך להחליט בעניין גישור. האם התאגיד קיים את חובת ההתייצבות כדין?', 'שאלה זו עוסקת בזהות הגורם החייב בהתייצבות לפגישת מהו"ת כאשר בעל הדין הוא תאגיד. היא בוחנת את ההבחנה בין התייצבות בעל דין פרטי לבין התייצבות תאגיד, ואת הדרישה כי נציג התאגיד יהיה בעל תפקיד בקיא ומוסמך, ולא רק עורך הדין המייצג.', 'תקנה 37(ט) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי לפגישת מהו"ת יתייצבו בעלי הדין, ורשאים הם להתייצב עם עורכי דינם. עם זאת, התקנה מפרטת חריגים והסדרים מיוחדים. לגבי תאגיד, תקנה 37(ט)(2) קובעת כי ''אם בעל הדין הוא תאגיד, יתייצב לפגישת מהו"ת נציג מטעמו שהוא בעל תפקיד הבקיא בפרטי הסכסוך עם עמדה מוסמכת בעניין העברת התובענה לגישור, ורשאי הוא להתייצב עם עורך דין מטעם בעל הדין''. כלומר, חובה על התאגיד לשלוח נציג מטעמו שהוא בעל תפקיד, בקיא ומוסמך, ועורך הדין רשאי להתייצב לצידו. התייצבות עורך הדין בלבד אינה מספקת, שכן מטרת פגישת המהו"ת היא לאפשר לצדדים להיפגש ולדון בחילוקי הדעות באופן ישיר ובלתי אמצעי, לא רק מן הבחינה המשפטית (יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי, מורה נבוכים (2025), עמ'' 23).',
    'הטעות הנפוצה היא להניח שעורך דין המייצג תאגיד יכול למלא את מקומו של נציג בעל תפקיד בפגישת מהו"ת, מבלי להבחין בדרישה המפורשת של התקנות לנציג בעל תפקיד מהתאגיד עצמו.', '["פגישת מהו\"ת", "חובת התייצבות", "תאגיד", "נציג בעל תפקיד", "תקנה 37(ט)(2)", "גישור"]'::jsonb, '**וריאציה 1 — מי מתייצב לפגישת מהו"ת מטעם תאגיד?** ← נציג בעל תפקיד, בקיא ומוסמך, ועורך הדין רשאי להתייצב לצידו (תקנה 37(ט)(2)).
**וריאציה 2 — מה מטרת דרישה זו?** ← לאפשר דיון ישיר ובלתי אמצעי, לא רק משפטי (רוזן-צבי, עמ'' 23).
**וריאציה 3 — האם עורך דין בלבד מספיק?** ← לא, התייצבות עורך דין בלבד אינה מקיימת את חובת התאגיד (ת"א (שלום י-ם) 58165-01-14).', 'תאגיד בפגישת מהו"ת ← נציג בעל תפקיד + עו"ד (רשות) ← לא רק עו"ד.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 37(ט)(2)", "יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ד דיון מקדמי בין בעלי הדין ופגישת מהו\"ת", "ת\"א (שלום י-ם) 58165-01-14 שלמה תחבורה (2007) בע\"מ נ'' כלכלית ירושלים בע\"מ (24.6.2015)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, עורך הדין של התאגיד, בהיותו בקיא ומוסמך, יכול לייצג את התאגיד בפגישת מהו"ת.', false, 'בחירה זו שגויה. תקנה 37(ט)(2) לתקנות סדר הדין האזרחי קובעת כי נציג התאגיד חייב להיות בעל תפקיד בחברה, ולא רק עורך הדין המייצג.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, על התאגיד להתייצב באמצעות נציג מטעמו שהוא בעל תפקיד הבקיא בפרטי הסכסוך ומוסמך להחליט בעניין גישור, ועורך הדין רשאי להתייצב לצידו.', true, 'בחירה זו נכונה. תקנה 37(ט)(2) לתקנות סדר הדין האזרחי קובעת במפורש את חובת התייצבותו של נציג בעל תפקיד מהתאגיד, בנוסף לאפשרות שעורך הדין יתייצב.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק אם עורך הדין הציג ייפוי כוח מיוחד המאשר את סמכותו להחליט בעניין גישור.', false, 'בחירה זו שגויה. ייפוי כוח אינו מחליף את הדרישה לנציג בעל תפקיד מהתאגיד עצמו, כפי שנקבע בתקנות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, שכן תאגיד פטור מחובת התייצבות לפגישת מהו"ת.', false, 'בחירה זו שגויה. תאגיד אינו פטור מחובת התייצבות, אלא חלה עליו חובת התייצבות מיוחדת באמצעות נציג בעל תפקיד, כפי שמפורט בתקנה 37(ט)(2).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'סמכויות הממונה ובית המשפט באי-התייצבות לפגישת מהו"ת',
    2, 'התובע לא התייצב לפגישת מהו"ת שנקבעה. המגשר דיווח על כך לממונה. מהן הסנקציות שניתן להטיל על התובע בגין אי-התייצבותו?', 'שאלה זו עוסקת בסמכויות הממונה על פגישות מהו"ת ובית המשפט להטיל סנקציות על בעל דין שלא התייצב לפגישת מהו"ת. היא בוחנת את הוראות תקנות 37(י) ו-38 לתקנות סדר הדין האזרחי, המפרטות את מגוון הסנקציות האפשריות, החל מחיוב בהוצאות ועד להתליית ההליך או מחיקת התובענה.', 'תקנה 37(י) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''לא התייצב מי מבעלי הדין לפגישת מהו"ת, יחייבו הממונה בהוצאות מגשר המהו"ת ובהוצאות בעלי הדין שהתייצבו לפגישה, זאת בלי לגרוע מסמכויות בית המשפט לגבי אי-מילוי הוראות פרק זה, זולת אם מצא הממונה כי קיימים טעמים שלא לחייב בהוצאות כאמור''. בנוסף, תקנה 38(א) קובעת כי בית המשפט רשאי בקדם-המשפט להורות לבעל דין שהפר הוראות אלה למלאן, ואם הפר התובע, רשאי בית המשפט ''להתלות את ההליך עד שהוא ימלא אותן כנדרש ואף למחוק את התובענה מטעמים מיוחדים''. תקנה 38(ב) מוסיפה כי אם לא הייתה סיבה מוצדקת להתנהלות, יחויב בעל הדין בהוצאות לאלתר לטובת בעל הדין שכנגד או לטובת אוצר המדינה. הפסיקה מיישמת הוראות אלו ומטילה הוצאות על צדדים שלא התייצבו ללא הצדקה (ראו ת"א (שלום ראשון לציון) 64394-08-25 מורי נ'' רדיע ואח''; ת"א (שלום חי'') 71400-08-24 ז''לזניאק ואח'' נ'' אדם ואח'').',
    'הטעות הנפוצה היא להמעיט בחומרת אי-ההתייצבות לפגישת מהו"ת, או לחשוב שהסנקציות מוגבלות רק לחיוב בהוצאות המגשר, מבלי להכיר במגוון הסנקציות הדיוניות והכספיות שניתן להטיל.', '["פגישת מהו\"ת", "אי-התייצבות", "סמכויות הממונה", "סמכויות בית המשפט", "חיוב בהוצאות", "התליית הליך", "מחיקת תובענה"]'::jsonb, '**וריאציה 1 — צד לא התייצב לפגישת מהו"ת?** ← הממונה יחייב בהוצאות המגשר והצדדים שהתייצבו (תקנה 37(י)).
**וריאציה 2 — מה יכול בית המשפט לעשות?** ← להתלות את ההליך, למחוק את התובענה מטעמים מיוחדים, או לחייב בהוצאות (תקנה 38(א) ו-(ב)).
**וריאציה 3 — האם טעות בתום לב פוטרת?** ← לעיתים כן, אם אי-ההתייצבות לא נבעה מזלזול בהליך (ת"א (שלום חי'') 30763-09-23).', 'אי-התייצבות מהו"ת ← הממונה מחייב הוצאות ← ביהמ"ש יכול להתלות/למחוק/לחייב הוצאות.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 37(י)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 38", "רע\"א (מחוזי י-ם) 74870-02-26 יאיר גולן נ'' בנימין נתניהו (12.5.2026)", "ת\"א (שלום ראשון לציון) 64394-08-25 מורי נ'' רדיע ואח'' (15.4.2026)", "ת\"א (שלום חי'') 71400-08-24 ז''לזניאק ואח'' נ'' אדם ואח'' (25.3.2025)", "ת\"א (שלום חי'') 30763-09-23 המוביל ח.ח. (2015) בע\"מ נ'' אטליז סופיאן יוסף בע\"מ ואח'' (11.3.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'הממונה יחייב את התובע בהוצאות המגשר ובהוצאות הנתבע שהתייצב, ובית המשפט רשאי להתלות את ההליך או למחוק את התובענה מטעמים מיוחדים.', true, 'בחירה זו נכונה. תקנה 37(י) לתקנות סדר הדין האזרחי קובעת את סמכות הממונה לחייב בהוצאות, ותקנה 38(א) קובעת את סמכויות בית המשפט להתלות את ההליך או למחוק את התובענה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'רק הממונה רשאי להטיל סנקציות, והן מוגבלות לחיוב בהוצאות המגשר בלבד.', false, 'בחירה זו שגויה. גם בית המשפט מוסמך להטיל סנקציות, והן כוללות גם הוצאות לצד שהתייצב וסנקציות דיוניות נוספות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'בית המשפט יחייב את התובע בהוצאות לטובת אוצר המדינה בלבד, וזאת רק אם הוכח חוסר תום לב.', false, 'בחירה זו שגויה. בית המשפט רשאי לחייב בהוצאות גם לטובת הצד שכנגד, ואי-התייצבות ללא סיבה מוצדקת כשלעצמה יכולה להוביל לחיוב בהוצאות, גם ללא הוכחת חוסר תום לב מובהק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'ההליך יתעכב עד לקיום פגישת מהו"ת נוספת, אך לא יוטלו הוצאות על התובע.', false, 'בחירה זו שגויה. אף שההליך יכול להתעכב, תקנות 37(י) ו-38(ב) קובעות במפורש אפשרות לחיוב בהוצאות, אלא אם כן נמצאו טעמים מיוחדים שלא לעשות כן.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חריגים לחובת קיום פגישת מהו"ת',
    3, 'ראובן הגיש תביעה לפיצויים בשל נזק גוף שנגרם לו בתאונת עבודה, בסך 100,000 ש"ח, בבית משפט השלום. האם חלה חובה על הצדדים להתייצב לפגישת מהו"ת?', 'שאלה זו בוחנת את ידיעת החריגים לחובת קיום פגישת מהו"ת, כפי שנקבעו בתקנות סדר הדין האזרחי. היא מתמקדת בחריג הספציפי לתביעות לפיצויים בשל נזק גוף, ומדגישה כי חריג זה פוטר את התביעה מחובת מהו"ת באופן מוחלט, ללא קשר לסכום או לערכאה.', 'תקנה 37(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי פגישת מהו"ת תתקיים בתובענה שסכומה או שווי נושאה עולה על 40,000 ש"ח המוגשת בבית משפט השלום, אך מסייגת זאת במפורש: ''למעט בתובענה לפיצויים בשל נזק גוף ותובענה שעילתה בחוק פיצויים לנפגעי תאונות דרכים''. כלומר, תביעה לפיצויים בשל נזק גוף, גם אם סכומה עולה על 40,000 ש"ח והיא מוגשת בבית משפט השלום, פטורה מחובת קיום פגישת מהו"ת. חריגים נוספים מפורטים בתקנה 39(א) לתקנות, אך החריג לנזקי גוף הוא ספציפי ומופיע כבר בתקנה 37(ב) (ראו גם יעקב שקד, סדר הדין האזרחי (2026), עמ'' 3).',
    'הטעות הנפוצה היא להתמקד רק בסכום התביעה ובערכאה, מבלי לשים לב לחריגים הספציפיים לסוגי תביעות מסוימים, כגון נזקי גוף.', '["פגישת מהו\"ת", "חריגים", "נזק גוף", "תקנה 37(ב)", "חוק פיצויים לנפגעי תאונות דרכים", "סוגי תביעות"]'::jsonb, '**וריאציה 1 — תביעה על נזק גוף?** ← פטורה מחובת מהו"ת, ללא קשר לסכום (תקנה 37(ב)).
**וריאציה 2 — מהם חריגים נוספים?** ← הליך בהסכמה, פינוי מושכר, תביעת רכב, תביעה אזרחית נגררת, סדרי דין מיוחדים (תקנה 39(א)).
**וריאציה 3 — האם בית המשפט יכול להורות על מהו"ת גם בחריגים?** ← כן, בית המשפט רשאי בכל עת להורות על כך (תקנה 39(ב)).', 'תביעת נזק גוף ← פטורה ממהו"ת (תקנה 37(ב)) ← גם אם סכום גבוה ובשלום.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 37(ב)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 39(א)", "יעקב שקד, סדר הדין האזרחי (2026) | פרק ד הליכים מקדמיים"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, שכן סכום התביעה עולה על 40,000 ש"ח והיא הוגשה בבית משפט השלום.', false, 'בחירה זו שגויה. אף שסכום התביעה והערכאה מתאימים, תביעה לפיצויים בשל נזק גוף היא חריג מפורש לחובת קיום פגישת מהו"ת, כפי שנקבע בתקנה 37(ב) לתקנות סדר הדין האזרחי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, תביעה לפיצויים בשל נזק גוף היא חריג מפורש לחובת קיום פגישת מהו"ת, ללא קשר לסכום התביעה או לערכאה.', true, 'בחירה זו נכונה. תקנה 37(ב) לתקנות סדר הדין האזרחי קובעת במפורש כי חובת קיום פגישת מהו"ת אינה חלה על תובענה לפיצויים בשל נזק גוף.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אלא אם כן נשיא בית המשפט או שופט שמינה לכך התיר שלא לקיים את הפגישה מטעמים מיוחדים.', false, 'בחירה זו שגויה. אף שזהו חריג כללי לחובת קיום פגישת מהו"ת (תקנה 39(א)(3)), במקרה של נזק גוף קיים חריג ספציפי ומפורש בתקנה 37(ב) הפוטר את התביעה מחובה זו באופן אוטומטי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, מכיוון שתביעות בגין נזקי גוף נדונות בדרך כלל בהליכי גישור חובה, ולכן פגישת מהו"ת מיותרת.', false, 'בחירה זו שגויה. הסיבה לפטור אינה קיום הליכי גישור חובה, אלא חריג מפורש בתקנות. בנוסף, פגישת מהו"ת אינה הליך גישור אלא ''קדם גישור''.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'קיום פגישת מהו"ת בהיוועדות חזותית',
    4, 'הנתבע, המתגורר דרך קבע בחו"ל, לא התייצב פיזית לפגישת מהו"ת שנקבעה, וטען כי ניסה להתחבר לפגישה בהיוועדות חזותית אך נתקל בקושי טכני. האם טענתו פוטרת אותו מחובת התייצבות?', 'שאלה זו עוסקת בחובת ההתייצבות לפגישת מהו"ת במקרים מיוחדים, ובפרט כאשר בעל הדין מתגורר בחו"ל או כאשר מתעוררים קשיים טכניים בקיום הפגישה בהיוועדות חזותית. היא בוחנת את הוראות תקנה 37(ט) ו-(ז) לתקנות סדר הדין האזרחי ואת פרשנות הפסיקה לגבי חובת ההתייצבות והרצינות הנדרשת מהצדדים.', 'תקנה 37(ט) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי לפגישת מהו"ת יתייצבו בעלי הדין. חריג מיוחד נקבע לגבי בעל דין המתגורר דרך קבע מחוץ לגבולות המדינה: ''יתייצב לפגישת מהו"ת מיופה כוחו'' (תקנה 37(ט)(1)). כלומר, במקרה זה, הנתבע היה צריך לדאוג להתייצבות מיופה כוח מטעמו. בנוסף, אף שניתן לקיים פגישת מהו"ת בהיוועדות חזותית בהסכמת הצדדים והמגשר או בהוראת הממונה (רוזן-צבי, עמ'' 23), הפסיקה קובעת כי זימון לפגישת מהו"ת דינו כדין הזמנה לדיון בבית המשפט (תקנה 37(ד)), ועל הצדדים להתייחס אליה במלוא הרצינות. טענה לקושי טכני, במיוחד כאשר לא נתמכה בתצהיר ולא ננקטו צעדים למנוע אותה, אינה פוטרת מחובת התייצבות (ת"א (שלום ראשון לציון) 64394-08-25 מורי נ'' רדיע ואח'').',
    'הטעות הנפוצה היא לחשוב ששהות בחו"ל או קשיים טכניים פוטרים באופן אוטומטי מחובת התייצבות, מבלי להכיר בדרישה למיופה כוח או בחובת הרצינות וההיערכות הנדרשת מקיום פגישת מהו"ת.', '["פגישת מהו\"ת", "חובת התייצבות", "בעל דין בחו\"ל", "מיופה כוח", "היוועדות חזותית", "קושי טכני", "תקנה 37(ט)(1)"]'::jsonb, '**וריאציה 1 — בעל דין בחו"ל לא התייצב פיזית?** ← חייב להתייצב באמצעות מיופה כוחו (תקנה 37(ט)(1)).
**וריאציה 2 — קושי טכני בהיוועדות חזותית?** ← אינו פוטר מחובת התייצבות, יש להתייחס ברצינות לפגישה (ת"א (שלום ראשון לציון) 64394-08-25).
**וריאציה 3 — האם ניתן לקיים מהו"ת בהיוועדות חזותית?** ← כן, בהסכמת הצדדים והמגשר או בהוראת הממונה (רוזן-צבי, עמ'' 23).', 'בעל דין בחו"ל ← מיופה כוח חובה ← קושי טכני אינו פוטר ← מהו"ת בהיוועדות חזותית אפשרית בהסכמה.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 37(ט)(1)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 37(ד)", "יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ד דיון מקדמי בין בעלי הדין ופגישת מהו\"ת", "ת\"א (שלום ראשון לציון) 64394-08-25 מורי נ'' רדיע ואח'' (15.4.2026)", "רע\"א (מחוזי י-ם) 74870-02-26 יאיר גולן נ'' בנימין נתניהו (12.5.2026)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, מכיוון שהוא מתגורר דרך קבע בחו"ל, הוא פטור מחובת התייצבות פיזית, וקושי טכני הוא טעם סביר לאי-התייצבות בהיוועדות חזותית.', false, 'בחירה זו שגויה. בעל דין המתגורר בחו"ל חייב להתייצב באמצעות מיופה כוחו. קושי טכני אינו פוטר מחובת התייצבות, במיוחד אם לא ננקטו צעדים מספקים למנוע אותו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, שכן בעל דין המתגורר דרך קבע בחו"ל חייב להתייצב באמצעות מיופה כוחו, וקושי טכני אינו מהווה טעם מיוחד לאי-התייצבות.', true, 'בחירה זו נכונה. תקנה 37(ט)(1) קובעת כי בעל דין המתגורר בחו"ל יתייצב באמצעות מיופה כוחו. בנוסף, הפסיקה קובעת כי קושי טכני אינו פוטר מחובת התייצבות, וכי יש להתייחס ברצינות לפגישת מהו"ת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אם הודיע מראש למגשרת על שהותו בחו"ל ועל כוונתו להתחבר בהיוועדות חזותית.', false, 'בחירה זו שגויה. הודעה מראש אינה פוטרת מחובת התייצבות באמצעות מיופה כוח, ואינה הופכת קושי טכני לטעם מוצדק לאי-התייצבות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, אלא אם כן הצדדים הסכימו מראש על קיום הפגישה בהיוועדות חזותית, וגם אז, קושי טכני אינו פוטר מחובת התייצבות.', false, 'בחירה זו שגויה חלקית. אף שקיום פגישה בהיוועדות חזותית דורש הסכמה או הוראת ממונה, החריג לבעל דין בחו"ל הוא התייצבות מיופה כוח, ולא רק קיום הפגישה מרחוק.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 14, '2022-S-Q14';
END
$$;

-- ============================================================
-- Q15 — 2022-S-Q15 — chapter=civil_proc subtopic=proceedings
-- classifier_note: Interim relief without security deposit — civil procedure
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '3b99ec49-cfce-4190-8cc6-ae50925ec265'::uuid;
  v_group_id uuid := '52790686-f35e-42e9-837f-657c463b9eb5'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'aab2a11f-e3cf-4801-a38d-133e01f76b7f'::uuid;
  v_ang_1 uuid := 'cc9e7fa4-4daf-43d6-8898-393cfd4791fe'::uuid;
  v_ang_2 uuid := '9c2b0f5d-204a-446c-a727-bce0b0eab5fe'::uuid;
  v_ang_3 uuid := '31fc0d05-ec4c-47f4-a2a9-ab4e292f99a4'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q15';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 15, '2022-S-Q15';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q15', v_chapter_id, v_subtopic_id, 'ריקי מבקשת לקבל סעד זמני במסגרת תביעת הקניין הרוחני שהגישה נגד יותם, אשר לטענתה השאיר אותה חסרת כול כאשר מכר את המחזה שכתבו יחדיו תחת שמו בלבד. לריקי אין כסף שתוכל להפקיד כערובה או ערב שיוכל לערוב ליכולותיה הכספיות. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 15}'::jsonb, 'שאלה זו עוסקת בתנאים המקדמיים למתן סעד זמני, ובפרט בדרישות להמצאת התחייבות עצמית והפקדת ערובה, בהתאם לתקנה 96 לתקנות סדר הדין האזרחי, תשע"ט-2018. היא מדגישה את ההבחנה בין חובת ההתחייבות העצמית, שהיא מוחלטת, לבין חובת הפקדת הערובה, ממנה ניתן לפטור מטעמים מיוחדים.', 'תקנה 96(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''סעד זמני יותנה בהתחייבות עצמית של המבקש לפיצוי כמפורט בתקנת משנה (ב), וכן בערובה כמפורט בתקנת משנה (ג) לשם פיצוי בשל כל נזק שייגרם למי שמופנה אליו הצו כתוצאה ממתן הצו הזמני, אם יפקע הצו או יצומצם היקפו''. תקנה 96(ב) מבהירה כי התחייבות עצמית של מבקש תצורף לבקשה ולא תהיה מוגבלת בסכום, זולת אם בית המשפט הורה אחרת. הפסיקה קבעה כי התחייבות עצמית היא תנאי מקדמי מהותי למתן סעד זמני, ובית המשפט אינו רשאי לפטור ממנה (רע"א 3935/23 בן ארצי נ'' זובידאת, פסקה 8; רע"א 5638/21 גלילי נ'' רותם אמפרט נגב בע"מ, פסקה 9). לעומת זאת, תקנה 96(ג) קובעת כי המבקש יפקיד ערובה מספקת, אך בית המשפט רשאי, מטעמים מיוחדים, לפטור את המבקש מהפקדת ערובה, אם סבר שהדבר צודק וראוי בנסיבות העניין. הערובה נועדה להבטיח את הצד שכנגד מפני נזקים שייגרמו לו אם יתברר שהסעד הזמני ניתן ללא הצדקה (רע"א 9308/08 אלול נ'' רביב, פסקה 8).', 'הטעות הנפוצה היא לבלבל בין התחייבות עצמית לערובה, ולחשוב שניתן לפטור משתיהן או ששתיהן חובה מוחלטת. יש להבין את ההבחנה המהותית בין השתיים ואת שיקול הדעת הנתון לבית המשפט לגבי הערובה בלבד.',
    '["סעד זמני", "התחייבות עצמית", "ערובה", "תקנה 96 לתקסד\"א", "פטור מערובה", "שיקול דעת בית המשפט"]'::jsonb, '**וריאציה 1 — האם ניתן לפטור מהתחייבות עצמית?** ← לא, זו דרישה מהותית וחובה (רע"א 3935/23).
**וריאציה 2 — האם ניתן לפטור מהפקדת ערובה?** ← כן, מטעמים מיוחדים אם בית המשפט סבר שהדבר צודק וראוי (תקנה 96(ג)).
**וריאציה 3 — מה ההבדל בין התחייבות עצמית לערובה?** ← התחייבות עצמית היא התחייבות אישית של המבקש, ערובה היא בטוחה כספית או ערבות צד שלישי (רע"א 9308/08; נבו - המתמחה, סדר הדין האזרחי, עמ'' 123).', 'סעד זמני ← חובה התחייבות עצמית ← חובה ערובה (אך ניתן לפטור מטעמים מיוחדים).', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 96", "רע\"א 3935/23 מוטי בן ארצי, עו\"ד - נאמן נ'' הילאלה זובידאת (31.5.2023)", "רע\"א 5638/21 רועי גלילי נ'' רותם אמפרט נגב בע\"מ (4.1.2022)", "רע\"א 9308/08 אורן אלול נ'' רינה רביב (21.4.2009)", "נבו - המתמחה, סדר הדין האזרחי (2026) | יז - סעדים זמניים"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Interim relief without security deposit — civil procedure', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'חובה על ריקי לצרף לבקשה ערובה, אך מטעמים מיוחדים רשאי בית המשפט לפטור את ריקי מהתחייבות עצמית, אם סבר שהדבר צודק וראוי בנסיבות העניין.', false, 'בחירה זו שגויה. תקנה 96(א) ו-(ב) לתקנות סדר הדין האזרחי קובעת כי חובה לצרף התחייבות עצמית, ובית המשפט אינו רשאי לפטור ממנה. הפטור מטעמים מיוחדים מתייחס להפקדת ערובה בלבד.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לא ניתן לקבל סעד זמני ללא התחייבות עצמית וערובה לפיצוי על כל נזק שייגרם למי שמופנה אליו הצו כתוצאה ממתן הצו הזמני, אם יפקע הצו או יצומצם היקפו.', false, 'בחירה זו שגויה. אף שחובה לצרף התחייבות עצמית, בית המשפט רשאי לפטור מהפקדת ערובה מטעמים מיוחדים, ולכן לא תמיד נדרשת ערובה בפועל.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'התחייבות עצמית וערובה אינן תנאי לקבלת סעד זמני, ולבית המשפט שיקול דעת אם לדרוש מריקי את שתיהן או איזו מהן.', false, 'בחירה זו שגויה. התחייבות עצמית היא תנאי חובה למתן סעד זמני, ובית המשפט אינו רשאי לפטור ממנה. ערובה היא ככלל חובה, אך ניתנת לפטור מטעמים מיוחדים.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'חובה על ריקי לצרף לבקשה התחייבות עצמית, אך מטעמים מיוחדים רשאי בית המשפט לפטור אותה מהפקדת ערובה, אם סבר שהדבר צודק וראוי בנסיבות העניין.', true, 'בחירה זו נכונה. תקנה 96(א) ו-(ב) לתקנות סדר הדין האזרחי קובעת חובה לצרף התחייבות עצמית, ואילו תקנה 96(ג) מאפשרת לבית המשפט לפטור מהפקדת ערובה מטעמים מיוחדים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'פטור מהתחייבות עצמית בהליכי חדלות פירעון',
    1, 'מפרק זמני של חברה בחדלות פירעון הגיש בקשה לסעד זמני נגד צד שלישי. המפרק טוען כי הוא פטור מהמצאת התחייבות עצמית, שכן הוא פועל מטעם קופת הפירוק. מה הדין?', 'שאלה זו בוחנת את תחולת חובת ההתחייבות העצמית על מפרק המבקש סעד זמני בהליכי חדלות פירעון. היא מדגישה את העיקרון לפיו גם במקרים אלו, יש להבטיח את הצד שכנגד מפני נזקים, אך ההתחייבות מוטלת על קופת הפירוק ולא על המפרק באופן אישי.', 'הלכה פסוקה היא כי כאשר מוגשת בקשה לסעדים זמניים לפי תקנות סדר הדין האזרחי, חובה לצרף לה התחייבות עצמית של מבקש הסעד לפיצוי מי שהצו הזמני מופנה אליו אם תיפסק התובענה או יפקע הצו מסיבה אחרת (תקנה 96 לתקנות סדר הדין האזרחי, תשע"ט-2018, המקבילה לתקנה 365(ב) לתקנות הישנות). בית המשפט לא יעניק סעד זמני אלא בכפוף להמצאת התחייבות כאמור (רע"א 3935/23 בן ארצי נ'' זובידאת, פסקה 8; רע"א 9308/08 אלול נ'' רביב, פסקה 5). חובה זו חלה גם בהליכי פירוק, אם כי מדובר בהתחייבות של קופת הפירוק ולא של המפרק אישית (רע"א 3032/08 רייך נ'' עו"ד אבנר כהן, פסקה 13). התחייבות עצמית זו היא ''מחיר'' שעל מבקש הסעד הזמני לשלם בתמורה לכך שניתן לו סעד בטרם הוכיח באופן מלא את זכותו, והיא יוצרת בסיס לתביעה לפיצויים גם אם ההחלטה לבקש את הסעד לא הייתה רשלנית (רע"א 3032/08 רייך נ'' עו"ד אבנר כהן, פסקה 13).',
    'הטעות הנפוצה היא לחשוב שמפרק, בהיותו פועל מטעם בית המשפט, פטור מחובת התחייבות עצמית, מבלי להבחין בין אחריותו האישית לאחריות קופת הפירוק.', '["התחייבות עצמית", "סעד זמני", "חדלות פירעון", "מפרק", "קופת פירוק", "תקנה 96 לתקסד\"א"]'::jsonb, '**וריאציה 1 — מפרק מבקש סעד זמני, האם חייב בהתחייבות עצמית?** ← כן, אך בשם קופת הפירוק ולא אישית (רע"א 3032/08).
**וריאציה 2 — למה נדרשת התחייבות עצמית גם ממפרק?** ← זהו ''מחיר'' לקבלת סעד לפני הוכחת זכות מלאה, ומבטיח פיצוי לצד הנפגע (רע"א 3032/08).
**וריאציה 3 — האם בית המשפט יכול לפטור מהתחייבות עצמית?** ← לא, התחייבות עצמית היא תנאי מקדמי חובה (רע"א 3935/23).', 'מפרק ← סעד זמני ← התחייבות עצמית חובה ← בשם קופת הפירוק.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 96", "רע\"א 3935/23 מוטי בן ארצי, עו\"ד - נאמן נ'' הילאלה זובידאת (31.5.2023)", "רע\"א 9308/08 אורן אלול נ'' רינה רביב (21.4.2009)", "רע\"א 3032/08 אפרים רייך נ'' עו\"ד אבנר כהן, בתפקידו כמפרק זמני (2.9.2009)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'המפרק פטור מהמצאת התחייבות עצמית, שכן הוא פועל כנאמן מטעם בית המשפט ואין לחייבו באופן אישי.', false, 'בחירה זו שגויה. אף שהמפרק אינו חייב באופן אישי, קופת הפירוק חייבת בהתחייבות עצמית, שכן היא נושאת בסיכונים הכרוכים בבקשת הסעד הזמני.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'חובה להמציא התחייבות עצמית, אך היא תהיה בשם קופת הפירוק ולא בשם המפרק באופן אישי.', true, 'בחירה זו נכונה. הפסיקה קבעה כי גם בהליכי חדלות פירעון, חובה להמציא התחייבות עצמית, אך היא תהיה של קופת הפירוק, שכן היא זו שנושאת בסיכונים וברווחים מהסעד הזמני.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'המפרק פטור מהמצאת התחייבות עצמית, אך בית המשפט רשאי לחייבו בהפקדת ערובה מטעמים מיוחדים.', false, 'בחירה זו שגויה. הפטור מטעמים מיוחדים מתייחס להפקדת ערובה בלבד, ולא להתחייבות עצמית, שהיא תנאי חובה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'רק אם המפרק הגיש תצהיר התומך בבקשתו, הוא יהיה חייב בהתחייבות עצמית.', false, 'בחירה זו שגויה. חובת ההתחייבות העצמית אינה תלויה בהגשת תצהיר, אלא היא תנאי מקדמי למתן סעד זמני.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאים לחילוט ערובה בתקנות החדשות',
    2, 'הוגש סעד זמני, ולאחר מכן הוא בוטל. הצד שכנגד מבקש לחלט את הערובה שהופקדה. מהם התנאים לחילוט הערובה לפי תקנות סדר הדין האזרחי, תשע"ט-2018?', 'שאלה זו עוסקת בתנאים למימוש ערובה (חילוט) שהופקדה כתנאי למתן סעד זמני, בהתאם לתקנות סדר הדין האזרחי החדשות. היא בוחנת את הפרשנות הפסיקתית לתקנה 101, המאחדת את ההסדרים שהיו קיימים בתקנות הישנות, ומדגישה את הדרישה לאי-סבירות הבקשה ולקיום נזק, ללא צורך בהוכחת גובהו המדויק.', 'תקנה 101 לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת הסדר תמציתי ומאוחד למימוש ערובה או השבתה. אף שלשונה אינה מפרטת את התנאים לחילוט, הפסיקה קבעה כי תקנות סדר הדין האזרחי לא ביקשו לסטות מההסדר שהיה קבוע בתקנה 371(א) לתקנות הישנות (רע"א 897/24 איפרגן נ'' סנדרס, פסקה 13). לפיכך, התנאים לחילוט ערובה הם: א. פקיעת הצו הזמני. ב. הבקשה לסעד זמני לא הייתה סבירה בנסיבות העניין. ג. נגרם נזק למבקש החילוט. עם זאת, אין צורך להוכיח את גובה הנזק, אלא די בכמות מינימלית של ראיות להוכחת קיומו (רע"א 9308/08 אלול נ'' רביב, פסקה 9; רע"א 22577-03-25 יצחק י. גליק בע"מ נ'' פקיד שומה ירושלים, פסקה 7; ת"א (מחוזי ת"א) 64860-10-25 נטע ברקת נ'' פיט פילאטיס בע"מ, פסקה 12). חילוט הערובה אינו עניין אוטומטי והוא נתון לשיקול דעתו של בית המשפט (רע"א 2429/21 יפתח נ'' עובד, פסקה 12).',
    'הטעות הנפוצה היא לחשוב שתקנה 101 החדשה שינתה באופן מהותי את תנאי החילוט, או לבלבל בין חילוט ערובה לבין תביעה רגילה לפיצויים, הדורשת הוכחת גובה הנזק.', '["חילוט ערובה", "תקנה 101 לתקסד\"א", "אי-סבירות הבקשה", "הוכחת נזק", "שיקול דעת שיפוטי", "תקנה 371 לתקסד\"א (ישנות)"]'::jsonb, '**וריאציה 1 — מהם התנאים לחילוט ערובה לפי התקנות החדשות?** ← הבקשה לסעד זמני לא הייתה סבירה ונגרם נזק, ללא צורך להוכיח את גובה הנזק (רע"א 897/24; רע"א 9308/08).
**וריאציה 2 — האם חילוט ערובה הוא אוטומטי?** ← לא, הוא נתון לשיקול דעת בית המשפט (רע"א 2429/21).
**וריאציה 3 — מה ההבדל בין ערובה לערבות/עירבון בתקנות החדשות?** ← התקנות החדשות איחדו את המונחים ל''ערובה'' אחת, אך הפסיקה ממשיכה לפרש את תנאי החילוט ברוח ההבחנות הקודמות (רע"א 897/24).', 'חילוט ערובה ← בקשה לא סבירה + נזק ← גובה נזק לא חייב הוכחה מדויקת.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 101", "רע\"א 897/24 ברוך איפרגן נ'' יהונתן סנדרס (18.3.2024)", "רע\"א 9308/08 אורן אלול נ'' רינה רביב (21.4.2009)", "רע\"א 22577-03-25 יצחק י. גליק בע\"מ נ'' פקיד שומה ירושלים (27.7.2025)", "ת\"א (מחוזי ת\"א) 64860-10-25 נטע ברקת נ'' פיט פילאטיס בע\"מ (26.4.2026)", "רע\"א 2429/21 יפתח נ'' עובד (25.4.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'יש להוכיח כי הבקשה לסעד זמני לא הייתה סבירה בנסיבות העניין, וכי נגרם נזק, ללא צורך להוכיח את גובה הנזק.', true, 'בחירה זו נכונה. אף שתקנה 101 לתקנות החדשות אינה מפרטת את התנאים, הפסיקה מפרשת אותה ברוח תקנה 371 הישנה, הדורשת אי-סבירות הבקשה וקיום נזק, אך ללא הוכחת גובהו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'יש להוכיח כי הבקשה לסעד זמני הוגשה בחוסר תום לב, וכי נגרם נזק שניתן לכמת אותו.', false, 'בחירה זו שגויה. חוסר תום לב אינו תנאי הכרחי לחילוט, ואין צורך להוכיח את גובה הנזק באופן מדויק, אלא די בכמות מינימלית של ראיות לקיומו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'חילוט הערובה הוא אוטומטי עם ביטול הסעד הזמני, ואין צורך להוכיח נזק או אי-סבירות.', false, 'בחירה זו שגויה. חילוט ערובה אינו אוטומטי, והוא נתון לשיקול דעת בית המשפט ודורש הוכחת תנאים מסוימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'יש להגיש תביעה נפרדת לפיצויים, ורק לאחר קבלת פסק דין ניתן יהיה לממש את הערובה.', false, 'בחירה זו שגויה. חילוט ערובה הוא הליך מהיר יותר, שאינו דורש תביעה נפרדת, ונועד לאפשר פיצוי מיידי יחסית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'פטור מהתחייבות עצמית בהליכי מס הכנסה',
    3, 'פקיד שומה הגיש בקשה לעיקול נכסים לפי סעיף 194 לפקודת מס הכנסה. הנישום טוען כי פקיד השומה חייב בהמצאת התחייבות עצמית וערובה, בדומה לבקשה לסעד זמני אזרחי. מה הדין?', 'שאלה זו עוסקת בחריג לתחולת הוראות פרק ט"ו לתקנות סדר הדין האזרחי (סעדים זמניים) על הליכים ספציפיים, ובפרט על בקשות לעיקול לפי סעיף 194 לפקודת מס הכנסה. היא מדגישה כי למרות הדמיון המהותי לסעד זמני אזרחי, קיימת הוראה ספציפית המונעת את תחולת דרישות ההתחייבות העצמית והערובה במקרים אלו.', 'הפסיקה קבעה כי בקשה לעיקול לפי סעיף 194 לפקודת מס הכנסה דומה במהותה לבקשה למתן סעד זמני בתובענה אזרחית ונבחנת על פי אותן אמות מידה. יחד עם זאת, הוראות פרק ט"ו לתקנות סדר הדין האזרחי, תשע"ט-2018, אינן חלות במישרין על הליך לפי סעיף 194; זאת לנוכח הוראת סעיף 9(א) לתקנות בית משפט (ערעורים בענייני מס הכנסה), התשל"ט-1978, המחריגה את תחולתן של התקנות בפרק זה על ערעורים בענייני מס הכנסה. משכך, גם תקנה 96, המתנה את מתן הסעד הזמני בהפקדת ערובה ובמתן התחייבות עצמית, אינה חלה על מתן סעד זמני לפי סעיף 194 לפקודה (רע"א 22577-03-25 יצחק י. גליק בע"מ נ'' פקיד שומה ירושלים, פסקה 7). בהיעדר התחייבות עצמית, אין בסיס משפטי לפסיקת פיצויים בגין נזקים שנגרמו עקב הסעד הזמני (רע"א 22577-03-25 יצחק י. גליק בע"מ נ'' פקיד שומה ירושלים, פסקה 6).',
    'הטעות הנפוצה היא להקיש באופן אוטומטי את כללי הסעדים הזמניים האזרחיים על הליכים מנהליים או ספציפיים, מבלי לבדוק את הוראות החוק הספציפיות החלות על אותם הליכים.', '["סעיף 194 לפקודת מס הכנסה", "התחייבות עצמית", "ערובה", "חריגים לתקנות סדר הדין האזרחי", "סעד זמני", "ערעורי מס הכנסה"]'::jsonb, '**וריאציה 1 — האם פקיד שומה חייב בהתחייבות עצמית לעיקול לפי סעיף 194?** ← לא, תקנה 96 לתקסד"א אינה חלה על הליכים אלו (רע"א 22577-03-25).
**וריאציה 2 — מה הסיבה לאי-התחולה?** ← הוראה ספציפית בתקנות בית משפט (ערעורים בענייני מס הכנסה) מחריגה זאת (רע"א 22577-03-25).

**וריאציה 3 — מה המשמעות של היעדר התחייבות עצמית?** ← אין בסיס משפטי לפסיקת פיצויים בגין נזקים שנגרמו עקב הסעד הזמני (רע"א 22577-03-25).', 'עיקול מס הכנסה (סעיף 194) ← פטור מהתחייבות עצמית וערובה ← תקנה 96 לא חלה.',
    '["רע\"א 22577-03-25 יצחק י. גליק בע\"מ נ'' פקיד שומה ירושלים (27.7.2025)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 96"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'הנישום צודק, שכן בקשה לעיקול לפי סעיף 194 דומה במהותה לסעד זמני אזרחי, ולכן חלות עליה הוראות תקנה 96 לתקנות סדר הדין האזרחי.', false, 'בחירה זו שגויה. אף שהבקשה דומה במהותה לסעד זמני, הוראות פרק ט"ו לתקנות סדר הדין האזרחי אינן חלות במישרין על הליכים לפי סעיף 194 לפקודת מס הכנסה, בשל הוראה ספציפית בחקיקת משנה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'הנישום אינו צודק. הוראות פרק ט"ו לתקנות סדר הדין האזרחי, ובכלל זה תקנה 96, אינן חלות על הליכים לפי סעיף 194 לפקודת מס הכנסה, ולכן פקיד השומה פטור מהמצאת התחייבות עצמית וערובה.', true, 'בחירה זו נכונה. הפסיקה קבעה כי תקנות סדר הדין האזרחי העוסקות בסעדים זמניים אינן חלות על ערעורי מס הכנסה, ולכן אין חובה בהתחייבות עצמית או ערובה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'פקיד השומה פטור מהפקדת ערובה, אך חייב בהמצאת התחייבות עצמית, שכן היא דרישה מהותית.', false, 'בחירה זו שגויה. הפטור חל על שתי הדרישות – התחייבות עצמית וערובה – בשל אי-תחולת תקנה 96 על הליכים אלו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'פקיד השומה חייב בהמצאת התחייבות עצמית וערובה, אך בית המשפט רשאי לפטור אותו מטעמים מיוחדים, כגון אינטרס ציבורי.', false, 'בחירה זו שגויה. הפטור אינו נובע משיקול דעת בית המשפט מטעמים מיוחדים, אלא מאי-תחולת תקנה 96 על הליכים אלו באופן עקרוני.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סעד זמני לפני הגשת תביעה',
    4, 'ראובן גילה כי שמעון מתכוון להבריח נכסים לחו"ל. ראובן מעוניין להגיש תביעה נגד שמעון, אך חושש שעד להגשתה, הנכסים כבר לא יהיו בארץ. האם ראובן יכול לבקש סעד זמני לפני הגשת כתב התביעה, ומהם התנאים לכך?', 'שאלה זו עוסקת באפשרות לקבל סעד זמני בטרם הגשת כתב תביעה, ובמגבלות והתנאים לכך. היא בוחנת את הוראות תקנה 95(ג) לתקנות סדר הדין האזרחי, המאפשרת מתן סעד זמני או ארעי במקרים דחופים, תוך חיוב המבקש בהגשת התביעה העיקרית בתוך פרק זמן קצר.', 'תקנה 95(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''על אף האמור בתקנת משנה (ב), בית המשפט רשאי לתת סעד זמני או ארעי גם בטרם הגשת כתב תביעה אם שוכנע כי הדבר מוצדק בנסיבות העניין, ובלבד שהתביעה תוגש בתוך שבעה ימים ממועד מתן הצו או בכל מועד אחר שעליו יורה בית המשפט''. מטרת הוראה זו היא לאפשר מתן סעד דחוף במקרים בהם קיים חשש ממשי לסיכול מטרת הסעד אם ימתינו להגשת התביעה. אם הצו ניתן לפני הגשת התביעה והמבקש לא הגיש את התובענה במועד, הצו יפקע (תקנה 100(3) לתקנות סדר הדין האזרחי; רע"א 3935/23 בן ארצי נ'' זובידאת, פסקה 12). מתן סעד זמני במעמד צד אחד, במקרים אלו, מחייב גם הוא התחייבות עצמית וערובה (רע"א 3935/23 בן ארצי נ'' זובידאת, פסקה 9).',
    'הטעות הנפוצה היא לחשוב שסעד זמני תמיד מותנה בהגשת תביעה מוקדמת, או להתעלם מהחובה להגיש את התביעה בתוך 7 ימים לאחר קבלת הסעד הזמני.', '["סעד זמני לפני תביעה", "תקנה 95(ג) לתקסד\"א", "סעד ארעי", "הגשת תביעה במועד", "פקיעת סעד זמני", "דחיפות"]'::jsonb, '**וריאציה 1 — האם ניתן לקבל סעד זמני לפני הגשת תביעה?** ← כן, אם מוצדק בנסיבות, ובתנאי שהתביעה תוגש תוך 7 ימים (תקנה 95(ג)).
**וריאציה 2 — מה קורה אם התביעה לא מוגשת במועד?** ← הצו יפקע (תקנה 100(3)).
**וריאציה 3 — האם נדרשת התחייבות עצמית וערובה גם לסעד ארעי?** ← כן, גם לסעד ארעי שניתן במעמד צד אחד (רע"א 3935/23, פסקה 9).', 'סעד זמני לפני תביעה ← אפשרי (תקנה 95(ג)) ← תביעה תוך 7 ימים ← אחרת יפקע.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 95(ג)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 100(3)", "רע\"א 3935/23 מוטי בן ארצי, עו\"ד - נאמן נ'' הילאלה זובידאת (31.5.2023)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'לא, סעד זמני ניתן רק לאחר הגשת כתב תביעה, שכן הוא נועד להבטיח את ביצוע פסק הדין שיינתן בתביעה העיקרית.', false, 'בחירה זו שגויה. תקנה 95(ג) לתקנות סדר הדין האזרחי מאפשרת מתן סעד זמני או ארעי גם לפני הגשת כתב תביעה, במקרים מוצדקים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'כן, בית המשפט רשאי לתת סעד זמני או ארעי גם בטרם הגשת כתב תביעה, אם שוכנע כי הדבר מוצדק בנסיבות העניין, ובלבד שהתביעה תוגש בתוך שבעה ימים ממועד מתן הצו או במועד אחר שיורה בית המשפט.', true, 'בחירה זו נכונה. תקנה 95(ג) לתקנות סדר הדין האזרחי קובעת במפורש את האפשרות למתן סעד זמני לפני הגשת תביעה, ואת התנאים לכך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אך רק אם מדובר בסעד זמני במעמד צד אחד, ואין צורך להגיש תביעה לאחר מכן.', false, 'בחירה זו שגויה. גם אם הסעד ניתן במעמד צד אחד, חובה להגיש את התביעה העיקרית בתוך 7 ימים או מועד אחר שנקבע, אחרת הצו יפקע.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'כן, אך רק אם ראובן יפקיד ערובה בסכום כפול מסכום התביעה המשוער.', false, 'בחירה זו שגויה. אין דרישה לערובה בסכום כפול, וגובה הערובה נקבע לפי שיקול דעת בית המשפט, בהתאם לנזק שעלול להיגרם.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 15, '2022-S-Q15';
END
$$;

-- ============================================================
-- Q18 — 2022-S-Q18 — chapter=constitutional_intl subtopic=bgz_jurisdiction_revocation  [needs_review]
-- classifier_note: Knesset dissolution + government formation — constitutional law / parliamentary procedure; no clean subtopic. Source review_note flags the same gap
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '4eb8ebc6-91ca-4535-bddb-cd682dcb501d'::uuid;
  v_group_id uuid := 'b9a3b162-89a2-4bf1-860d-e83227477ead'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '425453a1-1197-412b-82be-c9b83599c734'::uuid;
  v_ang_1 uuid := 'd51e1c01-8642-4484-b016-4578616fb027'::uuid;
  v_ang_2 uuid := 'b75db5c3-4ab2-4639-bee9-28e319d623a6'::uuid;
  v_ang_3 uuid := '190049a2-751f-494c-8d11-ec975c5e87ad'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q18';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 18, '2022-S-Q18';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'constitutional_intl';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'constitutional_intl';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'bgz_jurisdiction_revocation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'bgz_jurisdiction_revocation', 'constitutional_intl';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q18', v_chapter_id, v_subtopic_id, 'משלא הצליח חבר הכנסת אברהם להקים ממשלה, ובטרם הטיל נשיא המדינה את מלאכת הרכבת הממשלה על חבר כנסת אחר, הגיש חבר הכנסת לוי הצעת חוק לפיזור הכנסת. חיים סבור כי משלא התהוותה ממשלה מכהנת הצעה זו סותרת את הוראות חוק יסוד: הממשלה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 18}'::jsonb, 'שאלה זו עוסקת בסמכותה של הכנסת לפזר את עצמה, ובפרט במעמדו של חוק לפיזור הכנסת אל מול הליכי הרכבת ממשלה. היא בוחנת את ההוראות הרלוונטיות בחוק-יסוד: הכנסת ובחוק-יסוד: הממשלה, ומדגישה את הסמכות הרחבה של הכנסת להחליט על פיזורה, גם כאשר טרם הוקמה ממשלה חדשה.', 'סעיף 34 לחוק-יסוד: הכנסת קובע כי ''הכנסת רשאית להתפזר לפני גמר כהונתה בדרך של קבלת חוק על התפזרות הכנסת שנתקבל ברוב חברי הכנסת''. חוק זה יכלול הוראה על מועד הבחירות לכנסת שלאחריה, שיהיה לא יאוחר מ-5 חודשים מיום קבלת החוק. הפסיקה קבעה כי סמכות זו של הכנסת לפזר את עצמה היא רחבה וגורפת, ואין כל הגבלה על שיקול דעתה של הכנסת לנסיבות או לעילות פיזור מסוימות. סמכות זו נתונה לכנסת בכל עת, לרבות בעיצומם של הליכים להקמת ממשלה חדשה (בג"ץ 3747/19 עו"ד יצחק אבירם נ'' כנסת ישראל, מיני-רציו). יתרה מכך, סעיף 12 לחוק-יסוד: הממשלה קובע מפורשות כי ''נתקבל חוק על התפזרות הכנסת, ייפסקו ההליכים להרכבת ממשלה''. משמעות הדבר היא שחוק לפיזור הכנסת הוא ''קלף מנצח'' המבטל את הליכי הרכבת הממשלה ומחייב קיום בחירות חדשות. לפיכך, חיים טועה בסברתו, והצעת החוק לפיזור הכנסת חוקתית ותקפה.', 'הטעות הנפוצה היא לחשוב שהליכי הרכבת ממשלה גוברים על סמכות הכנסת לפזר את עצמה, או לבלבל בין פיזור הכנסת באמצעות חוק לבין פיזור אוטומטי עקב אי-קבלת תקציב או הבעת אי-אמון קונסטרוקטיבי.',
    '["פיזור הכנסת", "חוק-יסוד: הכנסת", "חוק-יסוד: הממשלה", "הליכי הרכבת ממשלה", "סמכות חקיקה", "רוב חברי הכנסת", "בחירות חדשות"]'::jsonb, '**וריאציה 1 — האם הכנסת יכולה לפזר את עצמה גם ללא ממשלה מכהנת?** ← כן, סמכותה רחבה וגורפת (סעיף 34 לחוק-יסוד: הכנסת; בג"ץ 3747/19).
**וריאציה 2 — מה קורה להליכי הרכבת ממשלה כשמתקבל חוק לפיזור הכנסת?** ← הם נפסקות (סעיף 12 לחוק-יסוד: הממשלה).
**וריאציה 3 — מהו הרוב הדרוש לחוק לפיזור הכנסת?** ← רוב חברי הכנסת (61 ח"כים) (סעיף 34 לחוק-יסוד: הכנסת).', 'הכנסת רשאית לפזר עצמה בחוק (רוב 61) ← גם ללא ממשלה ← הליכי הרכבה נפסקות ← בחירות תוך 5 חודשים.', '["חוק-יסוד: הכנסת, סעיף 34", "חוק-יסוד: הכנסת, סעיף 35", "חוק-יסוד: הממשלה, סעיף 12", "בג\"ץ 3747/19 עו\"ד יצחק אבירם נ'' כנסת ישראל (18.6.2019)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''חוקתי + בינלאומי פרטי'' subtopic=''ביטול סמכות בג"ץ'' → mapped chapter=''constitutional_intl'' subtopic=''bgz_jurisdiction_revocation'' | classifier_note: Knesset dissolution + government formation — constitutional law / parliamentary procedure; no clean subtopic. Source review_note flags the same gap | source_review_note: הסב-נושא ''ביטול סמכות בג"ץ'' אינו מתאים במדויק לשאלת המקור העוסקת בפיזור הכנסת והרכבת ממשלה. יש לשקול הוספת סב-נושאים רלוונטיים יותר תחת פרק ''חוקתי + בינלאומי פרטי'', כגון ''פיזור הכנסת'' או ''כינון ממשלה''.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'חיים צודק. לפי הוראות חוק יסוד: הכנסת, הכנסת יכולה לפזר את עצמה רק מחמת אי-קבלת חוק התקציב בתוך 3 חודשים מיום תחילת שנת הכספים.', false, 'בחירה זו שגויה. אף שאי-קבלת חוק התקציב היא עילה לפיזור הכנסת (סעיף 36א לחוק-יסוד: הכנסת), זו אינה העילה היחידה. הכנסת רשאית לפזר את עצמה גם בדרך של קבלת חוק על התפזרותה, ללא קשר לעילת התקציב.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'חיים צודק. תקופת כהונתה של הכנסת היא 4 שנים. משכך, ובהיעדר עילה מתאימה לפיזור אוטומטי בחוק, אין הכנסת יכולה לפזר את עצמה.', false, 'בחירה זו שגויה. אף שתקופת כהונת הכנסת היא 4 שנים, חוק-יסוד: הכנסת מאפשר לכנסת לפזר את עצמה לפני תום תקופה זו, גם ללא עילה אוטומטית, באמצעות חוק התפזרות.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'חיים טועה. לכנסת סמכות רחבה לפזר את עצמה עת נתקבל החוק ברוב חברי הכנסת ונקבע בו מועד לבחירות בתוך 5 חודשים מיום קבלת החוק.', true, 'בחירה זו נכונה. סעיף 34 לחוק-יסוד: הכנסת מקנה לכנסת סמכות רחבה לפזר את עצמה בדרך של קבלת חוק על התפזרותה, ברוב חברי הכנסת, ולקבוע מועד לבחירות בתוך 5 חודשים. סעיף 12 לחוק-יסוד: הממשלה קובע כי קבלת חוק כזה מפסיקה את הליכי הרכבת הממשלה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'חיים צודק. בטרם תפזר הכנסת את עצמה, על נשיא המדינה להודיע ליושב ראש הכנסת כי אינו רואה אפשרות להגיע להרכבת ממשלה.', false, 'בחירה זו שגויה. הודעת נשיא המדינה על אי-הצלחה בהרכבת ממשלה מובילה לפיזור אוטומטי של הכנסת (סעיף 11 לחוק-יסוד: הממשלה), אך אינה תנאי מוקדם לסמכות הכנסת לפזר את עצמה באמצעות חוק התפזרות (סעיף 34 לחוק-יסוד: הכנסת).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'פיזור הכנסת עקב אי-קבלת תקציב',
    1, 'הכנסת ה-25 נבחרה ביום 1 בנובמבר 2022. הממשלה הציגה את הצעת חוק התקציב לשנת 2023 ביום 15 במרץ 2023. ביום 1 ביוני 2023, חוק התקציב טרם התקבל. מה הדין?', 'שאלה זו עוסקת באחת העילות לפיזור אוטומטי של הכנסת – אי-קבלת חוק התקציב במועד הקבוע בחוק. היא בוחנת את הוראות סעיף 36א לחוק-יסוד: הכנסת, המפרטות את לוחות הזמנים וההשלכות של אי-עמידה בהם, לרבות קיום בחירות חדשות.', 'סעיף 36א לחוק-יסוד: הכנסת קובע כי אם חוק התקציב לא נתקבל בתוך שלושה חודשים מתחילת שנת הכספים (קרי, עד 31 במרץ), הכנסת תיחשב כאילו החליטה על התפזרותה לפני תום כהונתה, וייערכו בחירות לכנסת בתוך 90 ימים. במקרה הנדון, שנת הכספים 2023 החלה ב-1 בינואר 2023. שלושה חודשים מסתיימים ב-31 במרץ 2023. מכיוון שחוק התקציב לא התקבל עד 1 ביוני 2023, הכנסת נחשבת כמפוזרת אוטומטית ביום 1 באפריל 2023, ועל כן ייערכו בחירות חדשות בתוך 90 ימים ממועד זה. אין אפשרות להאריך את המועד לקבלת חוק התקציב, אלא רק לדחות את מועד הבחירות עצמן במקרים חריגים (למשל, סמיכות ליום חג).',
    'הטעות הנפוצה היא לבלבל בין העילות השונות לפיזור הכנסת, או לחשוב שאי-קבלת תקציב מאפשרת גמישות בהארכת מועדים, בעוד שהחוק קובע פיזור אוטומטי ומועדים קשיחים לבחירות.', '["פיזור הכנסת", "חוק התקציב", "חוק-יסוד: הכנסת", "בחירות אוטומטיות", "לוחות זמנים חוקתיים"]'::jsonb, '**וריאציה 1 — אי-קבלת תקציב עד 31 במרץ?** ← הכנסת מתפזרת אוטומטית ב-1 באפריל (סעיף 36א לחוק-יסוד: הכנסת).
**וריאציה 2 — כמה זמן לבחירות לאחר פיזור אוטומטי?** ← 90 ימים (סעיף 36א לחוק-יסוד: הכנסת).

**וריאציה 3 — האם ניתן לדחות את מועד הבחירות?** ← כן, ברוב של 61 ח"כים, אם המועד סמוך לחג/מועד, עד 100 ימים (סעיף 36א לחוק-יסוד: הכנסת).', 'אי-קבלת תקציב ← פיזור אוטומטי (31 במרץ) ← בחירות תוך 90 ימים.',
    '["חוק-יסוד: הכנסת, סעיף 36א", "חוק הבחירות לכנסת [נוסח משולב], תשכ\"ט-1969, סעיף 39(א)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'הכנסת תתפזר אוטומטית ביום 1 ביוני 2023, וייערכו בחירות חדשות בתוך 90 ימים.', true, 'בחירה זו נכונה. סעיף 36א לחוק-יסוד: הכנסת קובע כי אם חוק התקציב לא התקבל בתוך 3 חודשים מתחילת שנת הכספים (עד 31 במרץ), הכנסת תיחשב כמפוזרת, וייערכו בחירות בתוך 90 ימים. במקרה זה, חוק התקציב לא התקבל עד 31 במרץ, ולכן הכנסת הייתה אמורה להתפזר אוטומטית ביום 1 באפריל, וייערכו בחירות בתוך 90 ימים ממועד זה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'הממשלה תמשיך לכהן כממשלת מעבר, והכנסת תמשיך לפעול עד לכינון ממשלה חדשה.', false, 'בחירה זו שגויה. אי-קבלת חוק התקציב במועד הקבוע בחוק מובילה לפיזור אוטומטי של הכנסת, ולא רק להפיכת הממשלה לממשלת מעבר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'הכנסת רשאית להאריך את המועד לקבלת חוק התקציב ברוב של 61 חברי כנסת.', false, 'בחירה זו שגויה. סעיף 36א לחוק-יסוד: הכנסת אינו מאפשר הארכה של המועד לקבלת חוק התקציב, אלא רק דחייה של מועד הבחירות עצמן במקרים מסוימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'נשיא המדינה יטיל את מלאכת הרכבת הממשלה על חבר כנסת אחר.', false, 'בחירה זו שגויה. אי-קבלת חוק התקציב מובילה לפיזור הכנסת ולבחירות חדשות, ולא להטלת הרכבת ממשלה על חבר כנסת אחר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מגבלות על סמכות הכנסת כרשות מכוננת',
    2, 'הכנסת חוקקה חוק-יסוד חדש הקובע כי נשים לא יוכלו להתמנות לתפקידי שרים בממשלה. האם חוק-יסוד זה חוקתי?', 'שאלה זו עוסקת במגבלות המוטלות על סמכותה המכוננת של הכנסת, ובפרט בדוקטרינת התיקון החוקתי הלא-חוקתי. היא בוחנת את העיקרון לפיו הכנסת, גם בכובעה כרשות מכוננת, אינה רשאית לחוקק חוקי יסוד הפוגעים באופן מהותי בעקרונות היסוד של מדינת ישראל כמדינה יהודית ודמוקרטית, המעוגנים בהכרזת העצמאות.', 'הפסיקה בישראל, ובמיוחד פסק הדין בבג"ץ 5658/23 (בג"ץ עילת הסבירות), קבעה כי סמכותה המכוננת של הכנסת אינה בלתי מוגבלת. הכנסת אינה מוסמכת לחרוג ממתחם הפעולה שהוגדר בהכרזת העצמאות, המהווה את ''כלל ההכרה'' הבסיסי של המדינה. מעשה חקיקה, ואפילו חוק-יסוד, שמתיימר לפרוץ גבולות אלה הוא בגדר חריגה מסמכות ואין לו תוקף משפטי (בג"ץ 5658/23, פסקאות 16-17 לפסק דינו של השופט שטיין). חוק-יסוד המונע מנשים להתמנות לתפקידי שרים פוגע באופן חמור בעקרון השוויון, המהווה נדבך מרכזי באופייה הדמוקרטי של המדינה ומעוגן בהכרזת העצמאות (בג"ץ 5658/23, פסקה 54 לפסק דינו של השופט שטיין). לפיכך, חוק-יסוד כזה אינו חוקתי.',
    'הטעות הנפוצה היא להניח שחוק-יסוד, מעצם מעמדו, חסין מביקורת שיפוטית, או להתעלם מהמגבלות המהותיות הנובעות מהכרזת העצמאות ומאופייה של המדינה כיהודית ודמוקרטית.', '["סמכות מכוננת", "תיקון חוקתי לא חוקתי", "הכרזת העצמאות", "מדינה יהודית ודמוקרטית", "עקרון השוויון", "ביקורת שיפוטית"]'::jsonb, '**וריאציה 1 — האם הכנסת יכולה לחוקק חוק-יסוד שפוגע בשוויון?** ← לא, סמכותה המכוננת מוגבלת על ידי עקרונות היסוד של המדינה כיהודית ודמוקרטית (בג"ץ 5658/23, פסקה 54 לפסק דינו של השופט שטיין).
**וריאציה 2 — מהו מקור המגבלות על הסמכות המכוננת?** ← הכרזת העצמאות ועקרונות היסוד של המדינה (בג"ץ 5658/23, פסקאות 16-17 לפסק דינו של השופט שטיין).
**וריאציה 3 — האם בית המשפט מוסמך לבטל חוק-יסוד?** ← כן, אם הוא חורג מסמכותה המכוננת של הכנסת (בג"ץ 5658/23, פסקה 4 לפסק דינו של השופט שטיין).', 'סמכות מכוננת ← לא בלתי מוגבלת ← כפופה להכרזת העצמאות ← עקרונות יהודית ודמוקרטית ← ביקורת שיפוטית.',
    '["בג\"ץ 5658/23 התנועה למען איכות השלטון בישראל נ'' הכנסת (1.1.2024)", "ע\"א 6821/93 בנק המזרחי המאוחד בע\"מ נ'' מגדל כפר שיתופי, מט(4) 221 (9.11.1995)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כן, שכן הכנסת היא הריבון ומוסמכת לחוקק כל חוק-יסוד שתמצא לנכון, ללא מגבלות מהותיות.', false, 'בחירה זו שגויה. אף שהכנסת היא הריבון, סמכותה כרשות מכוננת אינה בלתי מוגבלת, והיא כפופה לעקרונות יסוד מסוימים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לא, שכן חוק-יסוד זה פוגע בעקרונות היסוד של מדינת ישראל כמדינה יהודית ודמוקרטית, המעוגנים בהכרזת העצמאות, ובפרט בעקרון השוויון.', true, 'בחירה זו נכונה. הפסיקה קבעה כי סמכותה המכוננת של הכנסת מוגבלת ואינה יכולה לפגוע בעקרונות יסוד של מדינת ישראל כמדינה יהודית ודמוקרטית, המעוגנים בהכרזת העצמאות, כגון עקרון השוויון (בג"ץ 5658/23 התנועה למען איכות השלטון בישראל נ'' הכנסת, פסקאות 16-17 לפסק דינו של השופט שטיין).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כן, אלא אם כן חוק-יסוד זה שוריין ברוב מיוחד, שאז ניתן יהיה לבטלו רק ברוב זה.', false, 'בחירה זו שגויה. שריון חוק-יסוד מתייחס לדרך שינויו, ולא מקנה לו חסינות מפני ביקורת שיפוטית על חוקתיותו המהותית אם הוא פוגע בעקרונות יסוד.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לא, שכן חוק-יסוד זה סותר חוקי יסוד קיימים אחרים, כגון חוק-יסוד: כבוד האדם וחירותו.', false, 'בחירה זו שגויה חלקית. אף שחוק-יסוד כזה אכן סותר עקרונות יסוד המעוגנים בחוקי יסוד אחרים, הסיבה העמוקה יותר לחוסר חוקתיותו היא פגיעה בעקרונות היסוד של המדינה כפי שנקבעו בהכרזת העצמאות, שהיא מקור הסמכות המכוננת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'פיזור הכנסת על ידי ראש הממשלה',
    3, 'ראש הממשלה, בהסכמת נשיא המדינה, הוציא צו לפיזור הכנסת, בטענה שקיים בכנסת רוב המתנגד לממשלה, ושעקב כך נמנעת אפשרות לפעולה תקינה של הממשלה. האם צו זה ייכנס לתוקף באופן מיידי?', 'שאלה זו עוסקת בסמכות ראש הממשלה לפזר את הכנסת, כפי שמעוגנת בסעיף 29 לחוק-יסוד: הממשלה. היא בוחנת את התנאים להפעלת סמכות זו, את לוחות הזמנים לכניסת הצו לתוקף, ואת האפשרות של הכנסת לנקוט בצעדים חלופיים במהלך תקופת הביניים.', 'סעיף 29(א) לחוק-יסוד: הממשלה קובע כי ראש הממשלה רשאי, בהסכמת נשיא המדינה, לפזר את הכנסת בצו שיפורסם ברשומות, אם נוכח שקיים בכנסת רוב המתנגד לממשלה ושעקב כך נמנעת אפשרות לפעולה תקינה של הממשלה. הצו אינו נכנס לתוקף באופן מיידי, אלא ''ייכנס לתוקפו 21 ימים אחרי יום פרסומו''. במהלך 21 הימים הללו, רוב חברי הכנסת רשאים לבקש בכתב מנשיא המדינה להטיל על חבר כנסת אחר להרכיב ממשלה (סעיף 29(ב) לחוק-יסוד: הממשלה). אם בקשה כזו מוגשת, הליכי הפיזור יכולים להיעצר, ומתחילים הליכים להרכבת ממשלה חלופית.',
    'הטעות הנפוצה היא לחשוב שצו פיזור הכנסת על ידי ראש הממשלה נכנס לתוקף מיד, או לבלבל בין סמכות זו לבין פיזור הכנסת באמצעות חוק התפזרות.', '["פיזור הכנסת", "ראש הממשלה", "חוק-יסוד: הממשלה", "צו פיזור", "לוחות זמנים חוקתיים", "הליכי הרכבת ממשלה"]'::jsonb, '**וריאציה 1 — מתי צו פיזור של רה"מ נכנס לתוקף?** ← 21 ימים לאחר פרסומו ברשומות (סעיף 29(א) לחוק-יסוד: הממשלה).
**וריאציה 2 — מה יכולה הכנסת לעשות ב-21 הימים?** ← רוב חברי הכנסת יכולים לבקש מנשיא המדינה להטיל את הרכבת הממשלה על ח"כ אחר (סעיף 29(ב) לחוק-יסוד: הממשלה).
**וריאציה 3 — מהם התנאים לפיזור הכנסת על ידי רה"מ?** ← רוב מתנגד לממשלה המונע פעולה תקינה, בהסכמת נשיא המדינה (סעיף 29(א) לחוק-יסוד: הממשלה).', 'פיזור ע"י רה"מ ← צו נכנס לתוקף לאחר 21 ימים ← אפשרות להרכבת ממשלה חלופית בתקופה זו.',
    '["חוק-יסוד: הממשלה, סעיף 29", "ה\"ש 1/04 ח\"כ דליה איציק נ'' יושבת-ראש ועדת הבחירות המרכזית (3.3.2004)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, הצו נכנס לתוקף מיד עם פרסומו ברשומות.', false, 'בחירה זו שגויה. סעיף 29(א) לחוק-יסוד: הממשלה קובע כי הצו ייכנס לתוקפו 21 ימים לאחר פרסומו, ולא באופן מיידי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, הצו ייכנס לתוקפו 21 ימים לאחר פרסומו ברשומות, ובמהלך תקופה זו יכולים חברי הכנסת לנקוט בצעדים למניעת הפיזור.', true, 'בחירה זו נכונה. סעיף 29(א) לחוק-יסוד: הממשלה קובע כי צו פיזור הכנסת על ידי ראש הממשלה ייכנס לתוקפו 21 ימים לאחר פרסומו. סעיף 29(ב) מאפשר לרוב חברי הכנסת לבקש מנשיא המדינה להטיל את התפקיד להרכיב ממשלה על חבר כנסת אחר בתוך תקופה זו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אלא אם כן רוב חברי הכנסת יביעו אי-אמון בממשלה בתוך 48 שעות.', false, 'בחירה זו שגויה. הבעת אי-אמון היא הליך נפרד, ואינה משפיעה על מועד כניסת הצו לתוקף. בנוסף, אין הוראה בחוק המגבילה את הזמן ל-48 שעות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, הצו טעון אישור של ועדת הכנסת ברוב של שני שלישים מחבריה.', false, 'בחירה זו שגויה. צו פיזור הכנסת על ידי ראש הממשלה אינו טעון אישור של ועדת הכנסת, אלא רק הסכמת נשיא המדינה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'השלכות פיזור הכנסת על ממשלת מעבר',
    4, 'הכנסת התפזרה ביום 1 במאי 2026, ונקבע מועד לבחירות חדשות. הממשלה המכהנת ממשיכה לכהן כממשלת מעבר. האם ממשלת המעבר רשאית למנות שר חדש במקום שר שהתפטר?', 'שאלה זו עוסקת במעמדה ובסמכויותיה של ממשלת מעבר לאחר פיזור הכנסת. היא בוחנת את הוראות סעיף 30 לחוק-יסוד: הממשלה, המאפשרות לממשלת מעבר להמשיך במילוי תפקידיה, לרבות מינוי שרים חדשים, תוך שמירה על עקרון הרציפות השלטונית.', 'סעיף 30(ב) לחוק-יסוד: הממשלה קובע כי עם בחירת כנסת חדשה או התפטרות הממשלה, הממשלה היוצאת תמשיך במילוי תפקידיה עד שתיכון הממשלה החדשה, והיא מכונה ''ממשלת מעבר''. סעיף 30(ד) לחוק-יסוד: הממשלה (תיקון מס'' 9, תש"ף-2020) קובע במפורש כי ''ממשלה המכהנת לפי סעיף קטן (ב), רשאית למנות חבר הכנסת להיות שר בתפקידו של שר שחדל לכהן; מינויו של שר לפי סעיף קטן זה אינו טעון אישור הכנסת''. הוראה זו נועדה לאפשר לממשלת מעבר לתפקד באופן סביר גם בתקופת ביניים, תוך שמירה על עקרון הרציפות השלטונית, אך עדיין מצופה ממנה לפעול באיפוק ובריסון (בג"ץ 2144/20 התנועה למען איכות השלטון בישראל נ'' יושב ראש הכנסת, פסקה 9).',
    'הטעות הנפוצה היא להניח שממשלת מעבר מוגבלת לחלוטין מביצוע פעולות, או לבלבל בין מינוי שר בממשלת מעבר לבין מינוי שר בממשלה קבועה, הטעון אישור הכנסת.', '["ממשלת מעבר", "פיזור הכנסת", "חוק-יסוד: הממשלה", "מינוי שרים", "עקרון הרציפות השלטונית", "איפוק וריסון"]'::jsonb, '**וריאציה 1 — האם ממשלת מעבר יכולה למנות שר?** ← כן, במקום שר שחדל לכהן (סעיף 30(ד) לחוק-יסוד: הממשלה).
**וריאציה 2 — האם מינוי שר בממשלת מעבר טעון אישור הכנסת?** ← לא (סעיף 30(ד) לחוק-יסוד: הממשלה).
**וריאציה 3 — מהו עקרון הפעולה של ממשלת מעבר?** ← איפוק ובריסון (בג"ץ 2144/20, פסקה 9).', 'ממשלת מעבר ← רשאית למנות שר ← ללא אישור הכנסת ← פועלת באיפוק.',
    '["חוק-יסוד: הממשלה, סעיף 30", "חוק-יסוד: הכנסת, סעיף 42ג", "בג\"ץ 2144/20 התנועה למען איכות השלטון בישראל נ'' יושב ראש הכנסת (23.3.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, ממשלת מעבר רשאית למנות שר חדש, אך מינוי זה טעון אישור הכנסת.', false, 'בחירה זו שגויה. ממשלת מעבר רשאית למנות שר חדש, אך מינוי זה אינו טעון אישור הכנסת.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, ממשלת מעבר אינה רשאית למנות שרים חדשים, שכן היא פועלת באיפוק ובריסון.', false, 'בחירה זו שגויה. אף שממשלת מעבר פועלת באיפוק, סעיף 30(ד) לחוק-יסוד: הממשלה מאפשר לה למנות שר חדש במקום שר שחדל לכהן.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, ממשלת מעבר רשאית למנות שר חדש, ומינוי זה אינו טעון אישור הכנסת.', true, 'בחירה זו נכונה. סעיף 30(ד) לחוק-יסוד: הממשלה קובע כי ממשלה המכהנת כממשלת מעבר רשאית למנות חבר כנסת להיות שר בתפקידו של שר שחדל לכהן, ומינוי זה אינו טעון אישור הכנסת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, אלא אם כן המינוי אושר על ידי נשיא המדינה.', false, 'בחירה זו שגויה. מינוי שר בממשלת מעבר אינו טעון אישור נשיא המדינה, אלא מתבצע על ידי הממשלה עצמה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 18, '2022-S-Q18';
END
$$;

-- ============================================================
-- Q19 — 2022-S-Q19 — chapter=civil_proc subtopic=third_party_notice
-- classifier_note: Third-party defendant (Levi) wishing to file counter-claim against the originating co-defendant (Shimon)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '4004c4f0-e754-4054-a32a-c6e753967a30'::uuid;
  v_group_id uuid := '80a07767-b137-4d3b-be8a-7a89761dc6ab'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '7ef761e4-f80b-406a-9021-1b32bcb1ce6d'::uuid;
  v_ang_1 uuid := '01d41f55-1570-4508-a04a-b2d7ca4a9449'::uuid;
  v_ang_2 uuid := '5a5560f6-1fca-4870-b1d2-cdd114720275'::uuid;
  v_ang_3 uuid := 'dbcd1e1b-9d82-4748-837e-5a43d1380ac4'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q19';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 19, '2022-S-Q19';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'third_party_notice' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'third_party_notice', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q19', v_chapter_id, v_subtopic_id, 'ראובן הגיש נגד שמעון תביעה בהליך בסדר דין רגיל. שמעון הגיש כתב הגנה ושלח הודעת צד ג'' ללוי. לוי מעוניין להגיש תביעה שכנגד נגד שמעון. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 19}'::jsonb, 'שאלה זו עוסקת בהבחנה מהותית בין תביעה שכנגד לבין הודעה לצד שלישי, ובפרט במגבלות החלות על צד שלישי המבקש להגיש תביעה שכנגד. היא מתמקדת בהוראת תקנה 23(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, הקובעת במפורש כי צד שלישי אינו רשאי להגיש תביעה שכנגד, ובכך מבדילה את מעמדו הדיוני ממעמד של נתבע ''רגיל''.', 'תקנה 23(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי ''דין צד שלישי שהומצאה לו הודעה, כדין נתבע לכל דבר ועניין, ואולם הוא אינו רשאי להגיש תביעה שכנגד''. הוראה זו מהווה חידוש משמעותי לעומת המצב ששרר תחת תקנות סדר הדין האזרחי, תשמ"ד-1984, שם לא הייתה הגבלה מפורשת כזו, והפסיקה הייתה חלוקה (ת"א (שלום ת"א) 51934-07-18 נציגות הבית המשותף רחוב מאיר דנקנר 3 פתח תקווה נ'' נהור בע"מ, מיני-רציו; יעקב שקד, סדר הדין האזרחי (2026), עמ'' 62). מטרת ההגבלה היא למנוע סרבול של ההליך העיקרי, שכן תביעה שכנגד היא תביעה עצמאית שאינה תלויה בתביעה המקורית, ואילו הודעת צד שלישי היא ''תביעה על תנאי'' התלויה בתוצאות התביעה העיקרית (יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025), עמ'' 91). לפיכך, לוי, כצד שלישי, אינו רשאי להגיש תביעה שכנגד נגד שמעון.', 'הטעות הנפוצה היא לבלבל בין זכויותיו הדיוניות של נתבע רגיל (הכוללות הגשת תביעה שכנגד) לבין זכויותיו המוגבלות של צד שלישי, או להתעלם מהשינוי המפורש שחל בתקנות סדר הדין האזרחי החדשות בעניין זה.',
    '["הודעה לצד שלישי", "תביעה שכנגד", "תקנה 23(ג) לתקסד\"א", "נתבע", "צד שלישי", "תביעה על תנאי", "סרבול הליך"]'::jsonb, '**וריאציה 1 — האם צד שלישי יכול להגיש תביעה שכנגד?** ← לא, תקנה 23(ג) לתקסד"א אוסרת זאת במפורש (ת"א (שלום ת"א) 51934-07-18, מיני-רציו).
**וריאציה 2 — מה ההבדל בין צד שלישי לנתבע רגיל לעניין תביעה שכנגד?** ← נתבע רגיל רשאי להגיש תביעה שכנגד (תקנה 21 לתקסד"א), צד שלישי אינו רשאי (תקנה 23(ג) לתקסד"א).
**וריאציה 3 — מהי הסיבה לאיסור על צד שלישי להגיש תביעה שכנגד?** ← למנוע סרבול של ההליך העיקרי, שכן תביעה שכנגד היא עצמאית והודעת צד שלישי היא תביעה על תנאי (רוזן-צבי, עמ'' 91).', 'צד שלישי ← אינו רשאי להגיש תביעה שכנגד ← לפי תקנה 23(ג) לתקסד"א ← בניגוד לנתבע רגיל.', '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 23", "ת\"א (שלום ת\"א) 51934-07-18 נציגות הבית המשותף רחוב מאיר דנקנר 3 פתח תקווה נ'' נהור בע\"מ (4.7.2019)", "יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ג כתבי הטענות", "יעקב שקד, סדר הדין האזרחי (2026) | פרק ג פתיחת ההליך"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''third_party_notice'' | classifier_note: Third-party defendant (Levi) wishing to file counter-claim against the originating co-defendant (Shimon)', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'לוי רשאי להגיש תביעה שכנגד אך ורק נגד בעלי הדין בתביעה המקורית.', false, 'בחירה זו שגויה. הכלל הוא שצד שלישי אינו רשאי להגיש תביעה שכנגד כלל, ללא קשר לזהות הנתבעים בתביעה שכנגד.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לוי רשאי להגיש תביעה שכנגד אך ורק אם נושאה ונושא ההודעה הם אחד או שהן נובעות מאותן הנסיבות.', false, 'בחירה זו שגויה. אף שקשר ענייני בין התביעות הוא תנאי לתביעה שכנגד במקרים מסוימים (כמו בסדר דין מהיר), הכלל המכריע הוא שצד שלישי אינו רשאי להגיש תביעה שכנגד כלל.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'לוי אינו רשאי להגיש תביעה שכנגד.', true, 'בחירה זו נכונה. תקנה 23(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי צד שלישי אינו רשאי להגיש תביעה שכנגד.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לוי רשאי להגיש תביעה שכנגד אם ניתנה לכך רשות בית המשפט.', false, 'בחירה זו שגויה. תקנה 23(ג) קובעת איסור מוחלט על הגשת תביעה שכנגד על ידי צד שלישי, ואינה מאפשרת לבית המשפט ליתן רשות לכך.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'תביעה שכנגד של נתבע רגיל',
    1, 'דני הגיש תביעה נגד יוסי בגין הפרת חוזה. יוסי סבור כי דני חייב לו כסף בגין שירותים שסיפק לו בעבר, שאינם קשורים להפרת החוזה הנטענת. יוסי מעוניין להגיש תביעה שכנגד נגד דני. מה הדין?', 'שאלה זו עוסקת בתנאים להגשת תביעה שכנגד על ידי נתבע ''רגיל'' (שאינו צד שלישי). היא בוחנת את הוראות תקנה 21 לתקנות סדר הדין האזרחי, תשע"ט-2018, המאפשרות לנתבע להגיש תביעה שכנגד נגד התובע, ומבהירה כי אין דרישה לקשר ענייני בין עילות התביעה המקורית והתביעה שכנגד.', 'תקנה 21(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''נתבע רשאי להגיש תביעה שכנגד עם הגשת כתב ההגנה''. תקנה 21(ב) מבהירה כי ''דין תביעה שכנגד כדין כתב תביעה לכל דבר ועניין והיא אינה תלויה בהמשך קיומה של התביעה העיקרית''. בניגוד למצב שהיה קיים לעיתים בתקנות הישנות, התקנות החדשות אינן דורשות קשר ענייני בין עילת התביעה המקורית לעילת התביעה שכנגד (יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025), עמ'' 85). מטרת התביעה שכנגד היא למנוע ריבוי הליכים בין אותם בעלי דין ולאפשר בירור מכלול המחלוקות ביניהם במסגרת הליך אחד.',
    'הטעות הנפוצה היא לחשוב שקיימת דרישה לקשר ענייני בין התביעה המקורית לתביעה שכנגד, בדומה לדרישות שהיו קיימות בעבר או שקיימות בהליכים ספציפיים (כמו סדר דין מהיר).', '["תביעה שכנגד", "נתבע", "תקנה 21 לתקסד\"א", "קשר ענייני", "עצמאות התביעה שכנגד", "ריבוי הליכים"]'::jsonb, '**וריאציה 1 — נתבע רוצה לתבוע את התובע?** ← יכול להגיש תביעה שכנגד עם כתב ההגנה (תקנה 21(א) לתקסד"א).
**וריאציה 2 — האם התביעה שכנגד חייבת להיות קשורה לתביעה המקורית?** ← לא, אין דרישה לקשר ענייני (תקנה 21(ב) לתקסד"א; רוזן-צבי, עמ'' 85).
**וריאציה 3 — מה קורה לתביעה שכנגד אם התביעה המקורית נדחית?** ← התביעה שכנגד ממשיכה להתברר באופן עצמאי (תקנה 21(ב) לתקסד"א; רוזן-צבי, עמ'' 91).', 'נתבע רגיל ← תביעה שכנגד ← עם כתב הגנה ← ללא קשר ענייני ← תביעה עצמאית.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 21", "יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ג כתבי הטענות"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'יוסי רשאי להגיש תביעה שכנגד נגד דני, ואין צורך שעילת התביעה שכנגד תהיה קשורה לעילת התביעה המקורית.', true, 'בחירה זו נכונה. תקנה 21(א) ו-(ב) לתקנות סדר הדין האזרחי, תשע"ט-2018, מאפשרת לנתבע להגיש תביעה שכנגד נגד התובע, ואין דרישה לקשר ענייני בין עילות התביעה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'יוסי רשאי להגיש תביעה שכנגד רק אם עילתה קשורה באופן הדוק לעילת התביעה המקורית.', false, 'בחירה זו שגויה. בניגוד למצב שהיה קיים לעיתים בתקנות הישנות, התקנות החדשות אינן דורשות קשר ענייני בין התביעה המקורית לתביעה שכנגד, למעט חריגים ספציפיים כמו בסדר דין מהיר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'יוסי אינו רשאי להגיש תביעה שכנגד, אלא עליו להגיש תביעה נפרדת.', false, 'בחירה זו שגויה. נתבע רגיל רשאי להגיש תביעה שכנגד, וזו אחת המטרות של הליך זה – לרכז דיונים בין אותם צדדים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'יוסי רשאי להגיש תביעה שכנגד רק אם קיבל לכך רשות מבית המשפט.', false, 'בחירה זו שגויה. נתבע רשאי להגיש תביעה שכנגד עם הגשת כתב ההגנה ללא צורך בקבלת רשות מבית המשפט, אלא אם כן מדובר בהגשה מאוחרת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תכליות הודעת צד שלישי',
    2, 'מהן התכליות העיקריות של הגשת הודעה לצד שלישי בהליך אזרחי?', 'שאלה זו עוסקת בתכליות העומדות בבסיס מוסד ההודעה לצד שלישי בסדר הדין האזרחי. היא מדגישה את שני העקרונות המרכזיים שהפסיקה והספרות המשפטית מייחסות להליך זה: יעילות דיונית ומניעת הכרעות סותרות, המגנים על הנתבע מפני מצב של ''קירח מכאן ומכאן''.', 'הפסיקה והספרות המשפטית קובעות כי להליך של שליחת הודעה לצד שלישי שתי תכליות עיקריות: יעילות ומניעת הכרעות סותרות. תכלית היעילות מתבטאת בריכוז כל ההליכים המשפטיים הקשורים לעניין אחד בתובענה יחידה, ובכך נחסך הצורך בניהול הליכים נפרדים ודומים (רע"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע"מ נ'' נתלי רום שושני, פסקה 5; רע"א 3017/24 מדינת ישראל נ'' ד"ר שלמה נס, פסקה 16). תכלית מניעת הכרעות סותרות נועדה להגן על הנתבע מפני הסיכון שייקבע כי הוא חייב כלפי התובע, אך בהליך נפרד נגד הצד השלישי ייקבע כי הצד השלישי אינו חייב לו שיפוי או השתתפות, ובכך הנתבע ''ייצא קירח מכאן ומכאן'' (רע"א 10714342 אביטל פרדו נ'' גיבוי אחזקות בע"מ, פסקה 13; רע"א 5635/13 קורל-תל בע"מ נ'' אביהוא רז, פסקה 17).',
    'הטעות הנפוצה היא לבלבל בין תכליות הודעת צד שלישי לבין תכליות תביעה שכנגד, או לייחס להודעת צד שלישי תכליות שאינן קשורות ישירות לריכוז הדיון ומניעת הכרעות סותרות.', '["הודעה לצד שלישי", "יעילות דיונית", "מניעת הכרעות סותרות", "תביעה על תנאי", "שיפוי", "השתתפות"]'::jsonb, '**וריאציה 1 — מהן התכליות העיקריות של הודעת צד שלישי?** ← יעילות דיונית ומניעת הכרעות סותרות (רע"א 13698-10-24, פסקה 5; רע"א 10714342, פסקה 13).
**וריאציה 2 — מהו היתרון לנתבע בהגשת הודעת צד שלישי?** ← מניעת מצב של ''קירח מכאן ומכאן'' (רע"א 6406065, פסקה 11).
**וריאציה 3 — האם הודעת צד שלישי היא תביעה עצמאית?** ← לא, היא ''תביעה על תנאי'' התלויה בתביעה העיקרית (רע"א 5635/13, פסקה 16).', 'הודעת צד שלישי ← יעילות + מניעת הכרעות סותרות ← הגנה על הנתבע.',
    '["רע\"א 13698-10-24 רמי שבירו הנדסה בניה והשקעות בע\"מ נ'' נתלי רום שושני (26.6.2025)", "רע\"א 3017/24 מדינת ישראל נ'' ד\"ר שלמה נס, ורו\"ח ומר אלי שפלר, רו\"ח מפרקי חברת אגרקסקו (12.8.2024)", "רע\"א 10714342 אביטל פרדו נ'' גיבוי אחזקות בע\"מ (18.12.2025)", "רע\"א 5635/13 קורל-תל בע\"מ נ'' אביהוא רז (1.4.2015)", "יששכר רוזן-צבי, הרפורמה בסדר הדין האזרחי: מורה נבוכים (2025) | פרק ג כתבי הטענות"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'למנוע הכרעות סותרות ולחסוך במשאבים שיפוטיים.', true, 'בחירה זו נכונה. הפסיקה והספרות המשפטית קובעות כי אלו הן שתי התכליות העיקריות של הודעת צד שלישי: יעילות דיונית ומניעת מצב שבו הנתבע ''ייצא קירח מכאן ומכאן''.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לאפשר לצד שלישי להגיש תביעה שכנגד נגד הנתבע ולייעל את ההליך.', false, 'בחירה זו שגויה. צד שלישי אינו רשאי להגיש תביעה שכנגד נגד הנתבע (שולח ההודעה), ולכן זו אינה תכלית של ההליך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'להרחיב את גדר המחלוקת ולצרף כמה שיותר צדדים להליך.', false, 'בחירה זו שגויה. אף שהודעת צד שלישי מצרפת צד נוסף, מטרתה אינה הרחבת גדר המחלוקת לשם הרחבה, אלא ריכוז המחלוקות הקשורות לתביעה העיקרית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לאפשר לנתבע לדחות את מועד הגשת כתב ההגנה שלו.', false, 'בחירה זו שגויה. הגשת הודעת צד שלישי אינה דוחה את מועד הגשת כתב ההגנה של הנתבע, אלא מוגשת לרוב יחד איתו.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הגבלות על תביעה שכנגד והודעת צד שלישי',
    3, 'שוכר דירה הגיש תביעה לפינוי מושכר נגד שוכר המשנה שלו. שוכר המשנה מעוניין להגיש תביעה שכנגד בגין ליקויים במושכר, וכן לשלוח הודעת צד שלישי לבעל הדירה המקורי. מה הדין?', 'שאלה זו עוסקת בחריגים לזכות הנתבע להגיש תביעה שכנגד או הודעה לצד שלישי, ובפרט בתביעות לפינוי מושכר. היא בוחנת את הוראת תקנה 81(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, המגבילה את הנתבע בהליכים אלו, במטרה לייעל ולזרז את הדיון בתביעות פינוי.', 'תקנה 81(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי ''נתבע בתביעה לפינוי מושכר אינו רשאי להגיש תביעה שכנגד או הודעה לצד שלישי''. הגבלה זו נועדה לייעל את הדיון בתביעות פינוי מושכר, שהן הליכים מהירים במהותם, ולמנוע סרבול והתמשכות הליכים על ידי צירוף סעדים או צדדים נוספים. סעיף 81(א) אף קובע כי תביעה לפינוי מושכר לא תכיל סעדים נוספים, וכי התובע רשאי לתבוע סעדים נוספים בהליך נפרד. המטרה היא להפריד את הדיון בשאלת הפינוי משאלות אחרות, גם אם הן קשורות למושכר.',
    'הטעות הנפוצה היא להניח שזכויות דיוניות כמו הגשת תביעה שכנגד או הודעת צד שלישי הן אוניברסליות ואינן מוגבלות בהליכים ספציפיים, מבלי לשים לב לחריגים המפורשים בחוק.', '["תביעה לפינוי מושכר", "תביעה שכנגד", "הודעה לצד שלישי", "תקנה 81(ג) לתקסד\"א", "הליכים מהירים", "ייעול הליכים"]'::jsonb, '**וריאציה 1 — האם נתבע בפינוי מושכר יכול להגיש תביעה שכנגד?** ← לא (תקנה 81(ג) לתקסד"א).
**וריאציה 2 — האם נתבע בפינוי מושכר יכול לשלוח הודעת צד שלישי?** ← לא (תקנה 81(ג) לתקסד"א).
**וריאציה 3 — מהי מטרת ההגבלה בתביעות פינוי מושכר?** ← לייעל ולזרז את הדיון בשאלת הפינוי (תקנה 81(א) לתקסד"א).', 'תביעה לפינוי מושכר ← אין תביעה שכנגד ← אין הודעת צד שלישי ← ייעול הליך.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 81"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'שוכר המשנה רשאי להגיש תביעה שכנגד והודעת צד שלישי, שכן אלו זכויות דיוניות בסיסיות של נתבע.', false, 'בחירה זו שגויה. בתביעה לפינוי מושכר קיימת הגבלה מפורשת על הגשת תביעה שכנגד והודעת צד שלישי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'שוכר המשנה אינו רשאי להגיש תביעה שכנגד או הודעה לצד שלישי בתביעה לפינוי מושכר.', true, 'בחירה זו נכונה. תקנה 81(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת במפורש כי נתבע בתביעה לפינוי מושכר אינו רשאי להגיש תביעה שכנגד או הודעה לצד שלישי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'שוכר המשנה רשאי להגיש תביעה שכנגד, אך לא הודעת צד שלישי.', false, 'בחירה זו שגויה. תקנה 81(ג) אוסרת על שתי הפעולות – הגשת תביעה שכנגד והגשת הודעת צד שלישי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'שוכר המשנה רשאי להגיש הודעת צד שלישי, אך לא תביעה שכנגד.', false, 'בחירה זו שגויה. תקנה 81(ג) אוסרת על שתי הפעולות – הגשת תביעה שכנגד והגשת הודעת צד שלישי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סילוק הודעת צד שלישי על הסף',
    4, 'נתבע הגיש הודעה לצד שלישי נגד גורם מסוים. הצד השלישי טוען כי יש לסלק את ההודעה על הסף, שכן היא הוגשה באיחור ניכר וללא תשלום אגרה. מה הדין?', 'שאלה זו עוסקת בסוגיית סילוק על הסף של הודעה לצד שלישי. היא בוחנת את הגישה המצמצמת של בתי המשפט לסעד דרסטי זה, ואת העקרונות המנחים אותם, כגון הצורך בבירור ממצה של המחלוקות, מניעת הכרעות סותרות ויעילות דיונית, גם כאשר קיימים פגמים דיוניים בהגשת ההודעה.', 'הפסיקה קובעת כי סילוק על הסף של הודעה לצד שלישי הוא סעד דרסטי, שיינתן רק במקרים חריגים, בדומה לסילוק תביעה על הסף (ת"א (מחוזי ת"א) 21993-08-23 גיבוי אחזקות בע"מ נ'' אריאל פרדו, מיני-רציו). זאת, משום שהודעה לצד שלישי היא ''תביעה על תנאי'' שנועדה למנוע הכרעות סותרות ולייעל את ההליך (רע"א 10714342 אביטל פרדו נ'' גיבוי אחזקות בע"מ, פסקה 13). גם כאשר קיימים פגמים דיוניים כמו איחור בהגשה או אי-תשלום אגרה, בתי המשפט נוטים לאפשר את בירור ההודעה לגופה, במיוחד בשלבים דיוניים מוקדמים, כדי שהמחלוקות בין הצדדים תלובנה באופן ממצה (ת"א (מחוזי ת"א) 2626-02-21 ארז זינו נ'' דוד אשד, מיני-רציו).',
    'הטעות הנפוצה היא להשוות את סילוק הודעת צד שלישי על הסף לסילוק תביעה רגילה על הסף, מבלי להבין את הגישה המצמצמת יותר של בתי המשפט כלפי הודעות צד שלישי, בשל תכליותיהן הייחודיות.', '["סילוק על הסף", "הודעה לצד שלישי", "תביעה על תנאי", "יעילות דיונית", "מניעת הכרעות סותרות", "פגמים דיוניים"]'::jsonb, '**וריאציה 1 — האם הודעת צד שלישי תסולק על הסף בקלות?** ← לא, רק במקרים חריגים, בדומה לסילוק תביעה (ת"א (מחוזי ת"א) 21993-08-23, מיני-רציו).
**וריאציה 2 — מהם השיקולים נגד סילוק על הסף של הודעת צד שלישי?** ← הצורך בבירור ממצה של המחלוקות ומניעת הכרעות סותרות (ת"א (מחוזי ת"א) 2626-02-21, מיני-רציו).
**וריאציה 3 — האם איחור בהגשה או אי-תשלום אגרה יגרמו לסילוק על הסף?** ← לרוב לא, בית המשפט יעדיף לאפשר תיקון ובירור לגופו של עניין (ת"א (מחוזי ת"א) 2626-02-21, מיני-רציו).', 'סילוק הודעת צד שלישי ← סעד דרסטי וחריג ← בירור ממצה + מניעת הכרעות סותרות.',
    '["ת\"א (מחוזי תל אביב-יפו) 21993-08-23 גיבוי אחזקות בע\"מ נ'' אריאל פרדו (26.7.2025)", "רע\"א 10714342 אביטל פרדו נ'' גיבוי אחזקות בע\"מ (18.12.2025)", "ת\"א (מחוזי ת\"א) 2626-02-21 ארז זינו נ'' דוד אשד (23.8.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'בית המשפט יסלק את ההודעה על הסף, שכן איחור בהגשה ואי-תשלום אגרה הם פגמים מהותיים המצדיקים סילוק על הסף.', false, 'בחירה זו שגויה. אף שאלו פגמים, הפסיקה נוטה שלא לסלק הודעת צד שלישי על הסף אלא במקרים חריגים, במיוחד אם הדבר יפגע בתכליות ההודעה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'בית המשפט ידחה את הבקשה לסילוק על הסף, שכן סילוק הודעה לצד שלישי על הסף ייעשה רק במקרים חריגים, בדומה לסילוק תביעה על הסף, וזאת כדי לאפשר בירור ממצה של המחלוקות.', true, 'בחירה זו נכונה. הפסיקה קובעת כי סילוק על הסף של הודעה לצד שלישי הוא סעד דרסטי שיינתן רק במקרים חריגים, בדומה לסילוק תביעה, וזאת כדי לאפשר בירור מכלול המחלוקות ולמנוע הכרעות סותרות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'בית המשפט יסלק את ההודעה על הסף, אך יאפשר לנתבע להגיש תביעה נפרדת נגד הצד השלישי.', false, 'בחירה זו שגויה. אף שזו אפשרות חלופית, סילוק על הסף של הודעת צד שלישי פוגע בתכליות ההליך, ולכן בית המשפט יעדיף לרוב לא לסלק על הסף אם ניתן לתקן את הפגמים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'בית המשפט יורה על תשלום האגרה ועל הגשת ההודעה במועד, אך לא יסלק על הסף.', false, 'בחירה זו שגויה. אף שבית המשפט יכול להורות על תיקון פגמים, התשובה הנכונה מתייחסת לגישה הכללית של בתי המשפט כלפי סילוק על הסף של הודעות צד שלישי, שהיא גישה מצמצמת.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 19, '2022-S-Q19';
END
$$;

-- ============================================================
-- Q21 — 2022-S-Q21 — chapter=constitutional_intl subtopic=bgz_jurisdiction_revocation  [needs_review]
-- classifier_note: Deputy minister conviction — when does tenure end. Constitutional law gap (no minister-tenure subtopic)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '827f1bba-f1aa-476d-990d-32b46f7ec3d7'::uuid;
  v_group_id uuid := 'd9d73184-442f-435f-b106-a60e431e0408'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '452db31e-a87f-4577-bc7f-62c59d19dc73'::uuid;
  v_ang_1 uuid := '8c48ff95-80bf-4078-b7df-007466716f85'::uuid;
  v_ang_2 uuid := 'be71c9e8-9575-46e0-93a5-70e34ce6177f'::uuid;
  v_ang_3 uuid := '7f5b81d0-caba-4a61-9a77-ff1fa9b2517b'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q21';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 21, '2022-S-Q21';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'constitutional_intl';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'constitutional_intl';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'bgz_jurisdiction_revocation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'bgz_jurisdiction_revocation', 'constitutional_intl';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q21', v_chapter_id, v_subtopic_id, 'בית המשפט המחוזי בירושלים הרשיע בפסק דינו סגן שר בעבירה שיש עימה קלון. מתי תיפסק כהונתו של סגן השר?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 21}'::jsonb, 'שאלה זו עוסקת בהפסקת כהונתו של סגן שר שהורשע בעבירה שיש עמה קלון. היא בוחנת את הוראות סעיף 27 לחוק-יסוד: הממשלה, הקובעות מנגנון ''גיליוטינה'' להפסקת כהונה מיידית ואוטומטית ביום מתן פסק הדין, ללא צורך בהליכים נוספים או בהמתנה להפיכת פסק הדין לחלוט.', 'סעיף 27 לחוק-יסוד: הממשלה קובע במפורש כי ''בית המשפט שהרשיע סגן שר בעבירה יקבע בפסק דינו אם יש באותה עבירה משום קלון; קבע בית המשפט כאמור, תיפסק כהונתו של סגן השר ביום מתן פסק הדין''. הוראה זו מורה על הפסקת כהונה אוטומטית, ללא כל סייג או שיקול דעת לבעל סמכות כלשהו, ברגע שבית המשפט קובע כי בעבירה שבה הורשע סגן השר יש משום קלון. אין צורך בהמתנה להפיכת פסק הדין לחלוט, ואין צורך בהחלטה נוספת של הכנסת או של ראש הממשלה. מדובר במנגנון ''גיליוטינה'' שנועד לשמור על טוהר המידות בשירות הציבורי (בג"ץ 3997/14 התנועה למען איכות השלטון בישראל נ'' שר החוץ, פסקה 22).', 'הטעות הנפוצה היא לבלבל בין הפסקת כהונה אוטומטית של סגן שר (או שר) לבין הליכים אחרים, כגון הפסקת חברות בכנסת (הדורשת פסק דין סופי) או הפסקת כהונת ראש ממשלה (הדורשת הליך בכנסת).',
    '["קלון", "סגן שר", "הפסקת כהונה", "חוק-יסוד: הממשלה", "אוטומטיות", "טוהר המידות"]'::jsonb, '**וריאציה 1 — מתי תיפסק כהונת סגן שר שהורשע בקלון?** ← ביום מתן פסק הדין (סעיף 27 לחוק-יסוד: הממשלה).
**וריאציה 2 — האם נדרשת פעולה נוספת להפסקת כהונת סגן שר במקרה כזה?** ← לא, ההפסקה אוטומטית (בג"ץ 3997/14, פסקה 22).
**וריאציה 3 — האם יש הבדל בין הפסקת כהונה להפסקת חברות בכנסת?** ← כן, הפסקת כהונה של סגן שר היא ביום מתן פסק הדין, בעוד הפסקת חברות בכנסת היא ביום שפסק הדין נעשה סופי (סעיף 27 לחוק-יסוד: הממשלה לעומת סעיף 42א(א) לחוק-יסוד: הכנסת).', 'סגן שר שהורשע בקלון ← כהונתו נפסקת אוטומטית ← ביום מתן פסק הדין.', '["חוק-יסוד: הממשלה, סעיף 27", "בג\"ץ 3997/14 התנועה למען איכות השלטון בישראל נ'' שר החוץ (12.2.2015)", "בג\"ץ 1993/03 התנועה למען איכות השלטון בישראל נ'' ראש-הממשלה, מר אריאל שרון, נז(6) 817 (9.10.2003)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''חוקתי + בינלאומי פרטי'' subtopic=''ביטול סמכות בג"ץ'' → mapped chapter=''constitutional_intl'' subtopic=''bgz_jurisdiction_revocation'' | classifier_note: Deputy minister conviction — when does tenure end. Constitutional law gap (no minister-tenure subtopic) | source_review_note: הסב-נושא ''ביטול סמכות בג"ץ'' אינו מתאים במדויק לשאלת המקור העוסקת בהפסקת כהונה של סגן שר. יש לשקול הוספת סב-נושאים רלוונטיים יותר תחת פרק ''חוקתי + בינלאומי פרטי'', כגון ''כשירות לכהונה ציבורית'' או ''טוהר המידות בשרות הציבורי''.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'כהונת סגן השר תיפסק בו ביום.', true, 'בחירה זו נכונה. סעיף 27 לחוק-יסוד: הממשלה קובע כי כהונת סגן שר שהורשע בעבירה שיש עמה קלון תיפסק ביום מתן פסק הדין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כהונת סגן השר תיפסק בתום 48 שעות ממועד פרסום פסק הדין בעניינו.', false, 'בחירה זו שגויה. הפסקת כהונה עקב קלון היא מיידית ביום מתן פסק הדין, ואינה כפופה למועד פרסום או לפרק זמן של 48 שעות, המאפיין מקרים אחרים של הפסקת כהונה (כגון התפטרות או העברה מכהונה על ידי ראש הממשלה).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'כהונת סגן השר תיפסק בתום 48 שעות מהמועד שבו הצביעה הכנסת על סיום כהונתו.', false, 'בחירה זו שגויה. הפסקת כהונת סגן שר עקב קלון היא אוטומטית ואינה דורשת הצבעה של הכנסת. הצבעת הכנסת נדרשת במקרים מסוימים של הפסקת כהונת ראש ממשלה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'כהונת סגן השר תיפסק בתום 48 שעות מרגע הפיכת פסק הדין לחלוט.', false, 'בחירה זו שגויה. הפסקת כהונת סגן שר עקב קלון מתרחשת ביום מתן פסק הדין, ולא ביום הפיכתו לחלוט. הפיכת פסק הדין לחלוט רלוונטית להפסקת חברות בכנסת של חבר כנסת שהורשע בעבירה שיש עמה קלון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'הפסקת כהונת שר מחמת קלון',
    1, 'בית המשפט המחוזי בתל אביב הרשיע בפסק דינו שר בממשלה בעבירה שיש עימה קלון. מתי תיפסק כהונתו של השר?', 'שאלה זו עוסקת בהפסקת כהונתו של שר בממשלה שהורשע בעבירה שיש עמה קלון. היא בוחנת את הוראות סעיף 23(ב) לחוק-יסוד: הממשלה, הקובעות מנגנון ''גיליוטינה'' להפסקת כהונה מיידית ואוטומטית ביום מתן פסק הדין, בדומה למצב של סגן שר.', 'סעיף 23(ב) לחוק-יסוד: הממשלה קובע כי ''בית המשפט שהרשיע שר בעבירה, יקבע בפסק דינו אם יש באותה עבירה משום קלון; קבע בית המשפט כאמור, תיפסק כהונתו של השר ביום מתן פסק הדין''. הוראה זו מורה על הפסקת כהונה אוטומטית, ללא כל סייג או שיקול דעת לבעל סמכות כלשהו, ברגע שבית המשפט קובע כי בעבירה שבה הורשע השר יש משום קלון (בג"ץ 1993/03 התנועה למען איכות השלטון בישראל נ'' ראש-הממשלה, פסקה 13).',
    'הטעות הנפוצה היא לחשוב שהפסקת כהונת שר מחמת קלון דורשת הליך נוסף, כגון החלטת ראש הממשלה או הפיכת פסק הדין לחלוט, בעוד שהחוק קובע הפסקה מיידית ואוטומטית.', '["שר", "קלון", "הפסקת כהונה", "חוק-יסוד: הממשלה", "אוטומטיות"]'::jsonb, '**וריאציה 1 — מתי תיפסק כהונת שר שהורשע בעבירה שיש עמה קלון?** ← ביום מתן פסק הדין (סעיף 23(ב) לחוק-יסוד: הממשלה).
**וריאציה 2 — האם נדרשת פעולה נוספת להפסקת כהונת שר במקרה כזה?** ← לא, ההפסקה אוטומטית (בג"ץ 1993/03, פסקה 13).
**וריאציה 3 — האם יש הבדל בין שר לסגן שר לעניין זה?** ← לא, ההוראות דומות במהותן (סעיף 23(ב) ו-27 לחוק-יסוד: הממשלה).', 'שר שהורשע בקלון ← כהונתו נפסקת אוטומטית ← ביום מתן פסק הדין.',
    '["חוק-יסוד: הממשלה, סעיף 23", "בג\"ץ 1993/03 התנועה למען איכות השלטון בישראל נ'' ראש-הממשלה, מר אריאל שרון, נז(6) 817 (9.10.2003)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כהונת השר תיפסק ביום מתן פסק הדין.', true, 'בחירה זו נכונה. סעיף 23(ב) לחוק-יסוד: הממשלה קובע כי כהונת שר שהורשע בעבירה שיש עמה קלון תיפסק ביום מתן פסק הדין, בדומה לסגן שר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'כהונת השר תיפסק בתום 48 שעות ממועד פרסום פסק הדין בעניינו.', false, 'בחירה זו שגויה. הפסקת כהונה עקב קלון היא מיידית ביום מתן פסק הדין, ואינה כפופה למועד פרסום או לפרק זמן של 48 שעות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כהונת השר תיפסק רק לאחר שראש הממשלה יחליט להעבירו מכהונתו.', false, 'בחירה זו שגויה. הפסקת כהונה עקב קלון היא אוטומטית ואינה דורשת החלטה של ראש הממשלה. סמכות ראש הממשלה להעביר שר מכהונתו (סעיף 22(ב) לחוק-יסוד: הממשלה) היא סמכות נפרדת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'כהונת השר תיפסק רק לאחר שפסק הדין יהפוך לחלוט.', false, 'בחירה זו שגויה. הפסקת כהונת שר עקב קלון מתרחשת ביום מתן פסק הדין, ולא ביום הפיכתו לחלוט.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאי כשירות למינוי שר לאחר הרשעה',
    2, 'אדם הורשע בעבירה פלילית ונדון למאסר על תנאי. בית המשפט לא קבע כי בעבירה יש משום קלון. האם אדם זה כשיר להתמנות לשר בממשלה, אם טרם חלפו 7 שנים מיום מתן פסק הדין?', 'שאלה זו עוסקת בתנאי הכשירות למינוי שר בממשלה, ובפרט בהשפעת הרשעה פלילית על כשירות זו. היא בוחנת את סעיף 6(ג) לחוק-יסוד: הממשלה, תוך התייחסות לתיקון משנת 2022 שהבהיר כי המגבלה חלה רק על מי שנידון למאסר בפועל, אלא אם כן בית המשפט קבע קלון.', 'סעיף 6(ג)(1) לחוק-יסוד: הממשלה, בנוסחו המתוקן (תיקון מס'' 11, תשפ"ג-2022), קובע כי ''לא יתמנה לשר מי שהורשע בעבירה ונידון לעונש מאסר בפועל וביום מינויו טרם עברו שבע שנים מהיום שגמר לרצות את עונש המאסר בפועל, אלא אם כן קבע יושב ראש ועדת הבחירות המרכזית כי אין עם העבירה שבה הורשע, בנסיבות הענין, משום קלון''. סעיף 6(ו) מבהיר כי ''מאסר בפועל'' כולל ''מאסר על-תנאי שהופעל''. במקרה הנדון, מדובר במאסר על תנאי שלא הופעל, ובית המשפט לא קבע קלון. לפיכך, על פי הנוסח הנוכחי של החוק, אין מניעה למינוי, שכן המגבלה חלה רק על מאסר בפועל (בג"ץ 8948/22 אילן שיינפלד נ'' הכנסת, פסקאות 14-15).',
    'הטעות הנפוצה היא לבלבל בין הנוסח הישן של סעיף 6(ג) לחוק-יסוד: הממשלה, שכלל גם מאסר על תנאי, לבין הנוסח הנוכחי, המצמצם את המגבלה למאסר בפועל בלבד (אלא אם כן נקבע קלון).', '["כשירות לכהונה", "שר", "קלון", "מאסר בפועל", "מאסר על תנאי", "חוק-יסוד: הממשלה", "תיקון חוק"]'::jsonb, '**וריאציה 1 — האם מאסר על תנאי שלא הופעל פוסל מכהונת שר?** ← לא, סעיף 6(ג) לחוק-יסוד: הממשלה (בנוסחו המתוקן) מתייחס למאסר בפועל (בג"ץ 8948/22, פסקה 15).
**וריאציה 2 — מה קורה אם בית המשפט קבע קלון בעבירה?** ← אז גם מאסר על תנאי יכול להוביל לפסילה, אם בית המשפט קבע קלון (סעיף 6(ג)(2) לחוק-יסוד: הממשלה).
**וריאציה 3 — מהו הכלל החדש לעניין כשירות לשר?** ← ''אין כלא אין קלון'' – כלומר, רק מאסר בפועל מפעיל את חזקת הקלון, אלא אם בית המשפט קבע קלון מפורש (בג"ץ 8948/22, פסקה 15).', 'כשירות לשר ← מאסר בפועל (לא על תנאי) ← 7 שנים ← יו"ר ועדת הבחירות המרכזית (אם אין קלון).',
    '["חוק-יסוד: הממשלה, סעיף 6", "בג\"ץ 8948/22 אילן שיינפלד נ'' הכנסת (18.1.2023)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כן, הוא כשיר להתמנות לשר, שכן סעיף 6(ג) לחוק-יסוד: הממשלה מתייחס רק למאסר בפועל.', true, 'בחירה זו נכונה. סעיף 6(ג)(1) לחוק-יסוד: הממשלה (בנוסחו המתוקן) קובע כי המגבלה על מינוי שר חלה רק על מי שהורשע ונדון לעונש מאסר בפועל, ולא למאסר על תנאי, אלא אם כן בית המשפט קבע במפורש קלון.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לא, הוא אינו כשיר, שכן מאסר על תנאי נכלל בהגדרת ''מאסר'' לעניין סעיף 6(ג) לחוק-יסוד: הממשלה.', false, 'בחירה זו שגויה. בעקבות תיקון מס'' 11 לחוק-יסוד: הממשלה בשנת 2022, סעיף 6(ג) מתייחס במפורש רק למאסר בפועל, ולא למאסר על תנאי, אלא אם כן בית המשפט קבע קלון.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כן, אך רק אם יושב ראש ועדת הבחירות המרכזית יקבע כי אין עם העבירה קלון.', false, 'בחירה זו שגויה. קביעת יו"ר ועדת הבחירות המרכזית נדרשת רק במקרים של מאסר בפועל, כאשר בית המשפט לא קבע קלון. במקרה זה, מדובר במאסר על תנאי, ולכן אין צורך בקביעה כזו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לא, הוא אינו כשיר, שכן כל הרשעה בעבירה פלילית, גם ללא קלון, פוסלת מכהונה ציבורית.', false, 'בחירה זו שגויה. החוק אינו פוסל כל אדם שהורשע בעבירה פלילית מכהונה כשר. הפסילה מותנית בתנאים ספציפיים הקשורים לסוג העונש (מאסר בפועל) ולקביעת קלון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הפסקת כהונה של ראש ממשלה מחמת קלון',
    3, 'ראש הממשלה הורשע בפסק דין סופי בעבירה שיש עימה קלון. מהו ההליך להפסקת כהונתו?', 'שאלה זו עוסקת בהליך המיוחד להפסקת כהונתו של ראש ממשלה שהורשע בעבירה שיש עמה קלון. היא בוחנת את סעיף 18 לחוק-יסוד: הממשלה, המבחין בין ראש ממשלה לבין שר או סגן שר, וקובע הליך מורכב המערב את הכנסת, ורק בהיעדר החלטה של הכנסת, הפסקת כהונה אוטומטית ביום שפסק הדין נעשה סופי.', 'סעיף 18 לחוק-יסוד: הממשלה קובע הליך מיוחד להפסקת כהונת ראש ממשלה שהורשע בעבירה שיש עמה קלון. ראשית, אם הורשע ראש הממשלה בעבירה שיש עמה קלון, ועדת הכנסת תגבש בתוך 30 ימים המלצה לעניין העברתו מתפקידו. לאחר מכן, מליאת הכנסת רשאית להחליט ברוב של 61 חברי כנסת על העברתו מכהונתו, לאחר שניתנה לו הזדמנות לטעון את טענותיו (סעיף 18(א)-(ג)). אם הכנסת החליטה להעביר את ראש הממשלה, יראו את הממשלה כאילו התפטרה. אם ראש הממשלה לא הועבר מכהונתו על ידי הכנסת, הרי שביום שבו פסק הדין נעשה סופי, תיפסק כהונתו של ראש הממשלה ויראו את הממשלה כאילו התפטרה (סעיף 18(ד)). הליך זה שונה מהליך הפסקת כהונה של שר או סגן שר, שהוא אוטומטי ביום מתן פסק הדין.',
    'הטעות הנפוצה היא להניח שהליך הפסקת כהונת ראש ממשלה זהה לזה של שר או סגן שר, או לבלבל בין השעיה להפסקת כהונה.', '["ראש ממשלה", "קלון", "הפסקת כהונה", "חוק-יסוד: הממשלה", "ועדת הכנסת", "מליאת הכנסת", "רוב חברי הכנסת", "פסק דין סופי"]'::jsonb, '**וריאציה 1 — האם הפסקת כהונת רה"מ מחמת קלון היא אוטומטית?** ← לא, היא כרוכה בהליך של הכנסת (סעיף 18 לחוק-יסוד: הממשלה).
**וריאציה 2 — מהו הרוב הדרוש בכנסת להעברת רה"מ?** ← רוב של 61 חברי כנסת (סעיף 18(א) לחוק-יסוד: הממשלה).
**וריאציה 3 — מה קורה אם הכנסת לא העבירה את רה"מ?** ← כהונתו תיפסק ביום שפסק הדין נעשה סופי (סעיף 18(ד) לחוק-יסוד: הממשלה).', 'רה"מ הורשע בקלון ← הכנסת מחליטה (61 ח"כים) ← אם לא, נפסקת כהונה ביום פסק דין סופי.',
    '["חוק-יסוד: הממשלה, סעיף 18", "נבו - המתמחה, חוקי יסוד (2026) | חקירת ראש הממשלה והגשת כתב אישום נגדו"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כהונתו של ראש הממשלה נפסקת אוטומטית ביום שפסק הדין נעשה סופי.', false, 'בחירה זו שגויה. הפסקת כהונת ראש ממשלה אינה אוטומטית מיד עם מתן פסק הדין, אלא כרוכה בהליך מורכב יותר המערב את הכנסת, או מתרחשת אוטומטית רק אם הכנסת לא פעלה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'ועדת הכנסת תגבש המלצה בתוך 30 ימים, ולאחר מכן מליאת הכנסת רשאית להחליט ברוב של 61 חברי כנסת על העברתו מכהונתו. אם הכנסת לא העבירה אותו, כהונתו תיפסק ביום שפסק הדין נעשה סופי.', true, 'בחירה זו נכונה. סעיף 18 לחוק-יסוד: הממשלה קובע הליך מדורג הכולל המלצת ועדת הכנסת והחלטת מליאת הכנסת ברוב של 61 ח"כים. רק אם הכנסת לא העבירה אותו, כהונתו תיפסק אוטומטית ביום שפסק הדין נעשה סופי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'ראש הממשלה יושעה מכהונתו עד שפסק הדין יהפוך לחלוט, ורק אז תיפסק כהונתו.', false, 'בחירה זו שגויה. סעיף 18 לחוק-יסוד: הממשלה אינו קובע השעיה לראש ממשלה, אלא הליך של העברה מכהונה על ידי הכנסת, או הפסקת כהונה אוטומטית אם הכנסת לא פעלה, ביום שפסק הדין נעשה סופי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'הכנסת רשאית להחליט על העברתו מכהונתו ברוב רגיל, ללא צורך בהמלצת ועדה.', false, 'בחירה זו שגויה. סעיף 18(א) לחוק-יסוד: הממשלה דורש רוב של 61 חברי כנסת, וסעיף 18(ב) קובע כי ועדת הכנסת תגבש המלצה לפני הדיון במליאה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'השעיית חבר כנסת מחמת קלון',
    4, 'חבר כנסת הורשע בעבירה פלילית ובית המשפט קבע כי יש עמה קלון. פסק הדין אינו סופי, שכן הוגש עליו ערעור. מה הדין לגבי חברותו בכנסת?', 'שאלה זו עוסקת במעמדו של חבר כנסת שהורשע בעבירה שיש עמה קלון, כאשר פסק הדין טרם הפך לסופי. היא בוחנת את ההבחנה בין השעיה (סעיף 42ב לחוק-יסוד: הכנסת) לבין הפסקת חברות (סעיף 42א לחוק-יסוד: הכנסת), ומדגישה את מנגנון ההשעיה האוטומטי שנועד לשמור על טוהר המידות הציבורי בתקופת הביניים.', 'סעיף 42ב(א) לחוק-יסוד: הכנסת קובע כי ''חבר הכנסת שהורשע בעבירה פלילית וקבע בית המשפט, ביוזמתו או לבקשת היועץ המשפטי לממשלה, שיש עם העבירה קלון, יושעה מכהונתו בכנסת מיום קביעת בית המשפט ועד למועד שבו פסק הדין נעשה סופי''. כלומר, במצב שבו פסק הדין אינו סופי, חבר הכנסת מושעה מכהונתו. רק ביום שפסק הדין נעשה סופי, תיפסק חברותו בכנסת (סעיף 42א(א) לחוק-יסוד: הכנסת). מנגנון זה מאזן בין חזקת החפות לבין הצורך לשמור על אמון הציבור בנבחריו.',
    'הטעות הנפוצה היא לבלבל בין השעיה לבין הפסקת חברות, או לחשוב שחבר כנסת שהורשע בקלון ממשיך לכהן כרגיל עד להכרעה סופית בערעור.', '["חבר כנסת", "קלון", "השעיה", "הפסקת חברות", "חוק-יסוד: הכנסת", "פסק דין סופי", "טוהר המידות"]'::jsonb, '**וריאציה 1 — חבר כנסת הורשע בקלון ופסק הדין אינו סופי?** ← יושעה מכהונתו עד שפסק הדין יהפוך לסופי (סעיף 42ב(א) לחוק-יסוד: הכנסת).
**וריאציה 2 — מתי תיפסק חברותו בכנסת?** ← ביום שפסק הדין נעשה סופי (סעיף 42א(א) לחוק-יסוד: הכנסת).
**וריאציה 3 — האם ההשעיה דורשת החלטת כנסת?** ← לא, היא אוטומטית מיום קביעת בית המשפט (סעיף 42ב(א) לחוק-יסוד: הכנסת).', 'חבר כנסת הורשע בקלון (לא סופי) ← מושעה ← חברותו נפסקת רק בפסק דין סופי.',
    '["חוק-יסוד: הכנסת, סעיף 42א", "חוק-יסוד: הכנסת, סעיף 42ב", "נבו - המתמחה, חוקי יסוד (2026) | הבחירות לכנסת"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'חברותו בכנסת תיפסק אוטומטית ביום מתן פסק הדין.', false, 'בחירה זו שגויה. הפסקת חברות בכנסת מתרחשת רק ביום שפסק הדין נעשה סופי (סעיף 42א(א) לחוק-יסוד: הכנסת).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'חבר הכנסת יושעה מכהונתו בכנסת מיום קביעת בית המשפט ועד למועד שבו פסק הדין נעשה סופי.', true, 'בחירה זו נכונה. סעיף 42ב(א) לחוק-יסוד: הכנסת קובע כי חבר כנסת שהורשע בעבירה שיש עמה קלון, יושעה מכהונתו עד שפסק הדין יהפוך לסופי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'חבר הכנסת ימשיך לכהן כרגיל עד להכרעה סופית בערעור, שכן עומדת לו חזקת החפות.', false, 'בחירה זו שגויה. סעיף 42ב(א) לחוק-יסוד: הכנסת קובע מנגנון השעיה במקרים אלו, המאזן בין חזקת החפות לבין טוהר המידות הציבורי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'הכנסת רשאית להחליט על השעייתו ברוב של 90 חברי כנסת.', false, 'בחירה זו שגויה. השעיה לפי סעיף 42ב(א) היא אוטומטית עם קביעת הקלון על ידי בית המשפט, ואינה דורשת החלטה של הכנסת. רוב של 90 חברי כנסת נדרש להדחת חבר כנסת במקרים אחרים (כגון הסתה לגזענות).', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 21, '2022-S-Q21';
END
$$;

-- ============================================================
-- Q22 — 2022-S-Q22 — chapter=civil_proc subtopic=jurisdiction_subject
-- classifier_note: Mortgage realization, which court has subject-matter jurisdiction
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd0ca0878-d3b0-4e67-806a-36097a62858a'::uuid;
  v_group_id uuid := '8dc7a849-d87e-478a-a0b6-632e9fbc93d0'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '31b76893-d968-43ca-a7e4-58c2cde55872'::uuid;
  v_ang_1 uuid := 'e8840235-3c3f-4264-a5a4-40fb316f4ddd'::uuid;
  v_ang_2 uuid := 'c667a05e-fd49-4f70-b52c-cb9dbb4262bd'::uuid;
  v_ang_3 uuid := 'bddfe463-37ae-4f43-8e27-e82da62959ec'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q22';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 22, '2022-S-Q22';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'jurisdiction_subject' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'jurisdiction_subject', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q22', v_chapter_id, v_subtopic_id, 'איתן, תושב חיפה, הוא הבעלים הרשומים של קרקע בנצרת (להלן: הנכס). בנק "הר וגיא", אשר לטובתו ממושכן הנכס, מגיש נגד איתן תביעה למימוש הנכס בגין חוב של 1,000,000 ש"ח שצבר איתן בבנק. בהנחה שאין הסכם שיפוט בין הצדדים, מי מוסמך לדון בתביעה?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 22}'::jsonb, 'שאלה זו עוסקת בקביעת הסמכות העניינית והמקומית בתביעה למימוש משכנתא על מקרקעין רשומים. היא בוחנת את הוראות סעיפים 40 ו-51 לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, ואת תקנה 7(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, המבחינות בין סוגי תביעות במקרקעין וקובעות כללים ייחודיים לסמכות מקומית בתביעות אלו.', 'הסמכות העניינית נקבעת על פי מבחן הסעד המבוקש בכתב התביעה (ע"א 2846/03 אלדרמן נ'' ארליך, רפרנס 9, 16, 53, 69). סעיף 51(א)(3) לחוק בתי המשפט קובע כי בית משפט השלום ידון בתביעות בדבר חזקה, שימוש או חלוקה במקרקעין, אך ''לא ידון בתביעות בדבר חכירה לדורות ובתביעות אחרות הנוגעות למקרקעין''. תביעה למימוש משכנתא על מקרקעין נחשבת ל''תביעה אחרת הנוגעת למקרקעין'' (ת"א (שלום חד'') 23344-12-10 פלוני נ'' הבנק, רפרנס 62; ת"א (מחוזי י-ם) 2434-06-22 ישראל ברלין נ'' הבנק הבינלאומי הראשון, רפרנס 44; ת"א (שלום פ"ת) 33080-05-23 קוואלטי קרדיט פאנד 2 נ'' אירמה מושיאשוילי, רפרנס 16). לכן, הסמכות העניינית נתונה לבית המשפט המחוזי מכוח סמכותו השיורית (סעיף 40(1) לחוק בתי המשפט, רפרנס 16, 55, 58, 62, 66, 68, 70). לעניין הסמכות המקומית, תקנה 7(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''אם היתה התובענה במקרקעין תוגש לבית המשפט שבמחוז שיפוטו הם מצויים''. מאחר שהנכס מצוי בנצרת, הסמכות המקומית הייחודית היא לבית המשפט המחוזי בנצרת (ת"א (מחוזי י-ם) 75368-03-25 רוח הגולן נ'' רשות מקרקעי ישראל, רפרנס 2, 3; ת"א (מחוזי ב"ש) 31917-02-22 נווה אביב השקעות נ'' אבן שפע נדל"ן, רפרנס 32, 33).', 'הטעות הנפוצה היא לבלבל בין סמכות עניינית לסמכות מקומית, או ליישם את כללי הסמכות המקומית הכלליים (מקום מגורי הנתבע) על תביעות במקרקעין, במקום את הכלל הייחודי למקרקעין.',
    '["סמכות עניינית", "סמכות מקומית", "מקרקעין", "מימוש משכנתא", "חוק בתי המשפט", "תקנות סדר הדין האזרחי", "מבחן הסעד"]'::jsonb, '**וריאציה 1 — תביעה למימוש משכנתא?** ← סמכות עניינית למחוזי, כ''תביעה אחרת הנוגעת למקרקעין'' (סעיף 51(א)(3) לחוק בתי המשפט, רפרנס 44, 62).
**וריאציה 2 — היכן מגישים תביעה במקרקעין?** ← לבית המשפט שבמחוז שיפוטו מצויים המקרקעין (תקנה 7(א) לתקסד"א, רפרנס 2, 3, 32).
**וריאציה 3 — האם שווי החוב משנה?** ← לא, בתביעות במקרקעין (שאינן חזקה/שימוש) הסמכות למחוזי ללא קשר לשווי (סעיף 51(א)(3) לחוק בתי המשפט, רפרנס 45).', 'מימוש משכנתא ← סמכות עניינית מחוזי ← סמכות מקומית ייחודית למקום הנכס.', '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיפים 40, 51", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 7", "ת\"א (מחוזי י-ם) 75368-03-25 רוח הגולן נ'' רשות מקרקעי ישראל (14.12.2025)", "ת\"א (מחוזי מרכז) 36309-05-22 שלמה חבוט נ'' רשות מקרקעי ישראל (28.8.2022)", "ת\"א (שלום חד'') 23344-12-10 פלוני נ'' הבנק (29.11.2012)", "ת\"א (מחוזי י-ם) 2434-06-22 ישראל ברלין נ'' הבנק הבינלאומי הראשון לישראל בע\"מ (26.6.2023)", "ת\"א (מחוזי ב\"ש) 31917-02-22 נווה אביב השקעות בע\"מ נ'' אבן שפע נדל\"ן בע\"מ (10.6.2022)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''סמכות עניינית'' → mapped chapter=''civil_proc'' subtopic=''jurisdiction_subject'' | classifier_note: Mortgage realization, which court has subject-matter jurisdiction', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית המשפט המחוזי בנצרת בלבד.', true, 'בחירה זו נכונה. תביעה למימוש משכנתא על מקרקעין היא ''תביעה אחרת הנוגעת למקרקעין'' המסורה לסמכותו העניינית של בית המשפט המחוזי. מאחר שהתביעה היא במקרקעין, הסמכות המקומית הייחודית היא לבית המשפט שבמחוז שיפוטו מצויים המקרקעין, קרי נצרת.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט המחוזי בחיפה או בית המשפט המחוזי בנצרת.', false, 'בחירה זו שגויה. אף שהסמכות העניינית היא לבית המשפט המחוזי, הסמכות המקומית בתביעה במקרקעין היא ייחודית למקום המקרקעין, ולא למקום מגורי הנתבע.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית משפט השלום בחיפה או בית משפט השלום בנצרת.', false, 'בחירה זו שגויה. תביעה למימוש משכנתא אינה תביעה לחזקה, שימוש או חלוקה במקרקעין, ולכן אינה בסמכות בית משפט השלום, אלא בסמכות בית המשפט המחוזי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית משפט השלום בחיפה בלבד.', false, 'בחירה זו שגויה. הסמכות העניינית אינה לבית משפט השלום, והסמכות המקומית אינה נקבעת לפי מקום מגורי הנתבע בתביעה במקרקעין.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'סמכות עניינית בתביעה לבעלות במקרקעין לא רשומים',
    1, 'ראובן הגיש תביעה לבית משפט השלום בצפת, בבקשה להצהיר על בעלותו במקרקעין בלתי מוסדרים ברמת הגולן, שאינם רשומים בלשכת רישום המקרקעין. הנתבעת טוענת לחוסר סמכות עניינית. מה הדין?', 'שאלה זו עוסקת בסמכות העניינית לדון בתביעות לבעלות במקרקעין שאינם רשומים או מוסדרים. קיימת מחלוקת בפסיקה בנושא זה, אך הגישה הרווחת כיום היא שגם תביעות לבעלות במקרקעין לא רשומים נחשבות ''תביעות אחרות הנוגעות למקרקעין'' ולכן נתונות לסמכותו השיורית של בית המשפט המחוזי, ולא לבית משפט השלום על פי שווי.', 'סעיף 51(א)(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי בית משפט השלום לא ידון ב''תביעות בדבר חכירה לדורות ובתביעות אחרות הנוגעות למקרקעין''. לבית המשפט המחוזי נתונה סמכות שיורית (סעיף 40(1) לחוק). הפסיקה חלוקה בשאלה האם תביעה לבעלות במקרקעין לא רשומים היא ''תביעה אחרת הנוגעת למקרקעין'' (מחוזי) או זכות אובליגטורית (שלום לפי שווי). הגישה המקובלת כיום, המצדדת בוודאות ויעילות, היא שכל תביעה הנוגעת למקרקעין, בין רשומים ובין לא רשומים, שהסעד שנתבע בה אינו חזקה/שימוש/חלוקה, מסורה לסמכותו של בית המשפט המחוזי (ה"פ (מחוזי חי'') 119/08 שרה שוייצר נ'' אילן רפאל, רפרנס 4, 45, 46, 61, 65; ת"א (שלום צפת) 21584-07-23, רפרנס 11; ת"א (מחוזי נצרת) 49826-02-24, רפרנס 18).',
    'הטעות הנפוצה היא לבלבל בין זכות קניינית רשומה לבין זכות ''הנוגעת למקרקעין'' לעניין סמכות עניינית, ולחשוב שכל עוד הזכות אינה רשומה, היא אובליגטורית ונתונה לסמכות השלום לפי שווי.', '["סמכות עניינית", "מקרקעין לא רשומים", "זכויות אובליגטוריות", "זכויות קנייניות", "חוק בתי המשפט", "סמכות שיורית"]'::jsonb, '**וריאציה 1 — תביעה לבעלות במקרקעין לא רשומים?** ← סמכות מחוזי, כ''תביעה אחרת הנוגעת למקרקעין'' (ה"פ (מחוזי חי'') 119/08, רפרנס 45).
**וריאציה 2 — האם שווי המקרקעין קובע?** ← לא, במקרקעין הסמכות נקבעת לפי הסעד, לא לפי שווי (ה"פ (מחוזי חי'') 119/08, רפרנס 45).
**וריאציה 3 — מהי הגישה המועדפת בפסיקה?** ← גישה המעדיפה וודאות ויציבות, לפיה כל תביעה הנוגעת למקרקעין (שאינה חזקה/שימוש) היא למחוזי (ת"א (מחוזי נצ'') 62341-02-15, רפרנס 45).', 'בעלות במקרקעין לא רשומים ← סמכות מחוזי ← ''תביעה אחרת הנוגעת למקרקעין'' ← לא לפי שווי.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיפים 40, 51", "ה\"פ (מחוזי חי'') 119/08 שרה שוייצר נ'' אילן רפאל (6.7.2008)", "ת\"א (שלום צפת) 21584-07-23 רשות מקרקעי ישראל נ'' עאדל אבו סאלח (7.4.2025)", "ת\"א (מחוזי נצרת) 49826-02-24 גוזיף ספדי נ'' אחסאן אבו עראר (21.5.2024)", "ת\"א (מחוזי נצ'') 62341-02-15 רידאן מחמוד נ'' סלימאן חלבי (12.10.2015)", "ת\"א (שלום חד'') 40413-06-13 יוחנן קטיעי נ'' חנן כהן (15.10.2013)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'הסמכות העניינית נתונה לבית משפט השלום, שכן מדובר בזכויות אובליגטוריות בלבד, והסמכות נקבעת לפי שווי הזכויות.', false, 'בחירה זו מייצגת גישה קודמת בפסיקה, אך הגישה הרווחת כיום, במיוחד בתביעות לבעלות, היא שהסמכות נתונה לבית המשפט המחוזי גם במקרקעין לא רשומים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'הסמכות העניינית נתונה לבית המשפט המחוזי, שכן תביעה לבעלות במקרקעין, בין רשומים ובין לא רשומים, היא ''תביעה אחרת הנוגעת למקרקעין''.', true, 'בחירה זו נכונה. הפסיקה המאוחרת נוטה לראות בתביעות לבעלות במקרקעין, גם אם אינם רשומים, כ''תביעות אחרות הנוגעות למקרקעין'' המסורות לסמכותו השיורית של בית המשפט המחוזי (ת"א (שלום צפת) 21584-07-23, רפרנס 11).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'הסמכות העניינית נתונה לבית משפט השלום, שכן מדובר במקרקעין בלתי מוסדרים, ולכן אין מדובר בזכות קניינית.', false, 'בחירה זו שגויה. אף שמקרקעין בלתי מוסדרים אינם מקנים זכות קניינית רשומה, תביעה לבעלות בהם עדיין נחשבת ''נוגעת למקרקעין'' לעניין סמכות עניינית של בית המשפט המחוזי (ת"א (מחוזי נצרת) 49826-02-24, רפרנס 18).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'הסמכות העניינית תיקבע לפי שווי המקרקעין, שכן מדובר בסעד הצהרתי שאינו ניתן לכימות.', false, 'בחירה זו שגויה. סעד הצהרתי לבעלות במקרקעין אינו נחשב לסעד כספי, והסמכות לגביו נקבעת לפי מהות הזכות ולא לפי שווי כספי (ת"א (מחוזי נצ'') 62341-02-15, רפרנס 45).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מבחן הסעד והמהות בסמכות עניינית',
    2, 'כיצד נקבעת הסמכות העניינית בתביעה אזרחית, ובפרט בתביעות הנוגעות למקרקעין?', 'שאלה זו בוחנת את הכללים לקביעת הסמכות העניינית בתביעות אזרחיות, ובפרט בתביעות מקרקעין. היא מדגישה את ''מבחן הסעד'' כעיקרון מנחה, אך גם את הגישה המורכבת יותר בפסיקה, לפיה בתביעות ''הנוגעות למקרקעין'' יש לבחון גם את מהות הזכות שבמוקד ההליך (קניינית או חוזית) כדי למנוע עיוותים דיוניים.', 'הכלל המנחה לקביעת הסמכות העניינית הוא ''מבחן הסעד'' המבוקש בכתב התביעה (ע"א 2846/03 אלדרמן נ'' ארליך, רפרנס 9, 16, 53, 69). עם זאת, הפסיקה פיתחה גישה לפיה בתביעות ''הנוגעות למקרקעין'' (כמשמעותן בסיפת סעיף 51(א)(3) לחוק בתי המשפט), יש לבחון האם מדובר בקיום זכות קניינית או התחייבות להעביר זכות קניינית, או שמא מדובר בזכות חוזית/אובליגטורית בלבד (רע"א 4890/15 אהרן אלוש נ'' עירית טבריה, רפרנס 53, 54, 58, 66, 69, 70). אם מדובר בזכות קניינית, הסמכות נתונה לבית המשפט המחוזי. לעומת זאת, אם מדובר בזכות חוזית/אובליגטורית במקרקעין, הסמכות העניינית תיקבע לפי שווי התביעה (ת"א (מחוזי חי'') 48153-11-24 יוסי דהאן נ'' צוריאל, רפרנס 7; ת"א (מחוזי חי'') 57737-07-25 עו"ד אלי מור יוסף נ'' משרד המשפטים, רפרנס 12, 14).',
    'הטעות הנפוצה היא להסתפק בניסוח הפורמלי של הסעד בכתב התביעה, מבלי לבחון את מהות הזכות האמיתית שבמחלוקת, במיוחד בתביעות מקרקעין.', '["סמכות עניינית", "מבחן הסעד", "מהות הזכות", "זכות קניינית", "זכות חוזית", "חוק בתי המשפט"]'::jsonb, '**וריאציה 1 — איך קובעים סמכות עניינית?** ← מבחן הסעד, אך במקרקעין גם מהות הזכות (קניינית/חוזית) (רע"א 4890/15 אלוש, רפרנס 53, 69).

**וריאציה 2 — מתי תביעה במקרקעין תלך לשלום?** ← רק אם הסעד הוא חזקה, שימוש או חלוקה (סעיף 51(א)(3) לחוק בתי המשפט, רפרנס 51, 56).
**וריאציה 3 — מה קורה אם הסעד הוא זכות חוזית במקרקעין?** ← הסמכות נקבעת לפי שווי התביעה, לרוב לשלום אם מתחת לתקרה (ת"א (מחוזי חי'') 48153-11-24, רפרנס 7).', 'סמכות עניינית ← מבחן הסעד + מהות הזכות (במקרקעין) ← קניינית למחוזי, חוזית לשלום (לפי שווי).',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיפים 40, 51", "רע\"א 4890/15 אהרן אלוש נ'' עירית טבריה (31.12.2015)", "ת\"א (מחוזי חי'') 48153-11-24 יוסי דהאן נ'' צוריאל משק עובדים להתיישבות חקלאית שיתופית בע\"מ (19.12.2025)", "ת\"א (מחוזי חי'') 57737-07-25 עו\"ד אלי מור יוסף כונס נכסים נ'' משרד המשפטים - רשם המשכונות (8.3.2026)", "רע\"א 3723/24 יאיר יעקב נ'' אהרון וכטר (20.6.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'הסמכות נקבעת על פי מבחן הסעד המבוקש בכתב התביעה, אך בתביעות מקרקעין יש לבחון גם את מהות הזכות שבמוקד ההליך (קניינית או חוזית).', true, 'בחירה זו נכונה. מבחן הסעד הוא המבחן העיקרי, אך בפסיקה התפתחה גישה לפיה בתביעות ''הנוגעות למקרקעין'' יש לבחון גם את מהות הזכות (קניינית או חוזית) כדי לקבוע את הסמכות (רע"א 3723/24 יעקב נ'' וכטר, רפרנס 69; רע"א 4890/15 אלוש נ'' עירית טבריה, רפרנס 53, 54, 58, 66, 69, 70).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'הסמכות נקבעת תמיד ורק על פי מבחן הסעד כפי שנוסח בכתב התביעה, ללא קשר למהות הזכות.', false, 'בחירה זו שגויה. אף שמבחן הסעד הוא העיקרי, הפסיקה קבעה כי אין להותיר את גורל הסמכות בידי מנסח כתב התביעה בלבד, ויש לבחון גם את מהות הזכות (רע"א 4890/15 אלוש נ'' עירית טבריה, רפרנס 53, 54, 58, 66, 69, 70).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'הסמכות נקבעת על פי שווי התביעה בלבד, למעט תביעות לחזקה ושימוש במקרקעין.', false, 'בחירה זו שגויה. שווי התביעה קובע רק בתביעות שאינן נוגעות למקרקעין, או בתביעות הנוגעות לזכויות חוזיות במקרקעין שאינן ניתנות לרישום קנייני (סעיף 51(א)(2) לחוק בתי המשפט, רפרנס 51, 56).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'הסמכות נקבעת על פי עילת התביעה, ולא על פי הסעד המבוקש.', false, 'בחירה זו שגויה. הכלל המקובל הוא שהסמכות העניינית נקבעת על פי מבחן הסעד, ולא על פי עילת התביעה (ת"א (מחוזי ת"א) 13282-06-23 שלום שרבט נ'' מלכיאל שרבט, רפרנס 35).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'סמכות עניינית בתביעה לחזקה ושימוש במקרקעין',
    3, 'דני הגיש תביעה לבית משפט השלום בירושלים, בבקשה להצהיר על זכותו לחזקה ושימוש בלעדיים במגרש מסוים, ולמנוע מיוסי להפריע לו בשימוש זה. שווי המגרש עולה על 2.5 מיליון ש"ח. מה הדין לעניין הסמכות העניינית?', 'שאלה זו עוסקת בסמכות העניינית הייחודית של בית משפט השלום לדון בתביעות הנוגעות לחזקה או שימוש במקרקעין. היא מדגישה את הכלל הקבוע בסעיף 51(א)(3) לחוק בתי המשפט, לפיו סמכות זו אינה תלויה בשווי המקרקעין, ומבטלת את ''הלכת שמש'' הישנה שהבחינה בין שמירה על גוף הנכס לבין פגיעה בו.', 'סעיף 51(א)(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי ''בית משפט שלום ידון... בתביעות בדבר חזקה או שימוש במקרקעין או בדבר חלוקתם או חלוקת השימוש בהם... יהיה שוויו של נושא התביעה אשר יהיה''. כלומר, תביעות לחזקה ושימוש במקרקעין נתונות לסמכותו הייחודית של בית משפט השלום, ללא קשר לשווי הנכס (ת"א (שלום ת"א) 64604-02-19 יהודית רטנר נ'' סרג'' יחיא אזולאי, רפרנס 75; ת"א (מחוזי מרכז) 11923-05-22 דניאל אדזיאשוילי נ'' גרופית נכסים והנדסה, רפרנס 76). הפסיקה אף ביטלה את ''הלכת שמש'' הישנה, שהגבילה את סמכות השלום רק לתביעות חזקה ושימוש שאינן פוגעות בגוף הנכס, וקבעה כי כל תביעה לחזקה ושימוש, בין אם פוגעת בגוף הנכס ובין אם לאו, נתונה לסמכות השלום (רע"א 3749/12 ששון בר-עוז נ'' דניאל סטר, רפרנס 75).',
    'הטעות הנפוצה היא לחשוב ששווי המקרקעין קובע את הסמכות העניינית גם בתביעות לחזקה ושימוש, או לזכור את ''הלכת שמש'' שבוטלה.', '["סמכות עניינית", "חזקה במקרקעין", "שימוש במקרקעין", "בית משפט השלום", "חוק בתי המשפט", "הלכת שמש"]'::jsonb, '**וריאציה 1 — תביעה לחזקה/שימוש במקרקעין?** ← סמכות שלום, ללא קשר לשווי (סעיף 51(א)(3) לחוק בתי המשפט, רפרנס 75).
**וריאציה 2 — האם ''הלכת שמש'' עדיין בתוקף?** ← לא, בוטלה, כל תביעות החזקה והשימוש הן לשלום (רע"א 3749/12 בר-עוז, רפרנס 75).
**וריאציה 3 — מה קורה אם הסעד הוא הצהרתי לחזקה?** ← עדיין בסמכות שלום, כי מהות הסעד היא חזקה (ת"א (מחוזי מרכז) 11923-05-22, רפרנס 76).', 'תביעה לחזקה/שימוש במקרקעין ← סמכות שלום ← ללא קשר לשווי ← ''הלכת שמש'' בוטלה.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 51(א)(3)", "רע\"א 3749/12 ששון בר-עוז נ'' דניאל סטר (1.8.2013)", "ת\"א (שלום ת\"א) 64604-02-19 יהודית רטנר נ'' סרג'' יחיא אזולאי (7.5.2020)", "ת\"א (מחוזי מרכז) 11923-05-22 דניאל אדזיאשוילי - משרד עורכי דין נ'' גרופית נכסים והנדסה (1993) בע\"מ (9.5.2022)", "ת\"א (שלום י-ם) 34054-04-14 גמאל משני נ'' רבחי אבו רמילה (4.3.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'הסמכות העניינית נתונה לבית משפט השלום, שכן תביעות לחזקה ושימוש במקרקעין הן בסמכותו הייחודית, ללא קשר לשווי.', true, 'בחירה זו נכונה. סעיף 51(א)(3) לחוק בתי המשפט קובע במפורש כי בית משפט השלום ידון בתביעות בדבר חזקה או שימוש במקרקעין, יהיה שוויו של נושא התביעה אשר יהיה (רפרנס 51, 56, 75, 76).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'הסמכות העניינית נתונה לבית המשפט המחוזי, שכן שווי המגרש עולה על תקרת הסמכות של בית משפט השלום.', false, 'בחירה זו שגויה. בתביעות לחזקה ושימוש במקרקעין, שווי הנכס אינו רלוונטי לקביעת הסמכות העניינית, והיא נתונה תמיד לבית משפט השלום (סעיף 51(א)(3) לחוק בתי המשפט, רפרנס 51, 56, 75, 76).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'הסמכות העניינית נתונה לבית המשפט המחוזי, שכן מדובר בסעד הצהרתי הנוגע לזכות קניינית.', false, 'בחירה זו שגויה. אף שמדובר בסעד הצהרתי, מהות הסעד היא חזקה ושימוש, ולכן הוא בסמכות השלום. ההבחנה בין זכות קניינית לחוזית רלוונטית ל''תביעות אחרות הנוגעות למקרקעין'', לא לחזקה ושימוש (רפרנס 51, 56, 75, 76).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'הסמכות העניינית נתונה לבית משפט השלום, אך רק אם המקרקעין רשומים.', false, 'בחירה זו שגויה. סמכות בית משפט השלום בתביעות לחזקה ושימוש אינה מותנית ברישום המקרקעין (ת"א (שלום י-ם) 34054-04-14, רפרנס 19).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סמכות מקומית בתביעה כספית',
    4, 'חברה קבלנית מתל אביב הגישה תביעה כספית נגד לקוח, תושב באר שבע, בגין חוב שלא שולם עבור עבודות בנייה שבוצעו בבאר שבע. החוזה נחתם בתל אביב. בהנחה שאין הסכם שיפוט, היכן ניתן להגיש את התביעה?', 'שאלה זו עוסקת בכללי הסמכות המקומית בתביעה כספית שאינה במקרקעין, תוך התמקדות בשינויים שהביאו תקנות סדר הדין האזרחי, תשע"ט-2018. היא מדגישה את צמצום חלופות הסמכות המקומית לעומת התקנות הישנות, ואת החשיבות של מקום מגורי הנתבע או מקום המעשה/מחדל.', 'תקנה 7(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי ''תובענה תוגש לבית המשפט המצוי במחוז שיפוט של מקום מגוריו או מקום עסקו של הנתבע או במקום המעשה או המחדל שבשלו תובעים''. התקנות החדשות צמצמו משמעותית את היקף הזיקות ששימשו יסוד לרכישת סמכות שיפוט מקומית בהתאם לתקנות הישנות, והשמיטו חלופות כמו ''מקום יצירת ההתחייבות'' ו''המקום שנועד לקיום ההתחייבות'' (ת"א (מחוזי מרכז) 28175-02-24, רפרנס 20, 21, 47, 64; תאד"מ (שלום י-ם) 29023-11-23, רפרנס 41). במקרה הנדון, מקום מגורי הנתבע הוא באר שבע, ולכן בית משפט השלום בבאר שבע הוא בעל סמכות מקומית. ''מקום המעשה או המחדל'' מתייחס לרוב לתביעות נזיקין או למקום בו בוצע המעשה/מחדל, ולא למקום בו נועדה ההתחייבות להתקיים (רע"א (מחוזי חי'') 52095-10-24, רפרנס 37).',
    'הטעות הנפוצה היא להסתמך על חלופות הסמכות המקומית שהיו קיימות בתקנות הישנות אך בוטלו בתקנות החדשות, או לפרש את חלופת ''מקום המעשה או המחדל'' באופן רחב מדי.', '["סמכות מקומית", "תקנה 7 לתקסד\"א", "מקום מגורי הנתבע", "מקום עסקו של הנתבע", "מקום המעשה או המחדל", "תקנות סדר הדין האזרחי החדשות"]'::jsonb, '**וריאציה 1 — היכן מגישים תביעה כספית?** ← מקום מגורי/עסקו של הנתבע, או מקום המעשה/מחדל (תקנה 7(א) לתקסד"א, רפרנס 42).
**וריאציה 2 — האם ''מקום יצירת ההתחייבות'' עדיין חלופה?** ← לא, הושמטה בתקנות החדשות (ת"א (מחוזי מרכז) 28175-02-24, רפרנס 21).
**וריאציה 3 — מהי הפרשנות של ''מקום המעשה או המחדל''?** ← לרוב מתייחס לתביעות נזיקין או למקום ביצוע המעשה/מחדל, לא למקום קיום ההתחייבות (רע"א (מחוזי חי'') 52095-10-24, רפרנס 37).', 'סמכות מקומית (לא מקרקעין) ← מקום מגורי/עסקו של הנתבע ← או מקום המעשה/מחדל ← חלופות מצומצמות בתקנות החדשות.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 7", "ת\"א (מחוזי מרכז) 28175-02-24 ירון אידלסון נ'' עו\"ד אבירם דוויק (23.6.2024)", "רע\"א (מחוזי חי'') 52095-10-24 עיריית אור עקיבא נ'' אאורה השקעות בע\"מ (11.12.2024)", "תאד\"מ (שלום י-ם) 29023-11-23 אנה לבה נ'' סרגיי סורנייב (2.3.2024)", "ת\"ט (שלום רמ'') 57140-12-24 קליימן.גיגי בע\"מ נ'' מורן גידור בע\"מ (18.2.2025)", "ת\"א (מחוזי נצ'') 52816-03-21 ע.ע. אבו ראס- חברה לעבודות בנין ופיתוח בע\"מ נ'' אורן אדרי (13.1.2022)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'רק בבית משפט השלום בבאר שבע, שכן מקום מגורי הנתבע הוא הקובע.', true, 'בחירה זו נכונה. תקנה 7(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת חלופות מצומצמות לסמכות מקומית, ובתביעה כספית שאינה במקרקעין, מקום מגורי הנתבע הוא אחת החלופות העיקריות (ת"ט (שלום רמ'') 57140-12-24, רפרנס 42).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'בבית משפט השלום בתל אביב (מקום חתימת החוזה) או בבית משפט השלום בבאר שבע (מקום ביצוע העבודות).', false, 'בחירה זו שגויה. ''מקום יצירת ההתחייבות'' (חתימת החוזה) ו''מקום קיום ההתחייבות'' (ביצוע העבודות) הושמטו כחלופות עצמאיות בתקנות סדר הדין האזרחי החדשות (ת"א (מחוזי מרכז) 28175-02-24, רפרנס 20, 21, 47, 64).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'בבית משפט השלום בתל אביב (מקום עסקו של התובע) או בבית משפט השלום בבאר שבע (מקום מגורי הנתבע).', false, 'בחירה זו שגויה. מקום עסקו של התובע אינו חלופה לסמכות מקומית בתביעה כספית רגילה, למעט חריגים ספציפיים (כגון תביעת עוסק בפרסום/סחר באינטרנט, תקנה 7(ב) לתקנות, רפרנס 57).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'בכל בית משפט שלום בישראל, שכן הסמכות המקומית אינה מהותית במדינה קטנה כישראל.', false, 'בחירה זו שגויה. אף שמעמד הסמכות המקומית פחת, עדיין קיימים כללים ברורים לקביעתה, ואין חופש מוחלט לבחור כל בית משפט (ת"א (מחוזי ב"ש) 31917-02-22, רפרנס 32).', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 22, '2022-S-Q22';
END
$$;

-- ============================================================
-- Q23 — 2022-S-Q23 — chapter=criminal_proc subtopic=charges_withdrawal  [needs_review]
-- classifier_note: AG decision to stay proceedings (עיכוב הליכים) after prosecution rested — closest fit is charges_withdrawal; the JSON's own review_note recommends adding a 'stay of proceedings' subtopic
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '6c4053a4-4a6c-4263-8611-8c96cd5289be'::uuid;
  v_group_id uuid := 'b592ee1c-652d-4ff8-bd5d-3a5a094e6d84'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '3899c6fb-7ecd-4942-a6a3-09411ff11d47'::uuid;
  v_ang_1 uuid := '0064558e-df2f-47be-a4fd-ef6352696f19'::uuid;
  v_ang_2 uuid := 'c7c20fd4-3bce-40b6-8609-6f45e12f43ea'::uuid;
  v_ang_3 uuid := 'b2bca12f-8648-4c03-8234-e191a801a8ad'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q23';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 23, '2022-S-Q23';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'charges_withdrawal' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'charges_withdrawal', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q23', v_chapter_id, v_subtopic_id, 'נגד יעל הוגש כתב אישום לבית המשפט המחוזי בירושלים. יעל פנתה ליועץ המשפטי לממשלה בבקשה לעיכוב הליכים. היועץ המשפטי לממשלה החליט בהודעה מנומקת בכתב לקבל את בקשתה לאחר שהתביעה סיימה את הבאת ראיותיה בפני בית המשפט ולפני תחילת פרשת ההגנה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 23}'::jsonb, 'שאלה זו עוסקת בסמכותו הייחודית של היועץ המשפטי לממשלה לעכב הליכים פליליים, ובחובת בית המשפט להפסיק את ההליכים עם קבלת הודעה כזו. היא בוחנת את הוראות סעיף 231 לחוק סדר הדין הפלילי, המעניק ליועץ המשפטי לממשלה כלי רב עוצמה להשפעה על ניהול ההליך הפלילי, תוך שמירה על האינטרס הציבורי, ומדגישה את תפקידו המיניסטריאלי של בית המשפט במצב זה.', 'סעיף 231(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי "בכל עת שלאחר הגשת כתב אישום ולפני הכרעת הדין, רשאי היועץ המשפטי לממשלה, בהודעה מנומקת בכתב לבית המשפט, לעכב את הליכי המשפט; הוגשה הודעה כאמור יפסיק בית המשפט את ההליכים באותו משפט". לשון החוק ברורה וחד משמעית: משעה שהיועץ המשפטי לממשלה (או מי שהוסמך על ידו) החליט לעכב הליכים והגיש הודעה מנומקת בכתב לבית המשפט, חובה על בית המשפט להפסיק את ההליכים. לבית המשפט אין שיקול דעת בעניין זה, ותפקידו הוא מיניסטריאלי בלבד (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31, 34, 35; ת"פ (מחוזי חי'') 30099-12-13 מדינת ישראל נ'' עלא אגבאריה, רפרנס 9, 10, 11, 14, 16, 17, 18). סמכות זו נתונה ליועץ המשפטי לממשלה בכל שלב שלאחר הגשת כתב האישום ולפני הכרעת הדין (רפרנס 1, 4, 10, 16, 17, 27, 55, 58, 59, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71).', 'הטעות הנפוצה היא לחשוב שלבית המשפט יש שיקול דעת אם להפסיק את ההליכים בעקבות הודעת היועץ המשפטי לממשלה, או לבלבל בין סמכות זו לבין סמכויות אחרות של בית המשפט בהליך הפלילי.',
    '["עיכוב הליכים", "יועץ משפטי לממשלה", "חוק סדר הדין הפלילי", "תפקיד בית המשפט", "הליך פלילי", "הודעה מנומקת"]'::jsonb, '**וריאציה 1 — מה קורה כשיועץ משפטי לממשלה מודיע על עיכוב הליכים?** ← בית המשפט חייב להפסיק את ההליכים (סעיף 231(א) לחוק סדר הדין הפלילי).
**וריאציה 2 — האם לבית המשפט יש שיקול דעת?** ← לא, תפקידו מיניסטריאלי בלבד (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31).
**וריאציה 3 — עד איזה שלב ניתן לעכב הליכים?** ← בכל עת שלאחר הגשת כתב אישום ולפני הכרעת הדין (סעיף 231(א) לחוק סדר הדין הפלילי).', 'עיכוב הליכים ← יועץ משפטי לממשלה ← בית המשפט חייב להפסיק ← ללא שיקול דעת.', '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 231", "בג\"ץ 4723/96 אביבית עטייה נ'' היועץ המשפטי לממשלה, נא(3) 714 (1997)", "ת\"פ (מחוזי חי'') 30099-12-13 מדינת ישראל נ'' עלא אגבאריה (12.4.2015)", "רע\"פ 7926-06-25 מנחם מנדל קובלקין נ'' מדינת ישראל (18.8.2025)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''חזרה מאישום'' → mapped chapter=''criminal_proc'' subtopic=''charges_withdrawal'' | classifier_note: AG decision to stay proceedings (עיכוב הליכים) after prosecution rested — closest fit is charges_withdrawal; the JSON''s own review_note recommends adding a ''stay of proceedings'' subtopic | source_review_note: הסב-נושא ''חזרה מאישום'' אינו מתאים במדויק לשאלת המקור העוסקת ב''עיכוב הליכים''. יש לשקול הוספת סב-נושא ''עיכוב הליכים'' תחת פרק ''סדר דין פלילי'' כדי לשקף טוב יותר את נושא השאלה.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'חובה על בית המשפט להפסיק את ההליכים באותו משפט.', true, 'בחירה זו נכונה. סעיף 231(א) לחוק סדר הדין הפלילי קובע כי משעה שהוגשה הודעה על עיכוב הליכים על ידי היועץ המשפטי לממשלה, חובה על בית המשפט להפסיק את ההליכים באותו משפט.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט רשאי להפסיק את ההליכים באותו משפט לפי שיקול דעתו.', false, 'בחירה זו שגויה. תפקידו של בית המשפט בעת קבלת הודעה על עיכוב הליכים הוא מיניסטריאלי בלבד, ואין לו שיקול דעת אם להפסיק את ההליכים או לאו (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט רשאי להפסיק את ההליכים באותו משפט רק אם לפי נסיבות העניין לא הוכחה אשמתה של יעל אף לכאורה.', false, 'בחירה זו שגויה. שיקולים ראייתיים אינם רלוונטיים להחלטת בית המשפט להפסיק הליכים בעקבות הודעת היועץ המשפטי לממשלה, והם נתונים לשיקול דעתו של היועץ המשפטי לממשלה בלבד (בג"ץ 4723/96 עטייה, רפרנס 3).', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בשלב זה בית המשפט אינו רשאי להפסיק את ההליכים.', false, 'בחירה זו שגויה. סעיף 231(א) לחוק סדר הדין הפלילי קובע כי עיכוב הליכים אפשרי "בכל עת שלאחר הגשת כתב אישום ולפני הכרעת הדין", כך שהשלב הדיוני המתואר בשאלה מאפשר את עיכוב ההליכים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'עיכוב הליכים בבית דין צבאי',
    1, 'נגד חייל הוגש כתב אישום לבית דין צבאי. החייל פנה ליועץ המשפטי לממשלה בבקשה לעיכוב הליכים. האם היועץ המשפטי לממשלה מוסמך לעכב הליכים המתנהלים בבית דין צבאי?', 'שאלה זו עוסקת בהיקף סמכותו של היועץ המשפטי לממשלה לעכב הליכים פליליים, ובפרט בשאלה האם סמכות זו חלה גם על הליכים המתנהלים בבתי דין צבאיים. היא בוחנת את היחס בין חוק סדר הדין הפלילי לחוק השיפוט הצבאי, ומדגישה את העיקרון לפיו חוק השיפוט הצבאי מהווה הסדר ייחודי ושלם לעניין זה.', 'סעיף 231 לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, מקנה ליועץ המשפטי לממשלה סמכות לעכב הליכים פליליים. אולם, סעיף 2 לחוק סדר הדין הפלילי קובע כי סדר הדין הפלילי יהיה לפי חוק זה, "זולת אם נקבע בחוק אחר או על פיו סדר דין שונה לענין הנדון". בבג"ץ 4723/96 עטייה נ'' היועץ המשפטי לממשלה, קבע בית המשפט העליון בדעת רוב כי חוק השיפוט הצבאי מהווה "סדר דין שונה לעניין הנדון", ולכן סמכות היועץ המשפטי לממשלה לעכב הליכים אינה חלה על הליכים המתנהלים בבתי דין צבאיים (רפרנס 1, 4, 21). חוק השיפוט הצבאי קובע הסדרים ייחודיים להפסקת הליכים, כגון סמכות הפרקליט הצבאי הראשי לבטל כתב אישום (סעיף 308 לחוק השיפוט הצבאי), המותאמים למתכונת השיפוט הצבאי (רפרנס 1, 14, 21).',
    'הטעות הנפוצה היא להניח שאחידות סדר הדין הפלילי חלה באופן גורף על כלל מערכות המשפט, מבלי להבחין בחריגים הקבועים בחוקים ספציפיים כמו חוק השיפוט הצבאי.', '["עיכוב הליכים", "יועץ משפטי לממשלה", "חוק סדר הדין הפלילי", "חוק השיפוט הצבאי", "סמכות שיפוט", "סדר דין שונה"]'::jsonb, '**וריאציה 1 — האם היועץ המשפטי לממשלה יכול לעכב הליכים בבית דין צבאי?** ← לא, חוק השיפוט הצבאי הוא "סדר דין שונה" (בג"ץ 4723/96 עטייה, רפרנס 1).
**וריאציה 2 — מהו הבסיס המשפטי לכך?** ← סעיף 2 לחוק סדר הדין הפלילי, המאפשר חריגה מהכלל אם נקבע סדר דין שונה (בג"ץ 4723/96 עטייה, רפרנס 1).
**וריאציה 3 — מי מוסמך להפסיק הליכים בבית דין צבאי?** ← הפרקליט הצבאי הראשי, באמצעות ביטול כתב אישום (סעיף 308 לחוק השיפוט הצבאי, רפרנס 12).', 'עיכוב הליכים בבתי דין צבאיים ← לא בסמכות היועץ המשפטי לממשלה ← חוק השיפוט הצבאי הוא סדר דין ייחודי.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיפים 2, 231", "בג\"ץ 4723/96 אביבית עטייה נ'' היועץ המשפטי לממשלה, נא(3) 714 (1997)", "חוק השיפוט הצבאי, תשט\"ו-1955, סעיף 308"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'לא, היועץ המשפטי לממשלה אינו מוסמך לעכב הליכים המתנהלים בבית דין צבאי, שכן חוק השיפוט הצבאי קובע סדר דין שונה לעניין זה.', true, 'בחירה זו נכונה. בבג"ץ 4723/96 עטייה נקבע בדעת רוב כי חוק השיפוט הצבאי מהווה "סדר דין שונה לעניין הנדון" כמשמעותו בסעיף 2 לחוק סדר הדין הפלילי, ולכן סמכות היועץ המשפטי לממשלה לעכב הליכים אינה חלה על הליכים בבתי דין צבאיים (רפרנס 1, 4, 21).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'כן, היועץ המשפטי לממשלה מוסמך לעכב הליכים בבית דין צבאי, שכן סעיף 2 לחוק סדר הדין הפלילי קובע את אחידות סדר הדין הפלילי.', false, 'בחירה זו שגויה. אף שסעיף 2 לחוק סדר הדין הפלילי קובע כלל אחידות, הוא מסייג זאת במקרה שנקבע "סדר דין שונה לעניין הנדון", וחוק השיפוט הצבאי נחשב ככזה (בג"ץ 4723/96 עטייה, רפרנס 1, 4).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק אם הפרקליט הצבאי הראשי מסכים לכך.', false, 'בחירה זו שגויה. סמכות היועץ המשפטי לממשלה אינה תלויה בהסכמת הפרקליט הצבאי הראשי, והיא אינה קיימת כלל בהליכים צבאיים (בג"ץ 4723/96 עטייה, רפרנס 1, 4).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'כן, אך רק בעבירות שאינן פשע.', false, 'בחירה זו שגויה. הגבלת הסמכות לעבירות שאינן פשע מתייחסת לאצילת סמכות היועץ המשפטי לממשלה לגורמים אחרים, ולא לעצם סמכותו המקורית, שאינה חלה על הליכים צבאיים (סעיף 231(ב) לחוק סדר הדין הפלילי, רפרנס 1).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'שיקולי היועץ המשפטי לעיכוב הליכים',
    2, 'מהם השיקולים המרכזיים המנחים את היועץ המשפטי לממשלה בהחלטתו לעכב הליכים פליליים?', 'שאלה זו מתמקדת בשיקול הדעת הרחב והייחודי של היועץ המשפטי לממשלה בעת הפעלת סמכותו לעיכוב הליכים פליליים. היא מבהירה את אופייה המעין-שיפוטי של סמכות זו, את השיקולים המנחים אותה (נסיבות יוצאות דופן, עניין ציבורי), ואת ההבחנה בינה לבין שיקולים ראייתיים, אשר אינם מהווים עילה לעיכוב הליכים.', 'הסמכות לעיכוב הליכים המסורה ליועץ המשפטי לממשלה היא בעלת אופי מיוחד, מעין-שיפוטי, ועיקרה במתן ביטוי ל"עניין הציבורי" שעליו מופקד היועץ המשפטי לממשלה (בג"ץ 4723/96 עטייה, רפרנס 2, 3, 13, 22, 23, 29, 34, 35, 44, 50). על פי הנחיות היועץ המשפטי לממשלה (הנחיה 4.3030), "ההחלטה לעכב הליכים תינתן רק על יסוד טעמים יוצאי דופן, הנובעים מנסיבות מיוחדות של העבירה או מנימוקים אישיים מיוחדים של הנאשם" (רפרנס 3, 8, 13, 17, 20, 23, 24, 44, 48, 54). טעמים ראייתיים או טעמים הנוגעים להרשעה, שניתן להעלותם בפני בית המשפט, לא יהוו נימוק לעיכוב הליכים (רפרנס 3, 13, 23, 44). בג"ץ אינו נוטה להתערב בשיקול דעת זה אלא במקרים חריגים של חוסר סבירות קיצוני (בג"ץ 3272/24 פלוני, רפרנס 22, 23, 25).',
    'הטעות הנפוצה היא לבלבל בין שיקולי היועץ המשפטי לממשלה לעיכוב הליכים לבין שיקולים של תובע לחזור מאישום, או לחשוב שטענות ראייתיות יכולות להוות עילה לעיכוב הליכים.', '["עיכוב הליכים", "יועץ משפטי לממשלה", "שיקול דעת", "עניין ציבורי", "נסיבות מיוחדות", "הנחיות היועץ המשפטי לממשלה"]'::jsonb, '**וריאציה 1 — מהם השיקולים העיקריים לעיכוב הליכים?** ← טעמים יוצאי דופן, נסיבות מיוחדות של העבירה/נאשם, ועניין ציבורי (הנחיית היועץ המשפטי לממשלה 4.3030, רפרנס 3, 8).
**וריאציה 2 — האם טעמים ראייתיים מצדיקים עיכוב הליכים?** ← לא, ככלל טעמים ראייתיים אינם נימוק לעיכוב הליכים (בג"ץ 4723/96 עטייה, רפרנס 3).
**וריאציה 3 — מהי מידת הביקורת השיפוטית על החלטת היועץ המשפטי לממשלה?** ← מצומצמת ושמורה למקרים חריגים של חוסר סבירות קיצוני (בג"ץ 3272/24 פלוני, רפרנס 22, 25).', 'עיכוב הליכים ← טעמים יוצאי דופן + עניין ציבורי ← לא ראיות ← ביקורת בג"ץ מצומצמת.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 231", "בג\"ץ 4723/96 אביבית עטייה נ'' היועץ המשפטי לממשלה, נא(3) 714 (1997)", "בג\"ץ 3272/24 פלוני נ'' היועצת המשפטית לממשלה (1.7.2024)", "הנחיות היועץ המשפטי לממשלה 4.3030 \"עיכוב הליכים פליליים\" (27.7.2014)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'החלטה לעכב הליכים תינתן רק על יסוד טעמים יוצאי דופן, הנובעים מנסיבות מיוחדות של העבירה או מנימוקים אישיים מיוחדים של הנאשם, תוך שקילת "העניין הציבורי" בהמשך ההליכים הפליליים, ולא מטעמים ראייתיים.', true, 'בחירה זו נכונה. הנחיות היועץ המשפטי לממשלה ופסיקת בית המשפט העליון קובעות כי עיכוב הליכים הוא סמכות חריגה המופעלת מטעמים יוצאי דופן, תוך התחשבות בנסיבות העבירה, נסיבות אישיות של הנאשם והאינטרס הציבורי, אך לא מטעמים ראייתיים (בג"ץ 4723/96 עטייה, רפרנס 3, 13, 23, 44; הנחיית היועץ המשפטי לממשלה 4.3030, רפרנס 8, 17, 20, 24, 54).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'היועץ המשפטי לממשלה רשאי לעכב הליכים מכל טעם שימצא לנכון, לרבות טעמים ראייתיים, שכן סמכותו רחבה ואינה מוגבלת.', false, 'בחירה זו שגויה. אף שסמכות היועץ המשפטי לממשלה רחבה, היא אינה בלתי מוגבלת, והנחיותיו קובעות כי טעמים ראייתיים אינם מהווים נימוק לעיכוב הליכים (בג"ץ 4723/96 עטייה, רפרנס 3, 13, 23, 44).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'השיקול המרכזי הוא מצבו הכלכלי של הנאשם, וכן האם הנאשם הביע חרטה על מעשיו.', false, 'בחירה זו שגויה. מצב כלכלי או חרטה יכולים להיות חלק מ"נימוקים אישיים מיוחדים", אך אינם השיקולים המרכזיים היחידים, ונדרשים טעמים יוצאי דופן (הנחיית היועץ המשפפטי לממשלה 4.3030, רפרנס 8, 17, 20, 24, 54).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'היועץ המשפטי לממשלה יתחשב בעיקר בעמדת בית המשפט המנהל את התיק, ובמידת העומס על מערכת המשפט.', false, 'בחירה זו שגויה. עמדת בית המשפט אינה שיקול מנחה בהחלטת היועץ המשפטי לממשלה, ותפקידו של בית המשפט הוא מיניסטריאלי בלבד בעת קבלת הודעה על עיכוב הליכים (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חידוש הליכים לאחר עיכוב',
    3, 'נגד ראובן עוכבו הליכים פליליים בעבירת פשע על ידי היועץ המשפטי לממשלה. בחלוף 3 שנים מיום העיכוב, החליט היועץ המשפטי לממשלה לחדש את ההליכים. מה הדין?', 'שאלה זו עוסקת בסמכות היועץ המשפטי לממשלה לחדש הליכים פליליים שעוכבו, ובמגבלות הזמן החלות על סמכות זו. היא בוחנת את הוראות סעיף 232 לחוק סדר הדין הפלילי, המבחין בין עבירות פשע לעוון לעניין תקופת חידוש ההליכים, ומדגישה את תפקידו המיניסטריאלי של בית המשפט בעת קבלת הודעה על חידוש הליכים.', 'סעיף 232 לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי "עוכבו הליכים לפי סעיף 231 רשאי היועץ המשפטי לממשלה, בהודעה בכתב לבית המשפט, לחדשם כל עוד לא עברו מיום עיכובם, בפשע חמש שנים, ובעוון שנה". במקרה הנדון מדובר בעבירת פשע, וחלפו 3 שנים, ולכן היועץ המשפטי לממשלה רשאי לחדש את ההליכים. משעה שהוגשה הודעה כאמור, "יחדש בית המשפט את ההליכים, ורשאי הוא להמשיך בהם מן השלב שאליו הגיע לפני ההפסקה" (רפרנס 8, 30, 31, 34). תפקידו של בית המשפט הוא מיניסטריאלי, ואין לו שיקול דעת לסרב לחידוש ההליכים (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31). אם עוכבו ההליכים בשנייה, לא ניתן עוד לחדשם (סעיף 232 סיפא, רפרנס 8, 34, 36).',
    'הטעות הנפוצה היא לבלבל בין תקופות הזמן לחידוש הליכים בפשע ובעוון, או לחשוב שלבית המשפט יש שיקול דעת לסרב לחידוש הליכים על ידי היועץ המשפטי לממשלה.', '["חידוש הליכים", "עיכוב הליכים", "יועץ משפטי לממשלה", "חוק סדר הדין הפלילי", "פשע", "עוון", "תפקיד בית המשפט"]'::jsonb, '**וריאציה 1 — מתי ניתן לחדש הליכים שעוכבו בפשע?** ← כל עוד לא עברו 5 שנים מיום העיכוב (סעיף 232 לחוק סדר הדין הפלילי, רפרנס 8).
**וריאציה 2 — מה תפקיד בית המשפט בחידוש הליכים?** ← חובה עליו לחדשם, ללא שיקול דעת (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31).
**וריאציה 3 — מה קורה אם ההליכים עוכבו פעמיים?** ← לא ניתן לחדשם שוב (סעיף 232 סיפא לחוק סדר הדין הפלילי, רפרנס 8).', 'חידוש הליכים ← יועץ משפטי לממשלה ← 5 שנים לפשע, שנה לעוון ← בית המשפט חייב לחדש.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 232", "רע\"פ 7926-06-25 מנחם מנדל קובלקין נ'' מדינת ישראל (18.8.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'היועץ המשפטי לממשלה רשאי לחדש את ההליכים, ובית המשפט חייב לחדשם ולהמשיך בהם מהשלב שאליו הגיעו לפני ההפסקה.', true, 'בחירה זו נכונה. סעיף 232 לחוק סדר הדין הפלילי קובע כי היועץ המשפטי לממשלה רשאי לחדש הליכים שעוכבו בפשע כל עוד לא עברו 5 שנים מיום העיכוב, ובית המשפט חייב לחדשם (רפרנס 8, 30, 31, 34).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'היועץ המשפטי לממשלה אינו רשאי לחדש את ההליכים, שכן חלפו למעלה משנה מיום העיכוב.', false, 'בחירה זו שגויה. הגבלת הזמן לשנה חלה על עבירות עוון, ואילו בעבירות פשע ניתן לחדש הליכים עד 5 שנים מיום העיכוב (סעיף 232 לחוק סדר הדין הפלילי, רפרנס 8, 30, 34).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'היועץ המשפטי לממשלה רשאי לחדש את ההליכים, אך בית המשפט רשאי לסרב לחדשם אם סבור שהדבר יגרום עוול לנאשם.', false, 'בחירה זו שגויה. תפקידו של בית המשפט בעת קבלת הודעה על חידוש הליכים הוא מיניסטריאלי בלבד, ואין לו שיקול דעת אם לחדש את ההליכים או לאו (רע"פ 7926-06-25 קובלקין, רפרנס 30, 31).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'היועץ המשפטי לממשלה רשאי לחדש את ההליכים רק אם התגלו ראיות חדשות המצדיקות זאת.', false, 'בחירה זו שגויה. סעיף 232 לחוק סדר הדין הפלילי אינו מציב תנאי של גילוי ראיות חדשות לחידוש הליכים, אלא מגבלת זמן בלבד (רפרנס 8, 30, 34).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'הבחנה בין עיכוב הליכים לחזרה מאישום',
    4, 'מהו ההבדל המהותי בין סמכות היועץ המשפטי לממשלה לעכב הליכים פליליים לבין סמכות תובע לחזור מאישום?', 'שאלה זו עוסקת בהבחנה בין שני מנגנונים שונים להפסקת הליכים פליליים: עיכוב הליכים על ידי היועץ המשפטי לממשלה וחזרה מאישום על ידי תובע. היא מדגישה את ההבדלים המהותיים ביניהם מבחינת הגורם המוסמך, אופי ההחלטה (זמנית מול סופית) והתוצאה המשפטית (הקפאה מול ביטול/זיכוי), כפי שנקבעו בחוק סדר הדין הפלילי ובפסיקה.', 'חוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע שני מסלולים עיקריים להפסקת הליך פלילי: עיכוב הליכים (סעיפים 231-232) וחזרה מאישום (סעיפים 93-94). סמכות עיכוב הליכים נתונה ליועץ המשפטי לממשלה (או למי שהוסמך על ידו), והיא בעלת אופי מיוחד, מעין-שיפוטי, המופעלת משיקולי "עניין ציבורי" (בג"ץ 4723/96 עטייה, רפרנס 3, 13, 22, 29, 34, 35, 44, 50). עיכוב הליכים אינו סופי, וניתן לחדשם בתוך תקופות זמן קבועות בחוק (5 שנים לפשע, שנה לעוון), ואינו מביא לזיכוי הנאשם (רפרנס 3, 8, 13, 14, 15, 17, 28, 30, 31, 34, 36, 41). לעומת זאת, סמכות חזרה מאישום נתונה לכל תובע, והיא מופעלת בדרך כלל משיקולים ראייתיים (רפרנס 3, 13, 14, 22, 50). חזרה מאישום היא סופית, ותוצאותיה הן ביטול האישום (אם לפני תשובת הנאשם) או זיכוי הנאשם (אם לאחר תשובת הנאשם) (סעיף 94 לחוק סדר הדין הפלילי, רפרנס 14, 15, 19, 21, 30, 31, 33, 41, 43).',
    'הטעות הנפוצה היא לראות בעיכוב הליכים כשוות ערך לזיכוי, או לבלבל בין הגורמים המוסמכים להפעלת כל אחת מהסמכויות.', '["עיכוב הליכים", "חזרה מאישום", "יועץ משפטי לממשלה", "תובע", "חוק סדר הדין הפלילי", "זיכוי", "ביטול אישום"]'::jsonb, '**וריאציה 1 — מי מוסמך לעכב הליכים ומי לחזור מאישום?** ← עיכוב: יועץ משפטי לממשלה. חזרה: כל תובע (בג"ץ 4723/96 עטייה, רפרנס 3, 13).
**וריאציה 2 — מהי התוצאה של עיכוב הליכים לעומת חזרה מאישום?** ← עיכוב: הקפאת ההליך, לא זיכוי. חזרה: ביטול אישום או זיכוי (סעיף 94 לחוק סדר הדין הפלילי, רפרנס 14, 15).
**וריאציה 3 — האם עיכוב הליכים הוא סופי?** ← לא, הוא זמני וניתן לחידוש (סעיף 232 לחוק סדר הדין הפלילי, רפרנס 8, 14).', 'עיכוב הליכים ← יועץ משפטי לממשלה, זמני, לא זיכוי. חזרה מאישום ← תובע, סופי, ביטול/זיכוי.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיפים 93, 94, 231, 232", "בג\"ץ 4723/96 אביבית עטייה נ'' היועץ המשפטי לממשלה, נא(3) 714 (1997)", "ע\"א (מחוזי ת\"א) 32947-07-22 חנן שניידר נ'' מדינת ישראל (7.7.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'עיכוב הליכים נעשה על ידי היועץ המשפטי לממשלה, הוא זמני ואינו מביא לזיכוי, בעוד חזרה מאישום נעשית על ידי כל תובע, היא סופית ויכולה להביא לביטול אישום או לזיכוי.', true, 'בחירה זו נכונה. עיכוב הליכים (סעיף 231) הוא סמכות ייחודית ליועץ המשפטי לממשלה, זמני וניתן לחידוש. חזרה מאישום (סעיף 93) היא סמכות של כל תובע, סופית, ומובילה לביטול אישום או לזיכוי (בג"ץ 4723/96 עטייה, רפרנס 3, 13, 14, 22, 50; ע"א (מחוזי ת"א) 32947-07-22 שניידר, רפרנס 5, 8, 15).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'עיכוב הליכים מביא לזיכוי הנאשם, בעוד חזרה מאישום מביאה לביטול כתב האישום בלבד.', false, 'בחירה זו שגויה. עיכוב הליכים אינו מביא לזיכוי, אלא להקפאת ההליך. חזרה מאישום יכולה להביא לזיכוי (לאחר תשובת הנאשם) או לביטול האישום (לפני תשובת הנאשם) (סעיף 94 לחוק סדר הדין הפלילי, רפרנס 14, 15, 19, 21, 30, 31, 33, 41, 43).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'חזרה מאישום היא הליך זמני הניתן לחידוש, בעוד עיכוב הליכים הוא הליך סופי.', false, 'בחירה זו שגויה. ההפך הוא הנכון: עיכוב הליכים הוא זמני וניתן לחידוש, בעוד חזרה מאישום היא סופית (בג"ץ 4723/96 עטייה, רפרנס 3, 13, 14, 22, 50).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'שתי הסמכויות דורשות את אישור היועץ המשפטי לממשלה, וההבדל הוא רק בדרג התובע המגיש את הבקשה.', false, 'בחירה זו שגויה. רק עיכוב הליכים הוא בסמכות היועץ המשפטי לממשלה (או מי שהוסמך על ידו). חזרה מאישום היא בסמכות כל תובע (בג"ץ 4723/96 עטייה, רפרנס 3, 13, 14, 22, 50).', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 23, '2022-S-Q23';
END
$$;

-- ============================================================
-- Q24 — 2022-S-Q24 — chapter=evidence subtopic=admissibility
-- classifier_note: Civil suit ancillary to criminal conviction — admissibility of criminal findings as evidence (סעיף 42א פקודת הראיות)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'c3b7cacb-1c53-46eb-9410-79ba787bfa0e'::uuid;
  v_group_id uuid := '97057bd9-8667-4407-b88a-dec00b6cd736'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'd8f9a720-3fc7-440c-9cf4-cf783e82c2ab'::uuid;
  v_ang_1 uuid := '0b8293ac-ee6c-45fd-8379-ad7fb7f88743'::uuid;
  v_ang_2 uuid := '952d0b4d-f2f4-44eb-93b0-4c29a8afa852'::uuid;
  v_ang_3 uuid := '46bb8e71-c126-4295-b251-8ef3b0d77675'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q24';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 24, '2022-S-Q24';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'evidence';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'evidence';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'admissibility' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'admissibility', 'evidence';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q24', v_chapter_id, v_subtopic_id, 'לאחר שבית משפט השלום בבאר שבע הרשיע את ערן בעבירת התקיפה שביצע כלפי עדית, הגישה עדית נגד ערן תובענה אזרחית נגררת להרשעה בפלילים. בהליך האזרחי מעוניין ערן להביא ראיה לסתור ממצא עובדתי אחד שנקבע במשפט הפלילי, אשר לטענתו היה שגוי. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 24}'::jsonb, 'השאלה עוסקת במעמד פסק דין פלילי מרשיע בתביעה אזרחית נגררת, ובפרט ביכולת הנתבע לסתור ממצאים עובדתיים שנקבעו בהליך הפלילי. היא מתמקדת בהוראת סעיף 42ד'' לפקודת הראיות, המעניקה לממצאים אלו תוקף של ראיה חלוטה שאינה ניתנת לסתירה.', 'סעיף 42ד'' לפקודת הראיות [נוסח חדש], התשל"א-1971, קובע כי ''בדיון בתביעה אזרחית לפי סעיף 35א לחוק בתי המשפט, תשי"ז-1957, יראו את הממצאים והמסקנות שנקבעו במשפט הפלילי כאילו נקבעו במשפט אזרחי''. סעיף 35א'' הנזכר הוחלף בסעיף 77 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984. משמעות הוראה זו היא כי בתביעה אזרחית נגררת להרשעה בפלילים, הממצאים והמסקנות שנקבעו בהליך הפלילי מקבלים תוקף של ראיה חלוטה, אשר ככלל אינה ניתנת לסתירה. זאת בניגוד למצב בתביעה אזרחית ''רגילה'' (שאינה נגררת), שם הממצאים הפליליים מהווים ''ראיה לכאורה'' בלבד, הניתנת לסתירה ברשות בית המשפט (סעיפים 42א-42ג'' לפקודת הראיות). לפיכך, ערן אינו רשאי להביא ראיה לסתור את הממצא העובדתי שנקבע בהליך הפלילי. ראו לעניין זה ת"א (שלום ת"א) 2220-01-18 מדינת ישראל- משרד הביטחון נ'' אבי שטרית (6.8.2021) וכן ת"א (שלום ת"א) 50058-08-16 פלוני נ'' גיא דיין (17.12.2021).', 'הבלבול בין מעמד פסק הדין הפלילי בתביעה אזרחית נגררת (ראיה חלוטה) לבין מעמדו בתביעה אזרחית רגילה (ראיה לכאורה הניתנת לסתירה ברשות בית המשפט).',
    '["פקודת הראיות", "תביעה אזרחית נגררת", "פסק דין פלילי", "ראיה חלוטה", "ממצאים ומסקנות", "חוק בתי המשפט"]'::jsonb, '**וריאציה 1 — תביעה נגררת:** האם ניתן לסתור ממצאים מפלילים בתביעה נגררת? ← לא, ראיה חלוטה (סעיף 42ד'' לפקודת הראיות).
**וריאציה 2 — תביעה אזרחית רגילה:** האם ניתן לסתור ממצאים מפלילים בתביעה אזרחית רגילה? ← כן, ברשות בית המשפט (סעיפים 42א(א) ו-42ג'' לפקודת הראיות).
**וריאציה 3 — רציונל:** מדוע קיימת הבחנה זו? ← למנוע כפילות הליכים ולחסוך זמן שיפוטי בתביעה נגררת, תוך שמירה על זכות הטיעון בתביעה רגילה.', 'בתביעה אזרחית נגררת ← ממצאים פליליים הם ראיה חלוטה ← לא ניתנים לסתירה.', '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 42ד", "חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 77", "ת\"א (שלום ת\"א) 2220-01-18 מדינת ישראל- משרד הביטחון נ'' אבי שטרית (6.8.2021)", "ת\"א (שלום ת\"א) 50058-08-16 פלוני נ'' גיא דיין (17.12.2021)"]'::jsonb,
    'classification_review: original chapter=''דיני ראיות'' subtopic=''קבילות ראיות'' → mapped chapter=''evidence'' subtopic=''admissibility'' | classifier_note: Civil suit ancillary to criminal conviction — admissibility of criminal findings as evidence (סעיף 42א פקודת הראיות)', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ערן רשאי להביא ראיה לסתור את הממצא העובדתי.', false, 'טענה זו שגויה, שכן סעיף 42ד'' לפקודת הראיות קובע כי ממצאים ומסקנות שנקבעו במשפט הפלילי בתביעה אזרחית נגררת הם ראיה חלוטה שאינה ניתנת לסתירה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'ערן אינו רשאי להביא ראיה לסתור את הממצא העובדתי אלא ברשות בית המשפט.', false, 'אפשרות זו מתארת את המצב בתביעה אזרחית רגילה (שאינה נגררת) לפי סעיף 42ג'' לפקודת הראיות, אך לא בתביעה אזרחית נגררת לפי סעיף 42ד''.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ערן רשאי להביא ראיה לסתור את הממצא העובדתי רק ברשות בית המשפט, מטעמים שיירשמו וכדי למנוע עיוות דין.', false, 'אפשרות זו מתארת את התנאים להבאת ראיה לסתור בתביעה אזרחית רגילה (שאינה נגררת) לפי סעיף 42ג'' לפקודת הראיות, אך לא בתביעה אזרחית נגררת.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ערן אינו רשאי להביא ראיה לסתור את הממצא העובדתי.', true, 'בתביעה אזרחית נגררת להרשעה בפלילים, הממצאים והמסקנות שנקבעו במשפט הפלילי נחשבים לראיה חלוטה שאינה ניתנת לסתירה, בהתאם לסעיף 42ד'' לפקודת הראיות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'השפעת הרשעה פלילית על תביעה אזרחית ''רגילה''',
    1, 'ראובן הורשע בפלילים בתקיפת שמעון. שמעון הגיש תביעה אזרחית ''רגילה'' (שאינה נגררת) נגד ראובן בגין נזקי התקיפה. ראובן מעוניין להביא ראיות לסתור את הממצאים העובדתיים שנקבעו בהליך הפלילי. מה הדין?', 'שאלה זו בוחנת את ההבחנה המהותית בין תביעה אזרחית נגררת להרשעה בפלילים לבין תביעה אזרחית רגילה, בכל הנוגע למעמד פסק הדין הפלילי כראיה. ההבחנה קריטית להבנת היקף הדיון האזרחי והיכולת לסתור ממצאים עובדתיים.', 'סעיף 42א(א) לפקודת הראיות קובע כי ממצאים ומסקנות של פסק דין חלוט במשפט פלילי, המרשיע את הנאשם, יהיו קבילים במשפט אזרחי כראיה לכאורה. סעיף 42ג'' לפקודה מוסיף כי המורשע לא יהיה רשאי להביא ראיה לסתור, אלא ברשות בית המשפט, מטעמים שיירשמו וכדי למנוע עיוות דין. זאת בניגוד לסעיף 42ד'' החל על תביעה נגררת, הקובע כי הממצאים והמסקנות ייראו כאילו נקבעו במשפט האזרחי, כלומר כראיה חלוטה שאינה ניתנת לסתירה. ההחלטה ת"א (שלום י-ם) 34559-09-16 ו"פ נ'' נ"ח (16.8.2022) מדגישה כי כאשר לא הוגשה בקשה להבאת ראיות לסתור, מעמדה של הכרעת הדין הפלילית עולה מדרגת ''ראיה לכאורה'' לדרגת ''ראיה כמעט מכרעת''.',
    'הבלבול בין מעמד פסק הדין הפלילי בתביעה אזרחית רגילה (ראיה לכאורה הניתנת לסתירה ברשות בית המשפט) לבין מעמדו בתביעה אזרחית נגררת (ראיה חלוטה שאינה ניתנת לסתירה).', '["פקודת הראיות", "ראיה לכאורה", "ראיה חלוטה", "תביעה אזרחית רגילה", "הבאת ראיות לסתור", "עיוות דין"]'::jsonb, '**וריאציה 1 — תביעה נגררת:** האם ניתן לסתור ממצאים מפלילים בתביעה נגררת? ← לא, ראיה חלוטה (סעיף 42ד'' לפקודת הראיות).
**וריאציה 2 — תביעה אזרחית רגילה:** האם ניתן לסתור ממצאים מפלילים בתביעה אזרחית רגילה? ← כן, ברשות בית המשפט (סעיפים 42א(א) ו-42ג'' לפקודת הראיות).
**וריאציה 3 — מטרת ההבחנה:** מדוע קיימת הבחנה זו? ← למנוע כפילות הליכים ולחסוך זמן שיפוטי בתביעה נגררת, תוך שמירה על זכות הטיעון בתביעה רגילה.', 'בתביעה אזרחית רגילה ← פסק דין פלילי מרשיע הוא ראיה לכאורה ← ניתן לסתור ברשות בית המשפט. בתביעה נגררת ← פסק דין פלילי מרשיע הוא ראיה חלוטה ← לא ניתן לסתור.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 42א(א), 42ג", "ת\"א (שלום י-ם) 34559-09-16 ו\"פ נ'' נ\"ח (16.8.2022)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'ראובן אינו רשאי להביא ראיות לסתור את הממצאים העובדתיים, שכן פסק הדין הפלילי מהווה ראיה חלוטה.', false, 'טענה זו שגויה, שכן ראיה חלוטה רלוונטית רק לתביעה אזרחית נגררת לפי סעיף 42ד'' לפקודת הראיות, ולא לתביעה אזרחית רגילה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'ראובן רשאי להביא ראיות לסתור את הממצאים העובדתיים ללא כל הגבלה.', false, 'טענה זו שגויה, שכן סעיף 42ג'' לפקודת הראיות מטיל הגבלות על הבאת ראיות לסתור פסק דין פלילי מרשיע בתביעה אזרחית רגילה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'הממצאים והמסקנות של פסק הדין הפלילי יהיו קבילים כראיה לכאורה, וראובן יוכל להביא ראיות לסתור אותם רק ברשות בית המשפט, מטעמים שיירשמו וכדי למנוע עיוות דין.', true, 'זוהי התשובה הנכונה, המבטאת את הוראות סעיפים 42א(א) ו-42ג'' לפקודת הראיות לגבי תביעה אזרחית רגילה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'הממצאים והמסקנות של פסק הדין הפלילי אינם קבילים כלל כראיה במשפט האזרחי.', false, 'טענה זו שגויה, שכן סעיף 42א(א) לפקודת הראיות קובע במפורש כי ממצאים ומסקנות של פסק דין פלילי מרשיע קבילים כראיה לכאורה במשפט האזרחי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאים להגשת תביעה אזרחית נגררת',
    2, 'אילו תנאים מצטברים נדרשים על מנת שתביעה אזרחית תיחשב ל''תביעה נגררת להרשעה בפלילים'' ותיהנה מההקלות הראייתיות שבסעיף 42ד'' לפקודת הראיות?', 'שאלה זו מתמקדת בתנאים הפרוצדורליים והמהותיים הנדרשים על מנת שתביעה אזרחית תסווג כ''נגררת להרשעה בפלילים'', ובכך תיהנה מההקלות הראייתיות הייחודיות לה. הבנת תנאים אלו חיונית ליישום נכון של סעיף 77 לחוק בתי המשפט וסעיף 42ד'' לפקודת הראיות.', 'סעיף 77(א) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע את המסגרת הדיונית לתביעה אזרחית נגררת. התנאים המצטברים הם: 1. אדם הורשע בבית משפט שלום או מחוזי. 2. הוגשה נגדו תביעה אזרחית בשל העובדות המהוות את העבירה שבה הורשע. 3. פסק הדין בפלילים הפך חלוט. 4. התביעה הוגשה בתוך 90 ימים ממועד חלוטות פסק הדין הפלילי (תקנה 17(ב) לתקנות סדר הדין האזרחי, תשמ"ד-1984). רק בהתקיים תנאים אלו, יראו את הממצאים והמסקנות שנקבעו במשפט הפלילי כאילו נקבעו במשפט אזרחי, כראיה חלוטה שאינה ניתנת לסתירה, כאמור בסעיף 42ד'' לפקודת הראיות. ראו לעניין זה ת"א (שלום אי'') 3089-05-18 פלונים נ'' שירן מלכה (21.8.2019) וכן בש"א (שלום ירושלים) 2362/06 אלמונית 1 נ'' אוריאל דיווידסון (6.8.2006).',
    'התעלמות מהדרישה למועד הגשה ספציפי (90 יום) לאחר חלוטות פסק הדין הפלילי, או אי הבחנה בין ''תביעה נגררת'' ל''תביעה אזרחית רגילה'' המסתמכת על פסק דין פלילי.', '["חוק בתי המשפט", "תקנות סדר הדין האזרחי", "פסק דין חלוט", "תביעה אזרחית נגררת", "מועד הגשה"]'::jsonb, '**וריאציה 1 — תנאי סף:** מהם התנאים העיקריים לתביעה נגררת? ← הרשעה בפלילים, תביעה אזרחית בשל אותן עובדות, פסק דין חלוט, הגשה תוך 90 יום (סעיף 77 לחוק בתי המשפט ותקנה 17 לתקסד"א).
**וריאציה 2 — חשיבות המועד:** מה קורה אם התביעה לא הוגשה במועד? ← היא לא תיחשב נגררת ולא תיהנה ממעמד הראיה החלוטה (סעיף 42ד'' לפקודת הראיות).
**וריאציה 3 — סמכות עניינית:** מי מוסמך לדון בתביעה נגררת? ← השופט או המותב שהרשיעו, גם אם חורג מכללי הסמכות העניינית הרגילים (סעיף 77(א) לחוק בתי המשפט).', 'תביעה נגררת ← דורשת הרשעה חלוטה בפלילים + הגשה תוך 90 יום + בשל אותן עובדות ← מעניקה לממצאים מעמד של ראיה חלוטה.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 77(א)", "תקנות סדר הדין האזרחי, תשמ\"ד-1984: תקנה 17(ב)", "פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 42ד", "ת\"א (שלום אי'') 3089-05-18 פלונים נ'' שירן מלכה (21.8.2019)", "בש\"א (שלום ירושלים) 2362/06 אלמונית 1 נ'' אוריאל דיווידסון (6.8.2006)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'הורשע אדם בבית משפט שלום או מחוזי, הוגשה נגדו תביעה אזרחית בשל העובדות המהוות את העבירה שבה הורשע, פסק הדין הפלילי הפך חלוט, והתביעה הוגשה בתוך 90 ימים ממועד זה.', true, 'זוהי התשובה הנכונה, המפרטת את התנאים המצטברים הקבועים בסעיף 77 לחוק בתי המשפט ובתקנה 17 לתקנות סדר הדין האזרחי (תשמ"ד-1984), כפי שפורשו בפסיקה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'הורשע אדם בפלילים, הוגשה נגדו תביעה אזרחית, ובית המשפט האזרחי החליט לקבל את הממצאים הפליליים כראיה חלוטה.', false, 'אפשרות זו שגויה, שכן היא מתעלמת מהדרישה שפסק הדין הפלילי יהפוך חלוט ומהמועד הקבוע להגשת התביעה האזרחית הנגררת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'הוגשה תביעה אזרחית בגין אותן עובדות שבהן הורשע אדם בפלילים, ובית המשפט שהרשיע את הנאשם הוא זה הדן בתביעה האזרחית.', false, 'אפשרות זו חלקית ואינה כוללת את כל התנאים הנדרשים, כגון חלוטות פסק הדין הפלילי ומועד הגשת התביעה. כמו כן, הדרישה שאותו שופט ידון בתביעה אינה תנאי הכרחי אלא סמכות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'הורשע אדם בפלילים, הוגשה נגדו תביעה אזרחית, ואין חובה להוכיח את הנזק שנגרם לתובע.', false, 'אפשרות זו שגויה, שכן גם בתביעה נגררת, התובע חייב להוכיח את היקף הנזק שנגרם לו, למרות שהאחריות נקבעת על בסיס ההרשעה הפלילית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'אשם תורם בתביעה נגררת',
    3, 'לאחר שיוסי הורשע בתקיפת משה, הגיש משה תביעה אזרחית נגררת נגד יוסי. יוסי טוען כי משה התגרה בו וכי יש לייחס למשה אשם תורם לאירוע. האם טענת האשם התורם קבילה בתביעה נגררת?', 'שאלה זו בוחנת את היקף ההקלות הראייתיות בתביעה אזרחית נגררת, ובפרט את היכולת להעלות טענות הגנה הנוגעות להיקף הנזק, כגון אשם תורם, גם כאשר האחריות נקבעה באופן חלוט בהליך הפלילי. היא מדגישה את ההבחנה בין קביעת אחריות לבין קביעת היקף הנזק.', 'בתביעה אזרחית נגררת להרשעה בפלילים, הממצאים והמסקנות שנקבעו במשפט הפלילי מהווים ראיה חלוטה לעניין אחריות הנתבע. עם זאת, הפסיקה קובעת כי טענות הגנה הנוגעות להיקף הנזק, כגון אשם תורם, אינן סותרות את ממצאי ההרשעה הפלילית וניתן לטעון אותן. בית המשפט ידון בשאלת הנזק, ובכלל זה באשם תורם, במאזן ההסתברויות הנדרש במשפט האזרחי. כך נקבע בפירוש בת"א (שלום צפת) 16580-06-15 פלוני נ'' אשר דדון (14.2.2019) ובת"א (שלום נצרת) 62492-06-23 פלוני נ'' עידן זיסו (27.1.2026). טענת אשם תורם אינה מערערת על עצם ביצוע העבירה או על אחריות הנתבע, אלא על חלוקת האחריות לנזק בין הצדדים.',
    'הנחה שמעמד הראיה החלוטה של ההרשעה הפלילית מונע כל טענת הגנה בהליך האזרחי, כולל טענות הנוגעות להיקף הנזק או לאשם תורם.', '["אשם תורם", "תביעה אזרחית נגררת", "היקף נזק", "אחריות נזיקית", "פקודת הנזיקין"]'::jsonb, '**וריאציה 1 — אחריות מול נזק:** האם הרשעה פלילית קובעת גם את היקף הנזק? ← לא, רק את האחריות. היקף הנזק, כולל אשם תורם, נדון בהליך האזרחי (ת"א (שלום צפת) 16580-06-15).
**וריאציה 2 — סתירה להרשעה:** האם טענת אשם תורם סותרת את ההרשעה? ← לא, היא אינה מערערת על עצם ביצוע העבירה אלא על חלוקת האחריות לנזק (ת"א (שלום נצרת) 62492-06-23).
**וריאציה 3 — מטרת הדיון:** מה מטרת הדיון בתביעה נגררת לאחר קביעת האחריות? ← להתמקד בשאלת הנזק ובפיצוי הראוי (ע"א 8195/09 פלוני נ'' פלונית).', 'בתביעה נגררת ← אחריות חלוטה ← אך ניתן לטעון אשם תורם לעניין היקף הנזק.',
    '["ת\"א (שלום צפת) 16580-06-15 פלוני נ'' אשר דדון (14.2.2019)", "ת\"א (שלום נצרת) 62492-06-23 פלוני נ'' עידן זיסו (27.1.2026)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'לא, טענת אשם תורם אינה קבילה בתביעה נגררת, שכן היא סותרת את ממצאי ההרשעה הפלילית.', false, 'טענה זו שגויה. בעוד שאחריות הנתבע נקבעת באופן חלוט, טענות הנוגעות להיקף הנזק, כגון אשם תורם, עדיין ניתנות לבירור.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'כן, טענת אשם תורם קבילה בתביעה נגררת, שכן היא אינה סותרת את עצם האחריות הפלילית אלא נוגעת להיקף הפיצויים.', true, 'זוהי התשובה הנכונה. הפסיקה קובעת כי טענת אשם תורם אינה סותרת את ממצאי ההרשעה הפלילית וניתן לטעון אותה במסגרת בירור הנזק בתביעה נגררת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אך רק אם בית המשפט הפלילי התייחס לאשם התורם של משה בגזר הדין.', false, 'אפשרות זו שגויה. קבילות טענת אשם תורם אינה תלויה בהתייחסות מפורשת בגזר הדין הפלילי, אלא בהיותה טענה הנוגעת להיקף הנזק ולא לעצם האחריות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, אלא אם כן יוסי יקבל רשות מבית המשפט להביא ראיות לסתור את ממצאי ההרשעה.', false, 'אפשרות זו שגויה. הבאת ראיות לסתור את ממצאי ההרשעה אינה אפשרית בתביעה נגררת. טענת אשם תורם אינה סותרת את ההרשעה אלא משלימה את בירור הנזק.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'ממצאים בגזר הדין לעומת הכרעת הדין',
    4, 'בתביעה אזרחית נגררת להרשעה בפלילים, האם ממצאים ומסקנות שנקבעו בגזר הדין הפלילי (להבדיל מהכרעת הדין) יכולים לשמש כראיה חלוטה לעניין אחריות הנתבע?', 'שאלה זו עוסקת בהבחנה קריטית בין הכרעת דין לגזר דין בהליך הפלילי, והשפעתה על מעמד הממצאים בתביעה אזרחית נגררת. הבנה זו חיונית לקביעת היקף הראיות החלוטות שבית המשפט האזרחי מחויב לקבל.', 'הפסיקה מבחינה בין ממצאים ומסקנות שנקבעו בהכרעת הדין לבין אלה שנקבעו בגזר הדין. סעיף 42ד'' לפקודת הראיות מתייחס לממצאים ומסקנות שנקבעו ''במשפט הפלילי'', וההלכה הפסוקה מפרשת זאת כממצאים שבהכרעת הדין, או עובדות כתב האישום שהנאשם הודה בהן. ממצאים בגזר הדין, לעומת זאת, נקבעים לעיתים על בסיס ראיות שאינן קבילות בהליך אזרחי (כגון תסקירים), ולכן אינם מקבלים מעמד של ראיה חלוטה. כך נקבע בפירוש בת"א (שלום ק"ג) 6761-04-12 מדינת ישראל נ'' ברוך קדוש (21.8.2016) ובת"א (שלום י-ם) 43801-07-10 מדינת ישראל נ'' ישראל בונדק (29.5.2014). רק ממצאים שנקבעו ''מעבר לכל ספק סביר'' בהכרעת הדין, או עובדות כתב האישום שהנאשם הודה בהן, מקבלים מעמד זה.',
    'הנחה שכל קביעה בהליך הפלילי, לרבות בגזר הדין, מקבלת מעמד של ראיה חלוטה בתביעה נגררת, ללא הבחנה בין הכרעת דין לגזר דין.', '["הכרעת דין", "גזר דין", "ראיה חלוטה", "תביעה אזרחית נגררת", "פקודת הראיות", "הודאה בעובדות כתב האישום"]'::jsonb, '**וריאציה 1 — הכרעת דין:** מה מעמד ממצאים בהכרעת דין בתביעה נגררת? ← ראיה חלוטה (סעיף 42ד'' לפקודת הראיות).
**וריאציה 2 — גזר דין:** מה מעמד ממצאים בגזר דין בתביעה נגררת? ← לא ראיה חלוטה, אלא אם מצוטטים ממצאים מהכרעת הדין (ת"א (שלום ק"ג) 6761-04-12).
**וריאציה 3 — הודאה:** מה מעמד הודאה בעובדות כתב האישום? ← נחשבת לממצאים שנקבעו בהליך הפלילי ומהווה ראיה חלוטה (ת"א (שלום ת"א) 2220-01-18).', 'בתביעה נגררת ← רק ממצאים מהכרעת הדין (או הודאה בכתב אישום) ← מהווים ראיה חלוטה. ממצאים מגזר הדין ← אינם ראיה חלוטה.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 42ד", "ת\"א (שלום ק\"ג) 6761-04-12 מדינת ישראל נ'' ברוך קדוש (21.8.2016)", "ת\"א (שלום י-ם) 43801-07-10 מדינת ישראל נ'' ישראל בונדק (29.5.2014)", "ת\"א (שלום ת\"א) 2220-01-18 מדינת ישראל- משרד הביטחון נ'' אבי שטרית (6.8.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, כל ממצא שנקבע בהליך הפלילי, בין בהכרעת הדין ובין בגזר הדין, מהווה ראיה חלוטה בתביעה נגררת.', false, 'טענה זו שגויה. הפסיקה מבחינה בין ממצאים בהכרעת הדין לבין ממצאים בגזר הדין, ומעניקה מעמד של ראיה חלוטה רק לממצאים שבהכרעת הדין (או עובדות כתב האישום שהנאשם הודה בהן).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, רק ממצאים ומסקנות שנקבעו בהכרעת הדין הפלילית (או בעובדות כתב האישום שהנאשם הודה בהן) יכולים לשמש כראיה חלוטה בתביעה נגררת.', true, 'זוהי התשובה הנכונה, המבטאת את ההלכה הפסוקה לפיה רק ממצאים שנקבעו בהכרעת הדין (או עובדות כתב האישום שהנאשם הודה בהן) נחשבים לראיה חלוטה בתביעה נגררת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'ממצאים בגזר הדין יכולים לשמש ראיה לכאורה בלבד, וניתן לסתור אותם ללא צורך ברשות בית המשפט.', false, 'אפשרות זו שגויה. ממצאים בגזר הדין אינם נחשבים לראיה לכאורה לעניין אחריות בתביעה נגררת, וגם אם היו, לא ניתן לסתור אותם ללא רשות בית המשפט בתביעה אזרחית רגילה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'רק אם גזר הדין מצטט ממצאים מהכרעת הדין, אזי ממצאים אלו ייחשבו לראיה חלוטה.', false, 'אפשרות זו חלקית ואינה מדויקת. העיקרון הוא שממצאים בגזר הדין אינם מהווים ראיה חלוטה, אלא אם הם משקפים ממצאים שנקבעו בהכרעת הדין עצמה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 24, '2022-S-Q24';
END
$$;

-- ============================================================
-- Q25 — 2022-S-Q25 — chapter=criminal_proc subtopic=lawyer_discipline
-- classifier_note: Ethics committee's unilateral withdrawal from disciplinary complaint
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '5d426373-ea20-48bb-83d7-fa0e33667ebf'::uuid;
  v_group_id uuid := '98bd27cd-f633-49b5-93b3-c463b5485d67'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '5537e261-1569-4307-b095-25deefdf7e43'::uuid;
  v_ang_1 uuid := 'f6e59751-6bd2-428f-9d54-60bb323b9cb6'::uuid;
  v_ang_2 uuid := 'c6a77f6e-1913-4ed4-be32-24cf172b6b72'::uuid;
  v_ang_3 uuid := '4c467df7-7319-4dcd-b607-8bcddafc80ab'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q25';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 25, '2022-S-Q25';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lawyer_discipline' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'lawyer_discipline', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q25', v_chapter_id, v_subtopic_id, 'לאחר שעו"ד כהן השיב לכתב הקובלנה שהוגש נגדו החליטה ועדת האתיקה לחזור בה באופן חד-צדדי מהאישום. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 25}'::jsonb, 'השאלה עוסקת במעמד חזרה חד-צדדית מאישום בהליך משמעתי, לאחר שהנקבל (עו"ד כהן) כבר השיב לקובלנה. היא מתמקדת בהוראת סעיף 19(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), הקובעת את תוצאת החזרה מאישום בהתאם למועד הדיוני.', 'סעיף 19(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), התשע"ה-2015, קובע כי ''חזר בו קובל מאישום לפני שהוגשה תשובת הנקבל לקובלנה כאמור בסעיף 27, יבטל בית הדין את האישום; חזר בו לאחר מכן, יזכה בית הדין את הנקבל מאותו אישום''. במקרה הנדון, עו"ד כהן כבר השיב לכתב הקובלנה, ולכן חזרת ועדת האתיקה מהאישום לאחר מכן מביאה לזיכויו של עו"ד כהן מאותו אישום. חשוב להבחין בין ביטול אישום (כאשר החזרה היא לפני תשובת הנקבל) לבין זיכוי (כאשר החזרה היא לאחר תשובת הנקבל), שכן לכל אחת מהתוצאות השלכות משפטיות שונות, במיוחד לעניין מעשה בית דין והאפשרות להגיש את האישום מחדש. ראו לעניין זה את הטבלה ב
 לאחר תשובת הנאשם: זיכוי הנאשם">נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי.', 'הבלבול בין תוצאות חזרה מאישום לפני תשובת הנקבל (ביטול) לבין תוצאות חזרה מאישום לאחר תשובת הנקבל (זיכוי), והחלת הכללים של ההליך הפלילי ללא התאמה להליך המשמעתי.',
    '["כללי לשכת עורכי הדין", "קובלנה משמעתית", "חזרה מאישום", "תשובת נקבל", "זיכוי", "ביטול אישום"]'::jsonb, '**וריאציה 1 — חזרה לפני תשובה (משמעתי):** קובל חזר בו מאישום לפני תשובת הנקבל. מה התוצאה? ← ביטול האישום (סעיף 19(ב) לכללי לשכת עוה"ד).
**וריאציה 2 — חזרה לאחר תשובה (משמעתי):** קובל חזר בו מאישום לאחר תשובת הנקבל. מה התוצאה? ← זיכוי הנקבל (סעיף 19(ב) לכללי לשכת עוה"ד).
**וריאציה 3 — חזרה לאחר תשובה (פלילי):** תובע חזר בו מאישום פלילי לאחר תשובת הנאשם. מה התוצאה? ← זיכוי הנאשם (סעיף 94(א) לחסד"פ).', 'חזרה חד-צדדית מקובלנה לאחר תשובת הנקבל ← זיכוי.', '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015: סע'' 19(ב)", "נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''חזרה מאישום'' → mapped chapter=''criminal_proc'' subtopic=''lawyer_discipline'' | classifier_note: Ethics committee''s unilateral withdrawal from disciplinary complaint', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ועדת האתיקה אינה יכולה לחזור בה באופן חד-צדדי מהאישום אלא בהסכמת הנקבל, עו"ד כהן.', false, 'טענה זו שגויה, שכן ועדת האתיקה (הקובל) רשאית לחזור בה באופן חד-צדדי מאישום, אך תוצאת החזרה תלויה במועד ובנסיבות, ולא תמיד דורשת הסכמה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לאחר שהשיב עו"ד כהן לכתב הקובלנה דין החזרה הינו זיכוי.', true, 'זוהי התשובה הנכונה. סעיף 19(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים) קובע כי אם הקובל חזר בו מאישום לאחר שהוגשה תשובת הנקבל, יזכה בית הדין את הנקבל מאותו אישום.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'לאחר שהשיב עו"ד כהן לכתב הקובלנה דין החזרה הינו ביטול כתב הקובלנה.', false, 'טענה זו שגויה. ביטול כתב קובלנה מתרחש כאשר החזרה מאישום נעשית לפני תשובת הנקבל, או כאשר מדובר בביטול בהסכמה, אך לא בחזרה חד-צדדית לאחר תשובה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ועדת האתיקה אינה יכולה לחזור בה מכתב הקובלנה אלא באישור בית הדין.', false, 'טענה זו שגויה. הקובל רשאי לחזור בו מאישומים בהודעה בכתב לבית הדין, ללא צורך ברשותו, למעט חריגים מסוימים (כגון הודאה בעובדות מרשיעות).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'חזרה מאישום פלילי לפני תשובה',
    1, 'הפרקליטות החליטה לחזור בה מאישום פלילי שהוגש נגד ראובן, וזאת לפני שראובן השיב לאישום. מה הדין?', 'שאלה זו בוחנת את ההשלכות של חזרה מאישום בהליך פלילי, תוך התמקדות במועד החזרה ביחס לתשובת הנאשם. היא מדגישה את ההבחנה בין ביטול אישום לזיכוי, ואת הרציונל העומד מאחורי כל אחת מהתוצאות.', 'סעיף 94(א) לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי ''חזר בו תובע מאישום לפני תשובת הנאשם לאישום, יבטל בית המשפט את האישום; חזר בו לאחר מכן, יזכה בית המשפט את הנאשם מאותו אישום''. במקרה זה, התובע חזר בו מהאישום לפני שראובן השיב לאישום, ולכן התוצאה היא ביטול האישום. ביטול אישום, בניגוד לזיכוי, אינו מהווה מעשה בית דין ואינו מונע הגשת כתב אישום חדש, אם כי הגשה מחדש של אישום שבוטל בהסכמה דורשת אישור היועץ המשפטי לממשלה. ראו לעניין זה ע"פ (מחוזי י-ם) 26180-02-23 אברהם יצחק סמט נ'' מדינת ישראל (4.4.2023) וכן ח"נ (מקומיים ב"ש) 82620-07-25 מדינת ישראל נ'' אסיף (25.2.2026).',
    'הבלבול בין ביטול אישום לזיכוי, וההשלכות השונות של כל אחת מהתוצאות, במיוחד בהקשר של הגשת כתב אישום מחדש.', '["חוק סדר הדין הפלילי", "חזרה מאישום", "ביטול אישום", "זיכוי", "תשובת נאשם"]'::jsonb, '**וריאציה 1 — חזרה לפני תשובה (פלילי):** תובע חזר בו מאישום לפני תשובת הנאשם. מה התוצאה? ← ביטול האישום (סעיף 94(א) לחסד"פ).
**וריאציה 2 — חזרה לאחר תשובה (פלילי):** תובע חזר בו מאישום לאחר תשובת הנאשם. מה התוצאה? ← זיכוי הנאשם (סעיף 94(א) לחסד"פ).
**וריאציה 3 — חזרה לפני תשובה (משמעתי):** קובל חזר בו מאישום לפני תשובת הנקבל. מה התוצאה? ← ביטול האישום (סעיף 19(ב) לכללי לשכת עוה"ד).', 'חזרה חד-צדדית מאישום פלילי לפני תשובת הנאשם ← ביטול האישום.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 94(א)", "ע\"פ (מחוזי י-ם) 26180-02-23 אברהם יצחק סמט נ'' מדינת ישראל (4.4.2023)", "ח\"נ (מקומיים ב\"ש) 82620-07-25 מדינת ישראל נ'' אסיף (25.2.2026)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'בית המשפט יזכה את ראובן מהאישום.', false, 'טענה זו שגויה. זיכוי מתרחש כאשר החזרה מאישום נעשית לאחר תשובת הנאשם, ולא לפני כן.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'בית המשפט יבטל את האישום.', true, 'זוהי התשובה הנכונה. סעיף 94(א) לחוק סדר הדין הפלילי קובע כי אם תובע חזר בו מאישום לפני תשובת הנאשם, יבטל בית המשפט את האישום.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'הפרקליטות אינה יכולה לחזור בה מהאישום באופן חד-צדדי.', false, 'טענה זו שגויה. הפרקליטות (התובע) רשאית לחזור בה מאישום באופן חד-צדדי, אך תוצאת החזרה תלויה במועד.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'בית המשפט יורה על מחיקת כתב האישום, וניתן יהיה להגישו מחדש ללא אישור היועץ המשפטי לממשלה.', false, 'טענה זו שגויה. ביטול אישום אינו זהה למחיקה, והאפשרות להגשה מחדש תלויה בנסיבות הביטול (למשל, ביטול בהסכמה דורש אישור היועץ המשפטי לממשלה).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'ביטול אישום בהסכמה והגשה מחדש',
    2, 'הפרקליטות והנאשם הגיעו להסכמה על ביטול אישום פלילי לאחר שהנאשם כבר השיב לאישום. מה דינו של אישום שבוטל באופן זה, והאם ניתן להגישו מחדש?', 'שאלה זו עוסקת במנגנון ביטול אישום בהסכמה בהליך הפלילי, ובמיוחד בהשלכותיו על האפשרות להגיש את האישום מחדש. היא מדגישה את ההבדל בין ביטול לזיכוי ואת תפקיד היועץ המשפטי לממשלה בהגשה מחדש.', 'סעיף 94(ב) לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי ''בהסכמת התובע והנאשם רשאי בית המשפט לבטל אישום, בכל עת עד להכרעת הדין, ודין הביטול יהיה כדין ביטול לפני תשובת הנאשם''. כלומר, למרות שהביטול נעשה לאחר תשובת הנאשם, הוא אינו נחשב לזיכוי אלא לביטול. סעיף 94(ג) מוסיף כי ''אישום שבוטל, לפי סעיף קטן (ב), לא יוגש מחדש אלא באישור היועץ המשפטי לממשלה ומטעמים שיירשמו''. הוראה זו מאפשרת לתביעה, בתנאים מסוימים, להגיש מחדש אישום שבוטל בהסכמה. ראו לעניין זה ת"פ (שלום ת"א) 45984-01-19 מדינת ישראל נ'' רעד אלרבאיעה (27.12.2019) וכן ע"פ (מחוזי ב"ש) 17243-09-22 דן פוזננסקי נ'' מדינת ישראל (18.1.2023).',
    'הנחה שביטול אישום בהסכמה מונע לחלוטין הגשה מחדש, או אי הבחנה בין ביטול לזיכוי בהקשר זה.', '["חוק סדר הדין הפלילי", "ביטול אישום בהסכמה", "הגשה מחדש", "אישור היועץ המשפטי לממשלה", "מעשה בית דין"]'::jsonb, '**וריאציה 1 — ביטול בהסכמה (פלילי):** תובע ונאשם הסכימו לבטל אישום לאחר תשובה. מה התוצאה? ← ביטול כדין ביטול לפני תשובה (סעיף 94(ב) לחסד"פ).
**וריאציה 2 — הגשה מחדש (פלילי):** האם ניתן להגיש אישום שבוטל בהסכמה מחדש? ← כן, באישור היועץ המשפטי לממשלה ומטעמים שיירשמו (סעיף 94(ג) לחסד"פ).
**וריאציה 3 — ביטול בהסכמה (משמעתי):** קובל ונקבל הסכימו לבטל אישום. מה התוצאה? ← ביטול כדין ביטול לפני תשובה (סעיף 19(ג) לכללי לשכת עוה"ד).', 'ביטול אישום בהסכמה ← דינו כביטול לפני תשובה ← ניתן להגיש מחדש באישור (יועמ"ש/ועדת אתיקה).',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 94(ב), 94(ג)", "כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015: סע'' 19(ג), 19(ד)", "ת\"פ (שלום ת\"א) 45984-01-19 מדינת ישראל נ'' רעד אלרבאיעה (27.12.2019)", "ע\"פ (מחוזי ב\"ש) 17243-09-22 דן פוזננסקי נ'' מדינת ישראל (18.1.2023)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'דין הביטול כדין זיכוי, ולא ניתן להגיש את האישום מחדש.', false, 'טענה זו שגויה. ביטול אישום בהסכמה לאחר תשובה אינו נחשב לזיכוי, אלא לביטול כדין ביטול לפני תשובה, וניתן להגישו מחדש בתנאים מסוימים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'דין הביטול כדין ביטול לפני תשובת הנאשם, וניתן להגיש את האישום מחדש באישור היועץ המשפטי לממשלה ומטעמים שיירשמו.', true, 'זוהי התשובה הנכונה. סעיף 94(ב) ו-(ג) לחוק סדר הדין הפלילי קובעים כי ביטול אישום בהסכמה דינו כביטול לפני תשובה, וניתן להגישו מחדש באישור היועץ המשפטי לממשלה ומטעמים שיירשמו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'דין הביטול כדין ביטול לפני תשובת הנאשם, אך לא ניתן להגיש את האישום מחדש בשום מקרה.', false, 'טענה זו שגויה. סעיף 94(ג) לחוק סדר הדין הפלילי מאפשר הגשה מחדש של אישום שבוטל בהסכמה, בכפוף לאישור היועץ המשפטי לממשלה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'הסכמה לביטול אישום לאחר תשובה אינה אפשרית בהליך הפלילי.', false, 'טענה זו שגויה. סעיף 94(ב) לחוק סדר הדין הפלילי מאפשר ביטול אישום בהסכמה בכל עת עד להכרעת הדין, גם לאחר תשובת הנאשם.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חזרה מאישום משמעתי לאחר הודאה',
    3, 'ועדת האתיקה הגישה קובלנה נגד עו"ד לוי. עו"ד לוי הודה בעובדות הקובלנה, ועובדות אלו מספיקות כדי להרשיעו בעבירת משמעת. האם ועדת האתיקה רשאית לחזור בה מהאישום באופן חד-צדדי?', 'שאלה זו בוחנת חריג חשוב לכלל בדבר זכות התובע לחזור בו מאישום, והוא המצב שבו הנאשם (או הנקבל בהליך משמעתי) הודה בעובדות המספיקות להרשעה. היא מדגישה את האיזון בין שיקול הדעת של התביעה לבין עקרון סופיות הדיון והגנה על הנאשם.', 'סעיף 93 לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי ''תובע רשאי, בכל עת שלאחר תחילת המשפט, לחזור בו מאישום שבכתב האישום... אולם לא יעשה כן אם הודה הנאשם... בעובדות שיש בהן כדי להרשיעו באותו אישום''. הוראה זו חלה, בשינויים המחויבים, גם על הליכים משמעתיים. לפיכך, אם עו"ד לוי הודה בעובדות המספיקות להרשעתו, ועדת האתיקה אינה רשאית לחזור בה מהאישום באופן חד-צדדי. אם ההודאה לא הייתה מספיקה להרשעה, הייתה נדרשת רשות בית הדין לחזרה מאישום. ראו לעניין זה את הטבלה ב
**חריגים:**
 הודאה בעובדות המספיקות כדי להרשיע - לא ניתן לחזור מהאישום
 הודאה בעובדות שאינן מספיקות כדי להרשיע - התובע רשאי לחזור בו ברשות בית המשפט">נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי וכן נבו - המתמחה סדר הדין הפלילי (2026) | ד. האישום הפלילי.',
    'התעלמות מהחריג הקבוע בסעיף 93 לחוק סדר הדין הפלילי, המגביל את זכות התובע לחזור בו מאישום במקרה של הודאה מרשיעה.', '["חוק סדר הדין הפלילי", "חזרה מאישום", "הודאה בעובדות", "עובדות מרשיעות", "קובלנה משמעתית", "כללי לשכת עורכי הדין"]'::jsonb, '**וריאציה 1 — הודאה מרשיעה (פלילי/משמעתי):** נאשם/נקבל הודה בעובדות המספיקות להרשעה. האם התובע/קובל יכול לחזור בו? ← לא (סעיף 93 לחסד"פ).
**וריאציה 2 — הודאה לא מרשיעה (פלילי/משמעתי):** נאשם/נקבל הודה בעובדות שאינן מספיקות להרשעה. האם התובע/קובל יכול לחזור בו? ← כן, ברשות בית המשפט/הדין.
**וריאציה 3 — רציונל החריג:** מדוע לא ניתן לחזור מאישום לאחר הודאה מרשיעה? ← למנוע התחמקות מהרשעה כאשר האשמה הוכחה על ידי הנאשם עצמו.', 'הודאה בעובדות מרשיעות ← מונעת חזרה חד-צדדית מאישום (פלילי/משמעתי).',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 93", "נבו - המתמחה סדר הדין הפלילי (2026) | ד. האישום הפלילי", "נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, ועדת האתיקה רשאית לחזור בה מהאישום בכל עת, ודין החזרה יהיה זיכוי.', false, 'טענה זו שגויה. קיימים חריגים לזכות התובע לחזור בו מאישום, במיוחד כאשר הנאשם הודה בעובדות מרשיעות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, ועדת האתיקה אינה רשאית לחזור בה מהאישום אם הנקבל הודה בעובדות המספיקות כדי להרשיעו.', true, 'זוהי התשובה הנכונה. סעיף 93 לחוק סדר הדין הפלילי, החל בשינויים המחויבים גם על הליכים משמעתיים, קובע כי תובע אינו רשאי לחזור בו מאישום אם הנאשם הודה בעובדות שיש בהן כדי להרשיעו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אך רק ברשות בית הדין המשמעתי, שכן ההודאה ניתנה.', false, 'טענה זו שגויה. רשות בית הדין נדרשת אם ההודאה אינה מספיקה להרשעה, אך אם היא מספיקה, התובע אינו רשאי לחזור בו כלל.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, אלא אם כן עו"ד לוי יחזור בו מהודאתו.', false, 'טענה זו שגויה. חזרה מהודאה היא זכות של הנאשם/נקבל, אך היא אינה תנאי ליכולת התובע לחזור בו מאישום במקרה של הודאה מרשיעה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'פיצויים והוצאות לאחר זיכוי מחזרה',
    4, 'ראובן זוכה מאישום פלילי לאחר שהפרקליטות חזרה בה מהאישום. האם ראובן זכאי אוטומטית לפיצויים והוצאות מאוצר המדינה?', 'שאלה זו עוסקת בזכאות נאשם לפיצויים והוצאות מאוצר המדינה לאחר זיכוי, ובפרט כאשר הזיכוי נובע מחזרה של התביעה מאישום. היא בוחנת את תנאי סעיף 80 לחוק העונשין ואת שיקול הדעת של בית המשפט בעניין.', 'סעיף 80(א) לחוק העונשין, התשל"ז-1977, קובע כי ''משפט שנפתח שלא דרך קובלנה וראה בית המשפט שלא היה יסוד להאשמה, או שראה נסיבות אחרות המצדיקות זאת, רשאי הוא לצוות כי אוצר המדינה ישלם לנאשם הוצאות הגנתו ופיצוי על מעצרו או מאסרו בשל האשמה שממנה זוכה, או בשל אישום שבוטל לפי סעיף 94(ב) לחוק סדר הדין הפלילי''. כלומר, הזכאות לפיצויים והוצאות אינה אוטומטית, אלא נתונה לשיקול דעת בית המשפט, אשר יבחן אם לא היה יסוד לאשמה מלכתחילה או אם קיימות נסיבות אחרות המצדיקות זאת. כך נקבע בת"פ (שלום ב"ש) 31546-05-23 מדינת ישראל משרד להגנת הסביבה נ'' יובל אסולין (13.10.2024) ובת"פ (מחוזי י-ם) 51324-11-13 מדינת ישראל נ'' ישראל אברמוב (25.3.2015). בית המשפט מאזן בין הנזק שנגרם לנאשם לבין האינטרס הציבורי באכיפת החוק.',
    'הנחה שזיכוי, במיוחד כזה הנובע מחזרה מאישום, מקנה זכאות אוטומטית לפיצויים, מבלי לבחון את נסיבות המקרה ואת שיקול הדעת השיפוטי.', '["חוק העונשין", "פיצויים והוצאות", "זיכוי", "חזרה מאישום", "יסוד לאשמה", "שיקול דעת שיפוטי"]'::jsonb, '**וריאציה 1 — זיכוי מחזרה:** ראובן זוכה כי התביעה חזרה בה. האם זכאי לפיצויים? ← לא אוטומטית, בית המשפט יבחן (סעיף 80 לחוק העונשין).
**וריאציה 2 — תנאי זכאות:** מהם התנאים לפסיקת פיצויים? ← לא היה יסוד לאשמה, או נסיבות אחרות המצדיקות (סעיף 80 לחוק העונשין).
**וריאציה 3 — איזון אינטרסים:** מה בית המשפט מאזן בהחלטתו? ← נזק לנאשם מול אינטרס ציבורי באכיפת החוק (ת"פ (שלום ב"ש) 31546-05-23).', 'זיכוי מחזרה מאישום ← לא מקנה אוטומטית פיצויים ← תלוי בקביעת בית המשפט לפי סעיף 80 לחוק העונשין.',
    '["חוק העונשין, תשל\"ז-1977: סע'' 80(א)", "ת\"פ (שלום ב\"ש) 31546-05-23 מדינת ישראל משרד להגנת הסביבה נ'' יובל אסולין (13.10.2024)", "ת\"פ (מחוזי י-ם) 51324-11-13 מדינת ישראל נ'' ישראל אברמוב (25.3.2015)", "ע\"פ (מחוזי ב\"ש) 17243-09-22 דן פוזננסקי נ'' מדינת ישראל (18.1.2023)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, זיכוי מכל סוג מקנה זכאות אוטומטית לפיצויים והוצאות מאוצר המדינה.', false, 'טענה זו שגויה. הזכאות לפיצויים והוצאות אינה אוטומטית ותלויה בקיומם של תנאים נוספים הקבועים בחוק.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, הזכאות לפיצויים והוצאות אינה אוטומטית, ובית המשפט יבחן אם לא היה יסוד לאשמה או אם קיימות נסיבות אחרות המצדיקות זאת.', true, 'זוהי התשובה הנכונה. סעיף 80 לחוק העונשין קובע כי בית המשפט רשאי לפסוק פיצויים והוצאות, אך זאת רק אם לא היה יסוד לאשמה או בנסיבות אחרות המצדיקות זאת, ולא באופן אוטומטי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אך רק אם הזיכוי הוא ''זיכוי מוחלט'' ולא ''זיכוי מחמת הספק''.', false, 'טענה זו שגויה. למרות שזיכוי מחמת הספק עשוי להשפיע על שיקול הדעת, סעיף 80 לחוק העונשין אינו מבחין במפורש בין סוגי הזיכוי לעניין הזכאות לפיצויים, אלא מתמקד ביסוד לאשמה או בנסיבות אחרות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, שכן חזרה מאישום אינה נחשבת לזיכוי לצורך סעיף 80 לחוק העונשין.', false, 'טענה זו שגויה. סעיף 80 לחוק העונשין מתייחס במפורש גם למצב של ''אישום שבוטל לפי סעיף 94(ב) לחוק סדר הדין הפלילי'', וכן לזיכוי, כך שחזרה מאישום שתוצאתה זיכוי בהחלט רלוונטית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 25, '2022-S-Q25';
END
$$;

-- ============================================================
-- Q26 — 2022-S-Q26 — chapter=criminal_proc subtopic=lawyer_discipline
-- classifier_note: Ethics committee amending a disciplinary complaint after filing
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd35a2e95-16f6-4ff7-8f84-e93dc2fd133a'::uuid;
  v_group_id uuid := 'c0204237-eda5-4c5a-87ae-e886ea560c82'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '06fbebc3-9fcb-42e5-b45e-9ee5ed030227'::uuid;
  v_ang_1 uuid := 'f04ef11e-dccb-48a8-88c9-0940d0c9c9bc'::uuid;
  v_ang_2 uuid := 'a6fb96bf-6539-4acf-b148-23060d23a6ab'::uuid;
  v_ang_3 uuid := 'ef523846-234e-491c-ac06-1569efb3cbe8'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q26';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 26, '2022-S-Q26';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lawyer_discipline' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'lawyer_discipline', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q26', v_chapter_id, v_subtopic_id, 'ועדת האתיקה הגישה כתב קובלנה נגד עורך הדין, אך לאחר מכן גילתה כי טעתה בסעיפי האישום בכתב הקובלנה, ולכן היא מעוניינת לתקן אותו. האם היא רשאית לעשות כן?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 26}'::jsonb, 'השאלה עוסקת בסמכות ועדת האתיקה לתקן כתב קובלנה שהוגש נגד עורך דין, תוך התייחסות למועד התיקון ביחס להגשת תשובת הנקבל. היא מתמקדת בהוראת סעיף 18 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), המבחינה בין תיקון לפני תשובה (בהודעה) לבין תיקון לאחר תשובה (בבקשה לבית הדין).', 'סעיף 18(א) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), התשע"ה-2015, קובע כי ''קובל רשאי, בכל עת עד להגשת תשובת הנקבל כאמור בסעיף 27, לתקן את הקובלנה, להוסיף עליה או לגרוע ממנה, במסירת הודעה לבית הדין המפרטת את השינוי''. כלומר, כל עוד הנקבל לא הגיש את תשובתו לקובלנה, ועדת האתיקה (הקובל) רשאית לתקן את הקובלנה באופן חד-צדדי באמצעות מסירת הודעה לבית הדין. תיקון זה יכול לכלול הוספה, גריעה או שינוי של סעיפי האישום. רק לאחר שהנקבל הגיש את תשובתו, תיקון הקובלנה דורש בקשה לבית הדין וקבלת רשותו, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב (סעיף 18(ב) לכללים). בבד"מ (ועדת משמעת לשכת עוה"ד תל אביב-יפו) 64/20 ועדת האתיקה המחוזית של לשכת עורכי הדין - מחוז תל- אביב נ'' עו״ד שרגא צייגר (6.12.2020), ועדת האתיקה עמדה על זכותה לתקן את הקובלנה מכוח כלל 18(א) שכן הדבר נעשה טרם ניתן מענה הנקבל לקובלנה גופה. בבד"מ (ועדת משמעת לשכת עוה"ד מרכז) 13/23 ועדת האתיקה המחוזית - מחוז מרכז נ'' עמית כהן (11.2.2024), הנקבל העלה טענות מקדמיות לדחיית הקובלנה, מה שמדגיש את חשיבות השלב הדיוני לעניין תיקון הקובלנה.', 'הבלבול בין סמכות הקובל לתקן קובלנה בהודעה (לפני תשובת הנקבל) לבין הצורך ברשות בית הדין (לאחר תשובת הנקבל), או התעלמות מההבחנה בין הליכים משמעתיים לפליליים או אזרחיים רגילים.',
    '["תיקון קובלנה", "קובלנה משמעתית", "תשובת נקבל", "כללי לשכת עורכי הדין", "סדרי דין", "ועדת אתיקה"]'::jsonb, '**וריאציה 1 — תיקון לפני תשובה:** קובל רוצה לתקן קובלנה לפני תשובת הנקבל. מה הדין? ← רשאי במסירת הודעה (סעיף 18(א) לכללים).
**וריאציה 2 — תיקון אחרי תשובה:** קובל רוצה לתקן קובלנה אחרי תשובת הנקבל. מה הדין? ← בית הדין רשאי לאשר, לבקשת הקובל, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב (סעיף 18(ב) לכללים).
**וריאציה 3 — רציונל ההבחנה:** מדוע יש הבדל בין השלבים? ← כדי להגן על זכות הנקבל להתגונן ולהבטיח הליך הוגן, במיוחד לאחר שכבר הגיש את עמדתו.', 'ועדת האתיקה רשאית לתקן קובלנה במסירת הודעה לבית הדין ← כל עוד הנקבל לא השיב לקובלנה.', '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015: סע'' 18(א)", "בד\"מ (ועדת משמעת לשכת עוה\"ד תל אביב-יפו) 64/20 ועדת האתיקה המחוזית של לשכת עורכי הדין - מחוז תל- אביב נ'' עו״ד שרגא צייגר (6.12.2020)", "בד\"מ (ועדת משמעת לשכת עוה\"ד מרכז) 13/23 ועדת האתיקה המחוזית - מחוז מרכז נ'' עמית כהן (11.2.2024)"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''criminal_proc'' subtopic=''lawyer_discipline'' | classifier_note: Ethics committee amending a disciplinary complaint after filing', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ועדת האתיקה רשאית תמיד לתקן את כתב הקובלנה.', false, 'טענה זו שגויה, שכן סמכות ועדת האתיקה לתקן קובלנה משתנה בהתאם לשלב הדיוני, ובמקרים מסוימים נדרשת רשות בית הדין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'אם עורך הדין כבר השיב לכתב הקובלנה בית הדין רשאי לקבל את הבקשה מטעמים מיוחדים שיירשמו.', false, 'אפשרות זו מתארת את המצב כאשר התיקון מתבקש לאחר תשובת הנקבל, אך אינה התשובה הנכונה לשאלה הכללית האם ועדת האתיקה רשאית לתקן, שכן ישנו מצב בו היא רשאית לתקן ללא רשות.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אם עורך הדין לא השיב לכתב הקובלנה ועדת האתיקה רשאית לתקנו במסירת הודעה לבית הדין ובה פירוט השינוי.', true, 'זוהי התשובה הנכונה. סעיף 18(א) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים) קובע כי הקובל רשאי לתקן קובלנה במסירת הודעה לבית הדין, כל עוד הנקבל לא הגיש את תשובתו.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'משהוגש כתב הקובלנה לא ניתן לבצע בו שינויים.', false, 'טענה זו שגויה, שכן כללי סדרי הדין המשמעתיים מאפשרים תיקון קובלנה, בכפוף למועד הגשת התיקון ולרשות בית הדין במקרים מסוימים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'תיקון קובלנה לאחר תשובת הנקבל',
    1, 'ועדת האתיקה הגישה כתב קובלנה נגד עו"ד לוי. עו"ד לוי השיב לקובלנה. לאחר מכן, ועדת האתיקה גילתה טעות בסעיפי האישום ומעוניינת לתקן את הקובלנה. מה הדין?', 'שאלה זו בוחנת את סמכות בית הדין המשמעתי לאפשר תיקון קובלנה לאחר שהנקבל כבר הגיש את תשובתו. היא מדגישה את שיקול הדעת של בית הדין ואת החשיבות של מתן הזדמנות סבירה לנקבל להתגונן מפני התיקון.', 'סעיף 18(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), התשע"ה-2015, קובע כי ''ביקש זאת הקובל, רשאי בית הדין, בכל עת לאחר תחילת הדיון, לתקן את הקובלנה, להוסיף עליה או לגרוע ממנה, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב''. כלומר, בשלב זה, התיקון אינו אוטומטי ודורש בקשה לבית הדין וקבלת רשותו, תוך הקפדה על זכויות הנקבל. בית הדין ישקול את מכלול הנסיבות, לרבות השלב הדיוני והאם התיקון יגרום עוול לנקבל. כך למשל, בבד"מ (ועדת משמעת לשכת עוה"ד ירושלים) 9/25 דליה וולף נ'' עו״ד אלי שרשבסקי (17.11.2025), בית הדין דן בבקשה לתיקון קובלנה לאחר תשובת הנקבל, תוך התייחסות להתנגדות הנקבל.',
    'הנחה שכל תיקון קובלנה נעשה באותה דרך, ללא הבחנה בין השלבים הדיוניים השונים, או התעלמות מהצורך ברשות בית הדין ומתן הזדמנות לנקבל להשיב.', '["תיקון קובלנה", "תשובת נקבל", "רשות בית הדין", "הזדמנות סבירה להשיב", "סדרי דין משמעתיים"]'::jsonb, '**וריאציה 1 — תיקון לפני תשובה:** קובל רוצה לתקן קובלנה לפני תשובת הנקבל. מה הדין? ← רשאי במסירת הודעה (סעיף 18(א) לכללים).
**וריאציה 2 — תיקון אחרי תשובה:** קובל רוצה לתקן קובלנה אחרי תשובת הנקבל. מה הדין? ← בית הדין רשאי לאשר, לבקשת הקובל, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב (סעיף 18(ב) לכללים).

**וריאציה 3 — רציונל ההבחנה:** מדוע יש הבדל בין השלבים? ← כדי להגן על זכות הנקבל להתגונן ולהבטיח הליך הוגן, במיוחד לאחר שכבר הגיש את עמדתו.', 'תיקון קובלנה לאחר תשובת הנקבל ← דורש בקשת רשות מבית הדין + מתן הזדמנות סבירה לנקבל להשיב.',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015: סע'' 18(ב)", "בד\"מ (ועדת משמעת לשכת עוה\"ד ירושלים) 9/25 דליה וולף נ'' עו״ד אלי שרשבסקי (17.11.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'ועדת האתיקה אינה רשאית לתקן את הקובלנה בשלב זה.', false, 'טענה זו שגויה, שכן גם לאחר תשובת הנקבל, ניתן לתקן את הקובלנה, אך הדבר כפוף לרשות בית הדין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'ועדת האתיקה רשאית לתקן את הקובלנה במסירת הודעה לבית הדין, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב.', false, 'טענה זו שגויה, שכן בשלב זה התיקון אינו נעשה במסירת הודעה בלבד, אלא דורש בקשה לבית הדין וקבלת רשותו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'בית הדין רשאי, לבקשת הקובל, לתקן את הקובלנה, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב.', true, 'זוהי התשובה הנכונה. סעיף 18(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים) קובע כי לאחר תשובת הנקבל, בית הדין רשאי לתקן את הקובלנה לבקשת הקובל, ובלבד שניתנה לנקבל הזדמנות סבירה להשיב.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'התיקון אפשרי רק בהסכמת הנקבל.', false, 'טענה זו שגויה, שכן הסכמת הנקבל אינה תנאי הכרחי לתיקון קובלנה לאחר תשובתו, אלא רשות בית הדין.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'שיקולי בית הדין בתיקון קובלנה',
    2, 'אילו שיקולים ינחה בית הדין המשמעתי בבואו להחליט אם לאפשר תיקון קובלנה לאחר שהנקבל כבר השיב לה?', 'שאלה זו מתמקדת בשיקול הדעת של בית הדין המשמעתי בעת בחינת בקשה לתיקון קובלנה לאחר תשובת הנקבל. היא מדגישה את הצורך לאזן בין יעילות ההליך לבין זכויות הנקבל להליך הוגן, תוך התייחסות לטיב התיקון, השלב הדיוני והחשש מעוול.', 'כאשר הקובל מבקש לתקן קובלנה לאחר שהנקבל כבר השיב לה, בית הדין המשמעתי מפעיל שיקול דעת. סעיף 18(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים) קובע כי התיקון ייעשה ''ובלבד שניתנה לנקבל הזדמנות סבירה להשיב''. הפסיקה, בהקשר של תיקון כתבי אישום פליליים (המשמשים אנלוגיה להליכים משמעתיים), קובעת כי יש לשקול את טיב התיקון, השלב הדיוני שבו נמצא ההליך, והאם התיקון יגרום לנקבל עוול שלא ניתן לתקנו בפיצוי כספי. המבחן המרכזי הוא מתן הזדמנות סבירה לנאשם/נקבל להתגונן. כך למשל, בק"פ (שלום ת"א) 8981-06-24 הרצל שלומי גבעתי נ'' איציק פרי (31.8.2025), נקבע כי יש לשקול את טיב התיקון, השלב הדיוני ואיזון בין התנהלות הקובל לזכויות הנאשם. גם בסדרי הדין בבתי הדין לעבודה, קיימת סמכות רחבה לתיקון כתבי טענות, תוך בחינה אם התיקון יגרום עוול לצד השני שפיצוי כספי לא יוכל לתקנו, כפי שמצוין בשלמה יעקובוביץ סדרי הדין בבית הדין לעבודה (2024) | פרק ו כתבי טענות, הוראות כלליות והמצאת כתבי בית דין.',
    'התמקדות בשיקול בודד (כגון חומרת העבירה או שקידה) במקום בחינה כוללת של מכלול השיקולים הרלוונטיים לאיזון בין האינטרסים השונים.', '["שיקול דעת שיפוטי", "תיקון קובלנה", "הזדמנות סבירה", "עוול דיוני", "איזון אינטרסים", "סדרי דין"]'::jsonb, '**וריאציה 1 — שיקולים מרכזיים:** מהם השיקולים העיקריים לתיקון קובלנה לאחר תשובה? ← טיב התיקון, השלב הדיוני, והאם יגרום עוול לנקבל (ק"פ (שלום ת"א) 8981-06-24).
**וריאציה 2 — עיתוי הבקשה:** האם עיתוי הגשת הבקשה משפיע? ← כן, בשלבים מוקדמים יותר נחלשת עוצמת השיקולים נגד התיקון (שלמה יעקובוביץ סדרי הדין בבית הדין לעבודה (2024)).
**וריאציה 3 — מטרת התיקון:** מהי המטרה העיקרית של תיקון כתבי טענות? ← לשקף את הפלוגתא האמיתית ולעשות צדק, תוך שמירה על זכויות הצדדים (שלמה יעקובוביץ סדרי הדין בבית הדין לעבודה (2024)).', 'שיקולי בית הדין בתיקון קובלנה ← טיב התיקון, שלב דיוני, מניעת עוול לנקבל, מתן הזדמנות סבירה להשיב.',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015: סע'' 18(ב)", "ק\"פ (שלום ת\"א) 8981-06-24 הרצל שלומי גבעתי נ'' איציק פרי (31.8.2025)", "שלמה יעקובוביץ סדרי הדין בבית הדין לעבודה (2024) | פרק ו כתבי טענות, הוראות כלליות והמצאת כתבי בית דין"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'בית הדין ישקול רק את חומרת העבירה המיוחסת לנקבל ואת האינטרס הציבורי בבירור האמת.', false, 'טענה זו שגויה, שכן שיקולים אלו חשובים אך אינם בלעדיים. בית הדין חייב לאזן אותם מול זכויות הנקבל והגינות ההליך.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'בית הדין ישקול את טיב התיקון, השלב הדיוני, והאם התיקון יגרום לנקבל עוול שלא ניתן לתקנו בפיצוי כספי, תוך מתן הזדמנות סבירה לנקבל להשיב.', true, 'זוהי התשובה הנכונה. שיקולים אלו, הנגזרים מעקרונות סדרי הדין הכלליים ומהדרישה למתן הזדמנות סבירה, מנחים את בית הדין בהחלטתו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'בית הדין יאפשר את התיקון רק אם הקובל יוכיח כי הטעות לא הייתה ניתנת לגילוי בשקידה סבירה קודם לכן.', false, 'טענה זו שגויה. למרות ששקידה סבירה היא שיקול, היא אינה תנאי בלעדי, ובית הדין יבחן מכלול שיקולים רחב יותר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'בית הדין יאפשר את התיקון רק אם הנקבל יסכים לכך, שכן זכותו להתגונן נפגעת.', false, 'טענה זו שגויה. הסכמת הנקבל אינה תנאי הכרחי, אלא מתן הזדמנות סבירה להשיב, ובית הדין יכול לאשר תיקון גם ללא הסכמה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'תיקון קובלנה על ידי הוספת עבירה חדשה',
    3, 'ועדת האתיקה הגישה קובלנה נגד עו"ד דניאל. במהלך הדיון, התגלו עובדות חדשות המצביעות על עבירת משמעת נוספת שלא נכללה בקובלנה המקורית. האם ועדת האתיקה רשאית לתקן את הקובלנה ולהוסיף את העבירה החדשה?', 'שאלה זו בוחנת את היקף סמכותו של בית הדין המשמעתי להרשיע נקבל בעבירות משמעת שהתגלו במהלך הדיון, גם אם לא נכללו במפורש בקובלנה המקורית. היא מדגישה את כלל 43 לכללי לשכת עורכי הדין ואת חשיבות עקרון ההזדמנות הסבירה להתגונן.', 'כלל 43 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), התשע"ה-2015, קובע כי ''בית הדין רשאי להרשיע נקבל בשל כל אחת מן העבירות שהתגלו מן העובדות שהוכחו לפניו אף אם עובדות אלה לא נזכרו בקובלנה, ובלבד שניתנה לנקבל הזדמנות סבירה להתגונן''. כלל זה מאפשר לבית הדין גמישות מסוימת, אך הוא כפוף לעקרון יסוד של הליך הוגן – מתן הזדמנות לנקבל להתגונן מפני העבירה החדשה. בבד"מ (ועדת משמעת לשכת עוה"ד דרום) 4/23 ועדת האתיקה - לשכת עורכי הדין מחוז דרום נ'' עו״ד אברהם משעלי (18.8.2025), בית הדין דן בכלל 43 והבהיר כי הוא מקנה סמכות להרשיע על בסיס עובדות שהוכחו, אך לא מקנה סמכות לתקן את הקובלנה בדיעבד באופן שחורג מכלל 18. כמו כן, בבד"מ (ועדת משמעת לשכת עוה"ד תל אביב-יפו) 64/20 ועדת האתיקה המחוזית של לשכת עורכי הדין - מחוז תל- אביב נ'' עו״ד שרגא צייגר (6.12.2020), עלתה השאלה האם ניתנה לנקבל אפשרות להשיב לטענות נגדו מושא הודעת התיקון והאם ניתן לו פרק זמן להשיב טרם הוספת האישום החדש.',
    'הנחה שכלל 43 מאפשר הוספת עבירה חדשה לקובלנה ללא כל מגבלה, או בלבול בין סמכות בית הדין להרשיע על בסיס עובדות שהוכחו לבין סמכות הקובל לתקן את הקובלנה.', '["כלל 43", "עבירת משמעת", "הזדמנות סבירה להתגונן", "סמכות בית הדין", "תיקון קובלנה", "הליך הוגן"]'::jsonb, '**וריאציה 1 — עבירה שהוכחה:** האם בית הדין יכול להרשיע בעבירה שהוכחה אך לא נזכרה בקובלנה? ← כן, אם ניתנה לנקבל הזדמנות סבירה להתגונן (כלל 43 לכללים).
**וריאציה 2 — הוספת אישום חדש:** האם הקובל יכול להוסיף אישום חדש באמצעות תיקון קובלנה? ← לא באופן אוטומטי, יש קושי לקבל מתווה כזה (בד"מ 64/20).
**וריאציה 3 — שימוע על עבירה חדשה:** האם נדרש שימוע על עבירה חדשה המיוחסת לנקבל? ← כן, חובה לתת שימוע סטטוטורי (בד"מ 64/20).', 'בית הדין רשאי להרשיע בעבירה שהוכחה (אף אם לא נזכרה בקובלנה) ← בתנאי שניתנה לנקבל הזדמנות סבירה להתגונן (כלל 43).',
    '["בד\"מ (ועדת משמעת לשכת עוה\"ד דרום) 4/23 ועדת האתיקה - לשכת עורכי הדין מחוז דרום נ'' עו״ד אברהם משעלי (18.8.2025)", "בד\"מ (ועדת משמעת לשכת עוה\"ד תל אביב-יפו) 64/20 ועדת האתיקה המחוזית של לשכת עורכי הדין - מחוז תל- אביב נ'' עו״ד שרגא צייגר (6.12.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, ועדת האתיקה רשאית לתקן את הקובלנה ולהוסיף את העבירה החדשה במסירת הודעה לבית הדין.', false, 'טענה זו שגויה. הוספת עבירה חדשה אינה תיקון טכני שניתן לבצע בהודעה, אלא דורשת הליך מעמיק יותר, לרבות מתן הזדמנות לנקבל להתגונן.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, ועדת האתיקה אינה רשאית להוסיף עבירה חדשה לקובלנה קיימת, אלא עליה להגיש קובלנה חדשה בגין העבירה הנוספת.', false, 'טענה זו שגויה. כלל 43 לכללי לשכת עורכי הדין מאפשר לבית הדין להרשיע בעבירה שהתגלתה מן העובדות שהוכחו, גם אם לא נזכרה בקובלנה, ואין חובה להגיש קובלנה חדשה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית הדין רשאי להרשיע את הנקבל בעבירה שהתגלתה מן העובדות שהוכחו, אף אם לא נזכרה בקובלנה, ובלבד שניתנה לנקבל הזדמנות סבירה להתגונן.', true, 'זוהי התשובה הנכונה. כלל 43 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים) מאפשר לבית הדין להרשיע בעבירה שהוכחה, גם אם לא נזכרה בקובלנה, בתנאי שניתנה לנקבל הזדמנות סבירה להתגונן.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'הוספת עבירה חדשה אפשרית רק אם הנקבל הסכים לכך מראש.', false, 'טענה זו שגויה. הסכמת הנקבל אינה תנאי הכרחי, אלא מתן הזדמנות סבירה להתגונן, ובית הדין יכול להרשיע גם ללא הסכמה מפורשת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סמכות בית המשפט המנהלי להתערב בהחלטות ביניים',
    4, 'עו"ד שרה הגישה עתירה מנהלית נגד החלטת ביניים של בית הדין המשמעתי המחוזי, שדחתה את בקשתה לתיקון קובלנה. האם בית המשפט לעניינים מנהליים מוסמך לדון בעתירה זו?', 'שאלה זו עוסקת בהיקף הביקורת השיפוטית של בתי המשפט לעניינים מנהליים על החלטות ביניים של בתי הדין המשמעתיים של לשכת עורכי הדין. היא מדגישה את עקרון מיצוי ההליכים ואת הכלל לפיו אין ערעור על החלטות ביניים בדרך של עתירה מנהלית.', 'הפסיקה קובעת באופן עקבי כי בית המשפט לעניינים מנהליים אינו יושב כערכאת ערעור על החלטות ביניים של בתי הדין המשמעתיים. הדרך להשיג על החלטות אלו היא באמצעות ערעור שיוגש בסופו של ההליך לבית הדין המשמעתי הארצי, ולאחר מכן לבית המשפט המחוזי בירושלים. עקרון זה נובע מהצורך למצות את ההליכים בערכאות המיוחדות שהוקמו לשם כך, וכן מהרצון למנוע התערבות שיפוטית מוקדמת בהליכים תלויים ועומדים. כך נקבע בבג"ץ 5529/20 עו"ד עמוס גבעון נ'' בית הדין המשמעתי במחוז ירושלים - לשכת (20.8.2020), בעת"מ (מינהליים י-ם) 17600-03-20 עמוס גבעון נ'' בית הדין המשמעתי במחוז ירושלים-לשכת עורכי הדין בישראל (23.6.2020), ובעת"מ (מינהליים ב"ש) 33111-05-25 אופיר בר נ'' בית הדין המשמעתי מחוז דרום (22.7.2025). עם זאת, ביקורת שיפוטית-מנהלית על החלטות ועדת האתיקה (לפני הגשת קובלנה) אפשרית, כפי שמצוין בנבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק א - מבוא.',
    'הנחה שכל החלטה של גוף ציבורי ניתנת לביקורת שיפוטית מיידית באמצעות עתירה מנהלית, ללא הבחנה בין החלטות ביניים להחלטות סופיות, ובין סמכויות בתי המשפט השונים.', '["עתירה מנהלית", "החלטות ביניים", "בתי דין משמעתיים", "מיצוי הליכים", "ערעור", "סמכות עניינית"]'::jsonb, '**וריאציה 1 — החלטות ביניים:** האם ניתן לעתור מנהלית נגד החלטת ביניים של בית דין משמעתי? ← לא, יש למצות הליכי ערעור פנימיים (בג"ץ 5529/20).
**וריאציה 2 — מסלול הערעור:** מהו מסלול הערעור על החלטות בית דין משמעתי? ← מחוזי >> ארצי >> מחוזי ירושלים (עת"מ 33111-05-25).
**וריאציה 3 — ביקורת על ועדת אתיקה:** האם ניתן לעתור מנהלית נגד החלטה של ועדת האתיקה שלא להגיש קובלנה? ← כן, זו החלטה ''לבר משמעתית'' (עת"מ 33111-05-25).', 'החלטות ביניים של בית דין משמעתי ← לא ניתנות לערעור בעתירה מנהלית ← יש למצות הליכי ערעור פנימיים.',
    '["בג\"ץ 5529/20 עו\"ד עמוס גבעון נ'' בית הדין המשמעתי במחוז ירושלים - לשכת (20.8.2020)", "עת\"מ (מינהליים י-ם) 17600-03-20 עמוס גבעון נ'' בית הדין המשמעתי במחוז ירושלים-לשכת עורכי הדין בישראל (23.6.2020)", "עת\"מ (מינהליים ב\"ש) 33111-05-25 אופיר בר נ'' בית הדין המשמעתי מחוז דרום (22.7.2025)", "בג\"ץ 2156/18 מארון עילוטי נ'' בית הדין המשמעתי של לשכת עורכי דין במחוז (3.5.2018)", "נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק א - מבוא"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, בית המשפט לעניינים מנהליים מוסמך לדון בכל החלטה של גוף ציבורי, לרבות החלטות ביניים של בתי הדין המשמעתיים.', false, 'טענה זו שגויה. למרות שבית המשפט המנהלי דן בהחלטות של גופים ציבוריים, קיימת הבחנה ברורה לגבי החלטות ביניים של בתי דין משמעתיים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, בית המשפט לעניינים מנהליים אינו יושב כערכאת ערעור על החלטות ביניים של בתי הדין המשמעתיים, והדרך להשיג עליהן היא באמצעות ערעור בסוף ההליך לבית הדין הארצי ולאחר מכן לבית המשפט המחוזי בירושלים.', true, 'זוהי התשובה הנכונה. הפסיקה קובעת כי אין זכות ערעור על החלטות ביניים של בתי הדין המשמעתיים, ויש למצות את הליכי הערעור הפנימיים בסוף ההליך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אך רק במקרים חריגים ויוצאי דופן שבהם נגרם עוול מהותי לנקבל.', false, 'טענה זו שגויה. למרות שבית המשפט העליון בשבתו כבג"ץ עשוי להתערב במקרים חריגים, בית המשפט לעניינים מנהליים אינו הערכאה המוסמכת לדון בהחלטות ביניים של בתי הדין המשמעתיים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, אלא אם כן העתירה מוגשת נגד ועדת האתיקה עצמה ולא נגד בית הדין המשמעתי.', false, 'טענה זו שגויה. קיימת הבחנה בין ביקורת שיפוטית על החלטות ועדת האתיקה (לפני הגשת קובלנה) לבין החלטות בית הדין המשמעתי, אך גם נגד ועדת האתיקה לא ניתן להגיש עתירה מנהלית על החלטות ביניים של בית הדין.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 26, '2022-S-Q26';
END
$$;

-- ============================================================
-- Q27 — 2022-S-Q27 — chapter=criminal_proc subtopic=lawyer_discipline
-- classifier_note: Ethics committee using private investigator for evidence gathering
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'c7901c0d-6174-483f-9ce4-2db94f2b2add'::uuid;
  v_group_id uuid := 'f2302574-e65b-42f5-b779-a4bbef6bc91d'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '606ee563-9a02-4bdb-ac69-789c7e945c6b'::uuid;
  v_ang_1 uuid := '0d810566-a964-4a38-88e9-aa39da982631'::uuid;
  v_ang_2 uuid := '6af26bc4-9ecf-4d11-b155-a185b1b0b2eb'::uuid;
  v_ang_3 uuid := 'da1c144a-54e6-48fe-a712-566a0b3f89cb'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q27';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 27, '2022-S-Q27';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lawyer_discipline' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'lawyer_discipline', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q27', v_chapter_id, v_subtopic_id, 'לוועדת האתיקה הגיעו ידיעות שעורך דין מבצע עבירות אתיות, ולצורך ביסוס התשתית הראייתית היא ביצעה חקירה באמצעות משרד חקירות פרטי. במהלך ניהול ההליך המשמעתי ביקשה ועדת האתיקה להעיד את החוקר שביצע את החקירה ולהגיש באמצעותו את דוח החקירה, אך עורך הדין הנקבל התנגד וטען שאסור היה לוועדת האתיקה לבצע חקירה ותוצריה אינם קבילים. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 27}'::jsonb, 'השאלה עוסקת בסמכות ועדת האתיקה של לשכת עורכי הדין להשתמש בחוקרים פרטיים לצורך איסוף ראיות בהליכים משמעתיים. היא מתמקדת בהוראת סעיף 18ג לחוק לשכת עורכי הדין, המעניקה לוועדה סמכות זו, ובקבילות הראיות שהושגו בדרך זו, בכפוף לכללי הראיות ולעקרונות של הגינות דיונית.', 'סעיף 18ג לחוק לשכת עורכי הדין, התשכ"א-1961, קובע במפורש כי ''ועדת האתיקה רשאית, לצורך בירור תלונה או עריכת חקירה, להשתמש בשירותיו של חוקר פרטי''. הוראה זו מסמיכה את ועדת האתיקה להפעיל חוקרים פרטיים לצורך איסוף ראיות ובניית תשתית ראייתית לקראת הגשת קובלנה משמעתית. הפסיקה, כפי שבא לידי ביטוי בבר"ש 1190/18 ועדת האתיקה המחוזית של לשכת עורכי הדין מחוז ת"א והמרכז נ'' דוד ידיד (20.8.2020), אישרה את סמכות זו, וקבעה כי ראיות שהושגו על ידי חוקר פרטי קבילות בהליך המשמעתי, ובלבד שהחקירה נעשתה כדין ולא תוך פגיעה בלתי מידתית בזכויות הנחקר. החוקר עצמו יכול להעיד בפני בית הדין, ודו"ח החקירה שהוכן על ידו קביל כראיה, בכפוף לכללי הראיות הכלליים (כגון הצורך בעדות עורך הדו"ח כדי לאפשר חקירה נגדית).', 'הנחה שגופים משמעתיים אינם רשאים להשתמש בשיטות חקירה המקובלות ברשויות אכיפת החוק, או בלבול בין כללי הקבילות בהליך פלילי לבין אלו שבהליך משמעתי, מבלי להכיר את ההוראות הספציפיות בחוק לשכת עורכי הדין.',
    '["חוק לשכת עורכי הדין", "ועדת אתיקה", "חקירה פרטית", "קבילות ראיות", "הליך משמעתי", "סמכות חקירה"]'::jsonb, '**וריאציה 1 — סמכות חקירה:** האם ועדת האתיקה רשאית להשתמש בחוקרים פרטיים? ← כן, מכוח סעיף 18ג לחוק לשכת עורכי הדין.
**וריאציה 2 — קבילות ראיות:** האם דו"ח חקירה פרטית קביל? ← כן, ככלל, בכפוף לכללי הראיות (בר"ש 1190/18).

**וריאציה 3 — מגבלות:** האם יש מגבלות על חקירה כזו? ← כן, יש להקפיד על שמירת זכויות הנחקר ועל חוקיות החקירה.', 'ועדת האתיקה ← רשאית להשתמש בחוקרים פרטיים ← ראיות קבילות בכפוף לדיני הראיות.', '["חוק לשכת עורכי הדין, תשכ\"א-1961: סע'' 18ג", "בר\"ש 1190/18 ועדת האתיקה המחוזית של לשכת עורכי הדין מחוז ת\"א והמרכז נ'' דוד ידיד (20.8.2020)"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''criminal_proc'' subtopic=''lawyer_discipline'' | classifier_note: Ethics committee using private investigator for evidence gathering', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ועדת האתיקה רשאית לערוך בירור באמצעות משרד חקירות פרטי אם היא סבורה כי יש צורך בכך להליך הבירור המשמעתי.', true, 'זוהי התשובה הנכונה. סעיף 18ג לחוק לשכת עורכי הדין מסמיך את ועדת האתיקה להשתמש בחוקרים פרטיים לצורך איסוף ראיות בהליך הבירור המשמעתי, ובלבד שהחקירה נעשית כדין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על ועדת האתיקה חל איסור להפעיל משרד חקירות פרטי.', false, 'טענה זו שגויה. סעיף 18ג לחוק לשכת עורכי הדין קובע במפורש כי ועדת האתיקה רשאית להפעיל חוקרים פרטיים לצורך בירור תלונות.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ועדת האתיקה רשאית להעיד את החוקר, אבל לא להגיש באמצעותו את דוח החקירה.', false, 'טענה זו שגויה. אם החוקר קביל לעדות, גם הדו"ח שהוכן על ידו במסגרת חקירה כדין קביל כראיה, בכפוף לכללי הראיות.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ועדת האתיקה לא צריכה כלל להעיד את החוקר, והיא רשאית להגיש את דוח החקירה גם בלעדיו.', false, 'טענה זו שגויה. דו"ח חקירה הוא עדות שמיעה, וכדי שיהיה קביל, יש להעיד את עורך הדו"ח (החוקר) כדי שניתן יהיה לחקור אותו בחקירה נגדית, אלא אם כן חל חריג לכלל הפוסל עדות שמיעה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'סמכות ועדת האתיקה לדרוש מסמכים ולזמן לחקירה',
    1, 'עו"ד רותם נחשד בעבירה אתית. ועדת האתיקה החליטה לפתוח בבירור. האם ועדת האתיקה רשאית לדרוש מעו"ד רותם למסור מסמכים הקשורים לחשדות, וכן לזמן אותו לחקירה בפניה?', 'שאלה זו בוחנת את הסמכויות הישירות של ועדת האתיקה בבירור תלונות נגד עורכי דין, ובפרט את יכולתה לדרוש מסמכים ולזמן עורכי דין לחקירה. היא מדגישה את הבסיס החוקי לסמכויות אלו בחוק לשכת עורכי הדין.', 'סעיף 18א לחוק לשכת עורכי הדין, התשכ"א-1961, קובע כי ועדת האתיקה רשאית לברר תלונות נגד עורכי דין. סעיף 18ב(א) לחוק מעניק לוועדה סמכויות חקירה, לרבות דרישת מסמכים וזימון עורכי דין למסירת עדות. סמכויות אלו חיוניות לצורך איסוף ראיות והכרעה אם יש מקום להגיש קובלנה משמעתית. חובת עורך הדין להתייצב ולמסור מסמכים נובעת ממעמדו כחבר לשכה הכפוף לכלליה. ראו לעניין זה נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי.',
    'בלבול בין זכויות נאשם בהליך פלילי (כגון הזכות לחיסיון מפני הפללה עצמית) לבין חובות עורך דין בהליך בירור אתי, שבו קיימת חובת שיתוף פעולה עם ועדת האתיקה.', '["חוק לשכת עורכי הדין", "ועדת אתיקה", "סמכויות חקירה", "דרישת מסמכים", "זימון לעדות", "בירור תלונה"]'::jsonb, '**וריאציה 1 — דרישת מסמכים:** האם ועדת האתיקה יכולה לדרוש מעו"ד מסמכים? ← כן, מכוח סעיף 18ב(א) לחוק לשכת עורכי הדין.
**וריאציה 2 — זימון לחקירה:** האם ועדת האתיקה יכולה לזמן עו"ד לחקירה? ← כן, מכוח סעיף 18ב(א) לחוק לשכת עורכי הדין.
**וריאציה 3 — מטרת הסמכות:** מדוע ניתנו לוועדה סמכויות אלו? ← לצורך בירור תלונות ואיסוף ראיות להכרעה אם יש מקום להגיש קובלנה.', 'ועדת האתיקה ← רשאית לדרוש מסמכים ולזמן לחקירה ← לצורך בירור תלונות.',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961: סע'' 18א, 18ב(א)", "נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, ועדת האתיקה רשאית לדרוש מסמכים ולזמן לחקירה, וזאת מכוח סמכותה לברר תלונות.', true, 'זוהי התשובה הנכונה. סעיף 18ב(א) לחוק לשכת עורכי הדין מעניק לוועדת האתיקה סמכויות חקירה, לרבות דרישת מסמכים וזימון עורכי דין למסירת עדות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, ועדת האתיקה אינה רשאית לדרוש מסמכים או לזמן לחקירה ללא צו שיפוטי.', false, 'טענה זו שגויה. סמכויות החקירה של ועדת האתיקה מעוגנות בחוק ואינן דורשות צו שיפוטי מוקדם, אלא אם מדובר בפעולות חקירה חריגות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'ועדת האתיקה רשאית לדרוש מסמכים, אך אינה רשאית לזמן את עו"ד רותם לחקירה.', false, 'טענה זו שגויה. סעיף 18ב(א) לחוק לשכת עורכי הדין מקנה לוועדה את שתי הסמכויות – דרישת מסמכים וזימון לעדות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'ועדת האתיקה רשאית לזמן לחקירה, אך אינה רשאית לדרוש מסמכים ללא הסכמת עו"ד רותם.', false, 'טענה זו שגויה. הסכמת עו"ד רותם אינה תנאי לדרישת מסמכים, שכן מדובר בסמכות חקירה סטטוטורית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'קבילות ראיות שהושגו בחקירה פרטית תוך הפרת חוק',
    2, 'חוקר פרטי שנשכר על ידי ועדת האתיקה השיג ראיה נגד עו"ד שרון באמצעות האזנת סתר בלתי חוקית. האם ראיה זו תהיה קבילה בהליך המשמעתי?', 'שאלה זו בוחנת את קבילותן של ראיות שהושגו תוך הפרה חוקית חמורה (האזנת סתר בלתי חוקית) בהליך משמעתי. היא מדגישה את עקרונות דוקטרינת הפסילה היחסית ואת האיזון בין חשיפת האמת להגנה על זכויות יסוד והגינות ההליך.', 'למרות שסעיף 18ג לחוק לשכת עורכי הדין מאפשר לוועדת האתיקה להשתמש בחוקרים פרטיים, אין בכך כדי להכשיר ראיות שהושגו תוך הפרה חמורה של החוק, כגון האזנת סתר בלתי חוקית (המהווה עבירה פלילית לפי חוק האזנת סתר). הפסיקה, גם בהליכים משמעתיים, נוטה לפסול ראיות שהושגו באופן בלתי חוקי, במיוחד כאשר מדובר בהפרה של זכויות יסוד, אלא אם כן קיימות נסיבות חריגות ביותר המצדיקות את קבלתן (כגון ''דוקטרינת הפסילה היחסית'' שפותחה בפס"ד יששכרוב). בית הדין ישקול את חומרת ההפרה, חשיבות הראיה, והנזק שייגרם לזכויות הנקבל אם הראיה תתקבל. ראו לעניין זה בג"ץ 5529/20 עו"ד עמוס גבעון נ'' בית הדין המשמעתי במחוז ירושלים - לשכת (20.8.2020), שם נבחנה קבילות ראיות שהושגו על ידי חוקר פרטי בהליך משמעתי, והודגש כי יש לבחון כל מקרה לגופו.',
    'הנחה שכל ראיה שהושגה על ידי חוקר פרטי קבילה, או לחלופין, שכל ראיה שהושגה באופן בלתי חוקי נפסלת אוטומטית ללא שיקול דעת, מבלי להכיר בדוקטרינת הפסילה היחסית.', '["קבילות ראיות", "ראיות שהושגו שלא כדין", "האזנת סתר", "חוק האזנת סתר", "דוקטרינת הפסילה היחסית", "זכויות יסוד", "הליך משמעתי"]'::jsonb, '**וריאציה 1 — האזנת סתר:** האם ראיה שהושגה בהאזנת סתר בלתי חוקית קבילה? ← לא, ככלל, בשל הפרה חמורה של החוק וזכויות יסוד.
**וריאציה 2 — דוקטרינת הפסילה היחסית:** האם יש חריגים לפסילת ראיות שהושגו שלא כדין? ← כן, במקרים חריגים, בית הדין יכול להפעיל שיקול דעת לפי דוקטרינת הפסילה היחסית (בג"ץ 5529/20).
**וריאציה 3 — איזון אינטרסים:** מהו האיזון שבית הדין צריך לעשות? ← בין חשיפת האמת לבין הגנה על זכויות הנחקר והגינות ההליך.', 'ראיה שהושגה בהאזנת סתר בלתי חוקית ← ככלל לא קבילה ← אלא בחריגים לפי דוקטרינת הפסילה היחסית.',
    '["חוק האזנת סתר, תשל\"ט-1979", "בג\"ץ 5529/20 עו\"ד עמוס גבעון נ'' בית הדין המשמעתי במחוז ירושלים - לשכת (20.8.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כן, כל ראיה שהושגה על ידי חוקר פרטי מטעם ועדת האתיקה קבילה בהליך המשמעתי.', false, 'טענה זו שגויה. קבילות ראיות כפופה לכללי הראיות ולעקרונות של הגינות דיונית, גם כאשר הן מושגות על ידי חוקר פרטי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לא, ראיה שהושגה תוך הפרה חמורה של החוק, כגון האזנת סתר בלתי חוקית, אינה קבילה בהליך המשמעתי, אלא אם כן קיימות נסיבות חריגות ביותר המצדיקות זאת.', true, 'זוהי התשובה הנכונה. הפסיקה נוטה לפסול ראיות שהושגו תוך הפרה חמורה של החוק וזכויות יסוד, גם בהליכים משמעתיים, אלא אם כן חלים חריגים לדוקטרינת הפסילה היחסית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כן, אך בית הדין רשאי להפחית ממשקלה הראייתי של הראיה.', false, 'טענה זו שגויה. במקרים של הפרה חמורה של החוק, הנטייה היא לפסול את הראיה לחלוטין ולא רק להפחית ממשקלה, אלא אם כן מדובר בחריג.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לא, אלא אם כן עו"ד שרון הסכים לקבלת הראיה.', false, 'טענה זו שגויה. הסכמת הנקבל אינה מכשירה ראיה שהושגה באופן בלתי חוקי, במיוחד כאשר מדובר בהפרה של זכויות יסוד.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חקירה פרטית בעבירות פליליות חמורות',
    3, 'ועדת האתיקה קיבלה תלונה נגד עו"ד יואב, לפיה הוא מעל בכספי לקוחותיו. מעשה זה מהווה גם עבירה פלילית חמורה. האם ועדת האתיקה רשאית להמשיך בחקירה באמצעות חוקר פרטי, או שעליה להעביר את הטיפול למשטרה?', 'שאלה זו עוסקת בממשק שבין הליכים משמעתיים להליכים פליליים, ובפרט בסמכותה של ועדת האתיקה לחקור עבירות אתיות שיש בהן גם היבט פלילי. היא מדגישה את סמכותה המקבילה של הוועדה ואת חובתה לשקול העברת מידע לרשויות אכיפת החוק במקרים המתאימים.', 'ועדת האתיקה מוסמכת לברר תלונות על עבירות אתיות, גם אם הן מהוות גם עבירות פליליות. סעיף 18א לחוק לשכת עורכי הדין קובע את סמכותה לברר תלונות. עם זאת, במקרים של עבירות פליליות חמורות, קיימת חובה (או לפחות שיקול דעת רחב) להעביר את המידע לרשויות אכיפת החוק (המשטרה והפרקליטות). חקירה פלילית היא בסמכות המשטרה, והליך משמעתי אינו בא במקום הליך פלילי. ועדת האתיקה יכולה להמשיך בחקירה במקביל, אך עליה לתאם עם הרשויות הפליליות ולשקול את השפעת ההליך הפלילי על ההליך המשמעתי. ראו לעניין זה נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי, המציין את סמכויות הוועדה לברר תלונות.',
    'הנחה שוועדת האתיקה חייבת להפסיק את חקירתה מיד עם גילוי חשד לעבירה פלילית, או לחלופין, שהיא יכולה להחליף את המשטרה בחקירת עבירות פליליות, מבלי להבין את הסמכות המקבילה ואת הצורך בתיאום.', '["עבירות אתיות", "עבירות פליליות", "סמכות מקבילה", "חובת דיווח", "משטרה", "פרקליטות", "תיאום בין רשויות", "חוק לשכת עורכי הדין"]'::jsonb, '**וריאציה 1 — סמכות מקבילה:** האם ועדת האתיקה יכולה לחקור עבירה שהיא גם פלילית? ← כן, יש לה סמכות מקבילה לברר עבירות אתיות.
**וריאציה 2 — חובת דיווח:** האם ועדת האתיקה חייבת לדווח למשטרה על עבירה פלילית חמורה? ← כן, קיימת חובה או שיקול דעת רחב להעביר מידע לרשויות האכיפה.
**וריאציה 3 — תיאום:** האם יש צורך בתיאום בין הרשויות? ← כן, רצוי לתאם בין ההליך המשמעתי להליך הפלילי כדי למנוע כפילויות ופגיעה בהליכים.', 'עבירה אתית שהיא גם פלילית ← ועדת האתיקה רשאית לחקור ← אך עליה לשקול העברה למשטרה.',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961: סע'' 18א", "נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'ועדת האתיקה רשאית להמשיך בחקירה, אך עליה לשקול את העברת הטיפול למשטרה, ובמקרים מסוימים אף חובה עליה לעשות כן, במיוחד אם מדובר בעבירה פלילית חמורה.', true, 'זוהי התשובה הנכונה. לוועדת האתיקה סמכות מקבילה לברר עבירות אתיות, גם אם הן פליליות, אך קיימת חובה או שיקול דעת להעביר מידע על עבירות פליליות חמורות לרשויות האכיפה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'ועדת האתיקה חייבת להפסיק את חקירתה ולהעביר את הטיפול למשטרה באופן מיידי.', false, 'טענה זו שגויה. ועדת האתיקה אינה חייבת להפסיק את חקירתה באופן מיידי, אלא רשאית להמשיך בה במקביל, תוך תיאום עם הרשויות הפליליות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'ועדת האתיקה רשאית להמשיך בחקירה רק אם המשטרה אישרה לה לעשות כן.', false, 'טענה זו שגויה. סמכות ועדת האתיקה לחקור נובעת מחוק לשכת עורכי הדין ואינה תלויה באישור המשטרה, אם כי תיאום רצוי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'ועדת האתיקה אינה מוסמכת כלל לחקור עבירות פליליות, גם אם הן מהוות עבירות אתיות.', false, 'טענה זו שגויה. ועדת האתיקה מוסמכת לחקור עבירות אתיות, גם אם הן חופפות לעבירות פליליות, שכן מדובר בשני מישורי אחריות נפרדים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סמכות ועדת האתיקה להטיל סנקציות',
    4, 'לאחר שבית הדין המשמעתי הרשיע עו"ד דניאל בעבירה אתית, אילו סנקציות רשאי בית הדין להטיל עליו?', 'שאלה זו בוחנת את מגוון הסנקציות שבית הדין המשמעתי של לשכת עורכי הדין רשאי להטיל על עורך דין שהורשע בעבירת משמעת. היא מתמקדת בהוראות סעיף 68 לחוק לשכת עורכי הדין, המפרט את העונשים האפשריים.', 'סעיף 68 לחוק לשכת עורכי הדין, התשכ"א-1961, מפרט את העונשים שבית הדין המשמעתי רשאי להטיל על עורך דין שהורשע בעבירת משמעת. העונשים כוללים: אזהרה, נזיפה, קנס כספי, השעיה מן הלשכה לתקופה קצובה או בלתי קצובה, והוצאה לצמיתות מן הלשכה. מגוון העונשים מאפשר לבית הדין להתאים את הסנקציה לחומרת העבירה ולנסיבות המקרה. ראו לעניין זה נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי.',
    'הנחה שקיימות רק סנקציות קלות (אזהרה, נזיפה) או רק סנקציות חמורות (השעיה, הוצאה), מבלי להכיר את מגוון העונשים המפורטים בחוק.', '["חוק לשכת עורכי הדין", "בית דין משמעתי", "סנקציות משמעתיות", "אזהרה", "נזיפה", "קנס", "השעיה", "הוצאה מהלשכה"]'::jsonb, '**וריאציה 1 — סנקציות קלות:** מהן הסנקציות הקלות שבית הדין יכול להטיל? ← אזהרה, נזיפה, קנס (סעיף 68 לחוק לשכת עוה"ד).
**וריאציה 2 — סנקציות חמורות:** מהן הסנקציות החמורות שבית הדין יכול להטיל? ← השעיה זמנית או לצמיתות, הוצאה לצמיתות מהלשכה (סעיף 68 לחוק לשכת עוה"ד).
**וריאציה 3 — שיקול דעת:** מה מנחה את בית הדין בבחירת הסנקציה? ← חומרת העבירה, נסיבות המקרה, עברו המשמעתי של הנקבל, והאינטרס הציבורי.', 'בית הדין המשמעתי ← רשאי להטיל מגוון סנקציות ← מאזהרה ועד הוצאה לצמיתות (סעיף 68 לחוק לשכת עוה"ד).',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961: סע'' 68", "נבו - המתמחה אתיקה מקצועית: השיפוט המשמעתי (2026) | פרק ב - השיפוט המשמעתי"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'בית הדין רשאי להטיל קנס כספי בלבד.', false, 'טענה זו שגויה. קנס כספי הוא רק אחת מהסנקציות שבית הדין רשאי להטיל, וקיימות סנקציות חמורות יותר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'בית הדין רשאי להטיל אזהרה, נזיפה, השעיה זמנית או הוצאה לצמיתות מלשכת עורכי הדין, וכן קנס כספי.', true, 'זוהי התשובה הנכונה. סעיף 68 לחוק לשכת עורכי הדין מפרט את מגוון העונשים שבית הדין המשמעתי רשאי להטיל על עורך דין שהורשע בעבירת משמעת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'בית הדין רשאי להטיל אזהרה או נזיפה בלבד.', false, 'טענה זו שגויה. אזהרה ונזיפה הן סנקציות קלות יחסית, אך בית הדין מוסמך להטיל גם סנקציות חמורות יותר, לרבות השעיה והוצאה מהלשכה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'בית הדין רשאי להטיל השעיה זמנית או הוצאה לצמיתות מלשכת עורכי הדין, אך לא קנס כספי.', false, 'טענה זו שגויה. בית הדין רשאי להטיל גם קנס כספי בנוסף לסנקציות החמורות יותר, בהתאם לסעיף 68 לחוק לשכת עורכי הדין.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 27, '2022-S-Q27';
END
$$;

-- ============================================================
-- Q28 — 2022-S-Q28 — chapter=criminal_proc subtopic=publication_ban
-- classifier_note: Closed-doors order in sex-offense trial; defendant's right to appeal — court-protective orders
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '9e7d0165-cc65-4063-8d46-80c9387e38bb'::uuid;
  v_group_id uuid := 'e070e2fa-5705-4c33-abce-b98c0c45c262'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '9335b0a9-1275-4ecb-9fdc-ab09d52f5e06'::uuid;
  v_ang_1 uuid := '4999269f-a4f9-48df-ae9e-3cf00958ee14'::uuid;
  v_ang_2 uuid := '8487ef9a-06a4-4bef-825d-6c0412cfa5c3'::uuid;
  v_ang_3 uuid := '1aaee3fb-64b1-4c7c-91a0-2514cd8210d9'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q28';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 28, '2022-S-Q28';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'publication_ban' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'publication_ban', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q28', v_chapter_id, v_subtopic_id, 'נאשם בעבירות מין מבקש לערער על החלטת בית המשפט לקיים את הדיון בדלתיים סגורות. האם הוא יכול לעשות זאת?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 28}'::jsonb, 'השאלה עוסקת בזכות הערעור על החלטת בית משפט לקיים דיון בדלתיים סגורות, במיוחד בהקשר של עבירות מין. היא מתמקדת בסעיפים 68 ו-74 לחוק בתי המשפט, ובפרשנות הפסיקה לפיה החלטה להיעתר לבקשה לסגירת דלתיים אינה ניתנת לערעור, בניגוד להחלטה הדוחה בקשה כזו.', 'עקרון פומביות הדיון הוא עקרון יסוד חוקתי בשיטת המשפט הישראלית, המעוגן בסעיף 3 לחוק יסוד: השפיטה ובסעיף 68(א) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984. עם זאת, לעקרון זה קיימים חריגים, המנויים בסעיף 68(ב) לחוק בתי המשפט, המאפשרים לבית המשפט לדון בעניין מסוים בדלתיים סגורות, בין היתר לשם הגנה על עניינו של מתלונן או נאשם בעבירת מין (סעיף 68(ב)(5)). סעיף 74 לחוק בתי המשפט קובע כי ''החלטות בית משפט לפי סעיפים 68, 69 ו-72 אין אחריהן ולא כלום''. הפסיקה פירשה הוראה זו כקובעת כי החלטה להיעתר לבקשה לסגירת דלתיים היא סופית ואינה ניתנת לערעור. כלומר, נאשם שבית המשפט החליט לקיים את דיונו בדלתיים סגורות (למשל, כדי להגן על המתלוננת או עליו עצמו), אינו יכול לערער על החלטה זו. ראו לעניין זה בש"פ 4060/21 פלוני נ'' מדינת ישראל (15.6.2021) וכן בג"ץ 4841/04 מחמוד בן מחמוד מחג''אנה נ'' בית-המשפט המחוזי בחיפה – כבוד הנשיא מ'' לינדנשטראוס, נח(6) 347 (24.6.2004).', 'הבלבול בין זכות הערעור על החלטה לסגור דלתיים (שאינה קיימת) לבין זכות הערעור על החלטה לדחות בקשה לסגור דלתיים (שקיימת).',
    '["פומביות הדיון", "סגירת דלתיים", "חוק בתי המשפט", "זכות ערעור", "עבירות מין", "החלטה סופית"]'::jsonb, '**וריאציה 1 — החלטה לסגור דלתיים:** בית המשפט החליט לקיים דיון בדלתיים סגורות. האם ניתן לערער? ← לא, החלטה זו סופית (סעיף 74 לחוק בתי המשפט).
**וריאציה 2 — החלטה לדחות בקשה לסגור דלתיים:** בית המשפט דחה בקשה לסגור דלתיים. האם ניתן לערער? ← כן, החלטה זו ניתנת לערעור (בג"ץ מחג''אנה).
**וריאציה 3 — עבירות מין:** האם סגירת דלתיים בעבירות מין היא חובה? ← לא, בית המשפט רשאי להורות על כך לשם הגנה על המתלונן או הנאשם (סעיף 68(ב)(5) לחוק בתי המשפט).', 'החלטה לסגור דלתיים ← אינה ניתנת לערעור ← מכוח סעיף 74 לחוק בתי המשפט.', '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 68, 74", "חוק-יסוד: השפיטה: סע'' 3", "בש\"פ 4060/21 פלוני נ'' מדינת ישראל (15.6.2021)", "בג\"ץ 4841/04 מחמוד בן מחמוד מחג''אנה נ'' בית-המשפט המחוזי בחיפה – כבוד הנשיא מ'' לינדנשטראוס, נח(6) 347 (24.6.2004)"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''צו איסור פרסום'' → mapped chapter=''criminal_proc'' subtopic=''publication_ban'' | classifier_note: Closed-doors order in sex-offense trial; defendant''s right to appeal — court-protective orders', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'כן, במסגרת ערעור בזכות.', false, 'טענה זו שגויה. הפסיקה קבעה כי החלטה לסגור דלתיים אינה ניתנת לערעור, לא בזכות ולא ברשות, אלא במסגרת ערעור על פסק הדין הסופי.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כן, במסגרת ערעור ברשות.', false, 'טענה זו שגויה. סעיף 74 לחוק בתי המשפט קובע כי החלטות לפי סעיף 68 (סגירת דלתיים) הן סופיות ו''אין אחריהן ולא כלום'', כלומר אינן ניתנות לערעור.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'לא, זכות הערעור היא רק של המדינה בעניין זה בשל העניין לציבור.', false, 'טענה זו שגויה. זכות הערעור של המדינה קיימת במקרה של *דחיית* בקשה לסגירת דלתיים, ולא במקרה של *קבלת* בקשה לסגירת דלתיים.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא, אין כלל זכות ערעור על החלטה זו.', true, 'זוהי התשובה הנכונה. סעיף 74 לחוק בתי המשפט קובע כי החלטות בית משפט לפי סעיף 68 (סגירת דלתיים) הן סופיות ו''אין אחריהן ולא כלום'', ופרשנות הפסיקה היא כי החלטה להיעתר לבקשה לסגור דלתיים אינה ניתנת לתקיפה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'ערעור על החלטה לדחות בקשה לסגירת דלתיים',
    1, 'המדינה הגישה בקשה לסגירת דלתיים בדיון פלילי, אך בית המשפט דחה את הבקשה והורה על קיום דיון פומבי. האם המדינה יכולה לערער על החלטה זו?', 'שאלה זו בוחנת את ההבחנה בפסיקה לגבי זכות הערעור על החלטות בעניין פומביות הדיון. היא מדגישה את הפרשנות האסימטרית לסעיף 74 לחוק בתי המשפט, המאפשרת ערעור על דחיית בקשה לסגירת דלתיים אך לא על קבלתה.', 'סעיף 74 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע כי ''החלטות בית משפט לפי סעיפים 68, 69 ו-72 אין אחריהן ולא כלום''. אולם, הפסיקה פירשה הוראה זו באופן אסימטרי. בעוד שהחלטה להיעתר לבקשה לסגירת דלתיים אינה ניתנת לתקיפה, החלטה הדוחה בקשה כזו ניתנת לערעור. הטעם לכך הוא שהחלטה הדוחה בקשה לסגירת דלתיים היא בלתי הפיכה, במובן זה שאם עדות חסויה תישמע בפומבי, עלול להיגרם נזק לביטחון המדינה או לאינטרסים ציבוריים חשובים אחרים. לפיכך, סויגה תחולתו של סעיף 74 בדרך פסיקתית. ראו לעניין זה בג"ץ 4841/04 מחמוד בן מחמוד מחג''אנה נ'' בית-המשפט המחוזי בחיפה – כבוד הנשיא מ'' לינדנשטראוס, נח(6) 347 (24.6.2004) וכן ע"פ 1389/18 מדינת ישראל נ'' פלוני (1.3.2018).',
    'הנחה שסעיף 74 לחוק בתי המשפט חל באופן גורף על כל החלטה בעניין סגירת דלתיים, ללא הבחנה בין קבלת בקשה לדחייתה.', '["חוק בתי המשפט", "פומביות הדיון", "סגירת דלתיים", "זכות ערעור", "החלטת ביניים", "פרשנות אסימטרית"]'::jsonb, '**וריאציה 1 — קבלת בקשה לסגירת דלתיים:** נאשם ביקש לסגור דלתיים ובית המשפט אישר. האם ניתן לערער? ← לא, החלטה זו סופית (סעיף 74 לחוק בתי המשפט).
**וריאציה 2 — דחיית בקשה לסגירת דלתיים:** המדינה ביקשה לסגור דלתיים ובית המשפט דחה. האם ניתן לערער? ← כן, החלטה זו ניתנת לערעור (בג"ץ מחג''אנה).
**וריאציה 3 — רציונל ההבחנה:** מדוע יש הבחנה בין קבלת בקשה לדחייתה? ← דחיית בקשה לסגירת דלתיים עלולה לגרום נזק בלתי הפיך לאינטרסים מוגנים, ולכן יש לאפשר ערעור מיידי.', 'החלטה לסגור דלתיים ← לא ניתנת לערעור. החלטה לדחות בקשה לסגור דלתיים ← ניתנת לערעור.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 74", "בג\"ץ 4841/04 מחמוד בן מחמוד מחג''אנה נ'' בית-המשפט המחוזי בחיפה – כבוד הנשיא מ'' לינדנשטראוס, נח(6) 347 (24.6.2004)", "ע\"פ 1389/18 מדינת ישראל נ'' פלוני (1.3.2018)", "בש\"פ 4060/21 פלוני נ'' מדינת ישראל (15.6.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, ניתן לערער על החלטה זו.', true, 'זוהי התשובה הנכונה. הפסיקה פירשה את סעיף 74 לחוק בתי המשפט באופן אסימטרי: החלטה לדחות בקשה לסגירת דלתיים ניתנת לערעור, בניגוד להחלטה לקבל בקשה כזו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, סעיף 74 לחוק בתי המשפט קובע כי החלטות בעניין סגירת דלתיים אינן ניתנות לערעור.', false, 'טענה זו שגויה. למרות לשונו הכללית של סעיף 74, הפסיקה סייגה את תחולתו וקבעה כי הוא חל רק על החלטות המורות על סגירת דלתיים, ולא על החלטות הדוחות בקשה כזו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק במסגרת ערעור על פסק הדין הסופי.', false, 'טענה זו שגויה. החלטה הדוחה בקשה לסגירת דלתיים ניתנת לערעור מיידי, שכן מדובר בהחלטה בלתי הפיכה שעלולה לגרום נזק מיידי לאינטרסים מוגנים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, אלא אם כן מדובר בעבירות ביטחון חמורות.', false, 'טענה זו שגויה. זכות הערעור על דחיית בקשה לסגירת דלתיים אינה מוגבלת לעבירות ביטחון, אלא חלה על כל מקרה שבו נדחית בקשה לסגירת דלתיים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'שיקולי בית המשפט בהתרת פרסום לאחר זיכוי מעבירות מין',
    2, 'יעקב זוכה מכל אשמה בעבירות מין שיוחסו לו. הוא מבקש מבית המשפט לאשר את פרסום הכרעת הדין במלואה, ללא חשיפת שמה ופרטיה של המתלוננת. מה הדין?', 'שאלה זו עוסקת באיזון בין עקרון פומביות הדיון לבין הגנה על פרטיות מתלוננות בעבירות מין, במקרה של זיכוי. היא מדגישה את המגמה בפסיקה לפרסם הכרעות דין, גם מזכות, תוך שמירה על זהות המתלוננת.', 'הכלל הבסיסי הוא פומביות הדיון, המעוגן בסעיף 3 לחוק יסוד: השפיטה ובסעיף 68(א) לחוק בתי המשפט. חריגים לעקרון זה, כגון סגירת דלתיים לשם הגנה על מתלונן בעבירת מין (סעיף 68(ב)(5)), מפורשים בצמצום. הפסיקה קובעת כי אין מקום להבחנה בין פסק דין מרשיע לבין פסק דין מזכה לעניין פרסום, ובשני המקרים יש לפרסם את הכרעת הדין במלואה, תוך השמטת כל פרט מזהה אודות המתלונן או המתלוננת. במקרים מסוימים, יש גם להימנע מפרסום שם הנאשם אם הדבר עלול לחשוף את זהות המתלונן. ראו לעניין זה ע"פ 3204/15 יעקב בוזגלו נ'' מדינת ישראל (30.7.2015).',
    'הנחה שזיכוי או סגירת דלתיים אוטומטית מונעים פרסום, מבלי להבין את האיזון העדין בין פומביות הדיון להגנה על פרטיות המתלונן.', '["פומביות הדיון", "סגירת דלתיים", "עבירות מין", "זיכוי", "הגנה על מתלונן", "חוק בתי המשפט"]'::jsonb, '**וריאציה 1 — זיכוי מעבירות מין:** נאשם זוכה מעבירות מין ומבקש פרסום מלא של הזיכוי. מה הדין? ← בית המשפט יאפשר פרסום מלא, תוך השמטת פרטי המתלוננת (ע"פ בוזגלו).
**וריאציה 2 — הרשעה בעבירות מין:** נאשם הורשע בעבירות מין. האם פסק הדין יפורסם? ← כן, ככלל, תוך השמטת פרטי המתלוננת (ע"פ בוזגלו).
**וריאציה 3 — רציונל:** מדוע מפרסמים גם זיכויים? ← כדי לקיים את עקרון פומביות הדיון ולאפשר בקרה ציבורית על מערכת המשפט, תוך הגנה על המתלוננת.', 'זיכוי מעבירות מין ← פרסום מלא של הכרעת הדין ← תוך השמטת פרטי המתלוננת.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 68(א), 68(ב)(5)", "חוק-יסוד: השפיטה: סע'' 3", "ע\"פ 3204/15 יעקב בוזגלו נ'' מדינת ישראל (30.7.2015)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'לא ניתן לפרסם את הכרעת הדין, שכן הדיון התנהל בדלתיים סגורות.', false, 'טענה זו שגויה. עצם סגירת הדלתיים אינה מונעת פרסום לאחר מכן, אלא דורשת רשות בית המשפט, והמגמה היא להעדיף פרסום חלקי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'כן, בית המשפט יאפשר את פרסום הכרעת הדין במלואה, תוך השמטת כל פרט מזהה אודות המתלוננת.', true, 'זוהי התשובה הנכונה. הפסיקה קובעת כי אין להבחין בין פסק דין מרשיע למזכה לעניין פרסום, ובשני המקרים יש לפרסם את הכרעת הדין במלואה תוך הגנה על זהות המתלוננת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כן, אך רק אם המתלוננת תסכים לפרסום הכרעת הדין.', false, 'טענה זו שגויה. הסכמת המתלוננת אינה תנאי לפרסום הכרעת הדין המזכה, כל עוד זהותה מוגנת. האינטרס הציבורי בפומביות הדיון גובר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לא, שכן פרסום הכרעת הדין, גם ללא פרטי המתלוננת, עלול להרתיע מתלוננות עתידיות.', false, 'טענה זו שגויה. למרות החשש מהרתעת מתלוננות, האינטרס הציבורי בפומביות הדיון ובפרסום זיכויים, תוך הגנה על המתלוננת, גובר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'התרת פרסום פסק דין מרשיע בעבירות מין לאחר שנים',
    3, 'פלוני הורשע בעבירות מין לפני 20 שנה וריצה את עונשו. כעת, גוף תקשורת מבקש לפרסם את פסק הדין המרשיע, תוך השחרת פרטי נפגע העבירה. פלוני מתנגד לפרסום בטענה שהדבר יגרום לו נזק חמור לאחר תהליך שיקום ארוך. מה הדין?', 'שאלה זו בוחנת את האיזון בין עקרון פומביות הדיון לבין זכותו של עבריין מין מורשע לפרטיות ולשיקום, במיוחד כאשר חלף זמן רב מאז ההרשעה. היא מדגישה את הנטל הכבד המוטל על המורשע להצדיק סטייה מעקרון הפומביות.', 'עקרון פומביות הדיון הוא עקרון יסוד חוקתי, ומעקרון זה נגזר גם החופש לפרסם את תכני ההליך השיפוטי, לרבות פרטיהם המזהים של הנוטלים בו חלק. חריגים לעקרון זה מפורשים בצמצום. כאשר מדובר בעבריין מורשע, ובמיוחד בעבריין מין, חזקת החפות אינה עומדת לו עוד, והאינטרס הציבורי בחשיפת פרטיו הוא ניכר ומשמעותי, בין היתר כדי לאפשר לציבור לעמוד על המשמר ולעודד נפגעים נוספים להתלונן. הנטל להוכיח כי כתוצאה מהפרסום עלול להיגרם נזק חמור החורג מגדר הרגיל, וכי הצורך במניעת נזק זה גובר על האינטרס הציבורי שבפרסום, מוטל על המבקש איסור פרסום. נטל זה כבד במיוחד במקרה של עבריין מין מורשע. חלוף הזמן או תהליך שיקום, כשלעצמם, אינם מצדיקים סטייה מעקרון הפומביות. ראו לעניין זה בש"פ 5647/22 פלוני נ'' ידיעות אחרונות (14.9.2022) וכן ע"פ 43787-11-24 שגיא שמואל כהן נ'' פלונית (11.12.2024).',
    'הנחה שזכות לשיקום או חלוף זמן ארוך מביאים אוטומטית לאיסור פרסום, מבלי להבין את הנטל הכבד המוטל על המורשע ואת האינטרס הציבורי המוגבר בעבירות מין.', '["פומביות הדיון", "עבירות מין", "איסור פרסום", "נטל הוכחה", "איזון אינטרסים", "עבריין מורשע"]'::jsonb, '**וריאציה 1 — נזק רגיל:** האם נזק לשם הטוב או לפרנסה מספיק לאיסור פרסום של מורשע? ← לא, נדרש נזק חמור החורג מהרגיל (ע"פ שגיא שמואל כהן).
**וריאציה 2 — חלוף זמן ושיקום:** האם חלוף 20 שנה ושיקום מצדיקים איסור פרסום? ← לא אוטומטית, הנטל על המורשע כבד במיוחד (בש"פ פלוני נ'' ידיעות אחרונות).
**וריאציה 3 — אינטרס ציבורי:** מהו האינטרס הציבורי בפרסום שמו של עבריין מין מורשע? ← להזהיר את הציבור ולאפשר חשיפת פרשות נוספות (בש"פ פלוני נ'' ידיעות אחרונות).', 'עבריין מין מורשע ← נטל כבד להוכיח נזק חמור וחריג ← כדי למנוע פרסום שמו.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 68(א)", "חוק-יסוד: השפיטה: סע'' 3", "בש\"פ 5647/22 פלוני נ'' ידיעות אחרונות (14.9.2022)", "ע\"פ 43787-11-24 שגיא שמואל כהן נ'' פלונית (11.12.2024)", "בש\"פ 243/24 פלוני נ'' מדינת ישראל (30.1.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'לא ניתן לפרסם את פסק הדין, שכן חלוף הזמן ותהליך השיקום של פלוני גוברים על עקרון פומביות הדיון.', false, 'טענה זו שגויה. חלוף הזמן ותהליך השיקום אינם מונעים פרסום באופן אוטומטי, והנטל על המורשע להוכיח נזק חמור במיוחד הוא כבד.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'כן, בית המשפט יאפשר את פרסום פסק הדין, שכן הנטל להוכיח כי הפרסום יגרום לו נזק חמור החורג מהרגיל מוטל עליו, ונטל זה כבד במיוחד כאשר מדובר בעבריין מין מורשע.', true, 'זוהי התשובה הנכונה. הפסיקה קובעת כי הנטל על עבריין מורשע, ובמיוחד בעבירות מין, להראות נזק חמור וחריג שיצדיק איסור פרסום הוא כבד מאוד, ופגיעה רגילה בשם הטוב אינה מספיקה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'הפרסום יאושר רק אם נפגע העבירה יסכים לכך, שכן זכותו לפרטיות גוברת על עקרון פומביות הדיון.', false, 'טענה זו שגויה. הסכמת נפגע העבירה רלוונטית להגנה על פרטיו שלו, אך אינה תנאי לפרסום פסק הדין המרשיע, במיוחד כאשר פרטי הנפגע מושחרים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט יורה על פרסום חלקי של פסק הדין, ללא ציון שמו של פלוני, כדי לאזן בין האינטרסים.', false, 'טענה זו שגויה. במקרה של עבריין מין מורשע, האינטרס הציבורי בחשיפת זהותו הוא ניכר ומשמעותי, ופרסום שמו נחשב כחלק מהכלל של פומביות הדיון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'הגבלת נוכחות פיזית באולם ושידור חי',
    4, 'במהלך דיון בבג"ץ, קיים חשש מבוסס להפרעות מצד הקהל שעלולות להקשות על ניהולו התקין של הדיון. בית המשפט החליט להגביל את הנוכחות הפיזית באולם, אך לאפשר שידור חי של הדיון לציבור הרחב. האם החלטה זו עולה בקנה אחד עם עקרון פומביות הדיון?', 'שאלה זו עוסקת בהיבט חדשני של פומביות הדיון, הנוגע לאפשרות להגביל נוכחות פיזית באולם בית המשפט תוך כדי שידור חי של הדיון. היא בוחנת את סמכותו הטבועה של בית המשפט לנהל את הליכיו ואת ההבחנה בין הגבלה זו לבין סגירת דלתיים מסורתית.', 'עקרון פומביות הדיון, המעוגן בחוק יסוד: השפיטה, הוא עקרון חוקתי חשוב. עם זאת, הוא אינו מוחלט. הפסיקה הכירה בסמכותו הטבועה של בית המשפט לנקוט בצעדים חיוניים לניהול תקין של ההליך. במקרים בהם קיים חשש מבוסס להפרעות שעלולות להקשות על ניהול תקין של הדיון, בית המשפט רשאי להגביל מראש את הנוכחות הפיזית באולם, וזאת בנוסף ובמקביל לשידור הדיון במעגל סגור או בשידור חי. הסדר זה אינו נחשב לדיון בדלתיים סגורות במובן המהותי של סעיף 68(ב) לחוק בתי המשפט, אלא אמצעי המאזן בין עקרון פומביות הדיון לבין הצורך להבטיח ניהול תקין ויעיל של ההליך. שידור חי של הדיון מגשים את הרציונליים של פומביות הדיון במובנה הרחב. ראו לעניין זה בג"ץ 78621-03-26 לביא זכויות האזרח מינהל תקין ועידוד ההתיישבות (ע"ר) נ'' בית המשפט העליון (12.4.2026).',
    'הבלבול בין הגבלת נוכחות פיזית עם שידור חי לבין סגירת דלתיים מלאה, והתעלמות מהסמכות הטבועה של בית המשפט לנהל את הליכיו.', '["פומביות הדיון", "סמכות טבועה", "ניהול הליך תקין", "שידור חי", "סגירת דלתיים", "איזון אינטרסים"]'::jsonb, '**וריאציה 1 — הגבלת נוכחות ושידור חי:** האם בית המשפט יכול להגביל נוכחות פיזית באולם ולאפשר שידור חי? ← כן, מכוח סמכותו הטבועה, וזה לא נחשב סגירת דלתיים (בג"ץ לביא).
**וריאציה 2 — רציונל:** מה מטרת הגבלה כזו? ← למנוע הפרעות ולשמור על ניהול תקין של הדיון, תוך שמירה על פומביות במובן הרחב (בג"ץ לביא).
**וריאציה 3 — סמכות טבועה:** מהי הסמכות הטבועה של בית המשפט? ← היכולת ליצור כלים חיוניים למילוי תפקידו במקרים יוצאי דופן (בג"ץ לביא).', 'הגבלת נוכחות פיזית באולם + שידור חי ← מותר מכוח סמכות טבועה ← אינו סגירת דלתיים.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 68(ב), 72(א)", "חוק-יסוד: השפיטה: סע'' 3", "בג\"ץ 78621-03-26 לביא זכויות האזרח מינהל תקין ועידוד ההתיישבות (ע\"ר) נ'' בית המשפט העליון (12.4.2026)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, בית המשפט רשאי להגביל את הנוכחות הפיזית באולם מכוח סמכותו הטבועה לניהול הליך תקין, וזאת אינו נחשב לדיון בדלתיים סגורות אם מתאפשר שידור חי.', true, 'זוהי התשובה הנכונה. הפסיקה קבעה כי הגבלת נוכחות פיזית עם שידור חי אינה סגירת דלתיים, והיא מותרת מכוח הסמכות הטבועה של בית המשפט לנהל הליך תקין, תוך שמירה על פומביות הדיון במובנה הרחב.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, הגבלת נוכחות פיזית באולם מהווה סגירת דלתיים, וניתן לעשות זאת רק במקרים המנויים בסעיף 68(ב) לחוק בתי המשפט.', false, 'טענה זו שגויה. הפסיקה הבחינה בין הגבלת נוכחות פיזית עם שידור חי לבין סגירת דלתיים, וקבעה שהראשונה אינה נכנסת לגדר סעיף 68(ב).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אך רק אם שר המשפטים אישר את ההחלטה מראש.', false, 'טענה זו שגויה. סמכות בית המשפט לניהול הדיון אינה תלויה באישור שר המשפטים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, שכן עקרון פומביות הדיון מחייב נוכחות פיזית בלתי מוגבלת של הציבור באולם.', false, 'טענה זו שגויה. עקרון פומביות הדיון אינו מוחלט, וניתן לאזן אותו עם הצורך בניהול תקין של הדיון, במיוחד כאשר מתאפשר שידור חי.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 28, '2022-S-Q28';
END
$$;

-- ============================================================
-- Q29 — 2022-S-Q29 — chapter=civil_proc subtopic=proceedings  [needs_review]
-- classifier_note: Administrative appeal page length — administrative procedure isn't a dedicated subtopic; civil_proc/proceedings is the closest
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '68f1772c-3cd6-4f02-8342-0027b4e23015'::uuid;
  v_group_id uuid := 'a124767c-d1bd-4dce-bbef-1371eadff308'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '98ca46a1-8968-4083-bdb4-89df96a54f13'::uuid;
  v_ang_1 uuid := 'ba23d090-3d62-4227-a23d-3658a8cd6396'::uuid;
  v_ang_2 uuid := 'f6d39743-79b0-4c39-9c29-05c5421d4ea4'::uuid;
  v_ang_3 uuid := '82d3b25c-f0e5-46e0-ac1b-f529bb079da6'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q29';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 29, '2022-S-Q29';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q29', v_chapter_id, v_subtopic_id, 'בסופה של עבודה מאומצת גילה עורך דין כי הערעור המינהלי שהוא מבקש להגיש לבית המשפט לעניינים מינהליים מתפרש על פני 14 עמודים בשל הצורך להציג עניין עובדתי ארוך שנים. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 29}'::jsonb, 'השאלה עוסקת במגבלות על אורך כתבי טענות בערעור מינהלי. היא בוחנת את תחולת תקנות סדר הדין האזרחי על הליכים מינהליים מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים, ומבהירה כי בניגוד למגבלות שהיו קיימות בעבר בתקנות סדר הדין האזרחי (שבוטלו בתקנות החדשות), אין כיום מגבלה ספציפית על מספר העמודים בערעור מינהלי.', 'תקנה 28(א) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, קובעת כי ''הוראות פרק י"ז לחלק ב'' לתקנות סדר הדין האזרחי יחולו על ערעור לפי פרק זה, בשינויים המחויבים, אם אין בחוק ובתקנות אלה הוראה אחרת לעניין הנדון, ואם אין בעניין הנדון או בהקשרו דבר שאינו מתיישב עם הוראות החוק ותקנות אלה''. פרק י"ז לחלק ב'' בתקנות סדר הדין האזרחי, התשע"ט-2018, עוסק בערעורים. בניגוד לתקנות סדר הדין האזרחי, התשמ"ד-1984, שקבעו בעבר הגבלות על מספר העמודים בכתבי טענות (למשל, תקנה 410(א) הגבילה ערעור לבית המשפט העליון ל-9 עמודים), תקנות סדר הדין האזרחי החדשות (תשע"ט-2018) ביטלו הגבלות אלו. מאחר שתקנות בתי משפט לעניינים מינהליים אינן קובעות בעצמן מגבלה על מספר העמודים בערעור מינהלי, ומאחר שתקנות סדר הדין האזרחי (המוחלות בשינויים המחויבים) אינן כוללות עוד הגבלה כזו, הרי שכיום אין מגבלה על מספר העמודים בערעור מינהלי. עם זאת, יש לזכור כי בית המשפט רשאי תמיד להורות על קיצור כתבי טענות אם הם ארוכים יתר על המידה ואינם ענייניים. הפסיקה מדגישה כי הליכים מינהליים, בדומה לבג"ץ, מתנהלים ככלל על בסיס כתובים וללא שמיעת ראיות, מה שמצדיק לעיתים אורך רב יותר של כתבי הטענות לצורך הצגת התשתית העובדתית והמשפטית המלאה. ראו לעניין זה עע"מ 10811/04 מוחמד עבדאללה סורחי ו-20 אח'' נ'' משרד הפנים (17.3.2005) וכן דנ"מ 10205/17 חיפה כימיקלים בע"מ נ'' עיריית חיפה (15.12.2020).', 'הבלבול בין תקנות סדר הדין האזרחי הישנות לחדשות, והנחה שקיימת מגבלת עמודים כללית על כל סוגי הערעורים, מבלי להבחין בין סוגי ההליכים והתקנות הספציפיות החלות עליהם.',
    '["ערעור מינהלי", "תקנות בתי משפט לעניינים מינהליים", "תקנות סדר הדין האזרחי", "מגבלת עמודים", "כתבי טענות", "פומביות הדיון"]'::jsonb, '**וריאציה 1 — מגבלת עמודים בתקסד"א הישנות:** האם הייתה מגבלת עמודים בערעורים אזרחיים בעבר? ← כן, למשל 9 עמודים לערעור לעליון (תקנה 410(א) לתקסד"א 1984).
**וריאציה 2 — מגבלת עמודים בתקסד"א החדשות:** האם קיימת מגבלת עמודים בערעורים אזרחיים כיום? ← לא, תקנות סדר הדין האזרחי, תשע"ט-2018, ביטלו את ההגבלה.
**וריאציה 3 — ערעור מינהלי:** האם קיימת מגבלת עמודים בערעור מינהלי? ← לא, תקנות בתי משפט לעניינים מינהליים אינן קובעות זאת, והתקסד"א החדשות אינן כוללות הגבלה כזו (תקנה 28 לתקנות בתי משפט לעניינים מינהליים).', 'אין מגבלה על מספר העמודים בערעור מינהלי ← מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים ← והעדר הגבלה בתקסד"א החדשות.', '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 28", "עע\"מ 10811/04 מוחמד עבדאללה סורחי ו-20 אח'' נ'' משרד הפנים (17.3.2005)", "דנ\"מ 10205/17 חיפה כימיקלים בע\"מ נ'' עיריית חיפה (15.12.2020)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Administrative appeal page length — administrative procedure isn''t a dedicated subtopic; civil_proc/proceedings is the closest', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ערעור מוגבל ל-9 עמודים, ולכן יש לקצר את כתב הטענות.', false, 'טענה זו שגויה. הגבלת 9 העמודים הייתה קיימת בתקנות סדר הדין האזרחי, התשמ"ד-1984, אך לא חלה באופן גורף על ערעורים מינהליים, ובכל מקרה, תקנות סדר הדין האזרחי החדשות (תשע"ט-2018) ביטלו את ההגבלה הזו.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'ככלל, ערעור מוגבל ל-9 עמודים, ולכן יש לבקש מבית המשפט, מראש, אישור להגדלת מספר העמודים.', false, 'טענה זו שגויה. הגבלת העמודים אינה חלה על ערעורים מינהליים, ואין צורך לבקש אישור מראש להגדלת מספר העמודים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ככלל, ערעור מוגבל ל-9 עמודים, ולכן יש להגיש את הערעור לצד בקשה להגדלת מספר העמודים.', false, 'טענה זו שגויה. אין הגבלה על מספר העמודים בערעור מינהלי, ולכן אין צורך להגיש בקשה להגדלת מספר העמודים.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ככלל, אין מגבלה על מספר העמודים בערעור מינהלי.', true, 'זוהי התשובה הנכונה. תקנה 28 לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, מחילה את פרק ל'' לתקנות סדר הדין האזרחי על ערעורים מינהליים, אך תקנות אלו אינן קובעות הגבלה על מספר העמודים בערעור מינהלי, וגם תקנות סדר הדין האזרחי החדשות ביטלו את ההגבלה שהייתה קיימת בעבר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'הגשת ראיות חדשות בערעור מינהלי',
    1, 'ראובן הגיש ערעור מינהלי לבית המשפט המחוזי. במהלך הדיון בערעור, הוא מבקש להגיש ראיה חדשה שלא הוגשה בפני הערכאה הדיונית (ועדת הערר). האם בית המשפט יתיר לו להגיש את הראיה?', 'שאלה זו עוסקת בכלל בדבר הגשת ראיות חדשות בשלב הערעור המינהלי. היא מדגישה את הכלל לפיו ערכאת הערעור אינה נוטה להתיר הגשת ראיות שלא הובאו בפני הערכאה הדיונית, אלא במקרים חריגים ויוצאי דופן, וזאת מכוח תקנה 457 לתקנות סדר הדין האזרחי המוחלת על ערעורים מינהליים.', 'תקנה 457 לתקנות סדר הדין האזרחי, התשמ"ד-1984 (שחלה מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000), קובעת כי ''בעלי הדין בערעור אינם זכאים להביא ראיות נוספות שלא הובאו בפני הערכאה הדיונית''. הלכה פסוקה היא כי צירוף ראיות חדשות בשלב הערעור יותרו רק במקרים חריגים ביותר, כאשר מדובר בראיות שהיו חיוניות להכרעה ולא ניתן היה להשיגן בשלב הדיוני, או כאשר אי קבלתן עלול לגרום לעיוות דין. המטרה היא למנוע מבעלי דין ''מקצה שיפורים'' ולשמור על יעילות ההליך. כך למשל, בעע"מ 6704/13 ועד מקומי תנובות נ'' תוסף קומפאונדס בע"מ (8.7.2015), נדחתה בקשה לצרף ראיות חדשות בשלב הערעור. גם בדנ"מ 10205/17 חיפה כימיקלים בע"מ נ'' עיריית חיפה (15.12.2020), הודגש כי בהליך מינהלי חקירת מומחה נתונה לשיקול דעת בית המשפט ותותר במקרים חריגים בלבד.',
    'הנחה שערכאת הערעור היא ''הזדמנות שנייה'' להצגת כל הראיות, מבלי להבין את הכלל בדבר אי-הגשת ראיות חדשות ואת החריגים המצומצמים לו.', '["ערעור מינהלי", "ראיות חדשות", "תקנות סדר הדין האזרחי", "תקנות בתי משפט לעניינים מינהליים", "מקרים חריגים", "עיוות דין"]'::jsonb, '**וריאציה 1 — כלל בסיסי:** האם ניתן להגיש ראיות חדשות בערעור מינהלי? ← לא, ככלל, אלא במקרים חריגים (תקנה 457 לתקסד"א, עע"מ תנובות).
**וריאציה 2 — חריגים:** מהם המקרים החריגים? ← ראיות חיוניות שלא ניתן היה להשיגן קודם, או למניעת עיוות דין (עע"מ תנובות).
**וריאציה 3 — רציונל:** מדוע הכלל כה מחמיר? ← לשמור על יעילות ההליך, למנוע ''מקצה שיפורים'' ולעודד הצגת כל הראיות בערכאה הדיונית.', 'הגשת ראיות חדשות בערעור מינהלי ← אסורה ככלל ← מותרת רק במקרים חריגים ביותר.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 28", "תקנות סדר הדין האזרחי, תשמ\"ד-1984: תקנה 457", "עע\"מ 6704/13 ועד מקומי תנובות נ'' תוסף קומפאונדס בע\"מ (8.7.2015)", "דנ\"מ 10205/17 חיפה כימיקלים בע\"מ נ'' עיריית חיפה (15.12.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, בית המשפט יתיר הגשת ראיות חדשות אם הן רלוונטיות להכרעה בערעור.', false, 'טענה זו שגויה. הגשת ראיות חדשות בערעור אינה אוטומטית, אלא כפופה לכללים מחמירים ולשיקול דעת בית המשפט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, ככלל, בעלי הדין בערעור אינם זכאים להביא ראיות נוספות שלא הובאו בפני הערכאה הדיונית, אלא במקרים חריגים בלבד.', true, 'זוהי התשובה הנכונה. תקנה 457 לתקנות סדר הדין האזרחי (החלה מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים) קובעת כלל זה, והפסיקה מפרשת אותו בצמצום.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק אם הראיה לא הייתה קיימת בעת הדיון בערכאה הדיונית.', false, 'טענה זו שגויה. למרות שזהו שיקול, הוא אינו התנאי היחיד או המכריע, ועדיין נדרש אישור בית המשפט במקרים חריגים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, בית המשפט לעניינים מינהליים דן רק על בסיס כתובים ואינו שומע ראיות כלל.', false, 'טענה זו שגויה. למרות שעתירות מינהליות נדונות לרוב על בסיס כתובים, בית המשפט רשאי במקרים חריגים להתיר שמיעת ראיות, וערעור מינהלי אינו זהה לעתירה מינהלית מבחינה זו.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'עקרונות החלת תקנות סדר הדין האזרחי על ערעור מינהלי',
    2, 'מהם העקרונות המנחים להחלת תקנות סדר הדין האזרחי על ערעורים מינהליים?', 'שאלה זו מתמקדת בעקרונות החלים על שילוב תקנות סדר הדין האזרחי בהליכי ערעור מינהליים. היא מדגישה את הוראת תקנה 28 לתקנות בתי משפט לעניינים מינהליים, הקובעת את תחולת פרק ל'' לתקנות סדר הדין האזרחי, תוך סייגים והתאמות הנדרשות לאופי המשפט המינהלי.', 'תקנה 28(א) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, קובעת כי ''הוראות פרק י"ז לחלק ב'' לתקנות סדר הדין האזרחי יחולו על ערעור לפי פרק זה, בשינויים המחויבים, אם אין בחוק ובתקנות אלה הוראה אחרת לעניין הנדון, ואם אין בעניין הנדון או בהקשרו דבר שאינו מתיישב עם הוראות החוק ותקנות אלה''. פרק י"ז לחלק ב'' בתקנות סדר הדין האזרחי (תשע"ט-2018) עוסק בערעורים. הוראה דומה, המחיל את פרק ל'' לתקנות סדר הדין האזרחי (תשמ"ד-1984), הייתה קיימת בתקנה 28 הישנה. עקרון זה מבטיח אחידות פרוצדורלית במידת האפשר, תוך שמירה על הייחוד של המשפט המינהלי. הפסיקה עמדה על כך שסדרי הדיון והראיות בפני בית המשפט המינהלי דומים לאלה הנהוגים בבג"ץ, וכי הליכים אלה מתמצים לרוב בהגשת תצהירים ללא שמיעת עדים, אלא במקרים חריגים. כך למשל, בעע"מ 10811/04 מוחמד עבדאללה סורחי ו-20 אח'' נ'' משרד הפנים (17.3.2005), ובדנ"מ 10205/17 חיפה כימיקלים בע"מ נ'' עיריית חיפה (15.12.2020).',
    'הנחה כי תקנות סדר הדין האזרחי חלות באופן מלא או אינן חלות כלל, מבלי להבין את הסייגים וההתאמות הקבועים בתקנות בתי משפט לעניינים מינהליים.', '["תקנות בתי משפט לעניינים מינהליים", "תקנות סדר הדין האזרחי", "ערעור מינהלי", "שינויים מחויבים", "הוראה אחרת", "אי-התיישבות"]'::jsonb, '**וריאציה 1 — כלל ההחלה:** מתי חלות תקנות סדר הדין האזרחי על ערעור מינהלי? ← בשינויים המחויבים, אם אין הוראה אחרת או אי-התיישבות (תקנה 28 לתקנות בתי משפט לעניינים מינהליים).
**וריאציה 2 — אופי הדיון:** כיצד מתנהל דיון בערעור מינהלי? ← ככלל, על בסיס כתובים וללא שמיעת ראיות, בדומה לבג"ץ (עע"מ סורחי).
**וריאציה 3 — חשיבות הסייגים:** מדוע קיימים סייגים להחלה? ← לשמור על הייחוד של המשפט המינהלי ועל אופי הביקורת השיפוטית המנהלית.', 'תקנות סדר הדין האזרחי חלות על ערעור מינהלי ← בשינויים ובסייגים ← לפי תקנה 28 לתקנות בתי משפט לעניינים מינהליים.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 28(א)", "עע\"מ 10811/04 מוחמד עבדאללה סורחי ו-20 אח'' נ'' משרד הפנים (17.3.2005)", "דנ\"מ 10205/17 חיפה כימיקלים בע\"מ נ'' עיריית חיפה (15.12.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'תקנות סדר הדין האזרחי חלות באופן מלא על ערעורים מינהליים, ללא כל שינוי או סייג.', false, 'טענה זו שגויה. תקנות סדר הדין האזרחי חלות על ערעורים מינהליים ''בשינויים המחויבים'' ורק אם אין הוראה אחרת או אי-התיישבות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'תקנות סדר הדין האזרחי חלות על ערעורים מינהליים ''בשינויים המחויבים'', וכל עוד אין בחוק ובתקנות בתי משפט לעניינים מינהליים הוראה אחרת לעניין הנדון, ואין דבר שאינו מתיישב עם הוראותיהם.', true, 'זוהי התשובה הנכונה. תקנה 28 לתקנות בתי משפט לעניינים מינהליים קובעת במפורש את עקרונות ההחלה של תקנות סדר הדין האזרחי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'תקנות סדר הדין האזרחי חלות רק אם בית המשפט לעניינים מינהליים הורה על כך במפורש.', false, 'טענה זו שגויה. החלת תקנות סדר הדין האזרחי נובעת מהוראת חוק (תקנה 28) ואינה תלויה בהוראה פרטנית של בית המשפט בכל מקרה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'תקנות סדר הדין האזרחי אינן חלות כלל על ערעורים מינהליים, שכן מדובר בסדרי דין שונים לחלוטין.', false, 'טענה זו שגויה. קיימת הוראה מפורשת (תקנה 28) המחיל את תקנות סדר הדין האזרחי, בשינויים, על ערעורים מינהליים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חובת הפקדת עירבון בערעור מינהלי',
    3, 'שמעון הגיש ערעור מינהלי על החלטת ועדת ערר לארנונה. האם ניתן לחייב אותו בהפקדת עירבון להבטחת הוצאות העירייה בהליך הערעור?', 'שאלה זו בוחנת את חובת הפקדת עירבון בהליכי ערעור מינהליים, תוך התייחסות לתחולת תקנות סדר הדין האזרחי באמצעות תקנה 28 לתקנות בתי משפט לעניינים מינהליים. היא מדגישה את הרציונל שמאחורי דרישת העירבון, גם בהליכים מול רשויות, ואת שיקול הדעת בקביעת גובהו.', 'חובת הפקדת עירבון להבטחת הוצאות המשיב בערעור קבועה בתקנה 427 לתקנות סדר הדין האזרחי (תשמ"ד-1984). תקנה 28 לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, מחילה את פרק ל'' לתקנות סדר הדין האזרחי (שכלל את תקנה 427) על ערעורים מינהליים. הפסיקה קבעה כי התכליות שאותן משרתת דרישת העירבון רלוונטיות גם להתדיינות מינהלית, וכי העובדה שההליך מתנהל בין האזרח לרשות אינה מהווה טעם המצדיק, כשלעצמו, אי-הפקדת עירבון. בית המשפט ישקול את אופיו של הטריבונל המינהלי שעליו נסב הערעור בקביעת גובה העירבון. כך למשל, בבר"מ 2498/14 המרכז לאקונומיה בישראל בע''''מ נ'' עיריית רחובות (מנהל הארנונה וועדת ערר לארנונה) (10.6.2014), נדחתה בקשה לפטור מעירבון בערעור מינהלי. גם בבר"מ 31/04 נחום קרליץ – בא-כוח רשימת נחל 2003 שסימנה "ץ" נ'' פקיד הבחירות לעיריית באר שבע 2003 (14.3.2004), נקבע כי חובת העירבון חלה גם על ערעורי בחירות, שהם ערעורים מינהליים.',
    'הנחה שקיימת חסינות אוטומטית מחובת עירבון בהליכים מול רשויות, או בלבול בין פטור מאגרה לפטור מעירבון.', '["עירבון", "ערעור מינהלי", "תקנות סדר הדין האזרחי", "תקנות בתי משפט לעניינים מינהליים", "זכות גישה לערכאות", "הבטחת הוצאות"]'::jsonb, '**וריאציה 1 — חובת עירבון:** האם חלה חובת עירבון בערעור מינהלי? ← כן, מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים המחיל את תקנה 427 לתקסד"א (בר"מ המרכז לאקונומיה).
**וריאציה 2 — רציונל:** מדוע חלה חובה זו גם מול רשות? ← להבטחת הוצאות המשיב, שכן ההליך מתמשך לאחר החלטה קודמת (בר"מ המרכז לאקונומיה).
**וריאציה 3 — שיקולים לקביעת גובה:** מהם השיקולים בקביעת גובה העירבון? ← אופי הטריבונל המינהלי, סיכויי הערעור, יכולת כלכלית (בר"מ המרכז לאקונומיה, בר"מ קרליץ).', 'חובת הפקדת עירבון ← חלה גם בערעור מינהלי ← מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 28", "תקנות סדר הדין האזרחי, תשמ\"ד-1984: תקנה 427", "בר\"מ 2498/14 המרכז לאקונומיה בישראל בע''''מ נ'' עיריית רחובות (מנהל הארנונה וועדת ערר לארנונה) (10.6.2014)", "בר\"מ 31/04 נחום קרליץ – בא-כוח רשימת נחל 2003 שסימנה \"ץ\" נ'' פקיד הבחירות לעיריית באר שבע 2003 (14.3.2004)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'לא, חובת הפקדת עירבון אינה חלה על ערעורים מינהליים, שכן מדובר בהליכים בין אזרח לרשות.', false, 'טענה זו שגויה. הפסיקה קבעה כי חובת הפקדת עירבון חלה גם בהליכים מינהליים, וכי העובדה שההליך מתנהל בין אזרח לרשות אינה מצדיקה פטור אוטומטי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'כן, חובת הפקדת עירבון חלה גם על ערעורים מינהליים, מכוח תקנה 28 לתקנות בתי משפט לעניינים מינהליים המחיל את תקנות סדר הדין האזרחי בעניין זה.', true, 'זוהי התשובה הנכונה. תקנה 28 מחילה את תקנה 427 לתקנות סדר הדין האזרחי (העוסקת בעירבון) על ערעורים מינהליים, והפסיקה אישרה זאת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אך רק אם בית המשפט לעניינים מינהליים מצא כי הערעור קלוש וחסר סיכוי.', false, 'טענה זו שגויה. סיכויי הערעור הם שיקול בקביעת גובה העירבון או פטור ממנו, אך לא תנאי יחיד להחלת החובה העקרונית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, אלא אם כן המערער לא עמד בחיובי הוצאות שנפסקו נגדו בהליך קודם.', false, 'טענה זו שגויה. אי-עמידה בהוצאות קודמות היא שיקול נוסף, אך לא התנאי היחיד להחלת חובת העירבון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'סמכות ערכאת הערעור לדון בעובדות חדשות',
    4, 'במסגרת ערעור מינהלי על החלטה של בית משפט לעניינים מינהליים, מתעוררת שאלה עובדתית שלא נדונה במלואה בערכאה הדיונית. האם ערכאת הערעור (בית המשפט העליון) צריכה להחזיר את הדיון לערכאה המבררת, או שהיא רשאית להכריע בעצמה בשאלה העובדתית?', 'שאלה זו עוסקת בהיקף סמכותה של ערכאת הערעור (בית המשפט העליון) לדון בשאלות עובדתיות בערעור מינהלי. היא מדגישה את המגמה בפסיקה להמעיט בהחזרת דיונים לערכאה המבררת, משיקולי סופיות ויעילות, במיוחד כאשר התשתית העובדתית קיימת בפני ערכאת הערעור, ובהתחשב באופי הדיון המינהלי המבוסס על כתובים.', 'הכלל הוא שערכאת הערעור אינה נוטה להתערב בממצאי עובדה של הערכאה הדיונית, אך היא מוסמכת לעשות זאת. כאשר מתעוררת שאלה עובדתית בערעור, הפסיקה קובעת כי ככל שקיימת בפני ערכאת הערעור התשתית הדרושה כדי להכריע במחלוקות העובדתיות, הרי שטוב תעשה אם תכריע בה, חלף החזרת המחלוקת לערכאה הדיונית. זאת, משיקולים של סופיות ויעילות הדיון, ועל מנת להמעיט ככל הניתן בהחזרת הדיון. הדברים נכונים ביתר שאת בערעור על הכרעה של בית המשפט לעניינים מינהליים, במסגרת הליך של עתירה מינהלית, אשר מנוהלת ככלל, בדומה להליכים בפני בית המשפט הגבוה לצדק, על בסיס כתובים וללא שמיעת ראיות. במצב כזה, אין יתרון מובנה לערכאה המבררת על פני ערכאת הערעור, באשר זו האחרונה נחשפת לכלל החומר הדרוש להכרעה מהכתובים. כך נקבע בדנ"מ 10205/17 חיפה כימיקלים בע"מ נ'' עיריית חיפה (15.12.2020).',
    'הנחה שערכאת הערעור מוגבלת תמיד לשאלות משפטיות בלבד, או שהיא חייבת להחזיר את הדיון לערכאה הדיונית בכל פעם שמתעוררת שאלה עובדתית, מבלי להכיר בסמכותה ובשיקול דעתה להכריע בעצמה.', '["ערכאת ערעור", "שאלות עובדתיות", "סופיות דיון", "יעילות דיונית", "הליך מינהלי", "החזרת דיון"]'::jsonb, '**וריאציה 1 — הכרעה בעובדות:** האם ערכאת הערעור יכולה להכריע בעובדות? ← כן, אם קיימת בפניה התשתית הדרושה (דנ"מ חיפה כימיקלים).
**וריאציה 2 — שיקולי יעילות:** מדוע ערכאת הערעור תכריע בעצמה? ← משיקולי סופיות ויעילות הדיון, כדי למנוע סחבת (דנ"מ חיפה כימיקלים).
**וריאציה 3 — אופי הדיון המינהלי:** מהו היתרון של ערכאת הערעור בהליך מינהלי? ← הדיון מבוסס על כתובים, ולכן אין יתרון מובנה לערכאה המבררת (דנ"מ חיפה כימיקלים).', 'ערכאת ערעור ← רשאית להכריע בעובדות ← אם התשתית קיימת ומשיקולי יעילות.',
    '["דנ\"מ 10205/17 חיפה כימיקלים בע\"מ נ'' עיריית חיפה (15.12.2020)", "עע\"מ 10811/04 מוחמד עבדאללה סורחי ו-20 אח'' נ'' משרד הפנים (17.3.2005)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'ערכאת הערעור חייבת להחזיר את הדיון לערכאה המבררת בכל מקרה שמתעוררת שאלה עובדתית.', false, 'טענה זו שגויה. הפסיקה קובעת כי משיקולי יעילות וסופיות הדיון, ערכאת הערעור רשאית להכריע בעצמה אם התשתית העובדתית קיימת בפניה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'ערכאת הערעור רשאית להכריע בעצמה בשאלה העובדתית, אם קיימת בפניה התשתית הדרושה לכך, וזאת משיקולי סופיות ויעילות הדיון.', true, 'זוהי התשובה הנכונה. הפסיקה מדגישה את סמכותה של ערכאת הערעור להכריע בעובדות, במיוחד בהליכים מינהליים המבוססים על כתובים, כדי למנוע סחבת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'ערכאת הערעור רשאית להכריע בעצמה רק אם הצדדים הסכימו לכך.', false, 'טענה זו שגויה. הסכמת הצדדים אינה תנאי לסמכותה של ערכאת הערעור להכריע בעובדות, אם התשתית קיימת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'ערכאת הערעור אינה מוסמכת לדון בעובדות כלל, אלא רק בשאלות משפטיות.', false, 'טענה זו שגויה. למרות שערכאת הערעור מתמקדת בשאלות משפטיות, היא אינה מנועה מלהכריע בעובדות אם התשתית קיימת, במיוחד בהליכים מינהליים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 29, '2022-S-Q29';
END
$$;

-- ============================================================
-- Q30 — 2022-S-Q30 — chapter=civil_proc subtopic=proceedings  [needs_review]
-- classifier_note: Date computation for administrative decision — administrative procedure gap; civil_proc/proceedings is the closest
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'c8a2d7bd-3f4f-4374-967e-1a82247f8a58'::uuid;
  v_group_id uuid := '01b20b48-586f-4af5-a562-00fadd1722c3'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'a2d2c1fa-2679-4ad2-85c1-5420b53e6854'::uuid;
  v_ang_1 uuid := '59ccdfdf-af66-4d14-8410-d36f71674170'::uuid;
  v_ang_2 uuid := '8050c012-4977-4e57-a437-f3e2a4bd3973'::uuid;
  v_ang_3 uuid := 'cff420dd-3a31-4fb9-95ce-010df46c00b6'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q30';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 30, '2022-S-Q30';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'proceedings', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q30', v_chapter_id, v_subtopic_id, 'עורך דין מסר למרשתו ביום 2.6.2022 החלטה של רשות מינהלית שדחתה בקשה שהוא הגיש עבורה. עורך הדין קיבל את המכתב ביום 29.5.2022. על המכתב מופיע התאריך 1.5.2022, אך בפועל הוא נשלח בדואר רק ביום 8.5.2022. בהנחה שאין שיהוי, מתי המועד האחרון לעתור נגד ההחלטה?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 30}'::jsonb, 'השאלה עוסקת במועד תחילת מניין 45 הימים להגשת עתירה מינהלית, בהתאם לתקנה 3(ב) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000. היא מדגישה את הכלל לפיו המועד הקובע הוא המוקדם מבין מועד פרסום ההחלטה כדין, מועד קבלת ההודעה על ידי העותר, או מועד שנודע לעותר עליה, כאשר קבלת ההודעה על ידי בא כוחו של העותר נחשבת כידיעה לעניין זה.', 'תקנה 3(ב) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, קובעת כי עתירה מינהלית תוגש ''בלא שיהוי, לפי נסיבות הענין, ולא יאוחר מארבעים וחמישה ימים מיום שההחלטה פורסמה כדין, או מיום שהעותר קיבל הודעה עליה או מיום שנודע לעותר עליה, לפי המוקדם''. במקרה הנדון, ההחלטה נשלחה בדואר ביום 8.5.2022, אך עורך הדין קיבל אותה ביום 29.5.2022. המרשה (העותרת) קיבלה את ההחלטה מעורך הדין ביום 2.6.2022. על פי הפסיקה, קבלת הודעה על ידי בא כוחו של העותר נחשבת קבלת הודעה על ידי העותר לצורך מניין הימים. לכן, המועד המוקדם ביותר שבו ניתן לומר כי ''נודע לעותר עליה'' הוא 29.5.2022, מועד קבלת ההחלטה על ידי עורך הדין. מניין 45 הימים יחל אפוא מיום 29.5.2022. ראו לעניין זה עע"מ 50139-12-24 אמל אלעוברה נ'' מדינת ישראל רשות מקרקעי ישראל (5.5.2025), וכן עת"מ (מינהליים חי'') 31773-11-21 סאמי נעאמנה נ'' ועדה ארצית לתכנון ובנייה של מחמים מועדפים לדיור (14.11.2021).', 'הבלבול בין מועד הוצאת ההחלטה, מועד שליחתה, מועד קבלתה על ידי עורך הדין, ומועד מסירתה ללקוח, והתעלמות מהכלל של ''לפי המוקדם'' ומהמשמעות של קבלת הודעה על ידי בא כוח.',
    '["עתירה מינהלית", "מועדים להגשה", "תקנה 3(ב)", "שיהוי", "ידיעה בפועל", "ייצוג משפטי"]'::jsonb, '**וריאציה 1 — מועד קבלת עו"ד:** עו"ד קיבל החלטה מינהלית ב-29.5, מסר ללקוח ב-2.6. מתי מתחיל מניין 45 הימים? ← 29.5, מועד קבלת עו"ד (תקנה 3(ב)).
**וריאציה 2 — מועד שליחת המכתב:** האם מועד שליחת המכתב (8.5) רלוונטי? ← לא, הקובע הוא מועד הידיעה/קבלה בפועל (תקנה 3(ב)).
**וריאציה 3 — רציונל:** מדוע קבלת עו"ד מחייבת את הלקוח? ← עורך הדין הוא שלוחו של הלקוח, וזאת כדי למנוע סחבת בהליכים מינהליים (עע"מ אלעוברה).', 'מועד אחרון לעתור ← 45 ימים מיום קבלת ההחלטה על ידי עורך הדין ← לפי תקנה 3(ב) לתקנות בתי משפט לעניינים מינהליים.', '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 3(ב)", "עע\"מ 50139-12-24 אמל אלעוברה נ'' מדינת ישראל רשות מקרקעי ישראל (5.5.2025)", "עת\"מ (מינהליים חי'') 31773-11-21 סאמי נעאמנה נ'' ועדה ארצית לתכנון ובנייה של מחמים מועדפים לדיור (14.11.2021)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''proceedings'' | classifier_note: Date computation for administrative decision — administrative procedure gap; civil_proc/proceedings is the closest', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', '45 ימים מיום 2.6.2022.', false, 'טענה זו שגויה. המועד הקובע הוא המוקדם מבין המועדים שבהם ההחלטה פורסמה כדין, או שהעותר קיבל הודעה עליה, או שנודע לו עליה. קבלת ההודעה על ידי עורך הדין נחשבת קבלת הודעה לעניין מניין הימים, והיא קדמה למועד שבו עורך הדין מסר למרשתו.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', '45 ימים מיום 29.5.2022.', true, 'זוהי התשובה הנכונה. תקנה 3(ב) לתקנות בתי משפט לעניינים מינהליים קובעת כי המועד להגשת עתירה הוא 45 ימים מיום שההחלטה פורסמה כדין, או מיום שהעותר קיבל הודעה עליה, או מיום שנודע לעותר עליה, לפי המוקדם. קבלת ההחלטה על ידי עורך הדין (הבא כוחו של העותר) ביום 29.5.2022 היא המועד המוקדם ביותר שבו ניתן לומר כי ''נודע לעותר עליה'' באמצעות בא כוחו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', '45 ימים מיום 8.5.2022.', false, 'טענה זו שגויה. מועד שליחת המכתב בדואר אינו המועד הקובע, אלא מועד קבלת ההודעה או הידיעה עליה בפועל.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', '45 ימים מיום 1.5.2022.', false, 'טענה זו שגויה. תאריך ההחלטה המופיע על המכתב אינו המועד הקובע, אלא מועד פרסומה כדין, קבלת ההודעה עליה או הידיעה עליה, לפי המוקדם.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'מועד הגשת עתירה מינהלית כאשר ההחלטה נמסרה לעורך הדין',
    1, 'עו"ד דנה מייצגת את מר יצחק בעתירה מינהלית. ביום 1.3.2026 קיבלה עו"ד דנה הודעה על החלטה מינהלית הנוגעת למר יצחק. עו"ד דנה מסרה את ההודעה למר יצחק רק ביום 10.3.2026. מתי יחל מניין 45 הימים להגשת העתירה המינהלית?', 'שאלה זו בוחנת את מועד תחילת מניין 45 הימים להגשת עתירה מינהלית, כאשר ההחלטה המינהלית נמסרת לבא כוחו של העותר. היא מדגישה את הכלל לפיו קבלת הודעה על ידי עורך הדין נחשבת קבלת הודעה על ידי העותר, בהתאם לעקרון הייצוג המשפטי.', 'תקנה 3(ב) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, קובעת כי עתירה תוגש בלא שיהוי, ולא יאוחר מ-45 ימים מיום שההחלטה פורסמה כדין, או מיום שהעותר קיבל הודעה עליה, או מיום שנודע לעותר עליה, לפי המוקדם. הפסיקה מפרשת את המונח ''נודע לעותר עליה'' ככולל גם ידיעה באמצעות בא כוחו. כלומר, מרגע שעורך הדין קיבל את ההחלטה, מניין 45 הימים מתחיל לרוץ, גם אם טרם מסר אותה ללקוחו. זאת, כדי למנוע סחבת ולשמור על יעילות ההליך המינהלי. ראו לעניין זה עע"מ 50139-12-24 אמל אלעוברה נ'' מדינת ישראל רשות מקרקעי ישראל (5.5.2025), וכן עת"מ (מינהליים חי'') 31773-11-21 סאמי נעאמנה נ'' ועדה ארצית לתכנון ובנייה של מחמים מועדפים לדיור (14.11.2021).',
    'הנחה שמועד הידיעה של העותר עצמו הוא הקובע, ולא מועד הידיעה של בא כוחו, מה שעלול להוביל לאיחור בהגשת העתירה.', '["עתירה מינהלית", "מועדים להגשה", "תקנות בתי משפט לעניינים מינהליים", "ייצוג משפטי", "שיהוי"]'::jsonb, '**וריאציה 1 — קבלת הודעה ע"י עו"ד:** עו"ד קיבל הודעה על החלטה מינהלית. מתי מתחיל מניין 45 הימים? ← מיום קבלת ההודעה על ידי עורך הדין (תקנה 3(ב)).
**וריאציה 2 — אי-עדכון הלקוח:** עו"ד לא עדכן את הלקוח מיד. האם זה משנה את מניין הימים? ← לא, מניין הימים מתחיל מקבלת ההודעה על ידי עורך הדין (עע"מ אלעוברה).
**וריאציה 3 — רציונל:** מדוע קבלת עו"ד מחייבת את הלקוח? ← עורך הדין הוא שלוחו של הלקוח, וזאת כדי למנוע סחבת בהליכים מינהליים.', 'מועד הגשת עתירה מינהלית ← 45 ימים ממועד ידיעת העותר או בא כוחו ← לפי המוקדם.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 3(ב)", "עע\"מ 50139-12-24 אמל אלעוברה נ'' מדינת ישראל רשות מקרקעי ישראל (5.5.2025)", "עת\"מ (מינהליים חי'') 31773-11-21 סאמי נעאמנה נ'' ועדה ארצית לתכנון ובנייה של מחמים מועדפים לדיור (14.11.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'מיום 1.3.2026, מועד קבלת ההודעה על ידי עורך הדין.', true, 'זוהי התשובה הנכונה. קבלת הודעה על ידי בא כוחו של העותר נחשבת קבלת הודעה לעניין מניין הימים להגשת עתירה מינהלית, שכן עורך הדין הוא שלוחו של העותר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'מיום 10.3.2026, מועד מסירת ההודעה לעותר עצמו.', false, 'טענה זו שגויה. המועד הקובע הוא המוקדם מבין המועדים שבהם ההחלטה פורסמה כדין, או שהעותר קיבל הודעה עליה, או שנודע לו עליה. קבלת ההודעה על ידי עורך הדין נחשבת קבלת הודעה לעניין מניין הימים, והיא קדמה למועד שבו עורך הדין מסר למרשתו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'מיום פרסום ההחלטה כדין, אם פורסמה.', false, 'טענה זו שגויה. למרות שפרסום כדין הוא אחד המועדים האפשריים, השאלה מתמקדת במועד קבלת ההודעה על ידי העותר או בא כוחו, והמועד המוקדם מבין אלה הוא הקובע.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'מיום שנודע לעו"ד דנה על ההחלטה, אך רק אם מר יצחק אישר לה לפעול בשמו.', false, 'טענה זו שגויה. מרגע שעורך דין מייצג את העותר, קבלת הודעה על ידו מחייבת את העותר, ואין צורך באישור נוסף לפעולה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מבחני השיהוי בעתירה מינהלית',
    2, 'מהם שלושת המבחנים העיקריים שבית המשפט בוחן בעת הכרעה בטענת שיהוי בעתירה מינהלית?', 'שאלה זו עוסקת במבחנים המנחים את בית המשפט בבחינת טענת שיהוי בעתירה מינהלית. היא מדגישה את שלושת הרכיבים המרכזיים שפותחו בפסיקה: השיהוי הסובייקטיבי, השיהוי האובייקטיבי והאינטרס הציבורי בשמירה על שלטון החוק.', 'הלכת השיהוי במשפט המינהלי, שאומצה גם בתקנות בתי משפט לעניינים מינהליים, מבוססת על שלושה מבחנים עיקריים: ראשית, השיהוי הסובייקטיבי, הבוחן את התנהלותו של העותר והאם ניתן ללמוד ממנה על ויתור משתמע על זכויותיו. שנית, השיהוי האובייקטיבי, הבוחן את הנזק שנגרם לרשות המינהלית או לצדדים שלישיים כתוצאה מהאיחור בהגשת העתירה. שלישית, האינטרס הציבורי, הבוחן האם דחיית העתירה, חרף השיהוי, עלולה להביא לפגיעה חמורה בשלטון החוק. רק כאשר מתקיימים הרכיבים הסובייקטיבי והאובייקטיבי, תתקבל טענת השיהוי, אלא אם כן האינטרס הציבורי בשמירה על שלטון החוק גובר. ראו לעניין זה עת"מ (מינהליים ת"א) 38662-05-21 יצחק מנחם נ'' עיריית תל-אביב-יפו (29.11.2021), בר"מ 1008/24 לב פאירמן נ'' עיריית רמת גן (10.9.2024), וכן בג"ץ 2285/93 אוסי נחום נ'' גיורא לב, ראש עיריית פתח-תקווה, מח(5) 630 (27.12.1994).',
    'התמקדות רק באחד ממבחני השיהוי (לרוב הסובייקטיבי) והתעלמות מהאחרים, או אי-הבנה של האיזון בין המבחנים.', '["שיהוי מינהלי", "שיהוי סובייקטיבי", "שיהוי אובייקטיבי", "שלטון החוק", "אינטרס ציבורי", "עתירה מינהלית"]'::jsonb, '**וריאציה 1 — מבחני השיהוי:** מהם שלושת המבחנים לבחינת שיהוי בעתירה מינהלית? ← שיהוי סובייקטיבי, שיהוי אובייקטיבי, ואינטרס ציבורי (עת"מ מנחם).
**וריאציה 2 — שיהוי סובייקטיבי:** מה בוחן השיהוי הסובייקטיבי? ← האם העותר ויתר על זכויותיו בהתנהלותו (בג"ץ נחום).
**וריאציה 3 — אינטרס ציבורי:** מתי האינטרס הציבורי גובר על השיהוי? ← כאשר דחיית העתירה עלולה לפגוע פגיעה חמורה בשלטון החוק (עת"מ מנחם).', 'שיהוי בעתירה מינהלית ← נבחן לפי סובייקטיבי, אובייקטיבי, ואינטרס ציבורי ← לשמירה על שלטון החוק.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 4", "עת\"מ (מינהליים ת\"א) 38662-05-21 יצחק מנחם נ'' עיריית תל-אביב-יפו (29.11.2021)", "בג\"ץ 2285/93 אוסי נחום נ'' גיורא לב, ראש עיריית פתח-תקווה, מח(5) 630 (27.12.1994)", "בר\"מ 1008/24 לב פאירמן נ'' עיריית רמת גן (10.9.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'השיהוי הסובייקטיבי של העותר, השיהוי האובייקטיבי (נזק למשיב/צד ג''), והאינטרס הציבורי בשמירה על שלטון החוק.', true, 'זוהי התשובה הנכונה. הפסיקה קבעה שלושה מבחנים מצטברים לבחינת טענת שיהוי בעתירה מינהלית: סובייקטיבי, אובייקטיבי ואינטרס ציבורי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'רק השיהוי הסובייקטיבי של העותר והנזק שנגרם למשיב.', false, 'טענה זו שגויה. המבחן אינו כולל רק שני רכיבים אלה, אלא גם את האינטרס הציבורי בשמירה על שלטון החוק.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'רק הנזק שנגרם לצדדים שלישיים והאינטרס הציבורי.', false, 'טענה זו שגויה. המבחן אינו כולל רק שני רכיבים אלה, אלא גם את השיהוי הסובייקטיבי של העותר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'האם העתירה הוגשה בתוך 45 ימים, והאם נגרם נזק בלתי הפיך למשיב.', false, 'טענה זו שגויה. הגשת העתירה בתוך 45 ימים אינה שוללת שיהוי, וגם אם נגרם נזק, יש לבחון את כלל המבחנים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הארכת מועד להגשת עתירה מינהלית',
    3, 'עתירה מינהלית הוגשה 60 ימים לאחר שהעותר קיבל הודעה על ההחלטה המינהלית. העותר מבקש מבית המשפט להאריך את המועד להגשת העתירה. מהו שיקול הדעת של בית המשפט בבקשה זו?', 'שאלה זו בוחנת את סמכות בית המשפט להאריך את המועד להגשת עתירה מינהלית, גם לאחר שחלפו 45 הימים הקבועים בתקנות. היא מדגישה את המבחן הגמיש של ''הצדקה לכך'' ואת העובדה שדיני השיהוי הכלליים מנחים את שיקול הדעת השיפוטי בעניין זה.', 'תקנה 3(ג) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), התשס"א-2000, קובעת כי ''בית המשפט רשאי להאריך מועד שנקבע להגשת עתירה כאמור בתקנות משנה (א) ו-(ב), לאחר שנתן למשיב הזדמנות להגיב לבקשת ההארכה, אם ראה הצדקה לכך''. הפסיקה קבעה כי אמת המידה לאישור הארכת המועד הקבועה בתקנה זו (''אם ראה הצדקה לכך'') גמישה יותר ממבחן ''הטעם המיוחד'' הנקוט בהקשרים אחרים (כגון הארכת מועד להגשת ערעור). החלטתו של בית המשפט בהקשר זה אמורה להיות מונחית על-פי דיני השיהוי הכלליים, המתחשבים בהיבטים הסובייקטיביים והאובייקטיביים של השיהוי, וכן בחשיבותו של הנושא העומד על הפרק מבחינת שלטון החוק והאינטרס הציבורי. ראו לעניין זה עת"מ (מינהליים חי'') 62902-05-24 מדינת ישראל - משרד הביטחון נ'' מנהלת הארנונה של מועצה אזורית משגב (23.6.2024), עת"מ (מינהליים י-ם) 21427-07-21 קרין לבקוביץ ארמר נ'' שרת הפנים (14.9.2021), וכן בר"מ 3802/16 ארלט יזמות בנין והשקעות בע"מ נ'' ועדת הערר מחוז דרום (12.9.2016).',
    'הנחה שמועד 45 הימים הוא מועד התיישנות קשיח, או בלבול בין מבחן ''הצדקה'' למבחן ''טעמים מיוחדים''.', '["הארכת מועד", "עתירה מינהלית", "תקנה 3(ג)", "דיני שיהוי", "שיקול דעת שיפוטי", "הצדקה"]'::jsonb, '**וריאציה 1 — סמכות הארכה:** האם בית המשפט יכול להאריך את המועד להגשת עתירה מינהלית? ← כן, אם ראה ''הצדקה לכך'' (תקנה 3(ג)).
**וריאציה 2 — מבחן ''הצדקה'':** מהו מבחן ''הצדקה''? ← מבחן גמיש יותר מ''טעמים מיוחדים'', המנחה לפי דיני השיהוי הכלליים (עת"מ מדינת ישראל - משרד הביטחון).
**וריאציה 3 — שיקולים:** מהם השיקולים להארכת מועד? ← שיהוי סובייקטיבי, שיהוי אובייקטיבי, ואינטרס ציבורי (בר"מ ארלט).', 'הארכת מועד לעתירה מינהלית ← אפשרית אם קיימת ''הצדקה'' ← לפי דיני השיהוי הכלליים.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 3(ג)", "עת\"מ (מינהליים חי'') 62902-05-24 מדינת ישראל - משרד הביטחון נ'' מנהלת הארנונה של מועצה אזורית משגב (23.6.2024)", "עת\"מ (מינהליים י-ם) 21427-07-21 קרין לבקוביץ ארמר נ'' שרת הפנים (14.9.2021)", "בר\"מ 3802/16 ארלט יזמות בנין והשקעות בע\"מ נ'' ועדת הערר מחוז דרום (12.9.2016)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט רשאי להאריך את המועד אם ראה ''הצדקה לכך'', לאחר שנתן למשיב הזדמנות להגיב, וזאת בהתאם לדיני השיהוי הכלליים.', true, 'זוהי התשובה הנכונה. תקנה 3(ג) לתקנות בתי משפט לעניינים מינהליים מעניקה לבית המשפט סמכות להאריך מועד אם ראה ''הצדקה לכך'', והפסיקה מפרשת זאת בהתאם לדיני השיהוי הכלליים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בית המשפט חייב לדחות את הבקשה, שכן חלפו 45 הימים הקבועים בתקנה 3(ב).', false, 'טענה זו שגויה. חלוף 45 הימים אינו סוגר את הדלת בפני הגשת עתירה, ובית המשפט מוסמך להאריך את המועד.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט יאריך את המועד רק אם העותר יוכיח ''טעמים מיוחדים'' לאיחור.', false, 'טענה זו שגויה. המבחן של ''טעמים מיוחדים'' מחמיר יותר ורלוונטי להארכת מועד להגשת ערעור, בעוד שבעתירה מינהלית נדרשת ''הצדקה''.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט יאריך את המועד רק אם המשיב הסכים לכך.', false, 'טענה זו שגויה. הסכמת המשיב היא שיקול, אך אינה תנאי הכרחי להארכת מועד, שכן שיקול הדעת נתון לבית המשפט.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'השפעת פנייה לרשות על מניין ימי השיהוי',
    4, 'לאחר שקיבל הודעה על החלטה מינהלית, פנה ראובן לרשות המינהלית במכתבים חוזרים ונשנים בניסיון לשכנע אותה לחזור בה מהחלטתה. התכתובת נמשכה חודשיים. האם תקופת התכתובת עוצרת את מניין 45 הימים להגשת עתירה מינהלית?', 'שאלה זו בוחנת את השפעת פנייה לרשות המינהלית לאחר קבלת החלטה על מניין הימים להגשת עתירה מינהלית. היא מדגישה את הכלל לפיו מגעים עם הרשות אינם עוצרים את מניין הימים, אך יכולים להוות שיקול בבחינת השיהוי הסובייקטיבי של העותר.', 'הכלל הוא כי מניין 45 הימים להגשת עתירה מינהלית מתחיל לרוץ מיום שההחלטה פורסמה כדין, או מיום שהעותר קיבל הודעה עליה, או מיום שנודע לעותר עליה, לפי המוקדם (תקנה 3(ב) לתקנות בתי משפט לעניינים מינהליים). התכתבות של עותר עם הרשות המינהלית לאחר מתן החלטתה, במטרה לנסות ולשכנע את הרשות לחזור בה מההחלטה, אינה מסוגלת למתוח את התקופה להגשת עתירה למימדים בלתי-סבירים. כלומר, מגעים אלו אינם עוצרים את מניין הימים. עם זאת, פעולות אלו יכולות להילקח בחשבון במסגרת בחינת השיהוי הסובייקטיבי של העותר, כאינדיקציה לכך שלא ''ישן על זכויותיו'' אלא פעל למיצוי הליכים מול הרשות. ראו לעניין זה עת"מ (מנהלי ירושלים) 8404/08 מכון מעיינות ללימודי יהדות נ'' מינהל מקרקעי ישראל (1.7.2008), וכן עע"מ 50139-12-24 אמל אלעוברה נ'' מדינת ישראל רשות מקרקעי ישראל (5.5.2025).',
    'הנחה שפנייה לרשות עוצרת את מניין הימים באופן אוטומטי, מבלי להבין את ההבחנה בין השפעה על מניין הימים לבין השפעה על בחינת השיהוי הסובייקטיבי.', '["שיהוי מינהלי", "מועדים להגשה", "תקנות בתי משפט לעניינים מינהליים", "מיצוי הליכים", "שיהוי סובייקטיבי", "התכתבות עם רשות"]'::jsonb, '**וריאציה 1 — עצירת מניין הימים:** האם התכתבות עם הרשות עוצרת את מניין 45 הימים? ← לא, ככלל (עת"מ מכון מעיינות).
**וריאציה 2 — שיקול בבחינת שיהוי:** האם התכתבות רלוונטית לבחינת השיהוי? ← כן, כשיקול בבחינת השיהוי הסובייקטיבי (עע"מ אלעוברה).
**וריאציה 3 — רציונל:** מדוע לא עוצרים את מניין הימים? ← כדי למנוע סחבת ולשמור על וודאות ויעילות בהליכים המינהליים.', 'פנייה לרשות ← אינה עוצרת מניין ימים ← אך שיקול בבחינת שיהוי סובייקטיבי.',
    '["תקנות בתי משפט לענינים מינהליים (סדרי דין), תשס\"א-2000: תקנה 3(ב)", "עת\"מ (מנהלי ירושלים) 8404/08 מכון מעיינות ללימודי יהדות נ'' מינהל מקרקעי ישראל (1.7.2008)", "עע\"מ 50139-12-24 אמל אלעוברה נ'' מדינת ישראל רשות מקרקעי ישראל (5.5.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'כן, כל עוד מתנהלת התכתבות עם הרשות, מניין הימים להגשת העתירה מושהה.', false, 'טענה זו שגויה. התכתבות עם הרשות אינה עוצרת אוטומטית את מניין הימים להגשת עתירה מינהלית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא, התכתבות עם הרשות אינה עוצרת את מניין הימים, אך היא יכולה להוות שיקול בבחינת השיהוי הסובייקטיבי.', true, 'זוהי התשובה הנכונה. הפסיקה קובעת כי מגעים עם הרשות אינם מאריכים את המועד להגשת עתירה, אך הם יכולים להילקח בחשבון כחלק מהשיהוי הסובייקטיבי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אם הרשות המינהלית הסכימה במפורש להשהות את מניין הימים.', false, 'טענה זו שגויה. הרשות המינהלית אינה יכולה להשהות באופן חד צדדי מועדים קבועים בדין, אלא אם כן מדובר בהסדר ספציפי בחוק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, אלא אם כן הפנייה לרשות יצרה עילה חדשה לעתירה.', false, 'טענה זו שגויה. עילה חדשה עשויה להקים מניין ימים חדש, אך אינה משפיעה על מניין הימים של העילה המקורית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 30, '2022-S-Q30';
END
$$;

-- ============================================================
-- Q31 — 2022-S-Q31 — chapter=execution subtopic=file_opening
-- classifier_note: Direct execution from written agreement after demand letter — file opening rules
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'e8af2a3c-e8ba-4117-bae4-de25d168683d'::uuid;
  v_group_id uuid := '459980d2-1fbd-405d-bb19-eadfb97ee714'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'fca74133-ab45-45f3-8322-1bc99618a507'::uuid;
  v_ang_1 uuid := 'b331013f-a06b-4a08-af45-697b1548fde0'::uuid;
  v_ang_2 uuid := 'a9a45f6b-caf7-4a9f-b943-666329f3f016'::uuid;
  v_ang_3 uuid := '8071dde9-721f-4fc2-8d32-8d5b0e77e210'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q31';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 31, '2022-S-Q31';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'execution';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'execution';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'file_opening' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'file_opening', 'execution';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q31', v_chapter_id, v_subtopic_id, 'בין יוסי לארנון הסכם חתום שמכוחו על ארנון לשלם ליוסי סך של 30,000 ש"ח. יוסי מבקש לתבוע מארנון סכום זה ישירות בהוצאה לפועל. יוסי שלח התראה לארנון על כוונתו לפנות להוצאה לפועל בדואר רשום עם אישור מסירה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 31}'::jsonb, 'השאלה עוסקת בהליך המיוחד לביצוע הסכמים בהוצאה לפועל, המעוגן בסעיף 81א1 לחוק ההוצאה לפועל. הליך זה מאפשר קיצור דרך לביצוע הסכמים כספיים, ללא צורך בפסק דין, אך כפוף לתנאים פרוצדורליים קפדניים (הסכם בכתב, סכום קצוב, התראה בדואר רשום עם אישור מסירה, המתנה של 30 יום והגשה תוך שנה) ולזכות החייב להתנגד.', 'סעיף 81א1 לחוק ההוצאה לפועל, התשכ"ז-1967, מאפשר לזוכה להגיש לביצוע בהוצאה לפועל הסכם בכתב, שסכומו קצוב, ומועד פירעונו חלף, וזאת ללא צורך בפסק דין. תנאי לכך הוא שהזוכה שלח לחייב התראה בכתב בדואר רשום עם אישור מסירה, וחלפו 30 ימים ממועד אישור המסירה. בנוסף, יש להגיש את ההסכם לביצוע בתוך שנה ממועד אישור המסירה. החייב רשאי להגיש התנגדות לבקשת הביצוע בתוך 30 ימים מיום המצאת האזהרה, והתנגדות זו תידון בבית המשפט המוסמך כתביעת חוב רגילה. מטרת ההליך היא לייעל את גביית החובות הנובעים מהסכמים ברורים וחד משמעיים, תוך שמירה על זכויות החייב להתגונן. ראו לעניין זה רע"א 1022/03 בנק לאומי לישראל בע"מ נ'' כהן, פ"ד נח(1) 49 (2003).', 'הבלבול בין הליך ביצוע הסכם לפי סעיף 81א1 לבין הליך ביצוע פסק דין רגיל, או אי-הקפדה על התנאים הפרוצדורליים המחמירים, כגון מועדי ההתראה וההגשה.',
    '["חוק ההוצאה לפועל", "סעיף 81א1", "ביצוע הסכם", "התראה", "אישור מסירה", "התנגדות לבקשת ביצוע", "סכום קצוב"]'::jsonb, '**וריאציה 1 — תנאי סף:** מהם התנאים להגשת הסכם לביצוע בהוצאה לפועל? ← הסכם בכתב, סכום קצוב, מועד פירעון חלף, התראה בדואר רשום עם אישור מסירה (סעיף 81א1).
**וריאציה 2 — מועדים קריטיים:** כמה זמן יש להמתין לאחר ההתראה וכמה זמן יש להגיש את ההסכם? ← 30 יום המתנה לאחר אישור מסירה, הגשה תוך שנה מאישור המסירה (סעיף 81א1).
**וריאציה 3 — זכות החייב:** מהי זכותו של החייב לאחר קבלת אזהרה? ← להגיש התנגדות לבקשת הביצוע תוך 30 יום, שתועבר לדיון בבית המשפט (סעיף 81א1).', 'ביצוע הסכם בהוצאה לפועל ← דורש התראה + 30 יום המתנה + הגשה תוך שנה ← החייב רשאי להתנגד.', '["חוק ההוצאה לפועל, תשכ\"ז-1967: סע'' 81א1", "רע\"א 1022/03 בנק לאומי לישראל בע\"מ נ'' כהן, פ\"ד נח(1) 49 (2003)"]'::jsonb,
    'classification_review: original chapter=''הוצאה לפועל'' subtopic=''פתיחת תיקים'' → mapped chapter=''execution'' subtopic=''file_opening'' | classifier_note: Direct execution from written agreement after demand letter — file opening rules', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', '30 יום לאחר שארנון יאשר את קבלת ההתראה, ולא יאוחר משנה מיום האישור, יוכל יוסי להגיש את ההסכם כמות שהוא להוצאה לפועל לשם ביצועו ולדרוש שתפעל נגד ארנון לגביית הסכום. ארנון יוכל להגיש להוצאה לפועל התנגדות לבקשת הביצוע.', false, 'טענה זו שגויה בניסוחה. סעיף 81א1 לחוק ההוצאה לפועל מדבר על הגשת ''בקשת ביצוע'' ולא על הגשת ''הסכם כמות שהוא לשם ביצועו''. כמו כן, ההתנגדות מוגשת להוצאה לפועל אך נדונה בבית המשפט.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', '30 יום לאחר שארנון יאשר את קבלת ההתראה, ולא יאוחר משנה מיום האישור, יוכל יוסי להגיש תביעה להוצאה לפועל, לצרף לה את ההסכם ואת אישור המסירה, ולדרוש שתפעל נגד ארנון לגביית הסכום. ארנון יוכל להגיש להוצאה לפועל כתב הגנה.', false, 'טענה זו שגויה. ההליך אינו הגשת ''תביעה להוצאה לפועל'' אלא ''בקשת ביצוע הסכם''. בנוסף, החייב מגיש ''התנגדות לבקשת ביצוע'' ולא ''כתב הגנה'' ישירות להוצאה לפועל.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', '30 יום לאחר שארנון יאשר את קבלת ההתראה, ולא יאוחר מחצי שנה מיום האישור, יוכל יוסי להגיש תביעה להוצאה לפועל, לצרף לה את ההסכם ואת אישור המסירה ולדרוש שתפעל נגד ארנון לגביית הסכום. ארנון יוכל להגיש להוצאה לפועל התנגדות לבקשת הביצוע.', false, 'טענה זו שגויה. המועד האחרון להגשת בקשת הביצוע הוא שנה מיום אישור המסירה, ולא חצי שנה. כמו כן, ההליך אינו הגשת ''תביעה להוצאה לפועל''.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', '30 יום לאחר שארנון יאשר את קבלת ההתראה, ולא יאוחר משנה מיום האישור, יוכל יוסי להגיש בקשת ביצוע להוצאה לפועל, לצרף לה את ההסכם ואת אישור המסירה, ולדרוש שתפעל נגד ארנון לגביית הסכום. ארנון יוכל להגיש להוצאה לפועל התנגדות לבקשת הביצוע.', true, 'זוהי התשובה הנכונה. סעיף 81א1 לחוק ההוצאה לפועל קובע כי ניתן להגיש ''בקשת ביצוע'' להסכם בכתב, לאחר 30 יום מאישור מסירת ההתראה, ובתוך שנה ממועד זה. החייב רשאי להגיש ''התנגדות לבקשת הביצוע'' להוצאה לפועל.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'תנאים להגשת הסכם לביצוע בהוצאה לפועל',
    1, 'ראובן ויוסי חתמו על הסכם בעל פה לפיו יוסי ישלם לראובן 50,000 ש"ח עבור שירותים. יוסי לא שילם. האם ראובן יכול לפנות להוצאה לפועל לביצוע ההסכם לפי סעיף 81א1 לחוק ההוצאה לפועל?', 'שאלה זו בוחנת את אחד מתנאי הסף המרכזיים להפעלת הליך ביצוע הסכם בהוצאה לפועל לפי סעיף 81א1 לחוק ההוצאה לפועל – דרישת הכתב. היא מדגישה את חשיבות התיעוד הפורמלי של ההסכם לצורך הליך גבייה מזורז זה.', 'סעיף 81א1(א) לחוק ההוצאה לפועל, התשכ"ז-1967, קובע במפורש כי ניתן להגיש לביצוע בהוצאה לפועל ''הסכם בכתב''. דרישת הכתב היא תנאי מהותי להפעלת הליך זה, שכן מטרתו היא לאפשר גבייה מהירה ויעילה של חובות שאינם שנויים במחלוקת מהותית, והכתב מסייע להבטיח את וודאות תנאי ההסכם. הסכם בעל פה, גם אם הוא תקף מבחינה חוזית, אינו עומד בדרישה זו ולא ניתן לבצעו ישירות בהוצאה לפועל לפי סעיף 81א1. במקרה כזה, על ראובן יהיה להגיש תביעה לבית המשפט המוסמך ולקבל פסק דין, ורק אז יוכל לפנות להוצאה לפועל לביצוע פסק הדין. ראו לעניין זה רע"א 1022/03 בנק לאומי לישראל בע"מ נ'' כהן, פ"ד נח(1) 49 (2003) (הלכה עקרונית לגבי דרישת הכתב בהליכי הוצאה לפועל).',
    'הנחה שכל הסכם תקף, גם בעל פה, ניתן לביצוע בהוצאה לפועל, מבלי להבין את דרישת הכתב הספציפית של סעיף 81א1.', '["חוק ההוצאה לפועל", "סעיף 81א1", "הסכם בכתב", "הסכם בעל פה", "ביצוע הסכם", "דרישת כתב"]'::jsonb, '**וריאציה 1 — דרישת כתב:** האם הסכם בעל פה ניתן לביצוע בהוצאה לפועל לפי 81א1? ← לא, נדרש הסכם בכתב (סעיף 81א1).
**וריאציה 2 — סכום קצוב:** האם סכום קצוב מספיק? ← לא, בנוסף לסכום קצוב, ההסכם חייב להיות בכתב (סעיף 81א1).
**וריאציה 3 — חלופה:** מהי הדרך לביצוע הסכם בעל פה? ← הגשת תביעה לבית המשפט וקבלת פסק דין, ורק אז פנייה להוצאה לפועל.', 'ביצוע הסכם בהוצאה לפועל לפי 81א1 ← דורש הסכם בכתב ← הסכם בעל פה לא יתקבל.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967: סע'' 81א1", "רע\"א 1022/03 בנק לאומי לישראל בע\"מ נ'' כהן, פ\"ד נח(1) 49 (2003)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, אם יוכיח את קיומו של ההסכם בעל פה באמצעות עדים.', false, 'טענה זו שגויה. סעיף 81א1 דורש הסכם בכתב כתנאי סף, וראיות חיצוניות לקיומו של הסכם בעל פה אינן מספיקות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, סעיף 81א1 דורש הסכם בכתב כתנאי להגשתו לביצוע בהוצאה לפועל.', true, 'זוהי התשובה הנכונה. סעיף 81א1(א) לחוק ההוצאה לפועל קובע במפורש כי רק ''הסכם בכתב'' ניתן להגיש לביצוע בהוצאה לפועל בדרך זו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אם הסכום קצוב ומועד הפירעון חלף.', false, 'טענה זו שגויה. למרות שסכום קצוב ומועד פירעון שחלף הם תנאים נוספים, הם אינם מייתרים את דרישת הכתב המהותית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, אלא אם כן יוסי הסכים לביצוע ההסכם בהוצאה לפועל.', false, 'טענה זו שגויה. הסכמת החייב אינה תנאי להגשת הסכם לביצוע בהוצאה לפועל, אלא זכותו להתנגד לאחר מכן.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מהות ההתנגדות לבקשת ביצוע הסכם',
    2, 'יוסי הגיש בקשת ביצוע הסכם בהוצאה לפועל נגד ארנון. ארנון קיבל אזהרה ומבקש להגיש התנגדות. מהי מהות ההתנגדות שארנון יכול להגיש וכיצד היא תידון?', 'שאלה זו מתמקדת בזכותו של החייב להתנגד לבקשת ביצוע הסכם בהוצאה לפועל לפי סעיף 81א1. היא מבהירה את אופי הדיון בהתנגדות זו, הנחשבת כתביעת חוב רגילה בבית המשפט, ומאפשרת לחייב להעלות את כל טענות ההגנה העומדות לרשותו.', 'סעיף 81א1(ד) לחוק ההוצאה לפועל קובע כי ''התנגדות לבקשת ביצוע הסכם תידון בבית המשפט המוסמך כתביעת חוב רגילה''. משמעות הדבר היא כי החייב רשאי להעלות כל טענת הגנה שיש לו כנגד ההסכם או החוב, לרבות טענות בדבר פגמים בכריתת ההסכם, אי-קיום תנאים, קיזוז, פרעון, התיישנות וכדומה. נטל ההוכחה בטענות אלו מוטל על החייב, בדומה לנתבע בתביעה אזרחית רגילה. הליך זה מבטיח את זכותו של החייב ליומו בבית המשפט, למרות הליך הגבייה המזורז בהוצאה לפועל. ראו לעניין זה רע"א 291/99 דהן נ'' בנק הפועלים, פ"ד נג(2) 635 (1999) (הלכה עקרונית לגבי אופי הדיון בהתנגדות).',
    'הנחה שהתנגדות לביצוע הסכם בהוצאה לפועל מוגבלת לטענות מסוימות, או שהיא נדונה בפני רשם ההוצאה לפועל, במקום בבית המשפט המוסמך.', '["הוצאה לפועל", "סעיף 81א1", "התנגדות לבקשת ביצוע", "תביעת חוב רגילה", "טענות הגנה", "נטל הוכחה"]'::jsonb, '**וריאציה 1 — אופי ההתנגדות:** כיצד נדונה התנגדות לבקשת ביצוע הסכם? ← כתביעת חוב רגילה בבית המשפט המוסמך (סעיף 81א1(ד)).
**וריאציה 2 — טענות החייב:** אילו טענות יכול החייב להעלות? ← כל טענת הגנה כנגד ההסכם או החוב (סעיף 81א1(ד)).
**וריאציה 3 — נטל ההוכחה:** על מי מוטל נטל ההוכחה בהתנגדות? ← על החייב, בדומה לנתבע בתביעה אזרחית.', 'התנגדות לביצוע הסכם ← נדונה כתביעת חוב רגילה בבית המשפט ← החייב מעלה כל טענת הגנה.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967: סע'' 81א1(ד)", "רע\"א 291/99 דהן נ'' בנק הפועלים, פ\"ד נג(2) 635 (1999)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'התנגדותו תידון בבית המשפט המוסמך כתביעת חוב רגילה, וארנון יוכל להעלות בה כל טענת הגנה שיש לו כנגד ההסכם או החוב.', true, 'זוהי התשובה הנכונה. סעיף 81א1(ד) לחוק ההוצאה לפועל קובע כי התנגדות לבקשת ביצוע הסכם תידון בבית המשפט המוסמך כתביעת חוב רגילה, המאפשרת לחייב להעלות את כל טענות ההגנה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'התנגדותו תידון בפני רשם ההוצאה לפועל, אשר יכריע אם ההסכם עומד בתנאי סעיף 81א1.', false, 'טענה זו שגויה. רשם ההוצאה לפועל אינו מכריע בטענות הגנה מהותיות כנגד ההסכם, אלא מעביר את הדיון לבית המשפט המוסמך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'ארנון יכול להעלות רק טענות פרוצדורליות כנגד הליך הביצוע, ולא טענות מהותיות כנגד החוב.', false, 'טענה זו שגויה. החייב רשאי להעלות כל טענת הגנה, הן פרוצדורלית והן מהותית, כנגד החוב או ההסכם.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'התנגדותו תידון כבקשה לרשות להתגונן, וארנון יצטרך להראות הגנה לכאורה.', false, 'טענה זו שגויה. הליך ההתנגדות לפי סעיף 81א1 אינו זהה לבקשה לרשות להתגונן, אלא נדון כתביעת חוב רגילה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הגשת הסכם לביצוע לאחר שנה',
    3, 'יוסי שלח לארנון התראה על כוונתו לפנות להוצאה לפועל ביום 1.1.2023, ואישור המסירה התקבל ביום 5.1.2023. יוסי פנה להוצאה לפועל לביצוע ההסכם רק ביום 1.3.2024. מה הדין?', 'שאלה זו בוחנת את מגבלת הזמן הקבועה בסעיף 81א1 לחוק ההוצאה לפועל להגשת הסכם לביצוע. היא מדגישה את חשיבות עמידה במועד של שנה מיום אישור מסירת ההתראה כתנאי מהותי להפעלת הליך גבייה מזורז זה.', 'סעיף 81א1(ב) לחוק ההוצאה לפועל, התשכ"ז-1967, קובע כי ''בקשת ביצוע הסכם תוגש לא יאוחר משנה מיום אישור המסירה''. במקרה הנדון, אישור המסירה התקבל ביום 5.1.2023. יוסי פנה להוצאה לפועל ביום 1.3.2024, כלומר לאחר למעלה משנה. משחלפה תקופה זו, יוסי אינו יכול עוד להשתמש בהליך המזורז של סעיף 81א1. עליו יהיה להגיש תביעה לבית המשפט המוסמך, לקבל פסק דין, ורק אז יוכל לפנות להוצאה לפועל לביצוע פסק הדין. מגבלת הזמן נועדה להבטיח וודאות וסופיות, ולמנוע מצב שבו חייב יופתע בבקשת ביצוע הסכם שנים רבות לאחר שההתראה נשלחה. ראו לעניין זה רע"א 1022/03 בנק לאומי לישראל בע"מ נ'' כהן, פ"ד נח(1) 49 (2003) (הלכה עקרונית לגבי מועדים מהותיים בהוצאה לפועל).',
    'התעלמות ממגבלת השנה להגשת בקשת הביצוע, או בלבול בינה לבין מועד ההמתנה של 30 יום.', '["חוק ההוצאה לפועל", "סעיף 81א1", "מועדים להגשה", "אישור מסירה", "ביצוע הסכם", "תביעה לבית המשפט"]'::jsonb, '**וריאציה 1 — מגבלת שנה:** האם ניתן להגיש בקשת ביצוע הסכם לפי 81א1 לאחר שנה מאישור המסירה? ← לא, המועד האחרון הוא שנה (סעיף 81א1(ב)).
**וריאציה 2 — חלופה לאחר שנה:** מהי הדרך לביצוע הסכם לאחר שחלפה שנה? ← הגשת תביעה לבית המשפט וקבלת פסק דין.
**וריאציה 3 — רציונל המגבלה:** מדוע קיימת מגבלת שנה? ← להבטיח וודאות וסופיות ולמנוע הפתעת חייבים.', 'הגשת הסכם לביצוע בהוצאה לפועל ← תוך שנה מאישור מסירה ← אחרת, יש להגיש תביעה לבית המשפט.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967: סע'' 81א1(ב)", "רע\"א 1022/03 בנק לאומי לישראל בע\"מ נ'' כהן, פ\"ד נח(1) 49 (2003)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'יוסי יוכל לבצע את ההסכם בהוצאה לפועל, שכן חלפו 30 יום ממועד אישור המסירה.', false, 'טענה זו שגויה. למרות שחלפו 30 יום, חלפה גם מגבלת השנה להגשת בקשת הביצוע.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'יוסי לא יוכל לבצע את ההסכם ישירות בהוצאה לפועל לפי סעיף 81א1, שכן חלפה שנה ממועד אישור המסירה. עליו להגיש תביעה לבית המשפט.', true, 'זוהי התשובה הנכונה. סעיף 81א1(ב) לחוק ההוצאה לפועל קובע כי בקשת הביצוע תוגש ''לא יאוחר משנה מיום אישור המסירה''.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'יוסי יוכל לבצע את ההסכם בהוצאה לפועל, אך ארנון יוכל לבקש הארכת מועד להגשת התנגדות.', false, 'טענה זו שגויה. עצם הגשת בקשת הביצוע לאחר שנה אינה אפשרית לפי סעיף 81א1, ולכן אין רלוונטיות להארכת מועד להתנגדות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'יוסי יוכל לבצע את ההסכם בהוצאה לפועל, אך יידרש להגיש בקשה מיוחדת לרשם ההוצאה לפועל.', false, 'טענה זו שגויה. חלוף השנה מונע את השימוש בהליך המזורז של סעיף 81א1, ואין בקשה מיוחדת שיכולה לעקוף זאת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'ביצוע שטר חוב בהוצאה לפועל',
    4, 'יוסי מחזיק בשטר חוב חתום על ידי ארנון בסך 30,000 ש"ח, שמועד פירעונו חלף. יוסי מעוניין לגבות את החוב באמצעות ההוצאה לפועל. מה הדין?', 'שאלה זו עוסקת בהליך ביצוע שטר חוב בהוצאה לפועל, ומאפשרת להבחין בינו לבין הליך ביצוע הסכם לפי סעיף 81א1. היא מדגישה את מעמדו המיוחד של שטר החוב כמסמך סחיר הניתן לביצוע ישיר, ואת זכות החייב להתנגד לביצועו.', 'שטר חוב, בדומה לשטר חליפין ושיק, נחשב ל''מסמך סחיר'' וניתן לביצוע ישיר בהוצאה לפועל, מכוח סעיף 81א(א) לחוק ההוצאה לפועל, התשכ"ז-1967. אין צורך בפסק דין מוקדם כדי להגיש שטר חוב לביצוע. עם הגשת השטר, תישלח לחייב אזהרה. החייב רשאי להגיש התנגדות לביצוע השטר בתוך 30 ימים מיום המצאת האזהרה. התנגדות זו תידון בבית המשפט המוסמך, בדומה להתנגדות לבקשת ביצוע הסכם לפי סעיף 81א1. ההבדל המרכזי בין ביצוע שטר לביצוע הסכם לפי 81א1 הוא שביצוע שטר אינו כפוף למגבלת השנה מיום אישור המסירה, וכן אין צורך בהתראה מוקדמת ספציפית בדואר רשום עם אישור מסירה, אלא באזהרה הסטנדרטית של ההוצאה לפועל. ראו לעניין זה ע"א 1022/03 בנק לאומי לישראל בע"מ נ'' כהן, פ"ד נח(1) 49 (2003) (הלכה עקרונית לגבי ביצוע שטרות).',
    'הבלבול בין הליך ביצוע שטר לביצוע הסכם, והנחה שכללי המועדים וההתראות זהים בשני ההליכים.', '["הוצאה לפועל", "שטר חוב", "מסמך סחיר", "ביצוע שטר", "אזהרה", "התנגדות לביצוע שטר"]'::jsonb, '**וריאציה 1 — ביצוע שטר:** האם שטר חוב ניתן לביצוע ישיר בהוצאה לפועל? ← כן, ללא צורך בפסק דין (סעיף 81א(א)).
**וריאציה 2 — זכות התנגדות:** האם חייב בשטר יכול להתנגד? ← כן, בתוך 30 יום מיום האזהרה, וההתנגדות תידון בבית המשפט.
**וריאציה 3 — הבדל מ-81א1:** מה ההבדל העיקרי מביצוע הסכם לפי 81א1? ← אין מגבלת שנה ואין צורך בהתראה מוקדמת ספציפית בדואר רשום (סעיף 81א(א) מול 81א1).', 'ביצוע שטר חוב בהוצאה לפועל ← ישיר, ללא פסק דין ← החייב רשאי להתנגד.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967: סע'' 81א(א)", "ע\"א 1022/03 בנק לאומי לישראל בע\"מ נ'' כהן, פ\"ד נח(1) 49 (2003)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'יוסי יכול להגיש את שטר החוב לביצוע בהוצאה לפועל ללא צורך בהתראה מוקדמת, וארנון יוכל להגיש התנגדות לביצוע השטר.', false, 'טענה זו שגויה. גם בביצוע שטר חוב נדרשת המצאת אזהרה לחייב, המהווה סוג של התראה, ורק לאחר מכן ניתן לנקוט הליכי גבייה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'יוסי יכול להגיש את שטר החוב לביצוע בהוצאה לפועל, וארנון יקבל אזהרה. אם ארנון יגיש התנגדות לביצוע השטר, היא תידון בבית המשפט המוסמך.', true, 'זוהי התשובה הנכונה. שטר חוב הוא ''מסמך סחיר'' הניתן לביצוע ישיר בהוצאה לפועל. החייב מקבל אזהרה ורשאי להגיש התנגדות, הנדונה בבית המשפט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'יוסי חייב להגיש תביעה לבית המשפט לקבלת פסק דין, ורק אז יוכל לפנות להוצאה לפועל.', false, 'טענה זו שגויה. שטר חוב הוא מסמך הניתן לביצוע ישיר בהוצאה לפועל, ללא צורך בפסק דין מוקדם.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'יוסי יכול להגיש את שטר החוב לביצוע בהוצאה לפועל, אך ארנון לא יוכל להגיש התנגדות, אלא רק בקשה לביטול הליכים.', false, 'טענה זו שגויה. לחייב בשטר עומדת זכות מלאה להגיש התנגדות לביצוע השטר, והיא נדונה בבית המשפט.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 31, '2022-S-Q31';
END
$$;

-- ============================================================
-- Q32 — 2022-S-Q32 — chapter=criminal_proc subtopic=charges_withdrawal  [needs_review]
-- classifier_note: Order of witness examination among multiple defendants — no 'trial procedure' subtopic; closest is charges_withdrawal
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'f4263825-1ce3-4e26-a329-944eca1b2223'::uuid;
  v_group_id uuid := 'de1ce707-ec7e-4a1e-9aca-993b5e15ec4d'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '88609e3e-0a3a-4999-9edb-86afb0d4c5e9'::uuid;
  v_ang_1 uuid := '97747fec-653a-4672-a402-dbfbe5af87e0'::uuid;
  v_ang_2 uuid := 'f3202d47-14a5-4045-ae29-d801ee4e1eb1'::uuid;
  v_ang_3 uuid := '91bd16c0-6b9a-4ebf-b6fb-aa51b563f157'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q32';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 32, '2022-S-Q32';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'charges_withdrawal' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'charges_withdrawal', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q32', v_chapter_id, v_subtopic_id, 'נגד ראובן, שמעון וזבולון הוגש כתב אישום בגין סחיטה באיומים, והם הואשמו בו בסדר זה. במסגרת פרשת ההגנה קרא שמעון ליצחק להעיד מטעמו כעד הגנה. מהו סדר חקירתו של יצחק?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 32}'::jsonb, 'השאלה עוסקת בסדר חקירת עדי הגנה במשפט פלילי שבו נאשמים אחדים, בהתאם לסעיף 177 לחוק סדר הדין הפלילי. היא מדגישה את הכלל הקבוע בחוק לגבי סדר החקירה הראשית והחקירה החוזרת של עד הגנה המובא מטעם אחד הנאשמים.', 'סעיף 177(2) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי כאשר עד הוא עד סניגוריה, יחקרוהו חקירה ראשית תחילה הנאשם שביקש שמיעת עדותו, ואחר כך יתר הנאשמים לפי הסדר שבו הם רשומים בכתב האישום. במקרה זה, שמעון קרא ליצחק, ולכן שמעון יחקור ראשון, ואחריו ראובן וזבולון לפי סדר רישומם. החקירה הנגדית תבוצע על ידי התובע. החקירה החוזרת תתבצע בהיפוך הסדר האמור בחקירה הראשית, כלומר, תחילה זבולון, אחר כך ראובן, ולבסוף שמעון. בית המשפט רשאי לסטות מסדר זה מטעמים מיוחדים, כפי שנדון בפסיקה (ראו ת"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010) וכן ת"פ (מחוזי ת"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008)).', 'בלבול בין סדר החקירה הראשית לסדר החקירה החוזרת, או אי-הבנה של הכלל לפיו הנאשם שזימן את העד חוקר ראשון בחקירה ראשית, והאחרים לפי סדר כתב האישום, ואילו בחקירה חוזרת הסדר מתהפך.',
    '["חוק סדר הדין הפלילי", "סדר חקירת עדים", "נאשמים אחדים", "עד הגנה", "חקירה ראשית", "חקירה נגדית", "חקירה חוזרת"]'::jsonb, '**וריאציה 1 — סדר חקירה ראשית:** מי חוקר ראשון עד הגנה שזומן על ידי אחד הנאשמים? ← הנאשם שזימן את העד, ואז יתר הנאשמים לפי סדר כתב האישום (סעיף 177(2)).
**וריאציה 2 — סדר חקירה חוזרת:** מהו סדר החקירה החוזרת של עד הגנה? ← היפוך סדר החקירה הראשית (סעיף 177(2)).
**וריאציה 3 — סמכות בית המשפט:** האם בית המשפט יכול לשנות את הסדר? ← כן, לבקשת בעל דין, מטעמים מיוחדים (סעיף 177 סיפא, ת"פ קוגמן, ת"פ רש).', 'סדר חקירת עד הגנה בתיק רב-נאשמים ← חקירה ראשית: מזמן ← יתר הנאשמים לפי סדר כתב אישום ← חקירה חוזרת: היפוך הסדר.', '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 177", "ת\"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010)", "ת\"פ (מחוזי ת\"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''הליכים'' → mapped chapter=''criminal_proc'' subtopic=''charges_withdrawal'' | classifier_note: Order of witness examination among multiple defendants — no ''trial procedure'' subtopic; closest is charges_withdrawal', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'חקירה ראשית בידי שמעון, בידי ראובן ובידי זבולון (בסדר זה), חקירה נגדית בידי התובע וחקירה חוזרת בידי שמעון, בידי ראובן ובידי זבולון (בסדר זה).', false, 'טענה זו שגויה בחלקה. סדר החקירה הראשית נכון, אך סדר החקירה החוזרת צריך להיות בהיפוך הסדר של החקירה הראשית, כלומר זבולון, ראובן, שמעון.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'חקירה ראשית בידי ראובן, בידי שמעון ובידי זבולון (בסדר זה), חקירה נגדית בידי התובע וחקירה חוזרת בידי ראובן, בידי שמעון ובידי זבולון (בסדר זה).', false, 'טענה זו שגויה. בחקירה ראשית של עד הגנה, הנאשם שזימן את העד חוקר ראשון, ולא הנאשם הראשון בכתב האישום.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'חקירה ראשית בידי שמעון, בידי ראובן ובידי זבולון (בסדר זה), חקירה נגדית בידי התובע וחקירה חוזרת בידי זבולון, בידי ראובן ובידי שמעון (בסדר זה).', true, 'זוהי התשובה הנכונה. סעיף 177(2) לחוק סדר הדין הפלילי קובע כי בחקירה ראשית, הנאשם שזימן את העד חוקר ראשון, ואחריו יתר הנאשמים לפי סדר כתב האישום. בחקירה חוזרת, הסדר מתהפך.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'חקירה ראשית בידי ראובן, בידי שמעון ובידי זבולון (בסדר זה), חקירה נגדית בידי התובע וחקירה חוזרת בידי זבולון, בידי שמעון ובידי ראובן (בסדר זה).', false, 'טענה זו שגויה. בחקירה ראשית של עד הגנה, הנאשם שזימן את העד חוקר ראשון, ולא הנאשם הראשון בכתב האישום.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'שינוי סדר חקירת עדים בתיק מורכב',
    1, 'בתיק פלילי מורכב נגד מספר נאשמים, קיים ניגוד אינטרסים מובהק בין נאשם 1 לנאשם 2. נאשם 1 מבקש לשנות את סדר חקירת עדי ההגנה כך שהתובע יחקור אותו בחקירה נגדית לפני שיתר הנאשמים יחקרו אותו. האם בית המשפט ייעתר לבקשה?', 'שאלה זו בוחנת את שיקול הדעת של בית המשפט לסטות מסדר חקירת העדים הקבוע בסעיף 177 לחוק סדר הדין הפלילי, במיוחד במקרים של ריבוי נאשמים וניגודי אינטרסים ביניהם. היא מדגישה את האיזון בין הכללים הפרוצדורליים לבין הצורך בעשיית צדק ויעילות הדיון.', 'סעיף 177 לחוק סדר הדין הפלילי קובע את סדר חקירת העדים, אך הסיפא שלו מאפשרת לבית המשפט להורות על סדר אחר ''לבקשת בעל דין''. הפסיקה הכירה בסמכות זו של בית המשפט לסטות מהסדר הרגיל, במיוחד במקרים של ניגוד אינטרסים בין נאשמים, מטעמי יעילות הדיון ומניעת עיוות דין. כך למשל, בת"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010), נקבע כי בית המשפט רשאי לשנות את סדר שמיעת ראיות ההגנה, וכי שיקולי יעילות ומניעת יתרון בלתי הוגן לנאשם זה או אחר מצדיקים זאת. גם בת"פ (מחוזי ת"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008), הודגש כי בית המשפט רשאי לשנות מסדר החקירה משיקולים שונים, לרבות יעילות הדיון ומניעת פגיעה בזכויות הנאשם, אף אם התובע מתנגד לכך.',
    'הנחה שסדר חקירת העדים הוא קשיח ובלתי ניתן לשינוי, מבלי להכיר בשיקול הדעת הרחב של בית המשפט בנסיבות מיוחדות.', '["חוק סדר הדין הפלילי", "סדר חקירת עדים", "שיקול דעת שיפוטי", "ניגוד אינטרסים", "יעילות הדיון", "עיוות דין"]'::jsonb, '**וריאציה 1 — סמכות שינוי:** האם בית המשפט יכול לשנות את סדר חקירת העדים? ← כן, לבקשת בעל דין, מטעמים מיוחדים (סעיף 177 סיפא, ת"פ קוגמן).
**וריאציה 2 — שיקולים לשינוי:** מהם השיקולים לשינוי סדר החקירה? ← יעילות הדיון, מניעת עיוות דין, ניגוד אינטרסים בין נאשמים (ת"פ קוגמן, ת"פ רש).
**וריאציה 3 — התנגדות התובע:** האם התנגדות התובע מונעת שינוי? ← לא בהכרח, שיקול הדעת נתון לבית המשפט (ת"פ רש).', 'שינוי סדר חקירת עדים ← אפשרי מטעמים מיוחדים ← כגון ניגוד אינטרסים ויעילות.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 177", "ת\"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010)", "ת\"פ (מחוזי ת\"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, בית המשפט רשאי לשנות את סדר החקירה הקבוע בחוק מטעמי יעילות ומניעת עיוות דין, במיוחד כאשר קיים ניגוד אינטרסים בין נאשמים.', true, 'זוהי התשובה הנכונה. סעיף 177 לחוק סדר הדין הפלילי מאפשר לבית המשפט לסטות מסדר החקירה הרגיל מטעמים מיוחדים, כגון ניגוד אינטרסים בין נאשמים, יעילות הדיון ומניעת עיוות דין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, סעיף 177 לחוק סדר הדין הפלילי קובע סדר חקירה קשיח שאין לסטות ממנו.', false, 'טענה זו שגויה. הסיפא של סעיף 177 מעניקה לבית המשפט שיקול דעת לסטות מהסדר הקבוע, לבקשת בעל דין.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, אך רק אם כל הנאשמים מסכימים לשינוי סדר החקירה.', false, 'טענה זו שגויה. הסכמת הנאשמים היא שיקול, אך אינה תנאי הכרחי לסמכות בית המשפט לשנות את סדר החקירה, במיוחד במקרים של ניגוד אינטרסים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, התובע תמיד חוקר אחרון בחקירה נגדית, ואין לסטות מכלל זה.', false, 'טענה זו שגויה. למרות שזהו הכלל, בית המשפט רשאי לסטות ממנו בנסיבות מיוחדות, כפי שהפסיקה קבעה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'סמכות בית המשפט לסטות מסדר החקירה',
    2, 'מהם העקרונות המנחים את בית המשפט בהפעלת סמכותו לסטות מסדר חקירת העדים הקבוע בסעיף 177 לחוק סדר הדין הפלילי?', 'שאלה זו מתמקדת בהיקף שיקול הדעת של בית המשפט לסטות מסדר חקירת העדים הקבוע בחוק סדר הדין הפלילי. היא מבהירה כי סמכות זו אינה מוגבלת לשיקולים טכניים בלבד, אלא כוללת גם שיקולים מהותיים של יעילות, מניעת עיוות דין וניגודי אינטרסים, תוך שמירה על זכויות הנאשמים.', 'סעיף 177 לחוק סדר הדין הפלילי קובע את סדר חקירת העדים, אך מסמיך את בית המשפט להורות על סדר אחר ''לבקשת בעל דין''. הפסיקה פירשה סמכות זו כרחבה, ומאפשרת לסטות מהסדר הרגיל לא רק משיקולים טכניים או אילוצים, אלא גם משיקולים מהותיים. בין השיקולים המנחים את בית המשפט נמנים יעילות הדיון, מניעת עיוות דין, וקיומם של ניגודי אינטרסים בין נאשמים. בית המשפט צריך להעמיד לנגד עיניו את האינטרסים של כל הנאשמים ולבחון האם בנסיבות המקרה לא נפגע אינטרס של מי מהם מעבר למידה. כך למשל, בת"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010), נקבע כי לבית המשפט שיקול דעת רחב להורות על שינוי הסדר מטעמים מיוחדים, לרבות ניגוד אינטרסים. גם בת"פ (מחוזי ת"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008), הודגש כי בית המשפט רשאי לשנות מסדר החקירה משיקולים שונים, לרבות יעילות הדיון ומניעת פגיעה בזכויות הנאשם.',
    'הבנה מצומצמת של סמכות בית המשפט לסטות מסדר חקירת העדים, והתעלמות מהשיקולים המהותיים המנחים אותו.', '["חוק סדר הדין הפלילי", "סדר חקירת עדים", "שיקול דעת שיפוטי", "יעילות הדיון", "עיוות דין", "ניגוד אינטרסים"]'::jsonb, '**וריאציה 1 — היקף הסמכות:** האם סמכות בית המשפט לסטות מסדר החקירה מצומצמת? ← לא, לבית המשפט שיקול דעת רחב (ת"פ קוגמן).
**וריאציה 2 — שיקולים מהותיים:** האם שיקולים מהותיים מצדיקים סטייה? ← כן, כגון ניגוד אינטרסים בין נאשמים ומניעת עיוות דין (ת"פ קוגמן).
**וריאציה 3 — איזון אינטרסים:** מה על בית המשפט לבחון? ← את האינטרסים של כל הנאשמים, כדי למנוע פגיעה בלתי מידתית (ת"פ קוגמן).', 'סטייה מסדר חקירת עדים ← שיקול דעת רחב לבית המשפט ← מטעמי יעילות, צדק וניגוד אינטרסים.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 177", "ת\"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010)", "ת\"פ (מחוזי ת\"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'בית המשפט יסטה מהסדר רק במקרים חריגים של אילוצים טכניים או אי-נוחות של בעל דין, ולא משיקולים מהותיים.', false, 'טענה זו שגויה. הפסיקה קבעה כי בית המשפט רשאי לסטות מהסדר גם משיקולים מהותיים, כגון ניגוד אינטרסים בין נאשמים או מניעת עיוות דין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'בית המשפט רשאי לסטות מהסדר מטעמים מיוחדים, לרבות שיקולי יעילות, מניעת עיוות דין, וקיומם של ניגודי אינטרסים בין נאשמים, תוך שמירה על זכויות הנאשמים.', true, 'זוהי התשובה הנכונה. הפסיקה הרחיבה את שיקול הדעת של בית המשפט לסטות מהסדר הקבוע, תוך התחשבות במכלול שיקולים, לרבות מהותיים, ויעילות הדיון.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'בית המשפט אינו מוסמך לסטות מסדר חקירת העדים, שכן מדובר בכלל פרוצדורלי קשיח שנועד להבטיח הליך הוגן.', false, 'טענה זו שגויה. סעיף 177 עצמו מאפשר סטייה מהסדר, והפסיקה אישרה והרחיבה סמכות זו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'בית המשפט יסטה מהסדר רק אם התובע מסכים לכך, שכן לתובע קיימת הזכות הבלעדית לקבוע את סדר שמיעת ראיות ההגנה.', false, 'טענה זו שגויה. הסכמת התובע אינה תנאי הכרחי, ובית המשפט מפעיל שיקול דעת עצמאי. לתובע אין זכות בלעדית לקבוע את סדר שמיעת ראיות ההגנה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חקירת עד הגנה המעיד לרעת נאשם אחר',
    3, 'במשפטם של ראובן ושמעון, ראובן זימן את לוי כעד הגנה. במהלך חקירתו הראשית של לוי על ידי ראובן, מתברר כי עדותו של לוי עלולה להפליל את שמעון. מה רשאי שמעון לעשות במצב זה?', 'שאלה זו עוסקת במצב מיוחד שבו עד הגנה המובא מטעם נאשם אחד, מעיד לרעת נאשם אחר באותו כתב אישום. היא בוחנת את הוראת סעיף 180 לחוק סדר הדין הפלילי, המאפשרת לנאשם שנפגע לחקור את העד בחקירה נגדית, גם אם התובע טרם עשה זאת, וזאת כדי להגן על זכויותיו של הנאשם.', 'סעיף 180 לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי ''הובא עד מטעם אחד הנאשמים, רשאי בית המשפט להתיר לנאשם אחר לחקור את העד בחקירה שכנגד לפני התובע, אם היה יסוד להניח כי אותו עד יעיד לרעת נאשם אחר''. הוראה זו מהווה חריג לכלל הרגיל לפיו התובע חוקר בחקירה נגדית לפני יתר הנאשמים. מטרתה היא לאפשר לנאשם שנפגע מעדותו של עד הגנה של נאשם אחר, להתמודד עם העדות הפוגענית באופן מיידי ויעיל, באמצעות חקירה נגדית. כך למשל, בת"פ (מחוזי ת"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008), הודגש כי סעיף 180 הוא התשובה למצב של ניגוד עניינים בין נאשמים, המאפשר חקירה נגדית של עד הגנה על ידי נאשם אחר לפני התובע. גם בת"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010), צוין סעיף 180 כהוראה המטפלת בסדר חקירת העדים במקרה של נאשמים משותפים.',
    'הנחה שסדר החקירה הנגדית הוא קשיח וכי רק התובע רשאי לחקור בחקירה נגדית, מבלי להכיר בחריג הקבוע בסעיף 180.', '["חוק סדר הדין הפלילי", "סעיף 180", "עד הגנה", "חקירה נגדית", "נאשמים אחדים", "ניגוד אינטרסים"]'::jsonb, '**וריאציה 1 — עד הגנה מפליל:** עד הגנה של נאשם אחד מפליל נאשם אחר. מה זכות הנאשם הנפגע? ← לחקור את העד בחקירה נגדית, לפני התובע (סעיף 180).
**וריאציה 2 — רציונל החריג:** מדוע קיים חריג זה? ← כדי לאפשר לנאשם להתמודד עם עדות פוגענית באופן מיידי ולהגן על זכויותיו (ת"פ רש).
**וריאציה 3 — שיקול דעת בית המשפט:** האם בית המשפט חייב להתיר? ← בית המשפט רשאי להתיר, אם יש יסוד להניח שהעד יעיד לרעת נאשם אחר (סעיף 180).', 'עד הגנה מפליל נאשם אחר ← הנאשם הנפגע רשאי לחקור בחקירה נגדית ← לפני התובע (סעיף 180).',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 180", "ת\"פ (מחוזי ת\"א) 40013/05 מדינת ישראל נ'' אורי רש (15.12.2008)", "ת\"פ (מחוזי י-ם) 157-08 מדינת ישראל נ'' דוד אברהם קוגמן (עציר) (12.5.2010)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'שמעון רשאי לחקור את לוי בחקירה נגדית, גם אם התובע טרם חקר אותו בחקירה נגדית.', true, 'זוהי התשובה הנכונה. סעיף 180 לחוק סדר הדין הפלילי מאפשר לנאשם לחקור עד הגנה של נאשם אחר בחקירה נגדית, אם יש יסוד להניח כי העד יעיד לרעתו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'שמעון אינו רשאי לחקור את לוי בחקירה נגדית, אלא רק בחקירה ראשית, שכן לוי הוא עד הגנה.', false, 'טענה זו שגויה. סעיף 180 לחוק סדר הדין הפלילי מהווה חריג לכלל זה ומאפשר חקירה נגדית במקרים של עדות לרעת נאשם אחר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'שמעון רשאי לבקש מבית המשפט לפסול את עדותו של לוי, שכן היא פוגעת בהגנתו.', false, 'טענה זו שגויה. עדות רלוונטית אינה נפסלת רק משום שהיא פוגעת בנאשם, אלא ניתנת לו הזכות לחקור אותה בחקירה נגדית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'שמעון רשאי לבקש מבית המשפט להורות על הפרדת משפטים, שכן קיים ניגוד אינטרסים מובהק.', false, 'טענה זו שגויה. הפרדת משפטים היא סעד דרסטי יותר, וקיימת דרך פרוצדורלית ספציפית להתמודד עם עד הגנה המעיד לרעת נאשם אחר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'גביית עדות מוקדמת בתיק פלילי',
    4, 'במהלך חקירה פלילית, קיים חשש סביר שעד מפתח לא יוכל למסור עדות במהלך המשפט, או שיופעלו עליו לחצים. מהי הדרך הדיונית המתאימה להבטיח את עדותו?', 'שאלה זו עוסקת בהליך גביית עדות מוקדמת במשפט פלילי, המעוגן בסעיף 117 לחוק סדר הדין הפלילי. היא מדגישה את התנאים והמטרות של הליך זה, שנועד לשמר עדות חשובה כאשר קיים חשש סביר שלא ניתן יהיה לגבותה במהלך המשפט הרגיל, או כאשר יש חשש להפעלת לחצים על העד.', 'סעיף 117 לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי ''בית המשפט רשאי להחליט, לפי בקשת בעל דין, לגבות עדותו של אדם לאלתר, וזאת אם ראה בית המשפט שהעדות חשובה לבירור האשמה וכי יש יסוד סביר להניח שלא יהיה אפשר לגבותה במהלך המשפט, או אם מצא בית המשפט שיש חשש שאמצעי לחץ, איום, הפחדה, כוח או הבטחת טובת הנאה יניאו את העד מלמסור עדות אמת במהלך המשפט''. הליך זה נועד למנוע אובדן ראיות חיוניות ולהגן על עדים. בקשה לגביית עדות מוקדמת יכולה להיות מוגשת על ידי כל אחד מבעלי הדין (תביעה או סניגוריה), ואף לפני הגשת כתב האישום. כך למשל, בע"פ 2595/90 מצליח כחלון נ'' מדינת ישראל (19.7.1993), נדונה בהרחבה סוגיית גביית עדות מוקדמת והתנאים לכך, לרבות חשש שהעד ''יועלם'' או יפחד למסור עדות. גם בת"פ (מחוזי באר שבע) 496/85 מדינת ישראל נ'' נחום ויקטור בן מרדכי ועקנין (31.12.1985), צוין סעיף 177 (העוסק בסדר חקירת עדים) בהקשר של החזרת עד לדוכן העדים, אך סעיף 117 הוא הסעיף הספציפי לגביית עדות מוקדמת.',
    'אי-הכרת הליך גביית העדות המוקדמת או בלבול בינו לבין הליכים אחרים, כגון הכרזה על עד עוין או הגשת תצהיר.', '["חוק סדר הדין הפלילי", "סעיף 117", "עדות מוקדמת", "שימור ראיות", "חשש לאי-הופעה", "לחצים על עד"]'::jsonb, '**וריאציה 1 — תנאים לגבייה מוקדמת:** מתי ניתן לגבות עדות מוקדמת? ← עדות חשובה לבירור האשמה + חשש שלא תוגבה במשפט, או חשש ללחצים על העד (סעיף 117).
**וריאציה 2 — מטרת ההליך:** מהי מטרת גביית עדות מוקדמת? ← לשמר ראיות חיוניות ולמנוע אובדן עדות (ע"פ כחלון).
**וריאציה 3 — מועד הגשת הבקשה:** מתי ניתן להגיש בקשה לגביית עדות מוקדמת? ← על ידי כל בעל דין, ואף לפני הגשת כתב האישום (ע"פ כחלון).', 'גביית עדות מוקדמת ← לשמר עדות חשובה ← במקרה של חשש לאי-גבייה או לחצים.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 117", "ע\"פ 2595/90 מצליח כחלון נ'' מדינת ישראל (19.7.1993)", "ת\"פ (מחוזי באר שבע) 496/85 מדינת ישראל נ'' נחום ויקטור בן מרדכי ועקנין (31.12.1985)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'הגשת בקשה לבית המשפט לגביית עדות מוקדמת, אם העדות חשובה לבירור האשמה וקיים חשש סביר שלא ניתן יהיה לגבותה במהלך המשפט.', true, 'זוהי התשובה הנכונה. סעיף 117 לחוק סדר הדין הפלילי מאפשר גביית עדות מוקדמת במקרים אלו, כדי לשמר את העדות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'הגשת בקשה לבית המשפט להכריז על העד כ''עד עוין'' מראש, כדי לאפשר חקירה נגדית.', false, 'טענה זו שגויה. הכרזה על עד כעוין מתבצעת רק לאחר שהעד מעיד באופן עוין, ואינה נועדה להבטיח את עצם גביית העדות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'הגשת בקשה לבית המשפט להורות על מעצר העד עד למתן עדותו במשפט.', false, 'טענה זו שגויה. מעצר עד הוא סעד חריג ביותר, שאינו הדרך הדיונית הסטנדרטית להבטחת עדות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'הגשת תצהיר חתום של העד לבית המשפט, אשר ישמש כראיה במקום עדותו.', false, 'טענה זו שגויה. תצהיר אינו תחליף לעדות בבית המשפט, אלא אם כן הוסכם על כך או נקבע בחוק במקרים ספציפיים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 32, '2022-S-Q32';
END
$$;

-- ============================================================
-- Q33 — 2022-S-Q33 — chapter=civil_proc subtopic=judge_recusal  [needs_review]
-- classifier_note: Judge's self-recusal in criminal trial — judge_recusal subtopic exists only under civil_proc; cross-track classification
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'a8378870-721f-4766-9a67-42d9b5605aaf'::uuid;
  v_group_id uuid := '6dfbd9e2-2653-47dc-b257-0e243a3df727'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'ba2ac3d3-a8ce-44bb-988c-a11d9bc8413e'::uuid;
  v_ang_1 uuid := 'b831f8f6-b40e-423b-a2a7-9935f7bb88d7'::uuid;
  v_ang_2 uuid := 'fc047c9b-01ae-4b7a-b3bf-d84f84fd72c0'::uuid;
  v_ang_3 uuid := '7ba841a8-6b9f-4a7b-bdcc-5af4eb717620'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q33';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 33, '2022-S-Q33';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'judge_recusal' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'judge_recusal', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q33', v_chapter_id, v_subtopic_id, 'במהלך המשפט טען הנאשם טענת פסלות נגד השופטת בבית משפט השלום בפתח תקווה. השופטת דנה בטענה, קיבלה את הטענה ופסלה את עצמה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 33}'::jsonb, 'השאלה עוסקת בזכות הערעור על החלטת שופט בעניין פסלות בהליך פלילי. היא מתבססת על סעיף 77א(ג) לחוק בתי המשפט, המקנה זכות ערעור לכל בעל דין על החלטת פסלות בפני בית המשפט העליון, ועל סעיף 147 לחוק סדר הדין הפלילי, הקובע את המועד להגשת ערעור זה (חמישה ימים) ואת אופיו כערעור בזכות, בניגוד לכלל הרגיל של אי-ערעור על החלטות ביניים בהליך פלילי.', 'סעיף 77א(ג) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע מפורשות כי ''החלטת שופט או בית משפט לפי סעיף זה תהיה מנומקת, ורשאי בעל דין לערער עליה לפני בית המשפט העליון''. הוראה זו מקנה זכות ערעור לכל בעל דין (כולל התביעה) על החלטת פסלות, בין אם השופט קיבל את הטענה ופסל את עצמו, ובין אם דחה אותה. ערעור זה הוא ערעור בזכות, ואינו דורש קבלת רשות. סעיף 147(ב) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי הערעור יוגש בכתב, בפירוט נימוקיו, תוך חמישה ימים מיום שהודעה לבעלי הדין החלטת השופט. זכות ערעור זו היא חריג לכלל הרחב במשפט הפלילי, לפיו אין ערעור על החלטות ביניים במהלך המשפט, אלא רק במסגרת הערעור על פסק הדין הסופי. ראו לעניין זה ע"פ 7412/02 מיכאל צ''רנוי נ'' מדינת ישראל (17.10.2002), וכן בג"ץ 7590/21 שמעון חלפון נ'' המשנה ליועץ המשפטי לממשלה שלמה למברגר (28.11.2021).', 'הנחה שבהליך פלילי אין ערעור על החלטות ביניים כלל, או בלבול בין ערעור בזכות לבין בקשת רשות ערעור, והתעלמות מהחריג המפורש הקבוע בחוק לעניין פסלות שופט.',
    '["פסלות שופט", "זכות ערעור", "חוק בתי המשפט", "חוק סדר הדין הפלילי", "ערעור בזכות", "החלטות ביניים"]'::jsonb, '**וריאציה 1 — זכות ערעור התביעה:** האם התביעה יכולה לערער על החלטת פסלות שופט? ← כן, זו זכות ערעור לכל בעל דין (סעיף 77א(ג)).
**וריאציה 2 — מועד הערעור:** מתי ניתן לערער על החלטת פסלות? ← באופן מיידי, תוך חמישה ימים (סעיף 147(ב)).
**וריאציה 3 — חריג לכלל:** האם זה חריג לכלל אי-הערעור על החלטות ביניים? ← כן, פסלות שופט היא חריג מפורש (בג"ץ חלפון).', 'החלטת פסלות שופט ← ניתנת לערעור מיידי בזכות ← על ידי כל בעל דין (כולל התביעה).', '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 77א(ג)", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 147(ב)", "ע\"פ 7412/02 מיכאל צ''רנוי נ'' מדינת ישראל (17.10.2002)", "בג\"ץ 7590/21 שמעון חלפון נ'' המשנה ליועץ המשפטי לממשלה שלמה למברגר (28.11.2021)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''הליכים'' → mapped chapter=''civil_proc'' subtopic=''judge_recusal'' | classifier_note: Judge''s self-recusal in criminal trial — judge_recusal subtopic exists only under civil_proc; cross-track classification', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'התביעה אינה רשאית לערער על ההחלטה.', false, 'טענה זו שגויה. סעיף 77א(ג) לחוק בתי המשפט מקנה זכות ערעור לכל בעל דין על החלטת שופט בעניין פסלות, בין אם קיבל את הטענה ובין אם דחה אותה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'התביעה רשאית לערער על ההחלטה רק בסיום המשפט במסגרת הערעור הכולל על פסק הדין.', false, 'טענה זו שגויה. ערעור על החלטת פסלות הוא חריג לכלל שאין ערעור על החלטות ביניים בהליך פלילי, וניתן להגישו באופן מיידי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'התביעה רשאית לערער על ההחלטה באופן מיידי.', true, 'זוהי התשובה הנכונה. סעיף 77א(ג) לחוק בתי המשפט מקנה זכות ערעור על החלטת שופט בעניין פסלות בפני בית המשפט העליון, וסעיף 147 לחוק סדר הדין הפלילי קובע את הפרוצדורה להגשת ערעור זה באופן מיידי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'התביעה רשאית לבקש רשות ערעור על ההחלטה, ואם לא תינתן הרשות, תהיה התביעה רשאית לערער על ההחלטה בסיום המשפט במסגרת הערעור הכולל על פסק הדין.', false, 'טענה זו שגויה. ערעור על החלטת פסלות הוא ערעור בזכות, ואינו דורש קבלת רשות ערעור. כמו כן, הוא אינו נדחה לסיום המשפט.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'מועד העלאת טענת פסלות שופט',
    1, 'ראובן, נאשם במשפט פלילי, גילה במהלך דיון ההוכחות השלישי כי לשופט הדן בעניינו יש קשר משפחתי עם עד תביעה מרכזי. ראובן לא ידע על כך קודם לכן. מתי על ראובן להעלות את טענת הפסלות?', 'שאלה זו עוסקת במועד הקריטי להעלאת טענת פסלות שופט בהליך פלילי, במיוחד כאשר עילת הפסלות מתגלה בשלב מאוחר יותר של המשפט. היא מדגישה את הכלל הקבוע בסעיף 146(ג) לחוק סדר הדין הפלילי, המחייב העלאת הטענה ''מיד לאחר שנודעה לו עילת הפסלות'', תוך שמירה על עקרון היעילות וסופיות הדיון.', 'סעיף 146(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי טענת פסלות תועלה ''לאחר תחילת המשפט... ולפני כל טענה אחרת''. אולם, סעיף 146(ג) מסייג זאת וקובע כי ''לא היה באפשרותו של בעל דין לטעון טענת פסלות בשלב האמור בסעיף קטן (א), רשאי הוא לטענה בשלב שלאחר מכן ובלבד שיעשה זאת מיד לאחר שנודעה לו עילת הפסלות''. כלומר, אם ראובן לא ידע על הקשר המשפחתי קודם לכן, עליו להעלות את הטענה מיד עם היוודע העילה. שיהוי בהעלאת טענת פסלות עלול להוביל לדחייתה, כפי שנקבע בפסיקה. ראו לעניין זה ע"פ 3506/14 פלוני נ'' מדינת ישראל (27.5.2014), וכן עפס"פ 42681-05-25 צבי כהן אקולוגיה בע"מ נ'' מדינת ישראל (12.10.2025).',
    'הנחה שטענת פסלות ניתן להעלות רק בתחילת המשפט, או שניתן להמתין עם העלאתה, מבלי להבין את דרישת ה''מיד'' הקבועה בחוק ובפסיקה.', '["פסלות שופט", "מועד העלאת טענה", "חוק סדר הדין הפלילי", "עילת פסלות", "שיהוי", "סעיף 146(ג)"]'::jsonb, '**וריאציה 1 — גילוי מאוחר:** נאשם גילה עילת פסלות במהלך המשפט. מתי יטען? ← מיד לאחר שנודעה לו העילה (סעיף 146(ג)).
**וריאציה 2 — השפעת שיהוי:** מה קורה אם יש שיהוי בהעלאת הטענה? ← עלולה להידחות (ע"פ פלוני).
**וריאציה 3 — רציונל:** מדוע יש להעלות מיד? ← למנוע שימוש לרעה בהליך ולשמור על יעילות וסופיות הדיון (עפס"פ צבי כהן אקולוגיה).', 'טענת פסלות שופט ← תועלה מיד לאחר היוודע העילה ← גם אם זה לא בתחילת המשפט.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 146(א), 146(ג)", "ע\"פ 3506/14 פלוני נ'' מדינת ישראל (27.5.2014)", "עפס\"פ 42681-05-25 צבי כהן אקולוגיה בע\"מ נ'' מדינת ישראל (12.10.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'מיד לאחר שנודעה לו עילת הפסלות, ולפני כל טענה אחרת.', true, 'זוהי התשובה הנכונה. סעיף 146(ג) לחוק סדר הדין הפלילי קובע כי אם לא היה באפשרותו של בעל דין לטעון טענת פסלות בתחילת המשפט, הוא רשאי לטעון אותה מיד לאחר שנודעה לו עילת הפסלות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'רק בתחילת המשפט, שכן זהו המועד הקבוע בחוק להעלאת טענת פסלות.', false, 'טענה זו שגויה. סעיף 146(ג) לחוק סדר הדין הפלילי מאפשר להעלות טענת פסלות גם בשלב מאוחר יותר, אם העילה נודעה רק אז.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'במסגרת הערעור על פסק הדין, שכן טענת פסלות אינה ניתנת להעלאה במהלך המשפט לאחר תחילתו.', false, 'טענה זו שגויה. טענת פסלות היא חריג לכלל אי-הערעור על החלטות ביניים, וניתן להעלותה במהלך המשפט אם נודעה העילה רק אז.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'בכל שלב שיבחר, כל עוד הוא סבור שהשופט אינו אובייקטיבי.', false, 'טענה זו שגויה. יש להעלות את הטענה מיד לאחר שנודעה העילה, ולא בכל שלב שיבחר בעל הדין, כדי למנוע שיהוי ושימוש לרעה בהליך.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'מבחן החשש הממשי למשוא פנים',
    2, 'מהו המבחן המרכזי לפסילת שופט, ומהם השיקולים העיקריים שבית המשפט בוחן בעת יישום מבחן זה?', 'שאלה זו מתמקדת במבחן המרכזי לפסילת שופט, כפי שמעוגן בסעיף 77א(א) לחוק בתי המשפט. היא בוחנת את אופיו האובייקטיבי של המבחן, הדורש ''חשש ממשי למשוא פנים'', ומבחינה בינו לבין תחושה סובייקטיבית של בעל דין או עילות פסלות ספציפיות יותר.', 'סעיף 77א(א) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי שופט לא ישב בדין אם מצא ''כי קיימות נסיבות שיש בהן כדי ליצור חשש ממשי למשוא פנים בניהול המשפט''. הפסיקה הדגישה כי מבחן זה הוא אובייקטיבי, ואינו מסתפק בתחושה סובייקטיבית של בעל דין. יש לבחון האם אדם סביר, בנסיבות העניין, היה חושש למשוא פנים. שיקולים נפוצים הנבחנים בהקשר זה כוללים חשיפה לחומר חקירה בהליכי מעצר (שאינה מקימה כשלעצמה עילת פסלות, אלא אם מדובר ב''מסה קריטית'' של חומר בלתי קביל), היכרות קודמת עם נאשם, או החלטות דיוניות. ראו לעניין זה ע"פ 7513/22 אונור קלש נ'' מדינת ישראל (1.12.2022), ע"פ 8490/22 חמיד פאשיר מטר נ'' מדינת ישראל (22.12.2022), וכן ע"פ 1988/94 דני בראון נ'' מדינת ישראל (19.6.1994).',
    'התבלבלות בין חשש סובייקטיבי של בעל דין לבין המבחן האובייקטיבי של ''חשש ממשי למשוא פנים'', או הנחה שכל חשיפה קודמת של שופט לתיק מקימה עילת פסלות.', '["פסלות שופט", "חשש ממשי למשוא פנים", "מבחן אובייקטיבי", "חוק בתי המשפט", "עילות פסלות", "מסה קריטית"]'::jsonb, '**וריאציה 1 — הגדרת המבחן:** מהו המבחן לפסילת שופט? ← חשש ממשי למשוא פנים בניהול המשפט (סעיף 77א(א)).
**וריאציה 2 — אופי המבחן:** האם המבחן סובייקטיבי או אובייקטיבי? ← אובייקטיבי, בוחן אם אדם סביר היה חושש (ע"פ בראון).
**וריאציה 3 — מה לא מקיים פסלות:** האם חשיפה לחומר מעצר או היכרות קודמת מקימה פסלות? ← לא בהכרח, אלא אם מדובר ב''מסה קריטית'' (ע"פ קלש, ע"פ מטר).', 'פסלות שופט ← חשש ממשי למשוא פנים ← מבחן אובייקטיבי, לא סובייקטיבי.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 77א(א)", "ע\"פ 7513/22 אונור קלש נ'' מדינת ישראל (1.12.2022)", "ע\"פ 8490/22 חמיד פאשיר מטר נ'' מדינת ישראל (22.12.2022)", "ע\"פ 1988/94 דני בראון נ'' מדינת ישראל (19.6.1994)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'המבחן הוא ''חשש ממשי למשוא פנים בניהול המשפט'', ובית המשפט בוחן האם קיימות נסיבות אובייקטיביות המקימות חשש כזה, ולא רק תחושה סובייקטיבית של בעל דין.', true, 'זוהי התשובה הנכונה. סעיף 77א(א) לחוק בתי המשפט קובע את מבחן ''החשש הממשי למשוא פנים'', והפסיקה מדגישה את אופיו האובייקטיבי של המבחן.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'המבחן הוא ''חשש סובייקטיבי של בעל דין למשוא פנים'', ודי בכך שבעל הדין חש שהשופט אינו אובייקטיבי כדי לפסול אותו.', false, 'טענה זו שגויה. המבחן הוא אובייקטיבי, ואין די בתחושה סובייקטיבית של בעל דין כדי להקים עילת פסלות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'המבחן הוא ''כל חשש למשוא פנים'', ובית המשפט יפסול את עצמו גם אם החשש קל ואינו ממשי.', false, 'טענה זו שגויה. נדרש ''חשש ממשי'' למשוא פנים, ולא כל חשש קל או תיאורטי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'המבחן הוא ''עניין אישי ממשי'' של השופט בהליך, ורק עילות פסלות מפורשות בסעיף 77א(א1) לחוק בתי המשפט יביאו לפסילה.', false, 'טענה זו שגויה. סעיף 77א(א1) מפרט עילות פסלות נוספות, אך סעיף 77א(א) הוא הכלל הרחב של ''חשש ממשי למשוא פנים'', שאינו מוגבל רק לעילות המפורטות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'השפעת החלטות דיוניות על פסלות שופט',
    3, 'במהלך משפט פלילי, השופט נתן מספר החלטות דיוניות חריגות, ואף הביע ביקורת על התנהלות סניגור הנאשם. הנאשם טוען כי התנהלות זו מקימה עילת פסלות. מה הדין?', 'שאלה זו בוחנת את הגבול הדק בין החלטות דיוניות לגיטימיות וביקורת שיפוטית לבין עילת פסלות שופט. היא מדגישה את העיקרון לפיו החלטות דיוניות, גם אם חריגות, וביקורת על התנהלות, אינן מקימות כשלעצמן עילת פסלות, אלא אם הן מעידות על ''נעילת דעת'' או חשש ממשי למשוא פנים, תוך שמירה על עצמאות שיפוטית.', 'הפסיקה קבעה כי אופן ניהול ההליך והחלטות דיוניות שניתנות בו אינן מקימות כשלעצמן עילת פסלות, גם בנסיבות בהן המותב מביע ביקורת על התנהלותו של בעל דין או בא כוחו. האפיק הראוי להשגה על החלטות דיוניות הוא בהליכי ערעור מתאימים. עילת פסלות תקום רק אם ההחלטות או ההתבטאויות מעידות על ''נעילת דעת'' של השופט או על חשש ממשי למשוא פנים. כך למשל, בע"פ 8397/22 שרון שיר נ'' מדינת ישראל (15.12.2022), נדחה ערעור פסלות למרות ביקורת חריפה של השופט על הנאשם. בע"פ 5133/23 פלוני נ'' מדינת ישראל (12.7.2023), נקבע כי החלטות דיוניות, גם חריגות, אינן מקימות חשש ממשי למשוא פנים. גם בע"פ 2966/15 אסילקו לעבודות בנייה וחקלאות בע"מ נ'' מדינת ישראל (30.4.2015), הודגש כי החלטות דיוניות אינן יוצרות כשלעצמן חשש למשוא פנים.',
    'הנחה שכל החלטה דיונית שאינה לרוחו של בעל דין, או כל ביקורת שיפוטית, מקימה עילת פסלות, מבלי להבין את הרף הגבוה הנדרש ל''חשש ממשי למשוא פנים''.', '["פסלות שופט", "החלטות דיוניות", "ביקורת שיפוטית", "חשש ממשי למשוא פנים", "נעילת דעת", "עצמאות שיפוטית"]'::jsonb, '**וריאציה 1 — ביקורת שיפוטית:** שופט ביקר סניגור. האם זו עילת פסלות? ← לא כשלעצמה, אלא אם מעידה על ''נעילת דעת'' (ע"פ שיר).
**וריאציה 2 — החלטות חריגות:** שופט נתן החלטות דיוניות חריגות. האם זו עילת פסלות? ← לא כשלעצמה, אלא אם מקימה חשש ממשי למשוא פנים (ע"פ פלוני).
**וריאציה 3 — אפיק השגה:** מהי הדרך להשיג על החלטות דיוניות? ← ערעור על פסק הדין, ולא בהכרח טענת פסלות (ע"פ אסילקו).', 'החלטות דיוניות וביקורת ← אינן מקימות פסלות כשלעצמן ← אלא אם מעידות על חשש ממשי למשוא פנים.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 77א(א)", "ע\"פ 8397/22 שרון שיר נ'' מדינת ישראל (15.12.2022)", "ע\"פ 5133/23 פלוני נ'' מדינת ישראל (12.7.2023)", "ע\"פ 2966/15 אסילקו לעבודות בנייה וחקלאות בע\"מ נ'' מדינת ישראל (30.4.2015)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'החלטות דיוניות וביקורת על התנהלות אינן מקימות כשלעצמן עילת פסלות, אלא אם הן מעידות על ''נעילת דעת'' או חשש ממשי למשוא פנים.', true, 'זוהי התשובה הנכונה. הפסיקה קבעה כי החלטות דיוניות וביקורת אינן מקימות עילת פסלות כשלעצמן, אלא אם הן חורגות באופן קיצוני ומעידות על חוסר אובייקטיביות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'כל ביקורת של שופט על סניגור מקימה עילת פסלות, שכן היא פוגעת במראית פני הצדק.', false, 'טענה זו שגויה. בית המשפט רשאי להביע מורת רוח מהתנהלות הצדדים, ואין בכך כשלעצמו כדי להקים עילת פסלות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'החלטות דיוניות חריגות תמיד מקימות עילת פסלות, שכן הן מעידות על חוסר אובייקטיביות של השופט.', false, 'טענה זו שגויה. החלטות דיוניות, גם חריגות, אינן מקימות עילת פסלות כשלעצמן, אלא אם הן מעידות על ''נעילת דעת'' או חשש ממשי למשוא פנים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'הנאשם רשאי לערער על ההחלטות הדיוניות, אך אינו רשאי לטעון לפסלות השופט בגינן.', false, 'טענה זו שגויה. האפיק הראוי להשגה על החלטות דיוניות הוא ערעור, אך במקרים קיצוניים הן יכולות להוות בסיס לטענת פסלות, אם הן מעידות על חשש ממשי למשוא פנים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'השפעת הודעה על ערעור פסלות על המשך הדיון',
    4, 'במהלך משפט פלילי, השופט דחה בקשת פסלות שהוגשה נגדו. הנאשם הודיע לבית המשפט כי בכוונתו לערער על ההחלטה. מהי ההשפעה המיידית של הודעה זו על המשך הדיון?', 'שאלה זו עוסקת בהשפעה הדיונית של הודעה על כוונה לערער על החלטת פסלות שופט בהליך פלילי. היא מתמקדת בהוראת סעיף 147(א) לחוק סדר הדין הפלילי, הקובעת את הכלל בדבר הפסקת המשפט עד להכרעה בערעור, ואת החריג המאפשר לשופט להורות על המשך הדיון מנימוקים שיירשמו.', 'סעיף 147(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי ''בעל דין שבדעתו לערער על החלטת שופט לפי סעיף 77א לחוק בתי המשפט יודיע על כך לבית המשפט, ומשהודיע יופסק המשפט ולא יימשך עד להחלטה בערעור, זולת אם החליט השופט, ובמותב - אב-בית-הדין, מנימוקים שיירשמו, שיש להמשיך במשפט''. כלל זה נועד לאזן בין זכותו של בעל הדין לערער על החלטת פסלות לבין הצורך ביעילות הדיון. אם השופט מחליט להמשיך במשפט, רשאי נשיא בית המשפט העליון או מי שדן בערעור להורות על הפסקת המשפט עד להחלטה בערעור, לבקשת המערער (סעיף 147(ג)). ראו לעניין זה ע"פ 1730/17 שלום דומרני נ'' מדינת ישראל (27.1.2019), וכן בג"ץ 7590/21 שמעון חלפון נ'' המשנה ליועץ המשפטי לממשלה שלמה למברגר (28.11.2021).',
    'הנחה שהמשפט מופסק אוטומטית ללא שיקול דעת של השופט, או שהמשפט ממשיך כרגיל ללא כל השפעה של הודעת הערעור.', '["פסלות שופט", "ערעור על החלטת פסלות", "הפסקת משפט", "המשך משפט", "חוק סדר הדין הפלילי", "שיקול דעת שיפוטי"]'::jsonb, '**וריאציה 1 — הודעה על ערעור:** נאשם הודיע על ערעור פסלות. מה קורה? ← המשפט יופסק, אלא אם השופט מנמק להמשיך (סעיף 147(א)).
**וריאציה 2 — סמכות השופט:** האם השופט יכול להמשיך את הדיון? ← כן, אם החליט מנימוקים שיירשמו (סעיף 147(א)).
**וריאציה 3 — התערבות נשיא:** אם השופט המשיך, האם ניתן לעצור את הדיון? ← כן, נשיא העליון או מי שדן בערעור רשאי להורות על הפסקה (סעיף 147(ג)).', 'הודעה על ערעור פסלות ← מפסיקה את המשפט ככלל ← אלא אם השופט מנמק להמשיך.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 147(א), 147(ג)", "ע\"פ 1730/17 שלום דומרני נ'' מדינת ישראל (27.1.2019)", "בג\"ץ 7590/21 שמעון חלפון נ'' המשנה ליועץ המשפטי לממשלה שלמה למברגר (28.11.2021)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'המשפט יופסק ולא יימשך עד להחלטה בערעור, אלא אם השופט החליט, מנימוקים שיירשמו, שיש להמשיך במשפט.', true, 'זוהי התשובה הנכונה. סעיף 147(א) לחוק סדר הדין הפלילי קובע כלל זה, המאזן בין זכות הערעור לבין יעילות הדיון.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'המשפט ימשיך כרגיל, שכן הגשת ערעור על החלטת פסלות אינה מעכבת את ההליך העיקרי.', false, 'טענה זו שגויה. הכלל הוא הפסקת המשפט, אלא אם השופט מנמק אחרת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'המשפט יופסק אוטומטית, ואין לשופט סמכות להורות על המשכו.', false, 'טענה זו שגויה. לשופט יש סמכות להורות על המשך המשפט, אם מצא לכך נימוקים שיירשמו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'המשפט יופסק רק אם נשיא בית המשפט העליון יורה על כך, לבקשת הנאשם.', false, 'טענה זו שגויה. ההחלטה הראשונית על הפסקת המשפט או המשכו נתונה לשופט הדן בתיק, ורק לאחר מכן נשיא בית המשפט העליון יכול להתערב.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 33, '2022-S-Q33';
END
$$;

-- ============================================================
-- Q34 — 2022-S-Q34 — chapter=evidence subtopic=admissibility
-- classifier_note: Defendant's video evidence in theft case — admissibility
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'b1beffb2-0bff-4cef-824b-b6a10b04453d'::uuid;
  v_group_id uuid := '2049eb1e-0eec-4f3c-9756-8e29342a536a'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '90a1a0b9-d225-4a93-9301-565a0dfda94d'::uuid;
  v_ang_1 uuid := '290530d3-49d2-465b-a8b0-b89fb40d94f8'::uuid;
  v_ang_2 uuid := 'ae617d8d-7357-4f0d-894c-477250e2f7d5'::uuid;
  v_ang_3 uuid := 'df235595-48a9-41cc-bf5b-0cd6f517b8b4'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q34';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 34, '2022-S-Q34';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'evidence';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'evidence';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'admissibility' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'admissibility', 'evidence';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q34', v_chapter_id, v_subtopic_id, 'נגד אביב הוגש כתב אישום בגין עבירת הגניבה. אביב מתכוון להציג כראיה מטעמו סרטון וידאו המראה שהוא לא ביצע את העבירה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 34}'::jsonb, 'השאלה עוסקת בחובת ההודעה המוקדמת על הצגת ראיות חפציות או מסמכים במשפט פלילי, כפי שנקבע בתקנה 57א לתקנות סדר הדין הפלילי. היא מדגישה את חובתו של בעל דין (במקרה זה, הנאשם) להודיע לבית המשפט על כוונתו להציג ראיה כזו, ואת המועד הקבוע לכך, וזאת כדי למנוע הפתעות ולאפשר היערכות הולמת לדיון.', 'תקנה 57א(א) לתקנות סדר הדין הפלילי, התשל"ד-1974, קובעת כי ''בעל דין המבקש להציג ראיה חפצית או מסמך, יודיע על כך לבית המשפט לא יאוחר משלושה ימים לפני מועד הדיון''. מטרת התקנה היא למנוע הפתעות במהלך המשפט, לאפשר לבית המשפט ולבעל הדין שכנגד להיערך כראוי לראיה, ולשמור על הגינות ההליך. בנוסף לחובת ההודעה לבית המשפט, תקנה 57א(ב) קובעת כי ''בעל דין שהודיע כאמור, יאפשר לבעל הדין שכנגד לעיין בראיה או במסמך, לפי דרישתו''. אי-עמידה בדרישות אלו אינה מביאה לפסילה אוטומטית של הראיה, אלא מעניקה לבית המשפט שיקול דעת להתיר את הצגתה, תוך בחינת הפגיעה בהגינות הדיון והאפשרות לרפא את הפגם. ראו לעניין זה עפס"פ 42681-05-25 צבי כהן אקולוגיה בע"מ נ'' מדינת ישראל (12.10.2025).', 'הבלבול בין חובת ההודעה לבית המשפט לבין חובת מתן אפשרות עיון לבעל הדין שכנגד, או אי-הבנה של המועד הקבוע להודעה.',
    '["תקנות סדר הדין הפלילי", "תקנה 57א", "ראיה חפצית", "מסמך", "חובת הודעה", "מועדים", "הגינות הדיון"]'::jsonb, '**וריאציה 1 — חובת הודעה:** האם יש חובה להודיע על הצגת סרטון וידאו? ← כן, לבית המשפט (תקנה 57א(א)).
**וריאציה 2 — מועד ההודעה:** מתי יש להודיע? ← לא יאוחר מ-3 ימים לפני מועד הדיון (תקנה 57א(א)).
**וריאציה 3 — חובת עיון:** האם יש חובה לאפשר לתביעה לעיין? ← כן, אם הודיע, יאפשר עיון לפי דרישה (תקנה 57א(ב)).', 'הצגת ראיה חפצית/מסמך ← חובת הודעה לביהמ"ש 3 ימים מראש ← חובת מתן עיון לבעל הדין שכנגד.', '["תקנות סדר הדין הפלילי, התשל\"ד-1974: תקנה 57א", "עפס\"פ 42681-05-25 צבי כהן אקולוגיה בע\"מ נ'' מדינת ישראל (12.10.2025)"]'::jsonb,
    'classification_review: original chapter=''דיני ראיות'' subtopic=''קבילות ראיות'' → mapped chapter=''evidence'' subtopic=''admissibility'' | classifier_note: Defendant''s video evidence in theft case — admissibility', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על אביב מוטלת חובה להודיע לבית המשפט כי הוא מתכוון להציג ראיה זו לא יאוחר מ-3 ימים לפני מועד הדיון.', true, 'זוהי התשובה הנכונה. תקנה 57א(א) לתקנות סדר הדין הפלילי קובעת כי בעל דין המבקש להציג ראיה חפצית או מסמך, יודיע על כך לבית המשפט לא יאוחר משלושה ימים לפני מועד הדיון.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על אביב מוטלת חובה להודיע לבית המשפט ולתביעה כי הוא מתכוון להציג ראיה זו לא יאוחר מ-3 ימים לפני מועד הדיון.', false, 'טענה זו שגויה. תקנה 57א(א) מחייבת הודעה לבית המשפט בלבד, ולא לתביעה. חובת העיון של התביעה בראיה נובעת מתקנה 57א(ב).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על אביב לא מוטלת כל חובה להודיע לבית המשפט על כוונתו להציג ראיה זו, אך מוטלת עליו החובה לאפשר לתביעה לעיין בראיה לפני מועד הדיון.', false, 'טענה זו שגויה. על אביב מוטלת חובה להודיע לבית המשפט על כוונתו להציג את הראיה, בנוסף לחובתו לאפשר לתביעה לעיין בה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על אביב לא מוטלת כל חובה להודיע לבית המשפט על כוונתו להציג ראיה זו, ולא מוטלת עליו כל חובה לאפשר לתביעה לעיין בראיה לפני מועד הדיון.', false, 'טענה זו שגויה לחלוטין. תקנה 57א מטילה חובות הן על הודעה לבית המשפט והן על מתן אפשרות עיון לבעל הדין שכנגד.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'הגשת ראיה חפצית על ידי התביעה',
    1, 'התביעה במשפט פלילי מבקשת להציג כראיה חפצית סכין שנתפסה בזירת העבירה. מהן חובותיה של התביעה בהקשר זה?', 'שאלה זו בוחנת את תחולת תקנה 57א לתקנות סדר הדין הפלילי גם על התביעה, ולא רק על ההגנה. היא מדגישה את העיקרון של שוויון בין בעלי הדין בכל הנוגע לחובת הודעה מוקדמת על הצגת ראיות חפציות ומסמכים, ואת חובת מתן אפשרות עיון לבעל הדין שכנגד.', 'תקנה 57א(א) לתקנות סדר הדין הפלילי, התשל"ד-1974, קובעת כי ''בעל דין המבקש להציג ראיה חפצית או מסמך, יודיע על כך לבית המשפט לא יאוחר משלושה ימים לפני מועד הדיון''. המונח ''בעל דין'' כולל הן את התביעה והן את ההגנה. בנוסף, תקנה 57א(ב) קובעת כי ''בעל דין שהודיע כאמור, יאפשר לבעל הדין שכנגד לעיין בראיה או במסמך, לפי דרישתו''. מטרת התקנה היא למנוע הפתעות, לאפשר לצדדים להיערך כראוי לדיון, ולשמור על הגינות ההליך. לכן, גם התביעה מחויבת לעמוד בדרישות אלו כאשר היא מבקשת להציג ראיה חפצית. ראו לעניין זה עפס"פ 42681-05-25 צבי כהן אקולוגיה בע"מ נ'' מדינת ישראל (12.10.2025) (הלכה עקרונית לגבי תחולת התקנה).',
    'הנחה שחובת ההודעה והעיון חלה רק על ההגנה, או אי-הבנה שתקנה 57א חלה באופן הדדי על שני הצדדים.', '["תקנות סדר הדין הפלילי", "תקנה 57א", "ראיה חפצית", "מסמך", "חובת הודעה", "זכות עיון"]'::jsonb, '**וריאציה 1 — תחולת התקנה:** האם תקנה 57א חלה גם על התביעה? ← כן, על ''בעל דין'' (תקנה 57א(א)).
**וריאציה 2 — חובות התביעה:** מהן חובות התביעה בהצגת ראיה חפצית? ← הודעה לבית המשפט 3 ימים מראש + מתן אפשרות עיון לנאשם (תקנה 57א).
**וריאציה 3 — מטרת התקנה:** מהי מטרת תקנה 57א? ← למנוע הפתעות, לאפשר היערכות ולשמור על הגינות ההליך.', 'הצגת ראיה חפצית ע"י התביעה ← חובת הודעה לביהמ"ש 3 ימים מראש ← חובת מתן עיון לנאשם.',
    '["תקנות סדר הדין הפלילי, התשל\"ד-1974: תקנה 57א", "עפס\"פ 42681-05-25 צבי כהן אקולוגיה בע\"מ נ'' מדינת ישראל (12.10.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'התביעה חייבת להודיע לבית המשפט על כוונתה להציג את הסכין לא יאוחר מ-3 ימים לפני מועד הדיון, ולאפשר לנאשם לעיין בה.', true, 'זוהי התשובה הנכונה. תקנה 57א(א) חלה על כל בעל דין, לרבות התביעה, המחויבת להודיע לבית המשפט ולאפשר עיון לבעל הדין שכנגד (הנאשם).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'התביעה אינה חייבת להודיע לבית המשפט, שכן חובת ההודעה חלה רק על הנאשם.', false, 'טענה זו שגויה. תקנה 57א(א) חלה על ''בעל דין'', וכוללת גם את התביעה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'התביעה חייבת להודיע לבית המשפט ולנאשם על כוונתה להציג את הסכין, אך אין מגבלת זמן להודעה זו.', false, 'טענה זו שגויה. קיימת מגבלת זמן של 3 ימים לפני מועד הדיון להודעה לבית המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'התביעה חייבת לאפשר לנאשם לעיין בסכין, אך אינה חייבת להודיע לבית המשפט על כוונתה להציגה.', false, 'טענה זו שגויה. חובת ההודעה לבית המשפט קיימת בנוסף לחובת מתן אפשרות העיון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'הגדרת ''ראיה חפצית'' ו''מסמך''',
    2, 'אילו סוגי ראיות נכללים בהגדרת ''ראיה חפצית'' או ''מסמך'' לצורך תקנה 57א לתקנות סדר הדין הפלילי?', 'שאלה זו עוסקת בפרשנות המונחים ''ראיה חפצית'' ו''מסמך'' בתקנה 57א לתקנות סדר הדין הפלילי. היא מדגישה את הפרשנות הרחבה שניתנה למונחים אלו בפסיקה, כך שתכלול מגוון רחב של ראיות שאינן עדות בעל פה, לרבות ראיות דיגיטליות, וזאת כדי להגשים את תכלית התקנה למנוע הפתעות ולשמור על הגינות הדיון.', 'המונחים ''ראיה חפצית'' ו''מסמך'' בתקנה 57א לתקנות סדר הדין הפלילי פורשו בפסיקה באופן רחב, כך שיכללו כל ראיה שאינה עדות בעל פה. מטרת התקנה היא למנוע הפתעות ולאפשר לצדדים להיערך כראוי לדיון. לכן, הפרשנות כוללת לא רק מסמכים כתובים ופריטים פיזיים מובהקים, אלא גם קלטות שמע ווידאו, תמונות, פלט מחשב, הקלטות טלפון, הודעות טקסט וכדומה. כלומר, כל ראיה שניתן להציגה פיזית או באמצעים טכנולוגיים, ושאינה נמסרת בעל פה על ידי עד, נכללת בגדר התקנה. ראו לעניין זה עפס"פ 42681-05-25 צבי כהן אקולוגיה בע"מ נ'' מדינת ישראל (12.10.2025) (הלכה עקרונית לגבי פרשנות המונחים).',
    'הבנה מצומצמת של המונחים ''ראיה חפצית'' ו''מסמך'' והגבלתם לראיות פיזיות או כתובות בלבד, מבלי לכלול ראיות דיגיטליות או מולטימדיה.', '["תקנות סדר הדין הפלילי", "תקנה 57א", "ראיה חפצית", "מסמך", "ראיות דיגיטליות", "פרשנות חוק"]'::jsonb, '**וריאציה 1 — הגדרת ראיה חפצית:** מה נחשב ל''ראיה חפצית'' או ''מסמך'' בתקנה 57א? ← כל ראיה שאינה עדות בעל פה, כולל דיגיטליות (עפס"פ צבי כהן אקולוגיה).
**וריאציה 2 — דוגמאות:** תן דוגמאות לראיות הנכללות בהגדרה. ← קלטות וידאו, תמונות, פלט מחשב, הקלטות טלפון.
**וריאציה 3 — תכלית הפרשנות:** מדוע הפרשנות רחבה? ← למנוע הפתעות ולאפשר היערכות הולמת לדיון.', 'ראיה חפצית/מסמך (תקנה 57א) ← כל ראיה שאינה עדות בעל פה ← כולל ראיות דיגיטליות.',
    '["תקנות סדר הדין הפלילי, התשל\"ד-1974: תקנה 57א", "עפס\"פ 42681-05-25 צבי כהן אקולוגיה בע\"מ נ'' מדינת ישראל (12.10.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'רק מסמכים כתובים ופריטים פיזיים הניתנים לאחיזה, כגון כלי נשק או בגדים.', false, 'טענה זו צרה מדי. ההגדרה כוללת גם ראיות דיגיטליות וקלטות וידאו, שאינן בהכרח ''פריטים פיזיים הניתנים לאחיזה'' במובן המסורתי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'מסמכים כתובים, ראיות פיזיות, קלטות שמע ווידאו, ותמונות, אך לא פלט מחשב.', false, 'טענה זו שגויה. פלט מחשב נחשב ל''מסמך'' או ''ראיה חפצית'' בהקשרים רבים, ואין סיבה להחריגו מתחולת תקנה 57א.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כל ראיה שאינה עדות בעל פה, לרבות מסמכים, ראיות פיזיות, קלטות שמע ווידאו, תמונות ופלט מחשב.', true, 'זוהי התשובה הנכונה. הפסיקה הרחיבה את הפרשנות ל''ראיה חפצית'' ו''מסמך'' כך שתכלול כל ראיה שאינה עדות בעל פה, לרבות ראיות דיגיטליות, כדי להגשים את תכלית התקנה למנוע הפתעות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'רק ראיות שהוגשו על ידי התביעה במסגרת חומר החקירה.', false, 'טענה זו שגויה. תקנה 57א חלה על ראיות שכל בעל דין (תביעה או הגנה) מבקש להציג, ולא רק על אלו שהוגשו כחומר חקירה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הגשת ראיה חפצית ללא הודעה מוקדמת',
    3, 'אביב, הנאשם, הגיע לדיון בבית המשפט עם סרטון וידאו המוכיח את חפותו, אך לא הודיע לבית המשפט על כוונתו להציגו 3 ימים מראש, כנדרש בתקנה 57א. מה רשאי בית המשפט לעשות?', 'שאלה זו עוסקת בסמכותו של בית המשפט להתיר הצגת ראיה חפצית או מסמך, גם כאשר לא ניתנה הודעה מוקדמת כנדרש בתקנה 57א לתקנות סדר הדין הפלילי. היא מדגישה את שיקול הדעת הרחב של בית המשפט, המאזן בין הצורך בשמירה על כללי הפרוצדורה לבין עשיית צדק ומניעת עיוות דין, תוך בחינת הפגיעה בבעל הדין שכנגד והאפשרות לרפא את הפגם.', 'אי-עמידה בדרישות תקנה 57א לתקנות סדר הדין הפלילי אינה מביאה לפסילה אוטומטית של הראיה. לבית המשפט שיקול דעת רחב להתיר את הצגת הראיה, גם אם לא ניתנה הודעה מוקדמת, וזאת תוך בחינת מכלול נסיבות העניין. השיקולים המרכזיים הם: מידת הפגיעה בהגינות הדיון ובזכותו של בעל הדין שכנגד להיערך לראיה, חשיבות הראיה לאמת ולצדק, והאפשרות לרפא את הפגם (למשל, באמצעות דחיית הדיון או מתן שהות לבעל הדין שכנגד לעיין בראיה ולהגיב עליה). במקרים בהם הראיה חיונית להגנת הנאשם, נוטה בית המשפט להתיר את הצגתה, תוך נקיטת אמצעים למניעת פגיעה בתביעה. ראו לעניין זה עפס"פ 42681-05-25 צבי כהן אקולוגיה בע"מ נ'' מדינת ישראל (12.10.2025) (הלכה עקרונית לגבי שיקול הדעת).',
    'הנחה שכל הפרה של כלל פרוצדורלי מביאה לפסילת הראיה, מבלי להכיר בשיקול הדעת של בית המשפט ובאיזון בין כללי הפרוצדורה לבין עשיית צדק.', '["תקנות סדר הדין הפלילי", "תקנה 57א", "שיקול דעת שיפוטי", "הגינות הדיון", "עשיית צדק", "ריפוי פגם"]'::jsonb, '**וריאציה 1 — אי-הודעה:** נאשם לא הודיע על ראיה 3 ימים מראש. האם הראיה נפסלת? ← לא אוטומטית, לבית המשפט שיקול דעת (עפס"פ צבי כהן אקולוגיה).
**וריאציה 2 — שיקולי בית המשפט:** מה בוחן בית המשפט? ← פגיעה בהגינות הדיון, חשיבות הראיה, אפשרות ריפוי הפגם (עפס"פ צבי כהן אקולוגיה).
**וריאציה 3 — סעדים אפשריים:** מה יכול בית המשפט לעשות? ← להתיר את הראיה, לדחות את הדיון, או לדחות את הראיה אם הפגיעה חמורה.', 'הצגת ראיה ללא הודעה מוקדמת ← לא פוסלת אוטומטית ← לביהמ"ש שיקול דעת לאזן בין פרוצדורה לצדק.',
    '["תקנות סדר הדין הפלילי, התשל\"ד-1974: תקנה 57א", "עפס\"פ 42681-05-25 צבי כהן אקולוגיה בע\"מ נ'' מדינת ישראל (12.10.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט חייב לדחות את הצגת הראיה, שכן אי-עמידה בתקנה 57א פוסלת את הראיה.', false, 'טענה זו שגויה. אי-עמידה בתקנה 57א אינה פוסלת אוטומטית את הראיה, אלא מעניקה לבית המשפט שיקול דעת.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בית המשפט רשאי להתיר את הצגת הראיה, אם שוכנע כי אי-ההודעה לא פגעה בהגינות הדיון או שניתן לרפא את הפגם, למשל באמצעות דחיית הדיון.', true, 'זוהי התשובה הנכונה. לבית המשפט שיקול דעת רחב להתיר הצגת ראיה גם ללא הודעה מוקדמת, תוך בחינת הפגיעה בהגינות הדיון והאפשרות לרפא את הפגם.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט רשאי להתיר את הצגת הראיה רק אם התביעה מסכימה לכך.', false, 'טענה זו שגויה. הסכמת התביעה היא שיקול, אך אינה תנאי הכרחי להפעלת שיקול הדעת של בית המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט חייב לדחות את הצגת הראיה, אך רשאי להטיל קנס על אביב בגין אי-עמידה בתקנות.', false, 'טענה זו שגויה. בית המשפט אינו חייב לדחות את הראיה, וקנס אינו הסעד היחיד או העיקרי במקרה זה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'זכות עיון בחומר חקירה',
    4, 'במהלך חקירה פלילית, המשטרה תפסה סרטון וידאו שעלול להפליל את אביב. אביב, באמצעות סניגורו, מבקש לעיין בסרטון. מהי זכותו של אביב לעיין בחומר זה?', 'שאלה זו עוסקת בזכותו של נאשם לעיין בחומר חקירה, המעוגנת בסעיף 74 לחוק סדר הדין הפלילי. היא מדגישה את היקפה הרחב של זכות זו, המהווה זכות יסוד במשפט הפלילי, ואת החריגים המצומצמים לה, כגון חומר חסוי או חומר שאינו רלוונטי, וזאת כדי להבטיח הליך הוגן וזכות הגנה יעילה.', 'סעיף 74(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי ''הוגש כתב אישום, רשאי הנאשם, וכן סניגורו, לעיין בכל עת בחומר החקירה וכן בכתב האישום ובהודעות שנמסרו לפי סעיפים 60א ו-60ב, ולקבל העתק מהם''. זכות זו היא זכות יסוד של הנאשם, המאפשרת לו להיערך להגנתו כראוי. החריגים לזכות העיון מפורטים בסעיף 74(ב) וכוללים חומר שהוצא לגביו צו חיסיון, חומר שאינו רלוונטי, או חומר שגילויו עלול לפגוע בביטחון המדינה או ביחסי החוץ שלה. סרטון וידאו שנתפס בחקירה הוא חלק מחומר החקירה, ולכן אביב זכאי לעיין בו ולקבל העתק, אלא אם כן חל עליו אחד החריגים. ראו לעניין זה עפס"פ 42681-05-25 צבי כהן אקולוגיה בע"מ נ'' מדינת ישראל (12.10.2025) (הלכה עקרונית לגבי זכות העיון).',
    'הבלבול בין זכות העיון בחומר חקירה (סעיף 74) לבין חובת ההודעה על הצגת ראיות (תקנה 57א), או הנחה שזכות העיון מצומצמת יותר ממה שהיא בפועל.', '["חוק סדר הדין הפלילי", "סעיף 74", "זכות עיון", "חומר חקירה", "הליך הוגן", "זכות הגנה"]'::jsonb, '**וריאציה 1 — היקף זכות העיון:** מהי זכותו של נאשם לעיין בחומר חקירה? ← זכות רחבה לעיין ולקבל העתק מכל חומר החקירה (סעיף 74(א)).
**וריאציה 2 — חריגים לזכות:** אילו חריגים קיימים לזכות העיון? ← חומר חסוי, לא רלוונטי, או פוגע בביטחון המדינה (סעיף 74(ב)).
**וריאציה 3 — מטרת הזכות:** מהי מטרת זכות העיון? ← לאפשר לנאשם להיערך להגנתו כראוי ולהבטיח הליך הוגן.', 'זכות עיון בחומר חקירה ← רחבה, לכל חומר החקירה ← למעט חריגים מוגדרים בחוק.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982: סע'' 74(א), 74(ב)", "עפס\"פ 42681-05-25 צבי כהן אקולוגיה בע\"מ נ'' מדינת ישראל (12.10.2025)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'אביב זכאי לעיין בכל חומר החקירה, לרבות הסרטון, ולקבל העתק ממנו, למעט חומר שהוצא לגביו צו חיסיון או חומר שאינו רלוונטי.', true, 'זוהי התשובה הנכונה. סעיף 74 לחוק סדר הדין הפלילי מקנה לנאשם זכות עיון רחבה בחומר החקירה, למעט חריגים מוגדרים בחוק.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'אביב זכאי לעיין רק בחומר החקירה שהתביעה מתכוונת להגיש כראיה במשפט.', false, 'טענה זו שגויה. זכות העיון רחבה יותר וכוללת את כל חומר החקירה שנאסף, גם אם התביעה אינה מתכוונת להגישו כראיה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'אביב זכאי לעיין בסרטון רק אם בית המשפט יורה על כך, לאחר שהתביעה תנמק מדוע יש לאפשר לו לעיין.', false, 'טענה זו שגויה. זכות העיון היא זכות יסוד של הנאשם, ואינה תלויה בצו בית משפט או בנימוקי התביעה, אלא אם מדובר בחריגים המפורטים בחוק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'אביב אינו זכאי לעיין בסרטון, שכן הוא עלול לשבש את החקירה.', false, 'טענה זו שגויה. שיבוש חקירה הוא עילה אפשרית למניעת עיון בחומר מסוים, אך אינו שולל את זכות העיון באופן גורף.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 34, '2022-S-Q34';
END
$$;

-- ============================================================
-- Q35 — 2022-S-Q35 — chapter=criminal_proc subtopic=search_seizure
-- classifier_note: Emergency wiretap without warrant — search/seizure/surveillance
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd7769a80-5285-4b25-839a-0d53bbb340aa'::uuid;
  v_group_id uuid := '5ef3b196-cec5-419b-8afa-db3bea5fc6df'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '8409759e-b339-45f9-8f31-813a2f3dbb30'::uuid;
  v_ang_1 uuid := '5b856649-e056-4c0a-99d9-ab7c3b4be6f6'::uuid;
  v_ang_2 uuid := '33b961ac-607c-48e3-b679-41bf6211b4cd'::uuid;
  v_ang_3 uuid := 'b914afe1-32eb-4594-b8d8-26e3c3a82928'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q35';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 35, '2022-S-Q35';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'search_seizure' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'search_seizure', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q35', v_chapter_id, v_subtopic_id, 'במהלך חקירה דחופה בעבירת השוד עלה צורך מיידי לבצע האזנת סתר לחשוד המרכזי לצורך פענוח השוד, ואין שהות מספקת לפנות לבית המשפט לקבלת צו. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 35}'::jsonb, 'השאלה עוסקת בסמכות להתיר האזנת סתר במקרים דחופים, כאשר אין שהות לפנות לבית המשפט. היא בוחנת את הוראת סעיף 7 לחוק האזנת סתר, המקנה סמכות זו למפקח הכללי של המשטרה, תוך קביעת תנאים ומועדים קשיחים.', 'סעיף 7(א) לחוק האזנת סתר, תשל"ט-1979, קובע כי אם שוכנע המפקח הכללי של המשטרה כי לשם מניעת פשע או גילוי מבצעיו יש צורך בהאזנת סתר שאיננה סובלת דיחוי וכי אין סיפק לקבל בעוד מועד היתר לפי סעיף 6, רשאי הוא להתיר בכתב את ההאזנה. ההיתר יכלול פרטים כאמור בסעיף 6(ד) ומשך תקפו לא יעלה על ארבעים ושמונה שעות. הוראה זו מהווה חריג לכלל המחייב קבלת היתר מבית המשפט המחוזי (סעיף 6), ומיועדת למקרים דחופים במיוחד. בנוסף, סעיף 7(ב) מחייב את המפקח הכללי להודיע על ההיתר בכתב מיד ליועץ המשפטי לממשלה, אשר רשאי לבטל את ההיתר. ראו לעניין זה חוק האזנת סתר, תשל"ט-1979 סעיף 7.', 'בלבול בין סמכות נשיא בית המשפט המחוזי (או סגנו) למתן היתר רגיל (סעיף 6) לבין סמכות המפקח הכללי של המשטרה למתן היתר דחוף (סעיף 7).',
    '["חוק האזנת סתר", "האזנת סתר דחופה", "סמכות המפקח הכללי", "דרישת כתב", "מניעת פשע", "גילוי עבריינים"]'::jsonb, '**וריאציה 1 — סמכות במקרה דחוף:** מי מוסמך להתיר האזנת סתר במקרה דחוף כשאין שהות לפנות לביהמ"ש? ← המפקח הכללי של המשטרה (סעיף 7(א)).
**וריאציה 2 — תנאי ההיתר הדחוף:** מהם התנאים להיתר דחוף? ← צורך למניעת פשע/גילוי מבצעיו, אינו סובל דיחוי, אין סיפק לקבל היתר מביהמ"ש, ההיתר בכתב ול-48 שעות (סעיף 7(א)).
**וריאציה 3 — הודעה ליועמ"ש:** האם יש חובה להודיע ליועץ המשפטי לממשלה? ← כן, מיד ובכתב, והוא רשאי לבטל את ההיתר (סעיף 7(ב)).', 'האזנת סתר דחופה ← מפקח כללי של המשטרה ← בכתב, ל-48 שעות, הודעה ליועמ"ש.', '["חוק האזנת סתר, תשל\"ט-1979: סע'' 7"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''הליכים'' → mapped chapter=''criminal_proc'' subtopic=''search_seizure'' | classifier_note: Emergency wiretap without warrant — search/seizure/surveillance', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'קצין החקירות הממונה רשאי להתיר את האזנת הסתר בכתב.', false, 'טענה זו שגויה. הסמכות להתיר האזנת סתר דחופה אינה נתונה לקצין החקירות הממונה, אלא למפקח הכללי של המשטרה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'קצין החקירות הממונה, ובהיעדרו קצין תורן אזורי, רשאים להתיר את האזנת הסתר בכתב.', false, 'טענה זו שגויה. הסמכות להתיר האזנת סתר דחופה נתונה למפקח הכללי של המשטרה בלבד, ולא לקצין תורן אזורי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'המפקח הכללי של המשטרה רשאי להתיר את האזנת הסתר בכתב.', true, 'זוהי התשובה הנכונה. סעיף 7(א) לחוק האזנת סתר קובע כי המפקח הכללי של המשטרה רשאי להתיר בכתב האזנת סתר במקרים דחופים, בתנאים מסוימים.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא ניתן להתיר את האזנת הסתר בנסיבות אלה.', false, 'טענה זו שגויה. חוק האזנת סתר מאפשר להתיר האזנת סתר במקרים דחופים, גם ללא צו בית משפט, באמצעות המפקח הכללי של המשטרה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'תנאים להאזנת סתר במקרים דחופים',
    1, 'המפקח הכללי של המשטרה התיר האזנת סתר דחופה לחשוד בעבירת גניבה, בטענה שאין שהות לפנות לבית המשפט. האם ההיתר תקף?', 'שאלה זו בוחנת את התנאים המהותיים למתן היתר האזנת סתר דחופה על ידי המפקח הכללי של המשטרה, ובפרט את דרישת סוג העבירה. היא מדגישה כי סמכות זו מוגבלת לעבירות מסוג ''פשע'' ולא לכל עבירה.', 'סעיף 7(א) לחוק האזנת סתר, תשל"ט-1979, קובע כי המפקח הכללי רשאי להתיר האזנה דחופה ''לשם מניעת פשע או גילוי מבצעיו''. עבירת גניבה (סעיף 384 לחוק העונשין) יכולה להיות עוון או פשע, תלוי בשווי הגניבה ובנסיבותיה. אם מדובר בגניבה שהיא עוון, ההיתר אינו תקף. חוק האזנת סתר מבחין בין עבירות מסוג ''פשע'' (סעיף 6) לבין עבירות אחרות, וסעיף 7 מתייחס במפורש ל''פשע''. ראו ע"פ 4291/91 מדינת ישראל נ'' עלי אל מצרי (25.10.1993) וכן ב"ש (מחוזי תל אביב-יפו) 90868/00 חב'' נטוויזן בע"מ נ'' צבא הגנה לישראל - משטרת צבאית - חקירות - היחידה הארצית לחקירות מיוחדות (22.6.2000).',
    'אי-הבחנה בין סוגי עבירות (פשע/עוון) והשפעתן על סמכות מתן היתר האזנת סתר.', '["חוק האזנת סתר", "סעיף 7", "פשע", "עוון", "סמכות המפקח הכללי", "דחיפות"]'::jsonb, '**וריאציה 1 — סוג העבירה:** האם המפקח הכללי יכול להתיר האזנה דחופה לכל עבירה? ← לא, רק לשם מניעת פשע או גילוי מבצעיו (סעיף 7(א)).
**וריאציה 2 — גניבה:** האם גניבה היא תמיד פשע? ← לא, תלוי בנסיבות ובשווי הגניבה (חוק העונשין).
**וריאציה 3 — רציונל:** מדוע יש הגבלה לסוג העבירה? ← האזנת סתר היא פגיעה חמורה בפרטיות, ולכן מוגבלת לעבירות חמורות (פשע) (ע"פ אל מצרי, ב"ש נטוויזן).', 'האזנת סתר דחופה ← רק לפשע ← לא לכל גניבה.',
    '["חוק האזנת סתר, תשל\"ט-1979: סע'' 7(א)", "חוק העונשין, תשל\"ז-1977: סע'' 384", "ע\"פ 4291/91 מדינת ישראל נ'' עלי אל מצרי (25.10.1993)", "ב\"ש (מחוזי תל אביב-יפו) 90868/00 חב'' נטוויזן בע\"מ נ'' צבא הגנה לישראל - משטרת צבאית - חקירות - היחידה הארצית לחקירות מיוחדות (22.6.2000)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'כן, המפקח הכללי רשאי להתיר האזנת סתר לכל עבירה במקרים דחופים.', false, 'טענה זו שגויה. סעיף 7(א) לחוק האזנת סתר מגביל את סמכות המפקח הכללי לעבירות מסוג ''פשע'' בלבד.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא, מכיוון שהאזנת סתר דחופה מותרת רק לשם מניעת פשע או גילוי מבצעיו, וגניבה אינה בהכרח פשע.', true, 'זוהי התשובה הנכונה. סעיף 7(א) לחוק האזנת סתר מתיר האזנה דחופה רק לשם מניעת פשע או גילוי מבצעיו. גניבה יכולה להיות עוון או פשע, ורק אם היא פשע, ההיתר יכול להיות תקף.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'כן, בתנאי שההיתר ניתן בכתב ומשך תקפו אינו עולה על 48 שעות.', false, 'טענה זו שגויה. למרות שהתנאים הללו נכונים, הם אינם מספיקים אם העבירה אינה מסוג פשע.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לא, מכיוון שגם במקרים דחופים, נדרש אישור של היועץ המשפטי לממשלה מראש.', false, 'טענה זו שגויה. היועץ המשפטי לממשלה מקבל הודעה בדיעבד ורשאי לבטל את ההיתר, אך אינו נדרש לאשר מראש.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'דרישת הכתב בהסמכה להאזנת סתר',
    2, 'נשיא בית המשפט המחוזי הסמיך בעל פה את סגניתו ליתן היתרים להאזנות סתר. האם הסמכה זו תקפה?', 'שאלה זו עוסקת בדרישת הכתב להסמכת סגן נשיא בית משפט מחוזי ליתן היתרים להאזנת סתר. היא בוחנת את הוראת סעיף 6 לחוק האזנת סתר ואת סעיף 42 לחוק בתי המשפט, ומדגישה את עמדת הפסיקה לפיה הסמכה זו אינה חייבת להיות בכתב, בניגוד לדרישות כתב אחרות בחוק.', 'סעיף 6(א) לחוק האזנת סתר, תשל"ט-1979, קובע כי נשיא בית משפט מחוזי, או סגן הנשיא שהסמיכו הנשיא לעניין זה, רשאי ליתן היתר. סעיף 14(ב) לחוק האזנת סתר מפנה לסעיף 42 לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, העוסק בהאצלת סמכויות הנשיא לסגניו, וסעיף זה אינו דורש שההאצלה תהיה בכתב. הפסיקה, כפי שנקבע בע"פ 2996/09 פלוני נ'' מדינת ישראל (11.5.2011) ובתפ"ח (מחוזי ת"א) 1226/04 מדינת ישראל נ'' מוחמד בן ג''מיל שורפי (14.9.2008), קבעה כי הסמכה זו יכולה להינתן בעל פה, למרות שרצוי שתהיה בכתב מטעמי ממשל תקין. תקנה 2 לתקנות האזנת סתר, הדורשת כתב, מתייחסת להסמכה הניתנת על ידי ''רשות מוסמכת'' לגורמי הרשות, ולא להסמכה של נשיא בית משפט מחוזי לסגנו.',
    'הנחה שכל הסמכה או היתר חייבים להיות בכתב, מבלי להבחין בין סוגי הסמכות והוראות החוק הספציפיות.', '["חוק האזנת סתר", "סעיף 6", "חוק בתי המשפט", "סעיף 42", "הסמכה בעל פה", "דרישת כתב", "האצלת סמכויות"]'::jsonb, '**וריאציה 1 — הסמכת סגן נשיא:** האם הסמכת נשיא מחוזי לסגנו חייבת להיות בכתב? ← לא, יכולה להיות בעל פה (ע"פ פלוני, תפ"ח שורפי).
**וריאציה 2 — רציונל:** מדוע אין דרישת כתב מפורשת? ← סעיף 42 לחוק בתי המשפט שותק בעניין, ותכלית החוק אינה מחייבת זאת (ע"פ פלוני).
**וריאציה 3 — המלצה:** האם רצוי שההסמכה תהיה בכתב? ← כן, מטעמי ממשל תקין ומניעת ספקות (ע"פ פלוני).', 'הסמכת סגן נשיא להאזנת סתר ← אינה חייבת בכתב ← אך רצוי מטעמי ממשל תקין.',
    '["חוק האזנת סתר, תשל\"ט-1979: סע'' 6(א), 14(ב)", "חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 42", "תקנות האזנת סתר, תשמ\"ו-1986: תקנה 2", "ע\"פ 2996/09 פלוני נ'' מדינת ישראל (11.5.2011)", "תפ\"ח (מחוזי ת\"א) 1226/04 מדינת ישראל נ'' מוחמד בן ג''מיל שורפי (14.9.2008)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'כן, הסמכה של נשיא בית משפט מחוזי לסגנו ליתן היתרים להאזנת סתר אינה חייבת להיות בכתב, אלא יכולה להינתן בעל פה.', true, 'זוהי התשובה הנכונה. הפסיקה קבעה כי הסמכה זו אינה חייבת להיות בכתב, למרות שרצוי שתהיה בכתב מטעמי ממשל תקין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לא, כל הסמכה למתן היתר האזנת סתר חייבת להינתן בכתב, שכן מדובר בפגיעה בזכות חוקתית לפרטיות.', false, 'טענה זו שגויה. למרות חשיבות הזכות לפרטיות, הפסיקה קבעה כי הסמכה זו אינה חייבת להיות בכתב.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'כן, אך רק אם ההסמכה ניתנה לפני שנת 1995, שכן לאחר מכן תוקן החוק ודורש הסמכה בכתב.', false, 'טענה זו שגויה. התיקון לחוק בשנת 1995 שינה את הגורם המוסמך (מנשיא תורן לסגן נשיא שהוסמך), אך לא קבע דרישת כתב מפורשת להסמכה זו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לא, תקנה 2 לתקנות האזנת סתר דורשת כי כל הסמכה לעניין החוק תהיה מראש ובכתב.', false, 'טענה זו שגויה. תקנה 2 מתייחסת להסמכה הניתנת על ידי ''רשות מוסמכת'' לגורמי הרשות, ולא להסמכה של נשיא בית משפט מחוזי לסגנו.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'האזנת סתר ברשות הרבים',
    3, 'במהלך חקירה, קצין משטרה מוסמך הורה לשוטר להאזין לשיחה בין שני חשודים בתא מעצר בתחנת המשטרה, ללא קבלת היתר מבית המשפט. האם האזנה זו קבילה כראיה?', 'שאלה זו עוסקת בחריג לכלל הדורש היתר להאזנת סתר, והוא האזנה ברשות הרבים, כפי שמעוגן בסעיף 8(1)(ב) לחוק האזנת סתר. היא בוחנת את הפרשנות למונח ''רשות הרבים'' בהקשר של תא מעצר, ואת התנאים להסמכה הנדרשת מקצין משטרה מוסמך במקרים אלו.', 'סעיף 8(1)(ב) לחוק האזנת סתר, תשל"ט-1979, קובע כי האזנה לשיחה ברשות הרבים, שנעשתה ''בידי מי שהסמיכו לכך קצין משטרה מוסמך, לשם מניעת עבירות או גילוי עבריינים'', אינה טעונה היתר לפי החוק. הסיפא של סעיף 8(1) מבהירה כי ''רשות הרבים'' כוללת ''מקום שבו מוחזק אותה שעה עצור או אסיר''. לכן, האזנה בתא מעצר, אם נעשתה על ידי מי שהוסמך לכך על ידי קצין משטרה מוסמך ולשם מניעת עבירות או גילוי עבריינים, קבילה כראיה. הפסיקה קבעה כי ההסמכה אינה חייבת להיות בכתב או לשיחה ספציפית, אלא יכולה להיות כללית לפעולה מסוימת, ובלבד שקצין המשטרה המוסמך שקל את הנסיבות. ראו ת"פ (מחוזי נצרת) 332/79 מדינת ישראל נ'' יוסף בן יעקב כהן (30.3.1980), וכן ת"פ (מחוזי י-ם) 37260-08-11 מדינת ישראל נ'' ברק סגל (23.1.2014).',
    'הנחה שכל האזנה, גם בתא מעצר, דורשת היתר מבית המשפט, או אי-הבנה של היקף החריג הקבוע בסעיף 8(1)(ב) לחוק האזנת סתר.', '["חוק האזנת סתר", "סעיף 8(1)(ב)", "רשות הרבים", "תא מעצר", "קצין משטרה מוסמך", "קבילות ראיות"]'::jsonb, '**וריאציה 1 — רשות הרבים:** האם תא מעצר נחשב ל''רשות הרבים'' לעניין האזנת סתר? ← כן (סעיף 8(1) סיפא).
**וריאציה 2 — תנאי האזנה:** מהם התנאים להאזנה בתא מעצר ללא היתר? ← בידי מי שהוסמך ע"י קצין משטרה מוסמך, לשם מניעת עבירות/גילוי עבריינים (סעיף 8(1)(ב)).
**וריאציה 3 — דרישת כתב להסמכה:** האם ההסמכה חייבת להיות בכתב? ← לא, אך רצוי (ת"פ כהן).', 'האזנה בתא מעצר ← נחשבת ברשות הרבים ← מותרת בהסמכת קצין מוסמך ללא צו.',
    '["חוק האזנת סתר, תשל\"ט-1979: סע'' 8(1)(ב)", "ת\"פ (מחוזי נצרת) 332/79 מדינת ישראל נ'' יוסף בן יעקב כהן (30.3.1980)", "ת\"פ (מחוזי י-ם) 37260-08-11 מדינת ישראל נ'' ברק סגל (23.1.2014)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, מכיוון שתא מעצר נחשב ל''רשות הרבים'' לעניין חוק האזנת סתר, וקצין משטרה מוסמך רשאי להתיר האזנה כזו.', true, 'זוהי התשובה הנכונה. סעיף 8(1)(ב) לחוק האזנת סתר פוטר האזנה ברשות הרבים מהצורך בהיתר, ו''רשות הרבים'' כוללת מקום שבו מוחזק עצור או אסיר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, מכיוון שגם בתא מעצר, שיחות בין חשודים חוסות תחת הזכות לפרטיות ודורשות היתר מבית המשפט.', false, 'טענה זו שגויה. סעיף 8(1)(ב) לחוק האזנת סתר קובע חריג מפורש לעניין זה, המאפשר האזנה ללא היתר בתא מעצר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אך רק אם ההסמכה של קצין המשטרה המוסמך ניתנה בכתב ולשיחה ספציפית.', false, 'טענה זו שגויה. הפסיקה קבעה כי ההסמכה לפי סעיף 8(1)(ב) אינה חייבת להיות בכתב, ואינה חייבת להיות לשיחה ספציפית, אלא יכולה להיות כללית לפעולה מסוימת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, מכיוון שהאזנה בתא מעצר מהווה ''תרגיל חקירה'' שאינו קביל כראיה.', false, 'טענה זו שגויה. האזנה בתא מעצר יכולה להיות קבילה כראיה אם היא עומדת בתנאי סעיף 8(1)(ב) לחוק האזנת סתר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'קבילות ראיות שהושגו בניגוד לחוק האזנת סתר',
    4, 'האזנת סתר בוצעה לחשוד בעבירת סמים ללא היתר כדין. האם הראיות שהושגו באמצעות האזנה זו קבילות בבית המשפט?', 'שאלה זו עוסקת בכלל הפסילה המנדטורי הקבוע בסעיף 13(א) לחוק האזנת סתר, לפיו ראיות שהושגו בניגוד להוראות החוק אינן קבילות בבית המשפט. היא מדגישה את אופיו המחמיר של כלל זה, המהווה חריג לגישה הכללית במשפט הישראלי לפיה ראיה שהושגה שלא כדין אינה נפסלת אוטומטית.', 'סעיף 13(א) לחוק האזנת סתר, תשל"ט-1979, קובע מפורשות כי ''דברים שנקלטו בדרך האזנת סתר בניגוד להוראות חוק זה, לא יהיו קבילים כראיה בבית משפט''. הוראה זו מהווה כלל פסילה מנדטורי, שאינו מותיר שיקול דעת לבית המשפט, למעט חריגים ספציפיים המפורטים בסעיף 13(א)(1) ו-13(א)(2) (שאינם רלוונטיים לשאלה זו). כלל זה משקף את חשיבות ההגנה על הזכות לפרטיות. הפסיקה הדגישה את אופיו המנדטורי של כלל הפסילה, וכי הוא אינו מאמץ במלואו את תורת ''פירות העץ המורעל'' האמריקאית, אך משקף תפיסה דומה. ראו ע"פ 1302/92 מדינת ישראל נ'' מרדכי בן ריימונד נחמיאס (21.6.1995). יש להבחין בין סעיף 13(א) לבין סעיף 13(ג1) לחוק, הקובע כי דברים שנקלטו כדין בהאזנת סתר יהיו קבילים כראיה להוכחת כל עבירה, אך זה אינו המקרה כאן.',
    'הנחה שבית המשפט רשאי לאזן בין חקר האמת לבין הפגיעה בפרטיות גם במקרים של האזנת סתר בלתי חוקית, מבלי להכיר בכלל הפסילה המנדטורי שבסעיף 13(א).', '["חוק האזנת סתר", "סעיף 13(א)", "קבילות ראיות", "פסילת ראיות", "זכות לפרטיות", "פירות העץ המורעל"]'::jsonb, '**וריאציה 1 — האזנה ללא היתר:** האם ראיות מהאזנת סתר ללא היתר קבילות? ← לא, כלל פסילה מנדטורי (סעיף 13(א)).
**וריאציה 2 — שיקול דעת בית המשפט:** האם לבית המשפט שיקול דעת לקבלן? ← לא, למעט חריגים מפורשים בחוק (סעיף 13(א)).
**וריאציה 3 — תכלית הכלל:** מהי תכלית כלל הפסילה? ← להגן על הזכות לפרטיות ולהרתיע רשויות מפני האזנות בלתי חוקיות (ע"פ נחמיאס).', 'ראיות מהאזנת סתר בלתי חוקית ← פסולות קבילות ← כלל מנדטורי (סעיף 13(א)).',
    '["חוק האזנת סתר, תשל\"ט-1979: סע'' 13(א)", "ע\"פ 1302/92 מדינת ישראל נ'' מרדכי בן ריימונד נחמיאס (21.6.1995)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'לא, דברים שנקלטו בדרך האזנת סתר בניגוד להוראות החוק אינם קבילים כראיה בבית המשפט, למעט חריגים מוגדרים.', true, 'זוהי התשובה הנכונה. סעיף 13(א) לחוק האזנת סתר קובע כלל פסילה מנדטורי לראיות שהושגו בניגוד לחוק, למעט חריגים ספציפיים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'כן, בית המשפט רשאי לקבל את הראיות אם שוכנע כי חשיבותן לחקר האמת עולה על הפגיעה בפרטיות.', false, 'טענה זו שגויה. סעיף 13(א) קובע כלל פסילה מנדטורי, ואינו מותיר שיקול דעת לבית המשפט לאזן בין חקר האמת לפגיעה בפרטיות, אלא אם מדובר בחריגים המפורטים בחוק.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'כן, אם ההאזנה בוצעה בתום לב על ידי המשטרה, מתוך אמונה שהיא פועלת כדין.', false, 'טענה זו שגויה. תום לב של המשטרה אינו מהווה עילה לקבלת ראיה שהושגה בניגוד להוראות חוק האזנת סתר, שכן כלל הפסילה הוא מנדטורי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'לא, אלא אם כן הוגש כתב אישום בגין עבירה מסוג פשע, ואז הראיות קבילות.', false, 'טענה זו שגויה. סוג העבירה אינו משפיע על קבילות ראיה שהושגה בניגוד להוראות החוק, אלא אם מדובר בחריגים ספציפיים הקבועים בסעיף 13(ג1) לחוק.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 35, '2022-S-Q35';
END
$$;

-- ============================================================
-- Q36 — 2022-S-Q36 — chapter=evidence subtopic=institutional_record
-- classifier_note: Bank's institutional record as evidence in fraud trial
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'f8beb49c-320d-4611-8232-6893adb981e2'::uuid;
  v_group_id uuid := 'a00c8e60-b101-4713-9e2b-9028b0d5c638'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'e442ea8c-f165-4ae9-913c-20a5c286a6d2'::uuid;
  v_ang_1 uuid := '8b89cb53-f05c-41a1-9e5c-baa9ea392791'::uuid;
  v_ang_2 uuid := '5fa3bf02-11c5-4f82-b639-d228ee463b22'::uuid;
  v_ang_3 uuid := '1179dec3-40c6-49eb-a8d0-1cc6921b21f1'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q36';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 36, '2022-S-Q36';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'evidence';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'evidence';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'institutional_record' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'institutional_record', 'evidence';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q36', v_chapter_id, v_subtopic_id, 'נגד שחר הוגש כתב אישום בגין עבירות הונאה. התביעה מעוניינת להגיש לבית המשפט רשומה מוסדית של תאגיד בנקאי לתמיכה בטענותיה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 36}'::jsonb, 'השאלה עוסקת בהגשת רשומה מוסדית של תאגיד בנקאי כראיה במשפט פלילי. היא מתמקדת בהוראות סעיפים 39 ו-41א לפקודת הראיות, המאפשרות הגשת העתק צילומי של הרשומה וקובעות כי אין חובה שהעד המגיש יהיה בנקאי או פקיד של התאגיד, אלא כל אדם הבקיא בדרך עריכת הרשומה.', 'סעיף 41א(א) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע כי ''העתק צילומי של רשומה מוסדית יהיה קביל כראיה כמו המקור''. הוראה זו מייתרת את הצורך בהגשת המסמך המקורי ומאפשרת שימוש בהעתקים צילומיים, דבר המקל על הליכי המשפט. בנוסף, סעיף 39(א) לפקודה קובע כי רשומה מוסדית תהיה קבילה כראיה אם הוכח שהיא נערכה במהלך הרגיל של פעילות המוסד, במועד סמוך להתרחשות המתועדת, ושהמוסד נוהג דרך קבע לערוך רשומות מסוג זה. ההוכחה לתנאים אלו יכולה להיעשות על ידי ''אדם הבקיא בדרך עריכת הרשומה'', ואין חובה שיהיה זה בנקאי או פקיד של התאגיד הבנקאי דווקא. ראו פקודת הראיות [נוסח חדש], תשל"א-1971, סעיפים 39, 41א.', 'הנחה שנדרשת הגשת המקור של רשומה מוסדית, או שרק עובד ספציפי של המוסד יכול להעיד עליה, מבלי להכיר את ההקלות הקבועות בפקודת הראיות.',
    '["רשומה מוסדית", "פקודת הראיות", "העתק צילומי", "עד מגיש", "קבילות ראיות", "תאגיד בנקאי"]'::jsonb, '**וריאציה 1 — הגשת העתק:** האם ניתן להגיש העתק צילומי של רשומה בנקאית? ← כן, סעיף 41א(א) לפקודת הראיות.
**וריאציה 2 — זהות העד:** מי יכול להעיד על רשומה בנקאית? ← כל אדם הבקיא בדרך עריכת הרשומה, לאו דווקא בנקאי (סעיף 39(א)).
**וריאציה 3 — תנאי קבילות:** מהם התנאים לקבילות הרשומה עצמה? ← נערכה במהלך רגיל, במועד סמוך, ונוהג קבוע (סעיף 39(א)).', 'רשומה מוסדית בנקאית ← הגשת העתק צילומי מותרת ← עד מגיש: כל בקיא, לאו דווקא בנקאי.', '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 39, 41א"]'::jsonb,
    'classification_review: original chapter=''דיני ראיות'' subtopic=''רשומה מוסדית'' → mapped chapter=''evidence'' subtopic=''institutional_record'' | classifier_note: Bank''s institutional record as evidence in fraud trial', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על התביעה להגיש את הראיה המקורית בלבד, והעד המגיש יהיה בנקאי או פקיד של התאגיד הבנקאי.', false, 'טענה זו שגויה. סעיף 41א(א) לפקודת הראיות מאפשר הגשת העתק צילומי של רשומה מוסדית, וסעיף 39(א) קובע כי אין חובה שהעד המגיש יהיה בנקאי או פקיד של התאגיד הבנקאי.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על התביעה להגיש את הראיה המקורית בלבד, והעד המגיש לא יהיה בהכרח בנקאי או פקיד של התאגיד הבנקאי.', false, 'טענה זו שגויה. סעיף 41א(א) לפקודת הראיות מאפשר הגשת העתק צילומי של רשומה מוסדית, ולא רק את המקור.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'התביעה רשאית להגיש העתק צילומי של הראיה, והעד המגיש יהיה בנקאי או פקיד של התאגיד הבנקאי.', false, 'טענה זו שגויה. למרות שהגשת העתק צילומי מותרת, אין חובה שהעד המגיש יהיה בנקאי או פקיד של התאגיד הבנקאי, אלא כל אדם הבקיא בדרך עריכת הרשומה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'התביעה רשאית להגיש העתק צילומי של הראיה, והעד המגיש לא יהיה בהכרח בנקאי או פקיד של התאגיד הבנקאי.', true, 'זוהי התשובה הנכונה. סעיף 41א(א) לפקודת הראיות מתיר הגשת העתק צילומי של רשומה מוסדית, וסעיף 39(א) קובע כי די בעדותו של אדם הבקיא בדרך עריכת הרשומה, ואין חובה שיהיה בנקאי או פקיד.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'הגשת רשומה מוסדית של גוף ציבורי',
    1, 'התביעה מעוניינת להגיש לבית המשפט רשומה מוסדית של עירייה (למשל, פרוטוקול ישיבת מועצה) לתמיכה בטענותיה. מה הדין לגבי הגשת ראיה זו?', 'שאלה זו מרחיבה את תחולת דיני הרשומה המוסדית לגופים ציבוריים, ומדגישה כי הכללים לגבי הגשת העתק צילומי וזהות העד המגיש חלים באופן דומה על כל רשומה מוסדית, בין אם היא של תאגיד בנקאי ובין אם של עירייה או גוף ציבורי אחר.', 'ההוראות הקבועות בסעיפים 39 ו-41א לפקודת הראיות [נוסח חדש], תשל"א-1971, העוסקות ברשומה מוסדית ובהגשת העתק צילומי שלה, חלות באופן כללי על כל ''רשומה מוסדית''. המונח ''מוסד'' מוגדר בסעיף 35 לפקודה באופן רחב וכולל ''מדינה, רשות מקומית, עסק או כל מיזם אחר, וכן כל גוף או מוסד, ציבורי או פרטי''. לפיכך, עירייה נכללת בהגדרה זו. סעיף 41א(א) מתיר הגשת העתק צילומי, וסעיף 39(א) קובע כי די בעדותו של אדם הבקיא בדרך עריכת הרשומה, ואין חובה שיהיה עובד העירייה דווקא. ראו לעניין זה פקודת הראיות [נוסח חדש], תשל"א-1971, סעיפים 35, 39, 41א.',
    'הנחה שקיימים כללים שונים להגשת רשומות מוסדיות מגופים שונים (בנקאיים מול ציבוריים), מבלי להבין את ההגדרה הרחבה של ''מוסד'' בפקודת הראיות.', '["רשומה מוסדית", "פקודת הראיות", "גוף ציבורי", "העתק צילומי", "עד מגיש", "הגדרת מוסד"]'::jsonb, '**וריאציה 1 — תחולה כללית:** האם הכללים לרשומה מוסדית חלים גם על עירייה? ← כן, עירייה היא ''מוסד'' לפי סעיף 35 לפקודת הראיות.
**וריאציה 2 — הגשת העתק:** האם ניתן להגיש העתק צילומי של פרוטוקול עירייה? ← כן, לפי סעיף 41א(א).
**וריאציה 3 — זהות העד:** מי יכול להעיד על פרוטוקול עירייה? ← כל אדם הבקיא בדרך עריכת הרשומה, לאו דווקא עובד עירייה (סעיף 39(א)).', 'רשומה מוסדית (עירייה) ← הגשת העתק צילומי מותרת ← עד מגיש: כל בקיא, לאו דווקא עובד עירייה.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 35, 39, 41א"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'התביעה רשאית להגיש העתק צילומי של הראיה, והעד המגיש לא יהיה בהכרח עובד עירייה, אלא כל אדם הבקיא בדרך עריכת הרשומה.', true, 'זוהי התשובה הנכונה. סעיפים 39 ו-41א לפקודת הראיות חלים על כל רשומה מוסדית, בין אם של תאגיד בנקאי ובין אם של גוף ציבורי כמו עירייה, ומאפשרים הגשת העתק צילומי ועדות של אדם הבקיא בדרך עריכת הרשומה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'על התביעה להגיש את הראיה המקורית בלבד, והעד המגיש יהיה עובד עירייה הבקיא בדרך עריכת הרשומה.', false, 'טענה זו שגויה. סעיף 41א(א) לפקודת הראיות מתיר הגשת העתק צילומי, ואין חובה להגיש את המקור.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'התביעה רשאית להגיש העתק צילומי של הראיה, אך רק אם העירייה אישרה בכתב את נכונות ההעתק.', false, 'טענה זו שגויה. אין דרישה כזו בחוק להגשת רשומה מוסדית. די בעדות של אדם הבקיא בדרך עריכת הרשומה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'הגשת רשומה מוסדית של גוף ציבורי דורשת צו מיוחד מבית המשפט, שכן היא מכילה מידע רגיש.', false, 'טענה זו שגויה. אין דרישה לצו מיוחד מבית המשפט להגשת רשומה מוסדית של גוף ציבורי, אלא עמידה בתנאי סעיפים 39 ו-41א לפקודת הראיות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאים לקבילות רשומה מוסדית',
    2, 'מהם התנאים המצטברים לקבילותה של רשומה מוסדית כראיה בבית המשפט, על פי פקודת הראיות?', 'שאלה זו מתמקדת בתנאים המהותיים לקבילותה של רשומה מוסדית כראיה, כפי שנקבעו בסעיף 39(א) לפקודת הראיות. היא בוחנת את שלושת היסודות המצטברים: עריכה במהלך הרגיל של פעילות המוסד, במועד סמוך להתרחשות, ונוהג קבוע של המוסד לערוך רשומות מסוג זה, המבטיחים את אמינותה של הרשומה.', 'סעיף 39(א) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע שלושה תנאים מצטברים לקבילותה של רשומה מוסדית: (1) הרשומה נערכה במהלך הרגיל של פעילות המוסד; (2) עריכתה של הרשומה היא במועד סמוך להתרחשות המתועדת בה; (3) המוסד נוהג, דרך קבע, לערוך רשומות מסוג זה. תנאים אלו נועדו להבטיח את אמינותה של הרשומה, שכן היא נערכת כחלק משגרת העבודה ולא לצורך משפטי ספציפי. בנוסף, נדרשת עדות של אדם הבקיא בדרך עריכת הרשומה, אך אין חובה שיהיה לו ידע אישי על העובדות המתועדות. ראו פקודת הראיות [נוסח חדש], תשל"א-1971, סעיף 39(א).',
    'התבלבלות בין התנאים המהותיים לקבילות הרשומה לבין דרישות פרוצדורליות אחרות, או הנחה שנדרש ידע אישי של העד על תוכן הרשומה.', '["רשומה מוסדית", "פקודת הראיות", "קבילות ראיות", "מהלך רגיל של עסקים", "מועד סמוך", "נוהג קבוע"]'::jsonb, '**וריאציה 1 — תנאים מצטברים:** מהם התנאים לקבילות רשומה מוסדית? ← נערכה במהלך רגיל, במועד סמוך, ונוהג קבוע (סעיף 39(א)).
**וריאציה 2 — מטרת התנאים:** מדוע קיימים תנאים אלו? ← להבטיח את אמינות הרשומה, שכן היא נערכה בשגרה ולא לצורך משפטי.
**וריאציה 3 — זהות העד:** האם העד חייב להיות בעל ידע אישי על תוכן הרשומה? ← לא, די בבקיאות בדרך עריכתה (סעיף 39(א)).', 'קבילות רשומה מוסדית ← 3 תנאים מצטברים (סעיף 39(א)) ← מבטיחים אמינות.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 39(א)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'הרשומה נערכה במהלך הרגיל של פעילות המוסד, במועד סמוך להתרחשות המתועדת, והמוסד נוהג לערוך רשומות מסוג זה.', true, 'זוהי התשובה הנכונה. סעיף 39(א) לפקודת הראיות קובע שלושה תנאים מצטברים לקבילות רשומה מוסדית: עריכה במהלך הרגיל, במועד סמוך, ונוהג לערוך רשומות מסוג זה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'הרשומה נערכה על ידי עובד מוסמך של המוסד, והיא חתומה על ידו ומאושרת על ידי מנהל המוסד.', false, 'טענה זו שגויה. סעיף 39(א) אינו דורש חתימה או אישור מנהל, אלא עדות על דרך עריכת הרשומה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'הרשומה נערכה בכתב יד, והיא מקורית ולא העתק צילומי.', false, 'טענה זו שגויה. סעיף 41א(א) מתיר הגשת העתק צילומי, ואין דרישה לעריכה בכתב יד.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'הרשומה נערכה על ידי אדם בעל ידע אישי על העובדות המתועדות בה, והוא מעיד עליה בבית המשפט.', false, 'טענה זו שגויה. סעיף 39(א) מאפשר עדות של אדם הבקיא בדרך עריכת הרשומה, ואינו דורש ידע אישי על העובדות המתועדות בה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'הגשת רשומה מוסדית באמצעות תצהיר',
    3, 'התביעה מעוניינת להגיש רשומה מוסדית של תאגיד בנקאי, אך אינה רוצה להביא עד לבית המשפט. האם ניתן להגיש את הרשומה באמצעות תצהיר של אדם הבקיא בדרך עריכתה?', 'שאלה זו עוסקת בחריג לכלל הדורש עדות פרונטלית, והוא האפשרות להגיש רשומה מוסדית באמצעות תצהיר, כפי שמעוגן בסעיף 39(ב) לפקודת הראיות. היא מדגישה את התנאים להגשה כזו, ובפרט את זכותו של הצד שכנגד לדרוש חקירה נגדית של המצהיר.', 'סעיף 39(ב) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע כי ''רשומה מוסדית תהא קבילה אף אם הוגשה באמצעות תצהיר של אדם הבקיא בדרך עריכתה, ובלבד שניתנה לצד שכנגד הזדמנות לחקור את המצהיר''. הוראה זו נועדה לייעל את הליכי המשפט ולאפשר הגשת רשומות מוסדיות ללא צורך בהבאת עד לבית המשפט, תוך שמירה על זכותו של הצד שכנגד לחקירה נגדית. אם הצד שכנגד לא דרש לחקור את המצהיר, התצהיר ישמש כראיה קבילה. ראו פקודת הראיות [נוסח חדש], תשל"א-1971, סעיף 39(ב).',
    'הנחה שכל ראיה חייבת להיות מוצגת באמצעות עדות פרונטלית, או אי-הבנה של האפשרות להגיש רשומה מוסדית באמצעות תצהיר והתנאים לכך.', '["רשומה מוסדית", "פקודת הראיות", "הגשת ראיות", "תצהיר", "חקירה נגדית", "ייעול הליכים"]'::jsonb, '**וריאציה 1 — הגשה בתצהיר:** האם ניתן להגיש רשומה מוסדית בתצהיר? ← כן, לפי סעיף 39(ב) לפקודת הראיות.
**וריאציה 2 — תנאי להגשה בתצהיר:** מהו התנאי העיקרי להגשה בתצהיר? ← שתינתן לצד שכנגד הזדמנות לחקור את המצהיר (סעיף 39(ב)).
**וריאציה 3 — מטרת ההוראה:** מדוע קיימת אפשרות זו? ← לייעל את הליכי המשפט ולחסוך בהבאת עדים, תוך שמירה על זכות החקירה הנגדית.', 'רשומה מוסדית ← ניתן להגיש בתצהיר ← בכפוף לזכות חקירה נגדית.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 39(ב)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, ניתן להגיש רשומה מוסדית באמצעות תצהיר של אדם הבקיא בדרך עריכתה, וזאת בהתאם להוראות סעיף 39(ב) לפקודת הראיות.', true, 'זוהי התשובה הנכונה. סעיף 39(ב) לפקודת הראיות מאפשר הגשת רשומה מוסדית באמצעות תצהיר של אדם הבקיא בדרך עריכתה, במקום עדות פרונטלית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, רשומה מוסדית חייבת להיות מוצגת באמצעות עדות פרונטלית של אדם הבקיא בדרך עריכתה, ואין אפשרות להגישה בתצהיר.', false, 'טענה זו שגויה. סעיף 39(ב) לפקודת הראיות קובע חריג מפורש המאפשר הגשה באמצעות תצהיר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אך רק אם בית המשפט אישר זאת מראש, ולאחר שניתנה לצד שכנגד הזדמנות לחקור את המצהיר.', false, 'טענה זו שגויה. סעיף 39(ב) אינו דורש אישור מראש של בית המשפט, אלא קובע את הזכות לחקור את המצהיר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, אלא אם כן מדובר ברשומה מוסדית של גוף ציבורי, שאז ניתן להגישה בתצהיר.', false, 'טענה זו שגויה. סעיף 39(ב) חל על כל רשומה מוסדית, ללא הבחנה בין גוף בנקאי לציבורי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'הגשת תדפיס מחשב כראיה',
    4, 'התביעה מעוניינת להגיש לבית המשפט תדפיס מחשב של תנועות חשבון בנק של שחר. מה הדין לגבי הגשת ראיה זו?', 'שאלה זו עוסקת בקבילותו של תדפיס מחשב כראיה, נושא המוסדר בסעיף 42א לפקודת הראיות. היא מדגישה את התנאי המרכזי לקבילות – הוכחת תקינות פעולת המחשב – ואת העובדה שאין חובה להביא עד מומחה למחשבים לשם כך, אלא די בעדות על תקינות המערכת.', 'סעיף 42א(א) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע כי ''תדפיס מחשב יהיה ראיה קבילה בהליך משפטי אם הוכח שהמחשב פעל באופן תקין באותה עת, וכי התדפיס הופק מתוך נתונים שהוזנו למחשב במהלך הרגיל של פעילות המוסד''. אין חובה להביא עד מומחה למחשבים כדי להוכיח את תקינות המחשב, אלא די בעדות של אדם הבקיא בתפעול המערכת ובתקינותה. תדפיס מחשב של תנועות חשבון בנק נחשב לרשומה מוסדית, וקבילותו נבחנת גם לפי סעיף 39 לפקודה, אך סעיף 42א מתייחס ספציפית לתדפיסי מחשב. ראו פקודת הראיות [נוסח חדש], תשל"א-1971, סעיף 42א.',
    'הנחה שנדרשת עדות מומחה למחשבים להוכחת תקינות תדפיס מחשב, או אי-הבנה של ההבחנה בין רשומה מוסדית כללית לתדפיס מחשב ספציפי.', '["תדפיס מחשב", "פקודת הראיות", "קבילות ראיות", "תקינות מחשב", "עד מומחה", "רשומה מוסדית"]'::jsonb, '**וריאציה 1 — תנאי קבילות:** מהו התנאי העיקרי לקבילות תדפיס מחשב? ← הוכחה שהמחשב פעל באופן תקין (סעיף 42א(א)).
**וריאציה 2 — עדות מומחה:** האם נדרש עד מומחה למחשבים? ← לא, די בעדות על תקינות המחשב (סעיף 42א(א)).
**וריאציה 3 — קשר לרשומה מוסדית:** האם תדפיס מחשב הוא רשומה מוסדית? ← כן, והוא נבחן גם לפי סעיף 39, אך סעיף 42א ספציפי יותר.', 'תדפיס מחשב ← קביל אם הוכחה תקינות המחשב ← ללא צורך במומחה.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 42א"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'תדפיס מחשב קביל כראיה אם הוכח שהמחשב פעל באופן תקין, ואין חובה להביא עד מומחה למחשבים.', true, 'זוהי התשובה הנכונה. סעיף 42א(א) לפקודת הראיות קובע כי תדפיס מחשב קביל כראיה אם הוכח שהמחשב פעל באופן תקין, ואין דרישה לעדות מומחה למחשבים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'תדפיס מחשב קביל כראיה רק אם הוגש על ידי מומחה למחשבים שהעיד על תקינות המערכת.', false, 'טענה זו שגויה. סעיף 42א(א) אינו דורש עדות מומחה למחשבים, אלא די בעדות על תקינות המחשב.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'תדפיס מחשב אינו קביל כראיה, שכן הוא אינו נחשב ל''רשומה מוסדית'' או ל''מסמך מקורי''.', false, 'טענה זו שגויה. סעיף 42א לפקודת הראיות קובע במפורש את קבילותו של תדפיס מחשב כראיה, בכפוף לתנאים מסוימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'תדפיס מחשב קביל כראיה רק אם הוגש על ידי בנקאי או פקיד של התאגיד הבנקאי.', false, 'טענה זו שגויה. סעיף 42א אינו דורש שהעד המגיש יהיה בנקאי או פקיד, אלא כל אדם הבקיא בתקינות המחשב.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 36, '2022-S-Q36';
END
$$;

-- ============================================================
-- Q37 — 2022-S-Q37 — chapter=evidence subtopic=witness_competence
-- classifier_note: Two 10-year-old children testifying in sex-offense trial — child witness competence
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '17c3c92f-7419-4ee3-afd2-5029c8b62baa'::uuid;
  v_group_id uuid := 'c2b0b792-ca24-42ef-ad27-b757c0ea8407'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'afe8bc61-918d-4dcc-a672-816c9c426f1b'::uuid;
  v_ang_1 uuid := '756ba343-2a14-49ea-b9b3-37f23c96e4e3'::uuid;
  v_ang_2 uuid := '3a46ed38-f27c-4b42-afe2-5a9c4fbeb37f'::uuid;
  v_ang_3 uuid := '9be3eed8-9e4d-421f-9da1-963e804f0074'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q37';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 37, '2022-S-Q37';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'evidence';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'evidence';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'witness_competence' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'witness_competence', 'evidence';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q37', v_chapter_id, v_subtopic_id, 'גל מואשם בעבירות מין חמורות שביצע בשני ילדים בני 10 בנוכחות שניהם. עדי התביעה הם שני הילדים בלבד, והוחלט שהילדים יעידו בעצמם נגד גל כעדי התביעה. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 37}'::jsonb, 'השאלה עוסקת בדרישות התוספת הראייתית לעדות קטינים המעידים בבית המשפט, ובפרט בהבחנה בין ''עדות יחידה'' לבין עדות של מספר קטינים. היא מתמקדת בסעיף 55 לפקודת הראיות, הקובע דרישת ''חיזוק'' לעדות יחידה של קטין מתחת לגיל 12, ומבהירה כי כאשר שני קטינים מעידים, עדותם יכולה לחזק זו את זו, ובכך מתמלאת הדרישה לחיזוק ללא צורך בראיה חיצונית נוספת.', 'סעיף 55(ב) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע כי ''לא יורשע אדם על סמך עדות יחידה של קטין שאינו בר-אחריות פלילית בשל גילו, אלא אם כן יש בחומר הראיות דבר לחיזוקה''. גיל האחריות הפלילית בישראל הוא 12 שנים, ולכן ילדים בני 10 נחשבים כמי שאינם ברי-אחריות פלילית. עם זאת, הדרישה לחיזוק חלה על ''עדות יחידה''. במקרה זה, מדובר בשני ילדים המעידים, ועל פי הפסיקה, עדותו של קטין אחד יכולה לשמש חיזוק לעדותו של קטין אחר, וזאת גם אם שניהם קטינים. כך, למשל, נקבע בע"פ 7247/13 פלוני נ'' מדינת ישראל (9.12.2015) ובע"פ 4583/13 בנימין סץ נ'' מדינת ישראל (21.9.2015), כי עדות של קטין אחד יכולה לשמש תוספת ראייתית מסייעת (או מחזקת) לעדותו של קטין אחר, במיוחד בעבירות מין. לכן, במצב של שני עדים קטינים, עדותם ההדדית יכולה למלא את דרישת החיזוק, וניתן להרשיע את הנאשם על סמך עדויותיהם בלבד, ללא צורך בראיה חיצונית נוספת. ראו גם יניב ואקי דיני ראיות כרך ב (2020) | פרק 23 עד ילד או קטין.', 'הנחה שכל עדות קטין דורשת תוספת ראייתית חיצונית, מבלי להבחין בין ''עדות יחידה'' לבין מצב של מספר עדים קטינים שיכולים לחזק זה את זה.',
    '["פקודת הראיות", "סעיף 55", "עדות קטין", "גיל אחריות פלילית", "דבר לחיזוק", "עדות יחידה", "חיזוק הדדי"]'::jsonb, '**וריאציה 1 — ילד בן 10 מעיד:** האם עדות יחידה של ילד בן 10 דורשת חיזוק? ← כן, לפי סעיף 55(ב) לפקודת הראיות.
**וריאציה 2 — שני ילדים בני 10 מעידים:** האם עדותם דורשת חיזוק חיצוני? ← לא, עדותם יכולה לחזק זו את זו (ע"פ פלוני 3557211).
**וריאציה 3 — הבחנה בין חיזוק לסיוע:** מתי נדרש סיוע? ← כאשר קטין לא מעיד בביהמ"ש, אלא רק בפני חוקר ילדים (סעיף 11 לחוק הגנת ילדים).', 'ילדים בני 10 מעידים בביהמ"ש ← עדות יחידה דורשת חיזוק ← שני ילדים יכולים לחזק זה את זה ← ניתן להרשיע על סמך עדויותיהם בלבד.', '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 55", "חוק לתיקון דיני הראיות (הגנת ילדים), תשט\"ו-1955: סע'' 11", "ע\"פ 7247/13 פלוני נ'' מדינת ישראל (9.12.2015)", "ע\"פ 4583/13 בנימין סץ נ'' מדינת ישראל (21.9.2015)", "יניב ואקי דיני ראיות כרך ב (2020) | פרק 23 עד ילד או קטין"]'::jsonb,
    'classification_review: original chapter=''דיני ראיות'' subtopic=''כשרות עדים'' → mapped chapter=''evidence'' subtopic=''witness_competence'' | classifier_note: Two 10-year-old children testifying in sex-offense trial — child witness competence', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'לא ניתן להרשיע את גל על סמך עדותם של שני הילדים אלא אם יש בחומר הראיות סיוע.', false, 'טענה זו שגויה. דרישת הסיוע חלה על עדות קטין שנמסרה בפני חוקר ילדים אך הקטין לא העיד בבית המשפט (סעיף 11 לחוק הגנת ילדים), ולא על עדות קטין המעיד בבית המשפט.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לא ניתן להרשיע את גל על סמך עדותם של שני הילדים אלא אם יש בחומר הראיות דבר לחיזוק.', false, 'טענה זו שגויה. דרישת החיזוק חלה על ''עדות יחידה'' של קטין מתחת לגיל 12 (סעיף 55(ב) לפקודת הראיות). במקרה זה מדובר בשני ילדים, ועדותם יכולה לחזק זו את זו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'לא ניתן להרשיע את גל על סמך עדותם של שני הילדים אלא אם יש בחומר הראיות דבר מה נוסף.', false, 'טענה זו שגויה. דרישת ''דבר מה נוסף'' חלה על הודאת חוץ של נאשם (סעיף 10א לפקודת הראיות), ואינה רלוונטית לעדות קטינים בבית המשפט.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ניתן להרשיע את גל על סמך עדותם של שני הילדים בלבד.', true, 'זוהי התשובה הנכונה. סעיף 55(ב) לפקודת הראיות דורש חיזוק ל''עדות יחידה'' של קטין מתחת לגיל 12. במקרה זה, מדובר בשני ילדים, ועדותו של כל אחד מהם יכולה לשמש חיזוק לעדותו של האחר, ובכך מתמלאת דרישת החיזוק ללא צורך בראיה חיצונית נוספת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'עדות קטין שנאסרה העדתו',
    1, 'גל מואשם בעבירות מין חמורות שביצע בילד בן 10. הילד נחקר על ידי חוקר ילדים, אך חוקר הילדים אסר על העדתו בבית המשפט. מה הדין לגבי הרשעת גל?', 'שאלה זו עוסקת בדרישת הסיוע הייחודית לעדות קטין שנמסרה בפני חוקר ילדים, אך הקטין לא העיד בבית המשפט. היא מדגישה את סעיף 11 לחוק לתיקון דיני הראיות (הגנת ילדים), המהווה חריג לכלל עדות מפי השמועה, אך דורש תוספת ראייתית מסוג סיוע בשל היעדר חקירה נגדית והתרשמות בלתי אמצעית של בית המשפט.', 'סעיף 11 לחוק לתיקון דיני הראיות (הגנת ילדים), תשט"ו-1955, קובע מפורשות כי ''לא יורשע אדם על סמך ראיה לפי סעיף 9, אלא אם יש לה סיוע בראיה אחרת''. סעיף 9 לחוק מכשיר את עדות הילד שנמסרה בפני חוקר ילדים כראיה קבילה, למרות היותה עדות מפי השמועה. דרישת הסיוע נועדה לגשר על החסר הראייתי הנובע מכך שבית המשפט לא התרשם מהילד באופן בלתי אמצעי, ובעיקר, שההגנה לא יכלה לחקור את הילד בחקירה נגדית. הסיוע הנדרש הוא מהותי ולא טכני, וחייב לעמוד בשלושה תנאים מצטברים: מקור עצמאי ונפרד, מסבך את הנאשם, ונוגע לנקודה ממשית השנויה במחלוקת. ראו ע"פ 8631/13 פלוני נ'' מדינת ישראל (10.3.2016), ע"פ 8579/20 פלוני נ'' מדינת ישראל (29.3.2022), וכן סעיף 11 לחוק לתיקון דיני הראיות (הגנת ילדים), תשט"ו-1955.',
    'בלבול בין דרישת הסיוע (כאשר הקטין לא מעיד) לדרישת החיזוק (כאשר הקטין מעיד ומתחת לגיל 12), או אי-הבנה של אופייה המהותי של דרישת הסיוע.', '["חוק הגנת ילדים", "סעיף 11", "עדות קטין", "חוקר ילדים", "ראיית סיוע", "עדות מפי השמועה"]'::jsonb, '**וריאציה 1 — קטין לא מעיד:** ילד נחקר ע"י חוקר ילדים אך לא מעיד בביהמ"ש. מה נדרש להרשעה? ← סיוע (סעיף 11 לחוק הגנת ילדים).
**וריאציה 2 — תכלית הסיוע:** מדוע נדרש סיוע במקרה זה? ← לפצות על היעדר חקירה נגדית והתרשמות בלתי אמצעית (ע"פ פלוני 8579/20).
**וריאציה 3 — קבילות העדות:** האם עדות חוקר הילדים קבילה? ← כן, כחריג לעדות מפי השמועה, אך טעונה סיוע (סעיף 9 לחוק הגנת ילדים).', 'עדות קטין (לא בביהמ"ש) ← טעונה סיוע ← פיצוי על היעדר חקירה נגדית.',
    '["חוק לתיקון דיני הראיות (הגנת ילדים), תשט\"ו-1955: סע'' 9, 11", "ע\"פ 8631/13 פלוני נ'' מדינת ישראל (10.3.2016)", "ע\"פ 8579/20 פלוני נ'' מדינת ישראל (29.3.2022)", "ע\"פ 6813/16 אלי סמסון נחמני נ'' מדינת ישראל (17.9.2018)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'ניתן להרשיע את גל על סמך עדות הילד בפני חוקר הילדים בלבד, אם בית המשפט התרשם ממהימנותה.', false, 'טענה זו שגויה. כאשר קטין לא מעיד בבית המשפט, עדותו בפני חוקר ילדים טעונה סיוע, גם אם היא מהימנה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לא ניתן להרשיע את גל על סמך עדות הילד בפני חוקר הילדים, אלא אם יש לה סיוע בראיה אחרת.', true, 'זוהי התשובה הנכונה. סעיף 11 לחוק לתיקון דיני הראיות (הגנת ילדים) קובע כי לא יורשע אדם על סמך עדות קטין שנמסרה בפני חוקר ילדים ואשר הקטין לא העיד בבית המשפט, אלא אם יש לה סיוע בראיה אחרת.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'לא ניתן להרשיע את גל על סמך עדות הילד בפני חוקר הילדים, אלא אם יש לה דבר לחיזוק.', false, 'טענה זו שגויה. דרישת החיזוק חלה על עדות יחידה של קטין מתחת לגיל 12 המעיד בבית המשפט, ולא על עדות קטין שנאסרה העדתו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'עדות הילד בפני חוקר הילדים אינה קבילה כלל כראיה, שכן היא עדות מפי השמועה.', false, 'טענה זו שגויה. סעיף 9 לחוק הגנת ילדים קובע כי עדות ילד שתועדה בידי חוקר ילדים כשרה להתקבל כראיה, למרות היותה עדות מפי השמועה, אך היא טעונה סיוע.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאי דרישת הסיוע',
    2, 'מהם התנאים המצטברים שראיה צריכה לעמוד בהם כדי להיחשב כ''סיוע'' לעדות קטין שנאסרה העדתו בבית המשפט?', 'שאלה זו מתמקדת בתנאים המהותיים שנקבעו בפסיקה לראיית סיוע, הנדרשת במקרים של עדות קטין שנאסרה העדתו בבית המשפט. היא מפרטת את שלושת התנאים המצטברים: מקור עצמאי ונפרד, סיבוך הנאשם, ונגיעה בנקודה ממשית השנויה במחלוקת, ומדגישה את אופייה המהותי של דרישה זו.', 'הלכה פסוקה היא כי על ראיית סיוע לעמוד בשלושה תנאים מצטברים: היא חייבת לנבוע ממקור עצמאי ונפרד מעדות הקטין; היא צריכה לסבך את הנאשם בביצוע העבירה (או למצער לנטות לסבך אותו); והיא צריכה לגעת בנקודה ממשית השנויה במחלוקת. דרישת הסיוע אינה דרישה טכנית-פורמלית בלבד, אלא עניינית-מהותית, שמטרתה להבטיח את ביטחון ההרשעה במקרים בהם בית המשפט לא התרשם מהעדות באופן בלתי אמצעי ולא התאפשרה חקירה נגדית. כוחה של ראיית הסיוע משתנה בהתאם לנסיבות המקרה ולמשקל העדות הטעונה סיוע, בבחינת ''כלים שלובים''. ראו ע"פ 8631/13 פלוני נ'' מדינת ישראל (10.3.2016), ע"פ 8579/20 פלוני נ'' מדינת ישראל (29.3.2022), וכן ע"פ 1139/23 פלוני נ'' מדינת ישראל (13.3.2024).',
    'אי-הבחנה בין התנאים המצטברים, או בלבול בין דרישת הסיוע לדרישת החיזוק, שהיא קלה יותר.', '["ראיית סיוע", "תנאים מצטברים", "מקור עצמאי", "סיבוך הנאשם", "נקודה שנויה במחלוקת", "מהותיות הסיוע"]'::jsonb, '**וריאציה 1 — שלושת התנאים:** מהם התנאים לסיוע? ← מקור עצמאי, מסבך את הנאשם, נוגע לנקודה שנויה במחלוקת (ע"פ פלוני 8631/13).
**וריאציה 2 — מהותיות הסיוע:** האם הסיוע הוא דרישה טכנית? ← לא, הוא מהותי וענייני (ע"פ פלוני 8631/13).
**וריאציה 3 — ''כלים שלובים'':** איך נקבע משקל הסיוע? ← ב''כלים שלובים'' עם משקל העדות הטעונה סיוע (ע"פ פלוני 8631/13).', 'ראיית סיוע ← 3 תנאים מצטברים ← מקור עצמאי, מסבך, נוגע למחלוקת.',
    '["ע\"פ 8631/13 פלוני נ'' מדינת ישראל (10.3.2016)", "ע\"פ 8579/20 פלוני נ'' מדינת ישראל (29.3.2022)", "ע\"פ 1139/23 פלוני נ'' מדינת ישראל (13.3.2024)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'הראיה חייבת לנבוע ממקור עצמאי ונפרד, לסבך את הנאשם בביצוע העבירה, ולגעת בנקודה ממשית השנויה במחלוקת.', true, 'זוהי התשובה הנכונה. אלו הם שלושת התנאים המצטברים שנקבעו בפסיקה לראיית סיוע.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'הראיה צריכה לחזק את מהימנות עדות הקטין, אך לא חייבת לסבך את הנאשם בביצוע העבירה.', false, 'טענה זו שגויה. ראיית סיוע חייבת לסבך את הנאשם, בניגוד ל''דבר לחיזוק'' שמטרתו לחזק את מהימנות העדות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'הראיה יכולה לנבוע מאותו מקור של עדות הקטין, ובלבד שהיא בעלת משקל ראייתי גבוה.', false, 'טענה זו שגויה. ראיית סיוע חייבת לנבוע ממקור עצמאי ונפרד מעדות הקטין.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'הראיה צריכה להוכיח את אשמת הנאשם מעל לכל ספק סביר, ואינה יכולה להיות ראיה נסיבתית.', false, 'טענה זו שגויה. ראיית סיוע אינה צריכה להוכיח את האשמה מעל לכל ספק סביר בעצמה, אלא לסבך את הנאשם, והיא יכולה להיות נסיבתית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'עדות קטין מתחת לגיל אחריות פלילית',
    3, 'גל מואשם בעבירות מין חמורות שביצע בילד בן 8. הילד מעיד בבית המשפט. מה הדין לגבי הרשעת גל?', 'שאלה זו בוחנת את דרישת החיזוק לעדות יחידה של קטין המעיד בבית המשפט, כאשר גילו מתחת לגיל האחריות הפלילית (12 שנים). היא מדגישה את סעיף 55(ב) לפקודת הראיות ואת הרציונל שמאחורי דרישה זו – היעדר האפשרות להטיל אחריות פלילית על הקטין במקרה של עדות שקר.', 'סעיף 55(ב) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע כי ''לא יורשע אדם על סמך עדות יחידה של קטין שאינו בר-אחריות פלילית בשל גילו, אלא אם כן יש בחומר הראיות דבר לחיזוקה''. גיל האחריות הפלילית בישראל הוא 12 שנים. לכן, ילד בן 8 נחשב כמי שאינו בר-אחריות פלילית, ועדותו היחידה בבית המשפט טעונה חיזוק. הרציונל לדרישה זו נעוץ בהיעדר ענישה לצד האזהרה של הקטין כעד, שכן לא ניתן להטיל עליו אחריות פלילית במקרה של עדות שקר. ראו סעיף 55(ב) לפקודת הראיות [נוסח חדש], תשל"א-1971, וכן יניב ואקי דיני ראיות כרך ב (2020) | פרק 23 עד ילד או קטין.',
    'אי-הבחנה בין גיל הקטין המעיד (מתחת ל-12) לבין גיל הקטין שנאסרה העדתו (דורש סיוע), או אי-הבנה של משמעות ''עדות יחידה''.', '["פקודת הראיות", "סעיף 55(ב)", "קטין", "גיל אחריות פלילית", "דבר לחיזוק", "עדות יחידה"]'::jsonb, '**וריאציה 1 — גיל הקטין:** ילד בן 8 מעיד בביהמ"ש. האם עדותו דורשת תוספת ראייתית? ← כן, חיזוק, כי הוא מתחת לגיל 12 (סעיף 55(ב)).
**וריאציה 2 — רציונל החיזוק:** מדוע נדרש חיזוק? ← כי לא ניתן להטיל אחריות פלילית על קטין מתחת לגיל 12 במקרה של עדות שקר (יניב ואקי).
**וריאציה 3 — עדות יחידה:** האם החיזוק נדרש גם אם יש מספר עדים קטינים? ← לא, אם יש מספר עדים קטינים, הם יכולים לחזק זה את זה (ע"פ פלוני 3557211).', 'ילד בן 8 מעיד בביהמ"ש ← עדות יחידה דורשת חיזוק ← אם שניים, יכולים לחזק זה את זה.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 55(ב)", "יניב ואקי דיני ראיות כרך ב (2020) | פרק 23 עד ילד או קטין", "ע\"פ 3557211 פלוני נ'' מדינת ישראל (9.12.2015)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'ניתן להרשיע את גל על סמך עדות הילד בלבד, אם בית המשפט התרשם ממהימנותה.', false, 'טענה זו שגויה. ילד בן 8 אינו בר-אחריות פלילית, ועדותו היחידה טעונה חיזוק.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא ניתן להרשיע את גל על סמך עדות הילד, אלא אם יש בחומר הראיות דבר לחיזוקה.', true, 'זוהי התשובה הנכונה. סעיף 55(ב) לפקודת הראיות קובע כי לא יורשע אדם על סמך עדות יחידה של קטין שאינו בר-אחריות פלילית (מתחת לגיל 12), אלא אם יש בחומר הראיות דבר לחיזוקה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'לא ניתן להרשיע את גל על סמך עדות הילד, אלא אם יש לה סיוע בראיה אחרת.', false, 'טענה זו שגויה. דרישת הסיוע חלה על עדות קטין שנאסרה העדתו בבית המשפט, ולא על קטין המעיד בבית המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'עדות הילד אינה קבילה כלל כראיה, שכן הוא מתחת לגיל 12.', false, 'טענה זו שגויה. עדות קטין מתחת לגיל 12 קבילה, אך עדות יחידה שלו טעונה חיזוק (סעיף 55(ב) לפקודת הראיות).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'עדות יחידה של עד מדינה',
    4, 'גל מואשם בעבירת שוד. עד התביעה המרכזי הוא שותפו לעבירה, שהפך ל''עד מדינה'' לאחר שהובטחה לו טובת הנאה. מה הדין לגבי הרשעת גל על סמך עדותו של עד המדינה?', 'שאלה זו עוסקת בדרישת הסיוע לעדות יחידה של עד מדינה, כפי שנקבעה בסעיף 54א(א) לפקודת הראיות. היא מדגישה את ההבחנה בין ''חיזוק'' ל''סיוע'' בהקשר של שותפים לעבירה, ואת הרציונל לדרישת הסיוע המחמירה יותר במקרה של עד מדינה – החשש מפני אינטרס אישי להפליל אחרים בתמורה לטובת הנאה.', 'סעיף 54א(א) לפקודת הראיות [נוסח חדש], תשל"א-1971, קובע כי ''בית המשפט לא ירשיע נאשם על סמך עדותו היחידה של שותפו לעבירה, אלא אם מצא בחומר הראיות דבר לחיזוקה; ואולם אם היה השותף עד מדינה - טעונה עדותו סיוע''. ''עד מדינה'' מוגדר כשותף לאותה עבירה המעיד מטעם התביעה לאחר שניתנה או שהובטחה לו טובת הנאה. הרציונל לדרישת הסיוע המחמירה יותר לעדות עד מדינה, לעומת דרישת החיזוק לשותף רגיל, נובע מהחשש המוגבר שעד מדינה יבקש להפליל אחרים כדי להיטיב את מצבו שלו, וזאת בשל טובת ההנאה שהובטחה לו. ראו סעיף 54א(א) לפקודת הראיות [נוסח חדש], תשל"א-1971, וכן אורנה אליגון דר יסודות בדיני ראיות (2024) | פרק 10 - תוספות ראייתיות.',
    'בלבול בין דרישת החיזוק לשותף רגיל לבין דרישת הסיוע לעד מדינה, או אי-הבנה של הרציונל המבחין ביניהם.', '["פקודת הראיות", "סעיף 54א(א)", "עד מדינה", "שותף לעבירה", "ראיית סיוע", "דבר לחיזוק", "אינטרס אישי"]'::jsonb, '**וריאציה 1 — עד מדינה:** מה נדרש לעדות יחידה של עד מדינה? ← סיוע (סעיף 54א(א)).
**וריאציה 2 — שותף רגיל:** מה נדרש לעדות יחידה של שותף רגיל? ← חיזוק (סעיף 54א(א)).
**וריאציה 3 — רציונל ההבחנה:** מדוע עד מדינה דורש סיוע? ← חשש מוגבר מאינטרס אישי להפליל אחרים בתמורה לטובת הנאה (אליגון דר).', 'עד מדינה ← עדות יחידה דורשת סיוע ← שותף רגיל ← עדות יחידה דורשת חיזוק.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971: סע'' 54א(א)", "אורנה אליגון דר יסודות בדיני ראיות (2024) | פרק 10 - תוספות ראייתיות", "יניב ואקי דיני ראיות כרך ב (2020) | פרק 22 עד מדינה"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'לא ניתן להרשיע את גל על סמך עדותו היחידה של עד המדינה, אלא אם יש לה סיוע בראיה אחרת.', true, 'זוהי התשובה הנכונה. סעיף 54א(א) לפקודת הראיות קובע כי עדותו של עד מדינה טעונה סיוע.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'לא ניתן להרשיע את גל על סמך עדותו היחידה של עד המדינה, אלא אם יש לה דבר לחיזוקה.', false, 'טענה זו שגויה. דרישת החיזוק חלה על שותף לעבירה שאינו עד מדינה, ואילו עד מדינה דורש סיוע (סעיף 54א(א)).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'ניתן להרשיע את גל על סמך עדותו היחידה של עד המדינה, אם בית המשפט התרשם ממהימנותה.', false, 'טענה זו שגויה. עדות עד מדינה טעונה סיוע, ואינה מספיקה להרשעה גם אם בית המשפט התרשם ממהימנותה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'עדותו של עד מדינה אינה קבילה כלל כראיה, שכן היא נגועה באינטרס אישי.', false, 'טענה זו שגויה. עדות עד מדינה קבילה, אך בשל האינטרס האישי היא טעונה סיוע.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 37, '2022-S-Q37';
END
$$;

-- ============================================================
-- Q38 — 2022-S-Q38 — chapter=constitutional_intl subtopic=bgz_jurisdiction_revocation  [needs_review]
-- classifier_note: Defendant collaterally attacking ministerial terror-organization declaration in criminal trial — judicial review of admin action; no perfect subtopic
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '47a6070f-98cf-411c-9af3-6900dc9c4d03'::uuid;
  v_group_id uuid := '9fb37352-70e5-470f-a99a-575231beb023'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := 'a0d7f35e-f87b-48c3-8afb-d743d826e6d2'::uuid;
  v_ang_1 uuid := 'd773f604-9690-413e-b122-dbd1993b135e'::uuid;
  v_ang_2 uuid := '9dc91324-b826-405e-b18d-69a1632030c5'::uuid;
  v_ang_3 uuid := 'f7807756-8447-4044-8e79-0d090cd22552'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q38';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 38, '2022-S-Q38';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'constitutional_intl';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'constitutional_intl';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'bgz_jurisdiction_revocation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'bgz_jurisdiction_revocation', 'constitutional_intl';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q38', v_chapter_id, v_subtopic_id, 'שר הביטחון הכריז בהכרזה קבועה על ארגון כארגון טרור. במהלך משפט פלילי המתנהל בבית המשפט המחוזי, שבו ביקשה התביעה להסתמך על הכרזה זו, העלה בעל דין את הטענה כי ההכרזה האמורה נעשתה שלא כדין. אין מחלוקת כי לשאלה זו השלכות על תוצאות ההליך המשפטי המתנהל. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 38}'::jsonb, 'השאלה עוסקת בסמכותו של בית משפט דיוני לדון בטענה לחוסר חוקיות של הכרזה על ארגון טרור, בדרך של תקיפה עקיפה. היא מתמקדת בסעיף 19 לחוק המאבק בטרור, הקובע מניעה חוקית מפורשת על ערכאות דיוניות להיזקק לטענות מסוג זה, ומייחד את הסמכות לביקורת שיפוטית על הכרזות אלו לבית המשפט העליון בשבתו כבג"ץ.', 'סעיף 19(א) לחוק המאבק בטרור, תשע"ו-2016, קובע מפורשות כי ''בכל הליך משפטי, לרבות הליך משפטי לפי חוק זה, לא יזדקק בית משפט לטענה כי חבר בני אדם או אדם שהוכרז לפי הוראות פרק זה אינו ארגון טרור או פעיל טרור, לפי העניין, או לטענה שעניינה בטלותה של הכרזה על ארגון טרור או על פעיל טרור, וסעיף 76 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, לא יחול לעניין זה''. הוראה זו שוללת באופן מפורש את סמכותן של הערכאות הדיוניות, לרבות בית המשפט המחוזי, לדון בטענות הנוגעות לבטלות הכרזה על ארגון טרור, גם בדרך של תקיפה עקיפה (אגב גררא). סעיף 19(ב) מבהיר כי שלילה זו אינה גורעת מסמכותו של בית המשפט העליון בשבתו כבית משפט גבוה לצדק (בג"ץ) לדון בעניין. הרציונל מאחורי הוראה זו הוא ייחוד הביקורת השיפוטית על הכרזות אלו לערכאה המוסמכת לכך, בשל רגישות הנושא והשלכותיו הרחבות. ראו חוק המאבק בטרור, תשע"ו-2016, סעיף 19, וכן ע"פ (מחוזי חי'') 45090-03-20 ראיד מחאג''נה נ'' מדינת ישראל (16.7.2020).', 'הנחה שסעיף 76 לחוק בתי המשפט מקנה סמכות נגררת לכל שאלה אגבית, מבלי להכיר בחריגים מפורשים בחוקים ספציפיים, כמו סעיף 19 לחוק המאבק בטרור.',
    '["חוק המאבק בטרור", "הכרזת ארגון טרור", "תקיפה עקיפה", "סמכות נגררת", "סעיף 19 לחוק המאבק בטרור", "בג\"ץ"]'::jsonb, '**וריאציה 1 — סמכות בית משפט מחוזי:** האם בית משפט מחוזי מוסמך לדון בטענה לבטלות הכרזת ארגון טרור? ← לא, סעיף 19(א) לחוק המאבק בטרור שולל זאת.
**וריאציה 2 — סעיף 76 לחוק בתי המשפט:** האם סעיף 76 (סמכות נגררת) חל במקרה זה? ← לא, סעיף 19(א) שולל במפורש את תחולתו לעניין זה.
**וריאציה 3 — סמכות בג"ץ:** מי מוסמך לדון בטענה לבטלות הכרזת ארגון טרור? ← בית המשפט העליון בשבתו כבג"ץ (סעיף 19(ב)).', 'הכרזת ארגון טרור ← תקיפה עקיפה אסורה בערכאות דיוניות ← סמכות ייחודית לבג"ץ.', '["חוק המאבק בטרור, תשע\"ו-2016: סע'' 19", "ע\"פ (מחוזי חי'') 45090-03-20 ראיד מחאג''נה נ'' מדינת ישראל (16.7.2020)", "ת\"פ (שלום חי'') 49376-08-17 מדינת ישראל נ'' ראיד מחאג''נה (24.11.2019)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''חוקתי + בינלאומי פרטי'' subtopic=''ביטול סמכות בג"ץ'' → mapped chapter=''constitutional_intl'' subtopic=''bgz_jurisdiction_revocation'' | classifier_note: Defendant collaterally attacking ministerial terror-organization declaration in criminal trial — judicial review of admin action; no perfect subtopic', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על בית המשפט המחוזי להכריע בטענה זו קודם שימשיך במשפט. צד המעוניין לתקוף משפטית את החלטת בית המשפט המחוזי יצטרך לפנות בבקשת רשות ערעור לבית המשפט העליון.', false, 'טענה זו שגויה. בית המשפט המחוזי אינו מוסמך לדון בטענה זו, וסעיף 19(א) לחוק המאבק בטרור שולל את תחולת סעיף 76 לחוק בתי המשפט לעניין זה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על בית המשפט המחוזי להכריע בטענה זו קודם שימשיך במשפט. צד המעוניין לתקוף משפטית את החלטת בית המשפט המחוזי יוכל לעשות כן רק במסגרת ערעור על פסק הדין.', false, 'טענה זו שגויה. בית המשפט המחוזי אינו מוסמך לדון בטענה זו כלל, ולכן אין רלוונטיות לשאלת הערעור על החלטתו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט המחוזי אינו מוסמך לדון בטענה האמורה.', true, 'זוהי התשובה הנכונה. סעיף 19(א) לחוק המאבק בטרור שולל במפורש את סמכותן של הערכאות הדיוניות, לרבות בית המשפט המחוזי, לדון בטענות הנוגעות לבטלות הכרזה על ארגון טרור, גם בדרך של תקיפה עקיפה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על בעל הדין להגיש עתירה מינהלית נגד הכרזת שר הביטחון ובמקביל לבקש מבית המשפט המחוזי לעכב את הדיון במשפט הפלילי עד להכרעה חלוטה בה.', false, 'טענה זו שגויה. למרות שהדרך הנכונה לתקוף את ההכרזה היא בבג"ץ, סעיף 19(א) לחוק המאבק בטרור שולל את סמכות בית המשפט המחוזי לדון בטענה זו, ואין הוא יכול לעכב את הדיון לצורך כך.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'תקיפה עקיפה של חוק עזר עירוני',
    1, 'ראובן הואשם בעבירה פלילית לפי חוק עזר עירוני האוסר על השלכת פסולת ברשות הרבים. ראובן טוען להגנתו כי חוק העזר אינו חוקי. מה הדין לגבי סמכות בית המשפט לדון בטענה זו?', 'שאלה זו עוסקת בסמכותו של בית משפט דיוני לדון בטענה לחוסר חוקיות של נורמה כללית (חוק עזר עירוני) בדרך של תקיפה עקיפה. היא מדגישה את תחולת סעיף 76 לחוק בתי המשפט, המקנה סמכות נגררת, ואת ההבחנה בין תקיפה עקיפה של נורמה כללית לבין תקיפה של צו אישי, כאשר הראשונה נוטה להתאפשר יותר.', 'סעיף 76 לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי ''הובא עניין כדין לפני בית משפט, והתעוררה בו, דרך אגב, שאלה שהכרעתה דרושה לבירור העניין, רשאי בית המשפט, להכריע בה, לצורך אותו עניין, אף אם העניין שבשאלה הוא, בסמכותו הייחודית, של בית משפט אחר, או של בית דין אחר''. הפסיקה והספרות המשפטית מבחינות בין תקיפה עקיפה של נורמה כללית (כמו חוק עזר) לבין תקיפה עקיפה של צו אישי. בדרך כלל, תקיפה עקיפה של נורמה כללית תתאפשר, במיוחד כאשר הנאשם עומד לדין פלילי על הפרתה ואין לו דרך מעשית אחרת לתקוף אותה. זאת, בניגוד לצו אישי, שלגביו מצופה מהנפגע לתקוף אותו בדרך ישירה. ראו יעקב שקד תקיפה עקיפה בהליכים פליליים ואזרחיים (2020) | פרק שלישי מתי מותרת תקיפה עקיפה - דין מצוי וכן דפנה ברק-ארז משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017) | פרק 34 השיפוט בעניינים מינהליים בערכאות נוספות.',
    'הנחה שכל תקיפה עקיפה של מעשה מינהלי אסורה, מבלי להבחין בין סוגי הנורמות (כללית מול אישית) ובין הנסיבות השונות המצדיקות תקיפה עקיפה.', '["תקיפה עקיפה", "סמכות נגררת", "חוק עזר עירוני", "נורמה כללית", "סעיף 76 לחוק בתי המשפט"]'::jsonb, '**וריאציה 1 — תקיפת חוק עזר:** האם נאשם בעבירה לפי חוק עזר יכול לטעון לחוסר חוקיותו בהליך הפלילי? ← כן, בדרך כלל תתאפשר תקיפה עקיפה של נורמה כללית (שקד, ברק-ארז).
**וריאציה 2 — סמכות בית המשפט:** מה מקור הסמכות של בית המשפט לדון בטענה זו? ← סעיף 76 לחוק בתי המשפט (סמכות נגררת).
**וריאציה 3 — הבחנה בין נורמות:** מדוע תקיפת חוק עזר שונה מתקיפת צו אישי? ← בצו אישי מצופה מהנפגע לתקוף ישירות, בנורמה כללית אין דרך מעשית אחרת לתקוף אלא בהליך שבו היא מיושמת (שקד).', 'תקיפה עקיפה של חוק עזר ← מותרת מכוח סמכות נגררת ← במיוחד כשאין דרך אחרת לתקוף.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 76", "יעקב שקד תקיפה עקיפה בהליכים פליליים ואזרחיים (2020) | פרק שלישי מתי מותרת תקיפה עקיפה - דין מצוי", "דפנה ברק-ארז משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017) | פרק 34 השיפוט בעניינים מינהליים בערכאות נוספות"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'בית המשפט מוסמך לדון בטענה זו מכוח סמכותו הנגררת, שכן מדובר בתקיפה עקיפה של נורמה כללית.', true, 'זוהי התשובה הנכונה. סעיף 76 לחוק בתי המשפט מקנה לבית המשפט סמכות לדון בשאלה אגבית, ובדרך כלל תקיפה עקיפה של נורמה כללית (כמו חוק עזר) תתאפשר, במיוחד כאשר אין דרך מעשית אחרת לתקוף אותה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'בית המשפט אינו מוסמך לדון בטענה זו, שכן חוקיות חוקי עזר נתונה לסמכותו הייחודית של בית המשפט לעניינים מינהליים.', false, 'טענה זו שגויה. למרות שבית המשפט לעניינים מינהליים מוסמך לדון בחוקיות חוקי עזר, סעיף 76 לחוק בתי המשפט מאפשר לבית משפט דיוני לדון בכך אגב גררא.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'בית המשפט מוסמך לדון בטענה זו רק אם ראובן הוכיח כי נגרם לו נזק ממשי כתוצאה מחוק העזר.', false, 'טענה זו שגויה. דרישת נזק ממשי אינה תנאי לסמכות לדון בתקיפה עקיפה של חוק עזר, אלא רלוונטית יותר לתקיפה ישירה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'בית המשפט אינו מוסמך לדון בטענה זו, שכן תקיפה עקיפה של חיקוקים מותרת רק בבית המשפט העליון.', false, 'טענה זו שגויה. בית המשפט העליון דן בחוקתיות חיקוקים בבג"ץ, אך סעיף 76 לחוק בתי המשפט מאפשר לערכאות דיוניות לדון בשאלות אגביות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'שיקולי בית המשפט בתקיפה עקיפה',
    2, 'מהם השיקולים המרכזיים שבית משפט דיוני ישקול בבואו להחליט אם לאפשר תקיפה עקיפה של מעשה מינהלי?', 'שאלה זו בוחנת את מכלול השיקולים המנחים את בית המשפט בהחלטתו אם לאפשר תקיפה עקיפה של מעשה מינהלי. היא מדגישה את הגישה הזהירה והמצמצמת של בתי המשפט, תוך התייחסות למגוון גורמים כמו סוג הנורמה, חומרת הפגם, קיומו של הליך חלופי, והשלכות רוחב ציבוריות, כפי שפורט בספרות המשפטית.', 'הפסיקה והספרות המשפטית מציגות מגוון שיקולים שבית משפט דיוני ישקול בבואו להחליט אם לאפשר תקיפה עקיפה של מעשה מינהלי. בין השיקולים המרכזיים נמנים: סוג הנורמה הנתקפת (האם מדובר בנורמה כללית או בצו אישי), חומרת הפגם במעשה המינהלי (האם מדובר בבטלות מדעיקרא או בנפסדות, אם כי הבחנה זו נשחקה), קיומו של הליך תקיפה ישירה חלופי (והאם בעל הדין נמנע ממנו), השלכות רוחב ציבוריות של ההכרעה (האם היא תסכל מדיניות ציבורית או תשפיע על ציבור רחב), והתנהלות בעל הדין. גישת בתי המשפט היא זהירה ומצמצמת, במיוחד כאשר קיימת דרך ייעודית לתקיפה ישירה. ראו יעקב שקד סדר הדין האזרחי (2026) | פרק ב סמכויות השיפוט וכן יעקב שקד תקיפה עקיפה בהליכים פליליים ואזרחיים (2020) | פרק שלישי מתי מותרת תקיפה עקיפה - דין מצוי.',
    'התמקדות בשיקול בודד או אי-הבנה של מכלול השיקולים המורכבים המנחים את בית המשפט בהכרעה בשאלת התקיפה העקיפה.', '["תקיפה עקיפה", "מעשה מינהלי", "שיקול דעת שיפוטי", "נורמה כללית", "נורמה אישית", "השלכות רוחב"]'::jsonb, '**וריאציה 1 — שיקולים מרכזיים:** מהם השיקולים המרכזיים בתקיפה עקיפה? ← סוג הנורמה, חומרת הפגם, קיום הליך חלופי, השלכות רוחב (שקד).
**וריאציה 2 — גישה מצמצמת:** מהי הגישה הכללית של בתי המשפט לתקיפה עקיפה? ← גישה זהירה ומצמצמת, במיוחד כשיש דרך תקיפה ישירה (שקד).
**וריאציה 3 — ''הראל'':** מהי ההלכה המנחה בעניין תקיפה עקיפה? ← הלכת ''הראל'' קבעה שדרך התקיפה יכולה להכתיב את תוצאתה, ועדיפה תקיפה ישירה (שקד).', 'תקיפה עקיפה ← שיקולים רבים ← גישה מצמצמת ← עדיפות לתקיפה ישירה.',
    '["יעקב שקד סדר הדין האזרחי (2026) | פרק ב סמכויות השיפוט", "יעקב שקד תקיפה עקיפה בהליכים פליליים ואזרחיים (2020) | פרק שלישי מתי מותרת תקיפה עקיפה - דין מצוי", "דפנה ברק-ארז משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017) | פרק 34 השיפוט בעניינים מינהליים בערכאות נוספות"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'סוג הנורמה הנתקפת (כללית או אישית), חומרת הפגם, קיומו של הליך תקיפה ישירה חלופי, והשלכות רוחב ציבוריות.', true, 'זוהי התשובה הנכונה. אלו הם השיקולים המרכזיים שנקבעו בפסיקה ובספרות המשפטית להכרעה בשאלת התקיפה העקיפה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'רק סוג הנורמה הנתקפת (כללית או אישית) וקיומו של הליך תקיפה ישירה חלופי.', false, 'טענה זו חלקית. למרות שאלו שיקולים חשובים, ישנם שיקולים נוספים כמו חומרת הפגם והשלכות רוחב ציבוריות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'רק חומרת הפגם במעשה המינהלי והתנהלות בעל הדין המבקש לתקוף.', false, 'טענה זו חלקית. אלו שיקולים רלוונטיים, אך אינם היחידים. חסרים שיקולים מהותיים נוספים כמו סוג הנורמה והשלכות רוחב.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'רק אם מדובר בפגם של חוסר סמכות שתוצאתו בטלות מדעיקרא.', false, 'טענה זו שגויה. בעבר הבחינו בין בטלות מדעיקרא לנפסדות, אך הבחנה זו נשחקה, וכיום נשקלים שיקולים רחבים יותר.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'תקיפה עקיפה של החלטה שיפוטית',
    3, 'ראובן הורשע בעבירה פלילית ונגזר עליו עונש מאסר על תנאי. בהליך פלילי מאוחר יותר, שבו מואשם ראובן בהפרת תנאי המאסר, הוא טוען כי גזר הדין המקורי ניתן בחוסר סמכות עניינית. מה הדין?', 'שאלה זו עוסקת באפשרות לתקוף החלטה שיפוטית קודמת בדרך עקיפה, ובפרט במקרה של חוסר סמכות עניינית. היא מדגישה כי למרות הכלל בדבר חסינות החלטות שיפוטיות מתקיפה עקיפה, חוסר סמכות עניינית הוא פגם חמור המצדיק חריגה מכלל זה, ומאפשר לבית המשפט לדון בטענה מכוח סמכותו הנגררת.', 'הכלל הוא שהחלטות שיפוטיות חלוטות אינן ניתנות לתקיפה עקיפה. עם זאת, קיימים חריגים לכלל זה, ובמקרים מסוימים ניתן לתקוף החלטה שיפוטית בדרך עקיפה, למשל כאשר היא ניתנה בחוסר סמכות עניינית. חוסר סמכות עניינית נחשב לפגם חמור במיוחד, המצדיק בטלות מדעיקרא של ההחלטה. סעיף 76 לחוק בתי המשפט מאפשר לבית משפט לדון בשאלה אגבית, גם אם היא בסמכותו הייחודית של בית משפט אחר. הספרות המשפטית מפרטת מקרים ספציפיים בהם הועלו טענות בתקיפה עקיפה נגד החלטה שיפוטית, כגון גזר דין שהטיל עונש מותנה בחוסר סמכות. ראו יעקב שקד תקיפה עקיפה בהליכים פליליים ואזרחיים (2020) | פרק שלישי מתי מותרת תקיפה עקיפה - דין מצוי.',
    'הנחה שכל החלטה שיפוטית חסינה מתקיפה עקיפה, מבלי להכיר בחריגים הנוגעים לפגמים חמורים כמו חוסר סמכות עניינית.', '["תקיפה עקיפה", "החלטה שיפוטית", "חוסר סמכות עניינית", "סמכות נגררת", "בטלות מדעיקרא"]'::jsonb, '**וריאציה 1 — חוסר סמכות בגזר דין:** האם ניתן לתקוף גזר דין בחוסר סמכות עניינית בדרך עקיפה? ← כן, זהו חריג לכלל (שקד).
**וריאציה 2 — סמכות נגררת:** מה מקור הסמכות של בית המשפט לדון בכך? ← סעיף 76 לחוק בתי המשפט (סמכות נגררת).
**וריאציה 3 — חומרת הפגם:** מדוע חוסר סמכות עניינית מאפשר תקיפה עקיפה? ← זהו פגם חמור המביא לבטלות מדעיקרא של ההחלטה (שקד).', 'תקיפה עקיפה של החלטה שיפוטית ← מותרת בחוסר סמכות עניינית ← מכוח סמכות נגררת.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984: סע'' 76", "יעקב שקד תקיפה עקיפה בהליכים פליליים ואזרחיים (2020) | פרק שלישי מתי מותרת תקיפה עקיפה - דין מצוי"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'בית המשפט מוסמך לדון בטענה זו מכוח סמכותו הנגררת, שכן חוסר סמכות עניינית בגזר דין מאפשר תקיפה עקיפה.', true, 'זוהי התשובה הנכונה. תקיפה עקיפה של החלטה שיפוטית אפשרית במקרים חריגים, כגון כאשר ההחלטה ניתנה בחוסר סמכות עניינית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'בית המשפט אינו מוסמך לדון בטענה זו, שכן החלטות שיפוטיות חלוטות אינן ניתנות לתקיפה עקיפה.', false, 'טענה זו שגויה. למרות הכלל בדבר חסינות החלטות שיפוטיות מתקיפה עקיפה, קיימים חריגים, כגון חוסר סמכות עניינית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'בית המשפט מוסמך לדון בטענה זו רק אם ראובן לא ידע על חוסר הסמכות בעת מתן גזר הדין המקורי.', false, 'טענה זו שגויה. ידיעתו של ראובן אינה תנאי לסמכות בית המשפט לדון בחוסר סמכות עניינית, אלא רלוונטית יותר לשיקולי צדק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'בית המשפט אינו מוסמך לדון בטענה זו, שכן היה על ראובן לערער על גזר הדין המקורי במועד.', false, 'טענה זו שגויה. למרות שעדיף לערער במועד, חוסר סמכות עניינית הוא פגם חמור המאפשר תקיפה עקיפה גם לאחר מכן.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'הליך ביטול הכרזת ארגון טרור',
    4, 'ארגון ''התקווה'' הוכרז כארגון טרור על ידי שר הביטחון. הארגון מעוניין לבטל הכרזה זו. מהו ההליך הנכון שעליו לנקוט?', 'שאלה זו עוסקת בהליך הייחודי לביטול הכרזה על ארגון טרור, כפי שנקבע בחוק המאבק בטרור. היא מדגישה את חשיבות מיצוי ההליכים המנהליים בפני הוועדה המייעצת, ואת סמכותו הייחודית של בית המשפט העליון בשבתו כבג"ץ לבחון את חוקיות ההכרזה, תוך שלילת סמכותן של הערכאות הדיוניות לדון בכך.', 'חוק המאבק בטרור, תשע"ו-2016, קובע הסדר ספציפי להשגה על הכרזת ארגון כארגון טרור. סעיף 7(ב) לחוק מאפשר לארגון שהוכרז להגיש בקשה לביטול ההכרזה לוועדה המייעצת. סעיף 8 לחוק מאפשר לארגון לעיין בחומרים הרלוונטיים לשם הגשת הבקשה. סעיף 19(א) לחוק שולל במפורש את סמכותן של הערכאות הדיוניות לדון בטענות לבטלות הכרזה על ארגון טרור, ואילו סעיף 19(ב) מבהיר כי אין בכך כדי לגרוע מסמכותו של בית המשפט העליון בשבתו כבית משפט גבוה לצדק (בג"ץ) לדון בעניין. לפיכך, הדרך הנכונה לתקוף את ההכרזה היא באמצעות פנייה לוועדה המייעצת, ועל החלטתה ניתן לערער לבג"ץ. ראו חוק המאבק בטרור, תשע"ו-2016, סעיף 19, וכן ע"פ (מחוזי חי'') 45090-03-20 ראיד מחאג''נה נ'' מדינת ישראל (16.7.2020).',
    'אי-הכרת ההליך הייחודי הקבוע בחוק המאבק בטרור לביטול הכרזת ארגון טרור, וניסיון לנקוט בהליכים משפטיים כלליים שאינם מוסמכים לדון בכך.', '["חוק המאבק בטרור", "ביטול הכרזה", "ועדה מייעצת", "בג\"ץ", "סמכות ייחודית", "תקיפה ישירה"]'::jsonb, '**וריאציה 1 — הליך ביטול:** מהו ההליך לביטול הכרזת ארגון טרור? ← בקשה לוועדה המייעצת, וערעור לבג"ץ (סעיף 19(ב) לחוק המאבק בטרור).
**וריאציה 2 — סמכות ערכאות דיוניות:** האם בית משפט מחוזי מוסמך לדון בביטול הכרזה? ← לא, סעיף 19(א) שולל זאת במפורש (ע"פ מחאג''נה).
**וריאציה 3 — רציונל ההליך הייחודי:** מדוע נקבע הליך ייחודי? ← בשל רגישות הנושא וצורך במומחיות, ועל מנת למנוע תקיפה עקיפה (ע"פ מחאג''נה).', 'ביטול הכרזת טרור ← לוועדה המייעצת ← ערעור לבג"ץ ← ערכאות דיוניות אינן מוסמכות.',
    '["חוק המאבק בטרור, תשע\"ו-2016: סע'' 7(ב), 8, 19", "ע\"פ (מחוזי חי'') 45090-03-20 ראיד מחאג''נה נ'' מדינת ישראל (16.7.2020)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'להגיש בקשה לביטול ההכרזה לוועדה המייעצת, ועל החלטתה ניתן לערער לבית המשפט העליון בשבתו כבג"ץ.', true, 'זוהי התשובה הנכונה. חוק המאבק בטרור קובע הליך ייחודי לביטול הכרזה על ארגון טרור, הכולל פנייה לוועדה המייעצת וביקורת שיפוטית של בג"ץ.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'להגיש עתירה מינהלית לבית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים.', false, 'טענה זו שגויה. חוק המאבק בטרור קובע הליך ייחודי, וסמכות הביקורת השיפוטית על הכרזות אלו מסורה לבג"ץ, לא לבית המשפט לעניינים מינהליים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'להגיש תביעה הצהרתית לבית המשפט המחוזי בטענה לבטלות ההכרזה.', false, 'טענה זו שגויה. סעיף 19(א) לחוק המאבק בטרור שולל את סמכות בית המשפט המחוזי לדון בטענות לבטלות הכרזה על ארגון טרור.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'להגיש בקשה לשר הביטחון לבטל את ההכרזה, ואין אפשרות לביקורת שיפוטית על החלטתו.', false, 'טענה זו שגויה. קיימת אפשרות לביקורת שיפוטית על החלטת שר הביטחון, באמצעות בג"ץ, לאחר מיצוי הליכים בפני הוועדה המייעצת.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 38, '2022-S-Q38';
END
$$;

-- ============================================================
-- Q39 — 2022-S-Q39 — chapter=criminal_proc subtopic=death_investigation
-- classifier_note: Police request to exhume body for re-investigation; grandfather's objection
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '53c1daee-f6d4-4966-badd-77733d13f80e'::uuid;
  v_group_id uuid := '2b902b76-c0b3-4994-a37e-792c2c1d1a54'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '0c8b7466-fd13-4a09-a376-7b40d468b3c4'::uuid;
  v_ang_1 uuid := 'f52622f7-5fea-4e03-b150-52060b0289c8'::uuid;
  v_ang_2 uuid := '70d918db-f796-480c-ba0a-c9238b9f6a6f'::uuid;
  v_ang_3 uuid := 'abf2a018-2aa3-4551-a810-4882be88be2b'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q39';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 39, '2022-S-Q39';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'death_investigation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'death_investigation', 'criminal_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q39', v_chapter_id, v_subtopic_id, 'לפני שנתיים נמצאה גופת אדם ביער במחוז המרכז. נסיבות המוות לא פוענחו והמנוח הובא לקבורה. לאור התפתחויות בפרשה מעוניין קצין משטרה שהקבר ייפתח ותיערכנה בדיקות בשרידי הגופה. סבו של המנוח מתנגד לפתיחת הקבר. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 39}'::jsonb, 'השאלה עוסקת בסמכותו של שופט חוקר להורות על פתיחת קבר ועריכת בדיקות בשרידי גופה, ובזכות הערעור של בני המשפחה. היא מתבססת על סעיפים 19, 26 ו-27 לחוק חקירת סיבות מוות, המגדירים את הגורמים הרשאים לבקש חקירה, את סמכות השופט להורות על פתיחת קבר, ואת זכות הערעור של ''אדם מעוניין'', הכולל גם סבים.', 'סעיף 19 לחוק חקירת סיבות מוות, תשי"ח-1958, קובע כי קצין משטרה רשאי לבקש משופט של בית משפט השלום שבתחום שיפוטו אירע המוות או נמצאת הגוויה, לחקור בסיבת המוות, אם יש יסוד סביר לחשש שסיבת מותו אינה טבעית או שמותו נגרם בעבירה. במקרה זה, הגופה נמצאה במחוז המרכז, ולכן בית משפט השלום במחוז המרכז מוסמך לדון בבקשה. סעיף 26 לחוק מסמיך את השופט החוקר לצוות על פתיחת קבר והוצאת גוויה לשם בדיקה או ניתוח, אם הדבר דרוש לבירור סיבת המוות. סעיף 27 לחוק קובע כי ''על צו לפתיחת קבר לפי סעיף 26, רשאי כל אדם מעוניין, כמשמעותו בסעיף 19, וגוף מוכר, כמשמעותו בתקנות האנטומיה והפתולוגיה, תשי"ד-1954, לערער לפני בית המשפט המחוזי''. סעיף 19 מגדיר ''אדם מעוניין'' כבן זוגו של הנפטר, הוריו, הורי הוריו, צאצאיו, אחיו ואחיותיו. לפיכך, סבו של המנוח נכלל בהגדרה זו ורשאי לערער על ההחלטה. ראו חוק חקירת סיבות מוות, תשי"ח-1958, סעיפים 19, 27.', 'בלבול בין סמכות בית משפט השלום לבית המשפט המחוזי, או אי-הבנה של הגדרת ''אדם מעוניין'' והיקף זכות הערעור.',
    '["חקירת סיבות מוות", "פתיחת קבר", "סמכות מקומית", "סמכות עניינית", "אדם מעוניין", "זכות ערעור", "סעיף 19 לחוק חקירת סיבות מוות"]'::jsonb, '**וריאציה 1 — סמכות בית המשפט:** מי מוסמך להורות על פתיחת קבר? ← שופט של בית משפט השלום (סעיף 19 לחוק חקירת סיבות מוות).
**וריאציה 2 — זהות המבקש:** מי רשאי לבקש פתיחת קבר? ← קצין משטרה (סעיף 19 לחוק חקירת סיבות מוות).
**וריאציה 3 — זכות הערעור:** מי רשאי לערער על צו פתיחת קבר? ← כל ''אדם מעוניין'', כולל סב (סעיפים 19, 27 לחוק חקירת סיבות מוות).', 'פתיחת קבר ← בקשת קצין משטרה לבית משפט שלום ← ערעור של ''אדם מעוניין'' (כולל סב) למחוזי.', '["חוק חקירת סיבות מוות, תשי\"ח-1958: סע'' 19, 26, 27"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''חקירת סיבות מוות'' → mapped chapter=''criminal_proc'' subtopic=''death_investigation'' | classifier_note: Police request to exhume body for re-investigation; grandfather''s objection', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על קצין המשטרה להגיש בקשה לבית משפט השלום הקרוב ביותר למקום הקבורה להורות על פתיחת הקבר ועריכת הבדיקות. החלטת בית המשפט ניתנת לערעור על ידי סבו של המנוח.', false, 'טענה זו שגויה. הסמכות המקומית אינה נקבעת לפי בית המשפט הקרוב ביותר למקום הקבורה, אלא לפי תחום השיפוט שבו אירע המוות או נמצאת הגוויה (סעיף 19 לחוק חקירת סיבות מוות).', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על קצין המשטרה להגיש בקשה לאחד מבתי משפט השלום במחוז המרכז להורות על פתיחת הקבר ועריכת הבדיקות. החלטת בית המשפט ניתנת לערעור על ידי סבו של המנוח.', true, 'זוהי התשובה הנכונה. קצין משטרה רשאי לבקש חקירת סיבות מוות (סעיף 19 לחוק). הסמכות המקומית היא לבית משפט השלום שבתחום שיפוטו אירע המוות או נמצאת הגוויה. סעיף 27 לחוק מאפשר לכל ''אדם מעוניין'' (כהגדרתו בסעיף 19, הכולל סב) לערער על צו פתיחת קבר.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על קצין המשטרה להגיש בקשה לבית המשפט המחוזי מרכז להורות על פתיחת הקבר ועריכת הבדיקות. החלטת בית המשפט ניתנת לערעור על ידי סבו של המנוח.', false, 'טענה זו שגויה. הסמכות לדון בבקשה לחקירת סיבות מוות, לרבות פתיחת קבר, נתונה לבית משפט השלום, ולא לבית המשפט המחוזי (סעיף 19 לחוק חקירת סיבות מוות).', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על קצין המשטרה להגיש בקשה לאחד מבתי משפט השלום במחוז המרכז להורות על פתיחת הקבר ועריכת הבדיקות. החלטת בית המשפט ניתנת לערעור על ידי בנו או בתו של המנוח אך לא על ידי סבו.', false, 'טענה זו שגויה. סעיף 27 לחוק חקירת סיבות מוות מאפשר לכל ''אדם מעוניין'' לערער על צו פתיחת קבר. סעיף 19 מגדיר ''אדם מעוניין'' באופן רחב הכולל גם הורי הורים (סבים).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'סמכות מקומית לחקירת סיבות מוות',
    1, 'גופת אדם נמצאה ביער במחוז המרכז, אך המוות אירע במחוז הצפון. קצין משטרה מעוניין לפתוח בחקירת סיבות מוות. לאיזה בית משפט שלום עליו להגיש את הבקשה?', 'שאלה זו בוחנת את הבנת הסמכות המקומית לפתיחת חקירת סיבות מוות. היא מתבססת על סעיף 19 לחוק חקירת סיבות מוות, הקובע חלופה ברורה בין מקום אירוע המוות למקום מציאת הגוויה, ומאפשר גמישות בהגשת הבקשה.', 'סעיף 19 לחוק חקירת סיבות מוות, תשי"ח-1958, קובע כי בקשה לחקירת סיבת מוות תוגש ''לשופט של בית משפט השלום שבתחום שיפוטו אירע המוות או נמצאת הגוויה''. כלומר, המחוקק קבע חלופה בין שני המקומות הללו. במקרה הנדון, המוות אירע במחוז הצפון והגוויה נמצאה במחוז המרכז. לפיכך, קצין המשטרה רשאי להגיש את הבקשה לכל אחד מבתי משפט השלום הנמצאים בתחום השיפוט של מחוז הצפון (שם אירע המוות) או מחוז המרכז (שם נמצאה הגוויה). בחירה זו נתונה לשיקול דעתו של המבקש. ראו חוק חקירת סיבות מוות, תשי"ח-1958, סעיף 19.',
    'הנחה שקיימת סמכות מקומית יחידה ובלעדית, או בלבול בין מקום האירוע למקום מציאת הגוויה.', '["חקירת סיבות מוות", "סמכות מקומית", "בית משפט השלום", "מקום אירוע המוות", "מקום מציאת הגוויה", "סעיף 19 לחוק חקירת סיבות מוות"]'::jsonb, '**וריאציה 1 — מקום המוות ומקום הגוויה:** היכן ניתן להגיש בקשה לחקירת סיבות מוות אם המוות אירע במקום אחד והגוויה נמצאה במקום אחר? ← לבית משפט השלום שבתחום שיפוטו אירע המוות או נמצאה הגוויה (סעיף 19 לחוק חקירת סיבות מוות).
**וריאציה 2 — גמישות הסמכות:** האם יש עדיפות למקום מסוים? ← לא, החוק קובע חלופה, והבחירה נתונה למבקש.
**וריאציה 3 — מטרת החלופה:** מדוע קיימת חלופה זו? ← כדי לאפשר יעילות ונגישות בהגשת הבקשה, בהתאם לנסיבות המקרה.', 'חקירת סיבות מוות ← סמכות מקומית: מקום המוות או מציאת הגוויה ← בחירה למבקש.',
    '["חוק חקירת סיבות מוות, תשי\"ח-1958: סע'' 19"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'לבית משפט השלום שבתחום שיפוטו אירע המוות (מחוז הצפון) או לבית משפט השלום שבתחום שיפוטו נמצאה הגוויה (מחוז המרכז), לפי בחירתו.', true, 'זוהי התשובה הנכונה. סעיף 19 לחוק חקירת סיבות מוות קובע כי הבקשה תוגש לשופט של בית משפט השלום שבתחום שיפוטו אירע המוות או נמצאת הגוויה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'רק לבית משפט השלום שבתחום שיפוטו אירע המוות (מחוז הצפון).', false, 'טענה זו שגויה. סעיף 19 לחוק חקירת סיבות מוות מאפשר הגשת הבקשה גם לבית משפט השלום שבתחום שיפוטו נמצאה הגוויה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'רק לבית משפט השלום שבתחום שיפוטו נמצאה הגוויה (מחוז המרכז).', false, 'טענה זו שגויה. סעיף 19 לחוק חקירת סיבות מוות מאפשר הגשת הבקשה גם לבית משפט השלום שבתחום שיפוטו אירע המוות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לבית משפט השלום הקרוב ביותר למקום מגוריו של קצין המשטרה.', false, 'טענה זו שגויה. הסמכות המקומית נקבעת לפי מקום האירוע או מציאת הגוויה, ולא לפי מקום מגורי המבקש.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'תנאים למתן צו נתיחה לאחר המוות',
    2, 'מהם התנאים המצטברים ששופט חוקר צריך לבחון בטרם יורה על נתיחת גוויה, במיוחד כאשר יש התנגדות מצד בני המשפחה?', 'שאלה זו מתמקדת בתנאים המחמירים למתן צו נתיחת גוויה, במיוחד לאור הרגישות הכרוכה בכך וההתנגדות האפשרית של בני המשפחה. היא מדגישה את האיזון בין האינטרס הציבורי בחשיפת האמת לבין כבוד המת ורצון המשפחה, כפי שבא לידי ביטוי בסעיפים 26 ו-28 לחוק חקירת סיבות מוות ובסעיף 9 לחוק האנטומיה והפתולוגיה.', 'סעיף 26 לחוק חקירת סיבות מוות, תשי"ח-1958, מסמיך שופט חוקר לצוות על בדיקתה או ניתוחה של גוויה ''אם הדבר דרוש לבירור סיבת המוות בחקירה לפי סעיף 19''. סעיף 28 לחוק קובע כי הוראות חוק האנטומיה והפתולוגיה, תשי"ג-1953, יחולו גם על בדיקה וניתוח לפי סעיף 26. סעיף 9 לחוק האנטומיה והפתולוגיה מבהיר כי שופט חוקר לא יצווה על ניתוח גוויה ''אלא אם ראה שיש יסוד סביר לחשש שהמוות נגרם בעבירה או ברשלנות או בהזנחה''. בנוסף, יש לתת לבני המשפחה הזדמנות להשמיע את דבריהם. הפסיקה קבעה כי השאלה האם ראוי להורות על נתיחה היא שאלה של איזון בין האינטרס הציבורי לבין רגשות המשפחה, כאשר התנאים המצטברים הם חשש סביר לעבירה, רשלנות או הזנחה, ושהנתיחה דרושה לבירור סיבת המוות. ראו חס"מ (שלום ירושלים) 134/04 מדינת ישראל נ'' יוסף ירבטי (05.10.2004), חס"מ (שלום תל אביב-יפו) 111/04 משטרת ישראל נ'' גנאדי טפליצקי ז"ל (13.05.2004), וכן חס"מ (שלום אשקלון) 25/06 משטרת קרית גת נ'' אפלאלו יוסף ז"ל (31.08.2006).',
    'התעלמות מהדרישה הכפולה של חשש סביר לעבירה/רשלנות/הזנחה ודרישת הנחיצות לבירור סיבת המוות, או אי-הבנה של האיזון הנדרש מול רגשות המשפחה.', '["נתיחת גוויה", "חקירת סיבות מוות", "חשש סביר לעבירה", "רשלנות", "הזנחה", "איזון אינטרסים", "כבוד המת"]'::jsonb, '**וריאציה 1 — תנאים מצטברים:** מהם התנאים לנתיחת גוויה? ← חשש סביר לעבירה/רשלנות/הזנחה + נחיצות לבירור סיבת המוות (סעיפים 26, 28 לחוק חקירת סיבות מוות וסעיף 9 לחוק האנטומיה והפתולוגיה).
**וריאציה 2 — התנגדות משפחה:** האם התנגדות המשפחה מונעת נתיחה? ← לא בהכרח, אך יש לשקול אותה ולאפשר להם להשמיע טענותיהם (סעיף 9 לחוק האנטומיה והפתולוגיה).
**וריאציה 3 — איזון שיקולים:** מהו העיקרון המנחה בהחלטה? ← איזון בין האינטרס הציבורי בחשיפת האמת לבין כבוד המת ורצון המשפחה (בג"ץ שרחה).', 'צו נתיחה ← חשש סביר לעבירה/רשלנות/הזנחה + נחיצות לבירור ← איזון מול רגשות המשפחה.',
    '["חוק חקירת סיבות מוות, תשי\"ח-1958: סע'' 19, 26, 28", "חוק האנטומיה והפתולוגיה, תשי\"ג-1953: סע'' 9", "חס\"מ (שלום ירושלים) 134/04 מדינת ישראל נ'' יוסף ירבטי (05.10.2004)", "חס\"מ (שלום תל אביב-יפו) 111/04 משטרת ישראל נ'' גנאדי טפליצקי ז\"ל (13.05.2004)", "חס\"מ (שלום אשקלון) 25/06 משטרת קרית גת נ'' אפלאלו יוסף ז\"ל (31.08.2006)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'קיומו של חשש סביר שהמוות נגרם בעבירה, רשלנות או הזנחה, ושהנתיחה דרושה לבירור סיבת המוות.', true, 'זוהי התשובה הנכונה. סעיף 9 לחוק האנטומיה והפתולוגיה (המוחל על ידי סעיף 28 לחוק חקירת סיבות מוות) וסעיף 26 לחוק חקירת סיבות מוות קובעים תנאים אלו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'קיומו של חשש כלשהו שהמוות אינו טבעי, ושהנתיחה תסייע לבירור סיבת המוות, גם אם לא מדובר בעבירה.', false, 'טענה זו שגויה. נדרש ''חשש סביר'' שהמוות נגרם בעבירה, רשלנות או הזנחה, ולא רק ''חשש כלשהו'' שהמוות אינו טבעי (סעיף 9 לחוק האנטומיה והפתולוגיה).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'הסכמת בני המשפחה לנתיחה, או קיומו של אינטרס ציבורי מובהק, גם ללא חשד לעבירה.', false, 'טענה זו שגויה. הסכמת המשפחה אינה תנאי הכרחי אם מתקיימים התנאים בחוק, ואינטרס ציבורי לבדו אינו מספיק ללא חשש סביר לעבירה, רשלנות או הזנחה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'הוכחה ודאית שהמוות נגרם בעבירה, ושהנתיחה היא הדרך היחידה לגלות את זהות הממית.', false, 'טענה זו שגויה. נדרש ''חשש סביר'' ולא ''הוכחה ודאית'', ואין חובה שהנתיחה תהיה הדרך היחידה לגלות את זהות הממית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'חקירת סיבות מוות כשסיבת המוות ידועה',
    3, 'אדם נפטר בביתו מדום לב, וסיבת המוות הרפואית ברורה. עם זאת, בני משפחתו חושדים כי המוות נגרם כתוצאה מרשלנות רפואית בטיפול שקיבל המנוח לפני מותו. האם ניתן לפתוח בחקירת סיבות מוות?', 'שאלה זו בוחנת את היקף המונח ''סיבת המוות'' בחוק חקירת סיבות מוות, ואת האפשרות לפתוח בחקירה גם כאשר הסיבה הרפואית הישירה ידועה, אך קיים חשד לרשלנות או עבירה שהובילה למוות. היא מתייחסת להלכה המרחיבה של בג"ץ ריצ''וול, המאפשרת בירור נסיבות וגורמים מעבר לאירוע הביולוגי-קליני הסופי.', 'סעיף 19 לחוק חקירת סיבות מוות, תשי"ח-1958, קובע כי ניתן לפתוח בחקירה כאשר ''יש יסוד סביר לחשש שסיבת מותו אינה טבעית או שמותו נגרם בעבירה''. הפסיקה הרחיבה את פרשנות המונח ''סיבת המוות''. בבג"ץ 535/89 ריצ''וול נ'' שופט בית משפט השלום בחיפה, קבע הנשיא שמגר כי ''הביטוי חקירת סיבת המוות חובק את חקירת המוות על סיבותיו וגורמיו, ולא רק את האירוע הביולוגי-קליני הסופי המתרחש בשניה בה מגיעים חיי האדם לקיצם''. משמעות הדבר היא שגם אם הסיבה הרפואית הישירה למוות ידועה (כמו דום לב), עדיין ניתן לפתוח בחקירה אם קיים חשש סביר שגורם חיצוני (כגון רשלנות רפואית) הוביל לאותו דום לב. תכלית החוק היא לאפשר הליך שיפוטי טרומי לגילוי מעשי גרם מוות בעבירה, כאשר אינם ננקטים הליכי חקירה או הליכים פליליים אחרים. ראו חס"מ (שלום ירושלים) 125/05 חקירת סיבות מותו של המנוח גולדברג בנימין ז"ל נ'' (10.07.2005), חס"מ (שלום ירושלים) 112/05 דורון אהרון נ'' פרקליטות מחוז ירושלים (07.11.2005), וכן חס"מ (שלום ירושלים) 115/01 מובארק ג''וזף נ'' בית החולים סנט ג''וזף (27.01.2005).',
    'הבנה מצומצמת של המונח ''סיבת המוות'' כמתייחסת רק לסיבה הביולוגית-קלינית, והתעלמות מהאפשרות לחקור את הגורמים והנסיבות שהובילו למוות.', '["חקירת סיבות מוות", "סיבת המוות", "רשלנות רפואית", "בג\"ץ ריצ''וול", "יסוד סביר לחשש", "הליך טרומי"]'::jsonb, '**וריאציה 1 — סיבה רפואית ידועה:** האם ניתן לפתוח חקירת סיבות מוות אם הסיבה הרפואית (דום לב) ידועה? ← כן, אם יש חשד לרשלנות שהובילה לכך (בג"ץ ריצ''וול).
**וריאציה 2 — היקף החקירה:** מה כוללת ''חקירת סיבת המוות''? ← את סיבותיו וגורמיו, לא רק את האירוע הביולוגי-קליני הסופי (בג"ץ ריצ''וול).
**וריאציה 3 — תכלית החוק:** מהי מטרת החוק במקרים כאלה? ← ליצור הליך שיפוטי טרומי לגילוי מעשי גרם מוות בעבירה, כאשר אין חקירה אחרת (בג"ץ אזוב).', 'סיבת מוות ידועה + חשד לרשלנות ← ניתן לפתוח חקירת סיבות מוות ← ''סיבת המוות'' כוללת גורמים ונסיבות.',
    '["חוק חקירת סיבות מוות, תשי\"ח-1958: סע'' 19", "חס\"מ (שלום ירושלים) 125/05 חקירת סיבות מותו של המנוח גולדברג בנימין ז\"ל נ'' (10.07.2005)", "חס\"מ (שלום ירושלים) 112/05 דורון אהרון נ'' פרקליטות מחוז ירושלים (07.11.2005)", "חס\"מ (שלום ירושלים) 115/01 מובארק ג''וזף נ'' בית החולים סנט ג''וזף (27.01.2005)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'כן, אם קיים יסוד סביר לחשש שהמוות נגרם בעבירה, רשלנות או הזנחה, גם אם הסיבה הרפואית הישירה ידועה.', true, 'זוהי התשובה הנכונה. הפסיקה הרחיבה את המונח ''סיבת המוות'' כך שיכלול גם את הנסיבות והגורמים שהובילו למוות, ולא רק את האירוע הביולוגי-קליני הסופי (בג"ץ ריצ''וול).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לא, חקירת סיבות מוות נועדה רק למקרים בהם סיבת המוות אינה ידועה או אינה טבעית בעליל.', false, 'טענה זו שגויה. המונח ''סיבת המוות'' פורש באופן רחב בפסיקה, וכולל גם את הנסיבות והגורמים שהובילו למוות, ולא רק את הסיבה הרפואית הישירה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'כן, אך רק אם בני המשפחה יציגו חוות דעת רפואית המאשרת את חשדם לרשלנות.', false, 'טענה זו שגויה. נדרש ''יסוד סביר לחשש'' ולא הוכחה באמצעות חוות דעת רפואית כבר בשלב הבקשה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'לא, במקרה כזה יש להגיש תביעת נזיקין אזרחית ולא לפתוח בחקירת סיבות מוות.', false, 'טענה זו שגויה. חקירת סיבות מוות יכולה לשמש כהליך טרומי לגילוי מעשי גרם מוות בעבירה, גם אם קיימת אפשרות לתביעה אזרחית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'זכויות ''אדם מעוניין'' בחקירת סיבות מוות',
    4, 'מהן הזכויות העיקריות של ''אדם מעוניין'' (כגון בן משפחה) במסגרת חקירת סיבות מוות, מעבר להגשת הבקשה לפתיחתה?', 'שאלה זו בוחנת את היקף זכויותיו של ''אדם מעוניין'' בחקירת סיבות מוות. היא מדגישה כי למרות מעמדו המיוחד של ''אדם מעוניין'' (כהגדרתו בסעיף 19 לחוק), זכויותיו אינן בלתי מוגבלות, וכי יש להבחין בין זכויותיו להשמיע טענות ולערער על החלטות מסוימות, לבין זכויות אחרות כמו עיון בחומר חקירה או ייצוג על חשבון המדינה, שאינן מוקנות לו באופן מוחלט.', 'המונח ''אדם מעוניין'' מוגדר בסעיף 19 לחוק חקירת סיבות מוות, תשי"ח-1958, וכולל את בן זוגו של הנפטר, הוריו, הורי הוריו, צאצאיו, אחיו ואחיותיו. לאדם מעוניין יש זכות להגיש בקשה לפתיחת חקירת סיבות מוות. בנוסף, סעיף 27 לחוק מקנה ל''אדם מעוניין'' זכות לערער על צו לפתיחת קבר. כמו כן, כאשר שופט חוקר שוקל לצוות על נתיחת גוויה, יש לתת לאחד מבני המשפחה הודעה על הכוונה ולתת לו הזדמנות להשמיע את דבריו (סעיף 9 לחוק האנטומיה והפתולוגיה). עם זאת, זכויותיו אינן כוללות בהכרח עיון בחומר חקירה משטרתי, שכן חקירת סיבות המוות היא הליך אינקוויזיטורי ולא אדברסרי, וקיימים שיקולים למנוע שיבוש חקירה והכפשת שמות. ראו ב"ש 2/85 אלי כהן נ'' משטרת ישראל (21.01.1986), חס"מ (שלום קריות) 10766-07-09 מדינת ישראל נ'' פבל בורנקו ז"ל (03.06.2010), וכן חס"מ (שלום ירושלים) 125/05 חקירת סיבות מותו של המנוח גולדברג בנימין ז"ל נ'' (10.07.2005).',
    'הנחה שזכויות ''אדם מעוניין'' בחקירת סיבות מוות זהות לזכויות צד בהליך פלילי רגיל, או אי-הבחנה בין זכויות המוקנות בחוק לבין אלו שאינן.', '["אדם מעוניין", "חקירת סיבות מוות", "זכות ערעור", "צו פתיחת קבר", "עיון בחומר חקירה", "הליך אינקוויזיטורי"]'::jsonb, '**וריאציה 1 — זכות ערעור:** האם ''אדם מעוניין'' יכול לערער על צו פתיחת קבר? ← כן, לפי סעיף 27 לחוק חקירת סיבות מוות.
**וריאציה 2 — עיון בחומר חקירה:** האם ''אדם מעוניין'' זכאי לעיין בחומר חקירה משטרתי? ← לא בהכרח, חקירת סיבות מוות היא הליך אינקוויזיטורי (בג"ץ כהן נ'' משטרת ישראל).
**וריאציה 3 — ייצוג על חשבון המדינה:** האם ''אדם מעוניין'' זכאי לייצוג על חשבון המדינה? ← לא, החוק הישראלי שותק בעניין זה (חס"מ בורנקו).', '''אדם מעוניין'' ← זכות להשמיע טענות ולערער על צו פתיחת קבר ← אין זכות קנויה לעיון בחומר חקירה משטרתי.',
    '["חוק חקירת סיבות מוות, תשי\"ח-1958: סע'' 19, 27", "חוק האנטומיה והפתולוגיה, תשי\"ג-1953: סע'' 9", "ב\"ש 2/85 אלי כהן נ'' משטרת ישראל (21.01.1986)", "חס\"מ (שלום קריות) 10766-07-09 מדינת ישראל נ'' פבל בורנקו ז\"ל (03.06.2010)", "חס\"מ (שלום ירושלים) 125/05 חקירת סיבות מותו של המנוח גולדברג בנימין ז\"ל נ'' (10.07.2005)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'הזכות להשמיע טענותיו בפני השופט החוקר, לערער על צו פתיחת קבר, אך לא בהכרח לעיין בחומר החקירה המשטרתי.', true, 'זוהי התשובה הנכונה. ''אדם מעוניין'' רשאי להשמיע טענותיו (במיוחד בהתנגדות לנתיחה), לערער על צו פתיחת קבר (סעיף 27), אך אין לו זכות קנויה לעיין בחומר חקירה משטרתי (בג"ץ כהן נ'' משטרת ישראל).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'הזכות לעיין בכל חומר החקירה המשטרתי שנאסף, להביא עדים מטעמו ולחקור עדים אחרים.', false, 'טענה זו שגויה. אין זכות קנויה לעיין בחומר חקירה משטרתי, והיקף השתתפותו בחקירת עדים נתון לשיקול דעת השופט החוקר (בג"ץ כהן נ'' משטרת ישראל).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'הזכות לדרוש מהשופט החוקר להגיש כתב אישום נגד גורם אחראי, אם הראיות מצביעות על כך.', false, 'טענה זו שגויה. השופט החוקר רשאי, אך אינו חייב, ליתן צו אישום, ואין זו זכות של ''אדם מעוניין'' לדרוש זאת (סעיף 32 לחוק חקירת סיבות מוות).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'הזכות להיות מיוצג על ידי עורך דין על חשבון המדינה בכל שלבי החקירה.', false, 'טענה זו שגויה. חוק חקירת סיבות מוות אינו קובע זכות לייצוג על חשבון המדינה, בניגוד לשיטות משפט אחרות (חס"מ בורנקו).', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 39, '2022-S-Q39';
END
$$;

-- ============================================================
-- Q40 — 2022-S-Q40 — chapter=civil_proc subtopic=jurisdiction_subject
-- classifier_note: Eminent domain (Finance Minister land acquisition) — competing ownership claims, subject-matter jurisdiction over objections
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '140d83ea-a66a-49c3-ac19-6b714e72d575'::uuid;
  v_group_id uuid := '42840fc6-7551-41ea-a7e3-57d04b330ac8'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_0 uuid := '8587ae14-8fb8-4a65-8fbc-18f94ded59c2'::uuid;
  v_ang_1 uuid := 'c9dc0227-6946-4308-8c92-c2f97e616622'::uuid;
  v_ang_2 uuid := 'ef601638-8846-4928-8cdf-48cf14f88bb5'::uuid;
  v_ang_3 uuid := '8a01a463-e20b-4bca-84b7-3278265d34f0'::uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2022-S-Q40';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 40, '2022-S-Q40';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'civil_proc';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'civil_proc';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'jurisdiction_subject' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'jurisdiction_subject', 'civil_proc';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2022-S-Q40', v_chapter_id, v_subtopic_id, 'שר האוצר פרסם הודעה על כוונתו לרכוש קרקע לצורכי ציבור. בתגובה הוגשו 3 התנגדויות לרכישת הקרקע. את האחת הגיש ראובן, הטוען שהוא הבעלים של הקרקע, את השנייה הגיש שמעון, הטוען אף הוא לבעלות על הקרקע, ואת השלישית הגיש לוי, הטוען שהוא בעל זיקת הנאה על הקרקע. מה הדין?',
    '{"exam_year": 2022, "exam_season": "summer", "exam_part": 2, "exam_question_number": 40}'::jsonb, 'השאלה עוסקת בסמכות העניינית לדון בסכסוכים הנוגעים לזכויות קניין וטובות הנאה בקרקע המופקעת, לפי פקודת הקרקעות (רכישה לצרכי ציבור), 1943. היא מתמקדת בסעיפים 2 ו-9 לפקודה, הקובעים כי סכסוכים אלו ייושבו על ידי ''בית המשפט'', המוגדר בפקודה כבית המשפט המחוזי, וכי הבקשה ליישוב הסכסוך יכולה להיות מוגשת על ידי היועץ המשפטי לממשלה או כל אדם בעל זכות או טובת הנאה בקרקע.', 'סעיף 9 לפקודת הקרקעות (רכישה לצרכי ציבור), 1943, קובע כי אם מתעורר סכסוך בעניין סכום הפיצויים, או אם הוגשו תביעות סותרות ביחס לקרקע, או אם הממשלה טוענת שהקרקע היא אדמת ממשלה פנויה, הרי ש''כל סכסוך כזה בענין טובת ההנאה או הזכות, ייושב ע"י בית המשפט''. סעיף 2 לפקודה מגדיר במפורש את ''בית המשפט'' כ''בית המשפט המחוזי שבתחומי שיפוטו נמצאת הקרקע הנדונה''. הבקשה ליישוב הסכסוך יכולה להיות מוגשת ''לפי בקשה שיגישנה היועץ המשפטי לממשלה או לפי בקשת כל אדם שיש לו, או התובע, כל זכות או טובת הנאה בכל קרקע''. במקרה הנדון, ראובן ושמעון טוענים לבעלות, ולוי טוען לזיקת הנאה. בעלות וזיקת הנאה נכללות בהגדרת ''זכות או טובת הנאה'' בקרקע. לפיכך, הסמכות העניינית לדון בסכסוכים אלו נתונה לבית המשפט המחוזי, והבקשה יכולה להיות מוגשת על ידי כל אחד מהצדדים המעוניינים, כולל היועץ המשפטי לממשלה. ראו פקודת הקרקעות (רכישה לצרכי הצבור), 1943, סעיפים 2, 9, וכן נבו - המתמחה דיני קניין (2026) | פקודת הקרקעות (רכישה לצרכי ציבור), 1943 | סכסוכים בדבר פיצויים וזכות-קנין ייושבו ע"י בית-המשפט.', 'בלבול בין הסמכות העניינית הכללית של בתי המשפט (לפי שווי או סוג העניין) לבין הסמכות העניינית הייחודית הקבועה בפקודת הקרקעות, המייחדת את הדיון בסכסוכי זכויות בקרקע המופקעת לבית המשפט המחוזי.',
    '["פקודת הקרקעות", "סמכות עניינית", "בית משפט מחוזי", "סכסוך בעלות", "זיקת הנאה", "טובת הנאה בקרקע", "היועץ המשפטי לממשלה"]'::jsonb, '**וריאציה 1 — סכסוך בעלות בהפקעה:** מי מוסמך לדון בסכסוך בעלות על קרקע מופקעת? ← בית המשפט המחוזי (סעיפים 2 ו-9 לפקודת הקרקעות).
**וריאציה 2 — סכסוך זיקת הנאה בהפקעה:** מי מוסמך לדון בסכסוך על זיקת הנאה בקרקע מופקעת? ← בית המשפט המחוזי, שכן זיקת הנאה היא ''טובת הנאה'' בקרקע (סעיף 9 לפקודת הקרקעות).
**וריאציה 3 — יוזמי הבקשה:** מי רשאי להגיש בקשה ליישוב סכסוך כזה? ← היועץ המשפטי לממשלה או כל אדם בעל זכות/טובת הנאה בקרקע (סעיף 9 לפקודת הקרקעות).', 'סכסוכי בעלות/זכויות בקרקע מופקעת ← בית המשפט המחוזי ← לבקשת היועמ"ש או כל בעל זכות/טובת הנאה.', '["פקודת הקרקעות (רכישה לצרכי הצבור), 1943: סע'' 2, 9", "ע\"א (מחוזי ת\"א) 15654-03-17 עלי אבו טאלב נ'' עירית תל-אביב-יפו (27.8.2018)", "נבו - המתמחה דיני קניין (2026) | פקודת הקרקעות (רכישה לצרכי ציבור), 1943 | סכסוכים בדבר פיצויים וזכות-קנין ייושבו ע\"י בית-המשפט"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''סמכות עניינית'' → mapped chapter=''civil_proc'' subtopic=''jurisdiction_subject'' | classifier_note: Eminent domain (Finance Minister land acquisition) — competing ownership claims, subject-matter jurisdiction over objections', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על בית משפט השלום שבאזור שיפוטו מצויה הקרקע ליישב את הסכסוך לבקשת היועץ המשפטי לממשלה, ראובן, שמעון או לוי.', false, 'טענה זו שגויה. הסמכות העניינית לדון בסכסוכי בעלות וזכויות בקרקע בהליכי הפקעה, לפי פקודת הקרקעות, נתונה לבית המשפט המחוזי, ולא לבית משפט השלום.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על בית משפט השלום שבאזור שיפוטו מצויה הקרקע ליישב את הסכסוך לבקשת ראובן, שמעון או לוי בלבד.', false, 'טענה זו שגויה. הסמכות העניינית נתונה לבית המשפט המחוזי, ולא לבית משפט השלום. בנוסף, גם היועץ המשפטי לממשלה רשאי להגיש בקשה ליישוב סכסוך.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על בית המשפט המחוזי שבאזור שיפוטו מצויה הקרקע ליישב את הסכסוך לבקשת היועץ המשפטי לממשלה, ראובן או שמעון בלבד.', false, 'טענה זו שגויה. למרות שהסמכות נתונה לבית המשפט המחוזי, גם בעל זיקת הנאה (לוי) נחשב לבעל ''טובת הנאה'' בקרקע ורשאי להגיש בקשה ליישוב סכסוך.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על בית המשפט המחוזי שבאזור שיפוטו מצויה הקרקע ליישב את הסכסוך לבקשת היועץ המשפטי לממשלה, ראובן, שמעון או לוי.', true, 'זוהי התשובה הנכונה. סעיף 9 לפקודת הקרקעות קובע כי סכסוכים בדבר זכות קניין או טובת הנאה בקרקע ייושבו על ידי ''בית המשפט'', וסעיף 2 לפקודה מגדיר ''בית המשפט'' כבית המשפט המחוזי. הבקשה יכולה להיות מוגשת על ידי היועץ המשפטי לממשלה או כל אדם שיש לו זכות או טובת הנאה בקרקע, כולל בעלי זיקת הנאה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_0, v_sq_id, 'א', 'סמכות עניינית בתביעת פינוי לאחר הפקעה',
    1, 'רשות מקומית הפקיעה קרקע לצורך סלילת כביש, והליכי ההפקעה הסתיימו ברישום הבעלות על שמה במרשם המקרקעין. בעל הקרקע המקורי מסרב לפנות את הקרקע. לאיזה בית משפט תגיש הרשות המקומית תביעת פינוי?', 'שאלה זו עוסקת בהבחנה קריטית בסמכות העניינית בתביעות פינוי בהקשר של הפקעה. היא מדגישה כי הסמכות לבית המשפט המחוזי (לפי סעיף 8 לפקודת הקרקעות) חלה רק בשלב שטרם הוקנתה הבעלות לרשות המפקיעה. לאחר שהבעלות הוקנתה (לפי סעיף 19 לפקודה), תביעת הפינוי הופכת לתביעת חזקה רגילה, הנתונה לסמכותו העניינית של בית משפט השלום.', 'הפסיקה מבחינה בין שני שלבים בהליכי הפקעה לעניין הסמכות העניינית בתביעות פינוי. בשלב שבו טרם הסתיימו הליכי ההפקעה והקניית הבעלות לרשות המפקיעה (לפי סעיף 19 לפקודת הקרקעות), והרשות מבקשת לתפוס חזקה בקרקע, הסמכות לדון בבקשה למתן צו מסירת חזקה נתונה לבית המשפט המחוזי, מכוח סעיף 8 לפקודת הקרקעות. זאת, כיוון שסעיף 2 לפקודה מגדיר ''בית המשפט'' כבית המשפט המחוזי. לעומת זאת, משנסתיימו הליכי ההפקעה עם הקניית קניין הבעלות בידי הרשות המפקיעה מכוח סעיף 19 לפקודה, אזי החל בשלב זה, תחול על תביעת החזקה המתבססת על הקניין האמור, אותה הוראה סמכותית כללית, כשם שהיא חלה על כל תביעת חזקה רגילה, כלומר, הסמכות תהיה לבית משפט השלום. ראו ע"א (מחוזי ת"א) 15654-03-17 עלי אבו טאלב נ'' עירית תל-אביב-יפו (27.8.2018), ע"א 290/91 מדינת ישראל נ'' סלאמה מחמוד סלאמה חסן (5.5.1991), וכן ה"פ (מחוזי ת"א) 20781-05-12 הועדה המקומית לתכנון ובניה תל אביב-יפו נ'' שאול אקסלרוד (11.10.2018).',
    'בלבול בין השלבים השונים בהליך ההפקעה והסמכות העניינית המתאימה לכל שלב, או אי-הבחנה בין תביעה למסירת חזקה לפי סעיף 8 לפקודה לבין תביעת פינוי רגילה.', '["פקודת הקרקעות", "סמכות עניינית", "תביעת פינוי", "מסירת חזקה", "הקניית בעלות", "סעיף 8 לפקודה", "סעיף 19 לפקודה"]'::jsonb, '**וריאציה 1 — לפני הקניית בעלות:** רשות רוצה לתפוס חזקה בקרקע מופקעת לפני שהבעלות הוקנתה. לאן תפנה? ← לבית המשפט המחוזי (סעיף 8 לפקודת הקרקעות).
**וריאציה 2 — אחרי הקניית בעלות:** רשות רוצה לפנות מחזיק בקרקע שהבעלות עליה כבר הוקנתה לה. לאן תפנה? ← לבית משפט השלום (תביעת פינוי רגילה).
**וריאציה 3 — הגדרת ''בית המשפט'':** מהי הגדרת ''בית המשפט'' בפקודת הקרקעות? ← בית המשפט המחוזי (סעיף 2 לפקודה).', 'פינוי קרקע מופקעת: לפני הקניית בעלות ← מחוזי (סעיף 8). אחרי הקניית בעלות ← שלום (תביעת פינוי רגילה).',
    '["פקודת הקרקעות (רכישה לצרכי הצבור), 1943: סע'' 2, 8, 19", "ע\"א (מחוזי ת\"א) 15654-03-17 עלי אבו טאלב נ'' עירית תל-אביב-יפו (27.8.2018)", "ע\"א 290/91 מדינת ישראל נ'' סלאמה מחמוד סלאמה חסן (5.5.1991)", "ה\"פ (מחוזי ת\"א) 20781-05-12 הועדה המקומית לתכנון ובניה תל אביב-יפו נ'' שאול אקסלרוד (11.10.2018)", "ה\"פ (מחוזי ת\"א) 7814-06-12 הועדה המקומית לתכנון ובנייה תל אביב נ'' סמית קנדי (14.1.2019)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'א', 'לבית המשפט המחוזי, שכן מדובר בהליך הקשור להפקעה.', false, 'טענה זו שגויה. הסמכות לבית המשפט המחוזי חלה רק בשלב שטרם הסתיימו הליכי ההפקעה והקניית הבעלות (לפי סעיף 8 לפקודת הקרקעות).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ב', 'לבית משפט השלום, שכן מדובר בתביעת פינוי רגילה לאחר שהבעלות הוקנתה לרשות.', true, 'זוהי התשובה הנכונה. כאשר הליכי ההפקעה הסתיימו והבעלות הוקנתה לרשות המפקיעה (לפי סעיף 19 לפקודת הקרקעות), תביעת פינוי תוגש לבית משפט השלום, ככל תביעת חזקה רגילה, מכוח סמכותו העניינית הכללית בענייני מקרקעין.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ג', 'לבית המשפט לעניינים מינהליים, שכן מדובר בפעולה של רשות מינהלית.', false, 'טענה זו שגויה. תביעת פינוי לאחר שהבעלות הוקנתה לרשות אינה נחשבת לעניין מינהלי הדורש דיון בבית המשפט לעניינים מינהליים, אלא לתביעת חזקה רגילה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_0, 'ד', 'לבית המשפט העליון, שכן מדובר בסוגיה עקרונית הקשורה לדיני קניין.', false, 'טענה זו שגויה. בית המשפט העליון אינו ערכאה דיונית ראשונה לתביעות פינוי, אלא ערכאת ערעור או בג"ץ.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_1, v_sq_id, 'ב', 'סמכות לדון בחוקיות ההפקעה',
    2, 'ראובן מעוניין לתקוף באופן ישיר את חוקיותה של הפקעת קרקע שבוצעה על ידי שר האוצר מכוח פקודת הקרקעות. לאיזה בית משפט עליו לפנות?', 'שאלה זו בוחנת את הסמכות העניינית הייחודית לדון בתקיפה ישירה של חוקיות הפקעת מקרקעין מכוח פקודת הקרקעות. היא מדגישה את מעמדו של בג"ץ כערכאה המוסמכת לדון במעשים שלטוניים מובהקים מסוג זה, ואת ההבחנה בינו לבין סמכותן של ערכאות אחרות, גם לאחר חקיקת חוק בתי משפט לעניינים מינהליים.', 'הפסיקה קבעה באופן עקבי כי תקיפה ישירה של חוקיות הפקעת מקרקעין על פי פקודת הקרקעות היא מעשה שלטוני מובהק, ומאז הקמתו של בית המשפט הגבוה לצדק (בג"ץ) היא נידונה בפניו. גם לאחר חקיקת חוק בתי משפט לעניינים מינהליים, הפסיקה לא החילה את סמכותו של בית המשפט לעניינים מינהליים על תובענות לתקיפה ישירה של הפקעות לפי פקודת הקרקעות, אלא ייחדה את הסמכות לבג"ץ. זאת, בניגוד לתקיפה עקיפה של הפקעה, או תקיפה של הפקעות לפי חוק התכנון והבניה, אשר לגביהן עשויה להיות סמכות לערכאות אחרות. ראו ע"א 7591/01 פתחי אלג''עברי נ'' שר האוצר (9.4.2003), ת"א (מחוזי נצ'') 10493-04-21 בשאר פאהום נ'' מדינת ישראל - רשות מקרקעי ישראל (2.2.2023), וכן יצחק זמיר הסמכות המינהלית, כרך ג - הביקורת השיפוטית: כללי הסף (2014) | פרק 42: ערכאות הביקורת.',
    'הנחה שכל החלטה מינהלית נתונה לסמכות בית המשפט לעניינים מינהליים, או אי-הבחנה בין תקיפה ישירה לתקיפה עקיפה של הפקעה.', '["סמכות עניינית", "תקיפה ישירה", "הפקעת מקרקעין", "בג\"ץ", "פקודת הקרקעות", "מעשה שלטוני"]'::jsonb, '**וריאציה 1 — תקיפה ישירה של חוקיות הפקעה:** לאן פונים כדי לתקוף ישירות חוקיות הפקעה לפי פקודת הקרקעות? ← לבג"ץ (ע"א אלג''עברי).
**וריאציה 2 — סמכות בית משפט לעניינים מינהליים:** האם בית משפט לעניינים מינהליים מוסמך לדון בכך? ← לא, הפסיקה לא החילה עליו סמכות זו (ת"א פאהום).
**וריאציה 3 — תקיפה עקיפה:** האם ניתן לתקוף חוקיות הפקעה בדרך עקיפה בבית משפט מחוזי? ← כן, במקרים מסוימים, מכוח סעיף 76 לחוק בתי המשפט (דנ"א מדינת ישראל נ'' אבו פריח).', 'תקיפה ישירה של חוקיות הפקעה (פקודת הקרקעות) ← בג"ץ. תקיפה עקיפה ← מחוזי (סעיף 76).',
    '["ע\"א 7591/01 פתחי אלג''עברי נ'' שר האוצר (9.4.2003)", "בג\"ץ 5091/91 מאזן חסן זכי נוסייבה נ'' שר האוצר (9.8.1994)", "ת\"א (מחוזי נצ'') 10493-04-21 בשאר פאהום נ'' מדינת ישראל - רשות מקרקעי ישראל (2.2.2023)", "יצחק זמיר הסמכות המינהלית, כרך ג - הביקורת השיפוטית: כללי הסף (2014) | פרק 42: ערכאות הביקורת", "דנ\"א 1099/13 מדינת ישראל נ'' גארד סוילם גארד אבו פריח ז\"ל ו-34 אח'' (12.4.2015)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'א', 'לבית המשפט המחוזי, שכן הוא מוסמך לדון בענייני מקרקעין.', false, 'טענה זו שגויה. למרות שבית המשפט המחוזי מוסמך לדון בענייני מקרקעין, תקיפה ישירה של חוקיות הפקעה לפי פקודת הקרקעות נתונה לסמכותו הייחודית של בג"ץ.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ב', 'לבית המשפט העליון בשבתו כבג"ץ, שכן מדובר בתקיפה ישירה של מעשה שלטוני.', true, 'זוהי התשובה הנכונה. הפסיקה קבעה כי תקיפה ישירה של חוקיות הפקעת קרקע מכוח פקודת הקרקעות היא מעשה שלטוני מובהק, ועל כן הסמכות לדון בה נתונה לבית המשפט העליון בשבתו כבג"ץ.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ג', 'לבית המשפט לעניינים מינהליים, שכן מדובר בהחלטה מינהלית.', false, 'טענה זו שגויה. למרות שמדובר בהחלטה מינהלית, הפסיקה לא החילה את סמכות בית המשפט לעניינים מינהליים על תקיפה ישירה של הפקעות לפי פקודת הקרקעות, אלא ייחדה אותה לבג"ץ.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_1, 'ד', 'לבית משפט השלום, שכן מדובר בסכסוך על זכויות בקרקע.', false, 'טענה זו שגויה. בית משפט השלום אינו מוסמך לדון בתקיפה ישירה של חוקיות הפקעה, שהיא סוגיה בעלת אופי ציבורי-שלטוני.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_2, v_sq_id, 'ג', 'השגה על סכום פיצויים בהפקעה',
    3, 'שר האוצר הודיע על כוונתו להפקיע חטיבת קרקע הכוללת מספר חלקות, שבכל אחת מהן מספר בעלי זכויות. בעל זכויות באחת החלקות הגיש השגה על סכום הפיצויים לוועדת ההשגות. בעל זכויות בחלקה אחרת באותה חטיבת קרקע מעוניין להשיג על סכום הפיצויים. מהי הדרך היחידה העומדת בפניו?', 'שאלה זו עוסקת בהליך הייחודי להשגה על סכום פיצויי הפקעה, כפי שנקבע בסעיף 9א לפקודת הקרקעות. היא מדגישה את הכלל המיוחד הקבוע בסעיף 9א(ג), המגביל את בחירת מסלול ההשגה (שמאי מכריע או ועדת השגות) כאשר מספר בעלי זכויות באותה חטיבת קרקע מעורבים, ומבהירה את פרשנות המונח ''קרקע'' בהקשר זה.', 'סעיף 9א(א)(1) לפקודת הקרקעות (רכישה לצרכי ציבור), 1943, קובע כי בעל זכויות החולק על סכום הפיצויים שהוצע לו, רשאי לבחור בין השגה לפני שמאי מכריע לבין השגה לפני ועדת ההשגות. אולם, סעיף 9א(ג) לפקודה קובע סייג חשוב: ''על אף הוראות סעיף קטן (א), חלקו כמה בעלי זכויות בקרקע ששר האוצר הודיע על כוונה לרכשה על סכום הפיצויים, ולא כולם פנו לשמאי מכריע כאמור בסעיף קטן (א), רשאים בעלי הזכויות לפנות לוועדת ההשגות בלבד''. הפסיקה, בפרשת פז חברת נפט, פירשה את המונח ''קרקע'' בסעיף 9א(ג) כמתייחס ל''כלל החלקות שנכללו בהודעת ההפקעה''. משמעות הדבר היא שאם בעל זכויות באחת החלקות שנכללו בהודעת ההפקעה פנה לוועדת ההשגות, כל יתר בעלי הזכויות באותה חטיבת קרקע, גם אם הם בחלקות אחרות, מוגבלים אף הם לפנייה לוועדת ההשגות בלבד. ראו סעיף 9א לפקודת הקרקעות (רכישה לצרכי ציבור), 1943, וכן עע"מ 4846/20 פז חברת נפט בע"מ נ'' יושב ראש מועצת שמאי מקרקעין (30.8.2022).',
    'אי-הבנה של הכלל המיוחד בסעיף 9א(ג) והפרשנות המרחיבה של המונח ''קרקע'' בהקשר זה, או בלבול בין סכסוך על סכום פיצויים לסכסוך על זכות קניין.', '["פקודת הקרקעות", "סעיף 9א", "פיצויי הפקעה", "שמאי מכריע", "ועדת השגות", "חטיבת קרקע"]'::jsonb, '**וריאציה 1 — בחירת מסלול השגה:** בעל זכויות בקרקע מופקעת חולק על סכום הפיצויים. מהן האפשרויות? ← שמאי מכריע או ועדת השגות (סעיף 9א(א)).
**וריאציה 2 — ריבוי בעלים באותה חטיבה:** אם בעל זכויות אחד פנה לוועדת השגות, מה הדרך ליתר הבעלים באותה חטיבה? ← ועדת השגות בלבד (סעיף 9א(ג)).
**וריאציה 3 — פרשנות ''קרקע'':** מהי ''קרקע'' לעניין סעיף 9א(ג)? ← כלל החלקות שנכללו בהודעת ההפקעה (עע"מ פז).', 'השגה על פיצויים: בחירה בין שמאי לוועדה. אם אחד פנה לוועדה (באותה חטיבת קרקע) ← כולם לוועדה.',
    '["פקודת הקרקעות (רכישה לצרכי הצבור), 1943: סע'' 9א", "עע\"מ 4846/20 פז חברת נפט בע\"מ נ'' יושב ראש מועצת שמאי מקרקעין (30.8.2022)", "נבו - המתמחה דיני קניין (2026) | פקודת הקרקעות (רכישה לצרכי ציבור), 1943 | סכסוכים בענייני הפקעה"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'א', 'לפנות לשמאי מכריע, שכן הוא לא הגיש את ההשגה הראשונה.', false, 'טענה זו שגויה. סעיף 9א(ג) לפקודת הקרקעות קובע כי אם אחד מבעלי הזכויות באותה חטיבת קרקע פנה לוועדת השגות, יתר בעלי הזכויות רשאים לפנות לוועדת ההשגות בלבד.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ב', 'לפנות לוועדת ההשגות בלבד, שכן בעל זכויות אחר באותה חטיבת קרקע כבר פנה לוועדה.', true, 'זוהי התשובה הנכונה. סעיף 9א(ג) לפקודת הקרקעות קובע כי אם חלקו כמה בעלי זכויות בקרקע ששר האוצר הודיע על כוונה לרכשה על סכום הפיצויים, ולא כולם פנו לשמאי מכריע, רשאים בעלי הזכויות לפנות לוועדת ההשגות בלבד. המונח ''קרקע'' בהקשר זה פורש כ''כלל החלקות שנכללו בהודעת ההפקעה''.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ג', 'להגיש תביעה לבית המשפט המחוזי, שכן מדובר בסכסוך על סכום פיצויים.', false, 'טענה זו שגויה. סעיף 9א לפקודת הקרקעות קובע מסלולים ייחודיים ליישוב סכסוכים על סכום פיצויים (שמאי מכריע או ועדת השגות), ומוציא סכסוכים אלו מסמכות בית המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_2, 'ד', 'אין לו כל דרך להשיג על סכום הפיצויים, שכן ההחלטה כבר התקבלה.', false, 'טענה זו שגויה. קיימת דרך להשיג על סכום הפיצויים, אך היא מוגבלת לוועדת ההשגות במקרה זה.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_3, v_sq_id, 'ד', 'ביטול הפקעה עקב זניחת מטרה',
    4, 'קרקע הופקעה על ידי המדינה לפני 30 שנה לצורך הקמת בית חולים, אך בית החולים מעולם לא הוקם והקרקע עומדת בשיממונה. בעל הקרקע המקורי מעוניין להשיב לעצמו את הבעלות על הקרקע. מה הדין?', 'שאלה זו עוסקת בהלכת קרסיק ובתיקון לפקודת הקרקעות, הנוגעים לזכות להשבת קרקע שהופקעה כאשר המטרה הציבורית נזנחה. היא מדגישה את האיזון העדין בין זכות הקניין החוקתית של הפרט לבין הצורך הציבורי בהפקעה, ואת המגבלות שהוטלו על זכות ההשבה, במיוחד בהפקעות ישנות, באמצעות הוראות מעבר והתיישנות.', 'הלכת בג"ץ קרסיק (בג"ץ 2390/96) קבעה כי אם חדלה להתקיים המטרה הציבורית שבגינה הופקעו מקרקעין, ככלל, דין ההפקעה להתבטל והקרקע תושב לבעליה המקוריים, בכפוף לחריגים ולכללים שיש לגבשם. הלכה זו שיקפה שינוי בפרשנות פקודת הקרקעות על רקע חוק יסוד: כבוד האדם וחירותו. עם זאת, בעקבות הלכת קרסיק, נחקק התיקון לפקודת הקרקעות (מס'' 3), תש"ע-2010, שקבע הסדרים מפורטים לזכות להשבה ולרכישה מחדש (סעיפים 14-14ד). התיקון כלל גם הוראות מעבר, אשר קבעו התיישנות על כל טענה ביחס לפקיעת מטרת ההפקעה בנוגע לקרקע שהופקעה לפני שנת 1985. במקרה הנדון, הקרקע הופקעה לפני 30 שנה (כלומר, לפני 1996), ולכן חלה עליה הוראת המעבר המטילה התיישנות. בנוסף, הפסיקה דוחה עתירות מסוג זה גם בשל שיהוי כבד, הן במישור הסובייקטיבי והן במישור האובייקטיבי. ראו בג"ץ 42244-02-25 יורשי המנוחה רבקה בת שלום מלציק ז"ל נ'' שר האוצר (20.10.2025), בג"ץ 2390/96 יהודית קרסיק נ'' מדינת ישראל מינהל מקרקעי ישראל (13.2.2001), וכן פקודת הקרקעות (רכישה לצרכי הצבור), 1943, סעיפים 14, 14א, 14ב.',
    'התעלמות מהתיקון לפקודת הקרקעות ומהוראות המעבר שבו, או אי-הבנה של משמעות השיהוי בהגשת עתירות לביטול הפקעה.', '["הלכת קרסיק", "זניחת מטרה ציבורית", "השבת קרקע", "תיקון לפקודת הקרקעות", "התיישנות", "שיהוי", "זכות קניין חוקתית"]'::jsonb, '**וריאציה 1 — הלכת קרסיק:** מה קובעת הלכת קרסיק לגבי זניחת מטרת הפקעה? ← עקרונית, זכות להשבת הקרקע (בג"ץ קרסיק).
**וריאציה 2 — תיקון לפקודה:** מהי השפעת התיקון לפקודת הקרקעות? ← קבע הוראות מעבר והתיישנות, במיוחד להפקעות ישנות (בג"ץ מלציק).
**וריאציה 3 — שיהוי:** האם שיהוי יכול למנוע השבת קרקע? ← כן, שיהוי כבד, הן סובייקטיבי והן אובייקטיבי, יכול להביא לדחיית עתירה (בג"ץ מלציק).', 'זניחת מטרת הפקעה ← עקרונית השבה (קרסיק) ← אך כפוף לתיקון לפקודה, התיישנות ושיהוי.',
    '["פקודת הקרקעות (רכישה לצרכי הצבור), 1943: סע'' 14, 14א, 14ב", "בג\"ץ 2390/96 יהודית קרסיק נ'' מדינת ישראל מינהל מקרקעי ישראל (13.2.2001)", "בג\"ץ 42244-02-25 יורשי המנוחה רבקה בת שלום מלציק ז\"ל נ'' שר האוצר (20.10.2025)", "ע\"א 3535/04 ברכה דינר נ'' מדינת ישראל שר האוצר (27.4.2006)", "בג\"ץ 3421/05 אנדראוס מח''ול נ'' שר האוצר - משרד האוצר (18.6.2009)"]'::jsonb
  );
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'א', 'הוא זכאי להשבת הקרקע, שכן המטרה הציבורית שבגינה הופקעה הקרקע נזנחה.', false, 'טענה זו שגויה. למרות הלכת קרסיק, התיקון לפקודת הקרקעות קבע הוראות מעבר המגבילות את הזכות להשבה, במיוחד להפקעות ישנות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ב', 'הוא אינו זכאי להשבת הקרקע, שכן חל שיהוי כבד בהגשת תביעתו, והתיקון לפקודת הקרקעות קבע התיישנות על טענות מסוג זה להפקעות ישנות.', true, 'זוהי התשובה הנכונה. הלכת קרסיק קבעה עקרונית זכות להשבה, אך התיקון לפקודת הקרקעות (מס'' 3) קבע הוראות מעבר המטילות התיישנות על טענות ביחס לפקיעת מטרת ההפקעה בנוגע לקרקע שהופקעה לפני שנת 1985, וכן שיקולי שיהוי אובייקטיבי וסובייקטיבי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ג', 'הוא זכאי לפיצוי כספי נוסף, אך לא להשבת הקרקע.', false, 'טענה זו שגויה. הזכות להשבה או לפיצוי נוסף תלויה בנסיבות ובמועד ההפקעה, ואינה אוטומטית במקרה של זניחת מטרה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_3, 'ד', 'הוא זכאי להשבת הקרקע רק אם יוכיח שהמדינה פעלה בחוסר תום לב.', false, 'טענה זו שגויה. למרות שתום לב הוא שיקול, הזכות להשבה כפופה להוראות התיקון לפקודת הקרקעות, שקבעו מגבלות זמן והתיישנות.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 40, '2022-S-Q40';
END
$$;


-- ============================================================
-- Register this migration in Supabase's schema_migrations registry.
-- Idempotent: ON CONFLICT DO NOTHING in case the file is re-applied.
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260528000002', 'add_2022_summer_procedural_q1_to_q40')
ON CONFLICT (version) DO NOTHING;