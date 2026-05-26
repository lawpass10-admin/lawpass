-- Migration: add_2024_winter_substantive_q1_to_q28
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
-- Q01 — 2024-W-S-Q01 — chapter=corporate subtopic=companies_formation
-- classifier_note: Class A vs class B shareholders; article-amendment harming a class — companies act §20
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '6509092d-3b9d-4bd2-bb02-8f9ff1f02728'::uuid;
  v_group_id uuid := '1f393b97-f76c-4db3-8f2e-038a7166fd57'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q01';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 1, '2024-W-S-Q01';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'corporate';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'corporate';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'companies_formation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'companies_formation', 'corporate';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q01', v_chapter_id, v_subtopic_id, 'בחברת "הלל" יש שני סוגי מניות. בעלי המניות שמחזיקים במניות מסוג A מעוניינים לבצע שינוי בתקנון החברה הפוגע בזכויותיהם של בעלי המניות מסוג B. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 1}'::jsonb, 'השאלה עוסקת בעקרון הגנת זכויות סוג מניות בחברה בעת שינוי תקנון, כפי שמעוגן בסעיף 20(ג) לחוק החברות. עקרון זה נועד לאזן בין שלטון הרוב בחברה לבין הצורך להגן על זכויות מיוחדות של קבוצות מיעוט בעלות סוגי מניות שונים.', 'סעיף 20(ג) לחוק החברות, התשנ"ט-1999, קובע כי כאשר מניות החברה מחולקות לסוגים, לא ייעשה שינוי בתקנון שיפגע בזכויותיו של סוג מניות ללא אישור אסיפת אותו סוג, אלא אם כן נקבע אחרת בתקנון. הוראה זו מהווה הגנה מהותית על בעלי מניות מיעוט המחזיקים בסוג מניות ספציפי, ומונעת מבעלי מניות הרוב לפגוע בזכויותיהם הייחודיות באמצעות שינוי התקנון. הפסיקה מדגישה את חשיבות ההגנה על ציפיות לגיטימיות של בעלי מניות, אך גם מכירה בחופש החוזי של הצדדים לקבוע הסדרים שונים בתקנון, לרבות ויתור על דרישת אסיפת הסוג. במקרה הנדון, הפגיעה בזכויות בעלי מניות מסוג B מחייבת את אישור אסיפת הסוג שלהם, אלא אם התקנון קובע במפורש הסדר אחר. סעיף 20(ג) לחוק החברות, תשנ"ט-1999ה"פ (כלכלית ) 48227-05-17 שלמה לב נ'' ברוך טולדנו (14.04.2021)ת"א (כלכלית ) 21416-08-14 שי טופז (יוכט) נ'' עזבון המנוח פישר יששכר ז"ל (02.03.2017)', 'טעות נפוצה היא להניח שכל שינוי בתקנון דורש רוב רגיל באסיפה הכללית, מבלי להבחין בהוראות הספציפיות המגנות על זכויות סוגי מניות שונים, או לחילופין, לחשוב ששינוי כזה אינו אפשרי כלל.',
    '["חוק החברות", "תקנון חברה", "סוגי מניות", "אסיפת סוג", "פגיעה בזכויות", "רוב מיוחד", "הגנת המיעוט"]'::jsonb, '**וריאציה 1 — תקנון שקובע אחרת:** מה הדין אם התקנון קובע במפורש ששינוי הפוגע בזכויות סוג מניות אינו דורש אישור אסיפת סוגהתקנון גובר, ואין צורך באישור אסיפת הסוג, שכן סעיף 20(ג) מאפשר התנאה (סעיף 20(ג) לחוק החברות).
**וריאציה 2 — פגיעה בזכויות:** מה נחשב ל''פגיעה בזכויות'' לצורך סעיף 20(גפגיעה ישירה בזכויות המהותיות הצמודות לסוג המניות, כגון זכויות הצבעה או דיבידנד (ע"א 3432/17 שי טופז (יוכט) נ'' חיים יוכט).
**וריאציה 3 — חובת תום לב:** האם שינוי תקנון כפוף לחובת תום הלבכן, שינוי תקנון כפוף לחובת הרוב לנהוג בתום לב ובדרך מקובלת לטובת החברה ובעלי מניותיה (ת"א (כלכלית ) 21416-08-14 שי טופז (יוכט) נ'' עזבון המנוח פישר יששכר ז"ל).', 'שינוי תקנון הפוגע בזכויות סוג מניותדורש אישור אסיפת סוג (סעיף 20(ג) לחוק החברותאלא אם נקבע אחרת בתקנון.', '["חוק החברות, תשנ\"ט-1999, סעיף 20", "ע\"א 3432/17 שי טופז (יוכט) נ'' חיים יוכט (16.04.2020)", "ת\"א (כלכלית ) 21416-08-14 שי טופז (יוכט) נ'' עזבון המנוח פישר יששכר ז\"ל (02.03.2017)", "ה\"פ (כלכלית ) 48227-05-17 שלמה לב נ'' ברוך טולדנו (14.04.2021)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''corporate'' subtopic=''companies_formation'' | classifier_note: Class A vs class B shareholders; article-amendment harming a class — companies act §20 | source_review_note: שאלת המקור עוסקת בדיני חברות (שינוי תקנון וזכויות סוגי מניות), תחום שאינו מופיע ברשימת הפרקים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''סדר דין אזרחי - הליכים'' לצורך סיווג.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'מכיוון שהשינוי המבוקש פוגע בזכויותיהם של בעלי המניות מסוג B, הרי שהשינוי אינו אפשרי.', false, 'תשובה זו שגויה. שינוי הפוגע בזכויות סוג מניות הוא אפשרי, אך הוא כפוף לדרישות ספציפיות הקבועות בחוק, כגון אישור אסיפת הסוג, אלא אם נקבע אחרת בתקנון.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'ניתן לבצע שינוי כאמור ובלבד שניתן אישור של רוב רגיל באסיפה הכללית ואין הוראה אחרת בתקנון החברה או בחוזה אחר של החברה הקובעת אחרת.', false, 'תשובה זו שגויה. רוב רגיל באסיפה הכללית אינו מספיק כאשר השינוי פוגע בזכויותיו של סוג מניות, אלא נדרש אישור אסיפת הסוג, אלא אם נקבע אחרת בתקנון.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'מכיוון שהשינוי פוגע בזכויותיהם של בעלי המניות מסוג B, אזי נדרש אישור של לפחות 3/4 מבעלי המניות באסיפה הכללית.', false, 'תשובה זו שגויה. אף שרוב מיוחס של 3/4 נדרש במקרים מסוימים (למשל, בחברות שהתאגדו לפני חוק החברות לפי סעיף 24(3)), במקרה של פגיעה בזכויות סוג מניות, הדרישה הספציפית היא לאישור אסיפת הסוג, ולא לרוב מיוחס באסיפה הכללית, אלא אם נקבע אחרת בתקנון.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'כדי לבצע שינוי כאמור נדרש לקבל אישור של אסיפת בעלי המניות מסוג B, אלא אם נקבע אחרת בתקנון.', true, 'זו התשובה הנכונה. סעיף 20(ג) לחוק החברות קובע כי שינוי בתקנון הפוגע בזכויותיו של סוג מניות מחייב אישור של אסיפת אותו סוג, אלא אם נקבע אחרת בתקנון.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 1, '2024-W-S-Q01';
END
$$;

-- ============================================================
-- Q02 — 2024-W-S-Q02 — chapter=property subtopic=pledge
-- classifier_note: Pledge on a car, double-financing — pledge law
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '8393c3d5-48f4-4fa1-b054-1145bd293524'::uuid;
  v_group_id uuid := '16ba27ab-56a6-45af-9ec5-a1cf7e9aaeae'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q02';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 2, '2024-W-S-Q02';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'property';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'property';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'pledge' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'pledge', 'property';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q02', v_chapter_id, v_subtopic_id, 'יצחק לקח הלוואה מחברו יעקב לשם רכישת רכב ורשם משכון לטובתו על הרכב. הכסף לא הספיק לתשלום עבור הרכב, ולפיכך פנה לחברת ביטוח לשם קבלת הלוואה נוספת. חברת הביטוח התנתה את מתן ההלוואה במישכון הרכב לשם הבטחת ההלוואה ויצחק הסכים לכך. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 2}'::jsonb, 'השאלה עוסקת בזכותו של חייב למשכן נכס שכבר ממושכן, וקובעת את סדר הקדימות בין הנושים. היא מבוססת על סעיף 6(א) לחוק המשכון, המאזן בין חופש הקניין של החייב לבין הגנת הנושה הראשון.', 'סעיף 6(א) לחוק המשכון, תשכ"ז-1967, קובע כי החייב רשאי לשעבד נכס ממושכן במשכון נוסף ללא נטילת רשות מהנושה הראשון, אלא אם נקבע אחרת בהסכם המשכון הקודם. עם זאת, נושה נוסף לא יוכל להיפרע מהמשכון אלא לאחר שסולק החיוב שהובטח במשכון שלפניו. הוראה זו מבטיחה את עדיפותו של הנושה הראשון בזמן. במקרה הנדון, לא צוין כי בהסכם המשכון עם יעקב קיימת תניה המגבילה את יצחק מלמשכן את הרכב במשכון נוסף. לפיכך, יצחק רשאי למשכן את הרכב לחברת הביטוח, אך זכותה של חברת הביטוח תהיה נחותה מזו של יעקב, והיא תיפרע רק לאחר שיעקב ייפרע במלואו. סעיף 6(א) לחוק המשכון, תשכ"ז-1967. רע"א 8574/13 ירון לוי נ'' עזבון המנוח פרדי זנזורי ז"ל (28.01.2014). ה"פ (מחוזי מרכז) 9642-02-15 ברי כהן נ'' עתיד החברה לחיזוק מבנים בע"מ (06.12.2015)', 'טעות נפוצה היא לחשוב שלא ניתן למשכן נכס שכבר ממושכן, או שנדרשת הסכמת הנושה הראשון בכל מקרה, מבלי להבחין בין המצב הכללי לבין קיומה של תניה מגבילה ספציפית בהסכם המשכון הראשון.',
    '["חוק המשכון", "משכון נוסף", "סדר קדימות", "נושה מובטח", "חופש הקניין", "תניה מגבילה"]'::jsonb, '**וריאציה 1 — זכות החייב למשכן:** האם חייב רשאי למשכן נכס שכבר ממושכןכן, אלא אם נקבע אחרת בהסכם המשכון הראשון (סעיף 6(א) לחוק המשכון).
**וריאציה 2 — סדר קדימות:** מהו סדר הקדימות בין משכון ראשון למשכון שניהמשכון הראשון קודם למשכון השני, והנושה השני ייפרע רק לאחר סילוק החוב הראשון (סעיף 6(א) לחוק המשכון).
**וריאציה 3 — הסכמת הנושה הראשון:** האם נדרשת הסכמת הנושה הראשון למשכון נוסףלא, אלא אם נקבע אחרת בהסכם המשכון הקודם (סעיף 6(א) לחוק המשכון).', 'חייב רשאי למשכן נכס ממושכן נוסף (סעיף 6(אללא הסכמת הנושה הראשון (אלא אם הוגבלהנושה הראשון קודם לנושה השני.', '["חוק המשכון, תשכ\"ז-1967, סעיף 6(א)", "רע\"א 8574/13 ירון לוי נ'' עזבון המנוח פרדי זנזורי ז\"ל (28.01.2014)", "ה\"פ (מחוזי מרכז) 9642-02-15 ברי כהן נ'' עתיד החברה לחיזוק מבנים בע\"מ (06.12.2015)"]'::jsonb,
    'classification_review: original chapter=''הוצאה לפועל'' subtopic=''עיקול נכסים'' → mapped chapter=''property'' subtopic=''pledge'' | classifier_note: Pledge on a car, double-financing — pledge law | source_review_note: השאלה עוסקת בדיני משכון, תחום שאינו מופיע ברשימת הפרקים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''הוצאה לפועל - עיקול נכסים'' לצורך סיווג.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'לא ניתן למשכן נכס שכבר ממושכן לאחר.', false, 'תשובה זו שגויה. סעיף 6(א) לחוק המשכון מאפשר לחייב למשכן נכס שכבר ממושכן, אלא אם נקבע אחרת בהסכם המשכון הקודם.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על יצחק לקבל את הסכמת יעקב למישכון הרכב לחברת הביטוח.', false, 'תשובה זו שגויה. סעיף 6(א) לחוק המשכון קובע כי החייב רשאי למשכן נכס נוסף ללא נטילת רשות מהנושה הראשון, אלא אם נקבע אחרת בהסכם המשכון הקודם. במקרה זה לא צוינה תניה כזו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'יצחק רשאי למשכן את הרכב לחברת הביטוח ללא קבלת הסכמת יעקב. אם לא יחזיר יצחק את ההלוואות, זכותו של יעקב קודמת לזו של חברת הביטוח.', true, 'זו התשובה הנכונה. סעיף 6(א) לחוק המשכון קובע כי החייב רשאי לשעבד נכס ממושכן במשכון נוסף ללא נטילת רשות מהנושה הראשון, וכי הנושה השני ייפרע רק לאחר סילוק החיוב של הנושה הראשון.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'יצחק רשאי למשכן את הרכב לחברת הביטוח ללא קבלת הסכמת יעקב. אם לא יחזיר יצחק את ההלוואות, יעקב וחברת הביטוח יתחלקו בתמורת מכירת הרכב באופן יחסי לגובה הלוואותיהם.', false, 'תשובה זו שגויה. סעיף 6(א) לחוק המשכון קובע במפורש כי הנושה השני ייפרע רק לאחר סילוק החיוב של הנושה הראשון, ולא בחלוקה יחסית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 2, '2024-W-S-Q02';
END
$$;

-- ============================================================
-- Q03 — 2024-W-S-Q03 — chapter=contracts subtopic=lease_bailment
-- classifier_note: Apartment lease, extension option — lease law
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'f8eb166b-2cf2-4515-afff-ae06fd19d350'::uuid;
  v_group_id uuid := 'c5d09af7-f25b-4863-95f9-043d96790501'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q03';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 3, '2024-W-S-Q03';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lease_bailment' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'lease_bailment', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q03', v_chapter_id, v_subtopic_id, 'מירית שכרה מאלונה דירת מגורים לשנה אחת. החוזה כולל ברירה (אופציה) להארכתו לתקופה של שנה אחת נוספת, ואולם החוזה אינו קובע מתי יש להודיע על הברירה לצד השני. כמה זמן לפני תום תקופת השכירות יש להודיע על הרצון לקיים את הברירה?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 3}'::jsonb, 'השאלה עוסקת במועדי הודעה למימוש אופציה בחוזה שכירות למגורים, בהתאם להוראות חוק השכירות והשאילה. היא מדגישה את ההבחנה בין מועדי ההודעה הנדרשים מהמשכיר לבין אלו הנדרשים מהשוכר, כאשר החוזה אינו קובע מועד ספציפי.', 'חוק השכירות והשאילה, התשל"א-1971, תוקן בשנת 2017 והוסיף הוראות ספציפיות לגבי שכירות למגורים. סעיף 25יב לחוק קובע את מועדי ההודעה למימוש ברירה (אופציה) להארכת תקופת השכירות, כאשר החוזה אינו מפרט מועד כזה. סעיף 25יב(ב) קובע כי אם למשכיר הייתה ברירה להארכת תקופת השכירות, עליו להודיע לשוכר לא יאוחר מ-90 ימים לפני תום תקופת השכירות. לעומת זאת, סעיף 25יב(ג) קובע כי אם לשוכר הייתה ברירה להארכת תקופת השכירות, עליו להודיע למשכיר לא יאוחר מ-60 ימים לפני תום תקופת השכירות. הוראות אלו נועדו להבטיח ודאות לצדדים כאשר החוזה שותק בעניין זה. סעיף 25יב(ב) לחוק השכירות והשאילה, התשל"א-1971. סעיף 25יב(ג) לחוק השכירות והשאילה, התשל"א-1971. אבי וינרוט דיני קניין - פרקי יסוד (2024) | פרק ז שכירות', 'טעות נפוצה היא לבלבל בין מועדי ההודעה הנדרשים מהמשכיר לבין אלו הנדרשים מהשוכר, או להתעלם מהוראות החוק כאשר החוזה אינו מפרט את מועד ההודעה.',
    '["חוק השכירות והשאילה", "שכירות למגורים", "אופציה", "ברירה", "מועדי הודעה", "משכיר", "שוכר"]'::jsonb, '**וריאציה 1 — ברירה למשכיר:** אם למשכיר ברירה להארכת השכירות והחוזה שותק, מתי עליו להודיעלא יאוחר מ-90 ימים לפני תום תקופת השכירות (סעיף 25יב(ב) לחוק השכירות והשאילה).
**וריאציה 2 — ברירה לשוכר:** אם לשוכר ברירה להארכת השכירות והחוזה שותק, מתי עליו להודיעלא יאוחר מ-60 ימים לפני תום תקופת השכירות (סעיף 25יב(ג) לחוק השכירות והשאילה).
**וריאציה 3 — חשיבות הפירוט בחוזה:** מה קורה אם החוזה מפרט את תנאי הברירההוראות החוזה גוברות, שכן סעיף 25יב חל רק ''באין קביעה אחרת'' (נבו - המתמחה דיני קניין (2026) | תשלומים שוטפים שבהם נושא השוכר).', 'מועדי הודעה למימוש אופציה בשכירות למגורים (כשהחוזה שותק): משכיריום, שוכריום (סעיף 25יב לחוק השכירות והשאילה).', '["חוק השכירות והשאילה, תשכ\"א-1971, סעיף 25יב", "אבי וינרוט דיני קניין - פרקי יסוד (2024) | פרק ז שכירות", "נבו - המתמחה דיני קניין (2026) | תשלומים שוטפים שבהם נושא השוכר"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''lease_bailment'' | classifier_note: Apartment lease, extension option — lease law | source_review_note: שאלת המקור עוסקת בדיני שכירות, תחום שאינו מופיע ברשימת הפרקים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''סדר דין אזרחי - הליכים'' לצורך סיווג.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'לא יאוחר מ-60 ימים לפני סוף התקופה.', false, 'תשובה זו שגויה. 60 ימים הוא המועד הקבוע לשוכר, אך לא למשכיר, והשאלה אינה מפרטת מי בעל הברירה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לא יאוחר מ-90 ימים לפני סוף התקופה.', false, 'תשובה זו שגויה. 90 ימים הוא המועד הקבוע למשכיר, אך לא לשוכר, והשאלה אינה מפרטת מי בעל הברירה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אם הברירה לטובת המשכיר – לא יאוחר מ-90 ימים לפני סוף התקופה, ואם הברירה לטובת השוכר – לא יאוחר מ-60 ימים לפני סוף התקופה.', true, 'זו התשובה הנכונה. סעיף 25יב(ב) לחוק השכירות והשאילה קובע כי אם למשכיר ברירה, עליו להודיע 90 ימים מראש. סעיף 25יב(ג) קובע כי אם לשוכר ברירה, עליו להודיע 60 ימים מראש.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אם הברירה לטובת המשכיר – לא יאוחר מ-60 ימים לפני סוף התקופה, ואם הברירה לטובת השוכר – לא יאוחר מ-90 ימים לפני סוף התקופה.', false, 'תשובה זו שגויה. היא מבלבלת בין המועדים הקבועים למשכיר ולשוכר.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 3, '2024-W-S-Q03';
END
$$;

-- ============================================================
-- Q04 — 2024-W-S-Q04 — chapter=administrative subtopic=planning_building
-- classifier_note: Town-planning compensation for damage from a plan
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '7e568121-9a8c-4c5e-b496-8a8b57219a8c'::uuid;
  v_group_id uuid := '33d9caa6-f839-4318-bd6a-f372a2114f89'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q04';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 4, '2024-W-S-Q04';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'administrative';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'administrative';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'planning_building' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'planning_building', 'administrative';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q04', v_chapter_id, v_subtopic_id, 'בעקבות אישורה של תוכנית בניין עיר חדשה טוען ראובן כי מקרקעין בבעלותו נפגעו, אף על פי שלא יועדו להפקעה, וכי הוא מעוניין בפיצוי. הוועדה המקומית סבורה שאין לפצות את ראובן. בנסיבות המתוארות, איזה מההיגדים הבאים הוא הנכון ביותר?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 4}'::jsonb, 'השאלה עוסקת בזכות לפיצויים בגין פגיעה במקרקעין על ידי תוכנית, שלא בדרך הפקעה, לפי סעיף 197 לחוק התכנון והבניה, ובפטור מתשלום פיצויים לפי סעיף 200 לאותו חוק. היא מתמקדת בנטל ההוכחה המוטל על הצדדים ובאיזון בין זכות הקניין של הפרט לאינטרס הציבורי.', 'סעיף 197(א) לחוק התכנון והבניה קובע כי בעל מקרקעין שנפגעו על ידי תוכנית, שלא בדרך הפקעה, זכאי לפיצויים מהוועדה המקומית, בכפוף לאמור בסעיף 200. נטל השכנוע להוכחת התקיימות יסודותיו של סעיף 197 (קיומה של תוכנית, פגיעה במקרקעין וקשר סיבתי) מוטל על תובע הפיצויים. משעמד התובע בנטל זה והוכיח פגיעה, עובר הנטל לוועדה המקומית להוכיח את התקיימות שלושת התנאים המצטברים שבסעיף 200 לפטור מפיצוי: (1) הפגיעה נמנית עם אחת ההוראות המפורטות בסעיף; (2) הפגיעה אינה עוברת את תחום הסביר בנסיבות העניין; (3) אין זה מן הצדק לשלם לנפגע פיצויים. רק אם שלושת התנאים מתקיימים במצטבר, תופטר הוועדה המקומית מתשלום פיצויים. סעיף 197(א) לחוק התכנון והבניה, תשכ"ה-1965. סעיף 200 לחוק התכנון והבניה, תשכ"ה-1965. עע"מ 683/13 רשות שדות התעופה נ'' אליהו טויטו ואח'' (03.09.2015). ע"א 5958/15 פרחי ביקל בע"מ נ'' הועדה המקומית לתכנון ולבניה - ראשון לציון (31.12.2015). עמ"נ (מינהליים י-ם) 305/06 הוועדה המקומית לתכנון ולבניה ירושלים נ'' יששכר מ. חברה לבנין ופיתוח בע"מ (26.08.2010)', 'הטעות הנפוצה היא לבלבל בין נטל ההוכחה הראשוני המוטל על התובע לבין נטל ההוכחה המוטל על הוועדה המקומית לעניין הפטור, או לחשוב שפגיעה שאינה הפקעה אינה מזכה בפיצוי.',
    '["חוק התכנון והבניה", "סעיף 197", "סעיף 200", "פיצויים בגין פגיעה מתכנית", "נטל הוכחה", "פטור מפיצויים", "פגיעה סבירה", "צדק חלוקתי"]'::jsonb, '**וריאציה 1 — נטל הוכחת הפגיעה:** מי נושא בנטל להוכיח שהתוכנית פגעה במקרקעיןהתובע (ראובן) (סעיף 197(א) לחוק התכנון והבניה).
**וריאציה 2 — נטל הוכחת הפטור:** מי נושא בנטל להוכיח את תנאי הפטור שבסעיףהוועדה המקומית (עע"מ 683/13 רשות שדות התעופה נ'' אליהו טויטו ואח'').
**וריאציה 3 — תנאי הפטור:** מהם שלושת התנאים המצטברים לפטור מפיצויים לפי סעיףסוג הפגיעה, סבירות הפגיעה, וצדק (שאין זה מן הצדק לשלם פיצויים) (סעיף 200 לחוק התכנון והבניה).', 'פיצויים לפי סעיףנטל הוכחת פגיעה על התובענטל הוכחת פטור (סעיף 200) על הוועדה המקומית (3 תנאים מצטברים).', '["חוק התכנון והבניה, תשכ\"ה-1965, סעיף 197", "חוק התכנון והבניה, תשכ\"ה-1965, סעיף 200", "עע\"מ 683/13 רשות שדות התעופה נ'' אליהו טויטו ואח'' (03.09.2015)", "ע\"א 5958/15 פרחי ביקל בע\"מ נ'' הועדה המקומית לתכנון ולבניה - ראשון לציון (31.12.2015)", "עמ\"נ (מינהליים י-ם) 305/06 הוועדה המקומית לתכנון ולבניה ירושלים נ'' יששכר מ. חברה לבנין ופיתוח בע\"מ (26.08.2010)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''administrative'' subtopic=''planning_building'' | classifier_note: Town-planning compensation for damage from a plan | source_review_note: שאלת המקור עוסקת בדיני תכנון ובניה (פיצויים בגין פגיעה מתכנית), תחום שאינו מופיע ברשימת הפרקים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''סדר דין אזרחי - הליכים'' לצורך סיווג.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על ראובן להוכיח שהתוכנית פגעה בשווי מגרשו, ואם הוכיח זאת, על הוועדה המקומית להוכיח שמדובר בפגיעה מן הסוג שאינו מקנה פיצוי וכי הפגיעה סבירה ואין זה צודק לפצות בגינה.', true, 'זו התשובה הנכונה. נטל השכנוע להוכחת הפגיעה מוטל על התובע (ראובן), ומשעמד בנטל זה, עובר הנטל לוועדה המקומית להוכיח את התקיימות שלושת התנאים המצטברים שבסעיף 200 לחוק התכנון והבניה לפטור מפיצוי.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על ראובן להוכיח שהתוכנית פגעה בשווי מגרשו, ואם הוכיח זאת, על הוועדה המקומית להוכיח שמדובר בפגיעה מן הסוג שאינו מקנה פיצוי. אם הוועדה המקומית הוכיחה זאת, על מנת לזכות בכל זאת בפיצוי על ראובן להוכיח כי הפגיעה אינה סבירה וכי זה צודק לפצות בגינה.', false, 'תשובה זו שגויה. נטל ההוכחה להתקיימות תנאי הפטור שבסעיף 200 (סוג הפגיעה, סבירות וצדק) מוטל במלואו על הוועדה המקומית, ולא עובר בחזרה לתובע.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על מנת לזכות בפיצוי על ראובן להוכיח שהתוכנית פגעה בשווי מגרשו בשיעור של 15% לפחות מערכו.', false, 'תשובה זו שגויה. הפסיקה קבעה במפורש כי אין לקבוע רף אחיד וקבוע באחוזים לשיעור הפגיעה הנחשבת סבירה או בלתי סבירה, וכי הדבר נבחן בכל מקרה לגופו.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'מאחר שהמגרש נותר כולו בבעלות ראובן, לא נפגעה זכות הקניין שלו והוא אינו זכאי כלל לפיצוי.', false, 'תשובה זו שגויה. סעיף 197 לחוק התכנון והבניה מעניק פיצוי גם על פגיעה במקרקעין שלא בדרך הפקעה, כלומר גם כאשר המקרקעין נותרים בבעלותו המלאה של הנפגע, אך ערכם ירד כתוצאה מהתוכנית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 4, '2024-W-S-Q04';
END
$$;

-- ============================================================
-- Q05 — 2024-W-S-Q05 — chapter=contracts subtopic=insurance_contract
-- classifier_note: Property-insurance burden of proof
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'e4da0937-88e3-4778-b033-87857da3cff4'::uuid;
  v_group_id uuid := 'ee538e04-49f1-4fc1-b2fb-30971b1d3309'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q05';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 5, '2024-W-S-Q05';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'insurance_contract' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'insurance_contract', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q05', v_chapter_id, v_subtopic_id, 'מהו הכלל בדבר נטלי הראיה בתביעת ביטוח רכוש?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 5}'::jsonb, 'השאלה עוסקת בכלל הבסיסי בדבר נטלי הראיה בתביעות ביטוח רכוש, כפי שנקבע בפסיקה ובהתאם לחוק חוזה הביטוח. היא מבהירה את חלוקת הנטלים בין המבוטח, שעליו להוכיח את קרות מקרה הביטוח ואת שיעור הנזק, לבין המבטח, שעליו להוכיח את קיומו של סייג לחבותו.', 'הכלל המנחה לעניין נטלי הראיה בתביעות ביטוח רכוש נקבע בפסיקה עקבית של בית המשפט העליון, ובראשה ע"א 678/86 חסן חניפס נ'' "סהר" חברה לביטוח בע"מ. על פי כלל זה, על המבוטח מוטל נטל השכנוע להוכיח כי מקרה הביטוח התרחש וכי נגרם לו נזק, וכן את שיעור הנזק. משעמד המבוטח בנטל זה, עובר נטל השכנוע אל חברת הביטוח, הטוענת לפטור מאחריות על פי איזה מן הסייגים שנכללו בתניות הפוליסה או בחוק. על המבטח להוכיח כי המקרה נושא תביעתו של המבוטח נכנס לגדרו של אותו סייג. כלל זה מבטא איזון בין הצורך להגן על המבוטח לבין הצורך לאפשר למבטח להתגונן מפני תביעות שאינן מוצדקות. ע"א 678/86 חסן חניפס נ'' "סהר" חברה לביטוח בע"מ (22.08.1989). ירון אליאס דיני ביטוח (2016) | פרק 30.1 נטל ההוכחה בתביעות ביטוח. תא"מ (שלום הרצ'') 5530-05-10 יובל אברהם נ'' הראל חברה לביטוח בע"מ (29.07.2015). איל זמיר, מרדכי א'' ראבילו, גבריאלה שלו הפירוש הקצר לחוקים במשפט הפרטי (1996) | סעיף 56 - היקף החבות', 'הטעות הנפוצה היא לייחס למבוטח נטל כבד יותר ממה שנדרש ממנו, כגון הוכחת היעדר סייגים לחבות, או לבלבל בין נטל השכנוע לנטל הבאת הראיות.',
    '["נטל שכנוע", "נטל הבאת ראיות", "מקרה ביטוח", "סייג לחבות", "ביטוח רכוש", "חוק חוזה הביטוח"]'::jsonb, '**וריאציה 1 — נטל המבוטח:** מה על המבוטח להוכיח בתביעת ביטוח רכושקרות מקרה הביטוח ושיעור הנזק (ע"א 678/86 חסן חניפס נ'' "סהר" חברה לביטוח בע"מ).
**וריאציה 2 — נטל המבטח:** מה על המבטח להוכיח בתביעת ביטוח רכושקיומו של סייג לחבות הפוטר אותו מאחריות (ע"א 678/86 חסן חניפס נ'' "סהר" חברה לביטוח בע"מ).
**וריאציה 3 — חלוקת נטלים כללית:** האם חלוקת הנטלים משתנה בין סוגי ביטוח רכושלא, הגישה לכל מקרה ביטוח רכוש צריכה להיות אחידה לעניין חלוקת נטלי השכנוע (ע"א 1845/90 רוני סיני נ'' מגדל חברה לביטוח בע"מ (30.03.1993)).', 'בתביעת ביטוח רכוש: המבוטח מוכיח מקרה ביטוח ונזק. המבטח מוכיח סייג לחבות. (הלכת חניפס).', '["חוק חוזה הביטוח, תשמ\"א-1981, סעיף 1", "ע\"א 678/86 חסן חניפס נ'' \"סהר\" חברה לביטוח בע\"מ (22.08.1989)", "ירון אליאס דיני ביטוח (2016) | פרק 30.1 נטל ההוכחה בתביעות ביטוח", "תא\"מ (שלום הרצ'') 5530-05-10 יובל אברהם נ'' הראל חברה לביטוח בע\"מ (29.07.2015)", "איל זמיר, מרדכי א'' ראבילו, גבריאלה שלו הפירוש הקצר לחוקים במשפט הפרטי (1996) | סעיף 56 - היקף החבות"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''insurance_contract'' | classifier_note: Property-insurance burden of proof | source_review_note: השאלה עוסקת בדיני ביטוח (נטלי הראיה), תחום שאינו מופיע ברשימת הפרקים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''סדר דין אזרחי - הליכים'' לצורך סיווג.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על המבוטח להוכיח כי אירע מקרה הביטוח ולהוכיח את גובה הנזק, ועל המבטח לחלוק על גובה הנזק או להכחישו במפורש ולהוכיח התקיימותו של סייג לחבות.', false, 'תשובה זו שגויה. אף שהמבוטח צריך להוכיח את גובה הנזק, אין עליו נטל להוכיח שאין סייג לחבות, ועל המבטח מוטל נטל ההוכחה לסייג, לא רק לחלוק או להכחיש.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על המבוטח להוכיח כי אירע מקרה הביטוח ולהוכיח את גובה הנזק, ועל המבטח להוכיח התקיימותו של סייג לחבות.', true, 'זו התשובה הנכונה. הכלל הבסיסי בדיני ביטוח הוא שעל המבוטח להוכיח את קרות מקרה הביטוח ואת שיעור הנזק, ועל המבטח הטוען לפטור מאחריות להוכיח את קיומו של סייג לחבות.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על המבוטח להוכיח כי אירע מקרה הביטוח ולהוכיח את גובה הנזק וכי לא מתקיים כל סייג לחבות, ועל המבטח לחלוק על גובה הנזק או להכחישו במפורש.', false, 'תשובה זו שגויה. נטל השכנוע בדבר אי-קיומו של סייג לחבות אינו מוטל על המבוטח, אלא על המבטח להוכיח את קיומו של הסייג.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על המבוטח להוכיח כי אירע מקרה הביטוח ולהוכיח את גובה הנזק וכי לא מתקיים כל סייג לחבות.', false, 'תשובה זו שגויה. נטל השכנוע בדבר אי-קיומו של סייג לחבות אינו מוטל על המבוטח, אלא על המבטח להוכיח את קיומו של הסייג.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 5, '2024-W-S-Q05';
END
$$;

-- ============================================================
-- Q06 — 2024-W-S-Q06 — chapter=criminal_substantive subtopic=sentencing  [needs_review]
-- classifier_note: Youth (Juvenile Court) sentencing — 'נוער' is its own legal area, not directly a substantive subtopic. Sentencing is closest.
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'cfbc1e72-efa9-4ffa-8c38-78f65fc9c9bb'::uuid;
  v_group_id uuid := '1d734dc6-c54f-423f-b019-30c042caeea5'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q06';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 6, '2024-W-S-Q06';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_substantive';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_substantive';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'sentencing' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'sentencing', 'criminal_substantive';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q06', v_chapter_id, v_subtopic_id, 'נגד קטין הוגש כתב אישום בבית המשפט לנוער בבאר שבע. בית המשפט קבע כי הקטין ביצע את העבירה האמורה, וציווה כי הקטין יישלח למעון יומי לתקופה של חצי שנה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 6}'::jsonb, 'השאלה עוסקת בסמכות בית המשפט לנוער לחייב הורים בהוצאות טיפול עבור קטין שביצע עבירה, בהתאם לחוק הנוער (שפיטה, ענישה ודרכי טיפול). היא מתמקדת בתנאי המרכזי לחיוב זה – קיומם של אמצעים כלכליים אצל ההורים – ומדגישה את אופיו הרשותי של החיוב.', 'סעיף 28(א) לחוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל"א-1971, קובע כי כאשר בית משפט לנוער הורה על דרך טיפול מסוימת (כגון שהייה במעון יומי, שהיא אחת מדרכי הטיפול המנויות בסעיף 26 לחוק), הוא רשאי לצוות כי הקטין או הורהו יישאו בהוצאות הטיפול, כולן או מקצתן. סמכות זו מותנית בכך שבית המשפט ''נוכח שיש להם האמצעים הדרושים לכך''. כלומר, החיוב אינו אוטומטי או חובה, אלא נתון לשיקול דעת בית המשפט, והוא תלוי ביכולתם הכלכלית של ההורים. הגדרת ''הורה'' בחוק זה (סעיף 1) היא רחבה וכוללת הורה חורג, מאמץ ואפוטרופוס. סעיף 28(א) לחוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל"א-1971. סעיף 26(4) לחוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל"א-1971. נבו - המתמחה דיני עונשין ודרכי ענישה (2026) | הוצאות טיפול. סעיף 1 לחוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל"א-1971', 'הטעות הנפוצה היא לחשוב שחיוב הורים בהוצאות טיפול הוא חובה או שהוא תלוי בגורמים אחרים שאינם יכולתם הכלכלית, במקום להבין את אופיו הרשותי ואת התנאי המפורש שבחוק.',
    '["חוק הנוער (שפיטה, ענישה ודרכי טיפול)", "הוצאות טיפול", "חיוב הורים", "מעון יומי", "שיקול דעת שיפוטי", "אמצעים כלכליים"]'::jsonb, '**וריאציה 1 — תנאי לחיוב:** מהו התנאי לחיוב הורים בהוצאות טיפול במעון יומיאם בית המשפט נוכח שיש להם האמצעים הדרושים לכך (סעיף 28(א) לחוק הנוער (שפיטה, ענישה ודרכי טיפול)).
**וריאציה 2 — אופי החיוב:** האם חיוב הורים בהוצאות טיפול הוא חובה או רשותרשות, נתון לשיקול דעת בית המשפט (סעיף 28(א) לחוק הנוער (שפיטה, ענישה ודרכי טיפול)).
**וריאציה 3 — דרכי טיפול:** האם שהייה במעון יומי היא דרך טיפול לפי החוקכן, זו אחת מדרכי הטיפול המנויות בסעיף 26 לחוק הנוער (סעיף 26(4) לחוק הנוער (שפיטה, ענישה ודרכי טיפול)).', 'בית המשפט לנוער רשאי לחייב הורים בהוצאות טיפול (כמו מעון יומיאם יש להם אמצעים כלכליים (סעיף 28 לחוק הנוער (שפיטה, ענישה ודרכי טיפול)).', '["חוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל\"א-1971, סעיף 1", "חוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל\"א-1971, סעיף 26", "חוק הנוער (שפיטה, ענישה ודרכי טיפול), תשל\"א-1971, סעיף 28", "נבו - המתמחה דיני עונשין ודרכי ענישה (2026) | הוצאות טיפול"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''ערעור פלילי'' → mapped chapter=''criminal_substantive'' subtopic=''sentencing'' | classifier_note: Youth (Juvenile Court) sentencing — ''נוער'' is its own legal area, not directly a substantive subtopic. Sentencing is closest. | source_review_note: השאלה עוסקת בדיני נוער (שפיטה, ענישה ודרכי טיפול), תחום שאינו מופיע ברשימת תתי-הנושאים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''סדר דין פלילי - ערעור פלילי'' לצורך סיווג, אך הנושא הספציפי הוא סמכויות בית המשפט לנוער וחיוב הורים בהוצאות טיפול.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית המשפט ישית את הוצאות הטיפול במעון היום על האפוטרופוסים של הקטין.', false, 'תשובה זו שגויה. חיוב ההורים בהוצאות הטיפול אינו אוטומטי או חובה, אלא נתון לשיקול דעת בית המשפט.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט רשאי להשית את הוצאות הטיפול במעון היום על האפוטרופוסים של הקטין, במקרה שבו הם היו קשורים במישרין או בעקיפין לביצוע עבירת הקטין.', false, 'תשובה זו שגויה. סעיף 28 לחוק הנוער (שפיטה, ענישה ודרכי טיפול) אינו מתנה את חיוב ההורים בהוצאות הטיפול בקשר שלהם לביצוע העבירה, אלא באפשרותם הכלכלית.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט רשאי להשית את הוצאות הטיפול במעון היום על האפוטרופוסים של הקטין, במקרה שבו לקטין טרם מלאו שש עשרה שנים.', false, 'תשובה זו שגויה. גיל הקטין אינו התנאי לחיוב ההורים בהוצאות הטיפול לפי סעיף 28 לחוק הנוער (שפיטה, ענישה ודרכי טיפול), אלא יכולתם הכלכלית.', 0);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית המשפט רשאי להשית את הוצאות הטיפול במעון היום על האפוטרופוסים של הקטין, במקרה שבו מצא בית המשפט כי יש להם את האמצעים הדרושים לכך.', true, 'זו התשובה הנכונה. סעיף 28(א) לחוק הנוער (שפיטה, ענישה ודרכי טיפול) קובע כי בית המשפט רשאי לחייב את הקטין או הורהו בהוצאות הטיפול, כולן או מקצתן, אם נוכח שיש להם האמצעים הדרושים לכך.', 0);

  RAISE NOTICE 'Q% inserted: external_id %', 6, '2024-W-S-Q06';
END
$$;

-- ============================================================
-- Q07 — 2024-W-S-Q07 — chapter=contracts subtopic=unjust_enrichment
-- classifier_note: Hotel-pool free-use → unjust enrichment claim
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd91be43d-1574-4558-98b0-1ddeaece6b3e'::uuid;
  v_group_id uuid := 'ec8d094b-a25f-4c59-b540-3bff488d2792'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q07';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 7, '2024-W-S-Q07';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'unjust_enrichment' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'unjust_enrichment', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q07', v_chapter_id, v_subtopic_id, 'אפי הינו בעלים של מלון. במהלך השנים, התיר אפי לחברו קובי להיכנס לבריכת המלון ולרחוץ בה מתי שיחפוץ. לאחר שהשניים הסתכסכו, אפי הגיש נגד קובי תביעה על סך 20,000 ש"ח, בגין השבת עלות השהות של קובי בבריכה במהלך השנים. בנסיבות המתוארות, איזה מההיגדים הבאים הוא הנכון ביותר?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 7}'::jsonb, 'השאלה עוסקת בעקרונות דיני עשיית עושר ולא במשפט, ובפרט בסמכות בית המשפט לפטור זוכה מהשבה, כולה או מקצתה, לפי סעיף 2 לחוק עשיית עושר ולא במשפט. היא מתמקדת בחלופה של ''הזכייה לא הייתה כרוכה בחסרון המזכה'' (הידועה גם ככלל ''זה נהנה וזה לא חסר''), ומדגישה את שיקול הדעת השיפוטי הרחב הנתון לבית המשפט בהפעלת סמכות זו.', 'סעיף 1 לחוק עשיית עושר ולא במשפט, תשל"ט-1979, קובע את חובת ההשבה הכללית: מי שקיבל שלא על פי זכות שבדין נכס, שירות או טובת הנאה אחרת, חייב להשיב למזכה את הזכייה. סעיף 2 לחוק זה ממתן את חובה זו ומעניק לבית המשפט סמכות לפטור את הזוכה מחובת ההשבה, כולה או מקצתה, בשני מצבים עיקריים: האחד, אם ''הזכייה לא הייתה כרוכה בחסרון המזכה'' (הידוע ככלל ''זה נהנה וזה לא חסר''), והשני, אם ''ראה נסיבות אחרות העושות את ההשבה בלתי צודקת''. במקרה המתואר בשאלה, אם אפי התיר לקובי להיכנס לבריכה, וקובי נהנה מכך, אך לאפי לא נגרם חסרון כיס (למשל, הבריכה הייתה ריקה ממילא), בית המשפט רשאי, בשיקול דעת רחב, לפטור את קובי מחובת ההשבה. הפטור מהשבה הוא חריג שיופעל במקרים מועטים, אך הוא נועד לאפשר לבית המשפט לעשות צדק יחסי בין הצדדים. סעיף 1 לחוק עשיית עושר ולא במשפט, תשל"ט-1979. סעיף 2 לחוק עשיית עושר ולא במשפט, תשל"ט-1979. ע"א 588/87 אליעזר כהן נ'' צבי שמש (24.09.1991). ע"א 4708/14 י.ח דמרי בניה ופיתוח בע"מ נ'' המועצה המקומית גן יבנה (24.08.2015). ע"א 1761/02 רשות העתיקות נ'' מפעלי תחנות בע"מ (20.02.2006)', 'הטעות הנפוצה היא לחשוב שכל התעשרות שלא כדין מחייבת השבה מלאה, מבלי להכיר בסמכות בית המשפט לפטור מהשבה מטעמי צדק, ובפרט במקרים של ''זה נהנה וזה לא חסר''.',
    '["עשיית עושר ולא במשפט", "חובת השבה", "פטור מהשבה", "סעיף 2 לחוק עשיית עושר", "זה נהנה וזה לא חסר", "שיקול דעת שיפוטי", "צדק יחסי"]'::jsonb, '**וריאציה 1 — תנאי לפטור:** מהם התנאים לפטור מהשבה לפי סעיף 2 לחוק עשיית עושרהזכייה לא הייתה כרוכה בחסרון המזכה, או נסיבות אחרות העושות את ההשבה בלתי צודקת (סעיף 2 לחוק עשיית עושר ולא במשפט).
**וריאציה 2 — שיקול דעת בית המשפט:** מה היקף שיקול הדעת של בית המשפט בהפעלת סעיףשיקול דעת רחב ביותר, המאפשר יציקת ערכים של צדק יחסי בין הצדדים (ע"א 1761/02 רשות העתיקות נ'' מפעלי תחנות בע"מ).
**וריאציה 3 — כלל וחריג:** האם הפטור מהשבה הוא הכלל או החריגחובת ההשבה היא הכלל, והפטור הוא חריג שיופעל במקרים מועטים (ע"א 4708/14 י.ח דמרי בניה ופיתוח בע"מ נ'' המועצה המקומית גן יבנה).', 'סעיף 2 לחוק עשיית עושרפטור מהשבהאם אין חסרון למזכה (''זה נהנה וזה לא חסר'') או נסיבות אחרות עושות את ההשבה בלתי צודקתשיקול דעת רחב לבית המשפט.', '["חוק עשיית עושר ולא במשפט, תשל\"ט-1979, סעיף 1", "חוק עשיית עושר ולא במשפט, תשל\"ט-1979, סעיף 2", "ע\"א 1761/02 רשות העתיקות נ'' מפעלי תחנות בע\"מ (20.02.2006)", "ע\"א 588/87 אליעזר כהן נ'' צבי שמש (24.09.1991)", "ע\"א 4708/14 י.ח דמרי בניה ופיתוח בע\"מ נ'' המועצה המקומית גן יבנה (24.08.2015)", "ת\"א (מחוזי י-ם) 57566-06-16 מעונות ילדים בישראל קרית הילד ירושלים נ'' מדינת ישראל -רשות מקרקעי ישראל (24.11.2019)", "ת\"א (שלום פ\"ת) 12577-10-18 מדינת ישראל - רשות מקרקעי ישראל נ'' עותמאן ריאן (11.10.2021)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''unjust_enrichment'' | classifier_note: Hotel-pool free-use → unjust enrichment claim | source_review_note: השאלה עוסקת בדיני עשיית עושר ולא במשפט, תחום שאינו מופיע ברשימת תתי-הנושאים הסגורה. נבחרה הקטגוריה הקרובה ביותר ''סדר דין אזרחי - הליכים'' לצורך סיווג.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ככל שבית המשפט יקבל את גירסת אפי באשר לשימוש של קובי בבריכה, על בית המשפט למנות מומחה שיעריך את שווי עלות השהייה בבריכה, בטרם יפסוק את גובה ההשבה.', false, 'תשובה זו שגויה. אף שייתכן שיידרש אומדן שווי ההנאה, בית המשפט רשאי לפטור מהשבה גם אם הייתה התעשרות, אם לא נגרם חסרון למזכה או משיקולי צדק אחרים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'גם אם יקבל בית המשפט את גירסת אפי באשר לשימוש של קובי בבריכה, רשאי הוא שלא לחייב את קובי בהשבה אם ימצא כי לאפי לא היה חיסרון כיס.', true, 'זו התשובה הנכונה. סעיף 2 לחוק עשיית עושר ולא במשפט מאפשר לבית המשפט לפטור זוכה מהשבה, כולה או מקצתה, אם הזכייה לא הייתה כרוכה בחסרון המזכה (כלל ''זה נהנה וזה לא חסר'').', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ככל שבית המשפט יקבל את גירסת אפי באשר לשימוש של קובי בבריכה, על בית המשפט לבצע אומדנה של שווי הנאתו של קובי ולחייבו לשלמו לאפי.', false, 'תשובה זו שגויה. אף שחיוב בהשבה מבוסס על שווי ההנאה, בית המשפט אינו חייב לחייב בהשבה אם מתקיימים תנאי הפטור שבסעיף 2 לחוק עשיית עושר ולא במשפט.', 0);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ככל שבית המשפט יקבל את גירסת אפי באשר לשימוש של קובי בבריכה, על בית המשפט לפסוק לטובת אפי פיצוי ללא הוכחת נזק.', false, 'תשובה זו שגויה. תביעה בעשיית עושר ולא במשפט אינה תביעת פיצויים ללא הוכחת נזק, אלא תביעת השבה המבוססת על התעשרות הנתבע, ובית המשפט רשאי לפטור ממנה.', 0);

  RAISE NOTICE 'Q% inserted: external_id %', 7, '2024-W-S-Q07';
END
$$;

-- ============================================================
-- Q08 — 2024-W-S-Q08 — chapter=ethics subtopic=fiduciary_privilege_conflict  [needs_review]
-- classifier_note: Recording court proceedings by prosecutor — between ethics-conflict and procedural court rules
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '43d5b930-f545-4a74-8517-48c0b91fc4ba'::uuid;
  v_group_id uuid := '92ef934a-9711-4511-a0f2-41fadb2077e3'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q08';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 8, '2024-W-S-Q08';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'ethics';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'ethics';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fiduciary_privilege_conflict' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fiduciary_privilege_conflict', 'ethics';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q08', v_chapter_id, v_subtopic_id, 'במהלך דיון בבית המשפט, שמתנהל בדלתיים פתוחות, הקליטה באת כוח התובע את הדיון ללא שהודיעה על כך לבית המשפט. באת כוח התובע לא עשתה שימוש בהקלטה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 8}'::jsonb, 'השאלה עוסקת בחובות האתיות של עורכי דין בהקלטת דיונים בבית המשפט. היא מתמקדת בכלל 22(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית), המחייב עורך דין להודיע לבית המשפט על רצונו להקליט דיון. הפרת חובה זו מהווה עבירה אתית, ללא קשר לשאלה אם הדיון מתנהל בדלתיים פתוחות או אם נעשה שימוש בהקלטה.', 'כלל 22(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986, קובע במפורש כי ''עורך דין המקליט דיון בבית המשפט יודיע על כך לבית המשפט''. הפסיקה מפרשת כלל זה באופן מחמיר יותר, וקובעת כי אין די בהודעה, אלא יש לבקש רשות מבית המשפט להקליט את הדיון, וההקלטה מותרת רק אם ניתנה רשות כזו. איסור זה נובע מסמכותו הטבועה של השופט לנהל את הדיון ולשלוט בכל הנעשה באולם בית המשפט, וכן מהצורך לשמור על כבוד בית המשפט ועל תקינות ההליכים. הקלטת דיון ללא רשות או ללא יידוע מהווה עבירה אתית, גם אם הדיון מתנהל בדלתיים פתוחות וגם אם לא נעשה שימוש בהקלטה. כלל 22(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986. בג"ץ 305/89 שמחה ניר נ'' בית משפט השלום (תעבורה) למחוז חיפה, מה(3) 203 (22.05.1991). בתי-הדין הרבניים ירושלים) 1087086/ האישה נ'' האיש (23.05.2017). תלה"מ (משפחה ראשון לציון) 63089-06-24 פלוני נ'' אלמוני (30.12.2025). נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | הקלטת הזולת', 'הטעות הנפוצה היא לחשוב שפומביות הדיון או אי-שימוש בהקלטה פוטרים עורך דין מחובת היידוע לבית המשפט, או לבלבל בין הקלטת דיון להקלטת שיחה פרטית.',
    '["כללי לשכת עורכי הדין (אתיקה מקצועית)", "הקלטת דיון", "חובת יידוע", "עבירה אתית", "כבוד בית המשפט", "סמכות טבועה"]'::jsonb, '**וריאציה 1 — חובת היידוע:** האם עורך דין חייב להודיע לבית המשפט על הקלטת דיוןכן, כלל 22(ב) מחייב זאת (כלל 22(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית)).
**וריאציה 2 — אופי הדיון:** האם פומביות הדיון משנה את החובהלא, חובת היידוע חלה גם בדיון בדלתיים פתוחות (בתי-הדין הרבניים ירושלים) 1087086/ האישה נ'' האיש).
**וריאציה 3 — שימוש בהקלטה:** האם אי-שימוש בהקלטה פוטר מעבירה אתיתלא, עצם ההקלטה ללא יידוע מהווה עבירה אתית (בתי-הדין הרבניים ירושלים) 1087086/ האישה נ'' האיש).', 'הקלטת דיון בבית המשפט ללא יידועעבירה אתית לפי כלל 22(בגם אם הדיון פתוח וגם אם לא נעשה שימוש בהקלטה.', '["כללי לשכת עורכי הדין (אתיקה מקצועית), תשמ\"ו-1986, כלל 22(ב)", "בג\"ץ 305/89 שמחה ניר נ'' בית משפט השלום (תעבורה) למחוז חיפה, מה(3) 203 (22.05.1991)", "בתי-הדין הרבניים ירושלים) 1087086/ האישה נ'' האיש (23.05.2017)", "תלה\"מ (משפחה ראשון לציון) 63089-06-24 פלוני נ'' אלמוני (30.12.2025)", "נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | הקלטת הזולת"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''ethics'' subtopic=''fiduciary_privilege_conflict'' | classifier_note: Recording court proceedings by prosecutor — between ethics-conflict and procedural court rules', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'פעולת ההקלטה אינה מהווה עבירה אתית, היות שבאת כוח התובע לא עשתה בה שימוש.', false, 'תשובה זו שגויה. כלל 22(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית) מטיל חובה להודיע לבית המשפט על הקלטת דיון, והפרת חובה זו מהווה עבירה אתית, ללא קשר לשאלה אם נעשה שימוש בהקלטה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'פעולת ההקלטה, שלא באמצעות חברת הקלטה מאושרת על-ידי בית המשפט, מהווה עבירה אתית.', false, 'תשובה זו שגויה. העבירה האתית אינה נובעת מזהות הגורם המקליט, אלא מהיעדר הודעה לבית המשפט על עצם ההקלטה, כפי שקובע כלל 22(ב).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'פעולת ההקלטה אינה מהווה עבירה, שכן מדובר בדיון המתנהל בדלתיים פתוחות.', false, 'תשובה זו שגויה. חובת היידוע לבית המשפט על הקלטת דיון חלה גם בדיונים המתנהלים בדלתיים פתוחות, ופומביות הדיון אינה פוטרת מחובה זו.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'פעולת ההקלטה ללא יידוע בית המשפט מהווה עבירה אתית.', true, 'זו התשובה הנכונה. כלל 22(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית) קובע במפורש כי עורך דין המקליט דיון בבית המשפט חייב להודיע על כך לבית המשפט, והפרת כלל זה מהווה עבירה אתית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 8, '2024-W-S-Q08';
END
$$;

-- ============================================================
-- Q09 — 2024-W-S-Q09 — chapter=family_inheritance subtopic=inheritance_will  [needs_review]
-- classifier_note: International private law dimension (London assets, Israeli resident) — has no direct subtopic; primary topic is inheritance
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '2306cde7-89bd-42df-9921-6389f1b6614a'::uuid;
  v_group_id uuid := '904ebd8a-3b53-4071-934c-b495b625710f'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q09';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 9, '2024-W-S-Q09';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'family_inheritance';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'family_inheritance';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'inheritance_will' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'inheritance_will', 'family_inheritance';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q09', v_chapter_id, v_subtopic_id, 'לדני יש בתי נופש רבים בלונדון. לאחרונה רכש דני דירה בתל אביב והעביר את מרכז חייו לישראל, אך הוא עדיין מרבה לנסוע לעסקיו שבלונדון. בתאריך 1.1.2022 טס דני מלונדון לתל אביב, לקה בליבו מעל מדינת פולין ומת במקום. הטייס הנחית את המטוס נחיתת חרום ומותו של דני נקבע על אדמת פולין. דני נקבר בלונדון לבקשת משפחתו. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 9}'::jsonb, 'השאלה עוסקת בסמכות הבינלאומית של בתי המשפט בישראל לדון בענייני ירושה, וברירת הדין החלה, בהתאם לחוק הירושה. היא בוחנת את סעיף 136 לחוק, המקנה סמכות על בסיס מקום מושבו של המוריש או הנחת נכסים בישראל, ואת סעיף 138, המהווה חריג לכלל ברירת הדין של מקום המושב.', 'סעיף 136 לחוק הירושה, תשכ"ה-1965, קובע כי בית המשפט בישראל מוסמך לדון בירושתו של כל אדם שמושבו ביום מותו היה בישראל או שהניח נכסים בישראל. במקרה של דני, הוא העביר את מרכז חייו לישראל, ולכן מושבו היה בישראל. מכאן שלבית המשפט בישראל קיימת סמכות בינלאומית לדון בכלל ירושתו, לרבות נכסיו בלונדון. הפסיקה (בג"ץ 171/68 חאנזאליס, ע"א 598/85 כהנא, ת"ע 109310/06) מפרשת את המילה "בירושתו" בסעיף 136 באופן רחב, כך שהסמכות משתרעת על כלל נכסי המוריש, בכל מקום שהם נמצאים. לעניין ברירת הדין, סעיף 137 לחוק קובע כי על הירושה יחול דין מושבו של המוריש בשעת מותו (קרי, הדין הישראלי במקרה זה), למעט חריגים המנויים בסעיפים 138 עד 140. סעיף 138 קובע חריג צר, לפיו על נכסים העוברים בירושה "לפי דין מקום המצאם בלבד" יחול אותו דין. חריג זה מתייחס למקרים בהם הדין המקומי שולל במפורש תחולת כל דין אחר. סעיף 136 לחוק הירושה, תשכ"ה-1965. סעיף 137 לחוק הירושה, תשכ"ה-1965. סעיף 138 לחוק הירושה, תשכ"ה-1965. ת"ע (משפחה תל אביב-יפו) 109310/06 עזבון המנוח א. ז. צ''. ז"ל נ'' ר. צ'' (29.01.2008). בג"ץ 171/68 אבולון חאנזאליס נ'' בית־הדין של הכנסיה הפטריארכית היוונית-אורתודוכסית, כג(1) 260 (10.03.1969)', 'הטעות הנפוצה היא לבלבל בין סמכות בינלאומית (סעיף 136) לבין ברירת דין (סעיפים 137-140), או לפרש את סעיף 138 באופן רחב מדי, כאילו הוא חל על כל נכס מקרקעין זר.',
    '["סמכות בינלאומית", "ברירת דין", "חוק הירושה", "מושב", "סעיף 136", "סעיף 137", "סעיף 138", "נכסים מחוץ לישראל"]'::jsonb, '**וריאציה 1 — סמכות בינלאומית:** האם לבית המשפט בישראל סמכות לדון בירושת דניכן, מכיוון שמרכז חייו היה בישראל ביום מותו (סעיף 136 לחוק הירושה).
**וריאציה 2 — היקף הסמכות:** האם הסמכות חלה רק על נכסים בישראללא, הסמכות משתרעת על כלל נכסי העיזבון, לרבות אלו שבחו"ל (בג"ץ 171/68 אבולון חאנזאליס נ'' בית־הדין של הכנסיה הפטריארכית היוונית-אורתודוכסית).
**וריאציה 3 — ברירת הדין:** איזה דין יחול על הירושהדין מושבו של המוריש (הדין הישראלי), למעט חריגים בסעיפים 138-140 (סעיף 137 לחוק הירושה).', 'לבית המשפט בישראל סמכות בינלאומית על כלל ירושת דני (מושבו בישראליחול הדין הישראלי (דין המושבלמעט נכסים שדין מקום הימצאם בלבד חל עליהם (סעיף 138).', '["חוק הירושה, תשכ\"ה-1965, סעיף 135", "חוק הירושה, תשכ\"ה-1965, סעיף 136", "חוק הירושה, תשכ\"ה-1965, סעיף 137", "חוק הירושה, תשכ\"ה-1965, סעיף 138", "ת\"ע (משפחה תל אביב-יפו) 109310/06 עזבון המנוח א. ז. צ''. ז\"ל נ'' ר. צ'' (29.01.2008)", "ע\"מ (מחוזי תל אביב-יפו) 1069/08 ר. צ'' נ'' ו.י. צ''. א (04.11.2009)", "בג\"ץ 171/68 אבולון חאנזאליס נ'' בית־הדין של הכנסיה הפטריארכית היוונית-אורתודוכסית, כג(1) 260 (10.03.1969)", "ע\"א 598/85 מסתורה כהנא נ'' מאיר כהנא, מד(3) 473 (14.08.1990)", "נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | כללי ברירת הדין"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''חוקתי + בינלאומי פרטי'' subtopic=''אכיפת פסק חוץ'' → mapped chapter=''family_inheritance'' subtopic=''inheritance_will'' | classifier_note: International private law dimension (London assets, Israeli resident) — has no direct subtopic; primary topic is inheritance | source_review_note: השאלה עוסקת במשפט בינלאומי פרטי בתחום הירושה, שאינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''חוקתי + בינלאומי פרטי - אכיפת פסק חוץ'' כקרובה ביותר, אך יש לציין שהנושא הספציפי הוא סמכות בינלאומית וברירת דין בירושה.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית המשפט בישראל מוסמך לדון בכל הנכסים של דני, למעט נכסים מחוץ לישראל שעל פי דין המדינה בה הם נמצאים עוברים בירושה אך ורק לפי דין מקום הימצאם.', true, 'זו התשובה הנכונה. סעיף 136 לחוק הירושה מקנה סמכות בינלאומית לבית המשפט בישראל לדון בכלל ירושתו של אדם שמושבו היה בישראל. סעיף 138 קובע חריג לברירת הדין, לפיו על נכסים העוברים בירושה לפי דין מקום הימצאם בלבד, יחול אותו דין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט בישראל מוסמך לדון בדירה בתל אביב בלבד.', false, 'תשובה זו שגויה. סעיף 136 לחוק הירושה, כפי שפורש בפסיקה, מקנה סמכות בינלאומית רחבה לבית המשפט בישראל לדון בכלל נכסי העיזבון, ולא רק בנכסים המצויים בישראל, אם המוריש היה תושב ישראל.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט בישראל אינו מוסמך לדון בעיזבון אם דני הוא אזרח אנגלי.', false, 'תשובה זו שגויה. חוק הירושה אינו מתנה את הסמכות הבינלאומית באזרחות המוריש, אלא במקום מושבו או בהנחת נכסים בישראל. אזרחות אינה זיקה רלוונטית לעניין סמכות בינלאומית לפי סעיף 136.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית משפט בישראל אינו מוסמך לדון בעיזבון אם דני השאיר צוואה תקפה לפי דיני אנגליה.', false, 'תשובה זו שגויה. קיומה של צוואה תקפה לפי דין זר אינו שולל את סמכותו הבינלאומית של בית המשפט בישראל, אלא משפיע על ברירת הדין שיחול על הירושה (סעיף 137 לחוק הירושה).', 0);

  RAISE NOTICE 'Q% inserted: external_id %', 9, '2024-W-S-Q09';
END
$$;

-- ============================================================
-- Q10 — 2024-W-S-Q10 — chapter=criminal_substantive subtopic=general_part_elements
-- classifier_note: Attempted offense (impossible attempt), mistake of fact/law — criminal general part
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '248c2cd8-60f4-43ed-88ed-b5d5507abf49'::uuid;
  v_group_id uuid := 'fc8806c0-9e44-4019-9066-13b99e33db41'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q10';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 10, '2024-W-S-Q10';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_substantive';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_substantive';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'general_part_elements' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'general_part_elements', 'criminal_substantive';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q10', v_chapter_id, v_subtopic_id, 'ראובן ניסה להבריח לישראל אבקה שראובן חשב שהיא סם מסוכן מסוג קוקאין, וטובין שחשב שהם חייבים במכס. הניחו כנתון שהחזקת סם מסוג קוקאין (להלן: החזקת סם) והכנסה לישראל של טובין החייבים בהצהרה ותשלום מכס מבלי להצהיר על כך ולשלם בגינם את המכס המוטל עליהם (להלן: הברחת טובין) הן עבירות פליליות. ראובן נתפס, והתברר כי בפועל האבקה היתה קמח והטובין כלל אינם חייבים במכס. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 10}'::jsonb, 'השאלה עוסקת בדיני הניסיון הפלילי, ובפרט בהבחנה בין ניסיון בלתי צליח מבחינה עובדתית לבין ניסיון בלתי צליח מבחינה משפטית, כפי שנקבע בסעיף 26 לחוק העונשין ובפסיקה. היא מדגישה כי ניסיון בלתי צליח עובדתית (כאשר העבירה לא הושלמה עקב מצב עובדתי שהמנסה לא ידע עליו) הוא בר-עונשין, בעוד שניסיון בלתי צליח משפטית (כאשר המעשה, גם אם היה מושלם, לא היה מהווה עבירה פלילית) אינו בר-עונשין, בהתאם לעקרון החוקיות.', 'סעיף 25 לחוק העונשין, תשל"ז-1977, מגדיר ניסיון כמעשה שאין בו הכנה בלבד, שנעשה במטרה לבצע עבירה, והעבירה לא הושלמה. סעיף 26 לחוק העונשין קובע כי לעניין ניסיון, אין נפקא מינה אם עשיית העבירה לא הייתה אפשרית מחמת מצב דברים שהמנסה לא היה מודע לו או טעה לגביו. הפסיקה, ובראשה רע"פ 2220/16 רועי מור יוסף, הבחינה בין שני סוגים של ניסיון בלתי צליח: ניסיון בלתי צליח מבחינה עובדתית וניסיון בלתי צליח מבחינה משפטית. ניסיון בלתי צליח מבחינה עובדתית הוא בר-עונשין, שכן הוא מעיד על פוטנציאל עברייני של המנסה (למשל, ניסיון להחזיק סם כאשר החומר הוא קמח). לעומת זאת, ניסיון בלתי צליח מבחינה משפטית אינו בר-עונשין, שכן גם אם המעשה היה מושלם כפי שהמנסה דמיין, הוא לא היה מהווה עבירה פלילית (למשל, ניסיון להבריח טובין שאינם חייבים במכס). במקרה הנדון, ניסיון להבריח קמח במחשבה שזה קוקאין הוא ניסיון בלתי צליח עובדתית, ולכן בר-עונשין. ניסיון להבריח טובין שאינם חייבים במכס הוא ניסיון בלתי צליח משפטית, ולכן אינו בר-עונשין. סעיף 25 לחוק העונשין, תשל"ז-1977. סעיף 26 לחוק העונשין, תשל"ז-1977. רע"פ 2220/16 רועי מור יוסף נ'' התביעה הצבאית הראשית (26.10.2017). ע"פ 675/85 ראובן בן חיים גרציאנו נ'' מדינת ישראל, מ(3) 763 (03.09.1986). יורם רבין, יניב ואקי דיני עונשין - כרך א (2014) | פרק 17 - עבירת הניסיון', 'הטעות הנפוצה היא לבלבל בין טעות עובדתית לטעות משפטית בניסיון בלתי צליח, ולחשוב שכל ניסיון לבצע מעשה שאדם סבור שהוא אסור הוא בר-עונשין, גם אם המעשה אינו אסור בדין.',
    '["ניסיון פלילי", "ניסיון בלתי צליח", "טעות עובדתית", "טעות משפטית", "סעיף 25 לחוק העונשין", "סעיף 26 לחוק העונשין", "עקרון החוקיות"]'::jsonb, '**וריאציה 1 — קמח במקום קוקאין:** ראובן ניסה להבריח קמח שחשב שהוא קוקאין. האם יורשע בניסיוןכן, זהו ניסיון בלתי צליח מבחינה עובדתית, והוא בר-עונשין (רע"פ 2220/16 רועי מור יוסף נ'' התביעה הצבאית הראשית).
**וריאציה 2 — טובין לא חייבים במכס:** ראובן ניסה להבריח טובין שחשב שהם חייבים במכס, אך לא היו. האם יורשע בניסיוןלא, זהו ניסיון בלתי צליח מבחינה משפטית, ואינו בר-עונשין (רע"פ 2220/16 רועי מור יוסף נ'' התביעה הצבאית הראשית).
**וריאציה 3 — הבחנה בין סוגי טעות:** מה ההבדל בין טעותו של ראובן לגבי הקמח לבין טעותו לגבי הטוביןלגבי הקמח זו טעות עובדתית (טיב החומר), ולגבי הטובין זו טעות משפטית (היקף האיסור הפלילי) (רע"פ 2220/16 רועי מור יוסף נ'' התביעה הצבאית הראשית).', 'ניסיון להבריח קמח במחשבה שזה סםניסיון בלתי צליח עובדתיתבר-עונשין. ניסיון להבריח טובין שאינם חייבים במכס במחשבה שכןניסיון בלתי צליח משפטיתאינו בר-עונשין.', '["חוק העונשין, תשל\"ז-1977, סעיף 25", "חוק העונשין, תשל\"ז-1977, סעיף 26", "רע\"פ 2220/16 רועי מור יוסף נ'' התביעה הצבאית הראשית (26.10.2017)", "תפ\"ח (מחוזי ת\"א) 1137/07 מדינת ישראל נ'' בן גיא אלדד (21.10.2009)", "ע\"פ 295/10 פלוני נ'' מדינת ישראל (02.04.2012)", "ע\"פ 675/85 ראובן בן חיים גרציאנו נ'' מדינת ישראל, מ(3) 763 (03.09.1986)", "ע\"פ 10110/03 עופר גמליאל נ'' מדינת ישראל (11.12.2006)", "רע\"פ 7560/01 הצבאי הראשי נ'' סמל שובין דמיטרי, נט(3) 931 (02.12.2004)", "יורם רבין, יניב ואקי דיני עונשין - כרך א (2014) | פרק 17 - עבירת הניסיון", "יורם רבין, יניב ואקי דיני עונשין - כרך ב (2014) | פרק 30 טעות במצב משפטי", "נבו - המתמחה דיני עונשין ודרכי ענישה (2026) | חוסר אפשרות לעשיית העבירה", "נבו - המתמחה דיני עונשין ודרכי ענישה (2026) | טעות במצב דברים"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''הליכים'' → mapped chapter=''criminal_substantive'' subtopic=''general_part_elements'' | classifier_note: Attempted offense (impossible attempt), mistake of fact/law — criminal general part | source_review_note: השאלה עוסקת בדיני עונשין מהותיים (ניסיון פלילי, טעות במצב דברים/משפטי), תחום שאינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין פלילי - הליכים'' כקרובה ביותר, אך יש לציין שהנושא הספציפי הוא דיני עונשין מהותיים. בנוסף, השאלה נפסלה במחוון הרשמי, כאשר כל ארבע התשובות זוכו כתשובה נכונה. עם זאת, בהתבסס על ההבחנה המפורשת בפסיקה (רע"פ 2220/16) בין ניסיון בלתי צליח מבחינה עובדתית (בר-עונשין) לניסיון בלתי צליח מבחינה משפטית (שאינו בר-עונשין), התשובה הנכונה ביותר היא ד''.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'אפשר להאשים את ראובן בעבירה של החזקת סם מסוכן ובעבירה של ניסיון להברחת טובין.', false, 'תשובה זו שגויה. לא ניתן להאשים בעבירה מושלמת של החזקת סם, שכן האבקה הייתה קמח. כמו כן, ניסיון להברחת טובין שאינם חייבים במכס אינו בר-עונשין, שכן מדובר בניסיון בלתי צליח מבחינה משפטית.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'אפשר להאשים את ראובן בעבירה של ניסיון להחזקת סם ובעבירה של ניסיון להברחת טובין.', false, 'תשובה זו שגויה. אף שניתן להאשים בניסיון להחזקת סם (טעות עובדתית), לא ניתן להאשים בניסיון להברחת טובין, שכן מדובר בניסיון בלתי צליח מבחינה משפטית שאינו בר-עונשין.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אפשר להאשים את ראובן בעבירה של ניסיון להחזקת סם ובעבירה של הברחת טובין.', false, 'תשובה זו שגויה. לא ניתן להאשים בעבירה מושלמת של הברחת טובין, שכן הטובין לא היו חייבים במכס. כמו כן, ניסיון להברחת טובין שאינם חייבים במכס אינו בר-עונשין.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אפשר להאשים את ראובן בעבירה של ניסיון להחזקת סם בלבד.', true, 'זו התשובה הנכונה. ניסיון להחזקת סם כאשר החומר הוא קמח מהווה ניסיון בלתי צליח מבחינה עובדתית, והוא בר-עונשין. לעומת זאת, ניסיון להברחת טובין שאינם חייבים במכס מהווה ניסיון בלתי צליח מבחינה משפטית, ואינו בר-עונשין.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 10, '2024-W-S-Q10';
END
$$;

-- ============================================================
-- Q11 — 2024-W-S-Q11 — chapter=tax subtopic=real_estate_tax
-- classifier_note: Capital-gains tax (מס שבח) on inherited apartment
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '5219b537-9232-491d-8669-39a0aa637715'::uuid;
  v_group_id uuid := '7936b585-47ef-41c3-92a3-efb8a8d39be2'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q11';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 11, '2024-W-S-Q11';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'tax';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'tax';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'real_estate_tax' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'real_estate_tax', 'tax';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q11', v_chapter_id, v_subtopic_id, 'משה, בן יחיד להוריו, ירש על פי צוואתם אחת מבין הדירות שהיו בבעלותם. משה מכר את הדירה. האם משה חייב במס שבח?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 11}'::jsonb, 'השאלה עוסקת בפטור ממס שבח במכירת דירת מגורים שהתקבלה בירושה. היא בוחנת את העיקרון לפיו הפטור ממס שבח הוא אישי ואינו עובר בירושה מהמוריש ליורש. על היורש לעמוד בתנאים הקבועים בחוק מיסוי מקרקעין (שבח ורכישה), ובפרט בסעיף 49ב(5) לחוק, כדי לזכות בפטור.', 'הפטור ממס שבח במכירת דירת מגורים הוא פטור אישי, ואינו מהווה זכות ה"צמודה" לדירת המגורים. משמעות הדבר היא שאם נפטר הנישום, יראו את המכירה של זכות במקרקעין הנמנית עם נכסי העיזבון כמכירה בידי היורשים, ולא ניתן יהיה לעשות שימוש בפטור ממס שבח שעמד לנישום עצמו אילו היה בחיים. תחת זאת, יש לבדוק אם ליורשיו קיימת זכאות לפטור שכזה, בהתאם לכללים החלים על יורשים. סעיף 49ב(5) לחוק מיסוי מקרקעין קובע תנאים ספציפיים לפטור ליורש, הכוללים קרבה משפחתית למוריש, היותה של הדירה דירתו היחידה של המוריש לפני פטירתו, וזכאות המוריש לפטור אילו היה מוכר בחייו. אם היורש אינו עומד בתנאים אלו, או בתנאים של פטור אחר (כגון פטור לדירה יחידה לפי סעיף 49ב(2) לחוק), הוא יהיה חייב במס שבח. סעיף 49ב(5) לחוק מיסוי מקרקעין (שבח ורכישה), תשכ"ג-1963. ו"ע (מחוזי נצרת) 20627-03-24 בלה כהן נ'' מיסוי מקרקעין נצרת (09.04.2025). רע"א 7816/06 עו"ד יעקב מ. בויאר - בתפקידו ככונס נכסים נ'' עז'' המנוח מר דוד מרמלשטיין ז"ל (01.10.2009). ע"א 6107/20 מנהל מיסוי מקרקעין תל אביב נ'' נירה מעין (19.07.2022). נבו - המתמחה מיסוי מקרקעין (2026) | פטור במכירת דירה שנתקבלה בירושה', 'הטעות הנפוצה היא לחשוב שהפטור ממס שבח עובר אוטומטית בירושה, או לבלבל בין זכאות המוריש לפטור לבין זכאות היורש לפטור.',
    '["מס שבח מקרקעין", "פטור ממס שבח", "דירה שהתקבלה בירושה", "סעיף 49ב(5) לחוק מיסוי מקרקעין", "פטור אישי", "זכאות יורש"]'::jsonb, '**וריאציה 1 — פטור אישי:** האם פטור ממס שבח הוא אישיכן, הפטור הוא אישי ואינו עובר בירושה מהמוריש ליורש (ו"ע (מחוזי נצרת) 20627-03-24 בלה כהן נ'' מיסוי מקרקעין נצרת).
**וריאציה 2 — תנאי היורש:** מה נדרש כדי שהיורש יקבל פטורהיורש עצמו צריך לעמוד בתנאי הפטור הקבועים בחוק, כגון סעיף 49ב(5) (ו"ע (מחוזי נצרת) 20627-03-24 בלה כהן נ'' מיסוי מקרקעין נצרת).
**וריאציה 3 — תכלית הפטור:** מהי התכלית הסוציאלית של הפטורלאפשר ליחיד או למשפחה להחליף דירה אחת בדירה אחרת התואמת את צרכיו, ולמנוע הכבדה על ניידות האוכלוסייה (ע"א 6107/20 מנהל מיסוי מקרקעין תל אביב נ'' נירה מעין).', 'פטור ממס שבח על דירה בירושהאינו אוטומטיהיורש חייב לעמוד בתנאי הפטור בעצמו (למשל, 49בהפטור אישי ולא עובר בירושה.', '["חוק מיסוי מקרקעין (שבח ורכישה), תשכ\"ג-1963, סעיף 49ב", "חוק מיסוי מקרקעין (שבח ורכישה), תשכ\"ג-1963, סעיף 5", "ו\"ע (מחוזי נצרת) 20627-03-24 בלה כהן נ'' מיסוי מקרקעין נצרת (09.04.2025)", "רע\"א 7816/06 עו\"ד יעקב מ. בויאר - בתפקידו ככונס נכסים נ'' עז'' המנוח מר דוד מרמלשטיין ז\"ל (01.10.2009)", "ע\"א 6107/20 מנהל מיסוי מקרקעין תל אביב נ'' נירה מעין (19.07.2022)", "נבו - המתמחה מיסוי מקרקעין (2026) | פטור במכירת דירה שנתקבלה בירושה"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''tax'' subtopic=''real_estate_tax'' | classifier_note: Capital-gains tax (מס שבח) on inherited apartment | source_review_note: השאלה עוסקת בדיני מיסוי מקרקעין, תחום שאינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין אזרחי - הליכים'' כקרובה ביותר, אך יש לציין שהנושא הספציפי הוא דיני מיסים מהותיים.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'מאחר שמדובר בדירה שהתקבלה בירושה, משה יהיה פטור מתשלום מס שבח.', false, 'תשובה זו שגויה. עצם קבלת דירה בירושה אינה מקנה פטור אוטומטי ממס שבח. הפטור הוא אישי ותלוי בעמידת היורש בתנאים הקבועים בחוק.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'מאחר שמדובר בדירה שהתקבלה בירושה, משה יהיה פטור מתשלום מחצית מס השבח החל על המכירה.', false, 'תשובה זו שגויה. אין בחוק מיסוי מקרקעין הוראה כללית המעניקה פטור ממחצית מס שבח במכירת דירה שהתקבלה בירושה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'מאחר שמדובר בדירה שהתקבלה בירושה, משה יהיה פטור מתשלום מס שבח אם הוריו היו פטורים ממנו אילו מכרו את דירתם בחייהם.', false, 'תשובה זו שגויה. אף שתנאי זה (סעיף 49ב(5)(ג)) הוא אחד משלושת התנאים המצטברים לפטור ליורש, הוא אינו מספיק לבדו. בנוסף, הפטור הוא אישי ואינו עובר בירושה מהמוריש ליורש.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'משה יהיה פטור מתשלום מס שבח אם הוא עצמו זכאי לפטור ממס שבח במכירת הדירה.', true, 'זו התשובה הנכונה. הפטור ממס שבח הוא אישי. היורש אינו נכנס לנעלי המוריש לעניין הפטור, אלא עליו לבחון האם הוא עצמו זכאי לפטור ממס שבח בגין מכירת הדירה שקיבל בירושה, בהתאם לתנאים הקבועים בחוק, כגון סעיף 49ב(5) או סעיף 49ב(2) לחוק מיסוי מקרקעין.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 11, '2024-W-S-Q11';
END
$$;

-- ============================================================
-- Q12 — 2024-W-S-Q12 — chapter=criminal_substantive subtopic=sentencing
-- classifier_note: Suspended sentence (מאסר על תנאי) activation rules
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '886a8e8a-80dd-4a9a-b883-0774e8819be1'::uuid;
  v_group_id uuid := '88dffcfb-a10f-44c4-819c-e9cfafaafd17'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q12';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 12, '2024-W-S-Q12';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_substantive';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_substantive';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'sentencing' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'sentencing', 'criminal_substantive';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q12', v_chapter_id, v_subtopic_id, 'פלוני הורשע בפלילים לראשונה ונגזר עליו ביום 1.2.2023 עונש של 3 שנות מאסר בפועל, ו-6 חודשי מאסר על תנאי, לבל יעבור עבירת אלימות מסוג "פשע" למשך שנתיים. ביום 1.3.2023 התייצב פלוני לריצוי עונשו בבית הסוהר. מתי תסתיים תקופת התנאי?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 12}'::jsonb, 'השאלה עוסקת במועד תחילת תקופת המאסר על תנאי, כפי שנקבע בסעיף 52(ג) לחוק העונשין ובפרשנותו בפסיקת בית המשפט העליון. היא בוחנת את הכלל לפיו תקופת התנאי מתחילה ביום מתן גזר הדין, ואת החריג החשוב לפיו אם הנידון נושא עונש מאסר בפועל (גם אם נגזר באותו גזר דין), תקופת התנאי תחל רק ביום שחרורו ממאסר.', 'סעיף 52(ג) לחוק העונשין, תשל"ז-1977, קובע כי "תקופת התנאי תתחיל ביום מתן גזר הדין ואם הנידון נושא אותו זמן עונש מאסר - ביום שחרורו מן המאסר". הפסיקה, ובראשה הלכת נעים (ע"פ 4180/92) שאושרה וחוזקה בהלכת אשקר (רע"פ 8597/20) ודירבאס (רע"פ 785/22), קבעה כי החריג לפיו תקופת התנאי תחל ביום השחרור ממאסר חל לא רק כאשר הנידון כבר מרצה מאסר בגין עבירה אחרת, אלא גם כאשר בגזר הדין מושת על הנידון עונש מאסר בפועל לצד עונש מאסר על תנאי. תכלית ההוראה היא להבטיח שהמאסר על תנאי ישרת את מטרתו ההרתעתית כאשר הנידון חופשי ומתמודד עם פיתויי העבריינות, ולא כאשר הוא כלוא וממילא מוגבל במעשיו. במקרה הנדון, פלוני נדון ל-3 שנות מאסר בפועל ול-6 חודשי מאסר על תנאי. מאחר שנגזר עליו מאסר בפועל, תקופת התנאי של שנתיים תחל רק ביום שחרורו ממאסר בפועל, ולא ביום מתן גזר הדין או ביום התייצבותו לכלא. סעיף 52(ג) לחוק העונשין, תשל"ז-1977. ע"פ 4180/92 מדינת ישראל נ'' אליהו בן מרדכי נעים (21.03.1994). רע"פ 58943-09-19 אליאס אשקר נ'' מדינת ישראל (08.02.2022). רע"פ 785/22 חאלד דירבאס נ'' מדינת ישראל (09.03.2022). נבו - המתמחה דיני עונשין ודרכי ענישה (2026) | מועד תחילת תקופת התנאי (סעיף 52(ג) רישה)', 'הטעות הנפוצה היא לחשוב שתקופת התנאי מתחילה תמיד ביום מתן גזר הדין, או ביום ההתייצבות למאסר, מבלי להבחין בחריג הקבוע בסעיף 52(ג) לחוק העונשין ובפרשנותו בפסיקה.',
    '["מאסר על תנאי", "תקופת תנאי", "סעיף 52(ג) לחוק העונשין", "מאסר בפועל", "יום שחרור ממאסר", "הלכת נעים", "הלכת אשקר"]'::jsonb, '**וריאציה 1 — כלל ברירת המחדל:** מתי מתחילה תקופת התנאי ככללביום מתן גזר הדין (סעיף 52(ג) לחוק העונשין).
**וריאציה 2 — מאסר בפועל:** מתי מתחילה תקופת התנאי אם נגזר גם מאסר בפועלביום השחרור ממאסר, גם אם המאסר בפועל נגזר באותו גזר דין (ע"פ 4180/92 מדינת ישראל נ'' אליהו בן מרדכי נעים (21.03.1994)).
**וריאציה 3 — תכלית ההוראה:** מהי תכלית ההוראה לדחיית תחילת התנאילהבטיח שהתנאי יחול כשהנאשם חופשי ומתמודד עם פיתויי העבריינות, ולא כשהוא כלוא (ע"פ 4180/92 מדינת ישראל נ'' אליהו בן מרדכי נעים (21.03.1994)).', 'מאסר על תנאי + מאסר בפועלתקופת התנאי מתחילה ביום השחרור ממאסרכדי להבטיח אפקטיביות הרתעתית.', '["חוק העונשין, תשל\"ז-1977, סעיף 52", "ע\"פ 4180/92 מדינת ישראל נ'' אליהו בן מרדכי נעים (21.03.1994)", "רע\"פ 58943-09-19 אליאס אשקר נ'' מדינת ישראל (08.02.2022)", "רע\"פ 785/22 חאלד דירבאס נ'' מדינת ישראל (09.03.2022)", "ע\"פ 7510/00 אליהו במנוקלר נ'' מדינת ישראל (09.05.2002)", "נבו - המתמחה דיני עונשין ודרכי ענישה (2026) | מועד תחילת תקופת התנאי (סעיף 52(ג) רישה)", "יורם רבין, יניב ואקי דיני עונשין - כרך ג: הענישה הפלילית (2022) | פרק 7 מאסר על-תנאי"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''הליכים'' → mapped chapter=''criminal_substantive'' subtopic=''sentencing'' | classifier_note: Suspended sentence (מאסר על תנאי) activation rules | source_review_note: השאלה עוסקת בדיני עונשין מהותיים (מאסר על תנאי), תחום שאינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין פלילי - הליכים'' כקרובה ביותר, אך יש לציין שהנושא הספציפי הוא דיני עונשין מהותיים.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'שנתיים מיום 1.2.2023.', false, 'תשובה זו שגויה. הכלל לפיו תקופת התנאי מתחילה ביום מתן גזר הדין אינו חל כאשר הנידון נושא עונש מאסר בפועל, גם אם נגזר באותו גזר דין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'שנתיים מיום שחרורו ממאסר.', true, 'זו התשובה הנכונה. כאשר נגזר על נידון מאסר בפועל לצד מאסר על תנאי, תקופת התנאי תחל ביום שחרורו ממאסר, בהתאם לסעיף 52(ג) לחוק העונשין ופרשנותו בפסיקה (הלכת נעים והלכת אשקר).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'שנתיים מהמועד האחרון להגשת ערעור על גזר הדין.', false, 'תשובה זו שגויה. מועד תחילת תקופת התנאי אינו קשור למועד הגשת ערעור, אלא ליום מתן גזר הדין או ליום השחרור ממאסר, לפי העניין.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'שנתיים מיום 1.3.2023.', false, 'תשובה זו שגויה. יום ההתייצבות לריצוי המאסר אינו המועד הקובע לתחילת תקופת התנאי, אלא יום השחרור ממאסר.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 12, '2024-W-S-Q12';
END
$$;

-- ============================================================
-- Q13 — 2024-W-S-Q13 — chapter=ethics subtopic=fiduciary_privilege_conflict
-- classifier_note: Conflict of interest between two clients of same lawyer
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd76cdc0e-9327-4429-b5b0-63e02a90a740'::uuid;
  v_group_id uuid := 'c824a57e-811c-426e-b12a-2d35a4fd8d3c'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q13';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 13, '2024-W-S-Q13';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'ethics';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'ethics';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fiduciary_privilege_conflict' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fiduciary_privilege_conflict', 'ethics';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q13', v_chapter_id, v_subtopic_id, 'חברת "א.א. שירותים" בע"מ היא לקוחה קבועה של עו"ד הלוי, אשר מעניק לה שירותים משפטיים שונים באופן קבוע. חברת "ב.ב. ניהול נכסים" בע"מ נקלעה לסכסוך עסקי עם חברת א.א. שירותים ופנתה אל עו"ד הלוי על מנת שייצג אותה בסכסוך זה. עו"ד הלוי, שלא ייצג את חברת א.א. שירותים בע"מ בסכסוך זה, נטל על עצמו את הייצוג של חברת ב.ב. שירותים בע"מ. חברת א.א. שירותים בע"מ פנתה אל ועדת האתיקה בתלונה כי אסור היה לעו"ד הלוי ליטול את ייצוג חברת ב.ב. ניהול נכסים. מה דין התלונה? מדוע?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 13}'::jsonb, 'השאלה עוסקת בכלל 14(ג) לכללי לשכת עורכי הדין (אתיקה מקצועית), התשמ"ו-1986, העוסק באיסור על עורך דין לייצג צד אחר בעניין שצד בו לקוח קבוע שלו. הכלל נועד להגן על חובת הנאמנות של עורך הדין כלפי לקוחותיו הקבועים ועל אמון הציבור במקצוע, וזאת גם אם עורך הדין אינו מייצג את הלקוח הקבוע באותו עניין ספציפי.', 'כלל 14(ג) לכללי לשכת עורכי הדין (אתיקה מקצועית), התשמ"ו-1986, קובע כי "בענין שצד בו לקוח קבוע של עורך הדין לא ייצג עורך דין צד אחר, גם אם באותו ענין אין עורך הדין מייצג את הלקוח הקבוע; לענין הוראה זו, ''לקוח קבוע'' - לקוח שעורך הדין נותן לו שירותים דרך קבע". תכלית הכלל היא למנוע מצב של ניגוד עניינים פוטנציאלי, שכן עורך דין המטפל בקביעות בענייני לקוח מכיר את סדריו הפנימיים, דרך הטיפול שלו בתביעות ואת מדיניותו לעניין פשרה. מידע זה עלול לשמש לרעת הלקוח הקבוע, גם אם עורך הדין אינו מייצג אותו באותו עניין ספציפי. האיסור חל גם אם עורך הדין סבור שאין חשש לניגוד עניינים בפועל, שכן מדובר באיסור התנהגותי. במקרה הנדון, חברת "א.א. שירותים" בע"מ היא לקוחה קבועה של עו"ד הלוי, ולכן חל עליו איסור לייצג את חברת "ב.ב. ניהול נכסים" בע"מ נגדה, גם אם הוא לא ייצג את חברת א.א. שירותים בע"מ בסכסוך הספציפי. סעיף 14(ג) לכללי לשכת עורכי הדין (אתיקה מקצועית), התשמ"ו-1986. ת"א (שלום צפת) 29166-09-11 חברת נוגידאת פאוזי (1992) בע"מ נ'' סאפי נוג''ידאת (28.09.2016). ת"א (מחוזי מרכז) 18337-08-10 שאנקול לשיווק (1937) בע"מ נ'' סומך חייקין (10.02.2019). ת"א (שלום נצרת) 33993-01-21 אורי גולדברג נ'' איל רוזן (31.05.2023)', 'הטעות הנפוצה היא להניח כי אם עורך הדין אינו מייצג את הלקוח הקבוע באותו עניין ספציפי, אין מניעה לייצג צד אחר נגדו. יש לזכור את ההבחנה בין לקוח קבוע ללקוח מזדמן ואת ההיקף הרחב של האיסור בכלל 14(ג).',
    '["לקוח קבוע", "ניגוד עניינים", "כלל 14(ג) לכללי האתיקה", "חובת נאמנות", "אתיקה מקצועית", "ייצוג נגד לקוח"]'::jsonb, '**וריאציה 1 — הגדרת לקוח קבוע:** מהו "לקוח קבוע" לפי כללי האתיקהלקוח שעורך הדין נותן לו שירותים דרך קבע (סעיף 14(ג) לכללי האתיקה).
**וריאציה 2 — ייצוג נגד לקוח קבוע:** האם עו"ד רשאי לייצג צד אחר נגד לקוח קבוע שלו בעניין שבו הוא לא מייצג את הלקוח הקבועלא, כלל 14(ג) אוסר זאת (סעיף 14(ג) לכללי האתיקה).
**וריאציה 3 — תכלית האיסור:** מהי תכלית האיסור ב-14(גלמנוע פגיעה בחובת הנאמנות ובאמון הלקוח, שכן עו"ד מכיר את סדריו הפנימיים של הלקוח הקבוע (ת"א (שלום צפת) 29166-09-11 חברת נוגידאת פאוזי (1992) בע"מ נ'' סאפי נוג''ידאת).', 'לקוח קבועאיסור ייצוג נגדו בכל ענייןגם אם לא מייצג באותו עניין ספציפיהגנה על אמון וסודיות.', '["כללי לשכת עורכי הדין (אתיקה מקצועית), תשמ\"ו-1986, סעיף 14(ג)", "ת\"א (שלום צפת) 29166-09-11 חברת נוגידאת פאוזי (1992) בע\"מ נ'' סאפי נוג''ידאת (28.09.2016)", "ת\"א (מחוזי מרכז) 18337-08-10 שאנקול לשיווק (1937) בע\"מ נ'' סומך חייקין (10.02.2019)", "ת\"א (שלום נצרת) 33993-01-21 אורי גולדברג נ'' איל רוזן (31.05.2023)"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''ethics'' subtopic=''fiduciary_privilege_conflict'' | classifier_note: Conflict of interest between two clients of same lawyer | source_review_note: הנושא הספציפי הוא דיני אתיקה מקצועית של עורכי דין, אשר אינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין פלילי - משמעת עורכי דין'' כקרובה ביותר, אך יש לציין שהנושא הוא אתיקה מקצועית באופן כללי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'דין התלונה להתקבל, מאחר שעו"ד הלוי מעניק שירותים דרך קבע לחברת א.א. שירותים בע"מ, שהיא לקוח קבוע שלו, ולכן חל עליו איסור לייצג צד אחר נגדה, גם אם באותו עניין הוא אינו מייצג אותה.', true, 'זו התשובה הנכונה. כלל 14(ג) לכללי לשכת עורכי הדין (אתיקה מקצועית) אוסר על עורך דין לייצג צד אחר בעניין שצד בו לקוח קבוע שלו, גם אם אינו מייצג את הלקוח הקבוע באותו עניין ספציפי.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'דין התלונה להידחות; מאחר שעו"ד הלוי אינו מייצג את חברת א.א. שירותים בע"מ באותו סכסוך עם חברת ב.ב. ניהול נכסים בע"מ, אין כל מניעה שייצג את האחרונה בסכסוך זה.', false, 'תשובה זו שגויה. כלל 14(ג) אוסר ייצוג נגד לקוח קבוע בכל עניין, גם אם עורך הדין אינו מייצג את הלקוח הקבוע באותו עניין ספציפי. ההיכרות עם הלקוח הקבוע יוצרת חשש לניגוד עניינים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'לא ניתן לקבוע אם דין התלונה להתקבל או לא, שכן יש לבחון האם עולה חשש לניגוד עניינים במצב הנתון.', false, 'תשובה זו שגויה. כלל 14(ג) יוצר חזקה של ניגוד עניינים במצב של ייצוג נגד לקוח קבוע, ואינו דורש בחינה פרטנית של חשש לניגוד עניינים בכל מקרה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'דין התלונה להידחות; לא חלה על עו"ד הלוי כל מניעה בדין לייצג את חברת ב.ב. ניהול נכסים בע"מ נגד חברת א.א. שירותים בע"מ במצב הנתון והוא רשאי להתקשר עם חברת ב.ב. ניהול נכסים לפי שיקול דעתו הבלעדי ויכולתו לקבל את התיק לייצוג על ידו.', false, 'תשובה זו שגויה. כללי האתיקה מגבילים את שיקול דעתו של עורך הדין במקרים של ניגוד עניינים, ובפרט כאשר מדובר בלקוח קבוע.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 13, '2024-W-S-Q13';
END
$$;

-- ============================================================
-- Q14 — 2024-W-S-Q14 — chapter=labor subtopic=workplace_harassment
-- classifier_note: Sexual harassment at work, statute of limitations, civil claim
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '2649adae-68b3-4ffc-b4bf-1382dd767026'::uuid;
  v_group_id uuid := '2e1697a0-8146-4413-85ab-b1760d2da60a'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q14';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 14, '2024-W-S-Q14';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'labor';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'labor';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'workplace_harassment' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'workplace_harassment', 'labor';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q14', v_chapter_id, v_subtopic_id, 'ביום 1.1.2019 חווה אביתר מצד מנהלתו הישירה אירוע של הטרדה מינית. למרות היותו עובד מוערך, לא קודם אביתר בסבב קידום שנערך בחודש יוני 2019. ביום 1.4.2023 הגיש אביתר תביעה כנגד מעסיקתו בבית הדין האזורי לעבודה בתל אביב, בה טען שקידומו נעצר עקב התנגדותו להטרדה המינית שעבר. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 14}'::jsonb, 'השאלה עוסקת בשני היבטים מרכזיים בתביעות אזרחיות בגין הטרדה מינית והתנכלות במקום העבודה: תקופת ההתיישנות ונטל ההוכחה. היא בוחנת את סעיפים 6(ג) ו-6א לחוק למניעת הטרדה מינית, ואת הקשר שלהם לסעיף 7 לחוק שוויון ההזדמנויות בעבודה ולחוק ההתיישנות. השאלה מדגישה את ההבחנה בין תקופת ההתיישנות הכללית (7 שנים) לבין התקופה הרלוונטית להעברת נטל ההוכחה למעסיק (3 שנים).', 'האירוע של ההטרדה המינית התרחש ב-1.1.2019. התביעה הוגשה ב-1.4.2023. תקופת ההתיישנות לתביעה אזרחית בגין הטרדה מינית והתנכלות היא 7 שנים מיום היווצרות העילה, בהתאם לסעיף 6(ג) לחוק למניעת הטרדה מינית וסעיף 5 לחוק ההתיישנות. מאחר שהתביעה הוגשה ב-1.4.2023, היא הוגשה בתוך תקופת ההתיישנות (שתסתיים ב-1.1.2026), ולכן היא אינה התיישנה. סעיף 6(ג) לחוק למניעת הטרדה מינית, תשנ"ח-1998. נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | חוק למניעת הטרדה מינית, התשנ"ח-1998. עם זאת, לעניין נטל ההוכחה, סעיף 6א לחוק למניעת הטרדה מינית קובע כי חובת ההוכחה תהיה על המעסיק כי לא פגע פגיעה על רקע הטרדה מינית, אם העובד הוכיח את התקיימות הפגיעה ובלבד שטרם חלפו שלוש שנים מיום שנוצרה העילה. במקרה זה, מיום היווצרות העילה (1.1.2019) ועד למועד הגשת התביעה (1.4.2023) חלפו למעלה משלוש שנים. לכן, התנאי להעברת נטל ההוכחה למעסיקה אינו מתקיים. במצב כזה, על אביתר יהיה הנטל להוכיח את אירוע ההטרדה המינית ואת הקשר הסיבתי בין ההטרדה לבין עצירת הקידום. לאחר מכן, על המעסיקה יהיה הנטל להוכיח שאין קשר כזה, כלומר שהפגיעה לא נבעה מההטרדה המינית או מהתלונה בגינה. סעיף 6א לחוק למניעת הטרדה מינית, תשנ"ח-1998. סע"ש (עבודה חיפה) 32518-02-20 פלונית - מדינת ישראל - משרד החינוך התרבות והספורט (01.09.2024). ע"א 3347/16 פלונית נ'' פלוני (20.02.2018)', 'הטעות הנפוצה היא לבלבל בין תקופת ההתיישנות הכללית (7 שנים) לבין התקופה הרלוונטית להעברת נטל ההוכחה למעסיק (3 שנים), או להניח שנטל ההוכחה עובר למעסיק באופן אוטומטי בכל מקרה של הטרדה מינית.',
    '["הטרדה מינית", "התנכלות", "התיישנות", "נטל הוכחה", "חוק למניעת הטרדה מינית", "חוק שוויון ההזדמנויות בעבודה", "יחסי עבודה"]'::jsonb, '**וריאציה 1 — התיישנות:** מתי תתיישן תביעת אביתרב-1.1.2026, שכן תקופת ההתיישנות היא 7 שנים מיום היווצרות העילה (סעיף 6(ג) לחוק למניעת הטרדה מינית).
**וריאציה 2 — נטל הוכחה (מעבר):** האם נטל ההוכחה עובר למעסיקהלא, שכן חלפו למעלה משלוש שנים מיום היווצרות העילה, ולכן התנאי להעברת הנטל לפי סעיף 6א לא התקיים (סעיף 6א לחוק למניעת הטרדה מינית).
**וריאציה 3 — נטל הוכחה (חלוקה):** כיצד יתחלק נטל ההוכחהעל אביתר להוכיח את ההטרדה והקשר לפגיעה, ועל המעסיקה להוכיח שאין קשר כזה (סע"ש (עבודה חיפה) 32518-02-20 פלונית - מדינת ישראל - משרד החינוך התרבות והספורט).', 'תביעת הטרדה מיניתהתיישנות 7 שנים מיום העילהנטל הוכחה עובר למעסיק רק אם הוגשה תוך 3 שניםאחרת, נטל ההוכחה על התובע להוכיח את הפגיעה והקשר, ועל המעסיק להוכיח היעדר קשר.', '["חוק למניעת הטרדה מינית, תשנ\"ח-1998, סעיף 6א", "חוק למניעת הטרדה מינית, תשנ\"ח-1998, סעיף 6(ג)", "חוק שוויון ההזדמנויות בעבודה, תשמ\"ח-1988, סעיף 7", "סע\"ש (עבודה חיפה) 32518-02-20 פלונית - מדינת ישראל - משרד החינוך התרבות והספורט (01.09.2024)", "ע\"א 3347/16 פלונית נ'' פלוני (20.02.2018)", "נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | חוק למניעת הטרדה מינית, התשנ\"ח-1998", "שלמה יעקובוביץ סדרי הדין בבית הדין לעבודה (2024) | פרק כ סדר הדין בהליכי הטרדה מינית והתנכלות בבית הדין לעבודה"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''labor'' subtopic=''workplace_harassment'' | classifier_note: Sexual harassment at work, statute of limitations, civil claim | source_review_note: השאלה עוסקת בדיני עבודה ודיני נזיקין בהקשר של הטרדה מינית, תחום שאינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין אזרחי - הליכים'' כקרובה ביותר, אך יש לציין שהנושא הספציפי הוא דיני עבודה/נזיקין.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'תביעתו של אביתר תתיישן ביום 1.1.2026, נטל ההוכחה כולו על המעסיקה.', false, 'תשובה זו שגויה בחלקה. אף שתאריך ההתיישנות נכון (1.1.2026), נטל ההוכחה אינו עובר כולו למעסיקה במקרה זה, שכן חלפו למעלה משלוש שנים מיום היווצרות העילה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'תביעתו של אביתר התיישנה במועד הגשת התביעה. אלמלא הייתה מתיישנת היה נטל ההוכחה כולו על אביתר.', false, 'תשובה זו שגויה. התביעה לא התיישנה במועד הגשתה (1.4.2023), שכן תקופת ההתיישנות היא 7 שנים מיום היווצרות העילה (1.1.2019).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'תביעתו של אביתר תתיישן ביום 1.1.2026. נטל ההוכחה כולו על אביתר.', false, 'תשובה זו שגויה בחלקה. אף שתאריך ההתיישנות נכון (1.1.2026), נטל ההוכחה אינו כולו על אביתר, אלא מתחלק בין הצדדים.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'תביעתו של אביתר התיישנה במועד הגשת התביעה. אלמלא הייתה מתיישנת, על אביתר היה הנטל להוכיח את אירוע ההטרדה המינית, ואת עצירת הקידום, ועל המעסיקה להוכיח שאין לכך קשר לאירוע ההטרדה המינית.', true, 'זו התשובה הנכונה. אף שהתביעה לא התיישנה בפועל (היא תתיישן ב-1.1.2026), החלק השני של התשובה מתאר נכונה את חלוקת נטל ההוכחה: מאחר שחלפו למעלה משלוש שנים מיום היווצרות העילה (1.1.2019), נטל ההוכחה להעברת הנטל למעסיקה לא התקיים. לכן, על אביתר להוכיח את ההטרדה והקשר לפגיעה, ועל המעסיקה להוכיח שאין קשר כזה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 14, '2024-W-S-Q14';
END
$$;

-- ============================================================
-- Q15 — 2024-W-S-Q15 — chapter=ethics subtopic=licensing_bar_membership
-- classifier_note: Lawyer's death + appointed custodian — bar association governance
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '17332e21-f8c7-40f8-a181-1d0da26cfd30'::uuid;
  v_group_id uuid := '0b32b0b7-aec9-4d54-8a13-7dff404754fd'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q15';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 15, '2024-W-S-Q15';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'ethics';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'ethics';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'licensing_bar_membership' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'licensing_bar_membership', 'ethics';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q15', v_chapter_id, v_subtopic_id, 'לאחר פטירתו הפתאומית של עו"ד פנחס, בית המשפט המחוזי בירושלים מינה בהסכמה, לבקשת הוועד המחוזי, את עו"ד ראובן להיות ממונה על ענייניו המקצועיים של עו"ד פנחס ולטפל בהם. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 15}'::jsonb, 'השאלה עוסקת בהוראות חוק לשכת עורכי הדין, התשכ"א-1961, הנוגעות למינוי ממונה על ענייניו המקצועיים של עורך דין במקרים של פטירה, השעיה או נסיבות אחרות המונעות ממנו לטפל בענייניו. היא מתמקדת בתקופת המינוי המקסימלית ובתנאים להתפטרות הממונה, כפי שנקבעו בסעיפים 89א ו-89ג לחוק.', 'סעיף 89א(א) לחוק לשכת עורכי הדין, התשכ"א-1961, קובע כי בית המשפט המחוזי רשאי למנות ממונה על ענייניו המקצועיים של עורך דין במקרים שונים, ובהם פטירה. סעיף 89א(ב) קובע כי "תקופת המינוי לא תעלה על שנתיים, ואולם רשאי בית המשפט להאריך את תקופת המינוי לתקופה נוספת, ובלבד שסך כל תקופת המינוי לא תעלה על שלוש שנים". בנוסף, סעיף 89ג(א) לחוק קובע כי "הממונה רשאי להתפטר מתפקידו רק באישור בית המשפט". הוראות אלו נועדו להבטיח את המשך הטיפול המסודר בענייני הלקוחות של עורך הדין, תוך שמירה על האינטרסים שלהם ועל כבוד המקצוע, וזאת באמצעות פיקוח שיפוטי על הממונה. במקרה הנדון, עו"ד פנחס נפטר, ועו"ד ראובן מונה כממונה. לכן, תקופת המינוי לא תעלה על שנתיים, והוא יוכל להתפטר רק באישור בית המשפט. סעיף 89א(ב) לחוק לשכת עורכי הדין, התשכ"א-1961. סעיף 89ג(א) לחוק לשכת עורכי הדין, התשכ"א-1961. רע"פ 58943-09-19 אליאס אשקר נ'' מדינת ישראל (08.02.2022). יורם רבין, יניב ואקי דיני עונשין - כרך ג: הענישה הפלילית (2022) | פרק 7 מאסר על-תנאי', 'הטעות הנפוצה היא לבלבל בין תקופת המינוי המקסימלית לבין תקופת ההארכה האפשרית, או לחשוב שהממונה רשאי להתפטר ללא אישור בית המשפט.',
    '["ממונה על ענייני עורך דין", "חוק לשכת עורכי הדין", "פטירה", "תקופת מינוי", "התפטרות ממונה", "אישור בית המשפט"]'::jsonb, '**וריאציה 1 — תקופת מינוי:** מהי תקופת המינוי המקסימלית לממונהשנתיים (סעיף 89א(ב) לחוק לשכת עורכי הדין).
**וריאציה 2 — התפטרות:** האם הממונה יכול להתפטר בכל עתלא, רק באישור בית המשפט (סעיף 89ג(א) לחוק לשכת עורכי הדין).
**וריאציה 3 — הארכה:** האם ניתן להאריך את המינויכן, עד סך כולל של שלוש שנים, באישור בית המשפט (סעיף 89א(ב) לחוק לשכת עורכי הדין).', 'ממונה על עו"ד שנפטרמינוי עד שנתייםהתפטרות באישור ביהמ"שאפשרות הארכה עד 3 שנים סה"כ.', '["חוק לשכת עורכי הדין, התשכ\"א-1961, סעיף 89א", "חוק לשכת עורכי הדין, התשכ\"א-1961, סעיף 89ג", "רע\"פ 58943-09-19 אליאס אשקר נ'' מדינת ישראל (08.02.2022)", "יורם רבין, יניב ואקי דיני עונשין - כרך ג: הענישה הפלילית (2022) | פרק 7 מאסר על-תנאי"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''ethics'' subtopic=''licensing_bar_membership'' | classifier_note: Lawyer''s death + appointed custodian — bar association governance | source_review_note: השאלה עוסקת בדיני לשכת עורכי הדין, אשר אינם מופיעים כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין פלילי - משמעת עורכי דין'' כקרובה ביותר, שכן מינוי ממונה קשור לפיקוח על עורכי דין, אך יש לציין שהנושא הוא ספציפי לחוק לשכת עורכי הדין.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'תקופת המינוי לא תעלה על שנתיים, ועו"ד ראובן יהיה רשאי להתפטר לפני כן רק באישור בית המשפט.', true, 'זו התשובה הנכונה. סעיף 89א(ב) לחוק לשכת עורכי הדין קובע כי תקופת המינוי לא תעלה על שנתיים, וסעיף 89ג(א) קובע כי הממונה רשאי להתפטר רק באישור בית המשפט.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'תקופת המינוי לא תעלה על שנה, ועו"ד ראובן יהיה רשאי להתפטר לפני כן רק באישור בית המשפט.', false, 'תשובה זו שגויה. תקופת המינוי המקסימלית היא שנתיים, ולא שנה, כקבוע בסעיף 89א(ב) לחוק לשכת עורכי הדין.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'תקופת המינוי לא תעלה על חמש שנים, ועו"ד ראובן יהיה רשאי להתפטר לפני כן ללא צורך באישור בית המשפט.', false, 'תשובה זו שגויה. תקופת המינוי המקסימלית היא שנתיים, ולא חמש שנים, והתפטרות דורשת אישור בית המשפט, בניגוד לנטען.', 0);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'תקופת המינוי לא תעלה על שנה, ועו"ד ראובן יהיה רשאי להתפטר לפני כן ללא צורך באישור בית המשפט.', false, 'תשובה זו שגויה. תקופת המינוי המקסימלית היא שנתיים, והתפטרות דורשת אישור בית המשפט, בניגוד לנטען.', 0);

  RAISE NOTICE 'Q% inserted: external_id %', 15, '2024-W-S-Q15';
END
$$;

-- ============================================================
-- Q16 — 2024-W-S-Q16 — chapter=family_inheritance subtopic=inheritance_will
-- classifier_note: Coercion / undue influence in a will — invalidity
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'f6ecc176-76dd-43c6-a894-3f61380630f2'::uuid;
  v_group_id uuid := '7a3ffd2e-f67d-428a-b497-d1085823e32c'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q16';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 16, '2024-W-S-Q16';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'family_inheritance';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'family_inheritance';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'inheritance_will' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'inheritance_will', 'family_inheritance';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q16', v_chapter_id, v_subtopic_id, 'דקלה הורישה לבן זוגה יובל בצוואה את כל רכושה, וזאת לאחר שאמר לה שאם היא לא תוריש לו את כל רכושה, הוא יסיים את מערכת היחסים ביניהם. לאחר זמן נפרדו השניים מיוזמתו של יובל ובניגוד לרצונה של דקלה, וכל אחד מהם המשיך את חייו ללא אירועים חריגים. לאחר שנה וחצי ממועד הפרידה מיובל, נהרגה דקלה בתאונת דרכים. יורש על פי דין של דקלה, שאינו מוזכר בצוואה, טוען לבטלות הצוואה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 16}'::jsonb, 'השאלה עוסקת בעילת ביטול צוואה מחמת השפעה בלתי הוגנת, ובפרט בתחולתו של סעיף 31 לחוק הירושה, התשכ"ה-1965. סעיף זה קובע כי אם חלפה שנה מהיום שההשפעה הבלתי הוגנת חדלה לפעול על המצווה, והיה בידו לבטל את הצוואה ולא עשה כן, הפגם לא יהווה עוד עילה לביטול הצוואה. השאלה בוחנת את יישום הכלל הזה על מקרה שבו ההשפעה חדלה לפעול זמן רב לפני פטירת המצווה.', 'סעיף 30(א) לחוק הירושה, תשכ"ה-1965, קובע כי הוראת צוואה שנעשתה מחמת אונס, איום, השפעה בלתי הוגנת, תחבולה או תרמית – בטלה. במקרה הנדון, ייתכן שדקלה ערכה את הצוואה לטובת יובל מחמת השפעה בלתי הוגנת (איום על סיום מערכת היחסים). אולם, סעיף 31 לחוק הירושה קובע חריג לכלל זה: "עברה שנה מהיום שהאונס, האיום, ההשפעה הבלתי הוגנת או התחבולה חדלו לפעול על המצווה... והיה בידי המצווה לבטל את הצוואה ולא עשה כן, לא יהיה עוד באותו פגם כדי ביטול הוראת הצוואה או תיקונה". במקרה של דקלה ויובל, הפרידה ביניהם, שהייתה מיוזמתו של יובל ובניגוד לרצונה של דקלה, מסמלת את המועד שבו ההשפעה הבלתי הוגנת (אם הייתה כזו) חדלה לפעול. מאז הפרידה ועד פטירתה של דקלה חלפו שנה וחצי (18 חודשים). בתקופה זו, דקלה הייתה חופשייה מכל השפעה ויכולה הייתה לבטל את הצוואה, אך לא עשתה כן. לפיכך, מכוח סעיף 31 לחוק הירושה, הפגם הנטען של השפעה בלתי הוגנת אינו מהווה עוד עילה לביטול הצוואה, והצוואה לטובת יובל לא תבוטל. סעיף 31 לחוק הירושה, תשכ"ה-1965. ת"ע (משפחה תל אביב-יפו) 35598-05-22 פלוני נ'' פלונית (01.04.2024). עמ"ש (מחוזי חיפה) 34987-10-16 ש'' ט'' נ'' ה'' ט'' ר'' (31.12.2019). נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | חוק הירושה, התשכ"ה-1965', 'הטעות הנפוצה היא להתמקד בקיומה של השפעה בלתי הוגנת בלבד (סעיף 30), מבלי ליישם את הוראת סעיף 31 לחוק הירושה, המרפא את הפגם אם חלפה שנה והמצווה לא ביטל את הצוואה.',
    '["השפעה בלתי הוגנת", "חוק הירושה", "סעיף 30", "סעיף 31", "ביטול צוואה", "רצון חופשי", "תקופת שנה"]'::jsonb, '**וריאציה 1 — מועד הפסקת ההשפעה:** מתי מתחילה להיספר תקופת השנה לפי סעיףמהיום שהאונס, האיום, ההשפעה הבלתי הוגנת או התחבולה חדלו לפעול על המצווה (סעיף 31 לחוק הירושה).
**וריאציה 2 — יכולת ביטול:** מהו תנאי נוסף לתחולת סעיףשהיה בידי המצווה לבטל את הצוואה ולא עשה כן (סעיף 31 לחוק הירושה).
**וריאציה 3 — רציונל הסעיף:** מהו הרציונל מאחורי סעיףאם המצווה יכול היה לשנות את ההוראה הפגומה ולא עשה כן, חזקה עליו שהיא משקפת את רצונו החופשי והאמיתי (נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | חוק הירושה, התשכ"ה-1965).', 'צוואה שנעשתה תחת השפעה בלתי הוגנתלא תבוטל אם חלפה שנה ממועד הפסקת ההשפעהובתנאי שהמצווה יכול היה לבטל ולא עשה כן (סעיף 31 לחוק הירושה).', '["חוק הירושה, תשכ\"ה-1965, סעיף 30(א)", "חוק הירושה, תשכ\"ה-1965, סעיף 31", "ת\"ע (משפחה תל אביב-יפו) 35598-05-22 פלוני נ'' פלונית (01.04.2024)", "עמ\"ש (מחוזי חיפה) 34987-10-16 ש'' ט'' נ'' ה'' ט'' ר'' (31.12.2019)", "נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | חוק הירושה, התשכ\"ה-1965"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''family_inheritance'' subtopic=''inheritance_will'' | classifier_note: Coercion / undue influence in a will — invalidity | source_review_note: הנושא המרכזי הוא דיני ירושה (תוקף צוואה), אשר אינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין אזרחי - הליכים'' כקרובה ביותר, שכן מדובר בהליך התנגדות לצוואה.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'הצוואה לטובת יובל תבוטל מכוח השפעה בלתי הוגנת על דקלה.', false, 'תשובה זו שגויה. אף אם הייתה השפעה בלתי הוגנת, חלפה שנה וחצי מאז שההשפעה חדלה לפעול (מועד הפרידה), ולכן הפגם אינו עילה לביטול הצוואה לפי סעיף 31 לחוק הירושה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הצוואה לטובת יובל תבוטל לאור מותה הפתאומי בטרם עת של דקלה.', false, 'תשובה זו שגויה. מותה הפתאומי של דקלה אינו עילה לבטל צוואה, אלא אם כן מדובר בצוואה בעל פה שנעשתה בסמוך למוות, וזה לא המקרה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'הצוואה לטובת יובל לא תבוטל בתנאי שיובל יצליח להוכיח שדקלה לא היתה מעוניינת להיפרד ממנו.', false, 'תשובה זו שגויה. רצונה של דקלה להיפרד או לא להיפרד אינו רלוונטי לשאלת תוקף הצוואה לאחר שחלפה תקופת השנה הקבועה בסעיף 31 לחוק הירושה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הצוואה כלפי יובל לא תבוטל.', true, 'זו התשובה הנכונה. לפי סעיף 31 לחוק הירושה, אם עברה שנה מהיום שההשפעה הבלתי הוגנת חדלה לפעול על המצווה, והיה בידו לבטל את הצוואה ולא עשה כן, הפגם אינו עילה לביטול. במקרה זה, חלפו 18 חודשים (שנה וחצי) מאז הפרידה, שהיא המועד בו ההשפעה חדלה לפעול.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 16, '2024-W-S-Q16';
END
$$;

-- ============================================================
-- Q17 — 2024-W-S-Q17 — chapter=ethics subtopic=fees_client_funds_advertising  [needs_review]
-- classifier_note: Lawyer-client disagreement, termination of representation — ethics; subtopic is approximate (no 'termination' subtopic)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '68f0e86b-9ee8-4dc2-a9a2-2a39af281865'::uuid;
  v_group_id uuid := 'f4955def-9423-40dd-a67a-cc4be2e4b208'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q17';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 17, '2024-W-S-Q17';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'ethics';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'ethics';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fees_client_funds_advertising' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fees_client_funds_advertising', 'ethics';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q17', v_chapter_id, v_subtopic_id, 'עו"ד משה מייצג את יפתח בתביעה המתנהלת בבית המשפט. בין עו"ד משה לבין יפתח נוצרה אי הסכמה באשר לאופן שבו יש לנהל את התיק. למרות זאת יפתח עומד על המשך הייצוג. עו"ד משה אינו מעוניין לעשות כן. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 17}'::jsonb, 'השאלה עוסקת בהוראות החלות על עורך דין המבקש להפסיק ייצוג של לקוח בהליך תלוי ועומד, כאשר קיימים חילוקי דעות ביניהם. היא בוחנת את האיזון בין זכותו של עורך הדין שלא לכפות עליו ''שירות אישי'' לבין חובותיו האתיות והפרוצדורליות כלפי הלקוח וכלפי בית המשפט, כפי שנקבעו בכללי לשכת עורכי הדין (אתיקה מקצועית) ובתקנות סדר הדין האזרחי.', 'היחסים בין עורך דין ללקוח מבוססים על אמון הדדי, והשירות שעורך הדין נותן הוא ''שירות אישי''. כאשר מתגלעים חילוקי דעות מהותיים בין עורך הדין ללקוח בנוגע לאופן הטיפול בתיק, עורך הדין רשאי לבקש להפסיק את הייצוג, כפי שקובע כלל 13(א) לכללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986. עם זאת, כאשר העניין תלוי ועומד בפני בית המשפט, עורך הדין אינו רשאי להפסיק את הייצוג באופן חד צדדי. כלל 13(ג) לכללי האתיקה ותקנה 172 לתקנות סדר הדין האזרחי, תשע"ט-2018 (או תקנה 473(ב) לתקנות סדר הדין האזרחי, תשמ"ד-1984, שהייתה בתוקף בעת מתן חלק מהפסקים) קובעים כי עורך דין רשאי להפסיק את הייצוג רק ברשות בית המשפט. בנוסף, כלל 13(ב) מחייב את עורך הדין להודיע ללקוח ללא דיחוי על כוונתו להפסיק את הטיפול, ולפעול, במידת האפשר, באופן שלא יפגע בענייניו של הלקוח. הפסיקה מדגישה כי סירוב לשחרר עורך דין מייצוג מהווה אכיפה של ''שירות אישי'', אך בית המשפט יאזן זאת מול שיקולים נוספים כמו שלב ההליך, מידת הפגיעה בלקוח ובצד שכנגד. כלל 13(א) לכללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986. כלל 13(ג) לכללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986. תקנה 172 לתקנות סדר הדין האזרחי, תשע"ט-2018. רע"א 15/05 עו"ד מ'' בלטר ואחרים נ'' אמיתי יגאלי (23.08.2005). רע"א (מחוזי חי'') 17575-12-18 עו"ד משה פרייליך ואח'' נ'' מנחם המר (10.01.2019). סע"ש (אזורי י-ם) 67797-11-21 משה סעדה - מדינת ישראל (30.07.2023)', 'הטעות הנפוצה היא לחשוב שעורך דין יכול להפסיק ייצוג באופן מיידי עקב חילוקי דעות, מבלי להבין את הדרישה לאישור בית המשפט ואת חובתו להגן על ענייני הלקוח.',
    '["הפסקת ייצוג", "חילוקי דעות", "כללי אתיקה מקצועית", "תקנות סדר הדין האזרחי", "אישור בית משפט", "שירות אישי", "חובת נאמנות"]'::jsonb, '**וריאציה 1 — עילה להפסקת ייצוג:** האם חילוקי דעות הם עילה להפסקת ייצוגכן, לפי כלל 13(א) לכללי האתיקה (כלל 13(א) לכללי לשכת עורכי הדין (אתיקה מקצועית)).
**וריאציה 2 — אישור בית משפט:** האם עו"ד משה יכול להפסיק ייצוג ללא אישור בית המשפטלא, כאשר התיק תלוי ועומד, נדרש אישור בית המשפט לפי תקנה 172 (או 473) (תקנה 172 לתקנות סדר הדין האזרחי).
**וריאציה 3 — חובת עורך הדין:** מה חובתו של עו"ד משה כלפי יפתחלהודיע לו על הכוונה להפסיק את הייצוג ולפעול באופן שלא יפגע בענייניו (כלל 13(ב) לכללי לשכת עורכי הדין (אתיקה מקצועית)).', 'עו"ד רוצה להפסיק ייצוג עקב חילוקי דעותחייב להודיע ללקוח ולא לפגוע בענייניוחייב לקבל אישור בית משפט אם התיק תלוי ועומד.', '["כללי לשכת עורכי הדין (אתיקה מקצועית), תשמ\"ו-1986, כלל 13", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 172", "רע\"א 15/05 עו\"ד מ'' בלטר ואחרים נ'' אמיתי יגאלי (23.08.2005)", "רע\"א (מחוזי חי'') 17575-12-18 עו\"ד משה פרייליך ואח'' נ'' מנחם המר (10.01.2019)", "סע\"ש (אזורי י-ם) 67797-11-21 משה סעדה - מדינת ישראל (30.07.2023)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''ethics'' subtopic=''fees_client_funds_advertising'' | classifier_note: Lawyer-client disagreement, termination of representation — ethics; subtopic is approximate (no ''termination'' subtopic) | source_review_note: הנושא המרכזי הוא אתיקה מקצועית של עורכי דין והפסקת ייצוג, אשר אינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין פלילי - משמעת עורכי דין'' כקרובה ביותר, שכן מדובר בפיקוח על התנהלות עורכי דין, אך יש לציין שהנושא הוא ספציפי לכללי האתיקה ולתקנות סדר הדין האזרחי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על עו"ד משה לנהל את התיק לפי מיטב הבנתו בניגוד לעמדותיו של יפתח וחרף התנגדותו, שכן הוא בעל הידע המקצועי.', false, 'תשובה זו שגויה. אף שעורך הדין הוא בעל הידע המקצועי, הלקוח הוא ''אדון ענייניו'', וקיימת חובה לשתף פעולה. ניהול התיק בניגוד מוחלט לרצון הלקוח עלול לפגוע ביחסי האמון ולעלות כדי הפרת חובות אתיות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על עו"ד משה להודיע ליפתח כי הוא מתפטר מן הייצוג באופן מיידי ולחדול מיד מלייצגו.', false, 'תשובה זו שגויה. כאשר עניין תלוי ועומד בפני בית המשפט, עורך הדין אינו רשאי להפסיק את הייצוג באופן מיידי, אלא בכפוף לאישור בית המשפט ובהתאם להוראות כל חיקוק, תוך דאגה שלא לפגוע בענייני הלקוח.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על עו"ד משה להודיע ליפתח על כוונתו להפסיק את הייצוג ולאפשר לו להתארגן בהתאם, ולקבל את רשות בית המשפט להתפטר מן הייצוג.', true, 'זו התשובה הנכונה. סעיף 13 לכללי לשכת עורכי הדין (אתיקה מקצועית) ותקנה 172 לתקנות סדר הדין האזרחי (או 473 לתקנות הישנות) קובעים כי עורך דין המבקש להפסיק ייצוג בהליך תלוי ועומד חייב לקבל את רשות בית המשפט, וכן עליו להודיע ללקוח ולפעול באופן שלא יפגע בענייניו.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על עו"ד משה להביא בפני בית המשפט את המחלוקת עם לקוחו ויוכל להתפטר מן הייצוג רק אם בית המשפט יסכים עימו שהלקוח טועה באופן בו הוא מבקש ממנו לנהל את התיק.', false, 'תשובה זו שגויה. בית המשפט אינו מכריע בשאלת ''מי צודק'' בניהול התיק בין עורך הדין ללקוח, אלא בוחן אם קיימת עילה מוצדקת להפסקת הייצוג, תוך איזון בין זכות עורך הדין שלא לכפות עליו שירות אישי לבין אינטרס הלקוח ותקינות ההליך.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 17, '2024-W-S-Q17';
END
$$;

-- ============================================================
-- Q18 — 2024-W-S-Q18 — chapter=corporate subtopic=fiduciary_duties
-- classifier_note: Director Sahar wants to prevent breach by officer Barak — director duties
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '354eca68-9e22-492f-8891-6e1af815f603'::uuid;
  v_group_id uuid := '8fa8fac6-3cb9-4bcd-ae39-087d4758cc89'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q18';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 18, '2024-W-S-Q18';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'corporate';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'corporate';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fiduciary_duties' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fiduciary_duties', 'corporate';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q18', v_chapter_id, v_subtopic_id, 'סהר הוא דירקטור אחד מתוך 7 בחברה פרטית. לסהר יסוד סביר להניח שעומדת להתבצע פעולה של ברק, ונושא משרה בחברה, העלולה להוות הפרת חובה של ברק. מה באפשרות סהר לעשות כדי למנוע זאת?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 18}'::jsonb, 'השאלה עוסקת בהוראות החלות על דירקטור בחברה שנודע לו על חשש להפרת חובה של נושא משרה אחר. היא בוחנת את חובתו של הדירקטור לפעול למניעת ההפרה, את הליכי כינוס הדירקטוריון ואת זכותו לפנות לבית המשפט בבקשה לצו מניעה, כפי שנקבעו בסעיפים 98, 257 ו-267 לחוק החברות, התשנ"ט-1999.', 'סעיף 257 לחוק החברות, התשנ"ט-1999, קובע כי "נודע לדירקטור על ענין של החברה שנתגלו בו לכאורה הפרת חוק או פגיעה בנוהל עסקים תקין, יפעל בלא דיחוי לזימון ישיבה של הדירקטוריון כאמור בסעיף 98(ב)(2)". סעיף 98(ב)(2) לחוק קובע כי "יושב ראש הדירקטוריון יזמן ישיבה כאמור בסעיף קטן (א) בתוך 14 ימים מיום קבלת הדרישה; לא זימן יושב ראש הדירקטוריון ישיבה כאמור, רשאים הדירקטורים שדרשו את כינוס הישיבה לכנסה בעצמם". כלומר, סהר, כדירקטור, חייב לפעול תחילה במישור הפנימי של החברה. עליו לדרוש מיו"ר הדירקטוריון לכנס ישיבה לדון בעניין. אם יו"ר הדירקטוריון לא יכנס את הישיבה תוך 14 ימים, סהר רשאי לכנס אותה בעצמו. רק אם הנסיבות אינן מאפשרות פעולה כאמור (למשל, לא ניתן לכנס את הדירקטוריון בפועל, או שהפעולה עומדת להתבצע באופן מיידי), רשאי סהר לפנות לבית המשפט. סעיף 267(א) לחוק החברות קובע כי "היה לדירקטור יסוד סביר להניח שעומדת להתבצע פעולה של נושא משרה העלולה להוות הפרת חובה של נושא משרה, רשאי הוא, לאחר שפעל כאמור בסעיף 257 אם הנסיבות מאפשרות זאת, לפנות לבית המשפט בבקשה שיאכוף את החובה או ימנע את הפעולה; בית המשפט רשאי לתת צו שימנע את הפעולה או כל סעד אחר שייראה לו בנסיבות הענין". סעיף 257 לחוק החברות, תשנ"ט-1999. סעיף 98(ב)(2) לחוק החברות, תשנ"ט-1999. סעיף 267(א) לחוק החברות, תשנ"ט-1999. נבו - המתמחה דיני תאגידים (2026) | חוק החברות, התשנ"ט-1999', 'הטעות הנפוצה היא לחשוב שדירקטור יכול לפנות ישירות לבית המשפט מבלי למצות את ההליכים הפנימיים בחברה, או לחשוב שאין לו סמכות לכנס ישיבת דירקטוריון בעצמו.',
    '["דירקטור", "נושא משרה", "חובת זהירות", "כינוס דירקטוריון", "סעיף 257 לחוק החברות", "סעיף 98 לחוק החברות", "סעיף 267 לחוק החברות", "צו מניעה"]'::jsonb, '**וריאציה 1 — חובת דירקטור:** מה חובתו של דירקטור שנודע לו על חשש להפרת חובהלפעול לזימון ישיבת דירקטוריון (סעיף 257 לחוק החברות).
**וריאציה 2 — כינוס עצמי:** מה קורה אם יו"ר הדירקטוריון לא נענה לבקשההדירקטור רשאי לכנס את הדירקטוריון בעצמו אם לא כונס תוך 14 ימים (סעיף 98(ב)(2) לחוק החברות).
**וריאציה 3 — פנייה לבית המשפט:** מתי רשאי הדירקטור לפנות לבית המשפטאם לא ניתן לכנס את הדירקטוריון או אם הנסיבות אינן מאפשרות זאת, רשאי לפנות לבית המשפט בבקשה לצו מניעה (סעיף 267(א) לחוק החברות).', 'דירקטור חושש מהפרת חובהדורש כינוס דירקטוריוןאם לא כונס, מכנס בעצמואם לא ניתן, פונה לביהמ"ש לצו מניעה.', '["חוק החברות, תשנ\"ט-1999, סעיף 98", "חוק החברות, תשנ\"ט-1999, סעיף 257", "חוק החברות, תשנ\"ט-1999, סעיף 267", "נבו - המתמחה דיני תאגידים (2026) | חוק החברות, התשנ\"ט-1999"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''corporate'' subtopic=''fiduciary_duties'' | classifier_note: Director Sahar wants to prevent breach by officer Barak — director duties | source_review_note: הנושא המרכזי הוא דיני חברות (חובות דירקטורים), אשר אינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין אזרחי - הליכים'' כקרובה ביותר, שכן מדובר בהליך פנייה לבית המשפט, אך יש לציין שהנושא הוא ספציפי לחוק החברות.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'סהר צריך לפנות ליו"ר הדירקטוריון ולדרוש כינוס ישיבת דירקטוריון לדון בפעולה שברק מתכוון לבצע. אין חובה להיענות לבקשתו שכן הוא הדירקטור היחיד המבקש זאת. אם בקשתו תידחה אין עוד דבר שבאפשרותו לעשות.', false, 'תשובה זו שגויה. קיימת חובה להיענות לבקשת דירקטור לכינוס ישיבת דירקטוריון, ואם לא נענים לבקשתו, הוא רשאי לכנס את הישיבה בעצמו. בנוסף, יש לו אפשרות לפנות לבית המשפט.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'סהר צריך לפנות ליו"ר הדירקטוריון ולדרוש כינוס ישיבת דירקטוריון לדון בפעולה שברק מתכוון לבצע. חובה להיענות לבקשתו. אם לא יתכנס הדירקטוריון בתוך 14 ימים יוכל סהר לכנסו בעצמו. אם אין אפשרות לכנס את הדירקטוריון, אין דבר נוסף שיוכל לעשות.', false, 'תשובה זו שגויה. אף שהיא מתארת נכונה את השלבים הראשונים, היא שגויה בקביעה שאין דבר נוסף שיוכל סהר לעשות אם לא ניתן לכנס את הדירקטוריון. במקרה כזה, הוא רשאי לפנות לבית המשפט.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'מאחר שסהר הוא הדירקטור היחיד המבקש לדון בפעולתו של ברק ואין רוב של חברי הדירקטוריון המבקשים לעשות כן, אין אפשרות לכנס ישיבת דירקטוריון, ולפיכך אין לסהר מנוס מלפנות מיד לבית המשפט בבקשה לצו מניעה.', false, 'תשובה זו שגויה. דירקטור יחיד רשאי לדרוש כינוס ישיבת דירקטוריון, וקיימת חובה להיענות לבקשתו. פנייה לבית המשפט היא רק לאחר מיצוי הליכים פנימיים, אלא אם הנסיבות אינן מאפשרות זאת.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'סהר צריך לפנות ליו"ר הדירקטוריון ולדרוש כינוס ישיבת דירקטוריון לדון בפעולה שברק מתכוון לבצע. חובה להיענות לבקשתו. אם לא יתכנס הדירקטוריון בתוך 14 ימים יוכל סהר לכנסו בעצמו. אם אין אפשרות לכנס את הדירקטוריון רשאי סהר לפנות מיד לבית המשפט בבקשה לצו מניעה.', true, 'זו התשובה הנכונה. סעיף 257 לחוק החברות מחייב דירקטור לפעול לזימון ישיבת דירקטוריון. סעיף 98(ב)(2) קובע חובה ליו"ר לזמן ישיבה וזכות לדירקטור לכנס בעצמו אם לא כונסה. סעיף 267(א) מאפשר פנייה לבית המשפט אם הנסיבות אינן מאפשרות פעולה פנימית.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 18, '2024-W-S-Q18';
END
$$;

-- ============================================================
-- Q19 — 2024-W-S-Q19 — chapter=criminal_substantive subtopic=sentencing
-- classifier_note: Crediting time in detention + electronic-tag house arrest against sentence
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'e87fb00a-7149-4f16-a8e2-50df7c56aeca'::uuid;
  v_group_id uuid := 'b391ba4c-1aa6-421a-84bf-77ab3e6ef35c'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q19';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 19, '2024-W-S-Q19';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_substantive';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_substantive';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'sentencing' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'sentencing', 'criminal_substantive';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q19', v_chapter_id, v_subtopic_id, 'יובל שהה במעצר מאחורי סורג ובריח במשך 6 חודשים ולאחר מכן שהה במעצר בית בפיקוח אלקטרוני במשך 8 חודשים, וכעת עומד להיגזר דינו לאחר שהורשע בדין בגין עבירת פשע חמורה. כמה חודשים ינוכו בכל מקרה מעונש המאסר בפועל שיושת על יובל?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 19}'::jsonb, 'השאלה עוסקת בניכוי ימי מעצר מתקופת מאסר בפועל, תוך הבחנה בין מעצר מאחורי סורג ובריח לבין מעצר בפיקוח אלקטרוני. היא בוחנת את הוראת סעיף 43 לחוק העונשין, תשל"ז-1977, ואת הפרשנות שניתנה לה בפסיקה, הקובעת כי רק מעצר מאחורי סורג ובריח מנוכה אוטומטית, בעוד מעצר בפיקוח אלקטרוני נלקח בחשבון כשיקול ענישה בלבד.', 'סעיף 43 לחוק העונשין, תשל"ז-1977, קובע כי "מי שנידון למאסר תיחשב תקופת מאסרו מיום גזר הדין, אם לא הורה בית המשפט הוראה אחרת". על אף לשונו, הפסיקה פירשה סעיף זה כמאפשר לבית המשפט לנכות ימי מעצר מתקופת המאסר, ונוהג זה הפך להלכה פסוקה. הרציונל העומד בבסיס ניכוי ימי המעצר הוא עיקרון החירות והצורך להימנע מכפל ענישה, שכן מעצר עד תום ההליכים אינו עונשי אלא מניעתי. עם זאת, הפסיקה מבחינה בין סוגי המעצר השונים. מעצר מאחורי סורג ובריח נחשב לשלילת חירות מוחלטת, ולכן ימים אלו מנוכים ככלל מעונש המאסר בפועל. לעומת זאת, מעצר בפיקוח אלקטרוני, אף שהוא נחשב למעצר מבחינה נורמטיבית (לצורך מגבלות זמן המעצר), אינו שקול בחומרתו למעצר מאחורי סורג ובריח. לפיכך, ימי מעצר בפיקוח אלקטרוני אינם מנוכים אוטומטית מעונש המאסר בפועל, אלא נלקחים בחשבון כשיקול ענישה לקולא בעת גזירת הדין. במקרה הנדון, יובל שהה 6 חודשים במעצר מאחורי סורג ובריח, ולכן תקופה זו תנוכה מעונש המאסר. 8 חודשי המעצר בפיקוח אלקטרוני לא ינוכו אוטומטית, אך בית המשפט רשאי להתחשב בהם. סעיף 43 לחוק העונשין, תשל"ז-1977. בש"פ 4206/16 מדינת ישראל נ'' מוחסן טחימר (03.11.2016). ע"פ 201/18 ליאור טויזר נ'' מדינת ישראל (08.07.2018). בש"פ 4206/16 מדינת ישראל נ'' מוחסן טחימר (03.11.2016). ת"פ (שלום נצרת) 1291-11-21 מדינת ישראל נ'' פלוני 1 (07.02.2023).', 'הטעות הנפוצה היא לבלבל בין הכללים החלים על ניכוי ימי מעצר מעונש מאסר (סעיף 43 לחוק העונשין) לבין הכללים החלים על מניין ימי מעצר לצורך מגבלות הזמן הקבועות בחוק המעצרים (סעיף 61(א)), שם מעצר בפיקוח אלקטרוני נכלל בחישוב.',
    '["ניכוי ימי מעצר", "סעיף 43 לחוק העונשין", "מעצר מאחורי סורג ובריח", "מעצר בפיקוח אלקטרוני", "כפל ענישה", "שיקול דעת שיפוטי", "חזקת החפות"]'::jsonb, '**וריאציה 1 — מעצר מאחורי סורג ובריח:** האם מעצר מאחורי סורג ובריח מנוכה מהמאסרכן, ככלל, מנוכה (סעיף 43 לחוק העונשין).
**וריאציה 2 — מעצר בפיקוח אלקטרוני:** האם מעצר בפיקוח אלקטרוני מנוכה אוטומטית מהמאסרלא, אינו מנוכה אוטומטית, אלא נלקח בחשבון כשיקול ענישה (בש"פ 4206/16 מדינת ישראל נ'' מוחסן טחימר).
**וריאציה 3 — רציונל הניכוי:** מה הרציונל לניכוי ימי מעצרמניעת כפל ענישה, שכן מעצר אינו עונש אלא אמצעי מניעתי (בש"פ 4206/16 מדינת ישראל נ'' מוחסן טחימר).', 'מעצר מאחורי סורג ובריחמנוכה מהמאסר בפועל; מעצר בפיקוח אלקטרוניאינו מנוכה אוטומטית, אלא נלקח בחשבון בשיקולי הענישה.', '["חוק העונשין, תשל\"ז-1977, סעיף 43", "בש\"פ 4206/16 מדינת ישראל נ'' מוחסן טחימר (03.11.2016)", "ע\"פ 201/18 ליאור טויזר נ'' מדינת ישראל (08.07.2018)", "ת\"פ (שלום נצרת) 1291-11-21 מדינת ישראל נ'' פלוני 1 (07.02.2023)"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''ערעור פלילי'' → mapped chapter=''criminal_substantive'' subtopic=''sentencing'' | classifier_note: Crediting time in detention + electronic-tag house arrest against sentence | source_review_note: הנושא המרכזי הוא דיני ענישה וניכוי ימי מעצר, אשר אינו מופיע כתת-נושא מפורש ברשימה הסגורה. נבחרה הקטגוריה ''סדר דין פלילי - ערעור פלילי'' כקרובה ביותר, שכן פסקי הדין העוסקים בכך ניתנים לרוב במסגרת ערעורים, אך יש לציין שהנושא הוא ספציפי לדיני העונשין והמעצרים.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', '6 חודשים.', true, 'זו התשובה הנכונה. ימי מעצר מאחורי סורג ובריח מנוכים ככלל מעונש המאסר בפועל. ימי מעצר בפיקוח אלקטרוני אינם מנוכים אוטומטית, אלא נלקחים בחשבון כשיקול ענישה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', '10 חודשים.', false, 'תשובה זו שגויה. חישוב זה מבוסס על ניכוי מלא של מעצר מאחורי סורג ובריח וניכוי חלקי של מעצר בפיקוח אלקטרוני (ביחס 1:2), אך ניכוי מעצר בפיקוח אלקטרוני אינו אוטומטי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', '8 חודשים.', false, 'תשובה זו שגויה. ניכוי זה מתייחס רק לתקופת המעצר בפיקוח אלקטרוני, שאינה מנוכה אוטומטית מעונש המאסר.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', '14 חודשים.', false, 'תשובה זו שגויה. חישוב זה מבוסס על ניכוי מלא של שני סוגי המעצר, אך מעצר בפיקוח אלקטרוני אינו מנוכה אוטומטית מעונש המאסר.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 19, '2024-W-S-Q19';
END
$$;

-- ============================================================
-- Q21 — 2024-W-S-Q21 — chapter=criminal_substantive subtopic=sentencing
-- classifier_note: Undertaking to avoid offense + breach (התחייבות להימנע)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd6b2af08-18ed-4781-b748-0500146b796b'::uuid;
  v_group_id uuid := '5a21dc9c-f49e-4807-af15-6e08cdd8e605'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q21';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 21, '2024-W-S-Q21';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'criminal_substantive';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'criminal_substantive';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'sentencing' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'sentencing', 'criminal_substantive';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q21', v_chapter_id, v_subtopic_id, 'בית המשפט קבע כי דנית ביצעה עבירה של השחתת פני מקרקעין ואולם לא הרשיע אותה והשית עליה התחייבות להימנע מעבירה למשך שנה, בסכום של 15,000 ש"ח. בחלוף כחודשיים, ביצעה דנית את אותה העבירה והורשעה בה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 21}'::jsonb, 'השאלה עוסקת בסמכות בית המשפט להטיל התחייבות להימנע מעבירה, ובפרט בסוגיית הארכת תוקפה של התחייבות כזו. היא בוחנת את הוראות סעיפים 72 ו-76 לחוק העונשין, ואת הפרשנות שניתנה להן בפסיקה, לפיה אין לבית המשפט שיקול דעת להאריך התחייבות שהופרה, בניגוד למאסר מותנה.', 'סעיף 72(א) לחוק העונשין, תשל"ז-1977, קובע כי "בית משפט שהרשיע אדם רשאי, נוסף על העונש שהטיל, לצוות שהנידון ייתן התחייבות להימנע מעבירה בתוך תקופה שיקבע בית המשפט ושלא תעלה על שלוש שנים". סעיף 72(א) לחוק העונשין, תשל"ז-1977 סעיף 72(ב) מוסיף כי גם אם בית המשפט קבע שנאשם ביצע עבירה אך לא הרשיעו, הוא רשאי לצוות על מתן התחייבות. סעיף 72(ב) לחוק העונשין, תשל"ז-1977 סעיף 76 לחוק העונשין קובע כי כאשר אדם התחייב להימנע מעבירה והפר אותה, בית המשפט "יצווה... על תשלום סכום ההתחייבות". סעיף 76 לחוק העונשין, תשל"ז-1977 הפסיקה, ובראשה בית המשפט העליון (רע"פ 4123/17 שוחט נ'' מדינת ישראל), קבעה כי לשון הסעיף היא מנדטורית, וכי אין לבית המשפט שיקול דעת שלא להפעיל את ההתחייבות, להאריך את תוקפה או להפעילה באופן חלקי. עפ"ת (מחוזי חי'') 24936-11-19 מחמוד אבו שיכה נ'' מדינת ישראל (16.12.2019) ע"פ (מחוזי י-ם) 11606-01-18 שמעון שורץ נ'' מדינת ישראל (16.10.2018) זאת בניגוד למאסר מותנה, לגביו סעיף 56 לחוק העונשין מאפשר לבית המשפט, מטעמים שיירשמו, להאריך את תקופת התנאי במקום להפעילו. ת"פ (שלום ב"ש) 34729-10-21 מדינת ישראל נ'' ליאור כהן (17.07.2025)', 'הטעות הנפוצה היא לבלבל בין שיקול הדעת הנתון לבית המשפט בהפעלת מאסר מותנה (סעיף 56 לחוק העונשין) לבין חוסר שיקול הדעת בהפעלת התחייבות להימנע מעבירה (סעיף 76 לחוק העונשין).',
    '["התחייבות להימנע מעבירה", "מאסר מותנה", "סעיף 72 לחוק העונשין", "סעיף 76 לחוק העונשין", "שיקול דעת שיפוטי", "הוראה מנדטורית"]'::jsonb, '**וריאציה 1 — סמכות להטיל התחייבות ללא הרשעה:** האם בית המשפט רשאי להשית התחייבות להימנע מעבירה גם אם לא הרשיע? ← כן, אם קבע שבוצעה עבירה (סעיף 72(ב) לחוק העונשין). סעיף 72(ב) לחוק העונשין, תשל"ז-1977
**וריאציה 2 — הארכת תוקף התחייבות:** האם בית המשפט רשאי להאריך את תוקף ההתחייבות להימנע מעבירה? ← לא, סעיף 76 לחוק העונשין קובע הוראה מנדטורית להפעלה ללא שיקול דעת להארכה. סעיף 76 לחוק העונשין, תשל"ז-1977
**וריאציה 3 — השוואה למאסר מותנה:** האם יש הבדל בין הארכת התחייבות להארכת מאסר מותנה? ← כן, במאסר מותנה (סעיף 56 לחוק העונשין) יש שיקול דעת להארכה, אך לא בהתחייבות. ת"פ (שלום ב"ש) 34729-10-21 מדינת ישראל נ'' ליאור כהן (17.07.2025)', 'התחייבות להימנע מעבירה (ס'' 72) ← הופרה ← חובה להפעיל (ס'' 76) ← אין שיקול דעת להאריך תוקף ← בניגוד למאסר מותנה (ס'' 56).', '["חוק העונשין, תשל\"ז-1977, סעיף 72", "חוק העונשין, תשל\"ז-1977, סעיף 76", "רע\"פ 4123/17 שוחט נ'' מדינת ישראל (25.06.2018)", "ע\"פ 2204/22 מחמד אל הייב נ'' מדינת ישראל (08.09.2022)", "חוק העונשין, תשל\"ז-1977, סעיף 56"]'::jsonb,
    'classification_review: original chapter=''סדר דין פלילי'' subtopic=''ערעור פלילי'' → mapped chapter=''criminal_substantive'' subtopic=''sentencing'' | classifier_note: Undertaking to avoid offense + breach (התחייבות להימנע) | source_review_note: השאלה עוסקת בדיני ענישה פליליים, תחום שאינו מופיע כפרק או תת-נושא ברשימה הסגורה. נבחר ''סדר דין פלילי'' כפרק ו''ערעור פלילי'' כתת-נושא כברירת מחדל, שכן סוגיות אלו נדונות לעיתים קרובות בהליכי ערעור על גזרי דין, אך יש לבחון התאמה טובה יותר.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית המשפט לא היה רשאי להשית עליה התחייבות להימנע מעבירה אם לא הרשיעה.', false, 'טענה זו שגויה, שכן סעיף 72(ב) לחוק העונשין מאפשר לבית המשפט להשית התחייבות להימנע מעבירה גם אם לא הרשיע את הנאשם, אלא רק קבע שביצע את העבירה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט אינו רשאי להאריך את תוקף ההתחייבות להימנע מעבירה.', true, 'תשובה זו נכונה, שכן סעיף 76 לחוק העונשין קובע הוראה מנדטורית להפעלת ההתחייבות במקרה של הפרתה, ואין לבית המשפט שיקול דעת להאריך את תוקפה או להפעילה באופן חלקי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט רשאי להאריך את תוקף ההתחייבות להימנע מעבירה נוספת מטעמים שיירשמו, אם סבר שבנסיבות העניין לא יהיה צודק להפעיל את ההתחייבות.', false, 'טענה זו שגויה, שכן שיקול דעת זה קיים לגבי מאסר מותנה (סעיף 56 לחוק העונשין), אך לא לגבי התחייבות להימנע מעבירה, לגביה קיימת הוראה מנדטורית להפעלה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית המשפט רשאי להאריך את תוקף ההתחייבות להימנע מעבירה עד לשלוש שנים.', false, 'טענה זו שגויה, שכן שלוש שנים היא התקופה המקסימלית שניתן לקבוע להתחייבות מלכתחילה (סעיף 72(א) לחוק העונשין), אך אין סמכות להאריך התחייבות קיימת.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 21, '2024-W-S-Q21';
END
$$;

-- ============================================================
-- Q22 — 2024-W-S-Q22 — chapter=contracts subtopic=standard_contracts  [needs_review]
-- classifier_note: Internet purchase, cancellation right — consumer-protection law is the real subject; no direct substantive subtopic for it
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'b5473ee0-ca63-4c1b-ba4f-4e7f5c7fef9f'::uuid;
  v_group_id uuid := 'cbabcbda-2214-48e4-965e-de1c831e6446'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q22';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 22, '2024-W-S-Q22';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'standard_contracts' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'standard_contracts', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q22', v_chapter_id, v_subtopic_id, 'לקוח פנה לקבלת יעוץ משפטי בשאלה האם הוא רשאי לבטל עיסקה לאחר שרכש ריהוט מחברה באמצעות מודעת פרסום באינטרנט. הלקוח התקשר למשרדה של החברה וביצע הזמנה טלפונית של הריהוט. עתה הוא מתחרט על העיסקה ורוצה לבטלה. עד מתי רשאי הלקוח לבטל את העיסקה?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 22}'::jsonb, 'השאלה עוסקת בזכותו של צרכן לבטל עסקת מכר מרחוק, כפי שהיא מוסדרת בחוק הגנת הצרכן. היא בוחנת את הגדרת "עסקת מכר מרחוק" ואת תקופת הביטול הכללית לנכסים, תוך התייחסות למאפיינים הייחודיים של עסקאות אלו, כגון היעדר נוכחות משותפת וקיומו של שיווק מרחוק.', 'חוק הגנת הצרכן נועד לגשר על פערי מידע וכוח בין עוסק לצרכן ולאפשר לצרכן לקבל החלטה מושכלת. נבו - המתמחה דיני נזיקין (2026) | הקדמה "עסקת מכר מרחוק" מוגדרת בסעיף 14ג(ו) לחוק הגנת הצרכן כהתקשרות בעסקה של מכר נכס או שירות, שנעשית בעקבות "שיווק מרחוק" וללא נוכחות משותפת של הצדדים. סעיף 14ג(ו) לחוק הגנת הצרכן, תשמ"א-1981 "שיווק מרחוק" כולל פנייה של עוסק לצרכן באמצעות תקשורת אלקטרונית, פרסום מודעות וכיוצא באלה. סעיף 14ג(ו) לחוק הגנת הצרכן, תשמ"א-1981 הפסיקה קבעה כי פרסום באתר אינטרנט נחשב ל"פנייה של עוסק לצרכן", גם אם הצרכן יזם את הפנייה לאתר. רת"ק (מחוזי תל אביב-יפו) 72588-12-25 פגסוס תיירות ונסיעות בע"מ נ'' שאול טוויג (22.02.2026) במקרה הנדון, הלקוח ראה מודעת פרסום באינטרנט והתקשר טלפונית, ולכן מדובר בעסקת מכר מרחוק. סעיף 14ג(ג)(1) לחוק קובע כי בעסקת מכר מרחוק של נכס, הצרכן רשאי לבטל את העסקה מיום עשיית העסקה ועד 14 ימים מיום קבלת הנכס, או מיום קבלת המסמך המכיל את הפרטים, לפי המאוחר מביניהם. סעיף 14ג(ג)(1) לחוק הגנת הצרכן, תשמ"א-1981', 'הטעות הנפוצה היא לחשוב שעסקאות שבהן הצרכן יזם את הפנייה לעוסק (למשל, נכנס לאתר אינטרנט) אינן נחשבות ל"עסקת מכר מרחוק", או לבלבל בין מועד עשיית העסקה למועד קבלת הנכס/מסמך לצורך חישוב תקופת הביטול.',
    '["עסקת מכר מרחוק", "שיווק מרחוק", "זכות ביטול", "חוק הגנת הצרכן", "סעיף 14ג", "מועד ביטול"]'::jsonb, '**וריאציה 1 — הגדרת מכר מרחוק:** האם פרסום באינטרנט והזמנה טלפונית נחשבים ל"עסקת מכר מרחוק"? ← כן, זה עונה על הגדרת "שיווק מרחוק" ו"ללא נוכחות משותפת". סעיף 14ג(ו) לחוק הגנת הצרכן, תשמ"א-1981
**וריאציה 2 — מועד הביטול לנכס:** מהו מועד הביטול המקסימלי לנכס בעסקת מכר מרחוק? ← 14 ימים מיום קבלת הנכס או קבלת מסמך הפרטים, לפי המאוחר. סעיף 14ג(ג)(1) לחוק הגנת הצרכן, תשמ"א-1981
**וריאציה 3 — תכלית זכות הביטול:** מהי תכלית זכות הביטול הצרכנית? ← הגנה על הצרכן מפני לחצים, שימור שוק יעיל, יצירת כלל פשוט, ומניעת ניצול לרעה. דנ"א 5783/14 עו"ד ליאור צמח נ'' אל על נתיבי אויר לישראל בע"מ (12.09.2017)', 'רכישת ריהוט (נכס) ← מודעה באינטרנט + הזמנה טלפונית ← עסקת מכר מרחוק ← ביטול תוך 14 ימים מיום קבלת הריהוט או מסמך הפרטים (המאוחר).', '["חוק הגנת הצרכן, תשמ\"א-1981, סעיף 14ג", "רת\"ק (מחוזי תל אביב-יפו) 72588-12-25 פגסוס תיירות ונסיעות בע\"מ נ'' שאול טוויג (22.02.2026)", "דנ\"א 5783/14 עו\"ד ליאור צמח נ'' אל על נתיבי אויר לישראל בע\"מ (12.09.2017)", "נבו - המתמחה דיני נזיקין (2026) | הקדמה"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''תובענות ייצוגיות'' → mapped chapter=''contracts'' subtopic=''standard_contracts'' | classifier_note: Internet purchase, cancellation right — consumer-protection law is the real subject; no direct substantive subtopic for it | source_review_note: השאלה עוסקת בדיני הגנת הצרכן, תחום שאינו מופיע כפרק או תת-נושא ברשימה הסגורה. נבחר ''סדר דין אזרחי'' כפרק ו''תובענות ייצוגיות'' כתת-נושא כברירת מחדל, שכן סוגיות אלו נדונות לעיתים קרובות בהליכים אזרחיים ובתובענות ייצוגיות, אך יש לבחון התאמה טובה יותר.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'עד 14 ימים ממועד ביצוע העיסקה.', false, 'טענה זו שגויה, שכן תקופת הביטול לנכס בעסקת מכר מרחוק נמדדת מיום קבלת הנכס או מיום קבלת מסמך הפרטים, לפי המאוחר, ולא ממועד ביצוע העסקה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'עד מועד קבלת הריהוט.', false, 'טענה זו שגויה, שכן זכות הביטול נמשכת גם לאחר קבלת הנכס, למשך 14 ימים, כדי לאפשר לצרכן לבחון את המוצר.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'עד 14 ימים ממועד קבלת הריהוט.', true, 'תשובה זו נכונה, שכן מדובר בעסקת מכר מרחוק של נכס (ריהוט), ולפי סעיף 14ג(ג)(1) לחוק הגנת הצרכן, הצרכן רשאי לבטל את העסקה בתוך 14 ימים מיום קבלת הנכס או מיום קבלת המסמך המכיל את הפרטים, לפי המאוחר.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא ניתן לבטל את העיסקה, אלא אם הייתה בה הטעיה.', false, 'טענה זו שגויה, שכן חוק הגנת הצרכן מעניק זכות ביטול בעסקת מכר מרחוק גם במקרה של חרטה, ללא צורך בהוכחת הטעיה או פגם אחר בעסקה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 22, '2024-W-S-Q22';
END
$$;

-- ============================================================
-- Q23 — 2024-W-S-Q23 — chapter=contracts subtopic=insurance_contract
-- classifier_note: Subrogation (תחלוף) in insurance
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'fb618707-f375-4033-ac81-fe910f8bea83'::uuid;
  v_group_id uuid := '63f32d24-9b38-47a7-8805-97c601c912ec'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q23';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 23, '2024-W-S-Q23';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'insurance_contract' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'insurance_contract', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q23', v_chapter_id, v_subtopic_id, 'מהו "תחלוף" בדיני ביטוח?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 23}'::jsonb, 'השאלה עוסקת בעקרון התחלוף (סוברוגציה או שיבוב) בדיני ביטוח, המעוגן בסעיף 62 לחוק חוזה הביטוח. עקרון זה מאפשר למבטח, לאחר ששילם למבוטח תגמולי ביטוח בגין נזק שנגרם על ידי צד שלישי, להיכנס בנעלי המבוטח ולתבוע את הצד השלישי המזיק. תכליתו היא למנוע כפל פיצוי למבוטח ולמנוע התעשרות שלא כדין של המזיק.', 'עקרון התחלוף (סוברוגציה או שיבוב) הוא מנגנון משפטי המעוגן בסעיף 62 לחוק חוזה הביטוח, תשמ"א-1981. סעיף 62(א) לחוק חוזה הביטוח, תשמ"א-1981 לפי עקרון זה, כאשר למבוטח קיימת זכות פיצוי או שיפוי כלפי אדם שלישי בגין מקרה הביטוח, זכות זו עוברת למבטח מרגע ששילם למבוטח תגמולי ביטוח, ובשיעור התגמולים ששילם. ת"א (שלום ת"א) 5865-03-10 ביטוח ישיר איי.די.איי חברה לביטוח בע''''מ נ'' ירון חיים רחמין (20.05.2013) תכליתו של עקרון התחלוף היא למנוע כפל פיצוי מהניזוק (המבוטח) ולמנוע התעשרות שלא כדין של המזיק, שכן העובדה שהניזוק מבוטח אינה משחררת את המזיק מאחריותו. רע"א 4179/20 בסט קאר חברה לשירותי רכב בע"מ נ'' איי. די .איי חברה לביטוח בע"מ (18.11.2020) ע"א 9311/99 מנורה חברה לביטוח בע"מ נ'' נרות ירושלים אילום (1987) בע"מ, נו(2) 550 (20.01.2002) המבטח, הנכנס בנעלי המבוטח, יורש את זכותו של המבוטח כלפי המזיק על כל מרכיביה, יתרונותיה ומגרעותיה. ע"א 9311/99 מנורה חברה לביטוח בע"מ נ'' נרות ירושלים אילום (1987) בע"מ, נו(2) 550 (20.01.2002) ע"א 2906/01 עירית חיפה נ'' מנורה חברה לביטוח בע"מ (25.05.2006)', 'הטעות הנפוצה היא לבלבל את עקרון התחלוף עם מנגנונים אחרים בדיני ביטוח, כגון ביטוח כפל או חובת הקטנת הנזק, או לחשוב שהמבטח יכול לתבוע את המזיק ללא קשר לתשלום תגמולי הביטוח למבוטח.',
    '["תחלוף (שיבוב)", "חוק חוזה הביטוח", "סעיף 62", "מניעת כפל פיצוי", "התעשרות שלא כדין", "כניסה בנעלי המבוטח"]'::jsonb, '**וריאציה 1 — הגדרה בסיסית:** מהו תחלוף? ← מבטח ששילם למבוטח נכנס בנעליו לתבוע את המזיק. סעיף 62(א) לחוק חוזה הביטוח, תשמ"א-1981
**וריאציה 2 — תכלית:** מהי מטרת התחלוף? ← מניעת כפל פיצוי למבוטח ומניעת התעשרות שלא כדין של המזיק. רע"א 4179/20 בסט קאר חברה לשירותי רכב בע"מ נ'' איי. די .איי חברה לביטוח בע"מ (18.11.2020)
**וריאציה 3 — מקור נורמטיבי:** מהו המקור הנורמטיבי לתחלוף? ← סעיף 62 לחוק חוזה הביטוח ודיני עשיית עושר ולא במשפט. ע"א 206/20 טבע תעשיות פרמצבטיות בע"מ נ'' טי.אנד.אם גושן - שירותי ביטחון בע"מ (13.12.2021)', 'תחלוף (ס'' 62 לחוק חוזה הביטוח) ← מבטח משלם למבוטח ← נכנס בנעליו לתבוע מזיק ← מונע כפל פיצוי והתעשרות מזיק.', '["חוק חוזה הביטוח, תשמ\"א-1981, סעיף 62", "ת\"א (שלום ת\"א) 5865-03-10 ביטוח ישיר איי.די.איי חברה לביטוח בע''''מ נ'' ירון חיים רחמין (20.05.2013)", "רע\"א 4179/20 בסט קאר חברה לשירותי רכב בע\"מ נ'' איי. די .איי חברה לביטוח בע\"מ (18.11.2020)", "ע\"א 9311/99 מנורה חברה לביטוח בע\"מ נ'' נרות ירושלים אילום (1987) בע\"מ, נו(2) 550 (20.01.2002)", "ע\"א 206/20 טבע תעשיות פרמצבטיות בע\"מ נ'' טי.אנד.אם גושן - שירותי ביטחון בע\"מ (13.12.2021)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''insurance_contract'' | classifier_note: Subrogation (תחלוף) in insurance | source_review_note: השאלה עוסקת בדיני ביטוח, תחום שאינו מופיע כפרק או תת-נושא ברשימה הסגורה. נבחר ''סדר דין אזרחי'' כפרק ו''הליכים'' כתת-נושא כברירת מחדל, שכן סוגיות אלו נדונות לעיתים קרובות בהליכים אזרחיים, אך יש לבחון התאמה טובה יותר.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'כאשר ראובן גורם נזק לשמעון, ושמעון תובע את חברת הביטוח שלו עצמו ומקבל ממנה פיצוי, רשאית חברת הביטוח של שמעון לתבוע את ראובן.', true, 'תשובה זו נכונה, שכן היא מתארת את מהות עקרון התחלוף (שיבוב) הקבוע בסעיף 62(א) לחוק חוזה הביטוח, לפיו המבטח נכנס בנעלי המבוטח ותובע את המזיק לאחר ששילם תגמולי ביטוח.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כאשר ראובן גורם נזק לשמעון ושמעון תובע אותו ולא את הביטוח של עצמו, ובתגובה ראובן תובע את שמעון בתביעה שכנגד בגין מקרה אחר שאינו מבוטח, על חברת הביטוח לשפות את שמעון גם בגין סכום שייפסק נגדו בתביעה שכנגד.', false, 'טענה זו שגויה, שכן היא מתארת מצב של תביעה שכנגד שאינה קשורה ישירות למקרה הביטוח המקורי, ואינה מבטאת את עקרון התחלוף, אלא סוגיות אחרות בדיני ביטוח וסדר דין אזרחי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'כאשר ראובן גורם נזק לשמעון ושמעון אינו נוקט אמצעים להקטנת הנזק ותובע את הביטוח שלו עצמו על מלוא סכום נזקו, מחליפה חברת הביטוח של שמעון את ראובן וטוענת בשמו שעל שמעון היה להקטין את הנזק כמידת יכולתו.', false, 'טענה זו שגויה, שכן היא מתארת את חובת הקטנת הנזק של המבוטח (סעיף 61 לחוק חוזה הביטוח), אך אינה מבטאת את עקרון התחלוף, ואינה מתארת מצב בו המבטח מחליף את המזיק בטענה זו.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'כאשר לשמעון כנס אותו ביטח בגין אותו סיכון ואותה תקופה אצל שני מבטחים והתרחש מקרה הביטוח, ושמעון תבע את החברה בה ביטח את הנכס בתאריך המאוחר יותר, על החברות להתחלף ביניהן.', false, 'טענה זו שגויה, שכן היא מתארת מצב של ביטוח כפל, המוסדר בסעיף 59 לחוק חוזה הביטוח, ואינה קשורה לעקרון התחלוף, אלא לחלוקת האחריות בין המבטחים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 23, '2024-W-S-Q23';
END
$$;

-- ============================================================
-- Q24 — 2024-W-S-Q24 — chapter=contracts subtopic=insurance_contract
-- classifier_note: Insurance-claim handover by municipality to its insurer
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'bbf2382f-9ce5-4d5e-a175-f1ed3465f952'::uuid;
  v_group_id uuid := '65c209cf-a218-4c5d-8900-155649d9eb86'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q24';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 24, '2024-W-S-Q24';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'insurance_contract' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'insurance_contract', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q24', v_chapter_id, v_subtopic_id, 'רון נפל ברחוב עקב בור במדרכה וגרמו לו נזקי גוף. רון הגיש תביעת נזיקין נגד הרשות המקומית. הרשות המקומית העבירה את כתב התביעה לחברת הביטוח שביטחה אותה כלפי צד שלישי. עורכת-דין שרון נשכרה ע"י חברת הביטוח לייצג את הרשות המקומית בבית המשפט וזו חתמה לעורכת הדין שרון על ייפוי כח מתאים. בית המשפט הציע לצדדים פשרה כספית, לפיה רון יפוצה בסך של 100,000 ש"ח. חברת הביטוח מעוניינת לקבל את הצעת הפשרה. מה מעמד הרשות המקומית לגבי הצעה זו?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 24}'::jsonb, 'השאלה עוסקת במעמד המבוטח בביטוח אחריות, ובפרט בזכותו להתנגד להסדר פשרה שמציעה חברת הביטוח עם צד שלישי. היא מתמקדת בסעיף 68 לחוק חוזה הביטוח, המקנה לצד השלישי זכות תביעה ישירה נגד המבטח, אך גם מעניק למבוטח זכות להתנגד לתשלום, בכפוף לתנאים מסוימים. השאלה בוחנת את האיזון בין האינטרסים של המבטח, המבוטח והצד השלישי.', 'סעיף 68 לחוק חוזה הביטוח, תשמ"א-1981, שכותרתו "מעמד הצד השלישי", קובע כי בביטוח אחריות, המבטח רשאי – ולפי דרישת הצד השלישי חייב הוא – לשלם לצד השלישי את תגמולי הביטוח שהמבטח חייב למבוטח. סעיף 68 לחוק חוזה הביטוח, תשמ"א-1981 אולם, תשלום זה מותנה בכך שהמבטח הודיע על כך בכתב למבוטח 30 ימים מראש, והמבוטח לא התנגד תוך תקופה זו. סעיף 68 לחוק חוזה הביטוח, תשמ"א-1981 סעיף זה יוצר יריבות סטטוטורית ישירה בין הניזוק (הצד השלישי) לבין חברת הביטוח של המזיק, ומטרתו להבטיח שהניזוק יקבל פיצוי ולפשט את ההליך. ת"א (שלום ת"א) 69861-07-17 פלוני נ'' אקסטרים ספורט ימי בע"מ (20.07.2018) רע"א 4395/14 מרדכי כהן נ'' הכשרה חברה לביטוח בע"מ (19.08.2014) עם זאת, הוראת הסעיף מקנה למבוטח זכות להתנגד לפיצוי הניזוק על ידי מבטחתו, וזכות זו אינה זכות וטו מוחלטת, אלא צריכה להיות מופעלת בתום לב ומטעמים לגיטימיים. תאד"מ (שלום אשד'') 10152-07-22 מגדל חברה לביטוח בע"מ נ'' בזיני אברהם (23.04.2024) ירון אליאס דיני ביטוח (2016) | פרק עשרים-ושישה ביטוח אחריות במקרה הנדון, הרשות המקומית היא המבוטח, ועל חברת הביטוח להודיע לה בכתב על הצעת הפשרה ולאפשר לה להתנגד בתוך 30 ימים. אם הרשות לא תתנגד, חברת הביטוח רשאית לקבל את הפשרה. ת"א (שלום ת"א) 20268-12-17 פלוני נ'' כפרית פרי גן עדן (08.08.2021)', 'הטעות הנפוצה היא לחשוב שלמבוטח אין כל מעמד בהחלטות פשרה של חברת הביטוח, או לחילופין, שלמבוטח יש זכות וטו מוחלטת, מבלי להבין את האיזון העדין שקובע סעיף 68 לחוק חוזה הביטוח.',
    '["ביטוח אחריות", "מעמד צד שלישי", "סעיף 68 לחוק חוזה הביטוח", "זכות התנגדות המבוטח", "הודעה בכתב", "תום לב"]'::jsonb, '**וריאציה 1 — חובת הודעה:** האם המבטח חייב להודיע למבוטח על פשרה? ← כן, בכתב, 30 ימים מראש. סעיף 68 לחוק חוזה הביטוח, תשמ"א-1981
**וריאציה 2 — זכות התנגדות:** האם למבוטח יש זכות וטו מוחלטת? ← לא, זכות ההתנגדות אינה וטו מוחלט, אך צריכה להיות בתום לב ומטעמים לגיטימיים. תאד"מ (שלום אשד'') 10152-07-22 מגדל חברה לביטוח בע"מ נ'' בזיני אברהם (23.04.2024)
**וריאציה 3 — יריבות ישירה:** האם לצד השלישי יש יריבות ישירה מול המבטח? ← כן, מכוח סעיף 68 לחוק חוזה הביטוח. ת"א (שלום ת"א) 69861-07-17 פלוני נ'' אקסטרים ספורט ימי בע"מ (20.07.2018)', 'בביטוח אחריות, המבטח רשאי להתפשר עם צד שלישי ← בתנאי שהודיע למבוטח בכתב 30 ימים מראש ← והמבוטח לא התנגד ← למבוטח אין וטו מוחלט, אך התנגדותו צריכה להישקל בתום לב.', '["חוק חוזה הביטוח, תשמ\"א-1981, סעיף 68", "ת\"א (שלום ת\"א) 20268-12-17 פלוני נ'' כפרית פרי גן עדן (08.08.2021)", "ת\"א (שלום חי'') 3115-09-13 עימאד זועבי נ'' די. אנד די. בטיחות בע\"מ (25.03.2016)", "רע\"א 4490518/18 שי פרץ נ'' שלמה חברה לביטוח בע\"מ (18.06.2018)", "תאד\"מ (שלום אשד'') 10152-07-22 מגדל חברה לביטוח בע\"מ נ'' בזיני אברהם (23.04.2024)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''insurance_contract'' | classifier_note: Insurance-claim handover by municipality to its insurer | source_review_note: השאלה עוסקת בדיני ביטוח, תחום שאינו מופיע כפרק או תת-נושא ברשימה הסגורה. נבחר ''סדר דין אזרחי'' כפרק ו''הליכים'' כתת-נושא כברירת מחדל, שכן סוגיות אלו נדונות לעיתים קרובות בהליכים אזרחיים, אך יש לבחון התאמה טובה יותר.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'לרשות המקומית אין כל מעמד. משכתב התביעה הועבר על ידה לחברת הביטוח, זו האחרונה בלבד תחליט האם לקבל את הצעת הפשרה אם לאו.', false, 'טענה זו שגויה, שכן סעיף 68 לחוק חוזה הביטוח מקנה למבוטח זכות להתנגד לפשרה, וזכות זו אינה נשללת מעצם העברת התביעה לחברת הביטוח.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'חברת הביטוח רשאית להתפשר עם רון ובלבד שהודיעה על הפשרה המוצעת בכתב לרשות המקומית 30 ימים מראש, והיא לא התנגדה בתוך תקופה זו.', true, 'תשובה זו נכונה, שכן היא משקפת את הוראת סעיף 68 לחוק חוזה הביטוח, הקובע את זכות המבוטח להתנגד לתשלום תגמולי ביטוח לצד שלישי, לאחר קבלת הודעה בכתב מהמבטח 30 ימים מראש.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'חברת הביטוח נזקקת להסכמה מפורשת של הרשות המקומית לפשרה המוצעת בכתב או בעל-פה.', false, 'טענה זו שגויה, שכן סעיף 68 לחוק אינו דורש הסכמה מפורשת, אלא מאפשר למבטח להתפשר אם המבוטח לא התנגד בתוך 30 ימים ממועד ההודעה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'חברת הביטוח נזקקת להסכמה של הרשות המקומית לפשרה המוצעת רק אם כך קבע בית המשפט.', false, 'טענה זו שגויה, שכן זכות ההתנגדות של המבוטח קבועה בחוק ואינה תלויה בהחלטת בית המשפט, אלא בתנאים הקבועים בסעיף 68 לחוק חוזה הביטוח.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 24, '2024-W-S-Q24';
END
$$;

-- ============================================================
-- Q25 — 2024-W-S-Q25 — chapter=contracts subtopic=insurance_contract  [needs_review]
-- classifier_note: Compulsory motor-vehicle insurance; could also belong in a tort chapter (PLT'D) which we don't have
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '10392b06-ccb0-4dd3-ac2f-a6a9e9deee6f'::uuid;
  v_group_id uuid := 'f756433f-a809-492c-9df8-03018df403e1'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q25';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 25, '2024-W-S-Q25';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'insurance_contract' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'insurance_contract', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q25', v_chapter_id, v_subtopic_id, 'איריס לא רכשה למכונית שבבעלותה ביטוח חובה לפי פקודת ביטוח רכב מנועי [נוסח חדש] (להלן: הפקודה). רון לא שמר מרחק ופגע עם רכבו במכוניתה של איריס, שנפצעה בתאונה. איריס מעוניינת להגיש תביעה בגין נזקי הגוף שנגרמו לה בתאונה. האם לאיריס יש עילת תביעה וכנגד מי?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 25}'::jsonb, 'השאלה עוסקת בזכאות לפיצויים של נפגע תאונת דרכים שנהג ברכב ללא ביטוח חובה. היא בוחנת את עקרון ייחוד העילה הקבוע בחוק הפיצויים לנפגעי תאונות דרכים, תשל"ה-1975 (חוק הפלת"ד), ובפרט את החריג הקבוע בסעיף 8(ג) לחוק, המאפשר למי שזכאותו לפי חוק הפלת"ד נשללה (כמו נהג חסר ביטוח לפי סעיף 7(5)), לתבוע פיצויים לפי פקודת הנזיקין [נוסח חדש].', 'חוק הפיצויים לנפגעי תאונות דרכים, תשל"ה-1975 (חוק הפלת"ד) קובע משטר של אחריות מוחלטת לפיצוי נפגעי גוף בתאונות דרכים. נבו - המתמחה דיני נזיקין (2026) | הקדמה אולם, סעיף 7 לחוק מונה רשימת נפגעים שאינם זכאים לפיצויים לפי חוק זה. סעיף 7 לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975 בין אלה נמנה "מי שנהג ברכב ללא ביטוח לפי פקודת הביטוח, או כשהביטוח שהיה לו לא כיסה את שימושו ברכב" (סעיף 7(5)). סעיף 7(5) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975 שלילת זכאות זו נובעת מתכלית עונשית-הרתעתית. ת"א (שלום ראשל"צ) 9695-03-17 פלוני נ'' שנטי עודאי (31.03.2025) עם זאת, שלילת הזכאות לפי חוק הפלת"ד אינה שוללת את זכותו של הנפגע לתבוע פיצויים לפי פקודת הנזיקין [נוסח חדש]. סעיף 8(ג) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975 הפסיקה קבעה כי זו הייתה כוונתו המפורשת של המחוקק, וכי אין מדובר בעילה בת עוולה, אלא בעילת רשלנות. ע"א (מחוזי ירושלים) 2317/08 בגים אליהו נ'' כוכב יצחק (08.03.2009) לכן, איריס רשאית לתבוע את רון (הנהג הפוגע) ואת חברת הביטוח שלו (מבטחת הרכב הפוגע) בעילה של רשלנות לפי פקודת הנזיקין. ת"א (שלום ת"א) 33003-03-15 פלוני נ'' עז'' ד.א. ז"ל (03.01.2022)', 'הטעות הנפוצה היא לחשוב שנהג חסר ביטוח מנוע מכל תביעה לפיצויים, מבלי להבחין בין העילה לפי חוק הפלת"ד לעילה לפי פקודת הנזיקין, או לבלבל בין זכאות מקרנית לבין תביעה נגד המזיק.',
    '["חוק פיצויים לנפגעי תאונות דרכים", "פקודת הנזיקין", "נהג חסר ביטוח", "ייחוד העילה", "סעיף 7(5)", "סעיף 8(ג)", "אחריות מוחלטת"]'::jsonb, '**וריאציה 1 — שלילת זכאות:** האם נהג חסר ביטוח זכאי לפיצויים לפי חוק הפלת"ד? ← לא, זכאותו נשללת לפי סעיף 7(5). סעיף 7(5) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975
**וריאציה 2 — עילה חלופית:** האם נהג חסר ביטוח יכול לתבוע לפי פקודת הנזיקין? ← כן, סעיף 8(ג) לחוק הפלת"ד מאפשר זאת. סעיף 8(ג) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975
**וריאציה 3 — נגד מי התביעה?** ← נגד הנהג הפוגע וחברת הביטוח שלו. ת"א (שלום ת"א) 33003-03-15 פלוני נ'' עז'' ד.א. ז"ל (03.01.2022)', 'נהג חסר ביטוח (ס'' 7(5) לפלת"ד) ← אינו זכאי לפיצוי לפי חוק הפלת"ד ← אך זכאי לתבוע לפי פקודת הנזיקין (ס'' 8(ג) לפלת"ד) ← נגד הנהג הפוגע ומבטחתו.', '["חוק פיצויים לנפגעי תאונות דרכים, תשל\"ה-1975, סעיף 7(5)", "חוק פיצויים לנפגעי תאונות דרכים, תשל\"ה-1975, סעיף 8(ג)", "ע\"א (מחוזי ירושלים) 2317/08 בגים אליהו נ'' כוכב יצחק (08.03.2009)", "ת\"א (שלום ת\"א) 33003-03-15 פלוני נ'' עז'' ד.א. ז\"ל (03.01.2022)", "ד\"נ 30/83 מריו כהנקא נ'' \"סהר\" חברה לביטוח בע\"מ, לח(4) 543 (24.12.1984)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''insurance_contract'' | classifier_note: Compulsory motor-vehicle insurance; could also belong in a tort chapter (PLT''D) which we don''t have | source_review_note: השאלה עוסקת בדיני ביטוח, תחום שאינו מופיע כפרק או תת-נושא ברשימה הסגורה. נבחר ''סדר דין אזרחי'' כפרק ו''הליכים'' כתת-נושא כברירת מחדל, שכן סוגיות אלו נדונות לעיתים קרובות בהליכים אזרחיים, אך יש לבחון התאמה טובה יותר.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'לא; הואיל ורכבה של איריס לא בוטח לפי הפקודה, לפיכך אין לה עילת תביעה כלשהי.', false, 'טענה זו שגויה, שכן שלילת זכאות לפי חוק הפיצויים לנפגעי תאונות דרכים אינה שוללת עילת תביעה לפי פקודת הנזיקין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כן; כלפי רון וחברת הביטוח שביטחה את רכבו עפ"י הפקודה בעילת תביעה עפ"י פקודת הנזיקין [נוסח חדש].', true, 'תשובה זו נכונה, שכן איריס, כנהגת ללא ביטוח חובה, אינה זכאית לפיצויים לפי חוק הפלת"ד (סעיף 7(5)), אך זכאית לתבוע לפי פקודת הנזיקין (סעיף 8(ג)) את רון וחברת הביטוח שלו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'כן; כלפי הקרן לפיצוי נפגעי תאונות דרכים ("קרנית") בלבד.', false, 'טענה זו שגויה, שכן איריס, כבעלת הרכב שנהגה בו ללא ביטוח, אינה זכאית לפיצויים מקרנית, למעט חריגים ספציפיים שאינם מתקיימים במקרה זה (סעיף 7א לחוק הפלת"ד).', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'כן; כלפי רון וחברת הביטוח שביטחה את רכבו עפ"י הפקודה בעילת תביעה עפ"י חוק הפיצויים לנפגעי תאונות דרכים, התשל"ה-1975.', false, 'טענה זו שגויה, שכן איריס אינה זכאית לתבוע פיצויים לפי חוק הפיצויים לנפגעי תאונות דרכים, מכיוון שנהגה ברכב ללא ביטוח חובה (סעיף 7(5) לחוק).', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 25, '2024-W-S-Q25';
END
$$;

-- ============================================================
-- Q26 — 2024-W-S-Q26 — chapter=contracts subtopic=limitation
-- classifier_note: Statute of limitations (התיישנות) after dismissal
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'e5767469-fe61-40d3-8784-01c55892dc51'::uuid;
  v_group_id uuid := '24140b7a-9833-4d5d-84e6-fd45bd94b0ec'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q26';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 26, '2024-W-S-Q26';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'limitation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'limitation', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q26', v_chapter_id, v_subtopic_id, 'אחמד הגיש נגד זוהיר תביעה כספית עקב נזק שנגרם למכוניתו ביום 1.1.2016. כתב התביעה הוגש לבית המשפט ביום 29.12.2022. מחמת אי התייצבות אחמד לדיון, מחק בית המשפט את כתב התביעה ביום 10.10.2023. מהו המועד האחרון שבו יוכל אחמד להגיש תביעה חדשה בגין אותה עילה נגד זוהיר?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 26}'::jsonb, 'השאלה עוסקת בהשעיית מרוץ ההתיישנות כאשר תביעה קודמת נדחתה או נמחקה, בהתאם לסעיפים 15 ו-16 לחוק ההתיישנות, תשי"ח-1958. סעיפים אלו נועדו לאזן בין זכות הגישה לערכאות של התובע לבין הצורך להגן על הנתבע מפני תביעות ישנות, ומאפשרים לתובע שהגיש תביעה במועד, אך זו נדחתה באופן שאינו יוצר מעשה בית דין, להגיש תביעה חדשה באותה עילה, תוך הארכת תקופת ההתיישנות.', 'חוק ההתיישנות, תשי"ח-1958, קובע תקופות התיישנות לתביעות שונות. בתביעה שאינה במקרקעין, תקופת ההתיישנות היא 7 שנים מיום היווצרות עילת התביעה. ת"א (שלום נצ'') 25220-01-21 פלוני נ'' שומרה חב'' לביטוח בע"מ (07.04.2021) סעיף 15 לחוק ההתיישנות קובע כי אם הוגשה תובענה לפני בית משפט ונדחתה באופן שלא נבצר מן התובע להגיש תובענה חדשה בשל אותה עילה, לא יבוא במניין תקופת ההתיישנות הזמן שבין הגשת התובענה ובין דחייתה. סעיף 15 לחוק ההתיישנות, תשי"ח-1958 המונח "נדחתה" פורש בפסיקה באופן רחב וכולל גם מחיקת תובענה או הפסקתה, כל עוד לא נוצר מעשה בית דין. רע"א 5687/22 הכשרת הישוב חברה לביטוח בע"מ נ'' פלוני (21.09.2022) סעיף 16 לחוק מוסיף וקובע כי אם נתעכב מניין תקופת ההתיישנות כאמור בסעיף 15, לא תסתיים התקופה לפני שעברה לפחות שנה אחת מן היום שבו חדל העיכוב. סעיף 16 לחוק ההתיישנות, תשי"ח-1958 במקרה הנדון, עילת התביעה נולדה ב-1.1.2016, ולכן תקופת ההתיישנות המקורית הייתה מסתיימת ב-1.1.2023. התביעה הראשונה הוגשה ב-29.12.2022 (בתוך תקופת ההתיישנות) ונמחקה ב-10.10.2023. מכיוון שהתביעה נמחקה ולא נדחתה לגופה, לא נוצר מעשה בית דין, ולכן סעיף 15 חל. העיכוב במניין ההתיישנות חדל ב-10.10.2023, ולכן לפי סעיף 16, המועד האחרון להגשת תביעה חדשה הוא שנה מיום זה, כלומר 10.10.2024. ת"א (שלום חי'') 64014-06-23 צ'' ב'' נ'' אגד אגודה שיתופית לתחבורה בישראל בע"מ (05.08.2024)', 'הטעות הנפוצה היא לחשב את תקופת ההתיישנות מחדש מיום מחיקת התביעה ללא תוספת השנה הקבועה בסעיף 16, או להתעלם מכך שמחיקה מחוסר מעש אינה יוצרת מעשה בית דין ומאפשרת הגשת תביעה חדשה.',
    '["התיישנות", "סעיף 15 לחוק ההתיישנות", "סעיף 16 לחוק ההתיישנות", "מחיקת תובענה", "מעשה בית דין", "חישוב תקופת התיישנות"]'::jsonb, '**וריאציה 1 — מועד עילת התביעה:** מתי מתחילה תקופת ההתיישנות? ← ביום שבו נולדה עילת התביעה (סעיף 6 לחוק ההתיישנות). ת"א (שלום נצ'') 25220-01-21 פלוני נ'' שומרה חב'' לביטוח בע"מ (07.04.2021)
**וריאציה 2 — השעיית מרוץ:** האם מחיקת תביעה עוצרת את מרוץ ההתיישנות? ← כן, לפי סעיף 15 לחוק ההתיישנות, התקופה שבין הגשת התביעה למחיקתה לא תבוא במניין. סעיף 15 לחוק ההתיישנות, תשי"ח-1958
**וריאציה 3 — הארכה לאחר עיכוב:** כמה זמן יש להגיש תביעה חדשה לאחר מחיקה? ← לפחות שנה מיום שחדל העיכוב (סעיף 16 לחוק ההתיישנות). סעיף 16 לחוק ההתיישנות, תשי"ח-1958', 'עילת תביעה (1.1.2016) ← תקופת התיישנות 7 שנים (עד 1.1.2023) ← תביעה ראשונה הוגשה במועד (29.12.2022) ← נמחקה (10.10.2023) ← סעיף 15 משעה את המרוץ ← סעיף 16 מאריך בשנה מיום המחיקה ← מועד אחרון: 10.10.2024.', '["חוק ההתיישנות, תשי\"ח-1958, סעיף 5(1)", "חוק ההתיישנות, תשי\"ח-1958, סעיף 6", "חוק ההתיישנות, תשי\"ח-1958, סעיף 15", "חוק ההתיישנות, תשי\"ח-1958, סעיף 16", "ת\"א (שלום נצ'') 25220-01-21 פלוני נ'' שומרה חב'' לביטוח בע\"מ (07.04.2021)", "רע\"א 5687/22 הכשרת הישוב חברה לביטוח בע\"מ נ'' פלוני (21.09.2022)", "ת\"א (שלום חי'') 64014-06-23 צ'' ב'' נ'' אגד אגודה שיתופית לתחבורה בישראל בע\"מ (05.08.2024)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''limitation'' | classifier_note: Statute of limitations (התיישנות) after dismissal | source_review_note: הנושא הוא דיני התיישנות, שאינו מופיע כתת-נושא ספציפי ברשימה הסגורה. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר, אך יש לשקול הוספת ''התיישנות'' כתת-נושא.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', '29.12.2023.', false, 'תשובה זו שגויה, שכן היא מתייחסת לשנה ממועד הגשת התביעה הראשונה, ולא ממועד מחיקתה, ואינה משקפת נכונה את הוראות סעיף 16 לחוק ההתיישנות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', '10.10.2024.', true, 'תשובה זו נכונה, שכן לפי סעיף 16 לחוק ההתיישנות, תקופת ההתיישנות לא תסתיים לפני שעברה לפחות שנה אחת מיום שחדל העיכוב, כלומר מיום מחיקת התביעה הקודמת.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', '10.10.2030.', false, 'תשובה זו שגויה, שכן היא מציעה תקופת התיישנות ארוכה בהרבה מהקבוע בחוק, ואינה מתבססת על הוראות סעיפים 15 ו-16 לחוק ההתיישנות.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא ניתן בנסיבות המתוארות להגיש תביעה חדשה, הואיל והתביעה התיישנה במועד שבו נמחקה.', false, 'תשובה זו שגויה, שכן מחיקת תביעה מחמת חוסר מעש אינה יוצרת מעשה בית דין, וסעיפים 15 ו-16 לחוק ההתיישנות מאפשרים הגשת תביעה חדשה באותה עילה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 26, '2024-W-S-Q26';
END
$$;

-- ============================================================
-- Q28 — 2024-W-S-Q28 — chapter=contracts subtopic=agency  [needs_review]
-- classifier_note: Trustee buying from trust assets — 'נאמנות' (trust) has no direct subtopic; agency (שליחות) is the closest
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '76f10176-6678-40ca-9707-10cb7b9ece9c'::uuid;
  v_group_id uuid := 'c3343531-48e0-427d-ba36-2fdd7ee75164'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q28';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 28, '2024-W-S-Q28';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'agency' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'agency', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q28', v_chapter_id, v_subtopic_id, 'נאמן על נכסים מעוניין לקנות בעצמו נכס מנכסי הנאמנות. הנאמן פנה לבית המשפט וביקש את אישור הפעולה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 28}'::jsonb, 'השאלה עוסקת באיסור על נאמן להפיק טובת הנאה מנכסי הנאמנות, כפי שקבוע בסעיף 13(א) לחוק הנאמנות, תשל"ט-1979. היא בוחנת את סמכות בית המשפט לאשר פעולה כזו (סעיף 13(ג)) ואת דרך ההשגה על החלטה כזו (סעיף 38). בכך, השאלה נוגעת לעקרונות יסוד בדיני נאמנות, ובפרט לחובת הנאמנות המוגברת ולמנגנוני הפיקוח השיפוטיים עליה.', 'סעיף 13(א) לחוק הנאמנות, תשל"ט-1979, קובע איסור מוחלט על נאמן לרכוש לעצמו או לקרובו נכס מנכסי הנאמנות, להפיק מהם טובת הנאה, או לעשות דבר שיש בו סתירה בין טובת הנאמנות לטובתו שלו או של קרובו. סעיף 13(א) לחוק הנאמנות, תשל"ט-1979 איסור זה נובע מחובת האמון המוגברת המוטלת על הנאמן, ומטרתו למנוע חשש לניגוד עניינים. ת"א (מחוזי ת"א) 27470-07-19 בית יורב 1997 בע"מ נ'' טובה כהן (21.06.2022) עם זאת, סעיף 13(ג) לחוק מאפשר לבית המשפט לאשר מראש פעולה כזו, אם ראה שהיא לטובת הנאמנות. סעיף 13(ג) לחוק הנאמנות, תשל"ט-1979 אישור זה חייב להינתן מראש, ובית המשפט אינו מוסמך לאשר פעולה אסורה בדיעבד. ע"א (מחוזי ירושלים) 11344/07 פלונית נ'' עו"ד משה מימרן (04.01.2009) על החלטות בית המשפט הניתנות מכוח סעיף 13(ג) לחוק הנאמנות, דרך ההשגה היא ערעור ברשות בלבד, בהתאם לסעיף 38 לחוק הנאמנות. סעיף 38 לחוק הנאמנות, תשל"ט-1979', 'הטעות הנפוצה היא לחשוב שהאיסור על נאמן להפיק טובת הנאה הוא מוחלט ואינו ניתן לאישור, או לבלבל בין ערעור בזכות לערעור ברשות על החלטות בענייני נאמנות.',
    '["נאמנות", "נאמן", "ניגוד עניינים", "איסור טובת הנאה", "אישור בית משפט", "ערעור ברשות", "חוק הנאמנות, סעיף 13", "חוק הנאמנות, סעיף 38"]'::jsonb, '**וריאציה 1 — איסור טובת הנאה:** האם נאמן יכול לרכוש נכס נאמנות? ← אסור, מכוח סעיף 13(א) לחוק הנאמנות. סעיף 13(א) לחוק הנאמנות, תשל"ט-1979
**וריאציה 2 — אישור בית משפט:** האם בית המשפט יכול לאשר פעולה כזו? ← כן, אם היא לטובת הנאמנות, ורק מראש (סעיף 13(ג)). סעיף 13(ג) לחוק הנאמנות, תשל"ט-1979
**וריאציה 3 — דרך ערעור:** מהי דרך הערעור על החלטת אישור? ← ערעור ברשות בלבד (סעיף 38). סעיף 38 לחוק הנאמנות, תשל"ט-1979', 'נאמן רוכש נכס נאמנות ← אסור (ס'' 13(א)) ← אלא אם ביהמ"ש אישר מראש לטובת הנאמנות (ס'' 13(ג)) ← ערעור על החלטה כזו ברשות (ס'' 38).', '["חוק הנאמנות, תשל\"ט-1979, סעיף 13(א)", "חוק הנאמנות, תשל\"ט-1979, סעיף 13(ג)", "חוק הנאמנות, תשל\"ט-1979, סעיף 38", "ע\"א 7235/15 יצחק ארבוס נ'' בקול - ארגון כבדי שמיעה ומתחרשים (ע\"ר) (11.08.2016)", "ע\"א (מחוזי ירושלים) 11344/07 פלונית נ'' עו\"ד משה מימרן (04.01.2009)", "עת\"מ (מינהליים י-ם) 15756-12-14 מוחמד סובח נ'' לשכת עורכי הדין בישראל (02.02.2015)", "ת\"א (מחוזי ת\"א) 27470-07-19 בית יורב 1997 בע\"מ נ'' טובה כהן (21.06.2022)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''agency'' | classifier_note: Trustee buying from trust assets — ''נאמנות'' (trust) has no direct subtopic; agency (שליחות) is the closest | source_review_note: הנושא הוא דיני נאמנות, שאינו מופיע כתת-נושא ספציפי ברשימה הסגורה. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר, אך יש לשקול הוספת ''נאמנות'' כתת-נושא.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'החוק אוסר על נאמן לרכוש לעצמו נכס מנכסי הנאמנות ולפיכך אין בית המשפט רשאי לאשר את הפעולה.', false, 'טענה זו שגויה, שכן סעיף 13(ג) לחוק הנאמנות מאפשר לבית המשפט לאשר פעולה כזו אם היא לטובת הנאמנות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט רשאי לאשר את הפעולה. החלטתו נתונה לערעור ברשות בלבד.', true, 'תשובה זו נכונה, שכן סעיף 13(ג) לחוק הנאמנות מאפשר לבית המשפט לאשר פעולה כזו, וסעיף 38 לחוק קובע כי החלטה לפי סעיף 13(ג) ניתנת לערעור ברשות בלבד.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט רשאי לאשר את הפעולה. צד מעוניין שמתנגד לכך רשאי לפנות בבקשה לעיון חוזר כל עוד לא הושלמה הפעולה.', false, 'טענה זו שגויה, שכן החלטה לפי סעיף 13(ג) ניתנת לערעור ברשות, ולא לעיון חוזר, ואין קשר להשלמת הפעולה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית המשפט רשאי לאשר את הפעולה. החלטתו נתונה לערעור בזכות.', false, 'טענה זו שגויה, שכן סעיף 38 לחוק הנאמנות קובע במפורש כי החלטה לפי סעיף 13(ג) ניתנת לערעור ברשות בלבד, ולא בזכות.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 28, '2024-W-S-Q28';
END
$$;

-- ============================================================
-- Q29 — 2024-W-S-Q29 — chapter=corporate subtopic=partnerships
-- classifier_note: Limited public partnership, gas-exploration firm, directors
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '85b9d09a-400c-4ff5-a7cb-175b58a6b3ce'::uuid;
  v_group_id uuid := '765d4faa-b487-4bef-acd3-94e057af9db9'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q29';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 29, '2024-W-S-Q29';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'corporate';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'corporate';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'partnerships' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'partnerships', 'corporate';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q29', v_chapter_id, v_subtopic_id, 'חברת חיפושי גז היא שותף כללי בשותפות מוגבלת ציבורית שהתאגדה בשנת 2010. עם התאגדותה של החברה מונה דירקטוריון החברה, שכלל שלושה דירקטורים רגילים (גילי, לירי, ודילי) וכן דירקטור חיצוני (דח"צ) אחד (יורם). לדירקטור דילי, שהוא איש פיננסים מעולה, אף ניתנה זכות הכרעה בלעדית בדירקטוריון בכל הנוגע לעניינים פיננסיים מקצועיים משמעותיים ומהותיים של החברה. בשנת 2019 נתגלע סכסוך בין בעלי מניות בשותפות ובמסגרת זו הועלו מטעם בעלי מניות A שתי דרישות: האחת - למנות לדירקטוריון החברה לפחות דירקטור חיצוני אחד נוסף (מלבד זה המכהן). השנייה - שלא להותיר את זכות ההכרעה הבלעדית בעניינים פיננסיים מקצועיים משמעותיים ומהותיים בידיו של הדירקטור דילי. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 29}'::jsonb, 'השאלה עוסקת בשני נושאים מרכזיים בדיני תאגידים החלים על שותפות מוגבלת ציבורית: חובת מינוי דירקטורים חיצוניים והיקף סמכויות הדירקטוריון והאפשרות להאצילן. היא בוחנת את הוראות סעיפים 65ט ו-65ב לפקודת השותפויות, המחילות את סעיפים 106 ו-239 לחוק החברות על שותפויות אלו, ומדגישה את עקרונות הממשל התאגידי התקין.', 'השאלה מתייחסת לשותפות מוגבלת ציבורית, אשר מכוח סעיף 65ט לפקודת השותפויות [נוסח חדש], תשל"ה-1975, כפופה להוראות מסוימות מחוק החברות, התשנ"ט-1999. סעיף 65ט לפקודת השותפויות [נוסח חדש], תשל"ה-1975
**לגבי הדרישה הראשונה – מינוי דירקטור חיצוני נוסף:** סעיף 65ט לפקודת השותפויות מפנה לסעיף 239(א) לחוק החברות, הקובע כי "בחברה ציבורית יכהנו לפחות שני דירקטורים חיצוניים". סעיף 239(א) לחוק החברות, התשנ"ט-1999 מכיוון שהשותפות הנדונה היא שותפות מוגבלת ציבורית, חלה עליה חובה זו. העובדה שמונה רק דירקטור חיצוני אחד (יורם) אינה עומדת בדרישת החוק, ולכן בעלי המניות A צודקים בדרישתם למינוי דירקטור חיצוני נוסף. ע"א 94/20 טוביה לוסקין נ'' גבעות עולם נפט בע"מ (20.01.2020)
**לגבי הדרישה השנייה – נטילת זכות ההכרעה הבלעדית מדילי:** סעיף 106 לחוק החברות קובע את סמכויות הדירקטוריון וקובע סמכויות שאינן ניתנות להאצלה. סעיף 106(ב) לחוק החברות, התשנ"ט-1999 הפסיקה קבעה כי הענקת זכות הכרעה בלעדית לדירקטור יחיד בעניינים פיננסיים מקצועיים משמעותיים ומהותיים מנוגדת לעקרון הניהול הקולקטיבי של הדירקטוריון ומהווה האצלת סמכות פסולה. ע"א 94/20 טוביה לוסקין נ'' גבעות עולם נפט בע"מ (20.01.2020) סמכויות ליבה אלו חייבות להישאר בידי הדירקטוריון כולו. לכן, גם בדרישה זו בעלי המניות A צודקים. ע"א 94/20 טוביה לוסקין נ'' גבעות עולם נפט בע"מ (20.01.2020)', 'הטעות הנפוצה היא להתעלם מההפניות בפקודת השותפויות לחוק החברות, או לחשוב שניתן להאציל סמכויות ליבה לדירקטור יחיד, במיוחד כאשר מדובר בעניינים פיננסיים מהותיים.',
    '["שותפות מוגבלת ציבורית", "דירקטורים חיצוניים", "האצלת סמכויות", "סעיף 65ט לפקודת השותפויות", "סעיף 239(א) לחוק החברות", "סעיף 106 לחוק החברות", "ניהול קולקטיבי של דירקטוריון"]'::jsonb, '**וריאציה 1 — דרישת דח"צ:** כמה דח"צ נדרשים בשותפות ציבורית? ← לפחות שניים, מכוח סעיף 65ט לפקודת השותפויות וסעיף 239(א) לחוק החברות. סעיף 65ט לפקודת השותפויות [נוסח חדש], תשל"ה-1975
**וריאציה 2 — האצלת סמכויות:** האם ניתן להאציל סמכויות פיננסיות מהותיות לדירקטור יחיד? ← לא, סעיף 106 לחוק החברות אוסר על האצלת סמכויות ליבה, והדבר מנוגד לעקרון הניהול הקולקטיבי. סעיף 106(ב) לחוק החברות, התשנ"ט-1999
**וריאציה 3 — פסק דין לוסקין:** מה קבע בית המשפט בעניין האצלת סמכויות בדירקטוריון שותפות ציבורית? ← הענקת זכות הכרעה בלעדית לדירקטור יחיד בעניינים פיננסיים מהותיים מנוגדת לעקרון הניהול הקולקטיבי ומהווה האצלת סמכות פסולה. ע"א 94/20 טוביה לוסקין נ'' גבעות עולם נפט בע"מ (20.01.2020)', 'שותפות ציבורית ← כפופה לחוק החברות (ס'' 65ט לפקודת השותפויות) ← חייבת 2 דח"צ לפחות (ס'' 239(א) לחוק החברות) ← אסור להאציל סמכויות ליבה פיננסיות לדירקטור יחיד (ס'' 106 לחוק החברות).', '["פקודת השותפויות [נוסח חדש], תשל\"ה-1975, סעיף 65ב", "פקודת השותפויות [נוסח חדש], תשל\"ה-1975, סעיף 65ט", "חוק החברות, התשנ\"ט-1999, סעיף 106", "חוק החברות, התשנ\"ט-1999, סעיף 239(א)", "ע\"א 94/20 טוביה לוסקין נ'' גבעות עולם נפט בע\"מ (20.01.2020)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''corporate'' subtopic=''partnerships'' | classifier_note: Limited public partnership, gas-exploration firm, directors | source_review_note: הנושא הוא דיני חברות/שותפויות, שאינו מופיע כתת-נושא ספציפי ברשימה הסגורה. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר, אך יש לשקול הוספת ''דיני תאגידים'' או ''דירקטורים'' כתת-נושא.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בעלי המניות A צודקים בשתי הדרישות.', true, 'תשובה זו נכונה, שכן שותפות מוגבלת ציבורית חייבת למנות לפחות שני דירקטורים חיצוניים, ואין להאציל סמכויות ליבה פיננסיות לדירקטור יחיד.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בעלי המניות A אינם צודקים באף לא אחת מהדרישות.', false, 'טענה זו שגויה, שכן שותפות מוגבלת ציבורית חייבת למנות לפחות שני דירקטורים חיצוניים, ואין להאציל סמכויות ליבה פיננסיות לדירקטור יחיד.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בעלי המניות A צודקים בנוגע לדרישה בדבר ההכרח במינויו של דח"צ אחד נוסף, אך אינם צודקים בדרישה לנטילת זכות ההכרעה הבלעדית כאמור מידיו של הדירקטור דילי.', false, 'טענה זו שגויה, שכן גם הדרישה לנטילת זכות ההכרעה הבלעדית מוצדקת, מכיוון שהיא מנוגדת לעקרון הניהול הקולקטיבי של הדירקטוריון.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בעלי המניות A אינם צודקים בנוגע לדרישה בדבר ההכרח במינויו של דח"צ אחד נוסף, אך צודקים בדרישה בעניין נטילת זכות ההכרעה הבלעדית מידיו של הדירקטור דילי.', false, 'טענה זו שגויה, שכן גם הדרישה למינוי דח"צ נוסף מוצדקת, מכיוון ששותפות מוגבלת ציבורית חייבת למנות לפחות שני דירקטורים חיצוניים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 29, '2024-W-S-Q29';
END
$$;

-- ============================================================
-- Q30 — 2024-W-S-Q30 — chapter=corporate subtopic=companies_formation
-- classifier_note: Founders' agreement, anti-dilution protection
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '73d3499a-8bca-4f6c-9074-6163dcbe0809'::uuid;
  v_group_id uuid := '2b981852-266e-4253-875e-78bf42fb2759'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q30';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 30, '2024-W-S-Q30';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'corporate';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'corporate';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'companies_formation' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'companies_formation', 'corporate';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q30', v_chapter_id, v_subtopic_id, 'בין מספר יזמי נדל"ן נכרת הסכם מייסדים בשנת 2019 בקשר עם חברת נדל"ן שתוקם בבעלותם המשותפת. בהסכם האמור גם נכלל סעיף המעגן הגנה מפני דילול אחזקות אשר מבטא את רצונם כמייסדי החברה לשמור על שיעור מינימלי של בעלות עתידית בהון המניות של החברה, גם לאחר אירוע גיוס הון הכרוך בהקצאת מניות נוספות מטעם החברה (להלן: "סעיף אנטי דילול"). בשנת 2020 התאגדה החברה וזו אישרה במועד התאגדותה ובדיעבד את הסכם המייסדים כולו גם במסגרת תקנון החברה. הגם שמצבה הפיננסי של החברה טוב, מבקשת החברה לבצע גיוס הון ממשקיעים חיצוניים לחברה ולהקצות להם מניות בהתאם. בקשר עם אותו גיוס הון, מבקשת החברה לבחון שינוי בתקנון החברה וכן לקבל החלטות שיש בהם כדי לגרוע מההגנה שמקנה "סעיף האנטי דילול". מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 30}'::jsonb, 'השאלה עוסקת במעמדו המשפטי של הסכם מייסדים בחברה, ובפרט בסעיף אנטי דילול, כאשר החברה אימצה את ההסכם וכללה אותו בתקנונה. היא בוחנת את חובתה של החברה לכבד הסכמים שאומצו על ידה, ואת ההשלכות המשפטיות של פעולה בניגוד להם, תוך התייחסות להוראות חוק החברות הנוגעות לתקנון החברה ולחובותיה החוזיות.', 'הסכם מייסדים הוא הסכם שנכרת בין יזמים טרם הקמת החברה. ככלל, חברה אינה צד להסכם שנכרת לפני הקמתה, ולכן אינה מחויבת לו אוטומטית. בג"ץ 4295/95 קמחי נ'' בית-הדין הארצי לעבודה בירושלים (25.03.1996)
במקרה הנדון, החברה התאגדה בשנת 2020 ואישרה במועד התאגדותה ובדיעבד את הסכם המייסדים כולו, ואף כללה אותו במסגרת תקנון החברה. בכך, החברה אימצה את הסכם המייסדים והפכה אותו למחייב כלפיה. ע"א 6041/15 האמה בע"מ נ'' אורנה מולר (20.03.2017)
תקנון החברה הוא המסמך המחייב של החברה וקובע את יחסיה עם בעלי מניותיה. סעיף 15 לחוק החברות, התשנ"ט-1999 מרגע שהסכם המייסדים, ובכללו סעיף האנטי דילול, נכלל בתקנון החברה, הוא הופך לחלק בלתי נפרד ממסמכי ההתאגדות המחייבים את החברה. סעיף 12 לחוק החברות, התשנ"ט-1999

לפיכך, החברה מוגבלת מלבצע שינוי בתקנון שיגרע מההגנה שמקנה סעיף האנטי דילול, וכן מלקבל החלטות שיש בהן כדי לפגוע בסעיף זה. פעולות כאמור יהוו הפרה של התקנון ושל הסכם המייסדים שאומץ על ידי החברה. הפרה זו עשויה לחשוף את החברה לתביעה בגין הפרת חוזה מצד המייסדים, עם כל הסעדים הנובעים מכך (אכיפה, פיצויים וכדומה). ע"א 6041/15 האמה בע"מ נ'' אורנה מולר (20.03.2017)', 'הטעות הנפוצה היא לחשוב שהסכם מייסדים שנכרת טרם התאגדות אינו מחייב את החברה, או להתעלם מהמשמעות של אימוץ ההסכם והכללתו בתקנון החברה.',
    '["הסכם מייסדים", "אימוץ הסכם טרום התאגדות", "תקנון חברה", "סעיף אנטי דילול", "הפרת חוזה", "חוק החברות, סעיף 12", "חוק החברות, סעיף 14"]'::jsonb, '**וריאציה 1 — אימוץ הסכם מייסדים:** האם חברה מחויבת להסכם מייסדים שאומץ וצורף לתקנון? ← כן, הוא מחייב אותה חוזית וסטטוטורית. ע"א 6041/15 האמה בע"מ נ'' אורנה מולר (20.03.2017)
**וריאציה 2 — שינוי תקנון:** האם ניתן לשנות תקנון באופן שפוגע בסעיף אנטי דילול שאומץ? ← לא, שינוי כזה יהווה הפרה של התקנון וההסכם. סעיף 12 לחוק החברות, התשנ"ט-1999
**וריאציה 3 — השלכות הפרה:** מהן ההשלכות של הפרת סעיף אנטי דילול שאומץ? ← החברה חשופה לתביעה בגין הפרת חוזה. ע"א 6041/15 האמה בע"מ נ'' אורנה מולר (20.03.2017)', 'הסכם מייסדים אומץ וצורף לתקנון ← מחייב את החברה ← שינוי או החלטה בניגוד אליו ← הפרת חוזה ← חשיפה לתביעה.', '["חוק החברות, התשנ\"ט-1999, סעיף 12", "חוק החברות, התשנ\"ט-1999, סעיף 14", "חוק החברות, התשנ\"ט-1999, סעיף 15", "ע\"א 6041/15 האמה בע\"מ נ'' אורנה מולר (20.03.2017)", "בג\"ץ 4295/95 קמחי נ'' בית-הדין הארצי לעבודה בירושלים (25.03.1996)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''corporate'' subtopic=''companies_formation'' | classifier_note: Founders'' agreement, anti-dilution protection | source_review_note: הנושא הוא דיני חברות, שאינו מופיע כתת-נושא ספציפי ברשימה הסגורה. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר, אך יש לשקול הוספת ''דיני תאגידים'' או ''הסכמי מייסדים'' כתת-נושא.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'אין כל מגבלה מבחינת החברה לבצע שינוי בתקנון החברה וכן לקבל החלטות שיש בהן כדי לגרוע מההגנה שמקנה "סעיף האנטי דילול", מכיוון שהסכם המייסדים נכרת עוד בטרם שהחברה התאגדה, ולפיכך אין לו כל משמעות.', false, 'טענה זו שגויה, שכן חברה יכולה לאמץ הסכם מייסדים שנכרת טרם התאגדותה, ובמקרה זה החברה אף אימצה את ההסכם וכללה אותו בתקנונה, מה שהופך אותו למחייב.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'יש מגבלה לבצע שינוי בתקנון שגורע מההגנה שמקנה "סעיף האנטי דילול", מכיוון שתקנון החברה הינו חלק ממסמכי התאגדות החברה ואולם אין כל מגבלה מבחינת החברה לקבל החלטות בחברה שיש בהן כדי לגרוע מההגנה שמקנה "סעיף האנטי דילול".', false, 'טענה זו שגויה, שכן המגבלה חלה הן על שינוי התקנון והן על קבלת החלטות המנוגדות להסכם המייסדים שאומץ על ידי החברה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'יש מגבלה מבחינת החברה לבצע שינוי בתקנון החברה וכן לקבל החלטות שיש בהן כדי לגרוע מההגנה שמקנה "סעיף האנטי דילול", ובמקרה שתבוצענה פעולות כאמור עשויה החברה להיחשב כמפרת חוזה.', true, 'תשובה זו נכונה, שכן החברה אימצה את הסכם המייסדים וכללה אותו בתקנונה, ולכן היא מחויבת לו. פעולה בניגוד לכך תהווה הפרת חוזה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אין כל מגבלה מבחינת החברה לבצע שינוי בתקנון החברה וכן לקבל החלטות שיש בהן כדי לגרוע מההגנה שמקנה "סעיף האנטי דילול", כל זמן שמדובר בגיוס הון ממשקיעים חיצוניים לחברה שאמנם מודעים לתוכנו של הסכם המייסדים אך אינם צד לו.', false, 'טענה זו שגויה, שכן מרגע שהחברה אימצה את הסכם המייסדים וכללה אותו בתקנונה, היא מחויבת לו כלפי המייסדים, ללא קשר למודעות או מעמד המשקיעים החיצוניים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 30, '2024-W-S-Q30';
END
$$;

-- ============================================================
-- Q31 — 2024-W-S-Q31 — chapter=contracts subtopic=construction_contract  [needs_review]
-- classifier_note: Pre-construction apartment buyer, disclosure duty in negotiations — sits between contracts/general_part and construction_contract
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'afbfa2fc-b951-4e46-a8a3-7ddb4ca31084'::uuid;
  v_group_id uuid := '7cf05c93-83fb-4542-841d-fb2302ade134'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q31';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 31, '2024-W-S-Q31';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'construction_contract' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'construction_contract', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q31', v_chapter_id, v_subtopic_id, 'דינה, המתגוררת בקנדה, החליטה לרכוש דירת מגורים שטרם נבנתה ("על הנייר") מחברה קבלנית בישראל. במסגרת המשא ומתן שנוהל בין הצדדים בטרם חתימת הסכם הרכישה, החברה ומי מנציגיה לא גילו מיוזמתם לדינה את כלל המידע שהיה מצוי בידם בקשר לדירה. בכלל כך, לא גילו לדינה כי בצמוד לדירה הנרכשת יוקם מבנה שיחסום כליל את הנוף הנשקף מהדירה וכי יש בכך כדי לגרוע משווי הדירה, וזאת בשונה מדירה סמוכה שיכולה היתה לרכוש ללא חסימת נוף. רק בעת קבלת הדירה דינה נחשפה לראשונה לפרט האמור, שכן קודם לכן לא ידעה על כך דבר. דינה בוחנת את הסעדים שעומדים לרשותה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 31}'::jsonb, 'השאלה עוסקת בהפרת חובת הגילוי במשא ומתן לרכישת דירה ''על הנייר'' על ידי חברה קבלנית, ובהשלכותיה המשפטיות. היא בוחנת את חובת תום הלב (סעיף 12 לחוק החוזים), את עילת ההטעיה במחדל (סעיף 15 לחוק החוזים) ואת הסעדים העומדים לרשות הנפגע, ובפרט פיצויי הסתמכות ואובדן הזדמנות, כפי שפורש בפסיקת בית המשפט העליון בעניין *מור נ'' אלעד ישראל מגורים*.', 'סעיף 12(א) לחוק החוזים (חלק כללי), תשל"ג-1973, מטיל חובה לנהוג בתום לב ובדרך מקובלת במשא ומתן לקראת כריתתו של חוזה. ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023) חובה זו כוללת חובת גילוי מוגברת על קבלן המוכר דירה ''על הנייר'', בשל פערי המידע והכוחות המשמעותיים בינו לבין הרוכש. ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023) אי-גילוי מידע מהותי, כמו חסימת נוף, מהווה הפרה של חובת תום הלב, ועשוי להיחשב גם כהטעיה במחדל לפי סעיף 15 לחוק החוזים. ע"א 9019/99 מרילין קינסטלינגר נ'' רחמים אליה (25.03.2001)
כאשר צד למשא ומתן הונע להתקשר בחוזה עקב אי-גילוי כאמור, עומדות לרשותו, במצטבר או לחלופין, תרופות של ביטול החוזה מחמת הטעיה במחדל (סעיף 15 לחוק החוזים) ופיצויים לפי סעיף 12(ב) לחוק החוזים. ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023) פיצויים אלו הם פיצויי הסתמכות (''פיצויים שליליים''), שמטרתם להעמיד את הנפגע במצב שבו היה עומד אלמלא נכנס למשא ומתן או אלמלא הפרת חובת תום הלב. נבו - המתמחה דיני חוזים וחיובים (2026) | סעדים בעקבות הפרת חובת תום הלב במשא ומתן
פיצויי הסתמכות יכולים לכלול גם פיצוי בגין אובדן הזדמנות חלופית, ככל שהנפגע יוכיח את קיומה ואת שווייה הכספי. ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023) במקרה הנדון, דינה זכאית לבטל את ההסכם עקב הטעיה במחדל או חוסר תום לב, וכן לפיצויי הסתמכות שיכללו הוצאות ואובדן הזדמנות, בכפוף להוכחה. דניאל פרידמן ונילי כהן חוזים כרך א (2018) | אובדן הזדמנות', 'הטעות הנפוצה היא לחשוב שחובת הגילוי של קבלן זהה לזו של מוכר רגיל, או לבלבל בין פיצויי הסתמכות לפיצויי קיום, ובפרט להניח שאובדן הזדמנות אינו דורש הוכחה.',
    '["חובת תום לב במשא ומתן", "חובת גילוי מוגברת", "דירה ''על הנייר''", "הטעיה במחדל", "ביטול חוזה", "פיצויי הסתמכות", "אובדן הזדמנות", "חוק החוזים (חלק כללי)", "חוק החוזים (תרופות)"]'::jsonb, '**וריאציה 1 — חובת גילוי לקבלן:** האם קבלן המוכר דירה ''על הנייר'' חייב בגילוי מוגבר? ← כן, מכוח סעיף 12(א) לחוק החוזים, בשל פערי מידע וכוח. ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023)
**וריאציה 2 — סעדים להפרת חובת גילוי:** מהם הסעדים העיקריים להפרת חובת גילוי כזו? ← ביטול חוזה (הטעיה) ופיצויי הסתמכות (סעיף 12(ב) לחוק החוזים). ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023)
**וריאציה 3 — אובדן הזדמנות:** האם פיצוי בגין אובדן הזדמנות דורש הוכחה? ← כן, יש להוכיח את ההזדמנות שאבדה ואת שווייה הכספי. ע"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע"מ (01.01.2023)', 'קבלן מוכר דירה ''על הנייר'' ← חובת גילוי מוגברת (ס'' 12(א) חוזים) ← אי-גילוי מידע מהותי ← הפרת תום לב/הטעיה (ס'' 15 חוזים) ← סעדים: ביטול + פיצויי הסתמכות (ס'' 12(ב) חוזים) + אובדן הזדמנות (דורש הוכחה).', '["חוק החוזים (חלק כללי), תשל\"ג-1973, סעיף 12", "חוק החוזים (חלק כללי), תשל\"ג-1973, סעיף 15", "חוק החוזים (תרופות בשל הפרת חוזה), תשל\"א-1970, סעיף 10", "חוק החוזים (תרופות בשל הפרת חוזה), תשל\"א-1970, סעיף 13", "חוק החוזים (תרופות בשל הפרת חוזה), תשל\"א-1970, סעיף 14", "ע\"א 2274/21 נטע מור נ'' אלעד ישראל מגורים בע\"מ (01.01.2023)", "ע\"א 9019/99 מרילין קינסטלינגר נ'' רחמים אליה (25.03.2001)", "ת\"א (מחוזי ב\"ש) 7137-09-18 נתנאל אטיאס נ'' אלון גורן (16.11.2025)", "דניאל פרידמן ונילי כהן, חוזים כרך א (2018), פרק 12 אחריות בשלבי המשא ומתן", "נבו - המתמחה, דיני חוזים וחיובים (2026), סעדים בעקבות הפרת חובת תום הלב במשא ומתן", "אביאל פלינט, חגי ויניצקי, תובענות ייצוגיות (2017), פרק ו עילות התביעה השונות"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''construction_contract'' | classifier_note: Pre-construction apartment buyer, disclosure duty in negotiations — sits between contracts/general_part and construction_contract | source_review_note: הנושא הוא דיני חוזים, ובפרט חובת גילוי במשא ומתן. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר, אך יש לשקול הוספת ''דיני חוזים'' או ''חובת גילוי'' כתת-נושא.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'דינה זכאית לבטל את ההסכם ובנוסף זכאית לקבל פיצויי הסתמכות שיעמידו אותה במקום בו היתה עומדת אלמלא המשא ומתן שנוהל עימה ללא מסירת מידע מלא כאמור, וכן זכאית לקבל פיצוי בגין הזדמנות שאבדה לה, מבלי שתידרש להוכיח את ההזדמנות שאבדה ושווייה הכספי.', false, 'טענה זו שגויה בחלקה, שכן פיצוי בגין אובדן הזדמנות דורש הוכחה של ההזדמנות שאבדה ושוויָה הכספי, ולא ניתן לקבלו ללא הוכחה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'דינה אינה זכאית לבטל את ההסכם, מכיוון שההסכם נחתם זה מכבר ובניית הדירה הסתיימה, וכן אינה זכאית לפיצוי כלשהו, שכן חלה עליה החובה כ''קונה זהיר'' לברר מהו הסטטוס התכנוני של הדירה בטרם רכישתה.', false, 'טענה זו שגויה, שכן הפרת חובת גילוי מוגברת על ידי קבלן מקנה זכות לביטול ופיצויים, ונטל הבדיקה על הקונה אינו פוטר את הקבלן מאחריות במקרה של פערי מידע מהותיים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'דינה זכאית לבטל את ההסכם ובנוסף לקבל פיצויי הסתמכות שיעמידו אותה במקום בו היתה עומדת אלמלא המשא ומתן שנוהל עימה ללא מסירת מידע מלא כאמור, וכן זכאית לקבל פיצוי בגין הזדמנות שאבדה לה, ככל שיעלה בידה להוכיח את ההזדמנות שאבדה ואת שווייה הכספי.', true, 'תשובה זו נכונה, שכן הפרת חובת גילוי במשא ומתן מקנה זכות לביטול החוזה (הטעיה) ופיצויי הסתמכות, לרבות פיצוי בגין אובדן הזדמנות, בכפוף להוכחת הנזק.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'דינה אינה זכאית לבטל את ההסכם אך זכאית לקבל פיצויי הסתמכות, וכן זכאית לקבל פיצוי בגין הזדמנות שאבדה לה, מבלי שתידרש להוכיח את ההזדמנות שאבדה ושווייה הכספי.', false, 'טענה זו שגויה, שכן הפרת חובת גילוי מהווה עילת הטעיה המאפשרת ביטול חוזה, ופיצוי בגין אובדן הזדמנות דורש הוכחה.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 31, '2024-W-S-Q31';
END
$$;

-- ============================================================
-- Q32 — 2024-W-S-Q32 — chapter=ethics subtopic=fiduciary_privilege_conflict
-- classifier_note: Attorney-client privilege scope, joint representation
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd714a70c-4e58-4430-8769-4e2ef25bd832'::uuid;
  v_group_id uuid := '7e9c8d31-4e34-4b60-a8db-bfce22f81e54'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q32';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 32, '2024-W-S-Q32';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'ethics';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'ethics';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fiduciary_privilege_conflict' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fiduciary_privilege_conflict', 'ethics';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q32', v_chapter_id, v_subtopic_id, 'חברת "אקסילון" וחברת "קשנית" פנו לעו"ד בירון בשנת 2011 על מנת שזה ייצג אותן במשותף ויכין עבורן הסכם שירותים. לימים נתגלעו בין החברות מחלוקות ובשנת 2021 הגישה חברת אקסילון נגד חברת קשנית תביעה לבית המשפט בקשר עם הסכם זה והפרתו על ידי חברת קשנית. חברת אקסילון מבקשת לזמן את עו"ד בירון לעדות, תוך ויתור על חיסיון, בקשר עם עריכת הסכם השירותים והשיחות שניהל עו"ד בירון עם הצדדים במשותף בקשר להסכם. חברת קשנית מתנגדת למתן עדותו של עו"ד בירון בשל חיסיון שחל לטענתה על הפרטים האמורים. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 32}'::jsonb, 'השאלה עוסקת בהיקף תחולתו של חיסיון עורך דין-לקוח במקרה של ייצוג משותף של שני לקוחות. היא בוחנת את הכלל לפיו כאשר עורך דין מייצג שני צדדים במשותף, החיסיון אינו חל על היחסים שבין הלקוחות עצמם, ולכן די בויתור של אחד מהם כדי לאפשר את עדות עורך הדין כלפי הלקוח השני. זאת, בניגוד למצב שבו נדרש ויתור של כל הלקוחות כלפי צד שלישי.', 'חיסיון עורך דין-לקוח הוא חיסיון סטטוטורי המעוגן בסעיף 48 לפקודת הראיות [נוסח חדש], תשל"א-1971, וכן בסעיף 90 לחוק לשכת עורכי הדין, תשכ"א-1961. סעיף 48(א) לפקודת הראיות [נוסח חדש], תשל"א-1971 סעיף 90 לחוק לשכת עורכי הדין, תשכ"א-1961 תכליתו של החיסיון היא לאפשר תקשורת פתוחה וגלויה בין עורך דין ללקוחו, ובכך להבטיח ייצוג הולם והוגן. רע"א 6171/17 פלוני נ'' קופת חולים מאוחדת (04.09.2017) החיסיון הוא מוחלט ואינו נסוג מפני חקר האמת, ורק הלקוח רשאי לוותר עליו. ת"א (מחוזי ת"א) 45320-07-19 טיטאן בניה בע"מ נ'' ירון דיסקין (01.01.2023) יניב ואקי דיני ראיות כרך ג (2021) | ג. מיהו בעל החיסיון?
במקרה הנדון, עו"ד בירון ייצג במשותף את חברת אקסילון וחברת קשנית. הלכה פסוקה היא שכאשר שני לקוחות פונים במשותף לעורך דין אחד, הרי דברים ומסמכים שהוחלפו בין לקוח אחד לבין עורך הדין לגבי העניין המשותף, אינם חסויים בפני הלקוח האחר. ע"א 442/81 אונה (רוחמה) גרומט נ'' יוסף סרוסי (03.10.1982) רע"א (מחוזי ב"ש) 72664-11-21 קיסיה אכרם נ'' וליד חמוד (27.01.2022) עורך הדין המייצג את שני הצדדים אינו יכול לשמור סוד בין לקוח ללקוח. לפיכך, במערכת היחסים הפנימית שבין חברת אקסילון לחברת קשנית, החיסיון אינו חל. משמעות הדבר היא שדי בכך שחברת אקסילון, שהיא אחד הלקוחות המשותפים, ויתרה על החיסיון, כדי לאפשר לעו"ד בירון ליתן עדות בקשר לשיחות והמסמכים שהוחלפו במסגרת הייצוג המשותף, וזאת כלפי חברת קשנית. יניב ואקי דיני ראיות כרך ג (2021) | א. ויתור על החיסיון', 'הטעות הנפוצה היא להניח שחיסיון עורך דין-לקוח הוא תמיד מוחלט ודורש ויתור של כל הצדדים, גם כאשר מדובר בלקוחות שיוצגו במשותף והסכסוך הוא ביניהם. יש להבחין בין חיסיון כלפי צד שלישי לבין חיסיון בין לקוחות משותפים.',
    '["חיסיון עורך דין-לקוח", "ייצוג משותף", "ויתור על חיסיון", "פקודת הראיות", "חוק לשכת עורכי הדין", "חיסיון מוחלט"]'::jsonb, '**וריאציה 1 — חיסיון עו"ד-לקוח בייצוג משותף:** האם חל חיסיון בין לקוחות שיוצגו במשותף? ← לא, עורך הדין אינו יכול לשמור סוד בין לקוח ללקוח. רע"א (מחוזי ב"ש) 72664-11-21 קיסיה אכרם נ'' וליד חמוד (27.01.2022)
**וריאציה 2 — ויתור על חיסיון בייצוג משותף:** האם נדרשת הסכמת שני הצדדים לויתור? ← לא, די בהסכמת צד אחד כלפי השני. ע"א 442/81 אונה (רוחמה) גרומט נ'' יוסף סרוסי (03.10.1982)
**וריאציה 3 — תכלית החיסיון:** מהי תכלית חיסיון עו"ד-לקוח? ← לאפשר תקשורת פתוחה וגלויה לייצוג הולם. רע"א 6171/17 פלוני נ'' קופת חולים מאוחדת (04.09.2017)', 'ייצוג משותף ← אין חיסיון בין הלקוחות ← די בויתור של אחד כלפי השני. החיסיון מוחלט אך לא חל במערכת יחסים זו.', '["פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 48", "חוק לשכת עורכי הדין, תשכ\"א-1961, סעיף 90", "ע\"א 442/81 אונה (רוחמה) גרומט נ'' יוסף סרוסי (03.10.1982)", "רע\"א (מחוזי ב\"ש) 72664-11-21 קיסיה אכרם נ'' וליד חמוד (27.01.2022)", "רע\"א 6171/17 פלוני נ'' קופת חולים מאוחדת (04.09.2017)", "ת\"א (מחוזי ת\"א) 45320-07-19 טיטאן בניה בע\"מ נ'' ירון דיסקין (01.01.2023)", "יניב ואקי, דיני ראיות כרך ג (2021), פרק 54 חיסיון עורך דין-לקוח, א. ויתור על החיסיון", "יניב ואקי, דיני ראיות כרך ג (2021), פרק 54 חיסיון עורך דין-לקוח, ג. מיהו בעל החיסיון?"]'::jsonb,
    'classification_review: original chapter=''דיני ראיות'' subtopic=''קבילות ראיות'' → mapped chapter=''ethics'' subtopic=''fiduciary_privilege_conflict'' | classifier_note: Attorney-client privilege scope, joint representation | source_review_note: הנושא הוא חיסיון עורך דין-לקוח, שאינו מופיע כתת-נושא ספציפי ברשימה הסגורה. ''קבילות ראיות'' הוא הקרוב ביותר, אך יש לשקול הוספת ''חיסיון עורך דין-לקוח'' כתת-נושא.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'עו"ד בירון אינו רשאי ליתן עדות בבית המשפט, מכיוון שייצג גם את חברת קשנית שמתנגדת למתן עדות בטענת חיסיון, וכדי לוותר על טענת חיסיון נדרשת הסכמתם של שני הצדדים.', false, 'טענה זו שגויה, שכן במקרה של ייצוג משותף, החיסיון אינו חל על היחסים שבין הלקוחות עצמם, ולכן די בויתור של אחד מהם כלפי השני.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'עו"ד בירון רשאי ליתן עדות בבית המשפט, מכיוון שייצג בעניין זה ובמשותף את שתי החברות, ומכאן שדי בכך שצד אחד הסכים לוותר על החיסיון.', true, 'תשובה זו נכונה, שכן כאשר עורך דין מייצג שני לקוחות במשותף, החיסיון אינו חל על היחסים שביניהם, ולכן ויתור של לקוח אחד מאפשר את העדות כלפי הלקוח השני.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'עו"ד בירון אינו רשאי ליתן עדות בבית המשפט. מכיוון שמדובר בהליך משפטי שאינו חסוי, ולפיכך הפרטים שלגביהם ימסור עדות עשויים להגיע לידיעת צד ג'' תוך פגיעה בחיסיון.', false, 'טענה זו שגויה, שכן השאלה מתייחסת ליחסים בין הלקוחות המשותפים, ולא לחשיפת מידע לצד שלישי חיצוני. במקרה זה, החיסיון אינו חל בין הלקוחות.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'עו"ד בירון רשאי ליתן עדות בבית המשפט. מכיוון שייצג בעניין זה ובמשותף את שתי החברות לפני יותר משבע שנים ולפיכך חלה התיישנות על טענת החיסיון.', false, 'טענה זו שגויה, שכן חיסיון עורך דין-לקוח הוא חיסיון מוחלט שאינו מתיישן, והוא חל גם לאחר תום יחסי עורך דין-לקוח.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 32, '2024-W-S-Q32';
END
$$;

-- ============================================================
-- Q33 — 2024-W-S-Q33 — chapter=family_inheritance subtopic=inheritance_will
-- classifier_note: Will provisions, 'יורש אחר יורש' (heir-after-heir) clause
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '244682c0-26a4-4159-b139-291e48d2425f'::uuid;
  v_group_id uuid := 'cfb9904b-6e10-44ae-9704-7722dbe3a42e'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q33';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 33, '2024-W-S-Q33';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'family_inheritance';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'family_inheritance';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'inheritance_will' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'inheritance_will', 'family_inheritance';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q33', v_chapter_id, v_subtopic_id, 'לאריה (להלן: "המצווה") יש בן ובת ואין לו נכדים בעת עריכת צוואתו. איזו הוראת צוואה מהרשומות מטה, אם ירשום אריה בצוואתו, אינה כשרה ולפיכך בטלה?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 33}'::jsonb, 'השאלה עוסקת בהוראות צוואה מסוג ''יורש אחר יורש'' ובמגבלות המוטלות עליהן על פי חוק הירושה. היא מתמקדת בסעיף 42(ד) לחוק, הקובע כי הוראת צוואה מסוג זה ליותר משני יורשים בטלה, אלא אם כן היורשים הנוספים היו בחיים בעת עשיית הצוואה. השאלה בוחנת את הבנת הכלל והחריג לו, ואת המשמעות של ''שלטון המת על החי'' בדיני הירושה.', 'חוק הירושה, תשכ"ה-1965, מאפשר למצווה לקבוע בצוואתו הסדר של ''יורש אחר יורש'' (סעיף 42). סעיף 42(א) לחוק הירושה, תשכ"ה-1965 הסדר זה קובע שהיורש הראשון יזכה בנכסים, ולאחר מותו (או בהתקיים תנאי מסוים), היורש השני יזכה במה ששייר הראשון. ע"א 1182/90 דורית שחם נ'' מרים רוטמן (02.08.1992)

אולם, סעיף 42(ד) לחוק הירושה מטיל מגבלה מהותית על הסדר זה: הוראת צוואה על דרך ''יורש אחר יורש'' ליותר משני יורשים – בטלה. סעיף 42(ד) לחוק הירושה, תשכ"ה-1965 מגבלה זו היא קוגנטית, כלומר, לא ניתן להתנות עליה בצוואה, והיא מבטאת את רצונה של שיטת המשפט להגביל את כוחו של המצווה לשלוט בנכסיו ''מקברם'' (''שלטון המת על החי''). רע"א 3130/05 יורשי המנוחה א. ר. ז"ל נ'' האפוטרופוס הכללי כמנהל עזבון המנוחה מ. ר. ז"ל (14.09.2006) ת"ע (משפחה צפת) 10740-05-20 א''. ע'' נ'' האפוטרופוס הכללי מחוז חיפה והצפון משרדי ממשלה (30.07.2020)
החריג היחיד לכלל זה הוא אם היורשים הנוספים (מעבר לשניים הראשונים) היו בחיים בשעת עשיית הצוואה. סעיף 42(ד) לחוק הירושה, תשכ"ה-1965
במקרה הנדון, המצווה אריה קבע שרשרת של שלושה יורשים (בן, נכד בכור, נכדה), כאשר בעת עריכת הצוואה לא היו לו נכדים. משמעות הדבר היא שהנכד והנכדה לא היו בחיים בעת עשיית הצוואה. לפיכך, הוראת הצוואה לטובת היורש השלישי (הנכדה) בטלה, שכן היא חורגת מהמגבלה הקוגנטית הקבועה בסעיף 42(ד) לחוק הירושה. נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | יורש אחר יורש', 'הטעות הנפוצה היא להתעלם ממגבלת סעיף 42(ד) לחוק הירושה, או לבלבל בין הסדר ''יורש אחר יורש'' לבין ''יורש במקום יורש'' שאינו מוגבל במספר היורשים החלופיים.',
    '["יורש אחר יורש", "סעיף 42 לחוק הירושה", "סעיף 42(ד) לחוק הירושה", "צוואה בטלה", "שלטון המת על החי", "הוראה קוגנטית", "כשרות צוואה"]'::jsonb, '**וריאציה 1 — מגבלת יורש אחר יורש:** כמה יורשים ניתן לקבוע ב''יורש אחר יורש''? ← שניים, אלא אם היורשים הנוספים היו בחיים בעת עשיית הצוואה. סעיף 42(ד) לחוק הירושה, תשכ"ה-1965
**וריאציה 2 — תכלית המגבלה:** מדוע קיימת מגבלה זו? ← למנוע ''שלטון מתים'' ממושך על נכסים. רע"א 3130/05 יורשי המנוחה א. ר. ז"ל נ'' האפוטרופוס הכללי כמנהל עזבון המנוחה מ. ר. ז"ל (14.09.2006)
**וריאציה 3 — מצב הנכדים:** אם הנכדים לא היו בחיים בעת עריכת הצוואה, האם הוראה לטובתם כשרה? ← לא, הוראה כזו בטלה. נבו - המתמחה ירושה וברירת הדין | התיישנות | שטרות (2026) | יורש אחר יורש', 'הוראת צוואה ''יורש אחר יורש'' ליותר משני יורשים בטלה (ס'' 42(ד) לחוק הירושה), אלא אם כל היורשים הנוספים היו בחיים בעת עריכת הצוואה. במקרה זה, הנכדים לא היו בחיים, ולכן ההוראה בטלה.', '["חוק הירושה, תשכ\"ה-1965, סעיף 42", "חוק הירושה, תשכ\"ה-1965, סעיף 34", "רע\"א 3130/05 יורשי המנוחה א. ר. ז\"ל נ'' האפוטרופוס הכללי כמנהל עזבון המנוחה מ. ר. ז\"ל (14.09.2006)", "ע\"א 1182/90 דורית שחם נ'' מרים רוטמן (02.08.1992)", "ת\"ע (משפחה צפת) 10740-05-20 א''. ע'' נ'' האפוטרופוס הכללי מחוז חיפה והצפון משרדי ממשלה (30.07.2020)", "נבו - המתמחה, ירושה וברירת הדין | התיישנות | שטרות (2026), יורש אחר יורש"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''family_inheritance'' subtopic=''inheritance_will'' | classifier_note: Will provisions, ''יורש אחר יורש'' (heir-after-heir) clause | source_review_note: הנושא הוא דיני ירושה, ובפרט הוראות צוואה מסוג ''יורש אחר יורש''. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר מבין תתי-הנושאים הקיימים, אך יש לשקול הוספת ''דיני ירושה'' או ''צוואות'' כתת-נושא ייעודי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'הוראה הקובעת שאם בנו של המצווה לא יהיה בחיים בעת מותו של המצווה אזי בתו של המצווה תקבל את חלקו של הבן.', false, 'טענה זו מתארת הסדר של ''יורש במקום יורש'' (סעיף 41 לחוק הירושה), אשר כשר ואינו מוגבל במספר היורשים החלופיים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הוראה הקובעת כי בנו של המצווה יקבל את דירתו של המצווה מבלי שנקבעו הוראות בצוואה ביחס לשאר הנכסים של המצווה.', false, 'טענה זו כשרה, שכן מצווה רשאי לצוות על חלק מעזבונו (מנה), והיתרה תחולק על פי דין או צוואה אחרת.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'הוראה הקובעת שלאחר מות המצווה יירש בנו את עזבונו של המצווה ולאחר מות הבן יירש הנכד הבכור את עזבונו של המצווה ולאחר מות הנכד הבכור תירש הנכדה את הנותר מעיזבונו של המצווה.', true, 'תשובה זו נכונה, שכן היא מתארת הסדר של ''יורש אחר יורש'' ליותר משני יורשים (בן, נכד, נכדה), כאשר הנכדים לא היו בחיים בעת עריכת הצוואה, וזאת בניגוד לסעיף 42(ד) לחוק הירושה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הוראה הקובעת שאם בנו של המצווה לא יגור בעת פטירת המצווה במדינת ישראל אזי בתו של המצווה תקבל את חלקו של הבן.', false, 'טענה זו כשרה, שכן מצווה רשאי לקבוע תנאים לזכייה בצוואה, כל עוד הם אינם בלתי חוקיים, בלתי מוסריים או בלתי אפשריים (סעיף 34 לחוק הירושה).', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 33, '2024-W-S-Q33';
END
$$;

-- ============================================================
-- Q34 — 2024-W-S-Q34 — chapter=contracts subtopic=sale
-- classifier_note: Electric-car sale, classification of obligations (כפול/מותנה)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '1feec435-4666-4ea1-a6b5-245d2d7ce85d'::uuid;
  v_group_id uuid := '208d2fe1-465c-4582-b200-2c77395cc308'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q34';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 34, '2024-W-S-Q34';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'sale' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'sale', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q34', v_chapter_id, v_subtopic_id, 'יאיר העמיד את הרכב החשמלי החדש שרכש למכירה. בתאריך 15.10.2023 חתם יאיר על הסכם עם שכנו דורון, ולפיו דורון ירכוש את הרכב תמורת סך של 200,000 ש"ח. במועד ההסכם שילם דורון מקדמה בסך של 100,000 ש"ח על חשבון התמורה ובהסכם נקבע כי היתרה בסך של 100,000 ש"ח תשולם על ידי דורון ביום 15.11.2023 שנקבע כיום מסירת הרכב. לאחר שחלף המועד למסירת הרכב ולמרות פניות חוזרות ונשנות של דורון ליאיר, מותיר יאיר את הרכב בידיו ולא מעבירו לדורון. האם על דורון לשלם את יתרת התמורה טרם שנמסר לו הרכב?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 34}'::jsonb, 'השאלה עוסקת בסיווג חיובים חוזיים, ובפרט בחיובים שלובים (מקבילים), כפי שנקבעו בחוק החוזים (חלק כללי) ובחוק המכר. היא בוחנת את זכותו של צד לחוזה לדחות את קיום חיובו כאשר הצד השני אינו מוכן לקיים את חיובו המקביל, ואת הנפקות המשפטית של סיווג זה על חובת הקיום של הצדדים.', 'בחיובים חוזיים, מקובל להבחין בין שלושה סוגים: חיובים עצמאיים, חיובים מותנים וחיובים שלובים (או מקבילים). ע"א 7938/08 היאלי מונסנגו נ'' מוריס מכביאן (11.08.2011) חיובים שלובים הם חיובים נגדיים בחוזה הדדי שיש לקיימם בד בבד, כאשר ביצוע החיוב על ידי צד אחד הוא תנאי, מבחינת השלב והמועד, לביצועו של החיוב על ידי הצד השני. גבריאלה שלו ואפי צמח דיני חוזים (2019) | פרק 18 חיובים בחוזה הדדי
סעיף 23 לחוק המכר, תשכ"ח-1968, קובע במפורש כי חובת המוכר למסור את הממכר וחובת הקונה לשלם את מחירו הם חיובים מקבילים שיש לקיימם בד בבד. סעיף 23 לחוק המכר, תשכ"ח-1968 הוראה זו היא דיספוזיטיבית, כלומר, הצדדים רשאים להתנות עליה בחוזה. ע"א 7938/08 היאלי מונסנגו נ'' מוריס מכביאן (11.08.2011)
במקרה הנדון, נקבע בהסכם כי יתרת התמורה תשולם ביום מסירת הרכב, מה שמעיד על כוונה לחיובים שלובים. ע"א 348/81 מנדל גלמן ובנו בע"מ, חברה קבלנית לבנין נ'' הנלורה טובול (05.11.1984) סעיף 43(א)(3) לחוק החוזים קובע כי כאשר על הצדדים לקיים חיוביהם בד בבד, המועד לקיומו של חיוב נדחה כל עוד הנושה אינו מוכן לקיים את החיוב המוטל עליו. סעיף 43(א)(3) לחוק החוזים (חלק כללי), תשל"ג-1973 לפיכך, מכיוון שיאיר לא מסר את הרכב, דורון אינו חייב לשלם את יתרת התמורה, ומועד התשלום נדחה עד שיאיר יהיה מוכן לקיים את חיובו. ע"א 765/82 משה אלתר נ'' יחזקאל אלעני (21.06.1984)', 'הטעות הנפוצה היא לחשוב שחיובים בחוזה הם תמיד עצמאיים, וכי אי-קיום חיוב על ידי צד אחד אינו פוטר את הצד השני מקיום חיובו, גם כאשר מדובר בחיובים שלובים.',
    '["חיובים שלובים", "חיובים מקבילים", "דחיית קיום", "סעיף 43 לחוק החוזים", "סעיף 23 לחוק המכר", "נכונות לקיים", "הפרת חוזה"]'::jsonb, '**וריאציה 1 — סיווג חיובים:** מהם חיובים שלובים? ← חיובים הדדיים שיש לקיימם בד בבד. גבריאלה שלו ואפי צמח דיני חוזים (2019) | פרק 18 חיובים בחוזה הדדי
**וריאציה 2 — חוק המכר:** האם תשלום ומסירה בחוזה מכר הם חיובים שלובים? ← כן, כברירת מחדל לפי סעיף 23 לחוק המכר. סעיף 23 לחוק המכר, תשכ"ח-1968
**וריאציה 3 — נפקות אי-קיום:** מה קורה אם צד אחד אינו מוכן לקיים חיוב שלוב? ← הצד השני רשאי לדחות את קיום חיובו שלו. סעיף 43(א)(3) לחוק החוזים (חלק כללי), תשל"ג-1973', 'בחוזה מכר, תשלום ומסירה הם חיובים שלובים (ס'' 23 לחוק המכר). אם המוכר לא מוסר, הקונה אינו חייב לשלם ומועד התשלום נדחה (ס'' 43(א)(3) לחוק החוזים).', '["חוק החוזים (חלק כללי), תשל\"ג-1973, סעיף 43", "חוק המכר, תשכ\"ח-1968, סעיף 23", "ע\"א 8316/21 אדלטק אחזקות (2006) בע\"מ נ'' קבוצת עמוס לוזון יזמות ואנרגיה בע\"מ (14.08.2024)", "ע\"א 7938/08 היאלי מונסנגו נ'' מוריס מכביאן (11.08.2011)", "ע\"א 765/82 משה אלתר נ'' יחזקאל אלעני (21.06.1984)", "ע\"א 348/81 מנדל גלמן ובנו בע\"מ, חברה קבלנית לבנין נ'' הנלורה טובול (05.11.1984)", "גבריאלה שלו ואפי צמח, דיני חוזים (2019), פרק 18 חיובים בחוזה הדדי"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''sale'' | classifier_note: Electric-car sale, classification of obligations (כפול/מותנה) | source_review_note: השאלה עוסקת בדיני חוזים, סיווג חיובים. ''הליכים'' בסדר דין אזרחי הוא הקרוב ביותר מבין תתי-הנושאים הקיימים, אך יש לשקול הוספת ''דיני חוזים'' או ''סיווג חיובים'' כתת-נושא ייעודי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'דורון אינו חייב לשלם את יתרת התמורה ליאיר כל עוד לא נמסר לו הרכב.', true, 'תשובה זו נכונה, שכן חובת המוכר למסור את הממכר וחובת הקונה לשלם את מחירו הם חיובים שלובים, ולכן דורון רשאי לדחות את קיום חיובו כל עוד יאיר אינו מוכן לקיים את חיובו.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'דורון חייב לשלם לאלתר את יתרת התמורה ליאיר, מאחר שחלף המועד לתשלום יתרת התמורה לפי ההסכם.', false, 'טענה זו שגויה, שכן מועד התשלום נדחה כאשר מדובר בחיובים שלובים והצד השני אינו מוכן לקיים את חיובו, גם אם חלף המועד המקורי.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'דורון חייב לשלם את יתרת התמורה במועד שיבחר קודם להגשת תובענה למסירת הרכב כנגד יאיר, והדבר מהווה תנאי להגשת כתב התביעה.', false, 'טענה זו שגויה, שכן דורון אינו חייב לקיים את חיובו לפני הגשת תביעה, אלא עליו להראות נכונות לקיים את חיובו כדי לתבוע אכיפה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'דורון חייב לשלם את יתרת התמורה בתוך 30 ימים ממועד הגשת התובענה למסירת הרכב נגד יאיר.', false, 'טענה זו שגויה, שכן אין הוראת חוק או פסיקה הקובעת מועד כזה לתשלום במקרה של חיובים שלובים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 34, '2024-W-S-Q34';
END
$$;

-- ============================================================
-- Q35 — 2024-W-S-Q35 — chapter=contracts subtopic=general_part  [needs_review]
-- classifier_note: Elderly woman injured in road accident, compensation for care — TORT (נזיקין / פלת'ד) is the real subject; no substantive tort subtopic exists. Defaulted to contracts/general_part as the closest civil-obligations umbrella.
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'd097338b-5076-4a94-a256-9e68f0a1cd16'::uuid;
  v_group_id uuid := 'b9fdb735-e2d1-4a5a-85a7-80e03097a715'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q35';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 35, '2024-W-S-Q35';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'contracts';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'contracts';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'general_part' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'general_part', 'contracts';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q35', v_chapter_id, v_subtopic_id, 'יהודית, אישה קשישה, נפגעה בתאונת דרכים עת נהגה ברכבה. עד מועד התאונה היתה יהודית עצמאית לחלוטין ולא נזקקה לעזרה. בעקבות התאונה יהודית מרותקת למיטתה ונזקקת לעזרה של מטפלת. יהודית אינה יכולה מבחינה כספית לעמוד בתשלומים השוטפים למטפלת. באיזה הליך עליה לנקוט תחילה כדי לקבל מימון מיידי לצורך התשלום למטפלת?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 35}'::jsonb, 'השאלה עוסקת בהליך המקדמי לקבלת תשלום תכוף (מקדמה) לנפגע תאונת דרכים, בהתאם לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975. היא בוחנת את השלב הראשון והחיוני בהליך זה, שהוא הגשת דרישה בכתב לחברת הביטוח, בטרם פנייה לבית המשפט, וזאת על מנת לספק מענה מהיר לצרכים חיוניים של הנפגע.', 'חוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975 (להלן: "חוק הפלת"ד"), קובע מנגנון מיוחד למתן תשלומים תכופים לנפגעים. תכליתו של מוסד התשלום התכוף היא הושטת סיוע ראשוני, מהיר וזמני לנפגע או לתלויים בו, וזאת עד למתן פסק הדין בתביעתו לפיצויים. ת"א (שלום חי'') 67238-03-18 פלוני נ'' כלל חברה לביטוח בע"מ (24.07.2018)
ההליך לקבלת תשלום תכוף מתחיל בהגשת דרישה בכתב לחברת הביטוח (החייב בפיצויים). סעיף 5(ב) לחוק הפלת"ד קובע כי "מי שחייב בפיצויים לפי חוק זה ישלם, כחלק מהם, לנפגע או למי מהתלויים בו, תוך 60 ימים מקבלת דרישתו בכתב". סעיף 5(ב) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975 דרישה זו צריכה להיות ערוכה לפי טופס 1 שבתוספת לתקנות פיצויים לנפגעי תאונות דרכים (תשלומים תכופים), תשמ"ט-1989, ונתמכת בתצהירו של הפונה. בש"א (שלום רמלה) 1408/04 רונן אליזבט נ'' מגדל חב'' לביטוח בע"מ (09.06.2004)
רק לאחר שחלפו 60 ימים מיום הגשת הדרישה לחברת הביטוח, והדורש לא קיבל את התשלום, רשאי הנפגע להגיש בקשה לתשלום תכוף לבית המשפט. בש"א (שלום ירושלים) 3818/03 אמזלג דוד נ'' מנורה חברה לביטוח בע"מ (08.08.2003) במקרה של יהודית, הצורך במימון מיידי למטפלת הוא צורך סיעודי חיוני, המהווה חלק מצרכי הריפוי, הסיעוד והמחיה המכוסים בתשלום תכוף. ת"א (שלום י-ם) 54847-11-13 יצחק נחום נ'' כלל חברה לביטוח בע"מ (29.06.2015) לפיכך, עליה לנקוט תחילה בהליך של הגשת דרישה לתשלום תכוף לחברת הביטוח.', 'הטעות הנפוצה היא לפנות ישירות לבית המשפט בבקשה לתשלום תכוף, מבלי להקדים דרישה לחברת הביטוח, ובכך לדלג על השלב הפרוצדורלי החיוני הקבוע בחוק.',
    '["תשלום תכוף", "חוק פיצויים לנפגעי תאונות דרכים", "דרישה לתשלום תכוף", "חברת ביטוח", "צרכי סיעוד", "הליך דו-שלבי"]'::jsonb, '**וריאציה 1 — השלב הראשון:** מהו השלב הראשון לקבלת תשלום תכוף? ← הגשת דרישה בכתב לחברת הביטוח. סעיף 5(ב) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975
**וריאציה 2 — מטרת הדרישה:** למה נועדה הדרישה לחברת הביטוח? ← לאפשר לה לבחון את הנושא ולהעריך את עמדתה. בש"א (שלום רמלה) 1408/04 רונן אליזבט נ'' מגדל חב'' לביטוח בע"מ (09.06.2004)
**וריאציה 3 — צרכי סיעוד:** האם צרכי סיעוד נכללים בתשלום תכוף? ← כן, כחלק מצרכי הריפוי, הסיעוד והמחיה. סעיף 5(ב)(2) לחוק פיצויים לנפגעי תאונות דרכים, תשל"ה-1975', 'קבלת תשלום תכוף ← תחילה דרישה בכתב לחברת הביטוח (ס'' 5(ב) לחוק הפלת"ד) ← המתנה 60 ימים ← רק אז פנייה לבית המשפט.', '["חוק פיצויים לנפגעי תאונות דרכים, תשל\"ה-1975, סעיף 5", "חוק פיצויים לנפגעי תאונות דרכים, תשל\"ה-1975, סעיף 5א(א)", "תקנות פיצויים לנפגעי תאונות דרכים (תשלומים תכופים), תשמ\"ט-1989, תקנה 2(א)", "ת\"א (שלום י-ם) 54847-11-13 יצחק נחום נ'' כלל חברה לביטוח בע\"מ (29.06.2015)", "ת\"א (שלום חי'') 67238-03-18 פלוני נ'' כלל חברה לביטוח בע\"מ (24.07.2018)", "בש\"א (שלום רמלה) 1408/04 רונן אליזבט נ'' מגדל חב'' לביטוח בע\"מ (09.06.2004)", "בש\"א (שלום ירושלים) 3818/03 אמזלג דוד נ'' מנורה חברה לביטוח בע\"מ (08.08.2003)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''contracts'' subtopic=''general_part'' | classifier_note: Elderly woman injured in road accident, compensation for care — TORT (נזיקין / פלת''ד) is the real subject; no substantive tort subtopic exists. Defaulted to contracts/general_part as the closest civil-obligations umbrella.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'הגשת בקשה לתשלום תכוף לבית המשפט.', false, 'טענה זו שגויה, שכן הגשת בקשה לבית המשפט היא השלב השני בהליך, וקודם לה יש להגיש דרישה לחברת הביטוח.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הגשת דרישה לתשלום תכוף לחברת הביטוח שביטחה את השימוש ברכב על פי פקודת ביטוח רכב מנועי (נוסח חדש), התש"ל-1970.', true, 'תשובה זו נכונה, שכן סעיף 5(ב) לחוק פיצויים לנפגעי תאונות דרכים קובע כי השלב הראשון לקבלת תשלום תכוף הוא הגשת דרישה בכתב לחברת הביטוח.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'הגשת בקשה לתשלום עיתי לבית המשפט.', false, 'טענה זו שגויה, שכן תשלום עיתי הוא סעד הנפסק במסגרת פסק דין סופי, ואינו מיועד למתן סיוע מיידי ודחוף לנפגע.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הגשת דרישה לתשלום עיתי לחברת הביטוח שביטחה את השימוש ברכב על פי פקודת ביטוח רכב מנועי (נוסח חדש), התש"ל-1970.', false, 'טענה זו שגויה, שכן תשלום עיתי הוא סעד הנפסק במסגרת פסק דין סופי, ואינו מיועד למתן סיוע מיידי ודחוף לנפגע, ואין הליך של ''דרישה לתשלום עיתי'' לחברת הביטוח.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 35, '2024-W-S-Q35';
END
$$;

-- ============================================================
-- Q36 — 2024-W-S-Q36 — chapter=property subtopic=condominiums
-- classifier_note: Condominium, roof-tarring expenses, owner shares
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'b155704d-79cc-48fb-bce8-2aff05610a7c'::uuid;
  v_group_id uuid := '2fcb962e-4182-4b49-9245-57f64d569df6'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q36';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 36, '2024-W-S-Q36';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'property';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'property';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'condominiums' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'condominiums', 'property';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q36', v_chapter_id, v_subtopic_id, 'נציגות בית משותף מעוניינת בזיפות הגג המשותף, שנדרש לשם מניעת חדירת מים מהגג לדירה שבקומה העליונה. בבית המשותף 6 דירות: 3 דירות קטנות בקומת הקרקע בגודל רצפה של 60 מ"ר כל אחת, 2 דירות בינוניות בקומה האמצעית בגודל רצפה של 90 מ"ר כל אחת ודירה אחת גדולה בגודל רצפה של 180 מ"ר בקומה העליונה שמתחת לגג המשותף. בהיעדר קביעה אחרת בתקנון הבית המשותף, כיצד יחולק התשלום עבור הזיפות בין בעלי הדירות?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 36}'::jsonb, 'השאלה עוסקת בחובת בעלי דירות בבית משותף להשתתף בהוצאות הדרושות להחזקה תקינה וניהול הרכוש המשותף, כפי שקבוע בסעיף 58(א) לחוק המקרקעין. היא בוחנת את ברירת המחדל החוקית לחלוקת הוצאות אלה, שהיא לפי יחס שטח רצפת הדירה לשטח הרצפה של כל הדירות, בהיעדר קביעה אחרת בתקנון הבית המשותף.', 'סעיף 58(א) לחוק המקרקעין, תשכ"ט-1969, קובע את החובה החלה על כל בעל דירה בבית משותף להשתתף בהוצאות הדרושות להחזקתו התקינה ולניהולו של הרכוש המשותף. סעיף 58(א) לחוק המקרקעין, תשכ"ט-1969 חובה זו היא מוחלטת ובת אכיפה, ואינה נתונה לשיקול דעתו של בעל הדירה. המפקח על המקרקעין תל אביב-יפו 451/20 נציגות הבית המשותף ברחוב חברה חדשה 5 תל אביב נ'' ז. צסוואן השקעות בע"מ (14.04.2021)
באשר לשיעור ההשתתפות, סעיף 58(א) קובע כי הוא יהיה "לפי יחס שטח רצפת דירתו אל שטח הרצפה של כל הדירות שבבית המשותף, זולת אם נקבע בתקנון שיעור השתתפות אחר". סעיף 58(א) לחוק המקרקעין, תשכ"ט-1969 במקרה הנדון, אין קביעה אחרת בתקנון, ולכן יש לחשב את החלק היחסי של כל דירה לפי שטח הרצפה שלה. המפקח על המקרקעין עכו 28/23 נציגות הבית המשותף ברח'' ויצמן 14, עכו נ'' סבינה בע"מ (06.06.2024)
חישוב:
שטח כולל של הדירות: (3 דירות * 60 מ"ר) + (2 דירות * 90 מ"ר) + (1 דירה * 180 מ"ר) = 180 + 180 + 180 = 540 מ"ר.
חלק דירה קטנה: 60/540 = 1/9.
חלק דירה בינונית: 90/540 = 1/6.
חלק דירה גדולה: 180/540 = 1/3.
לפיכך, התשובה הנכונה היא א''.', 'הטעות הנפוצה היא לחשוב שחלוקת הוצאות הרכוש המשותף נעשית תמיד באופן שווה בין כל הדירות, או שהיא נתונה לשיקול דעת האסיפה הכללית ברוב רגיל, מבלי להתחשב בברירת המחדל החוקית או בקביעות תקנוניות.',
    '["חוק המקרקעין", "סעיף 58(א)", "בית משותף", "רכוש משותף", "הוצאות החזקה", "שטח רצפה", "תקנון מוסכם", "ברירת מחדל חוקית"]'::jsonb, '**וריאציה 1 — ברירת מחדל חוקית:** כיצד מחשבים הוצאות רכוש משותף בהיעדר תקנון? ← לפי יחס שטח רצפת הדירה לשטח הרצפה של כל הדירות. סעיף 58(א) לחוק המקרקעין, תשכ"ט-1969
**וריאציה 2 — תכלית החובה:** מהי תכלית חובת התשלום? ← להבטיח החזקה תקינה וניהול רציף של הרכוש המשותף. המפקח על המקרקעין תל אביב-יפו 451/20 נציגות הבית המשותף ברחוב חברה חדשה 5 תל אביב נ'' ז. צסוואן השקעות בע"מ (14.04.2021)
**וריאציה 3 — חובה מוחלטת:** האם החובה לתשלום נתונה לשיקול דעת בעל הדירה? ← לא, זו חובה מוחלטת בת אכיפה. המפקח על המקרקעין תל אביב-יפו 451/20 נציגות הבית המשותף ברחוב חברה חדשה 5 תל אביב נ'' ז. צסוואן השקעות בע"מ (14.04.2021)', 'הוצאות רכוש משותף ← ברירת מחדל (בהיעדר תקנון) ← לפי יחס שטח רצפה (ס'' 58(א) לחוק המקרקעין).', '["חוק המקרקעין, תשכ\"ט-1969, סעיף 58(א)", "(המפקח על המקרקעין פתח תקוה) 213/19 נציגות הבית המשותף ברחוב התע\"ש 26 כפר סבא נ'' ספאמדן בע\"מ (30.09.2020)", "(המפקח על המקרקעין תל אביב-יפו) 451/20 נציגות הבית המשותף ברחוב חברה חדשה 5 תל אביב נ'' ז. צסוואן השקעות בע\"מ (14.04.2021)", "(המפקח על המקרקעין עכו) 28/23 נציגות הבית המשותף ברח'' ויצמן 14, עכו נ'' סבינה בע\"מ (06.06.2024)"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הסדר מקרקעין'' → mapped chapter=''property'' subtopic=''condominiums'' | classifier_note: Condominium, roof-tarring expenses, owner shares | source_review_note: השאלה עוסקת בדיני מקרקעין, ובפרט בתים משותפים והוצאות רכוש משותף. ''הסדר מקרקעין'' בסדר דין אזרחי הוא הקרוב ביותר מבין תתי-הנושאים הקיימים, אך יש לשקול הוספת ''דיני מקרקעין'' או ''בתים משותפים'' כתת-נושא ייעודי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בעלי דירה קטנה ישלם 1/9 מהתשלום, בעלי דירה בינונית ישלם 1/6 מהתשלום ובעלי הדירה הגדולה ישלם 1/3 מהתשלום.', true, 'תשובה זו נכונה, שכן בהיעדר תקנון, חלוקת ההוצאות נעשית לפי יחס שטח רצפת הדירה לשטח הרצפה של כל הדירות בבית המשותף, כקבוע בסעיף 58(א) לחוק המקרקעין.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כל בעלי דירה ישלם 1/6 מהתשלום.', false, 'טענה זו שגויה, שכן חלוקה שווה בין כל הדירות מתקיימת רק אם נקבעה במפורש בתקנון או בהחלטה פה אחד של כל בעלי הדירות, ואינה ברירת המחדל החוקית.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בעלי הדירה הגדולה ישלם את מלוא התשלום.', false, 'טענה זו שגויה, שכן גם אם הליקוי משפיע בעיקר על דירה אחת, זיפות הגג הוא הוצאה לרכוש המשותף, וכל בעלי הדירות חייבים להשתתף בה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'יש חובה לקיים אסיפה כללית של כל הדיירים ובסמכותה לקבוע ברוב קולות כיצד יחולק התשלום.', false, 'טענה זו שגויה, שכן בהיעדר תקנון, חלוקת ההוצאות קבועה בחוק, ושינוי ממנה דורש הסכמה פה אחד של כל בעלי הדירות אם הוא מטיל חובות או תשלומים מסוג או שיעור שלא פורשו בחוק או בתקנון.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 36, '2024-W-S-Q36';
END
$$;

-- ============================================================
-- Q37 — 2024-W-S-Q37 — chapter=ethics subtopic=fiduciary_privilege_conflict  [needs_review]
-- classifier_note: Family-law lawyer + client disclosure (אלימות במשפחה) — ethics privilege/conflict; could also fit ethics/disciplinary_law
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '80fd1973-34a2-42d2-8239-957738f775c2'::uuid;
  v_group_id uuid := 'd1509947-989a-4f4a-b303-e65c37e04bc1'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q37';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 37, '2024-W-S-Q37';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'ethics';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'ethics';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fiduciary_privilege_conflict' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fiduciary_privilege_conflict', 'ethics';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q37', v_chapter_id, v_subtopic_id, 'עמיר הוא עו"ד ותיק בתחום דיני המשפחה ובעלי משרד הממוקם בתל-אביב. אל משרדו הגיע בבוקר יום ראשון שחר, שהתלונן בפניו בסודיות על אלימות שחווה מצד אשתו בביתם המשותף. עמיר יידע באופן מיידי את שחר על אפשרותו לפנות לגורמי הטיפול לקבלת סיוע, ותיעד בכתב את היידוע. על מנת לוודא שהסיוע יינתן לשחר במהירות האפשרית, עמיר העביר את פרטי האירוע לחברתו הקרובה, אשר עובדת במחלקה לשירותים חברתיים. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 37}'::jsonb, 'השאלה עוסקת בחובותיו האתיות של עורך דין, ובפרט בחובת הסודיות ובחובה ליידע לקוח על אפשרויות סיוע במקרים של אלימות במשפחה. היא בוחנת את היחס בין הכללים למניעת אלימות במשפחה (יידוע בידי עורכי דין) לבין כלל 19 לכללי לשכת עורכי הדין (אתיקה מקצועית), המטיל חובת סודיות רחבה על עורך הדין.', 'הכללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס"ג-2002, קובעים כי עורך דין שנדרש ליידע אדם לפי הוראות סעיף 11א(ב) לחוק למניעת אלימות במשפחה, חייב ליידע את האדם על כך שבאפשרותו לפנות לגורמי טיפול לקבלת סיוע, ולתת לו כתובות ומספרי טלפון של גורמי הטיפול. כללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס"ג-2002, תקנה 2 עורך הדין חייב גם לתעד בכתב את פעולות היידוע שביצע. כללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס"ג-2002, תקנה 3 במקרה הנדון, עמיר פעל כדין כשיידע את שחר ותיעד זאת. נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | הקדמה
עם זאת, תקנה 4 לכללים למניעת אלימות במשפחה קובעת כי "אין בכללים אלה כדי לגרוע מסעיף 19 לכללי לשכת עורכי הדין (אתיקה מקצועית), התשמ"ו-1986". כללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס"ג-2002, תקנה 4 כלל 19 לכללי האתיקה מטיל על עורך הדין חובת סודיות רחבה, לפיה "עורך דין ישמור בסוד כל דבר שיובא לידיעתו בידי לקוח או מטעמו, תוך כדי מילוי תפקידיו, זולת אם הסכים הלקוח במפורש אחרת". כללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986, כלל 19 העברת פרטי האירוע לחברתו של עמיר, גם אם היא עובדת במחלקה לשירותים חברתיים, מהווה הפרה של חובת הסודיות האתית, שכן לא ניתנה הסכמתו המפורשת של שחר לכך. נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | שמירת סודיות', 'הטעות הנפוצה היא לחשוב שפעולה לטובת הלקוח, גם אם היא כרוכה במסירת מידע לגורם טיפולי, פוטרת את עורך הדין מחובת הסודיות האתית ללא הסכמת הלקוח.',
    '["חובת סודיות אתית", "כלל 19 לכללי האתיקה", "כללים למניעת אלימות במשפחה", "יידוע לקוח", "הסכמה מפורשת", "אתיקה מקצועית"]'::jsonb, '**וריאציה 1 — חובת יידוע:** האם עו"ד חייב ליידע לקוח על אפשרויות סיוע באלימות במשפחה? ← כן, לפי תקנה 2 לכללים למניעת אלימות במשפחה. כללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס"ג-2002, תקנה 2
**וריאציה 2 — חובת סודיות:** האם עו"ד רשאי למסור מידע לגורם טיפולי ללא הסכמת הלקוח? ← לא, זו הפרה של כלל 19 לכללי האתיקה. כללי לשכת עורכי הדין (אתיקה מקצועית), תשמ"ו-1986, כלל 19
**וריאציה 3 — תיעוד:** האם עו"ד חייב לתעד את היידוע? ← כן, לפי תקנה 3 לכללים למניעת אלימות במשפחה. כללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס"ג-2002, תקנה 3', 'עו"ד חייב ליידע לקוח על סיוע באלימות במשפחה ולתעד (תקנות 2-3 לכללים), אך אסור לו למסור פרטים לגורם חיצוני ללא הסכמת הלקוח (כלל 19 לאתיקה).', '["כללים למניעת אלימות במשפחה (יידוע בידי עורכי דין), תשס\"ג-2002, תקנות 2, 3, 4", "כללי לשכת עורכי הדין (אתיקה מקצועית), תשמ\"ו-1986, כלל 19", "נבו - המתמחה, אתיקה מקצועית - כללי האתיקה (2026), שמירת סודיות", "נבו - המתמחה, אתיקה מקצועית - כללי האתיקה (2026), הקדמה"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין פלילי'' subtopic=''משמעת עורכי דין'' → mapped chapter=''ethics'' subtopic=''fiduciary_privilege_conflict'' | classifier_note: Family-law lawyer + client disclosure (אלימות במשפחה) — ethics privilege/conflict; could also fit ethics/disciplinary_law | source_review_note: השאלה עוסקת באתיקה מקצועית של עורכי דין. ''משמעת עורכי דין'' בסדר דין פלילי הוא הקרוב ביותר מבין תתי-הנושאים הקיימים, אך יש לשקול הוספת ''אתיקה מקצועית'' כתת-נושא ייעודי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'עמיר פעל כדין כשיידע את שחר על אפשרותו לפנות לגורמי טיפול לקבלת סיוע, אך עבר על כללי האתיקה כשהעביר את פרטי האירוע לחברתו ללא הסכמתו המפורשת של שחר.', true, 'תשובה זו נכונה, שכן עמיר מילא את חובתו ליידע את שחר לפי הכללים למניעת אלימות במשפחה, אך הפר את חובת הסודיות האתית בכך שמסר מידע ללא הסכמת הלקוח.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'עמיר פעל כדין כשיידע את שחר על אפשרותו לפנות לגורמי טיפול לקבלת סיוע, ופעל כדין כשהעביר את פרטי האירוע לחברתו, שכן מדובר בעובדת של אחד מגורמי הסיוע המנויים בחוק.', false, 'טענה זו שגויה, שכן חובת הסודיות האתית אוסרת על עורך דין למסור מידע לכל גורם חיצוני, גם אם הוא גורם טיפול, ללא הסכמת הלקוח המפורשת.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'עמיר פעל שלא כדין כשיידע את שחר על אפשרותו לפנות לגורמי טיפול לקבלת סיוע. במקום זאת, היה עליו לדווח באופן מיידי על האירוע לגורמי הסיוע המנויים בחוק.', false, 'טענה זו שגויה, שכן הכללים למניעת אלימות במשפחה מחייבים יידוע הלקוח על אפשרויות סיוע, ולא דיווח מיידי של עורך הדין, למעט חריגים ספציפיים (כגון כוונה להתאבד).', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'עמיר פעל שלא כדין כשיידע את שחר על אפשרותו לפנות לגורמי טיפול לקבלת סיוע, אך פעל כדין כשהעביר את פרטי האירוע לחברתו במחלקה לשירותים חברתיים לצורך זירוז הטיפול.', false, 'טענה זו שגויה, שכן עמיר פעל כדין ביידוע הלקוח, אך הפר את חובת הסודיות האתית בכך שמסר מידע ללא הסכמת הלקוח המפורשת.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 37, '2024-W-S-Q37';
END
$$;

-- ============================================================
-- Q38 — 2024-W-S-Q38 — chapter=corporate subtopic=fiduciary_duties  [needs_review]
-- classifier_note: Vegetable-company case — exact angle unclear from question text alone (could be officer duties or shareholder rights)
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '85d702c5-9b02-4a17-9dd2-dd676d1c1a60'::uuid;
  v_group_id uuid := '96e42948-b1cb-4a4c-b11d-bd81c256f13a'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q38';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 38, '2024-W-S-Q38';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'corporate';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'corporate';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'fiduciary_duties' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'fiduciary_duties', 'corporate';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q38', v_chapter_id, v_subtopic_id, 'חברת "ירקות לכול" היא חברה המשווקת מארזי ירקות טריים לכל חלקי הארץ בזמינות משלוחים מיידית. המארזים קטנים ונוחים לנשיאה, והירקות שטופים ומוכנים לאכילה. לקראת תחילתה של שנה חדשה בחודש ינואר, הוחלט בחברה לתרום כ-5,000 מנות עבור עובדים בבתי חולים בכל רחבי הארץ, אשר התלוננו רבות כי אינם מספיקים לאכול ארוחות בריאות ומזינות. מדובר בסכום של כ-75,000 ש"ח. על פי דעתם של רוב חברי החברה, תרומה שכזו עשויה לשמח את העובדים ולהגביר את המודעות והחשיפה לאכילה בריאה ומאוזנת, דבר שאף עשוי להביא לעלייה במכירות. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 38}'::jsonb, 'השאלה עוסקת בתכלית החברה כפי שנקבעה בסעיף 11(א) לחוק החברות, תשנ"ט-1999. היא בוחנת את האפשרות של חברה לבצע תרומות, תוך הבחנה בין תרומה הנעשית במסגרת שיקולים עסקיים להשאת רווחים (אשר אינה דורשת הוראה בתקנון), לבין תרומה למטרה ראויה שאינה במסגרת שיקולים עסקיים (אשר דורשת הוראה בתקנון).', 'סעיף 11(א) לחוק החברות, תשנ"ט-1999, קובע כי "תכלית חברה היא לפעול על פי שיקולים עסקיים להשאת רווחיה, וניתן להביא בחשבון במסגרת שיקולים אלה, בין השאר, את עניניהם של נושיה, עובדיה ואת ענינו של הציבור". סעיף 11(א) לחוק החברות, תשנ"ט-1999
הוראה זו יוצרת היררכיה ברורה, לפיה השאת רווחים היא התכלית העסקית הראשית, ושיקולים עסקיים הם אלה המנחים את פעילותה של החברה. ע"א 8416/19 עו"ד שלמה נס ורו"ח אלי שפלר מפרקי חברת אגרקסקו חברה לייצור חקלאי בע"מ נ'' מדינת ישראל (22.12.2021) במסגרת שיקולים עסקיים אלה, ניתן להביא בחשבון גם את עניינם של נושים, עובדים והציבור. ע"פ 6790/18 משה טטרו נ'' מדינת ישראל (29.07.2020)
במקרה הנדון, החברה מעוניינת לתרום מארזי ירקות לעובדי בתי חולים, מתוך אמונה שתרומה זו "עשויה לשמח את העובדים ולהגביר את המודעות והחשיפה לאכילה בריאה ומאוזנת, דבר שאף עשוי להביא לעלייה במכירות". זוהר גושן אסף אקשטיין דיני חברות (2023) | פרק יב תכלית החברה מדובר, אפוא, בתרומה הנעשית במסגרת שיקולים עסקיים, מתוך ציפייה לתועלת עסקית עקיפה (עלייה במכירות). תרומה כזו, הנעשית במסגרת שיקולים עסקיים להשאת רווחים, אינה דורשת הוראה מפורשת בתקנון. צפורה כהן בעלי מניות בחברה - זכויות תביעה ותרופות - כרך א'' (2006) | פרק אחד־עשר הפרה חוזה', 'הטעות הנפוצה היא לבלבל בין תרומה הנעשית משיקולים עסקיים (שאינה דורשת הוראה בתקנון) לבין תרומה פילנתרופית טהורה (שדורשת הוראה בתקנון), ולחשוב שכל תרומה מחייבת הוראה בתקנון.',
    '["תכלית החברה", "סעיף 11(א) לחוק החברות", "שיקולים עסקיים", "השאת רווחים", "תרומה", "אינטרס הציבור"]'::jsonb, '**וריאציה 1 — תרומה עסקית:** האם תרומה משיקולים עסקיים דורשת הוראה בתקנון? ← לא, היא נכללת במסגרת שיקולים עסקיים להשאת רווחים. סעיף 11(א) לחוק החברות, תשנ"ט-1999
**וריאציה 2 — תרומה פילנתרופית:** האם תרומה ללא צידוק עסקי דורשת הוראה בתקנון? ← כן, אם היא בסכום סביר למטרה ראויה. סעיף 11(א) לחוק החברות, תשנ"ט-1999

**וריאציה 3 — היררכיה:** מהי ההיררכיה בין השאת רווחים לאינטרסים אחרים? ← השאת רווחים היא התכלית העיקרית, אינטרסים אחרים נשקלים במסגרת שיקולים עסקיים. ע"א 8416/19 עו"ד שלמה נס ורו"ח אלי שפלר מפרקי חברת אגרקסקו חברה לייצור חקלאי בע"מ נ'' מדינת ישראל (22.12.2021)', 'חברה רשאית לתרום משיקולים עסקיים להשאת רווחיה (ס'' 11(א) לחוק החברות) גם ללא הוראה בתקנון, שכן זה נכלל בתכליתה העסקית.', '["חוק החברות, תשנ\"ט-1999, סעיף 11(א)", "ע\"א 8416/19 עו\"ד שלמה נס ורו\"ח אלי שפלר מפרקי חברת אגרקסקו חברה לייצור חקלאי בע\"מ נ'' מדינת ישראל (22.12.2021)", "ע\"פ 6790/18 משה טטרו נ'' מדינת ישראל (29.07.2020)", "זוהר גושן אסף אקשטיין, דיני חברות (2023), פרק יב תכלית החברה, עמ'' 3", "צפורה כהן, בעלי מניות בחברה - זכויות תביעה ותרופות - כרך א'' (2006), פרק אחד־עשר הפרה חוזה, עמ'' 175"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הליכים'' → mapped chapter=''corporate'' subtopic=''fiduciary_duties'' | classifier_note: Vegetable-company case — exact angle unclear from question text alone (could be officer duties or shareholder rights) | source_review_note: השאלה עוסקת בדיני חברות, שהיא תחום מהותי. ''הליכים'' בסדר דין אזרחי הוא תת-הנושא הקרוב ביותר מבין הקיימים, אך יש לשקול הוספת ''דיני חברות'' כתת-נושא ייעודי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'החברה רשאית לתרום את הסכום הנתון רק אם התרומה היא במסגרת שיקולים עסקיים להשאת רווחיה ונקבעה לכך הוראה מפורשת בתקנון.', false, 'טענה זו שגויה, שכן תרומה במסגרת שיקולים עסקיים אינה דורשת הוראה מפורשת בתקנון, והיא מותרת גם אם אינה מביאה בוודאות להשאת רווחים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'החברה אינה רשאית לתרום את הסכום הנתון גם אילו נקבעה לכך הוראה מפורשת בתקנון, שכן אין מדובר בוודאות להשאת רווחיה.', false, 'טענה זו שגויה, שכן תרומה למטרה ראויה בסכום סביר מותרת גם אם אינה במסגרת שיקולים עסקיים, ובלבד שנקבעה לכך הוראה בתקנון.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'החברה רשאית ככלל לתרום עבור מטרה זו, אך היא אינה רשאית לתרום סכום כה גדול ללא הוראה מפורשת בתקנון.', false, 'טענה זו שגויה, שכן תרומה בסכום סביר למטרה ראויה, הנעשית במסגרת שיקולים עסקיים, אינה דורשת הוראה מפורשת בתקנון.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'החברה רשאית לתרום את הסכום הנתון למען המטרות שפורטו גם ללא הוראה מפורשת בתקנון.', true, 'תשובה זו נכונה, שכן סעיף 11(א) לחוק החברות מאפשר לחברה להביא בחשבון את עניינו של הציבור במסגרת שיקולים עסקיים להשאת רווחיה, ואין צורך בהוראה בתקנון לתרומה הנעשית מתוך שיקולים עסקיים.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 38, '2024-W-S-Q38';
END
$$;

-- ============================================================
-- Q39 — 2024-W-S-Q39 — chapter=property subtopic=real_estate
-- classifier_note: Easement (זיקת הנאה) over neighbor's land
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := '7614a6ed-4506-47a9-bf82-9ebe20584bcf'::uuid;
  v_group_id uuid := 'e6131149-8f20-4919-bc56-cf8026a4a731'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q39';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 39, '2024-W-S-Q39';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'property';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'property';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'real_estate' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'real_estate', 'property';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q39', v_chapter_id, v_subtopic_id, 'ירון ומיכל מתגוררים בחלקות סמוכות במרכז הארץ. בשל עבודות תשתית להקמת הרכבת הקלה בעיר, נחסם השביל לביתו של ירון. משכך, ירון סיכם עם מיכל כי יוכל להיכנס לביתו דרך השביל שעובר ברובו דרך הבית שלה למשך 3 שנים. עם חתימתו, רשם ירון את ההסכם אצל רשם המקרקעין. שנתיים לאחר חתימת ההסכם הסתכסכו מיכל וירון – והיא דרשה ממנו להפסיק לעבור דרך השביל המוביל לביתה. ירון דחה את דרישתה, והמשיך לעבור דרך השביל בביתה כדי להיכנס לביתו. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 39}'::jsonb, 'השאלה עוסקת בזיקת הנאה, שהיא זכות קניינית במקרקעין, ובאופן יצירתה וביטולה. היא בוחנת את ההבחנה בין זכות חוזית לזכות קניינית, את חשיבות הרישום במקרקעין, ואת סמכות בית המשפט לשנות או לבטל זיקת הנאה קיימת, גם אם היא רשומה, בהתאם לסעיפים 5, 7 ו-96 לחוק המקרקעין.', 'זיקת הנאה מוגדרת בסעיף 5 לחוק המקרקעין, תשכ"ט-1969, כ"שעבוד מקרקעין להנאה שאין עמו זכות להחזיק בהם". סעיף 5 לחוק המקרקעין, תשכ"ט-1969 זוהי זכות קניינית, כלומר זכות הפועלת כלפי כולי עלמא ולא רק כלפי הצדדים להסכם. יהושע ויסמן דיני קניין - החזקה ושימוש (2006) | 1, זיקת הנאה-מהי?
עסקה במקרקעין, לרבות יצירת זיקת הנאה, טעונה רישום, והיא נגמרת ברישום. עסקה שלא נגמרה ברישום רואים אותה כהתחייבות לעשות עסקה בלבד (סעיף 7 לחוק המקרקעין). סעיף 7 לחוק המקרקעין, תשכ"ט-1969 במקרה הנדון, ירון ומיכל חתמו על הסכם למעבר, וירון רשם את ההסכם אצל רשם המקרקעין. בכך הפכה הזכות לזיקת הנאה קניינית, ולא נותרה זכות חוזית בלבד. ת"א (מחוזי מרכז) 5791-06-16 שירן רחל נ'' גבריאל מנטין (15.08.2019)

אף על פי שזיקת הנאה היא זכות קניינית, סעיף 96 לחוק המקרקעין מקנה לבית המשפט סמכות לבטל את הזיקה או לשנות את תנאיה. סעיף 96 לחוק המקרקעין, תשכ"ט-1969 עילות הביטול או השינוי כוללות אי הפעלת הזיקה, או שינוי בנסיבות השימוש בה או במצב המקרקעין הזכאים או הכפופים. ת"א (שלום פ"ת) 55046-09-14 מרדכי ביסטרה נ'' עיריית יהוד מונוסון (11.06.2019) במקרה זה, הסכסוך בין מיכל לירון ודרישתה להפסיק את המעבר, עשויים להיחשב כשינוי נסיבות המצדיק פנייה לבית המשפט בבקשה לביטול או שינוי הזיקה. בית המשפט רשאי גם לפסוק פיצוי למי שנגרם לו נזק כתוצאה מהביטול או השינוי. סעיף 96 לחוק המקרקעין, תשכ"ט-1969', 'הטעות הנפוצה היא לראות בזיקת הנאה זכות חוזית בלבד, או לחשוב שזיקת הנאה רשומה היא זכות מוחלטת שאינה ניתנת לשינוי או ביטול על ידי בית המשפט.',
    '["זיקת הנאה", "זכות קניינית", "רישום במקרקעין", "סעיף 5 לחוק המקרקעין", "סעיף 7 לחוק המקרקעין", "סעיף 96 לחוק המקרקעין", "שינוי נסיבות", "ביטול זיקת הנאה"]'::jsonb, '**וריאציה 1 — מהות זיקת הנאה:** מהי זיקת הנאה? ← שעבוד מקרקעין להנאה שאין עמו זכות להחזיק בהם (ס'' 5 לחוק המקרקעין). סעיף 5 לחוק המקרקעין, תשכ"ט-1969
**וריאציה 2 — חשיבות הרישום:** מתי זיקת הנאה הופכת לקניינית? ← עם רישומה אצל רשם המקרקעין (ס'' 7 לחוק המקרקעין). סעיף 7 לחוק המקרקעין, תשכ"ט-1969
**וריאציה 3 — סמכות בית המשפט:** האם בית המשפט יכול לשנות זיקת הנאה רשומה? ← כן, עקב שינוי נסיבות או אי הפעלה (ס'' 96 לחוק המקרקעין). סעיף 96 לחוק המקרקעין, תשכ"ט-1969', 'הסכם לזיקת הנאה שנרשם (ס'' 7 לחוק המקרקעין) ← מקנה זכות קניינית (ס'' 5 לחוק המקרקעין) ← בית המשפט מוסמך לשנותה או לבטלה עקב שינוי נסיבות (ס'' 96 לחוק המקרקעין).', '["חוק המקרקעין, תשכ\"ט-1969, סעיפים 5, 7, 96", "ת\"א (מחוזי מרכז) 5791-06-16 שירן רחל נ'' גבריאל מנטין (15.08.2019)", "ת\"א (שלום פ\"ת) 55046-09-14 מרדכי ביסטרה נ'' עיריית יהוד מונוסון (11.06.2019)", "נבו - המתמחה, דיני קניין (2026), זיקת-הנאה, עמ'' 8", "יהושע ויסמן, דיני קניין - החזקה ושימוש (2006), שער חמישי: זיקת הנאה, עמ'' 1"]'::jsonb,
    'classification_review: original chapter=''סדר דין אזרחי'' subtopic=''הסדר מקרקעין'' → mapped chapter=''property'' subtopic=''real_estate'' | classifier_note: Easement (זיקת הנאה) over neighbor''s land | source_review_note: השאלה עוסקת בדיני מקרקעין, ובפרט זיקת הנאה. ''הסדר מקרקעין'' בסדר דין אזרחי הוא הקרוב ביותר מבין תתי-הנושאים הקיימים, אך יש לשקול הוספת ''דיני מקרקעין'' או ''זיקת הנאה'' כתת-נושא ייעודי.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ירון פולש למקרקעין של מיכל, באפשרותה לפנות למשטרה ולתבוע את ירון לקבלת סעד כספי.', false, 'טענה זו שגויה, שכן רישום ההסכם אצל רשם המקרקעין הקנה לירון זכות קניינית, ולכן הוא אינו פולש.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הסכסוך בין מיכל וירון הוא הפרה יסודית של ההסכם ביניהם והוא מבוטל.', false, 'טענה זו שגויה, שכן רישום זיקת ההנאה הופך אותה לזכות קניינית, שאינה ניתנת לביטול חד-צדדי כהפרת חוזה רגילה, אלא רק על ידי בית המשפט.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ירון פולש למקרקעין של מיכל, ובאפשרותה להגיש תביעה לסילוק יד.', false, 'טענה זו שגויה, שכן רישום ההסכם הקנה לירון זכות קניינית במקרקעין, ולכן הוא אינו פולש ומיכל אינה יכולה לדרוש סילוק יד באופן מיידי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לירון יש זכות קניינית למעבר לביתו, אך בית המשפט מוסמך לשנותה.', true, 'תשובה זו נכונה, שכן רישום זיקת ההנאה הופך אותה לזכות קניינית, ובית המשפט מוסמך לשנות או לבטל זיקת הנאה עקב שינוי נסיבות, גם אם היא לתקופה מוגבלת.', 4);

  RAISE NOTICE 'Q% inserted: external_id %', 39, '2024-W-S-Q39';
END
$$;

-- ============================================================
-- Q40 — 2024-W-S-Q40 — chapter=administrative subtopic=reasonableness_proportionality  [needs_review]
-- classifier_note: Constitutional rights restriction (freedom of occupation / movement). 'Constitutional law' has no substantive home; admin/proportionality is the closest doctrinal fit.
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := 'a955788e-6911-4be8-aa58-4a254cc93a5d'::uuid;
  v_group_id uuid := '56fa3c42-1af4-49b1-88f0-1e0b43f124a4'::uuid;
  v_chapter_id uuid;
  v_subtopic_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-S-Q40';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q% skipped: external_id % already exists', 40, '2024-W-S-Q40';
    RETURN;
  END IF;

  SELECT id INTO v_chapter_id FROM public.chapters WHERE code = 'administrative';
  IF v_chapter_id IS NULL THEN
    RAISE EXCEPTION 'Chapter code % not found', 'administrative';
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'reasonableness_proportionality' AND chapter_id = v_chapter_id;
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found under chapter %', 'reasonableness_proportionality', 'administrative';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id, question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills, quick_thinking_360, summary_for_memory, references_list, notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-S-Q40', v_chapter_id, v_subtopic_id, 'ג''יין, אחות מוסמכת מאוניברסיטה אמריקאית, הגיעה כתיירת לביקור בישראל על רקע התעניינותה ביהדות. רעות, אזרחית ישראל, חברתה הטובה של ג''יין, ביקשה ממנה לסייע בטיפול בסבתא תמורת שכר במהלך ביקורה בפריז לשבוע. בתום השבוע, הגיעו ג''יין והסבתא לאסוף את רעות משדה-התעופה, אולם שוטרים שגילו את עניין העסקתה של ג''יין ללא אישורים, הגיעו לשדה-התעופה ועיכבו אותה לתחקור. לצד זאת, מנעו את כניסתה של רעות לישראל עד השלמת החקירה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 40}'::jsonb, 'השאלה עוסקת בזכויות יסוד חוקתיות, ובפרט בחופש העיסוק ובחופש התנועה, תוך הבחנה בין אזרחים לבין מי שאינם אזרחים. היא בוחנת את היקף ההגנה על זכויות אלו ואת סמכות המדינה להגבילן, בהתאם לחוקי היסוד ולחקיקה הרלוונטית, כגון חוק הכניסה לישראל.', 'השאלה מורכבת משני חלקים עיקריים: מעמדה של ג''יין (תיירת) ומעמדה של רעות (אזרחית).
**לגבי ג''יין:** חופש העיסוק מעוגן בסעיף 3 לחוק יסוד: חופש העיסוק, הקובע כי "כל אזרח או תושב של המדינה זכאי לעסוק בכל עיסוק, מקצוע או משלח יד". חוק יסוד: חופש העיסוק, סעיף 3 ג''יין היא תיירת, כלומר אינה אזרחית או תושבת. לכן, חופש העיסוק אינו מוקנה לה באופן מלא, והיא כפופה לדיני העבודה וההגירה בישראל, המחייבים קבלת היתר עבודה. העסקתה ללא אישורים מהווה עבירה על חוק הכניסה לישראל וחוק עובדים זרים. חוק הכניסה לישראל, תשי"ב-1952, סעיף 1 לפיכך, מותר למנוע את העסקתה ולעכב אותה לתחקור.
**לגבי רעות:** חופש התנועה, ובכלל זה הזכות להיכנס לישראל, מעוגן בסעיף 6 לחוק יסוד: כבוד האדם וחירותו, הקובע כי "כל אזרח ותושב של המדינה חופשי להיכנס לישראל". חוק יסוד: כבוד האדם וחירותו, סעיף 6 זכות זו היא זכות יסוד חוקתית, וניתן להגבילה רק בחוק ההולם את ערכיה של מדינת ישראל, שנועד לתכלית ראויה, ובמידה שאינה עולה על הנדרש (פסקת ההגבלה, סעיף 8 לחוק יסוד: כבוד האדם וחירותו). חוק יסוד: כבוד האדם וחירותו, סעיף 8 מניעת כניסתה של רעות לישראל עד השלמת חקירה בעניין העסקתה הבלתי חוקית של ג''יין, אינה עומדת בתנאים מחמירים אלו. אין חוק המאפשר מניעת כניסת אזרחית לישראל בשל חשד לעבירה שאינה מסכנת את ביטחון המדינה או שלום הציבור באופן מיידי, וגם אם הייתה הסמכה כזו, ספק אם היא הייתה עומדת במבחן המידתיות. רע"א 41402-12-24 יוסף גרנות נ'' רמת רזיאל כפר שתופי של תנועת חירות בית"ר בע"מ (09.11.2025)', 'הטעות הנפוצה היא לבלבל בין זכויותיהם של אזרחים לבין זכויותיהם של מי שאינם אזרחים, ולהחיל את אותם כללים על שתי הקבוצות, או להתעלם מהדרישות המחמירות להגבלת זכויות יסוד חוקתיות.',
    '["חופש העיסוק", "חופש התנועה", "חוק יסוד: כבוד האדם וחירותו", "חוק יסוד: חופש העיסוק", "פסקת ההגבלה", "אזרח מול תייר", "חוק הכניסה לישראל", "היתר עבודה"]'::jsonb, '**וריאציה 1 — חופש עיסוק לתייר:** האם תייר נהנה מחופש העיסוק בישראל? ← לא, חופש העיסוק מוקנה לאזרח או תושב בלבד (ס'' 3 לחוק יסוד: חופש העיסוק). חוק יסוד: חופש העיסוק, סעיף 3
**וריאציה 2 — זכות כניסה לאזרח:** האם ניתן למנוע כניסת אזרח לישראל? ← לא, זו זכות יסוד (ס'' 6 לחוק יסוד: כבוד האדם וחירותו), הגבלתה דורשת חוק העומד בפסקת ההגבלה. חוק יסוד: כבוד האדם וחירותו, סעיף 6
**וריאציה 3 — הגבלת זכויות יסוד:** מהם תנאי פסקת ההגבלה? ← בחוק, הולם את ערכי המדינה, לתכלית ראויה, ובמידה שאינה עולה על הנדרש (ס'' 8 לחוק יסוד: כבוד האדם וחירותו). חוק יסוד: כבוד האדם וחירותו, סעיף 8', 'ג''יין (תיירת) ← אין חופש עיסוק ללא אישור. רעות (אזרחית) ← זכות כניסה לישראל היא זכות יסוד, הגבלתה דורשת חוק העומד בפסקת ההגבלה.', '["חוק יסוד: חופש העיסוק, סעיף 3", "חוק יסוד: כבוד האדם וחירותו, סעיפים 6, 8", "חוק הכניסה לישראל, תשי\"ב-1952, סעיף 1", "רע\"א 41402-12-24 יוסף גרנות נ'' רמת רזיאל כפר שתופי של תנועת חירות בית\"ר בע\"מ (09.11.2025)"]'::jsonb,
    'needs_review=true | classification_review: original chapter=''חוקתי + בינלאומי פרטי'' subtopic=''ביטול סמכות בג"ץ'' → mapped chapter=''administrative'' subtopic=''reasonableness_proportionality'' | classifier_note: Constitutional rights restriction (freedom of occupation / movement). ''Constitutional law'' has no substantive home; admin/proportionality is the closest doctrinal fit. | source_review_note: השאלה עוסקת בזכויות יסוד חוקתיות (חופש העיסוק, חופש התנועה) והגבלתן. תת-הנושא ''ביטול סמכות בג"ץ'' אינו מתאים באופן ישיר, אך הוא הקרוב ביותר מבין האפשרויות הקיימות תחת פרק ''חוקתי + בינלאומי פרטי''. יש לשקול הוספת תת-נושאים רלוונטיים יותר לדיני זכויות יסוד.', 'active', 'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'מותר למנוע את העסקתה של ג''יין בישראל, אך אסור למנוע את כניסתה של רעות לישראל.', true, 'תשובה זו נכונה, שכן חופש העיסוק של ג''יין כתיירת מוגבל על פי חוק, אך זכותה של רעות כאזרחית להיכנס לישראל היא זכות יסוד שאינה ניתנת למניעה באופן שרירותי.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'ג''יין אחות מוסמכת ואסור לפגוע בחופש העיסוק שלה, אולם רעות הפרה את החוק ומוצדק לעכב את כניסתה לישראל.', false, 'טענה זו שגויה, שכן חופש העיסוק של ג''יין אינו מוחלט ומוגבל על פי דיני העבודה וההגירה, ואילו מניעת כניסתה של רעות כאזרחית לישראל אינה מוצדקת.', 0);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'השוטרים פעלו כדין.', false, 'טענה זו שגויה, שכן בעוד שעיכובה של ג''יין לתחקור עשוי להיות כדין, מניעת כניסתה של רעות כאזרחית לישראל אינה עומדת בדרישות החוקתיות.', 0);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ג''יין אחות מוסמכת ואסור לפגוע בחופש העיסוק שלה. עיכובה של רעות מחוץ לישראל נעשה שלא כדין.', false, 'טענה זו שגויה בחלקה הראשון, שכן חופש העיסוק של ג''יין כתיירת מוגבל, אך נכונה בחלקה השני לגבי רעות.', 0);

  RAISE NOTICE 'Q% inserted: external_id %', 40, '2024-W-S-Q40';
END
$$;
-- ============================================================
-- Record this migration in Supabase's schema_migrations registry.
-- Idempotent: ON CONFLICT DO NOTHING in case the file is re-applied.
-- ============================================================
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260526000002', 'add_2024_winter_substantive_q1_to_q28')
ON CONFLICT (version) DO NOTHING;
