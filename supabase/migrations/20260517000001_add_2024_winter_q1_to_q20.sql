-- Migration: add_2024_winter_q1_to_q20
--
-- Source: Sharon's batch — winter 2024 (פברואר 2024), part 2 (חלק ב'),
-- questions Q1-Q20. 20 questions, additive.
--
-- 4 mechanical fixes applied per the established pipeline
-- (commit 3cf2fb0): PENDING→real external_id, Hebrew-abbrev
-- quote escape, display_analysis-typo / bogus distractor cleanup,
-- source_metadata fill. This batch's docx carried STALE
-- source_metadata (exam_year=2019, exam_season="summer") from a
-- copy-paste template — overwritten from EXAM_CONTEXT.
--
-- Subtopic resolution: autonomous against the 33-code closed list.
-- Exact match preferred; chapter-scoped fuzzy match falls back
-- with needs_review=true + subtopic_mapping_review note.
--
-- Idempotency: each DO $$ block checks for the external_id and
-- early-returns (RAISE NOTICE) if it already exists. Safe to
-- re-run; previously-loaded questions skip with a notice.

-- ============================================================
-- Q1 — 2024-W-Q1 — chapter=criminal_proc subtopic=search_seizure
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q1';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q1 skipped: external_id % already exists', '2024-W-Q1';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'search_seizure';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'search_seizure';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q1', 'e4a16014-22c7-4653-bf0d-89ff4bb34c20', v_subtopic_id,
    'משטרת ישראל הגישה לבית משפט השלום בקשה לצו חדירה לחומר מחשב של חשוד שנתפס בידי המשטרה. במעמד מי יתקיים הדיון בבקשה?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 1}'::jsonb,
    'שאלה זו עוסקת בסדרי הדיון בבקשה למתן צו חדירה לחומר מחשב, שהוא כלי חקירתי פולשני במיוחד. היא בוחנת את הכלל בדבר דיון במעמד צד אחד ואת החריג המאפשר דיון במעמד שני הצדדים בנסיבות מיוחדות, תוך איזון בין צורכי החקירה לזכות לפרטיות.',
    'סעיף 23א(א) לפקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ"ט-1969, קובע כי הדיון בבקשה למתן צו חדירה לחומר מחשב יתקיים במעמד צד אחד – של המשטרה המבקשת. זאת, על מנת למנוע שיבוש הליכי חקירה או העלמת ראיות. עם זאת, הסעיף קובע חריג: אם בית המשפט מצא, בנסיבות מיוחדות, כי יש לקיים את הדיון במעמד שני הצדדים, הוא רשאי להורות על כך. פסיקת בית המשפט העליון, בדנ"פ 4072/21 שמעון נ'' מדינת ישראל, הבהירה כי נסיבות מיוחדות אלו יתקיימו כאשר אין חשש ממשי לשיבוש הליכי חקירה או להעלמת ראיות, וקיימת פגיעה חמורה בזכויות החשוד או צד שלישי.',
    'טעות נפוצה היא להניח שכל דיון בבית משפט חייב להתקיים במעמד שני הצדדים, או לחילופין, שדיון במעמד צד אחד הוא מוחלט ואין ממנו חריגים. יש לזכור את האיזון העדין בין צורכי החקירה לזכויות הפרט.',
    '["צו חדירה למחשב", "דיון במעמד צד אחד", "דיון במעמד שני צדדים", "נסיבות מיוחדות", "פקודת סדר הדין הפלילי (מעצר וחיפוש)", "זכות לפרטיות"]'::jsonb,
    '**וריאציה 1 — כלל הדיון:** במעמד מי מתקיים דיון בבקשה לצו חדירה למחשב? ← במעמד צד אחד – המשטרה המבקשת (ס'' 23א(א) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 2 — חריג לכלל:** מתי יתקיים דיון במעמד שני הצדדים? ← בנסיבות מיוחדות, לפי שיקול דעת בית המשפט (ס'' 23א(א) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 3 — תכלית החריג:** מהן אותן ''נסיבות מיוחדות''? ← כאשר אין חשש לשיבוש חקירה וקיימת פגיעה חמורה בזכויות (דנ"פ 4072/21).',
    'צו חדירה למחשב ← דיון במעמד צד אחד ככלל ← חריג: דיון דו-צדדי בנסיבות מיוחדות (אין חשש לשיבוש + פגיעה חמורה).',
    '["פקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ\"ט-1969, סעיף 23א", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 3", "דנ\"פ 4072/21 שמעון נ'' מדינת ישראל"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'רק במעמד צד אחד – של המשטרה המבקשת.', false, 'תשובה זו אינה מדויקת שכן היא מתעלמת מהחריג המאפשר דיון במעמד שני הצדדים בנסיבות מיוחדות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'תמיד במעמד שני הצדדים – המשטרה והחשוד.', false, 'תשובה זו שגויה, שכן הכלל הוא דיון במעמד צד אחד, והדיון הדו-צדדי הוא החריג.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'במעמד צד אחד - של המשטרה המבקשת, אלא אם בית המשפט מצא, בנסיבות מיוחדות, כי יש לקיים את הדיון במעמד שני הצדדים.', true, 'זו התשובה הנכונה, המשקפת את הכלל והחריג הקבועים בחוק לעניין דיון בבקשה לצו חדירה לחומר מחשב.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ללא נוכחות הצדדים.', false, 'תשובה זו אינה נכונה, שכן הדיון מתקיים במעמד המשטרה המבקשת, גם אם החשוד אינו נוכח.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'תנאים למתן צו חדירה למחשב', 1, 'ראובן חשוד בעבירת סחיטה באיומים. המשטרה מבקשת צו חדירה למחשב נייד שנתפס ברשותו. מהם התנאים העיקריים שבית המשפט יבחן בטרם ייתן את הצו?',
    'שאלה זו עוסקת בתנאים המהותיים למתן צו חדירה לחומר מחשב, המהווה פגיעה משמעותית בפרטיות. בית המשפט נדרש לאזן בין צורכי החקירה לבין זכויות הפרט, ולבחון קיומם של מספר תנאים מצטברים.',
    'סעיף 23א(א) לפקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ"ט-1969, קובע כי שופט רשאי לתת צו חדירה לחומר מחשב אם שוכנע כי קיים חשד סביר לביצוע עבירה. בנוסף, סעיף 23א(ב) דורש כי השופט ישתכנע שהצו נחוץ לחקירה וכי היקפו מידתי למטרת החקירה. תנאים אלו מבטיחים כי הפגיעה בפרטיות תהיה מוצדקת ומינימלית ככל האפשר.',
    'טעות נפוצה היא להתמקד רק בתנאי של ''חשד סביר'' ולהתעלם מהדרישות הנוספות של נחיצות ומידתיות, שהן קריטיות במיוחד בהקשר של חיפוש בחומר מחשב.',
    '["צו חדירה למחשב", "חשד סביר", "נחיצות", "מידתיות", "פגיעה בפרטיות", "פקודת סדר הדין הפלילי (מעצר וחיפוש)"]'::jsonb,
    '**וריאציה 1 — תנאי יסוד:** מהו התנאי הבסיסי למתן צו חדירה למחשב? ← חשד סביר לביצוע עבירה (ס'' 23א(א) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 2 — שיקולים נוספים:** אילו שיקולים נוספים בוחן בית המשפט? ← נחיצות הצו לחקירה ומידתיות היקפו (ס'' 23א(ב) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 3 — איזון אינטרסים:** מהו האיזון שבית המשפט נדרש לבצע? ← בין צורכי החקירה לבין הפגיעה בזכות לפרטיות (דנ"פ 4072/21).',
    'צו חדירה למחשב ← דורש חשד סביר + נחיצות + מידתיות.',
    '["פקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ\"ט-1969, סעיף 23א", "דנ\"פ 4072/21 שמעון נ'' מדינת ישראל"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'עילות לדיון במעמד שני הצדדים', 2, 'באילו נסיבות מיוחדות עשוי בית המשפט להורות על קיום דיון במעמד שני הצדדים בבקשה למתן צו חדירה למחשב, בניגוד לכלל?',
    'שאלה זו בוחנת את ההבנה של החריג לכלל הדיון במעמד צד אחד בבקשות לצו חדירה למחשב. היא מתמקדת בשיקולים המנחים את בית המשפט בהחלטתו לקיים דיון דו-צדדי, תוך איזון בין אינטרס הציבור בחקירת עבירות לבין זכויות הפרט.',
    'סעיף 23א(א) לפקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ"ט-1969, קובע כי הדיון בבקשה לצו חדירה לחומר מחשב יתקיים במעמד צד אחד, אלא אם בית המשפט מצא, בנסיבות מיוחדות, כי יש לקיים את הדיון במעמד שני הצדדים. הפסיקה, ובפרט דנ"פ 4072/21 שמעון נ'' מדינת ישראל, הבהירה כי ''נסיבות מיוחדות'' אלו יתקיימו כאשר אין חשש ממשי לשיבוש הליכי חקירה או להעלמת ראיות, וקיימת פגיעה חמורה בזכויות החשוד או צד שלישי, המצדיקה מתן זכות טיעון.',
    'סטודנטים עלולים להתבלבל בין השיקולים הכלליים של הגינות דיונית לבין הקריטריונים הספציפיים והמצומצמים המצדיקים דיון דו-צדדי בבקשה כה רגישה, שנועדה במקור למנוע שיבוש.',
    '["דיון במעמד צד אחד", "דיון במעמד שני צדדים", "נסיבות מיוחדות", "שיבוש הליכי חקירה", "פגיעה בזכויות", "איזון אינטרסים"]'::jsonb,
    '**וריאציה 1 — כלל:** מהו הכלל לעניין דיון בצו חדירה למחשב? ← במעמד צד אחד (ס'' 23א(א) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 2 — חריג:** מתי יתקיים דיון דו-צדדי? ← בנסיבות מיוחדות, כשיש פגיעה חמורה ואין חשש לשיבוש (דנ"פ 4072/21). **וריאציה 3 — תכלית:** מהי תכלית הדיון במעמד צד אחד? ← מניעת שיבוש חקירה והעלמת ראיות (דנ"פ 4072/21).',
    'דיון דו-צדדי בצו חדירה ← חריג לכלל ← רק בנסיבות מיוחדות (אין חשש לשיבוש + פגיעה חמורה).',
    '["פקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ\"ט-1969, סעיף 23א", "דנ\"פ 4072/21 שמעון נ'' מדינת ישראל"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'סמכות בית המשפט המוסמך', 3, 'המשטרה מבקשת צו חדירה למחשב של חשוד בעבירת סמים חמורה, אך המחשב נמצא בביתו של צד שלישי שאינו חשוד. האם בית משפט השלום מוסמך לדון בבקשה זו?',
    'שאלה זו עוסקת בסמכות העניינית של בית המשפט לדון בבקשות לצו חדירה לחומר מחשב, ובפרט במקרים בהם המחשב נמצא ברשות צד שלישי שאינו חשוד. היא בוחנת את היקף הסמכות ואת השיקולים הנוספים במקרים אלו.',
    'סעיף 23א(א) לפקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ"ט-1969, קובע כי שופט של בית משפט שלום או בית משפט מחוזי רשאי לתת צו חדירה לחומר מחשב. סמכות זו אינה מוגבלת למחשבים הנמצאים ברשות החשוד בלבד, אלא חלה גם על מחשבים הנמצאים ברשות צד שלישי, ובלבד שמתקיימים התנאים המהותיים למתן הצו (חשד סביר, נחיצות ומידתיות). הפגיעה בפרטיות של צד שלישי תיבחן במסגרת שיקולי המידתיות.',
    'סטודנטים עלולים לחשוב שמעורבות צד שלישי או חומרת העבירה משנה את הסמכות העניינית של בית המשפט, או דורשת הסכמה, בעוד שהחוק מקנה סמכות לשופט שלום או מחוזי ללא קשר לזהות המחזיק במחשב.',
    '["סמכות עניינית", "צו חדירה למחשב", "צד שלישי", "פקודת סדר הדין הפלילי (מעצר וחיפוש)", "פגיעה בפרטיות"]'::jsonb,
    '**וריאציה 1 — סמכות כללית:** מי מוסמך לתת צו חדירה למחשב? ← שופט שלום או מחוזי (ס'' 23א(א) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 2 — צד שלישי:** האם סמכות זו חלה גם על מחשב של צד שלישי? ← כן, בכפוף לתנאי הצו (ס'' 23א(א) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 3 — שיקול נוסף:** מה נבחן במקרה של צד שלישי? ← מידתיות הפגיעה בפרטיותו (דנ"פ 4072/21).',
    'סמכות לצו חדירה ← שופט שלום/מחוזי ← גם למחשב של צד שלישי, בכפוף לתנאים.',
    '["פקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ\"ט-1969, סעיף 23א", "דנ\"פ 4072/21 שמעון נ'' מדינת ישראל"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'סעדים כנגד צו חדירה למחשב', 4, 'לאחר שניתן צו חדירה למחשב של חשוד, ובוצע חיפוש בחומר המחשב, החשוד מעוניין לערער על הצו. מהו הסעד העיקרי העומד לרשותו?',
    'שאלה זו עוסקת בסעדים העומדים לרשות חשוד או צד שלישי שנפגע מצו חדירה לחומר מחשב. היא בוחנת את המסלול הדיוני לערעור על החלטת בית המשפט שנתן את הצו, ומדגישה את חשיבות זכות הערר.',
    'סעיף 23א(ה) לפקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ"ט-1969, קובע מפורשות כי על החלטת שופט בעניין צו חדירה לחומר מחשב ניתן לערור לבית המשפט המחוזי. זכות הערר ניתנת הן למבקש הצו (המשטרה) והן למי שנפגע מהצו (החשוד או צד שלישי). זהו הסעד הדיוני העיקרי לבחינה מחודשת של הצו על ידי ערכאה גבוהה יותר.',
    'סטודנטים עלולים להתבלבל בין סעדים דיוניים (ערר/ערעור) לבין סעדים מהותיים (ביטול הצו) או סעדים אזרחיים, או לטעות בערכאה המוסמכת לדון בערר.',
    '["צו חדירה למחשב", "ערר", "סעדים דיוניים", "בית המשפט המחוזי", "פקודת סדר הדין הפלילי (מעצר וחיפוש)"]'::jsonb,
    '**וריאציה 1 — סעד עיקרי:** מהו הסעד העיקרי נגד צו חדירה למחשב? ← הגשת ערר (ס'' 23א(ה) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 2 — ערכאת הערר:** לאיזו ערכאה מוגש הערר? ← לבית המשפט המחוזי (ס'' 23א(ה) לפקודת סד"פ (מעצר וחיפוש)). **וריאציה 3 — זכות עמידה:** מי רשאי לערור? ← המבקש (המשטרה) ומי שנפגע מהצו (חשוד/צד שלישי) (ס'' 23א(ה) לפקודת סד"פ (מעצר וחיפוש)).',
    'ערעור על צו חדירה למחשב ← באמצעות ערר ← לבית המשפט המחוזי.',
    '["פקודת סדר הדין הפלילי (מעצר וחיפוש) [נוסח חדש], תשכ\"ט-1969, סעיף 23א"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'קיומו של חשד סביר בלבד לביצוע עבירה.', false, 'חשד סביר הוא תנאי הכרחי אך לא מספיק למתן צו חדירה למחשב, ויש לבחון גם נחיצות ומידתיות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'היות הצו נחוץ לחקירה בלבד, ללא קשר לחשד סביר.', false, 'נחיצות היא תנאי חשוב, אך היא מצטרפת לתנאי של חשד סביר ולא באה במקומו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'קיומו של חשד סביר לביצוע עבירה, והיות הצו נחוץ לחקירה ומידתי בהיקפו.', true, 'זו התשובה הנכונה, המשלבת את שלושת התנאים המצטברים הנדרשים למתן צו חדירה לחומר מחשב: חשד סביר, נחיצות ומידתיות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'שיקול דעתו הבלעדי של בית המשפט, ללא תנאים מוגדרים בחוק.', false, 'שיקול הדעת של בית המשפט מוגבל ומונחה על ידי התנאים הקבועים בחוק.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'רק אם החשוד מבקש זאת במפורש.', false, 'בקשת החשוד אינה מחייבת את בית המשפט לקיים דיון דו-צדדי, אלא זו נתונה לשיקול דעתו בנסיבות מיוחדות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'כאשר אין חשש ממשי לשיבוש הליכי חקירה או להעלמת ראיות, וקיימת פגיעה חמורה בזכויות החשוד או צד שלישי.', true, 'זו התשובה הנכונה, המבטאת את האיזון בין מניעת שיבוש חקירה לבין הגנה על זכויות הפרט, המצדיק דיון דו-צדדי במקרים חריגים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'רק אם המחשב שייך לצד שלישי שאינו חשוד.', false, 'היות המחשב שייך לצד שלישי הוא שיקול רלוונטי, אך אינו התנאי הבלעדי או המחייב לדיון דו-צדדי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'רק אם חומר המחשב אינו רגיש במיוחד.', false, 'רגישות החומר היא שיקול במידתיות הצו, אך לא בהכרח עילה לדיון דו-צדדי, שכן גם חומר לא רגיש יכול להיות מושמד.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, בית משפט השלום מוסמך לדון בבקשה, גם אם המחשב נמצא ברשות צד שלישי, ובלבד שהצו עומד בתנאי החוק.', true, 'זו התשובה הנכונה. סמכות בית משפט השלום אינה מוגבלת על ידי מיקום המחשב או בעלותו, כל עוד מתקיימים תנאי החוק למתן הצו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, רק אם צד שלישי מסכים לחיפוש.', false, 'הסכמת צד שלישי אינה תנאי לסמכות בית המשפט או למתן צו חיפוש, אלא הצו עצמו מאפשר את החיפוש גם ללא הסכמה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'לא, רק אם העבירה בוצעה באמצעות המחשב הספציפי הזה.', false, 'הקשר בין העבירה למחשב הוא תנאי מהותי למתן הצו, אך אינו שולל את סמכות בית המשפט לדון בבקשה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, רק בית המשפט המחוזי מוסמך לדון בבקשות לצו חדירה למחשב כאשר מעורב צד שלישי.', false, 'סמכות בית משפט השלום כוללת דיון בבקשות לצו חדירה למחשב, ואין דרישה לסמכות בית המשפט המחוזי במקרה של צד שלישי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'הגשת בקשה לביטול הצו לבית המשפט שנתן אותו.', false, 'בקשה לביטול הצו היא סעד אפשרי, אך הסעד העיקרי לערעור על החלטת שופט הוא ערר או ערעור לערכאה גבוהה יותר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'הגשת ערר על הצו לבית המשפט המחוזי.', true, 'זו התשובה הנכונה. סעיף 23א(ה) לפקודת סדר הדין הפלילי (מעצר וחיפוש) קובע מפורשות את זכות הערר על צו חדירה לחומר מחשב.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'הגשת תביעה אזרחית נגד המשטרה בגין פגיעה בפרטיות.', false, 'תביעה אזרחית היא סעד נפרד ונלווה, שאינו מהווה ערעור על תוקף הצו עצמו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'הגשת בקשה לעיכוב ביצוע הצו לבית המשפט העליון.', false, 'בית המשפט העליון אינו הערכאה הראשונה לערעור על צו כזה, ועיכוב ביצוע רלוונטי לפני ביצוע הצו, לא אחריו.', 4);

END $$;

-- ============================================================
-- Q3 — 2024-W-Q3 — chapter=criminal_proc subtopic=lawyer_discipline
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q3';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q3 skipped: external_id % already exists', '2024-W-Q3';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lawyer_discipline';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'lawyer_discipline';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q3', 'e4a16014-22c7-4653-bf0d-89ff4bb34c20', v_subtopic_id,
    'מהו המועד להגשת ערעור לבית הדין המשמעתי הארצי של לשכת עורכי הדין על פסק דינו של בית הדין המשמעתי המחוזי ולמי הסמכות ליתן הארכת מועד, ככל שתידרש?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 3}'::jsonb,
    'שאלה זו עוסקת בסדרי הדין המשמעתיים בלשכת עורכי הדין, ובפרט במועדים להגשת ערעור על פסק דינו של בית הדין המשמעתי המחוזי לבית הדין המשמעתי הארצי, וכן בסמכות להארכת מועד. היא בוחנת את ההוראות הספציפיות הקבועות בכללי לשכת עורכי הדין.',
    'סעיף 57(א) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015, קובע כי ערעור על פסק דין של בית דין משמעתי מחוזי יוגש לבית הדין המשמעתי הארצי תוך 30 ימים מיום המצאת פסק הדין למערער. סעיף 57(ג) לאותם כללים קובע כי יושב ראש בית הדין המשמעתי הארצי רשאי, מטעמים מיוחדים שיירשמו, להאריך את המועד להגשת הערעור. הוראות אלו מבטיחות זכות ערעור תוך שמירה על יעילות ההליך המשמעתי.',
    'טעות נפוצה היא לבלבל בין מועד הערעור על פסק דין (30 ימים) לבין מועד הערעור על ''החלטה אחרת'' (10 ימים), או לטעות בזיהוי הגורם המוסמך להארכת מועד.',
    '["ערעור משמעתי", "לשכת עורכי הדין", "בית הדין המשמעתי הארצי", "בית הדין המשמעתי המחוזי", "מועדי ערעור", "הארכת מועד", "כללי לשכת עורכי הדין"]'::jsonb,
    '**וריאציה 1 — מועד ערעור:** מהו המועד להגשת ערעור על פסק דין משמעתי מחוזי? ← 30 ימים מיום המצאת פסק הדין (ס'' 57(א) לכללים). **וריאציה 2 — סמכות הארכה:** מי מוסמך להאריך מועד לערעור? ← יושב ראש בית הדין המשמעתי הארצי (ס'' 57(ג) לכללים). **וריאציה 3 — עילת הארכה:** באילו תנאים ניתן להאריך מועד? ← מטעמים מיוחדים שיירשמו (ס'' 57(ג) לכללים).',
    'ערעור על פסק דין משמעתי מחוזי ← 30 יום מיום המצאה ← הארכת מועד ע"י יו"ר הארצי.',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015, סעיף 57"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', '30 ימים מיום מתן פסק הדין בבית הדין המשמעתי המחוזי. בקשה להארכת מועד תוגש ליושב ראש בית הדין המשמעתי המחוזי.', false, 'תשובה זו שגויה הן לגבי מניין הימים (מיום מתן פסק הדין ולא מיום המצאתו) והן לגבי הגורם המוסמך להארכת מועד.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', '45 ימים מיום מתן פסק הדין בבית הדין המשמעתי המחוזי. בקשה להארכת מועד תוגש לבית המשפט המחוזי.', false, 'תשובה זו שגויה הן לגבי מניין הימים (45 ימים במקום 30) והן לגבי הגורם המוסמך להארכת מועד (בית המשפט המחוזי במקום יו"ר בית הדין המשמעתי הארצי).', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', '45 ימים מיום המצאת פסק הדין של בית הדין המשמעתי המחוזי. בקשה להארכת מועד תוגש ליושב ראש בית הדין המשמעתי המחוזי או ליושב ראש בית הדין המשמעתי הארצי.', false, 'תשובה זו שגויה לגבי מניין הימים (45 ימים במקום 30) ולגבי הגורם המוסמך להארכת מועד (יו"ר בית הדין המחוזי אינו מוסמך).', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', '30 ימים מיום המצאת פסק הדין של בית הדין המשמעתי המחוזי. בקשה להארכת מועד תוגש ליושב ראש בית הדין המשמעתי הארצי.', true, 'זו התשובה הנכונה, המשקפת במדויק את הוראות סעיף 57 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'מועד הגשת ערעור על החלטה אחרת', 1, 'עורך הדין דניאל הורשע בעבירת משמעת בבית הדין המשמעתי המחוזי, ונגזר עליו עונש השעיה. בנוסף, בית הדין המחוזי דחה בקשה שהגיש דניאל לעיכוב ביצוע העונש. מהו המועד להגשת ערעור על החלטת בית הדין המחוזי לדחות את הבקשה לעיכוב ביצוע, ולמי הסמכות ליתן הארכת מועד?',
    'שאלה זו עוסקת במועדים להגשת ערעור על ''החלטה אחרת'' של בית הדין המשמעתי המחוזי, בניגוד לפסק דין סופי. היא מדגישה את ההבחנה בין סוגי ההחלטות ואת המועדים השונים הקבועים בחוק.',
    'סעיף 57(א) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015, קובע כי ערעור על פסק דין יוגש תוך 30 ימים מיום המצאתו. לעומת זאת, סעיף 57(ב) קובע כי על ''החלטה אחרת'' של בית הדין המחוזי, ניתן לערער תוך 10 ימים מיום המצאתה. בשני המקרים, הסמכות להארכת מועד נתונה ליושב ראש בית הדין המשמעתי הארצי, בהתאם לסעיף 57(ג) לכללים.',
    'טעות נפוצה היא להחיל את מועד הערעור על פסק דין (30 ימים) גם על ''החלטה אחרת'', מבלי לשים לב להבחנה הקבועה בכללים ולמועד הקצר יותר (10 ימים) להחלטות אחרות.',
    '["ערעור משמעתי", "החלטה אחרת", "מועדי ערעור", "הארכת מועד", "לשכת עורכי הדין", "סדרי דין משמעתיים"]'::jsonb,
    '**וריאציה 1 — פסק דין:** מהו מועד הערעור על פסק דין? ← 30 ימים מיום המצאה (ס'' 57(א) לכללים). **וריאציה 2 — החלטה אחרת:** מהו מועד הערעור על החלטה אחרת? ← 10 ימים מיום המצאה (ס'' 57(ב) לכללים). **וריאציה 3 — הארכת מועד:** מי מוסמך להאריך מועד בשני המקרים? ← יו"ר בית הדין המשמעתי הארצי (ס'' 57(ג) לכללים).',
    'ערעור על פסק דין ← 30 יום; ערעור על החלטה אחרת ← 10 יום ← הארכת מועד ע"י יו"ר הארצי.',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015, סעיף 57"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'שיקולי הארכת מועד לערעור', 2, 'עורך הדין יצחק הגיש ערעור לבית הדין המשמעתי הארצי באיחור של שבוע, בטענה כי היה חולה ולא יכול היה להגיש את הערעור במועד. מהם השיקולים העיקריים שיושב ראש בית הדין המשמעתי הארצי יבחן בבואו להחליט אם להאריך את המועד להגשת הערעור?',
    'שאלה זו עוסקת בשיקולים המנחים את בית הדין המשמעתי הארצי בבואו להחליט על הארכת מועד להגשת ערעור. היא בוחנת את המבחנים שנקבעו בפסיקה לעניין ''טעם מיוחד'' המצדיק סטייה ממועדי החוק.',
    'סעיף 57(ג) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015, קובע כי יושב ראש בית הדין המשמעתי הארצי רשאי להאריך את המועד להגשת ערעור ''מטעמים מיוחדים שיירשמו''. הפסיקה פירשה ''טעמים מיוחדים'' אלו כמכלול שיקולים, הכוללים את סיבת האיחור, משך האיחור, סיכויי הערעור ומידת הפגיעה בצד שכנגד. יש לבחון את כלל הנסיבות במקרה הספציפי.',
    'סטודנטים עלולים להתמקד בשיקול אחד בלבד (למשל, סיבת האיחור) במקום לבחון את מכלול השיקולים המצטברים והמשלימים זה את זה, כפי שנקבע בפסיקה לעניין הארכת מועד.',
    '["הארכת מועד", "טעמים מיוחדים", "שיקול דעת שיפוטי", "סיכויי ערעור", "פגיעה בצד שכנגד", "סדרי דין משמעתיים"]'::jsonb,
    '**וריאציה 1 — סמכות:** מי מוסמך להאריך מועד לערעור? ← יו"ר בית הדין המשמעתי הארצי (ס'' 57(ג) לכללים). **וריאציה 2 — עילה:** מהי העילה להארכת מועד? ← ''טעמים מיוחדים שיירשמו'' (ס'' 57(ג) לכללים). **וריאציה 3 — שיקולים:** מהם השיקולים ל''טעמים מיוחדים''? ← סיבת האיחור, משך האיחור, סיכויי הערעור, פגיעה בצד שכנגד (פסיקה).',
    'הארכת מועד לערעור ← יו"ר הארצי ← ''טעמים מיוחדים'' (סיבה, משך, סיכויים, פגיעה).',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015, סעיף 57"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'ערעור על החלטה בעניין סעד זמני', 3, 'עורך הדין משה הגיש בקשה לבית הדין המשמעתי המחוזי למתן צו מניעה זמני כנגד פרסום מידע אודותיו. בית הדין המחוזי דחה את בקשתו. מהו המועד להגשת ערעור על החלטה זו, ומהי הערכאה המוסמכת לדון בערעור?',
    'שאלה זו בוחנת את ההבנה לגבי סיווג החלטות בעניין סעדים זמניים בבתי הדין המשמעתיים, ואת מועדי הערעור והערכאה המוסמכת לדון בהן. היא מדגישה את ההבדל בין פסק דין סופי להחלטה אחרת.',
    'החלטה בעניין סעד זמני, כגון צו מניעה זמני, נחשבת ל''החלטה אחרת'' של בית הדין המשמעתי המחוזי. בהתאם לסעיף 57(ב) לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015, ערעור על החלטה אחרת יוגש לבית הדין המשמעתי הארצי תוך 10 ימים מיום המצאת ההחלטה. אין הבחנה מיוחדת לסעדים זמניים לעניין זה.',
    'סטודנטים עלולים לטעות ולחשוב שסעדים זמניים אינם ניתנים לערעור, או שהם כפופים למועדים או לערכאות שונות מאשר ''החלטה אחרת'' רגילה.',
    '["סעד זמני", "החלטה אחרת", "מועדי ערעור", "ערכאת ערעור", "לשכת עורכי הדין", "סדרי דין משמעתיים"]'::jsonb,
    '**וריאציה 1 — סיווג:** האם החלטה על סעד זמני היא פסק דין או החלטה אחרת? ← החלטה אחרת. **וריאציה 2 — מועד ערעור:** מהו מועד הערעור על החלטה אחרת? ← 10 ימים מיום המצאה (ס'' 57(ב) לכללים). **וריאציה 3 — ערכאה:** לאיזו ערכאה מוגש הערעור? ← בית הדין המשמעתי הארצי (ס'' 57(ב) לכללים).',
    'ערעור על סעד זמני ← נחשב ''החלטה אחרת'' ← 10 יום לבית הדין הארצי.',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015, סעיף 57"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'סמכות בית הדין המשמעתי הארצי בערעור', 4, 'בית הדין המשמעתי הארצי דן בערעור שהגיש עורך דין על פסק דינו של בית הדין המשמעתי המחוזי. מהן הסמכויות העיקריות של בית הדין הארצי בבואו להכריע בערעור?',
    'שאלה זו עוסקת בסמכויותיו של בית הדין המשמעתי הארצי של לשכת עורכי הדין כערכאת ערעור. היא בוחנת את היקף שיקול הדעת של ערכאת הערעור ואת האפשרויות העומדות בפניה בעת הכרעה בערעור.',
    'סעיף 60 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015, קובע את סמכויות בית הדין המשמעתי הארצי בערעור. בית הדין רשאי לאשר את פסק הדין, לבטלו, לשנותו, או להחזירו לבית הדין המחוזי עם הוראות. סמכויות אלו מקבילות לסמכויות ערכאת ערעור אזרחית או פלילית, ומאפשרות לו לתקן טעויות משפטיות ועובדתיות, וכן להשלים חסרים במידת הצורך.',
    'סטודנטים עלולים לטעות בהבנת תפקידה של ערכאת ערעור, ולחשוב שהיא דנה מחדש בכל העובדות או שהיא מוגבלת רק לאישור או ביטול, מבלי יכולת לשנות את פסק הדין או להחזירו לדיון נוסף.',
    '["סמכויות ערכאת ערעור", "בית הדין המשמעתי הארצי", "פסק דין", "ביטול פסק דין", "שינוי פסק דין", "החזרת תיק"]'::jsonb,
    '**וריאציה 1 — אפשרויות הכרעה:** מהן האפשרויות העיקריות של בית הדין הארצי בערעור? ← לאשר, לבטל, לשנות, להחזיר (ס'' 60 לכללים). **וריאציה 2 — דיון בעובדות:** האם בית הדין הארצי דן מחדש בעובדות? ← ככלל לא, אלא במקרים חריגים (פסיקה). **וריאציה 3 — החמרה בעונש:** האם בית הדין הארצי יכול להחמיר בעונש? ← רק אם הוגש ערעור מטעם הקובל (כלל איסור ''רעמת הפרקליט'').',
    'סמכויות בית הדין הארצי בערעור ← לאשר, לבטל, לשנות, להחזיר ← לא דן בעובדות מחדש ככלל.',
    '["כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015, סעיף 60"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', '10 ימים מיום המצאת ההחלטה. בקשה להארכת מועד תוגש ליושב ראש בית הדין המשמעתי הארצי.', true, 'זו התשובה הנכונה. סעיף 57(ב) לכללי לשכת עורכי הדין קובע כי על החלטה אחרת ניתן לערער תוך 10 ימים מיום המצאתה, ויו"ר בית הדין הארצי מוסמך להאריך מועד.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', '30 ימים מיום המצאת ההחלטה. בקשה להארכת מועד תוגש ליושב ראש בית הדין המשמעתי המחוזי.', false, 'מועד הערעור על החלטה אחרת קצר יותר מ-30 ימים, ויו"ר בית הדין המחוזי אינו מוסמך להאריך מועד לערעור לבית הדין הארצי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', '45 ימים מיום מתן ההחלטה. בקשה להארכת מועד תוגש לבית המשפט המחוזי.', false, 'מועד הערעור קצר יותר, מניין הימים הוא מיום המצאה ולא מתן, ובית המשפט המחוזי אינו הערכאה המוסמכת להארכת מועד.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'אין זכות ערעור על החלטה בעניין עיכוב ביצוע עונש.', false, 'קיימת זכות ערעור על החלטות אחרות של בית הדין המחוזי, ובכלל זה החלטות בעניין עיכוב ביצוע, כמפורט בכללים.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'רק את משך האיחור ואת מידת הפגיעה בצד שכנגד.', false, 'אלו שיקולים רלוונטיים, אך אינם היחידים. יש לבחון גם את סיבת האיחור ואת סיכויי הערעור.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'את סיבת האיחור, משך האיחור, סיכויי הערעור ומידת הפגיעה בצד שכנגד.', true, 'זו התשובה הנכונה, המפרטת את מכלול השיקולים המנחים את בית המשפט בבואו להאריך מועד להגשת ערעור, בהתאם לפסיקה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'רק את סיכויי הערעור, ללא קשר לסיבת האיחור.', false, 'סיכויי הערעור הם שיקול חשוב, אך אינם יכולים לבוא במקום הצורך ב''טעם מיוחד'' לאיחור.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'רק אם האיחור נגרם מסיבות שאינן תלויות בעורך הדין.', false, 'גם סיבות התלויות בעורך הדין יכולות להצדיק הארכת מועד, אם כי הן נבחנות בקפדנות רבה יותר.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', '10 ימים מיום המצאת ההחלטה, לבית הדין המשמעתי הארצי.', true, 'זו התשובה הנכונה. החלטה בעניין סעד זמני נחשבת ל''החלטה אחרת'' ומועד הערעור עליה הוא 10 ימים לבית הדין הארצי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', '30 ימים מיום המצאת ההחלטה, לבית הדין המשמעתי הארצי.', false, 'מועד זה מתייחס לערעור על פסק דין סופי, ולא על החלטה בעניין סעד זמני.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'אין זכות ערעור על החלטות בעניין סעדים זמניים בבתי הדין המשמעתיים.', false, 'קיימת זכות ערעור על החלטות אחרות, ובכלל זה סעדים זמניים, בהתאם לכללים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'הערעור יוגש לבית המשפט המחוזי תוך 30 ימים מיום המצאת ההחלטה.', false, 'הערכאה המוסמכת לערעור היא בית הדין המשמעתי הארצי, ולא בית המשפט המחוזי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'לאשר את פסק הדין, לבטלו, לשנותו, או להחזירו לבית הדין המחוזי עם הוראות.', true, 'זו התשובה הנכונה, המפרטת את מכלול הסמכויות של ערכאת ערעור, כפי שקבוע בחוק לשכת עורכי הדין וכללי סדרי הדין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'רק לאשר או לבטל את פסק הדין, ללא סמכות לשנותו או להחזירו.', false, 'סמכות בית הדין הארצי רחבה יותר וכוללת גם שינוי פסק הדין או החזרתו לדיון נוסף.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'לדון מחדש בכל העובדות והראיות שהוצגו בפני בית הדין המחוזי, כאילו היה זה דיון ראשון.', false, 'בית הדין הארצי הוא ערכאת ערעור, ואינו נוהג לדון מחדש בעובדות אלא אם כן מדובר במקרים חריגים המצדיקים זאת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'להטיל עונש חמור יותר מזה שהוטל על ידי בית הדין המחוזי, גם אם המערער הוא עורך הדין.', false, 'הטלת עונש חמור יותר על ידי ערכאת ערעור כאשר המערער הוא הנאשם (או עורך הדין במקרה זה) היא חריג לכלל, ודורשת ערעור מטעם הקובל.', 4);

END $$;

-- ============================================================
-- Q4 — 2024-W-Q4 — chapter=civil_proc subtopic=judge_recusal
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q4';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q4 skipped: external_id % already exists', '2024-W-Q4';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'judge_recusal';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'judge_recusal';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q4', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'מה הדין לעניין חשיפת מותב בית המשפט הפלילי לראיות בלתי קבילות?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 4}'::jsonb,
    'שאלה זו עוסקת בעילת פסלות שופט במקרה של חשיפה לראיות בלתי קבילות. היא בוחנת את הכלל לפיו חשיפה כשלעצמה אינה מקימה עילת פסלות, ואת החריג המכונה ''מסה קריטית'' של ראיות, אשר רק בהתקיימו יקום חשש ממשי למשוא פנים.',
    'הלכת הפסיקה, המעוגנת בסעיף 77א לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובעת כי אין בחשיפת שופט לראיות בלתי קבילות כשלעצמה כדי להקים חשש ממשי למשוא פנים ולהביא לפסלותו. זאת, נוכח חזקת המקצועיות של השופט, המניחה כי ביכולתו להפריד בין ראיות קבילות לבלתי קבילות. רק במקרים חריגים ונדירים במיוחד, בהם נחשף השופט ל"מסה קריטית" של ראיות בלתי קבילות, מבחינת כמותן ואיכותן, באופן שאינו מאפשר לו להתעלם מהן, תקום עילת פסלות. כך נקבע, למשל, בע"פ 10698/06 דקל אליאב נ'' מדינת ישראל, בע"פ 7513/22 אונור קלש נ'' מדינת ישראל ובתפ"ח (מחוזי ב"ש) 35982-12-17 יניב זגורי נ'' מדינת ישראל.',
    'טעות נפוצה היא להניח שכל חשיפה של שופט לראיות שאינן קבילות אוטומטית פוסלת אותו. יש לזכור את מבחן ה''מסה הקריטית'' ואת חזקת המקצועיות של השופט, המאפשרת לו להתמודד עם מידע כזה.',
    '["פסלות שופט", "חשש ממשי למשוא פנים", "ראיות בלתי קבילות", "מסה קריטית", "חזקת מקצועיות השופט", "חוק בתי המשפט"]'::jsonb,
    '**וריאציה 1 — כלל:** מהו הכלל לגבי חשיפת שופט לראיות בלתי קבילות? ← אין בכך כשלעצמו עילת פסלות (ע"פ 7513/22 קלש). **וריאציה 2 — חריג:** מתי כן תקום עילת פסלות? ← רק במקרים חריגים של "מסה קריטית" של ראיות (ע"פ 10698/06 דקל אליאב). **וריאציה 3 — תכלית:** מהי תכלית הכלל? ← חזקה על השופט המקצועי שידע להפריד בין ראיות קבילות לבלתי קבילות (תפ"ח 35982-12-17 זגורי).',
    'חשיפה לראיות בלתי קבילות ← לא פסלות אוטומטית ← רק אם ''מסה קריטית'' של ראיות.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 77א", "ע\"פ 10698/06 דקל אליאב נ'' מדינת ישראל (11.2.2007)", "ע\"פ 7513/22 אונור קלש נ'' מדינת ישראל (1.12.2022)", "תפ\"ח (מחוזי ב\"ש) 35982-12-17 יניב זגורי נ'' מדינת ישראל (26.8.2019)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'יש בחשיפת המותב לראיות אלו כשלעצמה כדי להקים חשש ממשי למשוא פנים ולהביא לפסלות המותב.', false, 'תשובה זו שגויה, שכן הפסיקה קובעת כי חשיפה לראיות בלתי קבילות כשלעצמה אינה מקימה עילת פסלות אוטומטית.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'יש בחשיפת המותב לראיות אלו כשלעצמה כדי להקים חשש קריטי למשוא פנים ולהביא לפסלות המותב.', false, 'תשובה זו שגויה, שכן המבחן הוא ''חשש ממשי למשוא פנים'' ולא ''חשש קריטי'', וחשיפה כשלעצמה אינה מספיקה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אין בחשיפת המותב לראיות אלו כדי להקים חשש ממשי למשוא פנים ולא תתאפשר פסלות המותב.', false, 'תשובה זו שגויה, שכן במקרים חריגים של ''מסה קריטית'' של ראיות בלתי קבילות, כן תתאפשר פסלות.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'אין בחשיפת המותב לראיות אלו כשלעצמה כדי להקים חשש ממשי למשוא פנים ותתאפשר פסלות המותב רק במקרים חריגים שבהם נחשף המותב ל"מסה קריטית" של ראיות שכאלו.', true, 'זו התשובה הנכונה, המשקפת את הלכת הפסיקה לפיה חשיפה לראיות בלתי קבילות אינה מקימה עילת פסלות כשלעצמה, אלא אם מדובר ב''מסה קריטית'' של ראיות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'פסלות שופט עקב היכרות קודמת עם נאשם', 1, 'שופט דן בעבר בתיק פלילי אחר של אותו נאשם, בו הורשע הנאשם. האם עובדה זו כשלעצמה מקימה עילת פסלות?',
    'שאלה זו עוסקת בשאלת פסלות שופט עקב היכרות קודמת עם נאשם, ובפרט חשיפה לעברו הפלילי. הפסיקה קבעה כי היכרות כזו אינה מקימה עילת פסלות אוטומטית, אלא יש לבחון אם נוצר חשש ממשי למשוא פנים.',
    'הפסיקה קבעה כי אין די בדיון של שופט בהליכי מעצר של נאשם, כשלעצמו, כדי להביא לפסילתו מלדון בהליך העיקרי. אף אם רצוי ככל שניתן כי שופט המעצר לא ידון בתיק לגופו, אין בכך כדי להקים עילת פסלות. גם חשיפה לעברו הפלילי של נאשם אינה מקימה כשלעצמה עילת פסלות, אלא יש לבחון אם נחשף השופט ל"מסה קריטית" של מידע בלתי קביל שבכוחה להקים חשש ממשי למשוא פנים. המבחן הוא אובייקטיבי, מנקודת מבטו של השופט הסביר. כך נקבע בע"פ 7513/22 קלש נ'' מדינת ישראל ובע"פ 10698/06 דקל אליאב נ'' מדינת ישראל.',
    'טעות נפוצה היא להניח שכל היכרות קודמת של שופט עם נאשם, ובמיוחד עם עברו הפלילי, פוסלת אותו אוטומטית. יש לזכור את חזקת המקצועיות של השופט ואת מבחן ה''מסה הקריטית''.',
    '["פסלות שופט", "היכרות קודמת", "עבר פלילי", "מסה קריטית", "חשש ממשי למשוא פנים", "חזקת מקצועיות השופט"]'::jsonb,
    '**וריאציה 1 — היכרות קודמת:** האם היכרות קודמת עם נאשם פוסלת שופט? ← לא כשלעצמה (ע"פ 7513/22 קלש). **וריאציה 2 — עבר פלילי:** האם חשיפה לעבר פלילי פוסלת? ← לא אוטומטית, אלא אם ''מסה קריטית'' (ע"פ 10698/06 דקל אליאב). **וריאציה 3 — מבחן:** מהו המבחן? ← חשש ממשי למשוא פנים עקב ''מסה קריטית'' (ס'' 77א לחוק בתי המשפט).',
    'היכרות קודמת/עבר פלילי ← לא פסלות אוטומטית ← רק אם ''מסה קריטית'' של ראיות בלתי קבילות.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 77א", "ע\"פ 10698/06 דקל אליאב נ'' מדינת ישראל (11.2.2007)", "ע\"פ 7513/22 אונור קלש נ'' מדינת ישראל (1.12.2022)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'המבחן האובייקטיבי לחשש ממשי למשוא פנים', 2, 'מהו המבחן לקיומו של חשש ממשי למשוא פנים המצדיק פסילת שופט?',
    'שאלה זו מתמקדת במבחן המשפטי לקביעת עילת פסלות שופט, המעוגן בסעיף 77א לחוק בתי המשפט. היא מדגישה את אופיו האובייקטיבי של המבחן ואת הפרספקטיבה ממנה הוא נבחן.',
    'סעיף 77א(א) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי שופט לא ישב בדין אם קיימות נסיבות שיש בהן כדי ליצור חשש ממשי למשוא פנים בניהול המשפט. הפסיקה הבהירה כי מדובר במבחן אובייקטיבי, הנבחן מנקודת מבטו של השופט הסביר, ולא מנקודת מבטם הסובייקטיבית של בעלי הדין. כך נקבע, למשל, בת"פ (שלום אי'') 54556-09-25 מדינת ישראל נ'' ענן סלאמה ובת"פ (מחוזי ת"א) 50380-11-17 רונן משה נ'' מדינת ישראל.',
    'טעות נפוצה היא לבלבל בין המבחן האובייקטיבי למבחן סובייקטיבי, או לייחס את המבחן ל''אדם הסביר'' במקום ל''שופט הסביר'', אשר לו מיוחסת מקצועיות ויכולת להפריד בין ראיות.',
    '["פסלות שופט", "חשש ממשי למשוא פנים", "מבחן אובייקטיבי", "שופט סביר", "סעיף 77א לחוק בתי המשפט", "אמון הציבור"]'::jsonb,
    '**וריאציה 1 — מבחן:** מהו המבחן לפסלות שופט? ← חשש ממשי למשוא פנים (ס'' 77א(א) לחוק בתי המשפט). **וריאציה 2 — אובייקטיביות:** מנקודת מבטו של מי נבחן החשש? ← השופט הסביר, לא בעל הדין (ת"פ 54556-09-25 ענן סלאמה). **וריאציה 3 — נטל הוכחה:** על מי מוטל נטל ההוכחה? ← על מבקש הפסילה (ת"פ 54556-09-25 ענן סלאמה).',
    'מבחן פסלות שופט ← אובייקטיבי ← מנקודת מבט השופט הסביר ← לא סובייקטיבי של בעל הדין.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 77א", "ת\"פ (שלום אי'') 54556-09-25 מדינת ישראל נ'' ענן סלאמה (23.3.2026)", "ת\"פ (מחוזי ת\"א) 50380-11-17 רונן משה נ'' מדינת ישראל (2.6.2019)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'חשיפה לראיות חסויות בהליכים מקדמיים', 3, 'שופט נחשף לחומר חסוי (כגון חומר מודיעיני או תסקיר סודי) במסגרת הליך מקדמי (למשל, בקשה לעיון בחומר חקירה לפי סעיף 74 לחסד"פ). האם חשיפה זו כשלעצמה מקימה עילת פסלות?',
    'שאלה זו בוחנת את השפעת חשיפת שופט לחומר חסוי או בלתי קביל במסגרת הליכים מקדמיים על שאלת פסלותו. היא מדגישה את הצורך ב''מסה קריטית'' של מידע כדי להקים עילת פסלות, גם במקרים של חומר רגיש.',
    'הפסיקה קבעה כי חשיפה לראיות בלתי קבילות, לרבות חומר חסוי או מודיעיני, אינה מקימה כשלעצמה עילת פסלות. רק במקרים חריגים, בהם המידע המתקבל כה מקיף ויסודי עד שקיים חשש שגם שופט מקצועי לא יוכל להדחיקו, תקום עילה שתאפשר את פסילת בית המשפט. נדרש כי כובד הראיות הפסולות, מבחינת כמותן ואיכותן, יהיה כזה שאינו מאפשר לשופט להתעלם מהן. כך עולה מתפ"ח (מחוזי ב"ש) 35982-12-17 יניב זגורי נ'' מדינת ישראל וכן מע"פ 790/21 מוחמד צלאח נ'' מדינת ישראל.',
    'סטודנטים עלולים לטעות ולחשוב שחשיפה לחומר חסוי או מודיעיני, מעצם טבעו הרגיש, פוסלת שופט באופן אוטומטי, מבלי ליישם את מבחן ה''מסה הקריטית''.',
    '["פסלות שופט", "חומר חסוי", "ראיות בלתי קבילות", "מסה קריטית", "הליכים מקדמיים", "חזקת מקצועיות השופט"]'::jsonb,
    '**וריאציה 1 — חומר חסוי:** האם חשיפה לחומר חסוי פוסלת שופט? ← לא כשלעצמה (תפ"ח 35982-12-17 זגורי). **וריאציה 2 — מבחן:** מתי כן תקום עילת פסלות? ← רק במקרים חריגים של ''מסה קריטית'' (ע"פ 790/21 צלאח). **וריאציה 3 — תכלית:** מדוע אין פסילה אוטומטית? ← חזקה על השופט שידע להפריד בין ראיות (תפ"ח 35982-12-17 זגורי).',
    'חשיפה לחומר חסוי ← לא פסלות אוטומטית ← רק אם ''מסה קריטית'' של ראיות בלתי קבילות.',
    '["תפ\"ח (מחוזי ב\"ש) 35982-12-17 יניב זגורי נ'' מדינת ישראל (26.8.2019)", "ע\"פ 790/21 מוחמד צלאח נ'' מדינת ישראל (24.2.2021)", "פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 44"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'מועד העלאת טענת פסלות וערעור עליה', 4, 'נאשם מעוניין לטעון לפסלות שופט בתיק פלילי. מתי עליו להעלות את טענת הפסלות, וכיצד ניתן לערער על החלטת השופט בעניין זה?',
    'שאלה זו עוסקת בסדרי הדין הנוגעים להעלאת טענת פסלות שופט, ובכלל זה המועד להגשתה והליך הערעור על החלטת השופט. היא מדגישה את החשיבות של העלאת הטענה בהזדמנות הראשונה.',
    'סעיף 146(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי טענת פסלות נגד שופט תועלה לאחר תחילת המשפט, ובערעור – בתחילת שמיעת הערעור ולפני כל טענה אחרת. סעיף 146(ג) מוסיף כי אם לא היה באפשרותו של בעל דין לטעון את הטענה בשלב זה, רשאי הוא לטענה בשלב מאוחר יותר, ובלבד שיעשה זאת מיד לאחר שנודעה לו עילת הפסלות. על החלטת שופט בעניין פסלות ניתן לערער לבית המשפט העליון תוך 10 ימים ממועד ההמצאה, כקבוע בסעיף 77א(ג) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984.',
    'טעות נפוצה היא להעלות טענת פסלות בשלב מאוחר מדי, או לטעות בערכאה המוסמכת לדון בערעור על החלטת פסלות (למשל, בית המשפט המחוזי במקום העליון).',
    '["פסלות שופט", "מועד העלאת טענה", "ערעור על פסלות", "חוק בתי המשפט", "חוק סדר הדין הפלילי", "הזדמנות ראשונה"]'::jsonb,
    '**וריאציה 1 — מועד העלאה:** מתי יש להעלות טענת פסלות? ← בתחילת המשפט או מיד כשנודעה העילה (ס'' 146 לחסד"פ). **וריאציה 2 — ערכאת ערעור:** לאיזו ערכאה מוגש ערעור על החלטת פסלות? ← לבית המשפט העליון (ס'' 77א(ג) לחוק בתי המשפט). **וריאציה 3 — מועד ערעור:** מהו המועד להגשת הערעור? ← תוך 10 ימים מיום ההמצאה (ס'' 77א(ג) לחוק בתי המשפט).',
    'טענת פסלות ← בתחילת המשפט/מיד כשנודעה ← ערעור לעליון תוך 10 ימים.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 77א", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 146", "מערכת בתי המשפט, נבו - המתמחה (2026), ד. דיני פסלות שופט, עמ'' 36"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כן, היכרות קודמת עם עברו הפלילי של נאשם תמיד מקימה עילת פסלות.', false, 'היכרות קודמת עם עברו הפלילי של נאשם אינה מקימה עילת פסלות אוטומטית, אלא יש לבחון את מכלול הנסיבות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'לא, היכרות קודמת עם נאשם אינה מקימה כשלעצמה עילת פסלות, אלא אם נחשף השופט ל"מסה קריטית" של מידע בלתי קביל.', true, 'זו התשובה הנכונה, המשקפת את הלכת הפסיקה לפיה היכרות קודמת עם נאשם או עברו הפלילי אינה מקימה עילת פסלות כשלעצמה, אלא אם מדובר ב''מסה קריטית'' של ראיות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אך רק אם השופט חיווה דעתו באופן נחרץ על אשמת הנאשם בתיק הקודם.', false, 'חידוד דעה נחרצת יכול להוות שיקול, אך אינו התנאי הבלעדי או האוטומטי לפסלות במקרה של היכרות קודמת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, אלא אם כן הנאשם יוכיח שהשופט זוכר פרטים מהותיים מהתיק הקודם.', false, 'נטל ההוכחה אינו מתמקד בזכירת פרטים ספציפיים, אלא בקיומו של חשש ממשי למשוא פנים עקב ''מסה קריטית'' של ראיות.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'מבחן סובייקטיבי, הנבחן מנקודת מבטו של בעל הדין הסביר.', false, 'המבחן לפסלות שופט הוא אובייקטיבי, ולא סובייקטיבי מנקודת מבטו של בעל הדין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'מבחן אובייקטיבי, הנבחן מנקודת מבטו של השופט הסביר, ולא מנקודת מבטם הסובייקטיבית של בעלי הדין.', true, 'זו התשובה הנכונה, המבטאת את המבחן האובייקטיבי לקיומו של חשש ממשי למשוא פנים, כפי שנקבע בסעיף 77א לחוק בתי המשפט ובפסיקה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'מבחן אובייקטיבי, הנבחן מנקודת מבטו של האדם הסביר, ולא של השופט הסביר.', false, 'המבחן מתייחס לשופט הסביר, שכן הוא בעל מקצועיות ויכולת להפריד בין ראיות קבילות לבלתי קבילות, בניגוד לאדם הסביר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'מבחן סובייקטיבי, הנבחן מנקודת מבטו של השופט עצמו.', false, 'המבחן אינו סובייקטיבי מנקודת מבטו של השופט, אלא אובייקטיבי מנקודת מבטו של השופט הסביר.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, חשיפה לחומר חסוי תמיד מקימה עילת פסלות בשל פגיעה במראית פני הצדק.', false, 'חשיפה לחומר חסוי אינה מקימה עילת פסלות אוטומטית, אלא יש לבחון את היקף ומהות החומר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, אלא אם כן החומר החסוי מהווה "מסה קריטית" של ראיות בלתי קבילות שהשופט לא יוכל להשתחרר ממנה.', true, 'זו התשובה הנכונה, המיישמת את מבחן ה''מסה הקריטית'' גם על חומר חסוי שנחשף בהליכים מקדמיים, תוך שמירה על חזקת מקצועיות השופט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, אם החומר החסוי נוגע לעברו הפלילי של הנאשם.', false, 'גם חשיפה לחומר חסוי הנוגע לעבר פלילי אינה מקימה עילת פסלות אוטומטית, אלא נבחנת לפי מבחן ה''מסה הקריטית''.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, שכן חומר חסוי אינו נחשב לראיה בלתי קבילה.', false, 'חומר חסוי יכול להיות בלתי קביל בהליך העיקרי, ולכן חשיפה אליו מעוררת את שאלת הפסלות, אך לא באופן אוטומטי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'בתחילת המשפט ולפני כל טענה אחרת. על החלטת השופט ניתן לערער לבית המשפט המחוזי תוך 10 ימים.', false, 'המועד להגשת הטענה נכון, אך ערכאת הערעור ומועד הערעור שגויים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'בתחילת המשפט או מיד לאחר שנודעה לו עילת הפסלות. על החלטת השופט ניתן לערער לבית המשפט העליון תוך 10 ימים.', true, 'זו התשובה הנכונה, המפרטת את מועד העלאת טענת הפסלות ואת הליך הערעור עליה, כפי שקבוע בחוק סדר הדין הפלילי ובחוק בתי המשפט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'בכל שלב של המשפט, ללא הגבלת זמן. על החלטת השופט ניתן לערער לבית המשפט העליון תוך 30 ימים.', false, 'טענת פסלות יש להעלות בהקדם האפשרי, ולא בכל שלב, ומועד הערעור קצר יותר מ-30 ימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'רק לאחר מתן פסק הדין. אין אפשרות לערער על החלטת פסלות, אלא רק במסגרת ערעור על פסק הדין.', false, 'טענת פסלות יש להעלות לפני מתן פסק הדין, וקיימת זכות ערעור נפרדת על החלטת פסלות.', 4);

END $$;

-- ============================================================
-- Q5 — 2024-W-Q5 — chapter=criminal_proc subtopic=charges_withdrawal
-- notes: needs_review=true | note: הסדר מותנה הוא נושא מרכזי ב'פתיחת ההליך הפלילי' שאינו מופיע ברשימת תתי הנושאים הסגורה. נבחר בתת-הנושא 'חזרה מאישום' כקרוב ביותר, שכן שניהם עוסקים בהחלטת התביעה שלא להגיש כתב אישום או לחזור ממנו, אך יש לשקול הוספת תת-נושא ייעודי ל'הסדר מותנה' או 'הליכים לפני משפט'.
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q5';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q5 skipped: external_id % already exists', '2024-W-Q5';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'charges_withdrawal';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'charges_withdrawal';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q5', 'e4a16014-22c7-4653-bf0d-89ff4bb34c20', v_subtopic_id,
    'טמיר, שחשוד בעבירה, עומד לחתום על הסדר מותנה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 5}'::jsonb,
    'שאלה זו עוסקת בזכותו של חשוד לעיין בחומר החקירה ובטיוטת כתב האישום בטרם חתימה על הסדר מותנה. היא מדגישה את ההוראה הספציפית בחוק סדר הדין הפלילי המעניקה זכות זו, ואת חשיבותה של זכות העיון בהליך מקדמי זה.',
    'סעיף 67ד לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע מפורשות כי בטרם ייחתם הסדר מותנה, רשאי החשוד לעיין בחומר החקירה ובטיוטת כתב האישום, אם אינה זהה למתואר בהסדר. זכות זו חיונית על מנת לאפשר לחשוד לקבל החלטה מושכלת באשר לחתימה על ההסדר, שכן היא מאפשרת לו לבחון את הראיות הקיימות נגדו ואת העובדות המיוחסות לו. זכות זו שונה מזכות העיון הכללית בחומר חקירה לפי סעיף 74 לחוק, הקמה רק לאחר הגשת כתב אישום. סעיף 67ד לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982נבו - המתמחה סדר הדין הפלילי (2026) | סגירת תיק בהסדר (הסדר מותנה)תו"ב (מקומיים נת'') 45213-07-19 הועדה המקומית לתכנון ובניה נתניה נ'' אלון אוחנה (3.2.2021)בע"ח (שלום ת"א) 51610-11-23 משה מקייטן נ'' מדינת ישראל (18.12.2023)',
    'טעות נפוצה היא לבלבל בין זכות העיון בחומר חקירה בהליך של הסדר מותנה לבין זכות העיון הכללית הקבועה בסעיף 74 לחוק סדר הדין הפלילי, החלה רק לאחר הגשת כתב אישום.',
    '["הסדר מותנה", "זכות עיון בחומר חקירה", "טיוטת כתב אישום", "חוק סדר הדין הפלילי", "הליכים לפני משפט", "הליך הוגן"]'::jsonb,
    '**וריאציה 1 — מועד העיון:** מתי רשאי חשוד לעיין בחומר חקירה בהסדר מותנה? ← בטרם ייחתם ההסדר (ס'' 67ד לחסד"פ). **וריאציה 2 — היקף העיון:** מה כולל העיון? ← חומר חקירה וטיוטת כתב אישום אם אינה זהה להסדר (ס'' 67ד לחסד"פ). **וריאציה 3 — הבדל מס'' 74:** האם זכות זו זהה לזכות לפי ס'' 74? ← לא, ס'' 74 חל רק לאחר הגשת כתב אישום (בע"ח 51610-11-23).',
    'הסדר מותנה ← עיון בחומר חקירה וטיוטת כתב אישום ← לפני חתימה.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 67ד", "תו\"ב (מקומיים נת'') 45213-07-19 הועדה המקומית לתכנון ובניה נתניה נ'' אלון אוחנה (3.2.2021)", "בע\"ח (שלום ת\"א) 51610-11-23 משה מקייטן נ'' מדינת ישראל (18.12.2023)", "נבו - המתמחה, סדר הדין הפלילי (2026), ב. פתיחת ההליך הפלילי, סגירת תיק בהסדר (הסדר מותנה)"]'::jsonb,
    'needs_review=true | note: הסדר מותנה הוא נושא מרכזי ב''פתיחת ההליך הפלילי'' שאינו מופיע ברשימת תתי הנושאים הסגורה. נבחר בתת-הנושא ''חזרה מאישום'' כקרוב ביותר, שכן שניהם עוסקים בהחלטת התביעה שלא להגיש כתב אישום או לחזור ממנו, אך יש לשקול הוספת תת-נושא ייעודי ל''הסדר מותנה'' או ''הליכים לפני משפט''.',
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בטרם ייחתם ההסדר, רשאי טמיר לעיין בחומר החקירה ובטיוטת כתב האישום.', false, 'תשובה זו אינה מדויקת, שכן זכות העיון בטיוטת כתב האישום מוגבלת למקרים בהם הטיוטה אינה זהה למתואר בהסדר.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בטרם ייחתם ההסדר, רשאי טמיר לעיין בחומר החקירה ובטיוטת כתב האישום, אם אינה זהה למתואר בהסדר.', true, 'זו התשובה הנכונה, המשקפת במדויק את הוראת סעיף 67ד לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'רק לאחר שייחתם ההסדר רשאי טמיר לעיין בחומר החקירה ובטיוטת כתב האישום.', false, 'תשובה זו שגויה, שכן זכות העיון ניתנת לחשוד דווקא בטרם חתימת ההסדר, על מנת לאפשר לו לקבל החלטה מושכלת.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'רק לאחר שייחתם ההסדר רשאי טמיר לעיין בחומר החקירה ובטיוטת כתב האישום, אם אינה זהה למתואר בהסדר.', false, 'תשובה זו שגויה, שכן זכות העיון ניתנת לחשוד בטרם חתימת ההסדר, ולא לאחריו.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'תנאי סף להסדר מותנה', 1, 'ראובן חשוד בעבירת פשע חמורה, ובעל רישום פלילי מלפני 4 שנים. האם התובע רשאי להציע לו הסדר מותנה?',
    'שאלה זו עוסקת בתנאי הסף המצטברים הנדרשים על פי חוק סדר הדין הפלילי לצורך עריכת הסדר מותנה. תנאים אלו מגבילים את שיקול דעת התביעה ומבטיחים שהסדר מותנה יוצע רק במקרים המתאימים לכך.',
    'סעיף 67א(ג) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי לא ייערך הסדר אלא בעבירת חטא או עוון, או בעבירת פשע המנויה בתוספת השישית. עבירת פשע חמורה שאינה בתוספת השישית אינה מאפשרת הסדר מותנה. בנוסף, סעיף 67א(ד)(2) קובע תנאי סף נוסף לפיו אין לחשוד רישום פלילי מ-5 השנים שלפני ביצוע העבירה. במקרה זה, לראובן רישום פלילי מלפני 4 שנים, וכן הוא חשוד בעבירת פשע חמורה, ולכן שני תנאי סף אלו אינם מתקיימים, והתובע אינו רשאי להציע לו הסדר מותנה. סעיף 67א(ג) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982סעיף 67א(ד) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982נבו - המתמחה סדר הדין הפלילי (2026) | סגירת תיק בהסדר (הסדר מותנה)',
    'טעות נפוצה היא להתמקד רק באחד מתנאי הסף (למשל, סוג העבירה או העונש הצפוי) ולהתעלם מהצורך בקיום כל התנאים המצטברים, לרבות היעדר רישום פלילי רלוונטי.',
    '["הסדר מותנה", "תנאי סף", "עבירת פשע", "רישום פלילי", "חוק סדר הדין הפלילי", "שיקול דעת התביעה"]'::jsonb,
    '**וריאציה 1 — סוג עבירה:** האם ניתן לערוך הסדר מותנה בעבירת פשע חמורה? ← לא, אלא אם היא מנויה בתוספת השישית (ס'' 67א(ג) לחסד"פ). **וריאציה 2 — עבר פלילי:** האם רישום פלילי מלפני 4 שנים מהווה חסם? ← כן, אם הוא בחמש השנים שלפני ביצוע העבירה (ס'' 67א(ד)(2) לחסד"פ). **וריאציה 3 — תנאים מצטברים:** האם כל התנאים צריכים להתקיים? ← כן, כל תנאי הסף מצטברים (נבו - המתמחה, סדר הדין הפלילי).',
    'הסדר מותנה ← תנאי סף מצטברים ← סוג עבירה + היעדר רישום פלילי ב-5 שנים אחרונות.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 67א", "נבו - המתמחה, סדר הדין הפלילי (2026), ב. פתיחת ההליך הפלילי, סגירת תיק בהסדר (הסדר מותנה)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'ההבחנה בין שימוע להסדר מותנה', 2, 'מהו ההבדל המהותי בין זכות השימוע (לפי סעיף 60א לחוק סדר הדין הפלילי) לבין הזכות להסדר מותנה (לפי סעיף 67א לחוק סדר הדין הפלילי) לעניין מטרת ההליך?',
    'שאלה זו בוחנת את ההבחנה המהותית בין שני מנגנונים חשובים בהליך הפלילי המוקדם: זכות השימוע והזכות להסדר מותנה. ההבנה של תכלית כל אחד מהם חיונית להבנת סדרי הדין הפליליים.',
    'זכות השימוע, המעוגנת בסעיף 60א לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, נועדה לאפשר לחשוד להשמיע את טיעוניו בפני רשויות התביעה טרם גיבוש עמדתן הסופית באשר לעבירות שיש לייחס לו, ובכך להשפיע על עצם ההחלטה האם להגיש כתב אישום. לעומת זאת, הזכות להסדר מותנה, המעוגנת בסעיף 67א לחוק, נוגעת לשאלה באיזה כלי אכיפתי נכון והולם להשתמש ביחס לעבירות שכבר התגבשה ההחלטה כי הן אלו שיש לייחס לחשוד. ההסדר המותנה הוא כלי אכיפתי חלופי להגשת כתב אישום, המאפשר סגירת תיק בתנאים, במצבי ביניים שאינם מתאימים להליך פלילי מלא אך גם לא לפטור מוחלט. תו"ב (מקומיים נת'') 45213-07-19 הועדה המקומית לתכנון ובניה נתניה נ'' אלון אוחנה (3.2.2021)בג"ץ 7342/16 יפתח נוטמן נ'' עו"ד נאוה טולדנו (13.3.2017)תו"ב (מקומיים נת'') 45213-07-19 הועדה המקומית לתכנון ובניה נתניה נ'' אלון אוחנה (3.2.2021)',
    'טעות נפוצה היא לראות בשימוע ובהסדר מותנה הליכים בעלי אותה תכלית, או לבלבל בין היקף זכות העיון בחומר החקירה בכל אחד מהם.',
    '["זכות שימוע", "הסדר מותנה", "הליכים לפני משפט", "חוק סדר הדין הפלילי", "שיקול דעת התביעה", "הגשת כתב אישום"]'::jsonb,
    '**וריאציה 1 — תכלית שימוע:** מה מטרת השימוע? ← להשפיע על עצם הגשת כתב האישום (תו"ב 45213-07-19). **וריאציה 2 — תכלית הסדר מותנה:** מה מטרת ההסדר המותנה? ← בחירת כלי אכיפה חלופי לאחר החלטה על ייחוס עבירות (תו"ב 45213-07-19). **וריאציה 3 — זכות עיון:** האם זכות העיון זהה בשניהם? ← לא, רחבה יותר בהסדר מותנה מאשר בשימוע (בג"ץ 7342/16).',
    'שימוע ← האם להגיש כתב אישום; הסדר מותנה ← כיצד לטפל בעבירות שכבר יוחסו.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 60א", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 67א", "תו\"ב (מקומיים נת'') 45213-07-19 הועדה המקומית לתכנון ובניה נתניה נ'' אלון אוחנה (3.2.2021)", "בג\"ץ 7342/16 יפתח נוטמן נ'' עו\"ד נאוה טולדנו (13.3.2017)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'תוצאות הפרת הסדר מותנה', 3, 'יוסי חתם על הסדר מותנה, הודה בעובדות המהוות עבירה והתחייב לתנאים מסוימים. לאחר מכן, הפר יוסי את תנאי ההסדר. מה הדין לגבי העמדתו לדין ושימוש בהודאתו?',
    'שאלה זו עוסקת בתוצאות המשפטיות של הפרת הסדר מותנה, ובפרט בשאלת העמדה לדין ובקבילות הודאת החשוד שניתנה במסגרת ההסדר. היא מדגישה את ההגנה הניתנת לחשוד מפני שימוש בהודאתו במקרה של הפרה.',
    'סעיף 67ז(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי אם החשוד לא מילא את תנאי ההסדר, יעמידו התובע לדין לפי טיוטת כתב האישום. יחד עם זאת, סעיף 67ז(ו) קובע מפורשות כי הודאת חשוד בעובדות המהוות עבירה, במסגרת הסדר, לא תשמש ראיה נגדו בהליך פלילי בשל עובדות אלה. הוראה זו נועדה לעודד חשודים לחתום על הסדרים מותנים מבלי לחשוש שהודאתם תשמש נגדם אם ההסדר יופר. סעיף 67ז(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982סעיף 67ז(ו) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982נבו - המתמחה סדר הדין הפלילי (2026) | סגירת תיק בהסדר (הסדר מותנה)',
    'טעות נפוצה היא להניח שהודאה שניתנה במסגרת הסדר מותנה קבילה כראיה אם ההסדר הופר, בדומה להודאות אחרות. יש לזכור את ההגנה המיוחדת הקבועה בחוק לעניין זה.',
    '["הסדר מותנה", "הפרת הסדר", "העמדה לדין", "קבילות ראיות", "הודאת חשוד", "חוק סדר הדין הפלילי"]'::jsonb,
    '**וריאציה 1 — הפרה:** מה קורה כשהסדר מותנה מופר? ← החשוד יועמד לדין לפי טיוטת כתב האישום (ס'' 67ז(א) לחסד"פ). **וריאציה 2 — קבילות הודאה:** האם הודאת החשוד בהסדר קבילה כראיה? ← לא, היא לא תשמש ראיה נגדו (ס'' 67ז(ו) לחסד"פ). **וריאציה 3 — ביטול הסדר:** מה קורה להסדר במקרה של הפרה? ← ההסדר יבוטל, והחשוד לא יהיה מחויב למלא תנאים שטרם מילא (ס'' 67ז(ד) לחסד"פ).',
    'הפרת הסדר מותנה ← העמדה לדין ← הודאה בהסדר אינה קבילה כראיה.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 67ז", "נבו - המתמחה, סדר הדין הפלילי (2026), ב. פתיחת ההליך הפלילי, סגירת תיק בהסדר (הסדר מותנה)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'זכות עיון בחומר חקירה לאחר הגשת כתב אישום', 4, 'לאחר שהוגש כתב אישום נגד דנה בעבירת פשע, היא מבקשת לעיין בחומר החקירה. מה היקף זכות העיון שלה, ומהם הטעמים לכך?',
    'שאלה זו עוסקת בזכות היסוד של נאשם לעיין בחומר החקירה לאחר הגשת כתב אישום, המעוגנת בסעיף 74 לחוק סדר הדין הפלילי. היא בוחנת את היקף הזכות ואת הרציונלים העומדים בבסיסה, כחלק מהזכות למשפט הוגן.',
    'סעיף 74(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982, קובע כי לאחר הגשת כתב אישום בפשע או בעוון, רשאים הנאשם וסניגורו לעיין בכל זמן סביר בחומר החקירה וברשימת כל החומר שנאסף או שנרשם בידי הרשות החוקרת, והנוגע לאישום. הפסיקה פירשה את המונח ''חומר חקירה'' באופן מרחיב, ככולל כל חומר הקשור באופן ישיר או עקיף לאישום ונוגע ליריעה הנפרשת במהלך המשפט. זכות זו נגזרת מהזכות למשפט הוגן, ומטרתה לאפשר לנאשם להכיר את חומר הראיות נגדו ולהיערך כראוי למשפט, ובכך לצמצם את פערי הכוחות המובנים בהליך הפלילי. סעיף 74(א) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982בש"פ 6507/09 משה קצב נ'' מדינת ישראל (13.9.2009)נבו - המתמחה סדר הדין הפלילי (2026) | עיון בחומר הראיותבג"ץ 5676/19 וורקה טקה נ'' המחלקה לחקירות שוטרים בפרקליטות המדינה (29.10.2019)',
    'טעות נפוצה היא לבלבל בין היקף זכות העיון לפני הגשת כתב אישום (במסגרת שימוע או הסדר מותנה) לבין היקפה הרחב יותר לאחר הגשת כתב אישום, או להתעלם מהרציונלים העמוקים של הזכות למשפט הוגן.',
    '["זכות עיון בחומר חקירה", "משפט הוגן", "חוק סדר הדין הפלילי", "הגשת כתב אישום", "חומר חקירה", "פערי כוחות"]'::jsonb,
    '**וריאציה 1 — מועד הזכות:** מתי קמה זכות העיון הרחבה בחומר חקירה? ← רק לאחר הגשת כתב אישום (ס'' 74(א) לחסד"פ). **וריאציה 2 — היקף הזכות:** מה כוללת זכות העיון? ← כל חומר הקשור ישירות או עקיפות לאישום (נבו - המתמחה, סדר הדין הפלילי). **וריאציה 3 — רציונל:** מהי תכלית זכות העיון? ← משפט הוגן וצמצום פערי כוחות בין הנאשם למדינה (בש"פ 6507/09 קצב).',
    'זכות עיון לאחר כתב אישום ← רחבה ← כוללת חומר רלוונטי ישיר ועקיף ← למשפט הוגן.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 74", "בש\"פ 6507/09 משה קצב נ'' מדינת ישראל (13.9.2009)", "בג\"ץ 5676/19 וורקה טקה נ'' המחלקה לחקירות שוטרים בפרקליטות המדינה (29.10.2019)", "נבו - המתמחה, סדר הדין הפלילי (2026), פרק ו - הליכים לאחר הגשת כתב אישום, עיון בחומר הראיות"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כן, אם התובע סבור שהעונש המתאים אינו כולל מאסר בפועל.', false, 'תשובה זו מתייחסת רק לאחד מתנאי הסף, ומתעלמת מתנאים מצטברים נוספים שאינם מתקיימים במקרה זה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'לא, מכיוון שקיימים תנאי סף מצטברים שאינם מתקיימים במקרה זה.', true, 'זו התשובה הנכונה. עבירת פשע חמורה ורישום פלילי בחמש השנים האחרונות מהווים חסמים לעריכת הסדר מותנה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אם העבירה אינה מנויה בסעיף 240 לחוק סדר הדין הפלילי.', false, 'תשובה זו מתייחסת רק לחלק מתנאי הסף לעבירות פשע, ומתעלמת מהעובדה שרישום פלילי מהווה חסם בפני עצמו.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, רק אם העבירה היא מסוג פשע שאינו מנוי בתוספת השישית לחוק.', false, 'תשובה זו מתייחסת רק לחלק מתנאי הסף לעבירות פשע, ומתעלמת מהעובדה שרישום פלילי מהווה חסם בפני עצמו.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'זכות השימוע נועדה לאפשר לחשוד להשפיע על עצם הגשת כתב האישום, בעוד שהזכות להסדר מותנה נוגעת לבחירת כלי האכיפה לאחר שהתגבשה החלטה על ייחוס עבירות.', true, 'זו התשובה הנכונה, המבטאת את ההבחנה המהותית בין שתי הזכויות: שימוע מתמקד בשאלה האם להגיש כתב אישום בכלל, והסדר מותנה מתמקד בשאלה כיצד לטפל בעבירות שכבר הוחלט לייחסן.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'זכות השימוע ניתנת רק בעבירות פשע, בעוד שהזכות להסדר מותנה ניתנת רק בעבירות עוון וחטא.', false, 'הבחנה זו אינה מדויקת. זכות השימוע ניתנת בעבירות פשע, אך הסדר מותנה יכול להיערך גם בעבירות פשע מסוימות (המנויות בתוספת השישית).', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'זכות השימוע כוללת זכות עיון מלאה בחומר החקירה, בעוד שהזכות להסדר מותנה אינה כוללת זכות עיון כלל.', false, 'הבחנה זו שגויה. זכות השימוע אינה כוללת זכות עיון מלאה בחומר החקירה, ואילו הזכות להסדר מותנה כן כוללת זכות עיון בחומר החקירה ובטיוטת כתב האישום.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'זכות השימוע היא חובה המוטלת על התביעה, בעוד שהזכות להסדר מותנה נתונה לשיקול דעתה הבלעדי של התביעה.', false, 'זכות השימוע היא אכן חובה (בכפוף לחריגים), אך גם בהסדר מותנה, למרות שיקול הדעת, קיימת חובה לבחון את האפשרות.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'יוסי יועמד לדין לפי טיוטת כתב האישום, והודאתו במסגרת ההסדר תשמש ראיה נגדו.', false, 'תשובה זו שגויה, שכן הודאת החשוד במסגרת הסדר מותנה אינה יכולה לשמש ראיה נגדו בהליך פלילי, גם אם הפר את ההסדר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'יוסי יועמד לדין לפי טיוטת כתב האישום, אך הודאתו במסגרת ההסדר לא תשמש ראיה נגדו בהליך הפלילי.', true, 'זו התשובה הנכונה, המבטאת את הוראות סעיף 67ז לחוק סדר הדין הפלילי, הקובע כי הפרת הסדר מותנה מובילה להעמדה לדין, אך הודאת החשוד במסגרת ההסדר אינה קבילה כראיה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'יוסי לא יועמד לדין, אלא אם כן התובע יקבל אישור מפרקליט בכיר.', false, 'תשובה זו שגויה. הפרת הסדר מותנה מובילה ככלל להעמדה לדין, ואישור תובע בכיר נדרש רק במקרים חריגים (כגון מרמה בהשגת ההסדר או בקשה למאסר בפועל).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'ההסדר יישאר בתוקפו, ויוסי יידרש למלא את התנאים שטרם מילא בתוספת קנס.', false, 'תשובה זו שגויה. הפרת הסדר מותנה מבטלת אותו, והחשוד אינו מחויב למלא תנאים שטרם מילא.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'זכות עיון מצומצמת, המוגבלת רק לחומרים הרלוונטיים ישירות לאישום, משיקולי יעילות.', false, 'זכות העיון לאחר הגשת כתב אישום היא רחבה, ואינה מוגבלת רק לחומרים הרלוונטיים ישירות לאישום, אלא גם לפריפריה שלו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'זכות עיון רחבה, הכוללת כל חומר הקשור באופן ישיר או עקיף לאישום, מתוך עקרון המשפט ההוגן וצמצום פערי כוחות.', true, 'זו התשובה הנכונה, המבטאת את היקף זכות העיון הרחבה לאחר הגשת כתב אישום, ואת הרציונלים העומדים בבסיסה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'אין זכות עיון בחומר חקירה לאחר הגשת כתב אישום, אלא רק זכות שימוע.', false, 'תשובה זו שגויה לחלוטין. זכות העיון המלאה בחומר חקירה קמה דווקא לאחר הגשת כתב אישום, בניגוד לזכות השימוע.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'זכות עיון מלאה, אך רק אם החומר אינו חסוי או מודיעיני.', false, 'זכות העיון היא רחבה, אך קיימים סייגים לגבי חומר חסוי או מודיעיני, וגם לגביהם קיימת זכות עיון ברשימת החומר.', 4);

END $$;

-- ============================================================
-- Q6 — 2024-W-Q6 — chapter=civil_proc subtopic=proceedings
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q6';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q6 skipped: external_id % already exists', '2024-W-Q6';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'proceedings';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q6', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'מה הדין לעניין נוכחות הנאשם בישיבת הכנה לקראת דיון בבית המשפט הקהילתי?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 6}'::jsonb,
    'שאלה זו עוסקת בסדרי הדין הייחודיים החלים בבתי המשפט הקהילתיים, ובפרט בסוגיית נוכחות הנאשם בישיבת הכנה. היא מדגישה את ההוראה הספציפית בחוק סדר הדין הפלילי המאפשרת גמישות בנוכחות הנאשם, בכפוף לתנאים מסוימים, לאור התכלית השיקומית של בתי משפט אלו.',
    'סעיף 220יא לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי בית המשפט הקהילתי רשאי לקיים ישיבת הכנה לקראת דיון בלא נוכחות הנאשם. זאת, בניגוד לכלל הרגיל המחייב נוכחות נאשם בהליכים פליליים. עם זאת, החוק מציב שני תנאים מצטברים לכך: (1) סניגורו של הנאשם הוזמן לישיבה; (2) בית המשפט יידע את הנאשם על סמכותו לקיים ישיבות הכנה כאמור טרם הדיונים לפניו. הוראה זו משקפת את הגישה הגמישה והשיקומית של בתי המשפט הקהילתיים, המאפשרת התאמת ההליך לצרכי הנאשם והקהילה, תוך שמירה על זכויותיו.',
    'טעות נפוצה היא להניח שחובת נוכחות נאשם חלה באופן גורף בכל ההליכים הפליליים, מבלי להכיר את החריגים וההקלות הקבועים בחוק עבור בתי המשפט הקהילתיים, ואת התנאים המצטברים לקיום חריגים אלו.',
    '["בית משפט קהילתי", "ישיבת הכנה", "נוכחות נאשם", "חוק סדר הדין הפלילי", "זכויות נאשם", "הליכים פליליים"]'::jsonb,
    '**וריאציה 1 — כלל:** האם נאשם חייב להיות נוכח בישיבת הכנה בבית משפט קהילתי? ← לא, בכפוף לתנאים (ס'' 220יא לחסד"פ). **וריאציה 2 — תנאים:** מהם התנאים לאי-נוכחות? ← הזמנת סניגור + יידוע הנאשם על סמכות בית המשפט (ס'' 220יא לחסד"פ). **וריאציה 3 — רציונל:** מדוע קיימת גמישות זו? ← בשל הגישה השיקומית והקהילתית של בתי משפט אלו.',
    'ישיבת הכנה בקהילתי ← אין חובת נוכחות נאשם ← בתנאי הזמנת סניגור ויידוע הנאשם.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 220יא"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'קיימת חובת נוכחות של הנאשם בישיבה.', false, 'תשובה זו שגויה, שכן סעיף 220יא לחוק סדר הדין הפלילי קובע כי ניתן לקיים ישיבת הכנה בבית המשפט הקהילתי ללא נוכחות הנאשם, בכפוף לתנאים מסוימים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'ניתן לקיים את הישיבה בלא נוכחות הנאשם, ובלבד שסניגורו הוזמן לישיבה.', false, 'תשובה זו חלקית ואינה מדויקת, שכן היא מתעלמת מהתנאי הנוסף המחייב את בית המשפט ליידע את הנאשם על סמכותו לקיים ישיבות הכנה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ניתן לקיים את הישיבה בלא נוכחות הנאשם, ובלבד שסניגורו הוזמן לישיבה ובית המשפט יידע את הנאשם על סמכותו לקיים ישיבות הכנה כאמור טרם הדיונים לפניו.', true, 'זו התשובה הנכונה, המשקפת במדויק את הוראות סעיף 220יא לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'ניתן לקיים את הישיבה בלא נוכחות הנאשם רק במקרים חריגים שיירשמו, ובלבד שסניגורו הוזמן לישיבה ובית המשפט יידע את הנאשם על סמכותו לקיים ישיבות הכנה כאמור טרם הדיונים לפניו.', false, 'תשובה זו שגויה, שכן אין דרישה ל''מקרים חריגים שיירשמו'' כדי לקיים ישיבת הכנה ללא נוכחות הנאשם, אלא רק עמידה בתנאים המפורטים בחוק.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'נוכחות נאשם בקדם משפט רגיל', 1, 'מה הדין לעניין נוכחות נאשם בישיבת קדם משפט בבית משפט השלום, שאינו בית משפט קהילתי?',
    'שאלה זו עוסקת בהבחנה בין דיני נוכחות נאשם בישיבת קדם משפט רגילה לבין ישיבת הכנה בבית משפט קהילתי. היא מדגישה את הכלל המחייב נוכחות נאשם בקדם משפט, בניגוד לכלל המקל בבתי המשפט הקהילתיים.',
    'סעיף 143א(א) לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי נאשם חייב להיות נוכח בישיבת קדם משפט, אלא אם כן בית המשפט פטר אותו מכך. זאת, בניגוד לדין החל על ישיבת הכנה בבית המשפט הקהילתי, שם ניתן לקיים את הישיבה ללא נוכחות הנאשם בכפוף לתנאים מסוימים. חובת הנוכחות בקדם משפט נובעת מחשיבות ההליך לקידום המשפט ולבירור עמדות הצדדים.',
    'טעות נפוצה היא להחיל את הכללים המקלים של בתי המשפט הקהילתיים על ישיבות קדם משפט רגילות, או לבלבל בין חובת נוכחות לבין אפשרות פטור.',
    '["קדם משפט", "נוכחות נאשם", "חוק סדר הדין הפלילי", "בית משפט השלום", "פטור מנוכחות", "הליכים פליליים"]'::jsonb,
    '**וריאציה 1 — קדם משפט רגיל:** האם נאשם חייב להיות נוכח בקדם משפט רגיל? ← כן, אלא אם פוטר (ס'' 143א(א) לחסד"פ). **וריאציה 2 — ישיבת הכנה קהילתית:** האם נאשם חייב להיות נוכח בישיבת הכנה בבית משפט קהילתי? ← לא, בכפוף לתנאים (ס'' 220יא לחסד"פ). **וריאציה 3 — תכלית:** מה ההבדל בתכלית? ← קדם משפט רגיל לקידום המשפט, קהילתי לפתרון סכסוכים ושיקום.',
    'קדם משפט רגיל ← חובת נוכחות נאשם (אלא אם פטור); קהילתי ← אין חובה (בתנאים).',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 143א"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'תכלית ישיבת הכנה בבית משפט קהילתי', 2, 'מהי התכלית העיקרית של ישיבת הכנה בבית המשפט הקהילתי, וכיצד היא משפיעה על סוגיית נוכחות הנאשם?',
    'שאלה זו בוחנת את ההבנה של התכלית הייחודית של בתי המשפט הקהילתיים, המשלבים עקרונות של צדק מאחה ושיקום. תכלית זו משפיעה על סדרי הדין, ובכלל זה על סוגיית נוכחות הנאשם בישיבות הכנה.',
    'בתי המשפט הקהילתיים הוקמו במטרה להציע מענה הוליסטי לעבריינות קלה, תוך שילוב עקרונות של צדק מאחה, שיקום ומעורבות קהילתית. ישיבת ההכנה בבית משפט קהילתי נועדה לקידום הליכים, בירור עמדות הצדדים, וחיפוש פתרונות יצירתיים וחלופיים להליך פלילי מלא, תוך התחשבות בצרכי הנאשם והקהילה. לאור תכלית זו, ובהתאם לסעיף 220יא לחוק סדר הדין הפלילי, נוכחות הנאשם אינה חובה בישיבת הכנה, וניתן לקיים אותה בנוכחות סניגורו בלבד, ובלבד שהנאשם ידע על סמכות בית המשפט לקיים ישיבות כאלה.',
    'טעות נפוצה היא לייחס לבתי המשפט הקהילתיים את אותה תכלית וסדרי דין כמו לבתי משפט פליליים רגילים, מבלי להבין את הייחודיות שלהם ואת ההקלות הפרוצדורליות הנובעות מכך.',
    '["בית משפט קהילתי", "ישיבת הכנה", "צדק מאחה", "שיקום", "חוק סדר הדין הפלילי", "הליכים חלופיים"]'::jsonb,
    '**וריאציה 1 — תכלית:** מה מטרת בית המשפט הקהילתי? ← צדק מאחה, שיקום, פתרון סכסוכים (ס'' 220י לחסד"פ). **וריאציה 2 — השפעה על נוכחות:** איך התכלית משפיעה על נוכחות? ← מאפשרת גמישות ואי-חובת נוכחות נאשם בישיבות הכנה (ס'' 220יא לחסד"פ). **וריאציה 3 — תנאים לאי-נוכחות:** מהם התנאים לאי-נוכחות? ← הזמנת סניגור ויידוע הנאשם על סמכות בית המשפט (ס'' 220יא לחסד"פ).',
    'תכלית קהילתית ← שיקום וצדק מאחה ← מאפשר אי-נוכחות נאשם בישיבות הכנה (בתנאים).',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 220י", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 220יא"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'הפרת תנאי אי-נוכחות נאשם', 3, 'בית המשפט הקהילתי קיים ישיבת הכנה ללא נוכחות הנאשם, אך סניגורו לא הוזמן לישיבה. מה הדין?',
    'שאלה זו בוחנת את ההשלכות של אי-עמידה בתנאים הקבועים בחוק לקיום ישיבת הכנה בבית משפט קהילתי ללא נוכחות הנאשם. היא מדגישה את חשיבותם של התנאים המצטברים להבטחת הליך תקין והוגן.',
    'סעיף 220יא לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע שני תנאים מצטברים לקיום ישיבת הכנה בבית המשפט הקהילתי ללא נוכחות הנאשם: (1) סניגורו הוזמן לישיבה; (2) בית המשפט יידע את הנאשם על סמכותו לקיים ישיבות הכנה כאמור טרם הדיונים לפניו. אי-עמידה באחד מתנאים אלו הופכת את הישיבה ללא כדין, ועל בית המשפט לבטלה ולקיים ישיבה חוזרת בהתאם לכללים, על מנת לשמור על זכויות הנאשם ועל תקינות ההליך.',
    'טעות נפוצה היא להתעלם מהאופי המצטבר של התנאים הקבועים בחוק, ולחשוב שדי בקיום אחד מהם כדי שהישיבה תהיה כדין.',
    '["בית משפט קהילתי", "ישיבת הכנה", "נוכחות נאשם", "זכויות נאשם", "הליך תקין", "חוק סדר הדין הפלילי"]'::jsonb,
    '**וריאציה 1 — תנאים מצטברים:** מהם התנאים לאי-נוכחות נאשם בישיבת הכנה קהילתית? ← הזמנת סניגור + יידוע הנאשם (ס'' 220יא לחסד"פ). **וריאציה 2 — הפרת תנאי:** מה קורה אם סניגור לא הוזמן? ← הישיבה אינה כדין. **וריאציה 3 — סעד:** מהו הסעד במקרה של הפרה? ← ביטול הישיבה וקיום חוזרת בהתאם לכללים.',
    'אי-נוכחות נאשם בקהילתי ← תנאים מצטברים ← הפרה ← ישיבה לא כדין.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 220יא"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'סמכות ועקרונות בית המשפט הקהילתי', 4, 'מהם סוגי העבירות שבהן מוסמך בית המשפט הקהילתי לדון, ומהם העקרונות המנחים את פעילותו?',
    'שאלה זו עוסקת בסמכות העניינית של בתי המשפט הקהילתיים ובעקרונות המנחים את פעילותם. היא בוחנת את ההבנה של המודל הייחודי של בתי משפט אלו, המשלב אכיפת חוק עם גישה שיקומית וקהילתית.',
    'סעיף 220י לחוק סדר הדין הפלילי [נוסח משולב], התשמ"ב-1982, קובע כי בית משפט קהילתי מוסמך לדון בעבירות חטא ועוון, וכן בעבירות פשע מסוימות שנקבעו בתקנות. העקרונות המנחים את פעילותו כוללים שיקום הנאשם, צדק מאחה, מעורבות הקהילה, ומתן מענה הוליסטי לבעיות העומדות בבסיס העבירה. מטרתו היא לצמצם את העבריינות החוזרת ולשלב את הנאשם בחברה, תוך שמירה על ביטחון הציבור.',
    'טעות נפוצה היא לבלבל בין סמכות בתי המשפט הקהילתיים לבין סמכות בתי המשפט הרגילים, או לייחס להם תכליות שאינן עולות בקנה אחד עם עקרונות הצדק המאחה והשיקום.',
    '["בית משפט קהילתי", "סמכות עניינית", "עבירות חטא ועוון", "צדק מאחה", "שיקום", "חוק סדר הדין הפלילי"]'::jsonb,
    '**וריאציה 1 — סוגי עבירות:** באילו עבירות דן בית משפט קהילתי? ← חטא, עוון, ופשע קל מסוים (ס'' 220י לחסד"פ). **וריאציה 2 — עקרונות מנחים:** מהם העקרונות המנחים? ← שיקום, צדק מאחה, מעורבות קהילה (ס'' 220י לחסד"פ). **וריאציה 3 — תכלית:** מהי התכלית הכוללת? ← צמצום עבריינות חוזרת ושילוב נאשם בחברה.',
    'בית משפט קהילתי ← עבירות קלות ← שיקום, צדק מאחה, קהילה.',
    '["חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 220י"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'קיימת חובת נוכחות של הנאשם, אלא אם בית המשפט פטר אותו מכך.', true, 'זו התשובה הנכונה, המשקפת את הכלל הקבוע בסעיף 143א(א) לחוק סדר הדין הפלילי, לפיו הנאשם חייב להיות נוכח בקדם משפט, אלא אם קיבל פטור.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'ניתן לקיים את הישיבה בלא נוכחות הנאשם, ובלבד שסניגורו הוזמן לישיבה.', false, 'תשובה זו מתארת את הדין החל על ישיבת הכנה בבית משפט קהילתי, ולא על קדם משפט רגיל.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'אין חובת נוכחות של הנאשם, ונוכחותו נתונה לשיקול דעתו.', false, 'תשובה זו שגויה, שכן קיימת חובת נוכחות של הנאשם בקדם משפט, אלא אם פוטר מכך.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'חובת נוכחות של הנאשם, אך רק אם הוא מיוצג על ידי סניגור.', false, 'חובת הנוכחות אינה תלויה בייצוג, אלא בנאשם עצמו, בכפוף לפטור מבית המשפט.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'התכלית היא לנהל משא ומתן על עסקת טיעון, ולכן נוכחות הנאשם חיונית.', false, 'ניהול משא ומתן על עסקת טיעון הוא רק חלק מתכלית הישיבה, ואינו הופך את נוכחות הנאשם לחיונית בכל מקרה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'התכלית היא קידום הליכים, בירור עמדות ופתרון סכסוכים בדרכים חלופיות, ולכן נוכחות הנאשם אינה חובה אלא אם נדרשת באופן ספציפי.', true, 'זו התשובה הנכונה, המבטאת את התכלית הייחודית של בתי המשפט הקהילתיים ואת ההשפעה שלה על דיני הנוכחות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'התכלית היא להבטיח את זכות הנאשם למשפט הוגן, ולכן נוכחותו חובה בכל שלבי ההליך.', false, 'אף שזכות למשפט הוגן חשובה, היא אינה מחייבת נוכחות פיזית של הנאשם בכל ישיבת הכנה, במיוחד כשיש ייצוג סניגורי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'התכלית היא להטיל סנקציות על הנאשם, ולכן נוכחותו נדרשת לצורך זיהוי.', false, 'הטלת סנקציות אינה התכלית העיקרית של ישיבת הכנה, ובתי המשפט הקהילתיים מתמקדים בפתרונות שיקומיים.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'הישיבה אינה כדין, ובית המשפט יצטרך לבטלה ולקיים ישיבה חוזרת בהתאם לכללים.', true, 'זו התשובה הנכונה, שכן אי-הזמנת הסניגור מפרה את אחד התנאים המצטברים לקיום ישיבת הכנה ללא נוכחות הנאשם, והופכת את הישיבה ללא תקינה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'הישיבה כדין, שכן נוכחות הנאשם אינה חובה בבית המשפט הקהילתי.', false, 'תשובה זו שגויה, שכן אי-חובת נוכחות הנאשם כפופה לתנאים, שאחד מהם הוא הזמנת הסניגור.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'הישיבה כדין, אך בית המשפט יצטרך ליידע את הנאשם על תוכנה בדיעבד.', false, 'יידוע בדיעבד אינו מרפא את הפגם באי-הזמנת הסניגור, שהיא תנאי מקדמי לקיום הישיבה ללא נוכחות הנאשם.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'הישיבה אינה כדין, אך ניתן לרפא את הפגם בהסכמת הנאשם בדיעבד.', false, 'הסכמה בדיעבד אינה יכולה לרפא פגם מהותי בהליך, במיוחד כאשר מדובר בזכויות יסוד של נאשם.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'עבירות פשע חמורות, תוך דגש על ענישה מחמירה והרתעה.', false, 'תשובה זו שגויה, שכן בתי המשפט הקהילתיים עוסקים בעבירות קלות יותר ומתמקדים בשיקום ולא בענישה מחמירה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'עבירות חטא ועוון, וכן עבירות פשע קלות מסוימות, תוך דגש על שיקום, צדק מאחה ומעורבות הקהילה.', true, 'זו התשובה הנכונה, המפרטת את סוגי העבירות ואת העקרונות המנחים את פעילות בתי המשפט הקהילתיים, כפי שקבוע בחוק.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'כל סוגי העבירות, אך רק אם הנאשם הביע הסכמה מפורשת לכך.', false, 'תשובה זו שגויה, שכן סמכות בית המשפט הקהילתי מוגבלת לסוגי עבירות מסוימים, ללא קשר להסכמת הנאשם.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'עבירות תעבורה בלבד, מתוך מטרה להקל על העומס בבתי המשפט הרגילים.', false, 'תשובה זו שגויה, שכן סמכות בתי המשפט הקהילתיים רחבה יותר מעבירות תעבורה, וכוללת עבירות חטא ועוון.', 4);

END $$;

-- ============================================================
-- Q7 — 2024-W-Q7 — chapter=execution subtopic=imprisonment_alimony
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q7';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q7 skipped: external_id % already exists', '2024-W-Q7';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'imprisonment_alimony';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'imprisonment_alimony';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q7', 'b3904dc7-882d-48fc-9f3c-ba89fc453003', v_subtopic_id,
    'ראובן פתח תיק ההוצאה לפועל נגד משה בגין חוב על סך 50,000 ש"ח. ראובן יודע שלמשה יש אישה וילדים ושבזמן האחרון התגלע ביניהם סכסוך. הוא חושש כי אם יש פסק דין מזונות כנגד משה, הדבר יקשה עליו לגבות את הכסף. ראובן פונה ללשכת ההוצאה לפועל בבקשה לקבל מידע על קיום תיק מזונות לפי סעיף 7ב3 לחוק ההוצאה לפועל, ואכן מקבל מידע שנגד החייב מתנהל תיק מזונות. משה חושב שאין די בכך ועל מנת לשקול כדאיות ההליך שהוא אמור לנקוט, פונה שוב ללשכת ההוצאה לפועל בבקשה לקבל מידע נוסף על גובה החוב והסדרי תשלומי המזונות. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 7}'::jsonb,
    'שאלה זו עוסקת בזכותו של זוכה לקבל מידע על חובות מזונות של חייב, ובפרט על האפשרות לקבל מידע על גובה חוב המזונות לאחר שקיבל מידע על עצם קיומו. היא מתייחסת להוראות סעיפים 7ב3 ו-7ב4 לחוק ההוצאה לפועל, המאזנים בין הצורך של הזוכה במידע לבין ההגנה על פרטיות החייב.',
    'סעיף 7ב3 לחוק ההוצאה לפועל, תשכ"ז-1967, מאפשר לזוכה לקבל מידע על עצם קיומו של חוב מזונות בתיק הוצאה לפועל אחר המתנהל נגד החייב, בתנאים מסוימים. לאחר שקיבל מידע זה, סעיף 7ב4 לחוק קובע כי הזוכה רשאי להגיש בקשה לרשם ההוצאה לפועל לקבלת מידע בדבר גובה חוב המזונות. הרשם מוסמך למסור מידע זה, אך זאת לאחר שנתן לחייב הזדמנות לטעון את טענותיו בכתב, הביא בחשבון את הפגיעה בפרטיותו ובפרטיות בני משפחתו, ושוכנע כי המידע הנוסף נחוץ ומוצדק בנסיבות העניין. סעיף 7ב3(א) לחוק ההוצאה לפועל, תשכ"ז-1967סעיף 7ב4(א) לחוק ההוצאה לפועל, תשכ"ז-1967סעיף 7ב4(ב) לחוק ההוצאה לפועל, תשכ"ז-1967דוד בר-אופיר הוצאה לפועל הליכים והלכות - כרך א (2025) | מסלול מזונות (פרק א''2 לחוק ההוצאה לפועל: הוצאה לפועל במסלול מזונות - הוראת שעה) - קבלת מידע על קיומו של חוב מזונות - מסירת מידע על גובה חוב מזונות',
    'טעות נפוצה היא לחשוב שקבלת מידע על עצם קיום חוב מזונות מסיימת את הליך קבלת המידע, או שרשם ההוצאה לפועל אינו מוסמך למסור מידע נוסף על גובה החוב, מבלי להתחשב בתנאים ובשיקול הדעת הקבועים בחוק.',
    '["חוב מזונות", "קבלת מידע", "גובה חוב", "חוק ההוצאה לפועל", "פרטיות החייב", "שיקול דעת רשם"]'::jsonb,
    '**וריאציה 1 — מידע על קיום חוב:** האם זוכה יכול לקבל מידע על עצם קיום חוב מזונות? ← כן, לפי סעיף 7ב3 לחוק ההוצאה לפועל. **וריאציה 2 — מידע על גובה חוב:** האם זוכה יכול לבקש מידע על גובה חוב המזונות? ← כן, לפי סעיף 7ב4 לחוק ההוצאה לפועל. **וריאציה 3 — תנאי למסירה:** מהם התנאים למסירת מידע על גובה חוב? ← תגובת החייב, איזון פרטיות, נחיצות ומוצדקות המידע (ס'' 7ב4(ב) לחוק).',
    'זוכה יכול לבקש מידע על קיום חוב מזונות (7ב3) ובהמשך על גובהו (7ב4), בכפוף לשיקול דעת הרשם ותגובת החייב.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 7ב3", "חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 7ב4", "דוד בר-אופיר, הוצאה לפועל הליכים והלכות - כרך א (2025), פרק ח'': מימוש פסקי דין למזונות", "תקנות ההוצאה לפועל, תש\"ם-1979, תקנה 23ד4"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'עם קבלת המידע הראשוני ההליך הסתיים ואין מקום לבקשה נוספת בעניין.', false, 'תשובה זו שגויה, שכן החוק מאפשר לזוכה לבקש מידע נוסף על גובה חוב המזונות לאחר שקיבל מידע על עצם קיומו.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'מאחר שהחוב של משה הוא פחות מ-100,000 ש"ח - אין סמכות להיעתר לבקשה.', false, 'תשובה זו שגויה, שכן סמכות הרשם למסור מידע על גובה חוב מזונות אינה מוגבלת בסכום חוב מסוים של החייב, אלא תלויה בשיקול דעתו ובתנאים נוספים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'אם זוכה מעוניין לדעת מהו גובה חוב המזונות, עליו לפנות לבית המשפט לענייני משפחה שנתן את פסק הדין בעניין זה, ולהגיש בקשה מתאימה.', false, 'תשובה זו שגויה, שכן סעיף 7ב4 לחוק ההוצאה לפועל מסמיך את רשם ההוצאה לפועל למסור מידע על גובה חוב המזונות, ולא מחייב פנייה לבית המשפט.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הרשם מוסמך להחליט בבקשה לאחר שיקבל את תגובת החייב.', true, 'זו התשובה הנכונה, המשקפת את הוראות סעיף 7ב4 לחוק ההוצאה לפועל, המאפשר לזוכה לבקש מידע על גובה חוב המזונות, וקובע כי הרשם יחליט בבקשה לאחר שנתן לחייב הזדמנות לטעון את טענותיו בכתב.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'קבלת מידע על תיקי חייב כזוכה', 1, 'זוכה בתיק הוצאה לפועל מבקש לקבל רשימה של תיקים בהם החייב מופיע כזוכה. האם רשם ההוצאה לפועל רשאי למסור מידע זה?',
    'שאלה זו עוסקת בסמכות רשם ההוצאה לפועל למסור מידע על תיקים בהם החייב הוא זוכה, תוך התייחסות להוראות סעיף 7ב לחוק ההוצאה לפועל והתוספת השנייה לו. היא מדגישה את ההבחנה בין מידע על החייב כזוכה לבין מידע על החייב כחייב.',
    'סעיף 7ב(א2) לחוק ההוצאה לפועל, תשכ"ז-1967, קובע כי רשם ההוצאה לפועל רשאי לצוות על גורמים המפורטים בטור א'' בחלק א'' בתוספת השנייה למסור לידיו מידע על החייב המצוי בידו בהתאם למפורט בטור ב'' לצדו, אף שלא על יסוד כתב ויתור על סודיות, ובלבד שהחייב הוא בעל יכולת המשתמט מתשלום חובותיו. פרט 22 בתוספת השנייה, תחת ''מערכת ההוצאה לפועל'' כ''גורם'', קובע כי סוג המידע שניתן לקבל הוא ''מספר תיק ההוצאה לפועל שפתח החייב כזוכה''. מכאן, שרשם ההוצאה לפועל רשאי למסור מידע על תיקים בהם החייב מופיע כזוכה, לרבות תיקים שנסגרו מכוח הוראת שעה, כפי שנקבע בפסיקה. רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)סעיף 7ב(א2) לחוק ההוצאה לפועל, תשכ"ז-1967',
    'טעות נפוצה היא להניח שכל מידע על החייב, בין אם כזוכה ובין אם כחייב, חסוי באותה מידה, או שרשם ההוצאה לפועל אינו מוסמך למסור מידע על תיקים בהם החייב הוא זוכה.',
    '["צו למסירת מידע", "חוק ההוצאה לפועל", "תוספת שנייה", "פרטיות החייב", "איזון זכויות", "רשם הוצאה לפועל"]'::jsonb,
    '**וריאציה 1 — מידע על חייב כזוכה:** האם ניתן לקבל מידע על תיקים בהם החייב הוא זוכה? ← כן, לפי סעיף 7ב(א2) ופרט 22 לתוספת השנייה (פלוני נ'' אלמוני). **וריאציה 2 — מידע על חייב כחייב:** האם ניתן לקבל מידע על תיקים בהם החייב הוא חייב? ← לא, מידע זה אינו נכלל בטור ב'' של פרט 22 (פלוני נ'' אלמוני). **וריאציה 3 — רשימה סגורה:** האם רשם ההוצאה לפועל יכול להוסיף גורמים או סוגי מידע? ← לא, הרשימה בתוספת השנייה היא רשימה סגורה (פלוני נ'' אלמוני).',
    'מידע על תיקי חייב כזוכה – כן; כחייב – לא; הרשימה סגורה.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 7ב(א2)", "רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'איזון בין זכויות זוכה לפרטיות חייב', 2, 'מהו העיקרון המנחה את רשם ההוצאה לפועל בעת הפעלת סמכותו למסירת מידע על חייב, ובפרט כיצד הוא מאזן בין זכויות הזוכה לפרטיות החייב?',
    'שאלה זו בוחנת את עקרון האיזון המנחה את רשם ההוצאה לפועל בעת הפעלת סמכותו למסירת מידע על חייב. היא מדגישה את הצורך במידתיות ובשמירה על פרטיות החייב, לצד מתן כלים לזוכה לגביית חובו.',
    'הפעלת סמכותו של רשם ההוצאה לפועל למסירת מידע על חייב, לפי סעיף 7ב לחוק ההוצאה לפועל, מחייבת עריכת איזון מידתי בין השאיפה ליתן בידי הזוכה כלים לגביית חובו לבין השאיפה להגן על פרטיותו של החייב. המידע נמסר תחילה לרשם ההוצאה לפועל בלבד, והוא רשאי להביא לידיעת הזוכה מידע על קיום נכס ופרטיו, מבלי לחשוף את מקור המידע. הרשימה המופיעה בתוספת השנייה לחוק היא בגדר ''רשימה סגורה'', ואין בסמכות רשם ההוצאה לפועל להוסיף לה גורמים או סוגי מידע שלא אוזכרו בה. רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)שלום עכו 5809-09-21 ג''מינה מוסא נ'' גל בדארנה בע"מ (10.04.2022)',
    'טעות נפוצה היא להתעלם מהצורך באיזון ומההגנה על פרטיות החייב, או לחשוב שרשם ההוצאה לפועל יכול למסור כל מידע שיסייע לגביית החוב, ללא מגבלות חוקיות.',
    '["איזון זכויות", "פרטיות החייב", "צו למסירת מידע", "חוק ההוצאה לפועל", "רשימה סגורה", "מידתיות"]'::jsonb,
    '**וריאציה 1 — עקרון מנחה:** מהו העיקרון המנחה למסירת מידע? ← איזון מידתי בין גביית חוב לפרטיות החייב (פלוני נ'' אלמוני). **וריאציה 2 — היקף המידע:** האם רשם יכול למסור כל מידע? ← לא, רק מידע המפורט ברשימה סגורה בתוספת השנייה (פלוני נ'' אלמוני). **וריאציה 3 — תפקיד הרשם:** מה תפקיד הרשם במסירת מידע? ← לקבל את המידע תחילה ורק אז להביא לידיעת הזוכה פרטים רלוונטיים (פלוני נ'' אלמוני).',
    'רשם מאזן בין גבייה לפרטיות; מידע מוגבל לרשימה סגורה; מידתיות.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 7ב", "רשם ההוצאה לפועל ירושלים 507548-05-15 פלוני נ'' אלמוני (16.11.2016)", "שלום עכו 5809-09-21 ג''מינה מוסא נ'' גל בדארנה בע\"מ (10.04.2022)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'מידע על חוב מזונות במסלול מקוצר', 3, 'זוכה מנהל תיק הוצאה לפועל במסלול המקוצר נגד חייב. הוא מבקש לקבל מידע על קיומו של חוב מזונות בתיק הוצאה לפועל אחר המתנהל נגד אותו חייב. האם רשם ההוצאה לפועל רשאי למסור מידע זה, ומהם התנאים לכך?',
    'שאלה זו מתמקדת בחריג לכללים הרגילים של קבלת מידע על חוב מזונות, החל על תיקים המתנהלים במסלול המקוצר. היא בוחנת את התנאים המיוחדים המאפשרים לזוכה לקבל מידע זה, ואת שיקול דעתו של רשם ההוצאה לפועל.',
    'סעיף 7ב3(ג) לחוק ההוצאה לפועל, תשכ"ז-1967, קובע חריג להוראות הכלליות של קבלת מידע על קיומו של חוב מזונות. על אף האמור בסעיפים קטנים (א) ו-(ב) לאותו סעיף, אם תיק ההוצאה לפועל מתנהל במסלול המקוצר לפי פרק א''1, רשם ההוצאה לפועל רשאי, לבקשת הזוכה, להעביר לידיו מידע על קיומו של חוב מזונות בתיק הוצאה לפועל אחר המתנהל נגד החייב, ובלבד שסבר כי הדבר נחוץ לשם החלטה של הזוכה אם המשך ניהול התיק יהיה במסלול המקוצר כאמור. סעיף 7ב3(ג) לחוק ההוצאה לפועל, תשכ"ז-1967דוד בר-אופיר הוצאה לפועל הליכים והלכות - כרך א (2025) | מסלול מזונות (פרק א''2 לחוק ההוצאה לפועל: הוצאה לפועל במסלול מזונות - הוראת שעה) - קבלת מידע על קיומו של חוב מזונות - מסירת מידע על גובה חוב מזונותנבו - המתמחה דיני הוצאה לפועל (2026) | צו למסירת מידע מגורמים שלישיים',
    'טעות נפוצה היא להניח שכל התנאים המצטברים של סעיף 7ב3(א) חלים באופן גורף, מבלי להכיר את החריג הספציפי לתיקים המתנהלים במסלול המקוצר.',
    '["חוב מזונות", "מסלול מקוצר", "קבלת מידע", "חוק ההוצאה לפועל", "שיקול דעת רשם", "הליכי הוצאה לפועל"]'::jsonb,
    '**וריאציה 1 — מסלול מקוצר:** האם בתיק במסלול מקוצר חלים כל תנאי 7ב3(א)? ← לא, קיים חריג בסעיף 7ב3(ג) לחוק. **וריאציה 2 — תנאי החריג:** מהו התנאי למסירת מידע במסלול מקוצר? ← נחיצות המידע להחלטה על המשך ניהול התיק במסלול המקוצר (ס'' 7ב3(ג) לחוק). **וריאציה 3 — סמכות:** מי מוסמך להחליט? ← רשם ההוצאה לפועל (ס'' 7ב3(ג) לחוק).',
    'במסלול מקוצר, רשם יכול למסור מידע על קיום מזונות אם נחוץ להחלטה על המשך המסלול.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 7ב3(ג)", "דוד בר-אופיר, הוצאה לפועל הליכים והלכות - כרך א (2025), פרק ח'': מימוש פסקי דין למזונות", "נבו - המתמחה, דיני הוצאה לפועל (2026), פרק ב - מבנה מערכת ההוצאה לפועל"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'השפעת חוב מזונות על איחוד תיקים', 4, 'חייב מבקש לאחד את כל תיקי ההוצאה לפועל המתנהלים נגדו. בין התיקים קיים גם תיק מזונות. האם ניתן לאחד את תיק המזונות עם שאר התיקים?',
    'שאלה זו עוסקת במעמדו המיוחד של חוב מזונות בהליכי הוצאה לפועל, ובפרט בהשפעתו על בקשות לאיחוד תיקים. היא מדגישה את העדיפות שניתנה לחוב מזונות על פני חובות אחרים, ואת ההחרגה שלו מהליכי איחוד תיקים.',
    'חוב מזונות נהנה ממעמד מיוחד בדיני ההוצאה לפועל, וזאת לאור אופיו הקיומי והחברתי. המחוקק ראה לנכון להעניק עדיפות לגביית חוב מזונות על פני חובות אחרים. בהתאם לכך, סעיף 74א לחוק ההוצאה לפועל, תשכ"ז-1967, קובע כי ''תיק'' לצורך איחוד תיקים אינו כולל ''תיק מזונות''. המשמעות היא שלא ניתן לבקש איחוד תיקים הכולל חוב מזונות, והדבר נועד ליתן עדיפות לגביית חוב המזונות. רע"א 631/07 פלוני נ'' המוסד לביטוח לאומי (21.05.2009)רע"א 631/07 פלוני נ'' המוסד לביטוח לאומי (21.05.2009)ארצי חיפה 34462-04-22 מאיר מסנגאו מהרט - המוסד לביטוח לאומי (18.12.2023)סעיף 74יא(ב) לחוק ההוצאה לפועל, תשכ"ז-1967',
    'טעות נפוצה היא להניח שכל התיקים ניתנים לאיחוד, מבלי להכיר את ההחרגה הספציפית של תיקי מזונות בשל מעמדם המיוחד.',
    '["חוב מזונות", "איחוד תיקים", "מעמד מיוחד", "חוק ההוצאה לפועל", "עדיפות גבייה", "רכיב קיומי"]'::jsonb,
    '**וריאציה 1 — איחוד תיקים:** האם ניתן לאחד תיק מזונות? ← לא, תיק מזונות מוחרג מהגדרת ''תיק'' לאיחוד (רע"א 631/07 פלוני). **וריאציה 2 — טעם ההחרגה:** מדוע מוחרג תיק מזונות? ← בשל מעמדו המיוחד כרכיב קיומי ועדיפותו בגבייה (רע"א 631/07 פלוני). **וריאציה 3 — סמכות:** מי מוסמך לצוות על איחוד תיקים? ← רשם ההוצאה לפועל (ס'' 74יא לחוק ההוצאה לפועל).',
    'תיק מזונות ← לא ניתן לאיחוד תיקים ← בשל מעמדו המיוחד ועדיפותו.',
    '["חוק ההוצאה לפועל, תשכ\"ז-1967, סעיף 74א", "רע\"א 631/07 פלוני נ'' המוסד לביטוח לאומי (21.05.2009)", "ארצי חיפה 34462-04-22 מאיר מסנגאו מהרט - המוסד לביטוח לאומי (18.12.2023)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כן, רשם ההוצאה לפועל רשאי למסור מידע על תיקים בהם החייב מופיע כזוכה, לרבות תיקים שנסגרו מכוח הוראת שעה.', true, 'זו התשובה הנכונה, המשקפת את הוראת סעיף 7ב(א2) לחוק ההוצאה לפועל, יחד עם פרט 22 בתוספת השנייה, המאפשרים קבלת מידע על תיקים בהם החייב הוא זוכה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'לא, רשם ההוצאה לפועל אינו רשאי למסור מידע על תיקים בהם החייב מופיע כזוכה, אלא רק על תיקים בהם הוא חייב.', false, 'תשובה זו שגויה, שכן רשם ההוצאה לפועל רשאי למסור מידע על תיקים בהם החייב הוא זוכה, אך לא על תיקים בהם הוא חייב.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אך רק אם החייב חתם על כתב ויתור על סודיות.', false, 'תשובה זו שגויה, שכן סעיף 7ב(א2) לחוק ההוצאה לפועל מאפשר מסירת מידע זה גם ללא כתב ויתור על סודיות, בתנאים מסוימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, מידע על תיקים בהם החייב מופיע כזוכה אינו נכלל ברשימה הסגורה של סוגי המידע שניתן למסור.', false, 'תשובה זו שגויה, שכן מידע על תיקים בהם החייב מופיע כזוכה אכן נכלל ברשימה הסגורה של סוגי המידע שניתן למסור, בפרט 22 לתוספת השנייה.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'האיזון מוטה באופן מובהק לטובת הזוכה, שכן זכותו לגביית חוב מעוגנת בפסק דין סופי.', false, 'תשובה זו שגויה, שכן אף שזכות הזוכה חשובה, קיים צורך באיזון עם פרטיות החייב, ולא הטיה מובהקת לטובת הזוכה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'רשם ההוצאה לפועל נדרש לערוך איזון מידתי בין השאיפה ליתן לזוכה כלים לגביית חובו לבין ההגנה על פרטיות החייב, תוך שמירה על רשימה סגורה של גורמים וסוגי מידע.', true, 'זו התשובה הנכונה, המבטאת את עקרון האיזון המידתי ואת המגבלות הקבועות בחוק על מסירת מידע, כפי שנקבע בפסיקה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'פרטיות החייב גוברת תמיד על זכות הזוכה לגביית חוב, ולכן מידע יימסר רק במקרים חריגים ובהסכמת החייב.', false, 'תשובה זו שגויה, שכן פרטיות החייב אינה גוברת תמיד, וניתן למסור מידע גם ללא הסכמתו בתנאים מסוימים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'רשם ההוצאה לפועל רשאי למסור כל מידע שיש בידו על החייב, כל עוד הוא סבור שהדבר יסייע לגביית החוב.', false, 'תשובה זו שגויה, שכן סמכות הרשם מוגבלת לרשימה סגורה של גורמים וסוגי מידע, ואינה סמכות כללית.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'לא, מידע על חוב מזונות יימסר רק אם מתקיימים כל התנאים המצטברים שבסעיף 7ב3(א) לחוק, ללא קשר למסלול התיק.', false, 'תשובה זו שגויה, שכן סעיף 7ב3(ג) לחוק קובע חריג לתנאים אלו במקרה של תיק המתנהל במסלול המקוצר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'כן, רשם ההוצאה לפועל רשאי למסור את המידע, ובלבד שסבר כי הדבר נחוץ לשם החלטה של הזוכה אם להמשיך לנהל את התיק במסלול המקוצר.', true, 'זו התשובה הנכונה, המשקפת את הוראת סעיף 7ב3(ג) לחוק ההוצאה לפועל, המאפשרת גמישות במסירת מידע על חוב מזונות בתיקים במסלול מקוצר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, אך רק אם חוב המזונות עולה על 15,000 ש"ח, ללא קשר למסלול התיק.', false, 'תשובה זו שגויה, שכן תנאי הסכום הוא אחד התנאים הכלליים בסעיף 7ב3(א), אך סעיף 7ב3(ג) קובע חריג לכך במסלול המקוצר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, מידע על חוב מזונות הוא חסוי ואינו ניתן למסירה לזוכה בשום מקרה.', false, 'תשובה זו שגויה, שכן החוק מאפשר מסירת מידע על חוב מזונות בתנאים מסוימים, תוך איזון בין פרטיות החייב לצורך הזוכה.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'כן, ניתן לאחד את כל התיקים, כולל תיק המזונות, כדי להקל על החייב ולייעל את הליכי הגבייה.', false, 'תשובה זו שגויה, שכן חוב מזונות נהנה ממעמד מיוחד ואינו ניתן לאיחוד תיקים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'לא, תיק מזונות אינו נכלל בהגדרת ''תיק'' לצורך איחוד תיקים, בשל מעמדו המיוחד של חוב המזונות.', true, 'זו התשובה הנכונה, המבטאת את הוראת סעיף 74א לחוק ההוצאה לפועל, הקובעת כי תיק מזונות מוחרג מהאפשרות לאיחוד תיקים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'כן, אך רק אם הזוכה בתיק המזונות מסכים לאיחוד התיקים.', false, 'תשובה זו שגויה, שכן ההחרגה של תיק מזונות מאיחוד תיקים היא קבועה בחוק ואינה תלויה בהסכמת הזוכה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'לא, אלא אם כן חוב המזונות נמוך מסכום מסוים שנקבע בתקנות.', false, 'תשובה זו שגויה, שכן ההחרגה של תיק מזונות מאיחוד תיקים אינה תלויה בסכום החוב.', 4);

END $$;

-- ============================================================
-- Q8 — 2024-W-Q8 — chapter=civil_proc subtopic=class_actions
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q8';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q8 skipped: external_id % already exists', '2024-W-Q8';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'class_actions';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'class_actions';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q8', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'חברה פרטית הגישה בקשה לאישור תובענה ייצוגית נגד המוסד לביטוח לאומי, בטענה כי המוסד גבה דמי ביטוח לאומי בגביית יתר. לאיזו ערכאה נתונה הסמכות לדון בבקשה?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 8}'::jsonb,
    'שאלה זו עוסקת בסמכות העניינית לדון בתובענה ייצוגית המוגשת נגד המוסד לביטוח לאומי בגין גביית יתר של דמי ביטוח לאומי. היא מדגישה את הכלל הייחודי שנקבע בפסיקה, לפיו בית הדין האזורי לעבודה הוא הערכאה המוסמכת לדון בתביעות מסוג זה, גם כאשר הן כוללות שאלות בעלות אופי מינהלי, וזאת בשל מומחיותו המיוחדת בענייני ביטחון סוציאלי.',
    'הסמכות העניינית לדון בתובענה ייצוגית נגד המוסד לביטוח לאומי בגין גביית יתר של דמי ביטוח לאומי נתונה לבית הדין האזורי לעבודה. זאת, מכוח סעיף 24(א)(5) לחוק בית הדין לעבודה, התשכ"ט-1969, המקנה לבית הדין סמכות ייחודית לדון בכל עניין שמוענקת לו סמכות על פי חוק הביטוח הלאומי. הלכת טישמן (רע"א 5338/20), שצוטטה בפסק הדין שגב רודל (ת"צ 3248-04-23), קבעה כי הוראה זו גוברת על הוראת סעיף 5(ב)(2) לחוק תובענות ייצוגיות, המקנה סמכות לבית המשפט לעניינים מינהליים בתביעות השבה נגד רשות. בית המשפט העליון הדגיש את מומחיותו המיוחדת של בית הדין לעבודה בענייני ביטחון סוציאלי, וקבע כי הוא מוסמך לדון בסוגיות של פרשנות חוק הביטוח הלאומי גם אם יש בהן שאלות מתחום המשפט המנהלי. תביעה בגין גביית יתר של דמי ביטוח לאומי נחשבת לתביעת השבה של ''תשלום חובה אחר'' לפי פרט 11 לתוספת השנייה לחוק תובענות ייצוגיות, והיא נכללת בסמכות בית הדין לעבודה. סעיף 24(א)(5) לחוק בית הדין לעבודה, תשכ"ט-1969ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)ת"צ (עבודה ירושלים) 2001-12-22 דניאל כהן - המוסד לביטוח לאומי (19.3.2026)',
    'טעות נפוצה היא לבלבל בין הסמכות העניינית הכללית לדון בתביעות השבה נגד רשות (בית המשפט לעניינים מינהליים) לבין הסמכות הייחודית לדון בתביעות נגד המוסד לביטוח לאומי (בית הדין לעבודה), במיוחד כאשר מדובר בתובענות ייצוגיות.',
    '["סמכות עניינית", "תובענה ייצוגית", "מוסד לביטוח לאומי", "גביית יתר", "חוק בית הדין לעבודה", "הלכת טישמן"]'::jsonb,
    '**וריאציה 1 — סמכות כללית:** לאיזו ערכאה סמכות לדון בתביעת השבה נגד רשות? ← בית המשפט לעניינים מינהליים (ס'' 5(ב)(2) לחוק תובענות ייצוגיות). **וריאציה 2 — סמכות נגד המוסד לביטוח לאומי:** לאיזו ערכאה סמכות לדון בתביעת השבה נגד המוסד לביטוח לאומי? ← בית הדין לעבודה (ס'' 24(א)(5) לחוק בית הדין לעבודה והלכת טישמן). **וריאציה 3 — רציונל:** מהו הרציונל להבחנה? ← מומחיותו הייחודית של בית הדין לעבודה בענייני ביטחון סוציאלי (ת"צ 3248-04-23 שגב רודל).',
    'תובענה ייצוגית נגד המוסד לביטוח לאומי בגין גביית יתר ← סמכות בית הדין לעבודה.',
    '["חוק בית הדין לעבודה, תשכ\"ט-1969, סעיף 24", "ת\"צ (אזורי ת\"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)", "ת\"צ (אזורי ת\"א) 60942-12-20 מיכאל שמואל נשר - המוסד לביטוח לאומי (12.8.2022)", "ת\"צ (עבודה ירושלים) 2001-12-22 דניאל כהן - המוסד לביטוח לאומי (19.3.2026)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית הדין האזורי לעבודה.', true, 'זו התשובה הנכונה, שכן הסמכות לדון בתובענות ייצוגיות נגד המוסד לביטוח לאומי בענייני גביית יתר של תשלומי חובה נתונה לבית הדין האזורי לעבודה, מכוח סעיף 24(א)(5) לחוק בית הדין לעבודה והלכת טישמן.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים.', false, 'תשובה זו שגויה. אף שתביעות השבה נגד רשות בגין גביית יתר נדונות בדרך כלל בבית המשפט לעניינים מינהליים (סעיף 5(ב)(2) לחוק תובענות ייצוגיות), הרי שלגבי המוסד לביטוח לאומי, הסמכות הייחודית נתונה לבית הדין לעבודה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית משפט השלום או המחוזי, בהתאם לגובה הסעד הכספי הנדרש לקבוצה כולה.', false, 'תשובה זו שגויה. סמכות עניינית בתובענות ייצוגיות אינה נקבעת לפי גובה הסעד הכספי, אלא לפי סוג העניין והרשות הנתבעת.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית המשפט המחוזי בשבתו כבית משפט אזרחי.', false, 'תשובה זו שגויה. תביעות נגד רשויות ציבוריות, ובפרט המוסד לביטוח לאומי, אינן נדונות בבית המשפט המחוזי בכובעו האזרחי הרגיל, אלא בערכאה ייעודית.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'סמכות עניינית בתביעת השבה נגד רשות שאינה הביטוח הלאומי', 1, 'תובענה ייצוגית הוגשה נגד עירייה בגין גביית ארנונה ביתר. לאיזו ערכאה נתונה הסמכות לדון בבקשה לאישור תובענה ייצוגית זו?',
    'שאלה זו בוחנת את ההבחנה בסמכות העניינית בין תובענות ייצוגיות נגד המוסד לביטוח לאומי לבין תובענות ייצוגיות נגד רשויות ציבוריות אחרות, כגון רשויות מקומיות. היא מדגישה את הכלל לפיו תביעות השבה נגד רשות ציבורית נדונות בבית המשפט לעניינים מינהליים, למעט החריג של המוסד לביטוח לאומי.',
    'סעיף 5(ב)(2) לחוק תובענות ייצוגיות, התשס"ו-2006, קובע כי תובענה ייצוגית נגד רשות להשבת סכומים שגבתה שלא כדין כמס, אגרה או תשלום חובה אחר, תוגש לבית המשפט לעניינים מינהליים. במקרה של תביעה נגד עירייה בגין גביית ארנונה ביתר, מדובר בתשלום חובה שנגבה על ידי רשות מקומית, ולכן הסמכות העניינית נתונה לבית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים. זאת, בניגוד למקרה של המוסד לביטוח לאומי, לגביו נקבע בהלכת טישמן כי הסמכות נתונה לבית הדין לעבודה. סעיף 24(א)(5) לחוק בית הדין לעבודה, תשכ"ט-1969ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)',
    'טעות נפוצה היא להחיל את הכלל הספציפי לגבי המוסד לביטוח לאומי (סמכות בית הדין לעבודה) על כלל הרשויות הציבוריות, מבלי להבחין בין סוגי הרשויות וסוגי התשלומים.',
    '["סמכות עניינית", "תובענה ייצוגית", "רשות ציבורית", "תשלום חובה", "בית משפט לעניינים מינהליים", "חוק תובענות ייצוגיות"]'::jsonb,
    '**וריאציה 1 — נגד המוסד לביטוח לאומי:** לאיזו ערכאה סמכות בתביעת השבה נגד המוסד לביטוח לאומי? ← בית הדין לעבודה (ס'' 24(א)(5) לחוק בית הדין לעבודה והלכת טישמן). **וריאציה 2 — נגד עירייה:** לאיזו ערכאה סמכות בתביעת השבה נגד עירייה? ← בית המשפט לעניינים מינהליים (ס'' 5(ב)(2) לחוק תובענות ייצוגיות). **וריאציה 3 — רציונל ההבחנה:** מהו הרציונל להבחנה? ← מומחיותו הייחודית של בית הדין לעבודה בענייני ביטחון סוציאלי (ת"צ 3248-04-23 שגב רודל).',
    'תובענה ייצוגית השבה נגד רשות ← אם ביטוח לאומי: בית הדין לעבודה; אם רשות אחרת: בית המשפט לעניינים מינהליים.',
    '["חוק בית הדין לעבודה, תשכ\"ט-1969, סעיף 24(א)(5)", "חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 5(ב)(2)", "ת\"צ (אזורי ת\"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'מבחן הסמכות העניינית בתובענות ייצוגיות נגד המוסד לביטוח לאומי', 2, 'מהו המבחן המנחה לקביעת הסמכות העניינית בתובענה ייצוגית המוגשת נגד המוסד לביטוח לאומי, כאשר עולות בה שאלות מתחום המשפט המנהלי?',
    'שאלה זו מתמקדת במבחן הסמכות העניינית הייחודי לתובענות ייצוגיות נגד המוסד לביטוח לאומי, כפי שנקבע בהלכת טישמן. היא מדגישה את העיקרון של מומחיות בית הדין לעבודה בענייני ביטחון סוציאלי, הגובר על שאלות בעלות אופי מינהלי.',
    'בהלכת טישמן (רע"א 5338/20), שצוטטה והובהרה בפסק הדין שגב רודל (ת"צ 3248-04-23), נקבע כי הוראת סעיף 24(א)(5) לחוק בית הדין לעבודה גוברת על הוראת סעיף 5(ב)(2) לחוק תובענות ייצוגיות, גם אם בקשת האישור טומנת בחובה שאלות מנהליות. זאת, בין היתר, נוכח מומחיותו המיוחדת של בית הדין לעבודה בענייני ביטחון סוציאלי. המבחן המנחה הוא האם העילה ''עולה מהחוק'' של הביטחון הסוציאלי, ובמקרה כזה הסמכות נתונה לבית הדין לעבודה. ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)סעיף 24(א)(5) לחוק בית הדין לעבודה, תשכ"ט-1969',
    'הטעות הנפוצה היא להתמקד באופי המנהלי של השאלות ולשכוח את העיקרון המכריע של מומחיות בית הדין לעבודה בענייני ביטחון סוציאלי, כפי שנקבע בהלכת טישמן.',
    '["סמכות עניינית", "הלכת טישמן", "מומחיות בית הדין לעבודה", "ביטחון סוציאלי", "משפט מנהלי", "חוק בית הדין לעבודה"]'::jsonb,
    '**וריאציה 1 — שאלות מנהליות:** האם שאלות מנהליות שוללות סמכות בית הדין לעבודה בתביעה נגד המוסד לביטוח לאומי? ← לא, מומחיות בית הדין גוברת (הלכת טישמן, ת"צ 3248-04-23). **וריאציה 2 — מבחן ''עולה מהחוק'':** מהו המבחן המנחה? ← האם העילה ''עולה מהחוק'' של הביטחון הסוציאלי (ת"צ 3248-04-23). **וריאציה 3 — סעיף רלוונטי:** איזה סעיף בחוק בית הדין לעבודה מקנה סמכות זו? ← סעיף 24(א)(5) (חוק בית הדין לעבודה).',
    'סמכות נגד המוסד לביטוח לאומי ← בית הדין לעבודה ← גם אם שאלות מנהליות ← בשל מומחיות.',
    '["חוק בית הדין לעבודה, תשכ\"ט-1969, סעיף 24(א)(5)", "ת\"צ (אזורי ת\"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'תובענה ייצוגית נגד המוסד לביטוח לאומי בעילה נזיקית', 3, 'חברה פרטית הגישה בקשה לאישור תובענה ייצוגית נגד המוסד לביטוח לאומי, בטענה להפליה בתשלום קצבאות מכוח חוק איסור הפליה במוצרים, בשירותים ובכניסה למקומות בידור ולמקומות ציבוריים. לאיזו ערכאה נתונה הסמכות לדון בעילה זו?',
    'שאלה זו עוסקת בחריג לסמכותו הייחודית של בית הדין לעבודה לדון בתביעות נגד המוסד לביטוח לאומי. היא מדגישה כי עילות נזיקיות, ובפרט אלו המבוססות על חוק איסור הפליה במוצרים, אינן בסמכות בית הדין לעבודה, ועל כן נדונות בבית המשפט האזרחי.',
    'פסק הדין שגב רודל (ת"צ 3248-04-23) קבע במפורש כי בית הדין לעבודה אינו מוסמך לדון בטענה כי המוסד לביטוח לאומי הפר את הוראת סעיף 3(א) לחוק איסור הפליה במוצרים, שכן חוק זה עוסק בפיצוי בגין ביצוע עוולה נזיקית. המוסד לביטוח לאומי אינו נחשב ''מספק שירות פיננסי'' או ''נותן שירות ציבורי'' כהגדרתם בחוק איסור הפליה במוצרים, בכל הנוגע לגביית דמי ביטוח ותשלום קצבאות. משכך, תביעה בעילה נזיקית זו אינה בסמכות בית הדין לעבודה, ועל כן הסמכות נתונה לבית המשפט האזרחי (המחוזי, בהתאם לסכום התביעה). ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)ת"צ (אזורי ת"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)',
    'טעות נפוצה היא להניח שכל תביעה נגד המוסד לביטוח לאומי, ללא קשר למהות העילה, נתונה לסמכות בית הדין לעבודה, מבלי להבחין בין עילות חוזיות/ביטחון סוציאלי לעילות נזיקיות.',
    '["סמכות עניינית", "עילה נזיקית", "חוק איסור הפליה במוצרים", "מוסד לביטוח לאומי", "בית משפט אזרחי", "תובענה ייצוגית"]'::jsonb,
    '**וריאציה 1 — עילה נזיקית:** האם בית הדין לעבודה מוסמך לדון בעילה נזיקית נגד המוסד לביטוח לאומי? ← לא (הלכת הנדל, ת"צ 3248-04-23). **וריאציה 2 — חוק איסור הפליה:** האם חוק איסור הפליה במוצרים חל על המוסד לביטוח לאומי כ''מספק שירות''? ← לא, בהקשר של גביית דמי ביטוח ותשלום קצבאות (ת"צ 3248-04-23). **וריאציה 3 — ערכאה מוסמכת:** לאיזו ערכאה נתונה הסמכות בעילה נזיקית זו? ← בית המשפט האזרחי (המחוזי).',
    'תובענה ייצוגית נגד המוסד לביטוח לאומי בעילה נזיקית ← בית המשפט האזרחי.',
    '["ת\"צ (אזורי ת\"א) 3248-04-23 מיכל שגב רודל - המוסד לביטוח לאומי (13.7.2024)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'תנאים לאישור הסדר פשרה בתובענה ייצוגית', 4, 'המוסד לביטוח לאומי הגיע להסדר פשרה בתובענה ייצוגית שהוגשה נגדו בגין גבייה שלא כדין. מהם התנאים העיקריים שבית הדין לעבודה יבחן בטרם יאשר את הסדר הפשרה?',
    'שאלה זו עוסקת בתנאים לאישור הסדר פשרה בתובענה ייצוגית, כפי שנקבעו בחוק תובענות ייצוגיות. היא מדגישה את תפקידו של בית הדין להגן על האינטרסים של חברי הקבוצה ולוודא שההסדר הוגן, ראוי וסביר.',
    'סעיף 19(א) לחוק תובענות ייצוגיות, התשס"ו-2006, קובע כי בית המשפט (או בית הדין, במקרה זה) לא יאשר הסדר פשרה אלא אם כן מצא, כי ההסדר ראוי, הוגן וסביר בהתחשב בעניינם של חברי הקבוצה. בנוסף, אם הבקשה לאישור הסדר פשרה הוגשה לפני שאושרה התובענה הייצוגית, בית הדין יבחן גם כי התובענה שהוגשה עומדת לכאורה בתנאים לאישור תובענה ייצוגית הקבועים בסעיפים 3, 4 ו-8(א) לחוק, וכי סיום ההליך בהסדר פשרה הוא הדרך היעילה וההוגנת להכרעה במחלוקת בנסיבות העניין. פסק הדין כהן נ'' המוסד לביטוח לאומי (ת"צ 2001-12-22) מדגים אישור הסדר פשרה כזה. ת"צ (עבודה ירושלים) 2001-12-22 דניאל כהן - המוסד לביטוח לאומי (19.3.2026)',
    'טעות נפוצה היא לחשוב שאישור הסדר פשרה בתובענה ייצוגית הוא הליך פורמלי בלבד, מבלי להבין את עומק הבדיקה הנדרשת מבית הדין להגנה על זכויות חברי הקבוצה.',
    '["הסדר פשרה", "תובענה ייצוגית", "אישור בית דין", "ראוי, הוגן וסביר", "חוק תובענות ייצוגיות", "הגנת הקבוצה"]'::jsonb,
    '**וריאציה 1 — תנאים עיקריים:** מהם התנאים לאישור הסדר פשרה? ← ראוי, הוגן וסביר לקבוצה, והתובענה עומדת לכאורה בתנאים לאישור (ס'' 19(א) לחוק תובענות ייצוגיות). **וריאציה 2 — תפקיד בית הדין:** מה תפקיד בית הדין? ← להגן על אינטרס הקבוצה ולוודא שההסדר משרת אותה (ת"צ 2001-12-22 כהן). **וריאציה 3 — מועד האישור:** מתי נבחנים התנאים? ← לפני אישור הסדר הפשרה, ובמקרים מסוימים גם לפני אישור התובענה הייצוגית עצמה (ס'' 19(א) לחוק תובענות ייצוגיות).',
    'אישור הסדר פשרה בתובענה ייצוגית ← בית הדין בוחן הגינות, סבירות, וראויות ההסדר לקבוצה.',
    '["חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 19", "ת\"צ (עבודה ירושלים) 2001-12-22 דניאל כהן - המוסד לביטוח לאומי (19.3.2026)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'בית הדין האזורי לעבודה.', false, 'תשובה זו שגויה, שכן סמכות בית הדין לעבודה מוגבלת לענייני עבודה וביטחון סוציאלי, ואינה חלה על תביעות נגד רשויות מקומיות בענייני ארנונה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'בית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים.', true, 'זו התשובה הנכונה. תובענה ייצוגית נגד רשות ציבורית (שאינה המוסד לביטוח לאומי) להשבת סכומים שנגבו כמס, אגרה או תשלום חובה אחר, נתונה לסמכות בית המשפט לעניינים מינהליים, מכוח סעיף 5(ב)(2) לחוק תובענות ייצוגיות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'בית משפט השלום.', false, 'תשובה זו שגויה, שכן תובענות ייצוגיות נדונות בדרך כלל בבתי המשפט המחוזיים או בבתי הדין לעבודה, ולא בבית משפט השלום.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'בית המשפט המחוזי בשבתו כבית משפט אזרחי.', false, 'תשובה זו שגויה. תביעות נגד רשויות ציבוריות בענייני גביית מסים ותשלומים חלים על פי דין מינהלי, ונדונות בבית המשפט לעניינים מינהליים ולא בבית המשפט המחוזי האזרחי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'המבחן המנחה הוא האם העילה ''עולה מהחוק'' של הביטחון הסוציאלי, ובמקרה כזה הסמכות לבית הדין לעבודה, גם אם יש בה שאלות מנהליות.', true, 'זו התשובה הנכונה, המשקפת את הלכת טישמן, לפיה מומחיותו של בית הדין לעבודה בענייני ביטחון סוציאלי מכריעה את הסמכות, גם כאשר מעורבות שאלות מנהליות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'המבחן המנחה הוא האם אופי התובענה הוא מינהלי, ובמקרה כזה הסמכות לבית המשפט לעניינים מינהליים.', false, 'תשובה זו שגויה, שכן הלכת טישמן קבעה במפורש כי אופי מינהלי של שאלות בבקשה לאישור אינו שולל את סמכות בית הדין לעבודה בענייני ביטחון סוציאלי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'הסמכות נקבעת לפי מהות הסעד המבוקש, כאשר סעד כספי נדון בבית משפט אזרחי וסעד הצהרתי בבית משפט מינהלי.', false, 'תשובה זו שגויה. מבחן הסעד אינו המבחן העיקרי לקביעת סמכות עניינית בתובענות ייצוגיות נגד המוסד לביטוח לאומי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'הסמכות נתונה לבית המשפט המחוזי, אשר יחליט אם להעביר את התיק לבית הדין לעבודה או לבית המשפט לעניינים מינהליים.', false, 'תשובה זו שגויה. אין מנגנון כזה של העברה מבית המשפט המחוזי לבית הדין לעבודה או לבית המשפט לעניינים מינהליים במקרה של סמכות עניינית ייחודית.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'בית הדין האזורי לעבודה.', false, 'תשובה זו שגויה. בית הדין לעבודה אינו מוסמך לדון בעילות נזיקיות נגד המוסד לביטוח לאומי, ובפרט בעילות מכוח חוק איסור הפליה במוצרים, שכן המוסד אינו נחשב ''מספק שירות'' לעניין זה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'בית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים.', false, 'תשובה זו שגויה. עילות נזיקיות אינן נדונות בבית המשפט לעניינים מינהליים, אלא בבתי המשפט האזרחיים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'בית המשפט המחוזי בשבתו כבית משפט אזרחי.', true, 'זו התשובה הנכונה. תביעה נזיקית נגד המוסד לביטוח לאומי, כגון טענה להפליה מכוח חוק איסור הפליה במוצרים, אינה בסמכות בית הדין לעבודה, ועל כן נתונה לסמכות בית המשפט האזרחי (המחוזי, בהתאם לסכום התביעה).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'בית משפט השלום.', false, 'תשובה זו שגויה. תובענות ייצוגיות נדונות בדרך כלל בבתי המשפט המחוזיים או בבתי הדין לעבודה, ולא בבית משפט השלום.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'בית הדין יבחן שההסדר ראוי, הוגן וסביר בהתחשב בעניינם של חברי הקבוצה, וכי התובענה עומדת לכאורה בתנאים לאישור תובענה ייצוגית.', true, 'זו התשובה הנכונה, המשקפת את הוראות סעיף 19(א) לחוק תובענות ייצוגיות, המפרט את התנאים לאישור הסדר פשרה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'בית הדין יאשר את ההסדר באופן אוטומטי, שכן מדובר בהסכמה בין הצדדים.', false, 'תשובה זו שגויה. אישור הסדר פשרה בתובענה ייצוגית אינו אוטומטי, ודורש בדיקה מעמיקה של בית הדין להגנה על אינטרס הקבוצה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'בית הדין יבחן רק את גובה הפיצוי המוצע, ויוודא שהוא עולה על 50% מהנזק המוערך לקבוצה.', false, 'תשובה זו שגויה. בחינת ההסדר רחבה יותר מגובה הפיצוי בלבד, ואין דרישה חוקית לאחוז פיצוי מינימלי מסוים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'בית הדין יאשר את ההסדר רק אם לא הוגשו התנגדויות מצד חברי הקבוצה.', false, 'תשובה זו שגויה. אף שאי-הגשת התנגדויות היא שיקול, בית הדין עדיין חייב לבחון את ההסדר לגופו ולוודא שהוא ראוי, הוגן וסביר.', 4);

END $$;

-- ============================================================
-- Q9 — 2024-W-Q9 — chapter=criminal_proc subtopic=retrial
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q9';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q9 skipped: external_id % already exists', '2024-W-Q9';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'retrial';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'retrial';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q9', 'e4a16014-22c7-4653-bf0d-89ff4bb34c20', v_subtopic_id,
    'בית משפט מחוזי דן במשפט חוזר. מה מוסמך בית המשפט לקבוע?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 9}'::jsonb,
    'שאלה זו עוסקת בסמכות בית המשפט הדן במשפט חוזר, הליך חריג ויוצא דופן בסדר הדין הפלילי. היא מתמקדת בהוראת סעיף 31 לחוק בתי המשפט, הקובעת כי בית המשפט פועל כערכאה דיונית לכל דבר ועניין, למעט הגבלה אחת: איסור החמרת העונש על הנידון.',
    'סעיף 31 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע במפורש את סמכותו של בית המשפט הדן במשפט חוזר. על פי הסעיף, בית המשפט מוסמך לקבוע ''כל דבר שיכול היה לקבוע כערכאה דיונית בהליך פלילי''. משמעות הדבר היא שבית המשפט אינו פועל כערכאת ערעור, אלא בוחן את התיק מחדש לגופו, כאילו הוא הערכאה הראשונה. עם זאת, קיימת הגבלה מהותית אחת: ''למעט החמרה בעונש''. הגבלה זו נועדה להגן על הנידון, שכן מטרת המשפט החוזר היא לתקן עיוות דין לטובתו, ולא להרע את מצבו. סעיף 31 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984',
    'טעות נפוצה היא לבלבל בין סמכות בית המשפט במשפט חוזר לבין סמכותו כערכאת ערעור. בעוד שערכאת ערעור יכולה להחמיר בעונש, בית המשפט הדן במשפט חוזר אינו רשאי לעשות זאת, שכן מטרת ההליך היא תיקון עיוות דין לטובת הנידון.',
    '["משפט חוזר", "סמכות דיונית", "החמרת עונש", "חוק בתי המשפט", "סדר דין פלילי", "עיוות דין"]'::jsonb,
    '**וריאציה 1 — סמכות כללית:** מה סמכות בית המשפט במשפט חוזר? ← כל דבר שיכול היה לקבוע כערכאה דיונית (ס'' 31 לחוק בתי המשפט). **וריאציה 2 — הגבלה:** מהי ההגבלה על סמכות זו? ← למעט החמרה בעונש (ס'' 31 לחוק בתי המשפט). **וריאציה 3 — רציונל ההגבלה:** מדוע אסור להחמיר בעונש? ← מטרת המשפט החוזר היא תיקון עיוות דין לטובת הנידון, לא להרע את מצבו.',
    'משפט חוזר ← סמכות דיונית ← אסור להחמיר בעונש.',
    '["חוק בתי המשפט [נוסח משולב], התשמ\"ד-1984, סעיף 31"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'כל דבר שיכול היה לקבוע כערכאה דיונית בהליך פלילי, למעט התייחסות לעונש.', false, 'תשובה זו שגויה, שכן בית המשפט מוסמך להתייחס לעונש, אך אסור לו להחמיר בו. ההגבלה היא על החמרת העונש, לא על עצם ההתייחסות אליו.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כל דבר שיכול היה לקבוע כערכאה דיונית בהליך פלילי, למעט החמרה בעונש.', true, 'זו התשובה הנכונה, המשקפת במדויק את הוראת סעיף 31 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, הקובע את סמכות בית המשפט הדן במשפט חוזר.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'כל דבר שיכול היה לקבוע במסגרת ערעור פלילי.', false, 'תשובה זו שגויה, שכן סמכות בית המשפט במשפט חוזר היא כשל ערכאה דיונית, ולא כשל ערכאת ערעור, למעט ההגבלה על החמרת העונש.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'כל דבר שיכול היה לקבוע במסגרת ערעור פלילי, למעט פיצוי לנפגע, אם הוגשה תביעה נזיקית נגררת.', false, 'תשובה זו שגויה. סמכות בית המשפט במשפט חוזר היא כשל ערכאה דיונית, ולא כשל ערכאת ערעור. כמו כן, ההגבלה העיקרית היא על החמרת העונש, ולא על פיצוי לנפגע.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'סמכות בית המשפט העליון במשפט חוזר', 1, 'בקשה למשפט חוזר הוגשה לבית המשפט העליון. מה מוסמך בית המשפט העליון לקבוע במקרה זה?',
    'שאלה זו בוחנת את הבנת סמכותו של בית המשפט העליון כאשר הוא דן במשפט חוזר. היא מדגישה כי גם במקרה זה, בית המשפט פועל כערכאה דיונית, ולא כערכאת ערעור, עם אותה הגבלה על החמרת העונש.',
    'סעיף 31 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע כי ''בית המשפט הדן במשפט חוזר מוסמך לקבוע כל דבר שיכול היה לקבוע כערכאה דיונית בהליך פלילי, למעט החמרה בעונש''. הוראה זו חלה גם כאשר בית המשפט העליון הוא זה הדן במשפט החוזר. כלומר, בית המשפט העליון אינו פועל במקרה זה כערכאת ערעור, אלא כערכאה דיונית לכל דבר ועניין, עם המגבלה היחידה של איסור החמרת העונש. סעיף 31 לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984',
    'טעות נפוצה היא להניח שבית המשפט העליון תמיד פועל כערכאת ערעור, גם כאשר הוא דן במשפט חוזר, ולכן לייחס לו סמכויות של ערעור, כגון החזרת התיק או החמרת העונש.',
    '["משפט חוזר", "בית המשפט העליון", "סמכות דיונית", "סמכות ערעור", "החמרת עונש", "חוק בתי המשפט"]'::jsonb,
    '**וריאציה 1 — סמכות העליון במשפט חוזר:** האם בית המשפט העליון פועל כערכאת ערעור במשפט חוזר? ← לא, הוא פועל כערכאה דיונית (ס'' 31 לחוק בתי המשפט). **וריאציה 2 — הגבלת סמכות:** מהי ההגבלה היחידה על סמכותו? ← איסור החמרת העונש (ס'' 31 לחוק בתי המשפט). **וריאציה 3 — השוואה לערעור:** מה ההבדל העיקרי בין משפט חוזר לערעור בהקשר זה? ← בערעור העליון יכול להחמיר בעונש, במשפט חוזר לא.',
    'העליון במשפט חוזר ← ערכאה דיונית ← אסור להחמיר בעונש.',
    '["חוק בתי המשפט [נוסח משולב], התשמ\"ד-1984, סעיף 31"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'עילות להגשת בקשה למשפט חוזר', 2, 'מהי העילה המרכזית והנפוצה ביותר להגשת בקשה למשפט חוזר, המאפשרת פתיחה מחדש של הליך פלילי שהסתיים?',
    'שאלה זו עוסקת בעילות המאפשרות הגשת בקשה למשפט חוזר, הליך חריג המיועד לתקן עיוותי דין חמורים. היא מתמקדת בעילה המרכזית של גילוי ראיה חדשה, המהווה את הבסיס לרוב הבקשות מסוג זה.',
    'סעיף 31(א) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, מפרט את העילות להגשת בקשה למשפט חוזר. העילה המרכזית והנפוצה ביותר היא גילוי עובדה או ראיה חדשה, שלא הייתה ידועה בשעת מתן פסק הדין, ויש בה כדי לשנות את תוצאות המשפט לטובת הנידון (סעיף 31(א)(1)). עילות נוספות כוללות קביעה בפסק דין חלוט כי ראיה שהוגשה במשפט הייתה שקרית, או כי אדם אחר הורשע בביצוע העבירה. מטרת המשפט החוזר היא לתקן עיוות דין חמור, ולכן העילות מצומצמות ומחמירות. סעיף 31(א)(1) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984',
    'טעות נפוצה היא לבלבל בין עילות ערעור (כגון טעות משפטית) לבין עילות משפט חוזר, שהן מצומצמות יותר ומחייבות גילוי עובדות או ראיות חדשות או נסיבות חריגות אחרות.',
    '["משפט חוזר", "עילות משפט חוזר", "ראיה חדשה", "עיוות דין", "פסק דין חלוט", "חוק בתי המשפט"]'::jsonb,
    '**וריאציה 1 — עילה מרכזית:** מהי העילה המרכזית למשפט חוזר? ← גילוי ראיה חדשה שיש בה כדי לשנות את תוצאות המשפט לטובת הנידון (ס'' 31(א)(1) לחוק בתי המשפט). **וריאציה 2 — תנאי לראיה חדשה:** מה התנאי לראיה חדשה? ← שלא הייתה ידועה בשעת מתן פסק הדין. **וריאציה 3 — מטרת ההליך:** מה מטרת המשפט החוזר? ← תיקון עיוות דין חמור לאחר פסק דין חלוט.',
    'משפט חוזר ← עילה מרכזית: ראיה חדשה ← משנה תוצאות לטובת הנידון.',
    '["חוק בתי המשפט [נוסח משולב], התשמ\"ד-1984, סעיף 31(א)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'משפט חוזר לאחר זיכוי', 3, 'האם ניתן להגיש בקשה למשפט חוזר במקרה שבו נאשם זוכה בדין?',
    'שאלה זו בוחנת את ההבנה העמוקה של מטרת המשפט החוזר – תיקון עיוות דין לטובת הנידון. היא מדגישה כי הליך זה אינו מיועד להרשיע אדם שזוכה, אלא להעניק הזדמנות נוספת למי שהורשע ונגרם לו עוול.',
    'סעיף 31(א)(1) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984, קובע במפורש כי גילוי עובדות או ראיות חדשות צריכות להיות ''כדי לשנות את תוצאות המשפט לטובת הנידון''. מכאן עולה כי משפט חוזר נועד לתקן עיוות דין שנגרם למי שהורשע, ולא כדי להרשיע אדם שזוכה בדין. עקרון זה מבטיח את יציבות פסקי הדין המזכים ואת ההגנה על חירות הפרט. סעיף 31(א)(1) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984',
    'טעות נפוצה היא לחשוב שמשפט חוזר הוא כלי כללי לפתיחה מחדש של כל הליך פלילי, גם נגד מזוכה, מבלי להבין את מטרתו הספציפית והמצומצמת.',
    '["משפט חוזר", "זיכוי", "לשנות לטובת הנידון", "עיוות דין", "פסק דין חלוט", "חוק בתי המשפט"]'::jsonb,
    '**וריאציה 1 — מטרת משפט חוזר:** האם משפט חוזר נועד להרשיע מזוכה? ← לא, הוא נועד לתקן עיוות דין לטובת הנידון (ס'' 31(א)(1) לחוק בתי המשפט). **וריאציה 2 — תנאי לראיה חדשה:** מה התנאי לראיה חדשה? ← שתשנה את תוצאות המשפט לטובת הנידון. **וריאציה 3 — יציבות הזיכוי:** מה המשמעות של אי-אפשרות להרשיע מזוכה במשפט חוזר? ← שמירה על יציבות הזיכוי והגנה על חירות הפרט.',
    'משפט חוזר ← רק לטובת הנידון ← לא להרשיע מזוכה.',
    '["חוק בתי המשפט [נוסח משולב], התשמ\"ד-1984, סעיף 31(א)(1)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'השוואה בין משפט חוזר לערעור פלילי', 4, 'מהו ההבדל המהותי העיקרי בין הליך של משפט חוזר לבין הליך של ערעור פלילי, מבחינת סוג ההחלטה שניתן לתקוף?',
    'שאלה זו עוסקת בהבחנה יסודית בין שני הליכים מרכזיים בסדר הדין הפלילי: ערעור פלילי ומשפט חוזר. היא מדגישה את ההבדל המהותי ביניהם מבחינת סוג ההחלטה שהם מיועדים לתקוף – פסק דין שאינו חלוט לעומת פסק דין חלוט.',
    'ההבדל המהותי העיקרי בין הליך של ערעור פלילי לבין הליך של משפט חוזר טמון בסוג ההחלטה שהם מיועדים לתקוף. ערעור פלילי הוא הליך רגיל המאפשר לצדדים לתקוף פסק דין שטרם הפך חלוט, כלומר, פסק דין שניתן בערכאה ראשונה וטרם עבר את כל שלבי הערעור האפשריים. מטרתו היא לבחון טעויות משפטיות או עובדתיות שנפלו בפסק הדין. לעומת זאת, משפט חוזר הוא הליך חריג ויוצא דופן, המיועד לתקן עיוות דין חמור שנפל בפסק דין שכבר הפך חלוט, כלומר, פסק דין שאין עליו עוד זכות ערעור. עילותיו מצומצמות ומחמירות, ודורשות גילוי ראיות חדשות או נסיבות חריגות אחרות. סעיף 31(א) לחוק בתי המשפט [נוסח משולב], התשמ"ד-1984',
    'טעות נפוצה היא לבלבל בין שני ההליכים, או לחשוב שמשפט חוזר הוא סוג של ערעור נוסף, מבלי להבין את ההבדל המהותי ביניהם ואת העובדה שמשפט חוזר מתייחס רק לפסק דין חלוט.',
    '["משפט חוזר", "ערעור פלילי", "פסק דין חלוט", "פסק דין שאינו חלוט", "עילות ערעור", "עילות משפט חוזר"]'::jsonb,
    '**וריאציה 1 — יעד ההליך:** מה תוקף ערעור פלילי? ← פסק דין שאינו חלוט. מה תוקף משפט חוזר? ← פסק דין חלוט (ס'' 31(א) לחוק בתי המשפט). **וריאציה 2 — אופי ההליך:** מה אופי הערעור? ← הליך רגיל. מה אופי המשפט החוזר? ← הליך חריג ויוצא דופן. **וריאציה 3 — מטרת ההליך:** מה מטרת הערעור? ← בחינת טעויות משפטיות/עובדתיות. מה מטרת המשפט החוזר? ← תיקון עיוות דין חמור.',
    'ערעור ← פסק דין לא חלוט; משפט חוזר ← פסק דין חלוט.',
    '["חוק בתי המשפט [נוסח משולב], התשמ\"ד-1984, סעיף 31(א)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כל דבר שיכול היה לקבוע כערכאה דיונית בהליך פלילי, למעט החמרה בעונש.', true, 'זו התשובה הנכונה. סעיף 31 לחוק בתי המשפט קובע כי גם בית המשפט העליון, כאשר הוא דן במשפט חוזר, פועל כערכאה דיונית, עם אותה הגבלה על החמרת העונש.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'כל דבר שיכול היה לקבוע כערכאת ערעור, לרבות החמרת העונש.', false, 'תשובה זו שגויה, שכן בית המשפט העליון אינו פועל כערכאת ערעור במשפט חוזר, ואסור לו להחמיר בעונש.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'רק לבטל את פסק הדין המקורי ולהחזיר את התיק לבית המשפט המחוזי לדיון מחודש.', false, 'תשובה זו שגויה. בית המשפט העליון מוסמך לדון בעצמו בעניין כערכאה דיונית, ולא רק להחזיר את התיק.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'רק להחליט אם לאשר את הבקשה למשפט חוזר, ולא לדון לגופו של עניין.', false, 'תשובה זו שגויה. בית המשפט העליון מוסמך גם לדון לגופו של עניין לאחר אישור הבקשה למשפט חוזר.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'גילוי ראיה חדשה שיש בה כדי לשנות את תוצאות המשפט לטובת הנידון.', true, 'זו התשובה הנכונה, המהווה את העילה המרכזית והנפוצה ביותר להגשת בקשה למשפט חוזר, כפי שקבוע בסעיף 31(א)(1) לחוק בתי המשפט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'טעות משפטית מהותית שנפלה בפסק הדין המקורי.', false, 'תשובה זו שגויה. טעות משפטית מהותית היא עילה לערעור, לא למשפט חוזר, אלא אם כן היא נובעת מראיה חדשה או נסיבות חריגות אחרות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'שינוי בעמדת התביעה לאחר מתן פסק הדין.', false, 'תשובה זו שגויה. שינוי בעמדת התביעה כשלעצמו אינו עילה למשפט חוזר, אלא אם כן הוא מבוסס על ראיות חדשות או נסיבות חריגות אחרות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'חלוף זמן רב מאז מתן פסק הדין המקורי.', false, 'תשובה זו שגויה. חלוף זמן אינו עילה למשפט חוזר, שכן מטרתו היא תיקון עיוות דין מהותי, ולא התיישנות.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, אם נתגלו ראיות חדשות המעידות על אשמתו של המזוכה.', false, 'תשובה זו שגויה. משפט חוזר נועד לתקן עיוות דין לטובת הנידון, ולא כדי להרשיע מזוכה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, משפט חוזר נועד לתקן עיוות דין לטובת הנידון בלבד, ולא כדי להרשיע מזוכה.', true, 'זו התשובה הנכונה. סעיף 31 לחוק בתי המשפט קובע במפורש כי הראיות החדשות צריכות להיות ''כדי לשנות את תוצאות המשפט לטובת הנידון'', מה ששולל משפט חוזר נגד מזוכה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, אך רק אם הזיכוי הושג במרמה.', false, 'תשובה זו שגויה. גם אם הזיכוי הושג במרמה, משפט חוזר אינו הכלי המשפטי המתאים להרשעת מזוכה, אלא אם כן מדובר בעבירה אחרת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'כן, אם הוגש ערעור על הזיכוי והוא התקבל.', false, 'תשובה זו שגויה. אם הוגש ערעור והתקבל, הרי שהזיכוי בוטל, ואין צורך במשפט חוזר. משפט חוזר מתייחס לפסק דין חלוט.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'ערעור פלילי תוקף פסק דין חלוט, בעוד משפט חוזר תוקף פסק דין שאינו חלוט.', false, 'תשובה זו שגויה. ההפך הוא הנכון: ערעור תוקף פסק דין שאינו חלוט, ומשפט חוזר תוקף פסק דין חלוט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'ערעור פלילי תוקף פסק דין שאינו חלוט, בעוד משפט חוזר תוקף פסק דין חלוט.', true, 'זו התשובה הנכונה. ערעור הוא הליך רגיל לבחינת פסק דין שטרם הפך חלוט, בעוד משפט חוזר הוא הליך חריג לבחינת פסק דין חלוט.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'בשני ההליכים ניתן לתקוף רק פסק דין חלוט, אך העילות שונות.', false, 'תשובה זו שגויה. ערעור פלילי אינו תוקף פסק דין חלוט, אלא פסק דין שטרם הפך חלוט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'בשני ההליכים ניתן לתקוף רק פסק דין שאינו חלוט, אך הסמכות שונה.', false, 'תשובה זו שגויה. משפט חוזר תוקף פסק דין חלוט, ולא פסק דין שאינו חלוט.', 4);

END $$;

-- ============================================================
-- Q10 — 2024-W-Q10 — chapter=civil_proc subtopic=class_actions
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q10';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q10 skipped: external_id % already exists', '2024-W-Q10';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'class_actions';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'class_actions';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q10', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'יעקב הגיש בקשה לאשר תובענה ייצוגית נגד יצרן של מוצר שרכש. לאחר שבחן את הבקשה, הגיע בית המשפט למסקנה שמתקיימים התנאים לאישור תובענה ייצוגית לגבי כל מי שרכשו את המוצר לכל המאוחר עד חודש לפני שיעקב קנה אותו (להלן: הקבוצה). מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 10}'::jsonb,
    'שאלה זו עוסקת בדרישת קיומה של עילת תביעה אישית לתובע המייצג בתובענה ייצוגית, ובמנגנון הטיפול במצב שבו תנאי זה אינו מתקיים. היא מתייחסת להוראות סעיפים 4(א)(1) ו-8(ג)(2) לחוק תובענות ייצוגיות, המאפשרות לבית המשפט לאשר את התובענה הייצוגית תוך החלפת התובע המייצג, וזאת כדי להגן על האינטרס של הקבוצה.',
    'סעיף 4(א)(1) לחוק תובענות ייצוגיות, התשס"ו-2006, קובע כי אדם רשאי להגיש בקשה לאישור תובענה ייצוגית רק אם יש לו עילת תביעה אישית. דרישה זו, שהייתה קיימת גם לפני חקיקת החוק, מבטיחה כי התובע המייצג הוא חבר בקבוצה הנפגעת וכי יש לו אינטרס ממשי בתוצאות ההליך. עם זאת, סעיף 8(ג)(2) לחוק מרכך דרישה זו וקובע כי אם בית המשפט מצא שהתקיימו כל התנאים לאישור תובענה ייצוגית (לפי סעיף 8(א)), אך לא מתקיימים לגבי המבקש התנאים שבסעיף 4(א)(1) (קרי, אין לו עילה אישית), בית המשפט יאשר את התובענה הייצוגית אך יורה בהחלטתו על החלפת התובע המייצג. מנגנון זה נועד להבטיח את ייצוג האינטרס של הקבוצה, שכן החוק מעדיף את מהות התביעה על פני מיהות התובע, כל עוד הבקשה הוגשה בתום לב והיעדר העילה האישית לא היה צפוי מראש. במקרה הנדון, יעקב אינו נמנה עם הקבוצה שהוגדרה, ולכן אין לו עילת תביעה אישית ביחס לקבוצה זו. לפיכך, בית המשפט יאשר את התובענה הייצוגית ויורה על החלפתו בתובע אחר מן הקבוצה. סעיף 4(א)(1) לחוק תובענות ייצוגיות, תשס"ו-2006סעיף 8(ג)(2) לחוק תובענות ייצוגיות, תשס"ו-2006בר"ע (ארצי ) 11387-07-22 מבטחים מוסד לביטוח סוציאלי של העובדים בע"מ - מיכאל איוון וולף (05.01.2023)ת"צ (מחוזי מרכז) 31579-10-20 רפאל חאמי נ'' רוזן ומינץ בע"מ (24.04.2024)',
    'טעות נפוצה היא להניח כי היעדר עילה אישית לתובע המייצג מוביל בהכרח לדחיית הבקשה לאישור התובענה הייצוגית, מבלי להכיר את מנגנון ההחלפה הקבוע בחוק, המאפשר לבית המשפט להגן על האינטרס של הקבוצה.',
    '["תובענה ייצוגית", "עילה אישית", "תובע מייצג", "החלפת תובע מייצג", "חוק תובענות ייצוגיות", "הגדרת קבוצה"]'::jsonb,
    '**וריאציה 1 — היעדר עילה אישית:** מה קורה אם לתובע המייצג אין עילה אישית? ← בית המשפט יאשר את התובענה ויורה על החלפת התובע המייצג (ס'' 8(ג)(2) לחוק תובענות ייצוגיות). **וריאציה 2 — מטרת ההחלפה:** מדוע מאפשרים החלפה? ← כדי להבטיח את ייצוג האינטרס של הקבוצה, שכן החוק מעדיף את מהות התביעה על פני מיהות התובע (בר"ע 11387-07-22 מבטחים). **וריאציה 3 — תנאי להחלפה:** האם החלפה אפשרית בכל מקרה של היעדר עילה אישית? ← לא, רק אם הבקשה נשענה על תשתית ראייתית ומשפטית מבוססת, והיעדר העילה לא היה צפוי מראש (בג"ץ תורג''מן).',
    'תובע מייצג ללא עילה אישית ← בית המשפט יחליף אותו ← כדי להגן על הקבוצה, אלא אם חוסר תום לב.',
    '["חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 4(א)(1)", "חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 8(ג)(2)", "בר\"ע (ארצי ) 11387-07-22 מבטחים מוסד לביטוח סוציאלי של העובדים בע\"מ - מיכאל איוון וולף (05.01.2023)", "ת\"צ (מחוזי מרכז) 31579-10-20 רפאל חאמי נ'' רוזן ומינץ בע\"מ (24.04.2024)", "בג\"ץ 62/13 רונן תורג''מן נ'' בית הדין הארצי לעבודה (28.1.2013)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'על בית המשפט לדחות את הבקשה לאישור התובענה הייצוגית.', false, 'תשובה זו שגויה, שכן היעדר עילה אישית לתובע המייצג אינו מוביל בהכרח לדחיית הבקשה, אלא מאפשר החלפה של התובע המייצג, בתנאים מסוימים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'על בית המשפט לאשר את התובענה הייצוגית ולפסוק ליעקב פיצויים ללא הוכחת נזק.', false, 'תשובה זו שגויה. יעקב אינו נמנה עם הקבוצה שהוגדרה, ולכן אין לו עילה אישית. בית המשפט לא יפסוק לו פיצויים, אלא יורה על החלפתו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'על בית המשפט לאשר את התובענה הייצוגית ללא כל שינוי.', false, 'תשובה זו שגויה, שכן יעקב אינו נמנה עם הקבוצה שהוגדרה, ולכן יש צורך בשינוי זהות התובע המייצג.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'על בית המשפט לאשר את התובענה הייצוגית ולהורות על החלפתו של יעקב בתובע אחר מן הקבוצה.', true, 'זו התשובה הנכונה, המשקפת את הוראת סעיף 8(ג)(2) לחוק תובענות ייצוגיות, המאפשרת לבית המשפט לאשר את התובענה הייצוגית ולהורות על החלפת התובע המייצג אם אין לו עילה אישית, וזאת בתנאים מסוימים.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'תובענה ייצוגית ללא עילה אישית במקרה של תובע קש', 1, 'ראובן הגיש בקשה לאישור תובענה ייצוגית, אך התברר כי הוא ידע מראש שאין לו עילת תביעה אישית נגד הנתבע, וכי הוא שימש כ"תובע קש" מתוך מניע פסול. מה הדין במקרה זה?',
    'שאלה זו בוחנת את גבולות סמכות בית המשפט להחליף תובע מייצג שאין לו עילת תביעה אישית, תוך התמקדות במקרים של חוסר תום לב או הגשת תביעה על ידי ''תובע קש''. היא מדגישה כי מנגנון ההחלפה אינו אוטומטי ודורש בחינה של נסיבות הגשת הבקשה המקורית.',
    'סעיף 8(ג)(2) לחוק תובענות ייצוגיות, התשס"ו-2006, מאפשר לבית המשפט להחליף תובע מייצג שאין לו עילת תביעה אישית. אולם, פסיקת בית המשפט העליון, ובפרט בג"ץ תורג''מן, הבהירה כי החלפת תובע אינה עניין טכני-פורמלי גרידא. בית המשפט לא יאפשר החלפה כאשר התובע ידע, או יכול היה לדעת, שאין לו עילת תביעה אישית בעת הגשת הבקשה, או כאשר הבקשה הוגשה מתוך מניע פסול או על ידי ''תובע קש''. במקרים כאלה, אין הצדקה לאשר את התובענה הייצוגית, והבקשה תידחה. בג"ץ 62/13 רונן תורג''מן נ'' בית הדין הארצי לעבודה (28.1.2013)ת"צ (מחוזי מרכז) 52057-10-14 יניב רחמים נ'' ניופאן בע"מ (11.02.2024)אביאל פלינט, חגי ויניצקי תובענות ייצוגיות (2017) | פרק ה התנאים לאישור תובענה ייצוגית',
    'טעות נפוצה היא להניח כי סעיף 8(ג)(2) לחוק תובענות ייצוגיות מחייב החלפת תובע בכל מקרה של היעדר עילה אישית, מבלי להתחשב בנסיבות הגשת הבקשה ובתום ליבו של התובע המקורי.',
    '["תובע קש", "חוסר תום לב", "החלפת תובע מייצג", "סעיף 8(ג)(2) לחוק תובענות ייצוגיות", "דחיית בקשה לאישור"]'::jsonb,
    '**וריאציה 1 — תובע קש:** האם בית המשפט יחליף תובע מייצג ששימש כ"תובע קש"? ← לא, החלפה אינה עניין טכני-פורמלי (בג"ץ תורג''מן). **וריאציה 2 — ידע מראש:** מה קורה אם התובע ידע מראש שאין לו עילה אישית? ← הבקשה תידחה, לא תותר החלפה (ת"צ 52057-10-14 רחמים נ'' ניופאן). **וריאציה 3 — מניע פסול:** האם בקשה שהוגשה ממניע פסול תאושר? ← לא, אין הצדקה לאשר תובענה שהולדתו בחטא (פלינט וויניצקי).',
    'תובע קש או חוסר תום לב ← דחיית הבקשה ← אין החלפה.',
    '["חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 8(ג)(2)", "בג\"ץ 62/13 רונן תורג''מן נ'' בית הדין הארצי לעבודה (28.1.2013)", "ת\"צ (מחוזי מרכז) 52057-10-14 יניב רחמים נ'' ניופאן בע\"מ (11.02.2024)", "אביאל פלינט, חגי ויניצקי, תובענות ייצוגיות (2017)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'תנאים להחלפת תובע מייצג נעדר עילה אישית', 2, 'בית המשפט שוקל להחליף תובע מייצג שאין לו עילת תביעה אישית, בהתאם לסעיף 8(ג)(2) לחוק תובענות ייצוגיות. אילו שיקולים ינחו את בית המשפט בהחלטתו?',
    'שאלה זו מתמקדת בשיקולים המנחים את בית המשפט בעת הפעלת סמכותו להחלפת תובע מייצג נעדר עילה אישית. היא מדגישה את הצורך באיזון בין טובת הקבוצה, תום ליבו של התובע המקורי, וההגנה על זכויות הנתבע, כפי שפורש בפסיקה ובספרות המשפטית.',
    'הפעלת הסמכות להחלפת תובע מייצג לפי סעיף 8(ג)(2) לחוק תובענות ייצוגיות אינה אוטומטית. בית המשפט יבחן מספר שיקולים, ובהם: האם הבקשה לאישור התובענה כייצוגית הוגשה בתום לב על ידי תובע שסבר באמת ובתמים כי יש לו עילת תביעה, או שמא היא הוגשה מתוך מניע פסול או תוך שימוש ב''תובע קש''. כמו כן, ייבחן האם על פני הדברים ברור שלתובע לא הייתה עילת תביעה אישית, או שמא רק בשל נסיבות שלא היה ניתן לצפותן בסבירות מראש, התברר כי לא כך הוא הדבר. בנוסף, בית המשפט ישקול האם החלפת התובע הייצוגי תפגע באינטרסים ראויים להגנה של הנתבע או בזכויות דיוניות שלו. אביאל פלינט, חגי ויניצקי תובענות ייצוגיות (2017) | פרק ה התנאים לאישור תובענה ייצוגיתת"צ (מחוזי מרכז) 52057-10-14 יניב רחמים נ'' ניופאן בע"מ (11.02.2024)בג"ץ 62/13 רונן תורג''מן נ'' בית הדין הארצי לעבודה (28.1.2013)',
    'טעות נפוצה היא להתעלם מהשיקולים המורכבים המנחים את בית המשפט בהחלטה על החלפת תובע מייצג, ולחשוב שההחלפה תיעשה באופן אוטומטי או רק על בסיס טובת הקבוצה.',
    '["החלפת תובע מייצג", "שיקול דעת בית המשפט", "תום לב", "אינטרסים של הנתבע", "סעיף 8(ג)(2) לחוק תובענות ייצוגיות", "תובע קש"]'::jsonb,
    '**וריאציה 1 — שיקולי החלפה:** אילו שיקולים ינחו את בית המשפט בהחלפת תובע מייצג? ← תום לב, צפיות היעדר העילה, פגיעה בנתבע (פלינט וויניצקי). **וריאציה 2 — מתי לא יוחלף:** מתי לא יוחלף תובע מייצג נעדר עילה אישית? ← אם ידע או יכול היה לדעת על היעדר העילה מראש (ת"צ 52057-10-14 רחמים נ'' ניופאן). **וריאציה 3 — איזון:** מהו האיזון הנדרש? ← בין טובת הקבוצה לבין הגינות ההליך ושמירה על זכויות הנתבע (פלינט וויניצקי).',
    'החלפת תובע מייצג ← תום לב, צפיות, אי פגיעה בנתבע ← איזון שיקולים.',
    '["חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 8(ג)(2)", "בג\"ץ 62/13 רונן תורג''מן נ'' בית הדין הארצי לעבודה (28.1.2013)", "ת\"צ (מחוזי מרכז) 52057-10-14 יניב רחמים נ'' ניופאן בע\"מ (11.02.2024)", "אביאל פלינט, חגי ויניצקי, תובענות ייצוגיות (2017)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'אישור תובענה ייצוגית ללא ייצוג הולם או תום לב', 3, 'בקשה לאישור תובענה ייצוגית הוגשה, ובית המשפט מצא כי התובע המייצג או בא כוחו אינם מייצגים את הקבוצה בדרך הולמת או בתום לב. עם זאת, שאר התנאים לאישור התובענה מתקיימים. מה הדין?',
    'שאלה זו עוסקת במנגנון התיקון הקבוע בחוק תובענות ייצוגיות למקרים בהם קיים פגם בייצוג ההולם או בתום הלב של התובע המייצג או בא כוחו. היא מדגישה את גמישותו של בית המשפט לאפשר את המשך התובענה הייצוגית, תוך הבטחת הגנה על אינטרסי הקבוצה.',
    'סעיף 8(א)(3) ו-(4) לחוק תובענות ייצוגיות קובעים כי תנאי לאישור תובענה ייצוגית הוא קיומו של יסוד סביר להניח כי עניינם של חברי הקבוצה ייוצג וינוהל בדרך הולמת ובתום לב. אולם, סעיף 8(ג)(1) לחוק קובע חריג: אם לא התקיימו תנאים אלה, בית המשפט רשאי לאשר את התובענה הייצוגית אם מצא כי ניתן להבטיח את קיומם בדרך של צירוף או החלפת תובע מייצג או בא כוח מייצג, או בדרך אחרת. הוראה זו משקפת את חשיבות האינטרס הציבורי בהליך הייצוגי ואת העדפת החוק את טובת הקבוצה על פני זהות התובע המקורי, כל עוד ניתן לתקן את הפגם בייצוג. סעיף 8(ג)(1) לחוק תובענות ייצוגיות, תשס"ו-2006עת"צ (ארצי ) 2421-03-19 Svetlana Nuta - מטב - עמותה לשרותי טיפול ורווחה (14.09.2022)נבו - המתמחה סדר הדין האזרחי (2026) | יג. תובענה ייצוגית',
    'טעות נפוצה היא לחשוב שכל פגם בייצוג הולם או בתום לב מוביל לדחיית התובענה הייצוגית, מבלי להכיר את מנגנון התיקון המאפשר לבית המשפט להבטיח את המשך ההליך באמצעות החלפה או צירוף.',
    '["ייצוג הולם", "תום לב", "החלפת תובע מייצג", "צירוף תובע מייצג", "סעיף 8(ג)(1) לחוק תובענות ייצוגיות", "אינטרס ציבורי"]'::jsonb,
    '**וריאציה 1 — פגם בייצוג:** מה קורה אם אין ייצוג הולם או תום לב? ← בית המשפט רשאי לאשר את התובענה ולהורות על החלפה/צירוף (ס'' 8(ג)(1) לחוק תובענות ייצוגיות). **וריאציה 2 — מטרת התיקון:** מדוע מאפשרים תיקון? ← כדי להבטיח את המשך ניהול התובענה הייצוגית לטובת הקבוצה (עת"צ 2421-03-19 נוטה נ'' מטב). **וריאציה 3 — שיקול דעת:** האם בית המשפט חייב להחליף? ← לא, הוא רשאי, בהתאם לנסיבות וליכולת להבטיח ייצוג הולם.',
    'פגם בייצוג הולם/תום לב ← בית המשפט יחליף/יצרף ← להבטחת טובת הקבוצה.',
    '["חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 8(ג)(1)", "עת\"צ (ארצי ) 2421-03-19 Svetlana Nuta - מטב - עמותה לשרותי טיפול ורווחה (14.09.2022)", "נבו - המתמחה, סדר הדין האזרחי (2026)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'השלכות דחיית בקשה לאישור תובענה ייצוגית על התיישנות', 4, 'בקשה לאישור תובענה ייצוגית נדחתה על ידי בית המשפט. מהי השפעת דחייה זו על תקופת ההתיישנות של תביעות אישיות של חברי הקבוצה, הנובעות מאותה עילת תביעה?',
    'שאלה זו עוסקת בהוראות מיוחדות לעניין התיישנות בתובענות ייצוגיות, ובפרט בהשפעת דחיית בקשה לאישור תובענה ייצוגית על תקופת ההתיישנות של תביעות אישיות. היא מדגישה את מנגנון ההגנה שקבע המחוקק כדי למנוע פגיעה בזכויות חברי הקבוצה.',
    'סעיף 26(ב) לחוק תובענות ייצוגיות, התשס"ו-2006, קובע כי אם בית המשפט דחה בקשה לאישור תובענה ייצוגית או מחק אותה, לא תסתיים תקופת ההתיישנות של תביעה של אדם שנמנה עם הקבוצה שבשמה הוגשה הבקשה לאישור, הנובעת מאותה עילת תביעה, לפני שחלפה שנה מהיום שבו ההחלטה בבקשה לאישור הפכה חלוטה. תנאי לכך הוא שתביעתו של אותו אדם לא התיישנה עד למועד שבו הוגשה הבקשה לאישור. הוראה זו נועדה להגן על חברי הקבוצה ולאפשר להם להגיש תביעות אישיות לאחר דחיית הבקשה הייצוגית, מבלי שזכותם תתיישן. סעיף 26(ב) לחוק תובענות ייצוגיות, תשס"ו-2006',
    'טעות נפוצה היא לחשוב שדחיית בקשה לאישור תובענה ייצוגית מבטלת את כל ההשפעות על התיישנות, או שאין כל הגנה על חברי הקבוצה במקרה כזה.',
    '["התיישנות", "תובענה ייצוגית", "דחיית בקשה לאישור", "תביעה אישית", "חוק תובענות ייצוגיות", "ארכה להתיישנות"]'::jsonb,
    '**וריאציה 1 — דחיית בקשה:** מה קורה להתיישנות תביעות אישיות לאחר דחיית בקשה לאישור? ← תקופת ההתיישנות לא תסתיים לפני שנה מהחלטה חלוטה (ס'' 26(ב) לחוק תובענות ייצוגיות). **וריאציה 2 — תנאי לארכה:** מהו התנאי לארכה זו? ← שהתביעה האישית לא התיישנה עד למועד הגשת הבקשה לאישור (ס'' 26(ב) לחוק תובענות ייצוגיות). **וריאציה 3 — מטרת ההוראה:** מה מטרת הוראת סעיף 26(ב)? ← להגן על חברי הקבוצה ולאפשר להם להגיש תביעות אישיות לאחר דחיית הבקשה הייצוגית.',
    'דחיית בקשה לאישור ← ארכה של שנה להתיישנות תביעות אישיות ← הגנה על חברי הקבוצה.',
    '["חוק תובענות ייצוגיות, תשס\"ו-2006, סעיף 26(ב)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'בית המשפט יאשר את התובענה הייצוגית ויורה על החלפת התובע המייצג, שכן טובת הקבוצה גוברת.', false, 'תשובה זו שגויה. אף שטובת הקבוצה חשובה, החלפת תובע אינה אוטומטית במקרה של חוסר תום לב או ידע מוקדם על היעדר עילה אישית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'בית המשפט ידחה את הבקשה לאישור התובענה הייצוגית ולא יורה על החלפת התובע.', true, 'זו התשובה הנכונה. פסיקת בית המשפט העליון קבעה כי מנגנון החלפת התובע אינו מיועד להכשיר בקשות שהוגשו בחוסר תום לב או על ידי תובע שידע מראש שאין לו עילה אישית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'בית המשפט יאשר את התובענה הייצוגית ויורה על החלפת התובע, אך יטיל עליו הוצאות משפט גבוהות.', false, 'תשובה זו שגויה. במקרה של חוסר תום לב, בית המשפט לא יאשר את התובענה כלל, אלא ידחה אותה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'בית המשפט יורה על החלפת התובע, אך ימנה תובע מייצג מתוך רשימה סגורה של תובעים מוסמכים.', false, 'תשובה זו שגויה. אין רשימה סגורה של תובעים מוסמכים, ובמקרה של חוסר תום לב, בית המשפט לא יורה על החלפה כלל.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'בית המשפט יתמקד אך ורק בטובת הקבוצה, ויורה על החלפה אם הדבר יקדם את התובענה.', false, 'תשובה זו שגויה. אף שטובת הקבוצה חשובה, בית המשפט חייב לאזן אותה עם שיקולים נוספים, כולל תום ליבו של התובע המקורי והשפעת ההחלפה על הנתבע.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'בית המשפט יבחן האם הבקשה הוגשה בתום לב, האם היעדר העילה לא היה צפוי מראש, והאם החלפת התובע לא תפגע באינטרסים ראויים להגנה של הנתבע.', true, 'זו התשובה הנכונה. שיקולים אלו, כפי שנקבעו בפסיקה, מאזנים בין הצורך להגן על הקבוצה לבין שמירה על הגינות ההליך וזכויות הנתבע.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'בית המשפט יורה על החלפה רק אם התובע המקורי הסכים לכך בכתב.', false, 'תשובה זו שגויה. הסכמת התובע המקורי אינה תנאי הכרחי להחלפה לפי סעיף 8(ג)(2), שכן הסמכות נתונה לבית המשפט.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'בית המשפט יורה על החלפה רק אם מדובר בתובענה ייצוגית בעלת חשיבות ציבורית עליונה.', false, 'תשובה זו שגויה. אף שחשיבות ציבורית היא שיקול, היא אינה התנאי הבלעדי להחלפה, וישנם שיקולים נוספים שיש לבחון.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'בית המשפט ידחה את הבקשה לאישור התובענה הייצוגית, שכן ייצוג הולם ותום לב הם תנאי סף הכרחיים.', false, 'תשובה זו שגויה. אף שייצוג הולם ותום לב הם תנאים חשובים, החוק מאפשר לבית המשפט לאשר את התובענה תוך תיקון הפגם בדרך של החלפה או צירוף.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'בית המשפט יאשר את התובענה הייצוגית, אך יורה על החלפת התובע המייצג או בא כוחו, או על צירופם, כדי להבטיח ייצוג הולם ובתום לב.', true, 'זו התשובה הנכונה, המשקפת את הוראת סעיף 8(ג)(1) לחוק תובענות ייצוגיות, המאפשרת לבית המשפט לאשר את התובענה תוך תיקון הפגם בייצוג.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'בית המשפט יאשר את התובענה הייצוגית ללא שינוי, אך יטיל קנס על התובע המייצג או בא כוחו.', false, 'תשובה זו שגויה. בית המשפט לא יאשר תובענה ייצוגית ללא ייצוג הולם או תום לב, שכן הדבר עלול לפגוע באינטרסים של הקבוצה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'בית המשפט יורה על הקפאת ההליכים עד למציאת תובע מייצג או בא כוח מייצג חדשים.', false, 'תשובה זו שגויה. החוק מאפשר לבית המשפט לנקוט בפעולה אקטיבית של החלפה או צירוף, ולא רק להקפיא את ההליכים.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'תקופת ההתיישנות של התביעות האישיות נשארת כפי שהייתה, ואינה מושפעת מדחיית הבקשה.', false, 'תשובה זו שגויה. החוק קובע הוראה מיוחדת לעניין התיישנות במקרה של דחיית בקשה לאישור תובענה ייצוגית, כדי להגן על חברי הקבוצה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'תקופת ההתיישנות של התביעות האישיות תסתיים שנה לאחר שההחלטה בדחיית הבקשה לאישור הפכה חלוטה, ובלבד שהתביעה לא התיישנה עד למועד הגשת הבקשה לאישור.', true, 'זו התשובה הנכונה, המשקפת את הוראת סעיף 26(ב) לחוק תובענות ייצוגיות, המעניקה לחברי הקבוצה ארכה להגשת תביעותיהם האישיות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'תקופת ההתיישנות של התביעות האישיות מתחילה מחדש מיום דחיית הבקשה לאישור.', false, 'תשובה זו שגויה. תקופת ההתיישנות אינה מתחילה מחדש, אלא ניתנת ארכה ספציפית של שנה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'התביעות האישיות מתיישנות באופן מיידי עם דחיית הבקשה לאישור התובענה הייצוגית.', false, 'תשובה זו שגויה. החוק נועד למנוע מצב כזה ולאפשר לחברי הקבוצה להגיש תביעות אישיות.', 4);

END $$;

-- ============================================================
-- Q11 — 2024-W-Q11 — chapter=evidence subtopic=admissibility
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q11';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q11 skipped: external_id % already exists', '2024-W-Q11';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'admissibility';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'admissibility';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q11', 'f75683b1-e83a-47da-ba16-b35a95c536d0', v_subtopic_id,
    'הערכאה הדיונית הרשיעה את יגאל. בפסק הדין הוזכרה, בין היתר, ראיה שאינה קבילה, ללא ציון עובדה זו וללא הסתייגות. יגאל ערער וטען שבשל כך יש לפסול את הרשעתו. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 11}'::jsonb,
    'שאלה זו עוסקת בהשפעת קבלת ראיה שאינה קבילה על הרשעה במשפט פלילי, כפי שנקבע בסעיף 56 לפקודת הראיות [נוסח חדש]. היא מתמקדת במבחנים שנקבעו בפסיקה, ובפרט בהלכת אבוטבול, לקביעת פסלות פסק דין במקרים כאלה, תוך הדגשת המבחן הסובייקטיבי של ספק סביר שהנאשם לא היה מורשע לולא הראיה הפסולה.',
    'סעיף 56 לפקודת הראיות [נוסח חדש], התשל"א-1971, קובע כי ראיה שאינה קבילה במשפט פלילי ונתקבלה בטעות או בהיסח הדעת, לא תשמש הוכחה לאשמה ואין לבסס עליה פסק דין. עם זאת, העובדה שבית המשפט שמע את הראיה לא תפסול את פסק הדין, אלא אם סבור בית המשפט שהנאשם לא היה מורשע אילולא נמסרה אותה ראיה (המבחן הסובייקטיבי) או שאין ראיה מספקת אחרת זולתה לתמוך בה את ההרשעה (המבחן האובייקטיבי). הפסיקה, ובפרט דנ"פ 188/94 מדינת ישראל נ'' אבוטבול, קבעה כי המבחנים הם חלופיים, ודי בקיום אחד מהם ברמת ספק סביר כדי לפסול את ההרשעה. כלומר, אם ערכאת הערעור מגיעה למסקנה שקיים ספק סביר שהערכאה הדיונית לא הייתה מרשיעה את הנאשם לולא הראיה הפסולה, ההרשעה תיפסל. זאת, גם אם הראיה הוזכרה בפסק הדין ללא הסתייגות, שכן קיימת חזקה ששופט מקצועי יודע להתעלם מראיה פסולה, אך חזקה זו ניתנת לסתירה ברמת ספק סביר. סעיף 56 לפקודת הראיות [נוסח חדש], תשל"א-1971דנ"פ 188/94 מדינת ישראל נ'' אבוטבול, נא(2) 1 (28.2.1996)ע"פ 6145/10 פלוני נ'' מדינת ישראל (21.8.2013)יניב ואקי דיני ראיות כרך א (2020) | פרק 6 - כללי קבילותיניב ואקי דיני ראיות כרך ב (2020) | פרק 35 ראיות בדבר עבר פלילי',
    'טעות נפוצה היא לחשוב שכל אזכור של ראיה פסולה בפסק הדין מוביל לפסילה אוטומטית של ההרשעה, מבלי להבין את חזקת השופט המקצועי ואת הצורך בקיום ספק סביר לגבי השפעת הראיה על ההרשעה.',
    '["סעיף 56 לפקודת הראיות", "ראיה פסולה", "מבחן סובייקטיבי", "ספק סביר", "חזקת השופט המקצועי", "ערכאת ערעור"]'::jsonb,
    '**וריאציה 1 — תנאי לפסילה:** מתי תיפסל הרשעה עקב ראיה פסולה? ← אם קיים ספק סביר שהנאשם לא היה מורשע לולא הראיה (ס'' 56 לפקודת הראיות). **וריאציה 2 — רמת ההוכחה:** מהי רמת ההוכחה הנדרשת? ← ספק סביר, לא ודאות מוחלטת (דנ"פ 188/94 אבוטבול). **וריאציה 3 — חזקת השופט:** האם עצם הזכרת הראיה פוסלת? ← לא, קיימת חזקה ששופט מקצועי יודע להתעלם מראיה פסולה (יניב ואקי).',
    'ראיה פסולה הוזכרה בפסק הדין ← הרשעה תיפסל אם קיים ספק סביר שהראיה השפיעה על ההרשעה.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 56", "דנ\"פ 188/94 מדינת ישראל נ'' אבוטבול, נא(2) 1 (1996)", "ע\"פ 6145/10 פלוני נ'' מדינת ישראל (21.8.2013)", "יניב ואקי, דיני ראיות כרך א (2020)", "יניב ואקי, דיני ראיות כרך ב (2020)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'ההרשעה תיפסל אם תגיע ערכאת הערעור למסקנה שקיים ספק סביר בשאלה אם בית המשפט קמא היה מרשיע את יגאל ללא אותה ראיה.', true, 'זו התשובה הנכונה, המשקפת את המבחן הסובייקטיבי הקבוע בסעיף 56 לפקודת הראיות, לפיו די בספק סביר שהנאשם לא היה מורשע לולא הראיה הפסולה כדי לפסול את ההרשעה.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'ההרשעה תיפסל רק אם תגיע ערכאת הערעור למסקנה שאין כל ספק שבית המשפט קמא לא היה מרשיע את יגאל ללא אותה ראיה.', false, 'תשובה זו שגויה, שכן רמת ההוכחה הנדרשת לפסילת פסק הדין היא קיום ספק סביר, ולא ודאות מוחלטת, כפי שנקבע בהלכת אבוטבול.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'ההרשעה תיפסל רק אם אין בחומר הראיות האחר בתיק די ראיות קבילות לביסוס ההרשעה.', false, 'תשובה זו שגויה. זהו המבחן האובייקטיבי, אך הוא חלופי למבחן הסובייקטיבי, ודי בקיום אחד מהם כדי לפסול את ההרשעה.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'די בהזכרת הראיה ללא הסתייגות כדי שההרשעה תיפסל.', false, 'תשובה זו שגויה. קיימת חזקה ששופט מקצועי יודע להתעלם מראיה פסולה, גם אם הוזכרה בפסק הדין, ואין די בעצם ההזכרה כדי לפסול את ההרשעה באופן אוטומטי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'השפעת ראיה פסולה על הרשעה כאשר בית המשפט הצהיר שהתעלם ממנה', 1, 'הערכאה הדיונית הרשיעה את ראובן. בפסק הדין הוזכרה ראיה שאינה קבילה, אך בית המשפט הצהיר במפורש כי התעלם ממנה בהכרעתו. ראובן ערער וטען שבשל חשיפת בית המשפט לראיה הפסולה יש לפסול את הרשעתו. מה הדין?',
    'שאלה זו בוחנת את חזקת השופט המקצועי בהקשר של ראיות פסולות. היא מדגישה כי גם כאשר ראיה פסולה הוזכרה בפסק הדין, קיימת חזקה ששופט מקצועי יודע להתעלם ממנה, ובמיוחד אם הצהיר על כך במפורש, חזקה זו חזקה יותר וקשה יותר לסתירה.',
    'סעיף 56 לפקודת הראיות [נוסח חדש], התשל"א-1971, קובע כי העובדה שבית המשפט שמע ראיה שאינה קבילה לא תפסול את פסק הדין, אלא אם סבור בית המשפט שהנאשם לא היה מורשע אילולא נמסרה אותה ראיה. הפסיקה, ובפרט הלכת אבוטבול (דנ"פ 188/94), קבעה כי נקודת המוצא בהערכת חשיפתו של השופט לראיות בלתי קבילות היא חוסנו של השופט המקצועי. חזקה זו עומדת גם כאשר השופט מזכיר את הראיה הפסולה בהכרעת דינו בלי לפרש את הסתייגותו או התעלמותו ממנה. חזקה זו נכונה במיוחד כאשר בית המשפט הצהיר במפורש כי המותב התעלם בהכרעת דינו מן הראיה הפסולה, ואף הסביר ונימק מדוע לא נדרש מלכתחילה לעיון מעמיק בה. לכן, במקרה זה, ההרשעה לא תיפסל אלא אם כן המערער יצליח לסתור את החזקה ולהוכיח כי למרות ההצהרה, הראיה הפסולה אכן השפיעה על ההרשעה ברמה של ספק סביר. סעיף 56 לפקודת הראיות [נוסח חדש], תשל"א-1971ע"פ 6145/10 פלוני נ'' מדינת ישראל (21.8.2013)יניב ואקי דיני ראיות כרך ב (2020) | פרק 35 ראיות בדבר עבר פלילייניב ואקי דיני ראיות כרך א (2020) | פרק 6 - כללי קבילות',
    'טעות נפוצה היא לחשוב שכל חשיפה של שופט לראיה פסולה, גם אם הצהיר שהתעלם ממנה, מובילה לפסילת פסק הדין, מבלי להבין את חזקת השופט המקצועי ואת הצורך לסתור אותה.',
    '["סעיף 56 לפקודת הראיות", "חזקת השופט המקצועי", "ראיה פסולה", "הכרעת דין", "סתירת חזקה", "ספק סביר"]'::jsonb,
    '**וריאציה 1 — הצהרת התעלמות:** האם הצהרת בית המשפט על התעלמות מראיה פסולה מונעת פסילה? ← כן, מחזקת את חזקת השופט המקצועי (ע"פ 6145/10 פלוני). **וריאציה 2 — סתירת החזקה:** מתי תיסתר החזקה? ← אם קיים ספק סביר שהנאשם לא היה מורשע לולא הראיה הפסולה (ס'' 56 לפקודת הראיות). **וריאציה 3 — משמעות ההזכרה:** האם עצם הזכרת הראיה הפסולה בפסק הדין פוסלת? ← לא, חזקה שבית המשפט ידע להתעלם ממנה (דנ"פ 188/94 אבוטבול).',
    'ראיה פסולה הוזכרה אך בית המשפט הצהיר שהתעלם ← חזקת השופט המקצועי ← ההרשעה לא תיפסל אלא אם נסתרה החזקה בספק סביר.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 56", "דנ\"פ 188/94 מדינת ישראל נ'' אבוטבול, נא(2) 1 (1996)", "ע\"פ 6145/10 פלוני נ'' מדינת ישראל (21.8.2013)", "יניב ואקי, דיני ראיות כרך א (2020)", "יניב ואקי, דיני ראיות כרך ב (2020)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'המבחן האובייקטיבי לפסילת פסק דין עקב ראיה פסולה', 2, 'הערכאה הדיונית הרשיעה את ראובן. בפסק הדין הוזכרה ראיה שאינה קבילה. ערכאת הערעור בוחנת את המקרה לפי סעיף 56 לפקודת הראיות. מהו המבחן האובייקטיבי לפסילת פסק הדין במקרה זה?',
    'שאלה זו מתמקדת במבחן האובייקטיבי לפסילת פסק דין עקב קבלת ראיה פסולה, כפי שנקבע בסעיף 56 לפקודת הראיות. היא מדגישה את תפקידה של ערכאת הערעור לבחון את דיות הראיות הקבילות שנותרו בתיק, בהתעלם מהראיה הפסולה.',
    'סעיף 56 לפקודת הראיות [נוסח חדש], התשל"א-1971, מציב שני מבחנים חלופיים לפסילת פסק דין שניתן על בסיס ראיה בלתי קבילה. המבחן השני, המכונה המבחן האובייקטיבי, קובע כי פסק הדין ייפסל אם בית המשפט לערעורים סבור ''שאין ראיה מספקת אחרת זולתה לתמוך בה את ההרשעה''. בגדרו של מבחן זה, בית המשפט לערעורים מתעלם מהלוך המחשבה של בית המשפט קמא ובודק בעצמו אם יש די ראיות קבילות כדי לבסס עליהן את הרשעת הנאשם. הוא נוהג כאילו הוא יושב לדין כערכאה ראשונה ושואל כיצד היה הוא עצמו מכריע את הדין על יסוד הראיות הכשרות, בהתעלם התעלמות מוחלטת מהראיה הפסולה. סעיף 56 לפקודת הראיות [נוסח חדש], תשל"א-1971ע"פ 6145/10 פלוני נ'' מדינת ישראל (21.8.2013)יניב ואקי דיני ראיות כרך ב (2020) | פרק 35 ראיות בדבר עבר פלילייניב ואקי דיני ראיות כרך א (2020) | פרק 6 - כללי קבילות',
    'טעות נפוצה היא לבלבל בין המבחן האובייקטיבי למבחן הסובייקטיבי, או לחשוב שהמבחן האובייקטיבי מתייחס להשפעת הראיה הפסולה על בית המשפט קמא, במקום לבחינת דיות הראיות הקבילות.',
    '["סעיף 56 לפקודת הראיות", "מבחן אובייקטיבי", "ראיה פסולה", "דיות ראיות", "ערכאת ערעור", "ספק סביר"]'::jsonb,
    '**וריאציה 1 — הגדרת המבחן:** מהו המבחן האובייקטיבי? ← ספק סביר שאין ראיה מספקת אחרת זולתה לתמוך בה את ההרשעה (ס'' 56 לפקודת הראיות). **וריאציה 2 — תפקיד ערכאת הערעור:** כיצד פועלת ערכאת הערעור במבחן זה? ← בוחנת בעצמה אם יש די ראיות קבילות לביסוס ההרשעה, בהתעלם מהראיה הפסולה (יניב ואקי). **וריאציה 3 — הבדל מהסובייקטיבי:** מה ההבדל העיקרי מהמבחן הסובייקטיבי? ← האובייקטיבי בוחן מה צריך שייפסק, הסובייקטיבי בוחן מה נפסק (יניב ואקי).',
    'מבחן אובייקטיבי ← אין די ראיות קבילות אחרות ← פסילת הרשעה.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 56", "דנ\"פ 188/94 מדינת ישראל נ'' אבוטבול, נא(2) 1 (1996)", "ע\"פ 6145/10 פלוני נ'' מדינת ישראל (21.8.2013)", "יניב ואקי, דיני ראיות כרך א (2020)", "יניב ואקי, דיני ראיות כרך ב (2020)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'פסילת ראיה שהושגה שלא כדין לפי סעיף 56א לפקודת הראיות', 3, 'במהלך חקירה פלילית, הושגה ראיה מסוימת שלא כדין, אך לא בטעות או בהיסח הדעת. הנאשם טוען כי יש לפסול את הראיה. מה הדין?',
    'שאלה זו עוסקת בסעיף 56א לפקודת הראיות, המעגן את דוקטרינת הפסילה הפסיקתית (הלכת יששכרוב). היא בוחנת את שיקול הדעת הנתון לבית המשפט לפסול ראיה שהושגה שלא כדין, תוך איזון בין זכות הנאשם להליך הוגן לבין האינטרס הציבורי בחקר האמת.',
    'סעיף 56א לפקודת הראיות [נוסח חדש], התשל"א-1971, קובע כי בית המשפט הדן במשפט פלילי רשאי שלא לקבל ראיה שהושגה שלא כדין, אם שוכנע שקבלתה במשפט תפגע באופן מהותי בזכות להליך הוגן. סעיף זה, המעגן את הלכת יששכרוב, מפרט שלושה שיקולים מרכזיים שיש לאזן ביניהם: אופייה וחומרתה של ההפרה, מידת ההשפעה של ההפרה על הראיה שהושגה, והעניין הציבורי שבקבלת הראיה או באי-קבלתה. בניגוד לסעיף 56, העוסק בראיות שהתקבלו בטעות או בהיסח הדעת, סעיף 56א חל על ראיות שהושגו שלא כדין באופן מכוון או כתוצאה מהתנהלות פסולה. ההחלטה בדבר פסילת ראיה לפי סעיף זה אינה אוטומטית, אלא נתונה לשיקול דעתו של בית המשפט בכל מקרה לגופו. סעיף 56א לפקודת הראיות [נוסח חדש], תשל"א-1971ע"פ 7388/20 עמירם בן אוליאל נ'' מדינת ישראל (01.09.2022)ע"פ 10049/08 ראתב אבו עצא נ'' מדינת ישראל (23.8.2012)ע"פ 6144/10 טדרוס גטצאו נ'' מדינת ישראל (10.4.2013)',
    'טעות נפוצה היא לבלבל בין סעיף 56 לסעיף 56א לפקודת הראיות, או לחשוב שסעיף 56א קובע פסילה אוטומטית של ראיות שהושגו שלא כדין, מבלי להבין את מנגנון האיזון ושיקול הדעת השיפוטי.',
    '["סעיף 56א לפקודת הראיות", "הלכת יששכרוב", "ראיה שהושגה שלא כדין", "הליך הוגן", "שיקול דעת שיפוטי", "איזון אינטרסים"]'::jsonb,
    '**וריאציה 1 — סעיף רלוונטי:** איזה סעיף מטפל בראיה שהושגה שלא כדין (לא בטעות)? ← סעיף 56א לפקודת הראיות.
 **וריאציה 2 — תנאי לפסילה:** מה התנאי לפסילה לפי סעיף 56א? ← פגיעה מהותית בזכות להליך הוגן, תוך איזון שיקולים (ס'' 56א לפקודת הראיות). **וריאציה 3 — שיקולים לאיזון:** אילו שיקולים נכללים באיזון? ← אופי וחומרת ההפרה, השפעת ההפרה על הראיה, עניין ציבורי (ע"פ 7388/20 בן אוליאל).',
    'ראיה שהושגה שלא כדין ← סעיף 56א ← שיקול דעת שיפוטי ← איזון בין הליך הוגן לאינטרס ציבורי.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 56א", "ע\"פ 7388/20 עמירם בן אוליאל נ'' מדינת ישראל (01.09.2022)", "ע\"פ 10049/08 ראתב אבו עצא נ'' מדינת ישראל (23.8.2012)", "ע\"פ 6144/10 טדרוס גטצאו נ'' מדינת ישראל (10.4.2013)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'דרכי פעולה של ערכאת הערעור לאחר קביעת ראיה פסולה', 4, 'ערכאת הערעור הגיעה למסקנה כי התקיים אחד המבחנים הקבועים בסעיף 56 לפקודת הראיות, וכי יש לפסול את ההרשעה בשל קבלת ראיה פסולה. מהי דרך הפעולה העיקרית של ערכאת הערעור במקרה זה?',
    'שאלה זו עוסקת בדרכי הפעולה של ערכאת הערעור לאחר שקבעה כי ראיה פסולה השפיעה על ההרשעה, בהתאם לסעיף 56 לפקודת הראיות. היא מדגישה את ''דרך המלך'' של ביטול פסק הדין והחזרת התיק לערכאה הדיונית, תוך התייחסות לאפשרויות נוספות.',
    'כאשר ערכאת הערעור מגיעה למסקנה כי התקיים אחד המבחנים הקבועים בסעיף 56 לפקודת הראיות (המבחן הסובייקטיבי או האובייקטיבי), וכי יש לפסול את ההרשעה בשל קבלת ראיה פסולה, היא רשאית לפסוק בכמה דרכים. ''דרך המלך'', במיוחד כאשר מתקיים המבחן הסובייקטיבי (ספק סביר שהנאשם לא היה מורשע אילולא הראיה הפסולה), היא לבטל את פסק הדין ולהחזיר את הדיון לבית משפט קמא להכרעה מחודשת, בהתעלם מהראיה הפסולה. זאת, במיוחד כאשר בחינה אובייקטיבית של הראיות מגלה שקיימות ראיות מספקות לצורך הרשעה, אך נדרשת בחינה מחודשת שלהן ללא הראיה הפסולה. אם מתקיים המבחן האובייקטיבי (אין די ראיות קבילות לביסוס הרשעה), ערכאת הערעור תורה על זיכוי הנאשם. קיימת גם אפשרות חריגה, הנסמכת על סעיף 215 לחוק סדר הדין הפלילי, לדחות את הערעור ולאשר את ההרשעה גם אם הראיה פסולה, אם לא נגרם עיוות דין. יניב ואקי דיני ראיות כרך א (2020) | פרק 6 - כללי קבילותיניב ואקי דיני ראיות כרך ב (2020) | פרק 35 ראיות בדבר עבר פלילידנ"פ 188/94 מדינת ישראל נ'' אבוטבול, נא(2) 1 (28.2.1996)רע"פ 7755/01 דוד מרציאנו נ'' מדינת ישראל, נו(5) 913 (05.06.2002)',
    'טעות נפוצה היא לחשוב שפסילת הרשעה עקב ראיה פסולה מובילה תמיד לזיכוי, מבלי להבחין בין המבחנים השונים ובין דרכי הפעולה האפשריות של ערכאת הערעור.',
    '["סעיף 56 לפקודת הראיות", "דרך המלך", "ביטול פסק דין", "החזרת דיון", "זיכוי", "סעיף 215 לחוק סדר הדין הפלילי"]'::jsonb,
    '**וריאציה 1 — דרך המלך:** מהי דרך המלך לאחר קביעת ראיה פסולה? ← ביטול פסק הדין והחזרת התיק לערכאה הדיונית (הלכת אבוטבול, יניב ואקי). **וריאציה 2 — מתי זיכוי?** מתי יורה בית המשפט על זיכוי? ← אם מתקיים המבחן האובייקטיבי ואין די ראיות קבילות אחרות (יניב ואקי). **וריאציה 3 — חריג:** האם ניתן לדחות ערעור למרות ראיה פסולה? ← כן, אם לא נגרם עיוות דין (ס'' 215 לחוק סדר הדין הפלילי, יניב ואקי).',
    'ראיה פסולה ← דרך המלך: ביטול והחזרה ← זיכוי רק אם אין ראיות אחרות.',
    '["פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 56", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 215", "דנ\"פ 188/94 מדינת ישראל נ'' אבוטבול, נא(2) 1 (1996)", "רע\"פ 7755/01 דוד מרציאנו נ'' מדינת ישראל, נו(5) 913 (05.06.2002)", "יניב ואקי, דיני ראיות כרך א (2020)", "יניב ואקי, דיני ראיות כרך ב (2020)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'ההרשעה תיפסל, שכן עצם חשיפת בית המשפט לראיה פסולה פוגעת בהליך ההוגן, גם אם הצהיר שהתעלם ממנה.', false, 'תשובה זו שגויה. קיימת חזקה ששופט מקצועי יודע להתעלם מראיה פסולה, ובמיוחד כאשר הוא מצהיר על כך במפורש, אין די בעצם החשיפה כדי לפסול את ההרשעה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'ההרשעה לא תיפסל, שכן קיימת חזקה ששופט מקצועי יודע להתעלם מראיה פסולה, במיוחד אם הצהיר על כך במפורש.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי נקודת המוצא היא חוסנו של השופט המקצועי, וכי חזקה עליו שהכרעתו לא הושפעה מהיחשפות לראיה פסולה, במיוחד אם הצהיר על התעלמותו ממנה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'ההרשעה תיפסל רק אם יתברר כי הראיה הפסולה הייתה מכרעת ובלעדיה לא הייתה הרשעה, ללא קשר להצהרת בית המשפט.', false, 'תשובה זו שגויה. אף שהמבחן המכרע הוא האם הראיה הפסולה הייתה מכרעת, הצהרת בית המשפט על התעלמות מהראיה מחזקת את החזקה שהיא לא השפיעה, ומקשה על סתירתה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'בית המשפט לערעורים יחזיר את התיק לערכאה הדיונית כדי שתבחן מחדש את ההרשעה ללא הראיה הפסולה.', false, 'תשובה זו שגויה. החזרת התיק היא אחת האפשרויות כאשר ההרשעה נפסלת, אך במקרה זה, בשל הצהרת בית המשפט, ההרשעה לא תיפסל מלכתחילה, אלא אם כן נסתרה החזקה.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'ערכאת הערעור תבחן אם קיים ספק סביר שהנאשם לא היה מורשע אילולא נמסרה אותה ראיה.', false, 'תשובה זו שגויה, שכן זהו המבחן הסובייקטיבי, ולא המבחן האובייקטיבי.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'ערכאת הערעור תבחן אם קיים ספק סביר שאין ראיה מספקת אחרת זולתה לתמוך בה את ההרשעה.', true, 'זו התשובה הנכונה, המשקפת את המבחן האובייקטיבי הקבוע בסעיף 56 לפקודת הראיות, לפיו בית המשפט לערעורים בוחן אם יש די ראיות קבילות אחרות לביסוס ההרשעה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'ערכאת הערעור תבחן אם הראיה הפסולה השפיעה באופן בלתי נשלט על הכרעת הדין של הערכאה הדיונית.', false, 'תשובה זו שגויה. אף שזהו שיקול רלוונטי, הוא חלק מהמבחן הסובייקטיבי, ולא המבחן האובייקטיבי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'ערכאת הערעור תבחן אם הראיה הפסולה הייתה מכרעת ובלעדיה לא הייתה הרשעה, ללא קשר לראיות אחרות.', false, 'תשובה זו שגויה. המבחן האובייקטיבי מתמקד דווקא בקיומן של ראיות אחרות, ולא רק במכרעות הראיה הפסולה.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'הראיה תיפסל באופן אוטומטי, שכן כל ראיה שהושגה שלא כדין אינה קבילה במשפט פלילי.', false, 'תשובה זו שגויה. סעיף 56א לפקודת הראיות אינו קובע פסילה אוטומטית, אלא מעניק לבית המשפט שיקול דעת לפסול ראיה שהושגה שלא כדין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'בית המשפט רשאי שלא לקבל את הראיה אם שוכנע שקבלתה במשפט תפגע באופן מהותי בזכות להליך הוגן, תוך איזון שיקולים שונים.', true, 'זו התשובה הנכונה, המשקפת את הוראת סעיף 56א לפקודת הראיות (הלכת יששכרוב), המעניקה לבית המשפט שיקול דעת לפסול ראיה שהושגה שלא כדין, תוך איזון בין הפגיעה בהליך ההוגן לבין האינטרס הציבורי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'הראיה תתקבל, שכן סעיף 56 לפקודת הראיות חל רק על ראיות שהתקבלו בטעות או בהיסח הדעת.', false, 'תשובה זו שגויה. סעיף 56א לפקודת הראיות הוא סעיף נפרד המטפל בראיות שהושגו שלא כדין, גם אם לא בטעות או בהיסח הדעת, והוא משלים את סעיף 56.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'הראיה תתקבל, אך בית המשפט ייתן לה משקל נמוך יותר בשל דרך השגתה.', false, 'תשובה זו שגויה. אף שמשקל הראיה הוא שיקול, סעיף 56א מאפשר פסילה מוחלטת של הראיה, ולא רק הפחתת משקלה, אם מתקיימים התנאים לכך.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'ערכאת הערעור תזכה את הנאשם באופן מיידי.', false, 'תשובה זו שגויה. זיכוי מיידי אינו דרך המלך, אלא אם כן מתקיים המבחן האובייקטיבי ואין די ראיות קבילות אחרות להרשעה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'ערכאת הערעור תבטל את פסק הדין ותחזיר את הדיון לבית משפט קמא להכרעה מחודשת, בהתעלם מהראיה הפסולה.', true, 'זו התשובה הנכונה. זוהי ''דרך המלך'' שנקבעה בהלכת אבוטבול כאשר מתקיים המבחן הסובייקטיבי, או כאשר יש ראיות קבילות אחרות אך נדרשת בחינה מחודשת שלהן.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'ערכאת הערעור תאשר את ההרשעה, אך תפחית את העונש שנגזר על הנאשם.', false, 'תשובה זו שגויה. אם ההרשעה נפסלת, אין מקום להפחתת עונש, אלא לביטול ההרשעה או לדיון מחודש.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'ערכאת הערעור תדחה את הערעור אם סברה שלא נגרם עיוות דין, גם אם הראיה פסולה.', false, 'תשובה זו שגויה. אף שזו אפשרות הקיימת בסעיף 215 לחוק סדר הדין הפלילי, היא חריגה ואינה ''דרך המלך'' כאשר נקבע כי הראיה הפסולה השפיעה על ההרשעה.', 4);

END $$;

-- ============================================================
-- Q12 — 2024-W-Q12 — chapter=civil_proc subtopic=proceedings
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q12';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q12 skipped: external_id % already exists', '2024-W-Q12';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'proceedings';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q12', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'משה מעוניין לתבוע בדיון מהיר מאת הקבלן שבנה את דירתו סך של 70,000 ש"ח בגין ליקויי בנייה בהסתמך על חוות דעת מומחה של מהנדס. אלו מן המסמכים הבאים על משה לצרף לכתב התביעה?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 12}'::jsonb,
    'שאלה זו עוסקת בדרישות הפרוצדורליות לצירוף מסמכים לכתב תביעה המוגש בסדר דין מהיר, בהתאם לתקנות סדר הדין האזרחי, תשע"ט-2018. היא מדגישה את הדרישות המחמירות יותר בהליך זה, שמטרתן לייעל ולקצר את משך הדיון.',
    'תקנה 79(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי לכתב תביעה המוגש בסדר דין מהיר יצורפו: (1) תצהיר לאימות העובדות; (2) חוות דעת מומחה, אם התובע מתכוון להסתמך עליה; (3) רשימת המסמכים שברשות התובע; ו-(4) העתקי המסמכים המהותיים שברשות התובע. דרישות אלה מחמירות יותר מאשר בתביעה רגילה, במטרה לייעל את ההליך ולקצר את משך הדיון. במקרה של משה, הוא מתכוון להסתמך על חוות דעת מומחה, ולכן עליו לצרף אותה בנוסף לתצהיר, לרשימת המסמכים ולהעתקיהם. תקנה 79(א) לתקנות סדר הדין האזרחי, תשע"ט-2018',
    'טעות נפוצה היא לבלבל בין דרישות צירוף המסמכים בתביעה רגילה לבין אלו הנדרשות בתביעה בסדר דין מהיר, שהן מחמירות יותר ומחייבות צירוף העתקי מסמכים וחוות דעת מומחה כבר בשלב הגשת התביעה.',
    '["דיון מהיר", "תובענה", "תקנות סדר הדין האזרחי", "תצהיר", "חוות דעת מומחה", "גילוי מסמכים"]'::jsonb,
    '**וריאציה 1 — דרישות דיון מהיר:** מהם המסמכים החובה לצרף לכתב תביעה בדיון מהיר? ← תצהיר, חוות דעת מומחה (אם יש), רשימת מסמכים והעתקיהם (תקנה 79(א) לתקנות סדר הדין האזרחי). **וריאציה 2 — מטרת הדרישות:** מדוע הדרישות מחמירות בדיון מהיר? ← לייעול ההליך וקיצורו. **וריאציה 3 — השוואה לרגיל:** מה ההבדל העיקרי מכתב תביעה רגיל? ← בדיון מהיר יש חובה לצרף העתקי מסמכים וחוות דעת מומחה כבר בשלב הגשת התביעה.',
    'דיון מהיר ← תצהיר + חוות דעת + רשימת מסמכים + העתקים ← ייעול וקיצור הליך.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 79(א)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'תצהיר לאימות העובדות, חוות הדעת ההנדסית, תצהיר גילוי מסמכים והעתקי המסמכים שברשותו.', false, 'תשובה זו שגויה, שכן אין חובה לצרף תצהיר גילוי מסמכים לכתב התביעה בסדר דין מהיר, אלא רק רשימת מסמכים והעתקיהם.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'תצהיר לאימות העובדות, חוות הדעת ההנדסית ורשימת המסמכים שברשותו בלבד.', false, 'תשובה זו שגויה, שכן בנוסף לרשימת המסמכים, יש לצרף גם את העתקיהם של המסמכים המהותיים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'תצהיר לאימות העובדות, חוות הדעת ההנדסית, רשימת מסמכים שברשותו והעתקי המסמכים שברשותו.', true, 'זו התשובה הנכונה, המשקפת במדויק את הוראות תקנה 79(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, בדבר המסמכים שיש לצרף לכתב תביעה בסדר דין מהיר.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא ניתן לתבוע תביעה שכזו בדיון מהיר.', false, 'תשובה זו שגויה. תביעה בסכום של 70,000 ש"ח בגין ליקויי בנייה יכולה להתברר בסדר דין מהיר, שכן היא עומדת במגבלת הסכום ואינה נמנית על התביעות המוחרגות.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'סמכות עניינית לדיון מהיר', 1, 'ראובן מעוניין לתבוע בדיון מהיר סך של 100,000 ש"ח בגין הפרת חוזה. האם תביעה זו יכולה להתברר בסדר דין מהיר?',
    'שאלה זו בוחנת את הבנת התנאים לסמכות עניינית של בית המשפט לדון בתביעה בסדר דין מהיר, ובפרט את מגבלת הסכום ואת סוגי התביעות המוחרגים, כפי שנקבעו בתקנות סדר הדין האזרחי.',
    'תקנה 78(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי תביעה בסדר דין מהיר היא תביעה לסכום שאינו עולה על 75,000 ש"ח, או תביעה לפינוי מושכר. אולם, תקנה 78(ב) קובעת כי בית המשפט רשאי להורות על דיון מהיר בתביעה לסכום שאינו עולה על 250,000 ש"ח, אם מצא כי היא מתאימה לכך. בנוסף, תקנה 78(ג) מוציאה במפורש תביעות מסוימות מסדר דין מהיר, כגון תביעה ייצוגית, תביעה בסדר דין מקוצר, תביעה לפי חוק פיצויים לנפגעי תאונות דרכים, ועוד. תביעה בגין הפרת חוזה בסכום של 100,000 ש"ח יכולה להתברר בדיון מהיר, אם בית המשפט ימצא שהיא מתאימה לכך ואינה נמנית על התביעות המוחרגות. תקנה 78 לתקנות סדר הדין האזרחי, תשע"ט-2018',
    'טעות נפוצה היא לזכור רק את מגבלת הסכום של 75,000 ש"ח או 250,000 ש"ח, מבלי לזכור את סוגי התביעות המוחרגות או את שיקול הדעת של בית המשפט.',
    '["דיון מהיר", "סמכות עניינית", "תקנות סדר הדין האזרחי", "מגבלת סכום", "פינוי מושכר", "שיקול דעת בית המשפט"]'::jsonb,
    '**וריאציה 1 — סכום בסיסי:** מהו סכום התביעה הבסיסי לדיון מהיר? ← עד 75,000 ש"ח (תקנה 78(א)). **וריאציה 2 — סכום מורחב:** מתי ניתן לדון בתביעה עד 250,000 ש"ח בדיון מהיר? ← בשיקול דעת בית המשפט, אם מתאימה (תקנה 78(ב)). **וריאציה 3 — תביעות מוחרגות:** אילו תביעות מוחרגות מדיון מהיר? ← ייצוגית, סדר דין מקוצר, פיצויים לנפגעי תאונות דרכים (תקנה 78(ג)).',
    'דיון מהיר ← עד 75,000 ש"ח (חובה) או עד 250,000 ש"ח (שיקול דעת) ← לא תביעות מוחרגות.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 78"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'תנאים להגשת תביעה בסדר דין מהיר', 2, 'אילו תנאים מצטברים נדרשים כדי שתביעה תתברר בסדר דין מהיר, בהנחה שסכום התביעה מתאים?',
    'שאלה זו בוחנת את התנאים המצטברים הקבועים בתקנות סדר הדין האזרחי, המגדירים אילו תביעות יכולות להתברר בסדר דין מהיר, מעבר למגבלת הסכום. היא מתמקדת ברשימת התביעות המוחרגות במפורש מהליך זה.',
    'תקנה 78(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, מונה רשימה של תביעות שאינן יכולות להתברר בסדר דין מהיר, גם אם סכומן מתאים. בין היתר, מוחרגות תביעה ייצוגית, תביעה בסדר דין מקוצר, תביעה לפי חוק פיצויים לנפגעי תאונות דרכים, תביעה לפי חוק הפיקוח על שירותים פיננסיים (ביטוח), תביעה לפי חוק ניירות ערך, תביעה לפי חוק הגנת הצרכן, ועוד. כדי שתביעה תתברר בסדר דין מהיר, עליה לעמוד במגבלת הסכום (עד 75,000 ש"ח או עד 250,000 ש"ח בשיקול דעת בית המשפט) וכן אסור לה להיות אחת מהתביעות המוחרגות המפורטות בתקנה 78(ג). תקנה 78(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018',
    'טעות נפוצה היא לזכור רק חלק מהתביעות המוחרגות, או לחשוב שכל תביעה כספית בסכום מתאים יכולה להתברר בדיון מהיר.',
    '["דיון מהיר", "תביעות מוחרגות", "תקנות סדר הדין האזרחי", "תביעה ייצוגית", "סדר דין מקוצר", "חוק פיצויים לנפגעי תאונות דרכים"]'::jsonb,
    '**וריאציה 1 — תביעות מוחרגות:** אילו תביעות מוחרגות מסדר דין מהיר? ← ייצוגית, סדר דין מקוצר, פיצויים לנפגעי תאונות דרכים (תקנה 78(ג)). **וריאציה 2 — תנאי מצטבר:** האם מגבלת הסכום היא התנאי היחיד? ← לא, בנוסף לסכום, התביעה אסור שתהיה אחת מהמוחרגות. **וריאציה 3 — פינוי מושכר:** האם תביעה לפינוי מושכר מוחרגת? ← לא, היא דווקא יכולה להתברר בסדר דין מהיר (תקנה 78(א)).',
    'דיון מהיר ← סכום מתאים + לא תביעה מוחרגת (למשל, לא ייצוגית או סדר דין מקוצר).',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 78(ג)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'בקשה לשינוי סדר דין מהיר לרגיל', 3, 'בית המשפט דן בתביעה שהוגשה בסדר דין מהיר. במהלך הדיון, התברר כי התביעה מורכבת יותר מהצפוי, וכי היא אינה מתאימה להתברר בסדר דין מהיר. מה הדין?',
    'שאלה זו עוסקת בסמכותו של בית המשפט להורות על שינוי סדר הדין מתביעה מהירה לתביעה רגילה, כאשר מתברר שהתביעה אינה מתאימה עוד להתברר בהליך המהיר. היא מדגישה את שיקול הדעת הנתון לבית המשפט ואת גמישות ההליך.',
    'תקנה 80 לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי בית המשפט רשאי, בכל שלב של הדיון, להורות על העברת תביעה שהוגשה בסדר דין מהיר לסדר דין רגיל, אם מצא כי הדבר מוצדק בנסיבות העניין. סמכות זו נועדה לאפשר לבית המשפט להתאים את ההליך לצרכי התביעה, גם אם התברר במהלך הדיון כי התביעה מורכבת יותר או דורשת בירור מעמיק יותר ממה שמאפשר סדר הדין המהיר. שיקול הדעת של בית המשפט יופעל תוך התחשבות במורכבות העובדתית והמשפטית של התביעה, היקף הראיות הנדרש, וטובת הצדדים והאינטרס הציבורי בניהול הליך יעיל והוגן. תקנה 80 לתקנות סדר הדין האזרחי, תשע"ט-2018',
    'טעות נפוצה היא לחשוב שאי-התאמה לסדר דין מהיר מחייבת דחיית התביעה, או שבית המשפט חייב להמשיך לדון בהליך המהיר, מבלי להכיר את סמכותו להעביר את התביעה לסדר דין רגיל.',
    '["דיון מהיר", "סדר דין רגיל", "שינוי סדר דין", "תקנות סדר הדין האזרחי", "שיקול דעת בית המשפט", "מורכבות התביעה"]'::jsonb,
    '**וריאציה 1 — סמכות בית המשפט:** האם בית המשפט יכול לשנות סדר דין מהיר לרגיל? ← כן, רשאי להורות על כך בשיקול דעת (תקנה 80). **וריאציה 2 — מתי יועבר?** מתי יועבר הדיון? ← אם התביעה מורכבת יותר מהצפוי ואינה מתאימה לדיון מהיר.
 **וריאציה 3 — השלכות:** מהי ההשלכה של העברה? ← התביעה תמשיך להתברר בסדר דין רגיל, עם המועדים והדרישות המתאימים לו.',
    'דיון מהיר לא מתאים ← בית המשפט רשאי להעביר לרגיל ← גמישות ההליך.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 80"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'השלכות אי-צירוף מסמכים לכתב תביעה רגיל', 4, 'ראובן הגיש כתב תביעה בסדר דין רגיל, אך לא צירף אליו העתקי מסמכים מהותיים עליהם הוא מתכוון להסתמך. מה הדין?',
    'שאלה זו עוסקת בהשלכות אי-צירוף מסמכים מהותיים לכתב תביעה בסדר דין רגיל, ומדגישה את ההבדל בין דרישות הצירוף בסדר דין רגיל לבין אלו שבסדר דין מהיר. היא בוחנת את סמכות בית המשפט להורות על תיקון הפגם לפני נקיטת סנקציות חמורות.',
    'בתביעה בסדר דין רגיל, תקנה 21(א) לתקנות סדר הדין האזרחי, תשע"ט-2018, קובעת כי לכתב טענות יצורפו העתקי המסמכים המהותיים שהמצהיר מתכוון להסתמך עליהם. אולם, אי-צירוף מסמכים אינו פגם מהותי המוביל לדחייה או מחיקה אוטומטית של התביעה. לרוב, בית המשפט יורה לתובע לתקן את הפגם ולצרף את המסמכים החסרים תוך זמן קצוב, בהתאם לסמכותו לפי תקנה 52 לתקנות סדר הדין האזרחי. רק אם התובע לא יציית להוראת בית המשפט, עלולה התביעה להימחק או להידחות. זאת בניגוד לסדר דין מהיר, שם הדרישות מחמירות יותר וההשלכות של אי-צירוף עלולות להיות חמורות יותר כבר בשלב מוקדם. תקנה 21(א) לתקנות סדר הדין האזרחי, תשע"ט-2018תקנה 52 לתקנות סדר הדין האזרחי, תשע"ט-2018',
    'טעות נפוצה היא להשליך את הדרישות המחמירות של סדר דין מהיר על סדר דין רגיל, ולחשוב שאי-צירוף מסמכים בתביעה רגילה מוביל לדחייה או מחיקה אוטומטית.',
    '["סדר דין רגיל", "צירוף מסמכים", "תיקון פגם", "תקנות סדר הדין האזרחי", "דחיית תביעה", "מחיקת תביעה"]'::jsonb,
    '**וריאציה 1 — חובת צירוף:** האם יש חובה לצרף מסמכים לכתב תביעה רגיל? ← כן, העתקי מסמכים מהותיים (תקנה 21(א)). **וריאציה 2 — השלכות אי-צירוף:** מה קורה אם לא צורפו? ← בית המשפט יורה על תיקון הפגם (תקנה 52). **וריאציה 3 — סנקציות:** מתי יינקטו סנקציות חמורות? ← רק אם התובע לא יציית להוראת בית המשפט לתיקון הפגם.',
    'כתב תביעה רגיל ללא מסמכים ← בית המשפט יורה על תיקון ← לא דחייה אוטומטית.',
    '["תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 21(א)", "תקנות סדר הדין האזרחי, תשע\"ט-2018, תקנה 52"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כן, כל תביעה כספית שאינה עולה על 250,000 ש"ח יכולה להתברר בדיון מהיר.', false, 'תשובה זו שגויה. אף שהסכום מתאים, לא כל תביעה כספית עד 250,000 ש"ח יכולה להתברר בדיון מהיר, אלא רק אם בית המשפט מצא שהיא מתאימה לכך ואינה נמנית על התביעות המוחרגות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'לא, תביעה בסכום זה אינה יכולה להתברר בסדר דין מהיר.', false, 'תשובה זו שגויה. תביעה בסכום של 100,000 ש"ח יכולה להתברר בסדר דין מהיר, בשיקול דעת בית המשפט, שכן היא אינה עולה על 250,000 ש"ח.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אם היא עומדת בתנאים נוספים הקבועים בתקנות, כגון שאינה תביעה לפינוי מושכר.', true, 'זו התשובה הנכונה. תביעה בסכום שבין 75,000 ש"ח ל-250,000 ש"ח יכולה להתברר בסדר דין מהיר בשיקול דעת בית המשפט, ובלבד שאינה נמנית על התביעות המוחרגות המפורטות בתקנה 78(ג) לתקנות סדר הדין האזרחי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, תביעה בגין הפרת חוזה אינה מתאימה לדיון מהיר.', false, 'תשובה זו שגויה. תביעה בגין הפרת חוזה אינה נמנית על התביעות המוחרגות מסדר דין מהיר, ולכן יכולה להתברר בו אם עומדת בתנאי הסכום.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'התביעה אינה תביעה לפינוי מושכר, והיא אינה תביעה ייצוגית.', false, 'תשובה זו שגויה. תביעה לפינוי מושכר דווקא יכולה להתברר בסדר דין מהיר (תקנה 78(א)), והיא אינה רשימה מלאה של התביעות המוחרגות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'התביעה אינה תביעה ייצוגית, אינה תביעה בסדר דין מקוצר, ואינה תביעה לפי חוק פיצויים לנפגעי תאונות דרכים.', true, 'זו התשובה הנכונה. אלו הן שלוש דוגמאות בולטות מתוך רשימת התביעות המוחרגות המפורטות בתקנה 78(ג) לתקנות סדר הדין האזרחי, שאינן יכולות להתברר בסדר דין מהיר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'התביעה אינה תביעה לפינוי מושכר, ואין בה צורך בחוות דעת מומחה.', false, 'תשובה זו שגויה. תביעה לפינוי מושכר יכולה להתברר בסדר דין מהיר, ואין מניעה לצרף חוות דעת מומחה לתביעה בסדר דין מהיר (תקנה 79(א)).', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'התביעה אינה תביעה ייצוגית, ואין בה יותר משני עדים.', false, 'תשובה זו שגויה. אף שתביעה ייצוגית מוחרגת, אין הגבלה על מספר העדים בתביעה בסדר דין מהיר.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'בית המשפט חייב להעביר את התביעה לסדר דין רגיל, שכן התברר שאינה מתאימה לדיון מהיר.', false, 'תשובה זו שגויה. בית המשפט אינו חייב, אלא רשאי להעביר את התביעה לסדר דין רגיל, בשיקול דעת.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'בית המשפט רשאי להורות על העברת התביעה לסדר דין רגיל, אם מצא כי הדבר מוצדק בנסיבות העניין.', true, 'זו התשובה הנכונה, המשקפת את הוראת תקנה 80 לתקנות סדר הדין האזרחי, המעניקה לבית המשפט שיקול דעת להעביר תביעה מסדר דין מהיר לרגיל.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'בית המשפט חייב לדחות את התביעה, שכן היא הוגשה בסדר דין שאינו מתאים.', false, 'תשובה זו שגויה. דחיית התביעה אינה הפתרון במקרה של אי-התאמה לסדר דין מהיר, אלא העברתה לסדר דין רגיל.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'בית המשפט ימשיך לדון בתביעה בסדר דין מהיר, אך יאריך את המועדים להגשת כתבי טענות וראיות.', false, 'תשובה זו שגויה. אף שניתן להאריך מועדים, אם התביעה אינה מתאימה במהותה לדיון מהיר, יש להעבירה לסדר דין רגיל.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'בית המשפט ידחה את התביעה על הסף בשל אי-צירוף המסמכים.', false, 'תשובה זו שגויה. אי-צירוף מסמכים לכתב תביעה רגיל אינו מוביל לדחייה על הסף, אלא לרוב יאפשר לתובע לתקן את הפגם.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'בית המשפט יורה לתובע לצרף את המסמכים תוך זמן קצוב, ורק אם לא יעשה כן, עלולה התביעה להימחק או להידחות.', true, 'זו התשובה הנכונה. בתביעה רגילה, אי-צירוף מסמכים הוא פגם הניתן לתיקון, ובית המשפט יורה על כך לפני נקיטת סנקציות חמורות יותר.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'התובע לא יוכל להסתמך על המסמכים שלא צורפו בכתב התביעה, אלא אם יקבל אישור מיוחד מבית המשפט.', false, 'תשובה זו שגויה. אף שזו יכולה להיות השלכה אפשרית, הדין מאפשר תיקון הפגם לפני הגעה למצב זה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'הנתבע יוכל לבקש מבית המשפט למחוק את התביעה בשל אי-צירוף המסמכים.', false, 'תשובה זו שגויה. הנתבע יכול לבקש, אך בית המשפט לרוב יאפשר תיקון לפני מחיקה, במיוחד בתביעה רגילה.', 4);

END $$;

-- ============================================================
-- Q13 — 2024-W-Q13 — chapter=civil_proc subtopic=proceedings
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q13';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q13 skipped: external_id % already exists', '2024-W-Q13';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'proceedings';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q13', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'הוגשה עתירה לבית המשפט הגבוה לצדק נגד החלטת שר האוצר, ובה התבקש בית המשפט ליתן צו על תנאי ביחס להחלטה ולאחר מכן להפוך אותו למוחלט. באותו היום ניתנה החלטת השופט, בדן יחיד, שלפיה העתירה תועבר לדיון לפני הרכב וניתן צו על תנאי. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 13}'::jsonb,
    'שאלה זו עוסקת בסמכויותיו של שופט יחיד בבית המשפט הגבוה לצדק (בג"ץ) בשלב הראשוני של הדיון בעתירה, ובפרט ביכולתו להוציא צו על תנאי. היא מתייחסת לעיקרון הדו-שלבי של הדיון בבג"ץ, כפי שמעוגן בסעיף 26(3) לחוק בתי המשפט ובתקנה 5 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984.',
    'הדיון בבית המשפט הגבוה לצדק נערך במתכונת דו-שלבית: בשלב הראשון, בית המשפט שוקל הוצאת צו על תנאי, ורק לאחר מכן, אם הוצא צו כזה והמשיבים הגישו תצהיר תשובה, נדון העניין לגופו. סעיף 26(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי שופט יחיד מוסמך לדון בבקשות לצווי על תנאי. תקנה 5 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984, מפרטת כי העתירה תובא בפני שופט של בית המשפט העליון, והוא רשאי ליתן את הצו על תנאי, להורות על הזמנת העותר לפניו, או להעביר את העתירה להרכב של שלושה שופטים. עם זאת, שופט יחיד אינו מוסמך לסרב למתן צו על תנאי או לתתו על מקצת עילותיו בלבד, ואינו רשאי לדחות עתירה. לכן, במקרה הנדון, השופט לא חרג מסמכותו כאשר הורה על מתן צו על תנאי בדן יחיד, שכן זו אחת הסמכויות המפורשות הנתונות לו בשלב זה של ההליך. סעיף 26(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984תקנה 5 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984בג"ץ 3279/22 מדינת ישראל משרד הבריאות ומשרד הרווחה נ'' חיים זר (06.11.2024)נבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהלייםדפנה ברק-ארז משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017) | ג . סדרי הדין בבג "ץ',
    'טעות נפוצה היא לבלבל בין סמכותו של שופט יחיד להוציא צו על תנאי לבין סמכותו לדחות עתירה או לקבל חלק ממנה, שהן סמכויות השמורות להרכב של שלושה שופטים או לשלב מאוחר יותר בהליך.',
    '["צו על תנאי", "בג\"ץ", "דן יחיד", "הרכב", "סמכות שיפוטית", "חוק בתי המשפט", "תקנות סדר הדין בבג\"ץ"]'::jsonb,
    '**וריאציה 1 — סמכות דן יחיד:** האם שופט יחיד יכול לתת צו על תנאי? ← כן, לפי תקנה 5 לתקנות סדר הדין בבג"ץ וסעיף 26(3) לחוק בתי המשפט. **וריאציה 2 — סמכות דחייה:** האם שופט יחיד יכול לדחות עתירה? ← לא, רק הרכב של שלושה שופטים יכול לדחות עתירה (תקנה 5 לתקנות סדר הדין בבג"ץ). **וריאציה 3 — קבלת חלק מהעתירה:** האם שופט יחיד יכול לקבל חלק מהעתירה בשלב הצו על תנאי? ← לא, זה הופך את הדיון לחד-שלבי ושולל הגנה מהותית מהמשיבים (בג"ץ 3279/22).',
    'שופט יחיד בבג"ץ ← יכול לתת צו על תנאי ← לא יכול לדחות עתירה או לקבל חלק ממנה.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 26(3)", "תקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ\"ד-1984, תקנה 5", "בג\"ץ 3279/22 מדינת ישראל משרד הבריאות ומשרד הרווחה נ'' חיים זר (06.11.2024)", "נבו - המתמחה, מערכת בתי המשפט (2026)", "דפנה ברק-ארז, משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'נדרש מותב תלתא לפחות על מנת להורות על מתן צו על תנאי, ולכן השופט חרג מסמכותו כאשר הורה על מתן צו על תנאי בדן יחיד.', false, 'תשובה זו שגויה. שופט יחיד מוסמך לתת צו על תנאי, אך אינו מוסמך לדחות עתירה או לתת צו על תנאי על מקצת עילותיה בלבד.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בסמכות השופט לתת צו על תנאי גם בדן יחיד, אולם אין בסמכותו להורות על כך לפני קבלת עמדת המשיב לעתירה.', false, 'תשובה זו שגויה. שופט יחיד רשאי לתת צו על תנאי במעמד צד אחד, כלומר ללא קבלת עמדת המשיב מראש, כחלק מהליך הסינון הראשוני.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'רק הרכב מורחב רשאי להורות על מתן צו על תנאי, וזאת רק לאחר קיום דיון בעתירה. לכן, השופט חרג מסמכותו.', false, 'תשובה זו שגויה. שופט יחיד מוסמך לתת צו על תנאי, ואין חובה לקיים דיון מקדים במעמד המשיבים לפני הוצאת צו על תנאי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'השופט לא חרג מסמכותו כאשר הורה על מתן צו על תנאי בדן יחיד בנסיבות אלו.', true, 'זו התשובה הנכונה. סעיף 26(3) לחוק בתי המשפט ותקנה 5 לתקנות סדר הדין בבג"ץ מאפשרים לשופט יחיד לתת צו על תנאי, אך לא לדחות עתירה או לתת צו על תנאי על מקצת עילותיה בלבד.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'סמכות שופט יחיד לדחות עתירה בבג"ץ', 1, 'הוגשה עתירה לבית המשפט הגבוה לצדק. שופט יחיד שדן בעתירה סבר כי היא אינה מראה על פניה עילה, והחליט לדחות אותה על הסף. מה הדין?',
    'שאלה זו בוחנת את גבולות סמכותו של שופט יחיד בבית המשפט הגבוה לצדק. היא מדגישה כי שופט יחיד מוסמך לתת צו על תנאי או להעביר את העתירה להרכב, אך אינו מוסמך לדחות עתירה, גם אם היא נראית חסרת עילה, שכן סמכות זו נתונה להרכב של שלושה שופטים בלבד.',
    'סעיף 26(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984, קובע כי שופט יחיד מוסמך לדון בבקשות לצווי ביניים, לצווים זמניים ולהחלטות ביניים אחרות, וכן בבקשות לצווי על תנאי, אך שופט אחד לא יהיה מוסמך לסרב למתן צו על תנאי או לתתו על מקצת עילותיו בלבד. תקנה 5 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984, מפרטת כי שופט יחיד רשאי ליתן צו על תנאי, להורות על הזמנת העותר לפניו, או להעביר את העתירה להרכב של שלושה שופטים. רק הרכב של שלושה שופטים רשאי לדחות עתירה על יסוד האמור בה, ללא הזמנת העותר, אם סבור שהעתירה אינה מראה על פניה עילה. לכן, שופט יחיד שדחה עתירה חרג מסמכותו. סעיף 26(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984תקנה 5 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984נבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהלייםדפנה ברק-ארז משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017) | ג . סדרי הדין בבג "ץ',
    'טעות נפוצה היא להניח ששופט יחיד, המוסמך לטפל בבקשות ראשוניות, מוסמך גם לדחות עתירה על הסף, מבלי להבחין בין סמכויותיו המוגבלות לבין סמכותו הרחבה יותר של הרכב.',
    '["דן יחיד", "הרכב", "דחיית עתירה", "צו על תנאי", "סמכות שיפוטית", "חוק בתי המשפט", "תקנות סדר הדין בבג\"ץ"]'::jsonb,
    '**וריאציה 1 — דחיית עתירה:** האם שופט יחיד יכול לדחות עתירה בבג"ץ? ← לא, רק הרכב של שלושה שופטים (סעיף 26(3) לחוק בתי המשפט). **וריאציה 2 — חובת העברה:** מה יעשה שופט יחיד הסבור שיש לדחות עתירה? ← יעביר אותה להרכב של שלושה שופטים (תקנה 5 לתקנות סדר הדין בבג"ץ). 
**וריאציה 3 — סמכות הרכב:** מתי הרכב יכול לדחות עתירה? ← אם סבור שהעתירה אינה מראה עילה, גם ללא הזמנת העותר (תקנה 5 לתקנות סדר הדין בבג"ץ).',
    'שופט יחיד בבג"ץ ← לא יכול לדחות עתירה ← חייב להעביר להרכב.',
    '["חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 26(3)", "תקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ\"ד-1984, תקנה 5", "נבו - המתמחה, מערכת בתי המשפט (2026)", "דפנה ברק-ארז, משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'תנאים למתן צו ביניים בבג"ץ', 2, 'הוגשה עתירה לבג"ץ, ובמקביל התבקש צו ביניים. אילו תנאים נדרשים בדרך כלל למתן צו ביניים בבג"ץ?',
    'שאלה זו עוסקת בתנאים למתן צו ביניים בבית המשפט הגבוה לצדק. היא מדגישה את הצורך בקיומם של סיכויים סבירים לקבלת העתירה ואת נטיית מאזן הנוחות לטובת העותר, כשיקולים מרכזיים בהפעלת שיקול הדעת השיפוטי למתן סעד זמני.',
    'צו ביניים בבג"ץ הוא סעד זמני שמטרתו לשמור על המצב הקיים או למנוע נזק בלתי הפיך עד למתן פסק דין סופי בעתירה. תקנה 19 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984, מסמיכה את בית המשפט ליתן צווי ביניים. הפסיקה קבעה כי בית המשפט נזהר שלא להוציא צו כזה, אלא אם נראה לו, מצד אחד, כי יש סיכוי סביר שהעתירה תתקבל, ומצד שני כי מאזן הנוחות נוטה לצד העותר. כלומר, הנזק שייגרם לעותר אם לא יינתן הצו עולה על הנזק שייגרם למשיב אם יינתן הצו. שופט יחיד מוסמך לדון בבקשות לצווי ביניים לפי סעיף 26(3) לחוק בתי המשפט. תקנה 19 לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984סעיף 26(3) לחוק בתי המשפט [נוסח משולב], תשמ"ד-1984יצחק זמיר הסמכות המינהלית, כרך ד - סדרי הביקורת המשפטית (2017) | פרק 73: סדרי דיןנבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהליים',
    'טעות נפוצה היא לבלבל בין צו ביניים לצו על תנאי, או לחשוב שצו ביניים ניתן באופן אוטומטי או ללא בחינת מאזן הנוחות.',
    '["צו ביניים", "סעד זמני", "מאזן נוחות", "סיכוי סביר", "נזק בלתי הפיך", "תקנה 19 לתקנות סדר הדין בבג\"ץ"]'::jsonb,
    '**וריאציה 1 — מטרת צו ביניים:** מה מטרת צו ביניים בבג"ץ? ← לשמור על המצב הקיים ולמנוע נזק בלתי הפיך (נבו - המתמחה, מערכת בתי המשפט). **וריאציה 2 — תנאים למתן:** באילו תנאים יינתן צו ביניים? ← סיכוי סביר לקבלת העתירה ומאזן נוחות נוטה לעותר (יצחק זמיר, הסמכות המינהלית). **וריאציה 3 — סמכות:** מי מוסמך לתת צו ביניים? ← שופט יחיד או הרכב (סעיף 26(3) לחוק בתי המשפט).',
    'צו ביניים ← סעד זמני לשמירת מצב קיים ← סיכוי סביר + מאזן נוחות.',
    '["תקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ\"ד-1984, תקנה 19", "חוק בתי המשפט [נוסח משולב], תשמ\"ד-1984, סעיף 26(3)", "יצחק זמיר, הסמכות המינהלית, כרך ד - סדרי הביקורת המשפטית (2017)", "נבו - המתמחה, מערכת בתי המשפט (2026)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'דיון בעתירה כאילו ניתן צו על תנאי בהסכמת המשיב', 3, 'הוגשה עתירה לבג"ץ. המשיב הוזמן לדיון בעתירה למתן צו על תנאי, והסכים לדון ולהחליט בעתירה כאילו כבר ניתן צו על תנאי. מה הדין?',
    'שאלה זו עוסקת בחריג לכלל הדו-שלביות בהליכי בג"ץ, המאפשר לבית המשפט לדון בעתירה לגופה כאילו ניתן צו על תנאי, וזאת בהסכמת המשיב. היא מדגישה את הגמישות הפרוצדורלית ואת האפשרות לייעל את הדיון במקרים מתאימים.',
    'ההליך בבית המשפט הגבוה לצדק הוא בדרך כלל דו-שלבי: הוצאת צו על תנאי ולאחר מכן דיון בעתירה לגופה. אולם, תקנה 7(ג) לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984, קובעת חריג לכלל זה: אם המשיב הוזמן לדיון בעתירה למתן צו על תנאי, רשאי בית המשפט, בהסכמת המשיב, לדון ולהחליט בעתירה כאילו כבר ניתן הצו על תנאי. במצב זה, בית המשפט רשאי לדון בעתירה לגופה ואף ליתן צו מוחלט, מבלי לעבור את השלב הפורמלי של הוצאת צו על תנאי והמתנה לתצהיר תשובה. מנגנון זה נועד לייעל את הדיון, במיוחד כאשר המשיב מוכן להתמודד עם טענות העתירה באופן מיידי. תקנה 7(ג) לתקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ"ד-1984בג"ץ 4491/13 המרכז האקדמי למשפט ולעסקים (ע"ר) נ'' ממשלת ישראל (05.08.2013)נבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהלייםיצחק זמיר הסמכות המינהלית, כרך ד - סדרי הביקורת המשפטית (2017) | פרק 73: סדרי דין',
    'טעות נפוצה היא לחשוב שהליך בג"ץ הוא תמיד דו-שלבי נוקשה, מבלי להכיר את החריג המאפשר דיון מקוצר בהסכמת המשיב.',
    '["צו על תנאי", "דיון כאילו ניתן צו על תנאי", "הסכמת משיב", "תקנה 7(ג) לתקנות סדר הדין בבג\"ץ", "ייעול הליך", "צו מוחלט"]'::jsonb,
    '**וריאציה 1 — תנאי לדיון:** מה התנאי לדיון בעתירה כאילו ניתן צו על תנאי? ← הסכמת המשיב (תקנה 7(ג) לתקנות סדר הדין בבג"ץ). **וריאציה 2 — מטרת ההליך:** מה מטרת הליך זה? ← לייעל את הדיון ולאפשר הכרעה מהירה יותר (בג"ץ 4491/13). **וריאציה 3 — סמכות בית המשפט:** מה בית המשפט רשאי לעשות במצב זה? ← לדון ולהחליט בעתירה לגופה, ואף ליתן צו מוחלט (נבו - המתמחה, מערכת בתי המשפט).',
    'הסכמת משיב לדיון כאילו ניתן צו על תנאי ← בית המשפט רשאי לדון לגופה ולתת צו מוחלט ← ייעול הליך.',
    '["תקנות סדר הדין בבית המשפט הגבוה לצדק, תשמ\"ד-1984, תקנה 7(ג)", "בג\"ץ 4491/13 המרכז האקדמי למשפט ולעסקים (ע\"ר) נ'' ממשלת ישראל (05.08.2013)", "נבו - המתמחה, מערכת בתי המשפט (2026)", "יצחק זמיר, הסמכות המינהלית, כרך ד - סדרי הביקורת המשפטית (2017)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'השלכות קבלת חלק מהעתירה בשלב הצו על תנאי', 4, 'שופט יחיד בבג"ץ, במסגרת מתן צו על תנאי, החליט לקבל חלק מטענות העותרים. מה הדין?',
    'שאלה זו עוסקת בהבחנה קריטית בין הוצאת צו על תנאי לבין קבלת העתירה (אפילו בחלקה) בבית המשפט הגבוה לצדק. היא מדגישה את העיקרון הדו-שלבי של הדיון בבג"ץ ואת ההגנה הדיונית הניתנת למשיבים, וקובעת כי שופט יחיד אינו מוסמך לקבל חלק מהעתירה בשלב הצו על תנאי.',
    'הדיון בבית המשפט הגבוה לצדק נערך במתכונת דו-שלבית: בשלב הראשון, בית המשפט שוקל הוצאת צו על תנאי, ובשלב השני, לאחר הגשת תצהיר תשובה על ידי המשיבים, נדון העניין לגופו. כפי שנקבע בבג"ץ 3279/22, שופט יחיד, במסגרת מתן צו על תנאי, אינו רשאי לקבל את העתירה ואף לא את חלקה. קבלת חלק מהעתירה בשלב זה משמעותה שלילת הגנה מהותית שנתונה למשיבים והפיכת הדיון בבג"ץ לחד-שלבי, דבר שאינו מתיישב עם הדין הקיים. הצו על תנאי תוחם את הדיון בעתירה רק במובן שיתר הסעדים, שלגביהם לא ניתן צו על תנאי, נדחו. ההרכב שדן בהתנגדות לעשיית הצו על תנאי למוחלט רשאי לדחותה ללא קשר לאופן ניסוחו של הצו על תנאי שניתן. בג"ץ 3279/22 מדינת ישראל משרד הבריאות ומשרד הרווחה נ'' חיים זר (06.11.2024)נבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהלייםדפנה ברק-ארז משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017) | ג . סדרי הדין בבג "ץ',
    'טעות נפוצה היא לראות בצו על תנאי מעין קבלה חלקית של העתירה, מבלי להבין את אופיו הדיוני של הצו ואת ההבחנה בינו לבין קבלת העתירה לגופה.',
    '["צו על תנאי", "הליך דו-שלבי", "קבלת עתירה", "דן יחיד", "הגנה דיונית", "בג\"ץ 3279/22"]'::jsonb,
    '**וריאציה 1 — קבלת חלק מהעתירה:** האם שופט יחיד יכול לקבל חלק מהעתירה בשלב הצו על תנאי? ← לא, זה הופך את הדיון לחד-שלבי ושולל הגנה מהמשיבים (בג"ץ 3279/22). **וריאציה 2 — מטרת הצו על תנאי:** מה מטרת הצו על תנאי? ← שלב סינון ראשוני, לא קבלת העתירה (נבו - המתמחה, מערכת בתי המשפט). **וריאציה 3 — סמכות הרכב:** מי מוסמך לקבל עתירה? ← הרכב, ורק לאחר הגשת תצהיר תשובה ודיון לגופה (נבו - המתמחה, מערכת בתי המשפט).',
    'שופט יחיד ← לא יכול לקבל חלק מהעתירה בשלב צו על תנאי ← הליך דו-שלבי.',
    '["בג\"ץ 3279/22 מדינת ישראל משרד הבריאות ומשרד הרווחה נ'' חיים זר (06.11.2024)", "נבו - המתמחה, מערכת בתי המשפט (2026)", "דפנה ברק-ארז, משפט מינהלי כרך ד'' - משפט מינהלי דיוני (2017)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'השופט חרג מסמכותו, שכן שופט יחיד אינו מוסמך לדחות עתירה בבג"ץ.', true, 'זו התשובה הנכונה. סעיף 26(3) לחוק בתי המשפט ותקנה 5 לתקנות סדר הדין בבג"ץ קובעים במפורש כי שופט יחיד אינו מוסמך לדחות עתירה, אלא רק הרכב של שלושה שופטים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'השופט פעל בסמכות, שכן אם העתירה אינה מראה עילה, רשאי כל שופט לדחותה.', false, 'תשובה זו שגויה. אף שהרכב של שלושה שופטים רשאי לדחות עתירה שאינה מראה עילה, שופט יחיד אינו מוסמך לכך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'השופט חרג מסמכותו, שכן היה עליו להזמין את העותר לדיון לפני דחיית העתירה.', false, 'תשובה זו שגויה. הרכב של שלושה שופטים רשאי לדחות עתירה על הסף ללא הזמנת העותר, אך שופט יחיד אינו מוסמך לדחותה כלל.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'השופט פעל בסמכות, אך היה עליו להעביר את העתירה לדיון בפני הרכב לפני מתן החלטה.', false, 'תשובה זו שגויה חלקית. אכן, שופט יחיד הסבור שיש לדחות עתירה צריך להעבירה להרכב, אך עצם ההעברה אינה בגדר ''פעולה בסמכות'' לדחייה, אלא העברת הסמכות לגוף המוסמך.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'די בכך שהעתירה מעלה שאלה משפטית עקרונית, ללא צורך בבחינת מאזן הנוחות.', false, 'תשובה זו שגויה. אף שחשיבות ציבורית היא שיקול, היא אינה מספקת לבדה למתן צו ביניים, ויש לבחון גם את מאזן הנוחות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'יש סיכוי סביר שהעתירה תתקבל, ומאזן הנוחות נוטה לצד העותר.', true, 'זו התשובה הנכונה. אלו הם שני התנאים המרכזיים למתן צו ביניים, המאזנים בין סיכויי העתירה לבין הנזק שייגרם לצדדים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'הצו יינתן רק אם המשיב הסכים לכך, וזאת כדי לייעל את הדיון.', false, 'תשובה זו שגויה. הסכמת המשיב אינה תנאי למתן צו ביניים, שכן מטרתו היא למנוע נזק מיידי, לעיתים גם בניגוד לעמדת המשיב.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'הצו יינתן באופן אוטומטי עם הוצאת צו על תנאי, שכן שניהם סעדים זמניים.', false, 'תשובה זו שגויה. צו ביניים וצו על תנאי הם סעדים שונים, וצו ביניים אינו ניתן באופן אוטומטי עם הוצאת צו על תנאי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'בית המשפט רשאי לדון ולהחליט בעתירה לגופה, ואף ליתן צו מוחלט, מבלי להוציא צו על תנאי פורמלי.', true, 'זו התשובה הנכונה. תקנה 7(ג) לתקנות סדר הדין בבג"ץ מאפשרת לבית המשפט, בהסכמת המשיב, לדון בעתירה כאילו ניתן צו על תנאי, ובכך לייעל את ההליך.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'בית המשפט חייב להוציא צו על תנאי פורמלי לפני שיוכל לדון בעתירה לגופה, גם אם המשיב הסכים.', false, 'תשובה זו שגויה. הסכמת המשיב מאפשרת לבית המשפט לדלג על השלב הפורמלי של הוצאת צו על תנאי, ובכך לייעל את הדיון.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'בית המשפט רשאי לדון בעתירה, אך אינו רשאי ליתן צו מוחלט ללא הוצאת צו על תנאי פורמלי.', false, 'תשובה זו שגויה. אם בית המשפט דן בעתירה כאילו ניתן צו על תנאי, הוא מוסמך גם ליתן צו מוחלט בסיום הדיון.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'הסכמת המשיב אינה רלוונטית, שכן הדיון בבג"ץ הוא תמיד דו-שלבי.', false, 'תשובה זו שגויה. הסכמת המשיב היא חריג לכלל הדו-שלביות, המאפשר ייעול הליכים במקרים מתאימים.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'השופט פעל בסמכות, שכן הוא רשאי לקבל חלק מהעתירה כבר בשלב הצו על תנאי.', false, 'תשובה זו שגויה. פסיקת בית המשפט העליון קבעה כי שופט יחיד אינו מוסמך לקבל חלק מהעתירה בשלב הצו על תנאי, שכן הדבר הופך את הדיון לחד-שלבי ושולל הגנה מהותית מהמשיבים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'השופט חרג מסמכותו, שכן קבלת חלק מהעתירה בשלב הצו על תנאי הופכת את הדיון לחד-שלבי ושוללת הגנה מהותית מהמשיבים.', true, 'זו התשובה הנכונה. כפי שנקבע בבג"ץ 3279/22, קבלת חלק מהעתירה בשלב הצו על תנאי אינה מתיישבת עם הדין הקיים ועם ההליך הדו-שלבי בבג"ץ.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'השופט פעל בסמכות, אך היה עליו להזמין את המשיבים לדיון לפני קבלת חלק מהעתירה.', false, 'תשובה זו שגויה. גם אם המשיבים הוזמנו, שופט יחיד אינו מוסמך לקבל חלק מהעתירה בשלב הצו על תנאי, אלא רק הרכב.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'השופט חרג מסמכותו, שכן רק הרכב מורחב רשאי לקבל חלק מהעתירה.', false, 'תשובה זו שגויה חלקית. אכן, רק הרכב מוסמך לקבל עתירה (או חלק ממנה), אך לא בשלב הצו על תנאי, אלא רק לאחר הגשת תצהיר תשובה ודיון לגופה.', 4);

END $$;

-- ============================================================
-- Q14 — 2024-W-Q14 — chapter=criminal_proc subtopic=lawyer_discipline
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q14';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q14 skipped: external_id % already exists', '2024-W-Q14';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lawyer_discipline';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'lawyer_discipline';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q14', 'e4a16014-22c7-4653-bf0d-89ff4bb34c20', v_subtopic_id,
    'בית הדין המשמעתי זיכה את עו"ד כהן מהקובלנה שהוגשה נגדו על ידי פרקליט המדינה וחייב את אוצר המדינה בתשלום הוצאות ההליך לטובת עו"ד כהן. האם רשאי היה לעשות כן?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 14}'::jsonb,
    'שאלה זו עוסקת בסמכויותיו של בית הדין המשמעתי של לשכת עורכי הדין לפסוק הוצאות משפט. היא מתמקדת במקרה ספציפי של חיוב אוצר המדינה בהוצאות הגנה, כאשר פרקליט המדינה הוא הקובל והנאשם זוכה, בהתאם לסעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961.',
    'סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961, קובע במפורש כי אם היועץ המשפטי לממשלה או פרקליט המדינה הגיש את הקובלנה, ובית הדין המשמעתי מצא שהנאשם זוכה, הוא רשאי לחייב את אוצר המדינה בתשלום הוצאות ההגנה לנאשם. תנאי לחיוב זה הוא שבית הדין ימצא שלא היה יסוד להגשת הקובלנה או שנתקיימו נסיבות אחרות המצדיקות זאת. סעיף 63 לחוק לשכת עורכי הדין קובע כי פרקליט המדינה הוא אחד הגורמים המוסמכים להגיש קובלנה לבית דין משמעתי. לכן, במקרה המתואר, בית הדין המשמעתי פעל בסמכותו כאשר חייב את אוצר המדינה בהוצאות לטובת עו"ד כהן, בהנחה שהתקיימו התנאים המפורטים בסעיף 69(א)(5א). סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961סעיף 63 לחוק לשכת עורכי הדין, תשכ"א-1961נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | חוק לשכת עורכי הדין, התשכ"א-1961יונה דה-לוי דיני הנוטריון ותולדותיהם (2016) | פרק שישי: עבֵרות משמעת ושיפוטן',
    'טעות נפוצה היא לחשוב שחיוב בהוצאות בהליכים משמעתיים אפשרי רק כלפי הנאשם או המתלונן, מבלי להכיר את הוראת החוק הספציפית המאפשרת חיוב של אוצר המדינה או הלשכה.',
    '["חוק לשכת עורכי הדין", "בית דין משמעתי", "הוצאות משפט", "אוצר המדינה", "זיכוי", "קובלנה", "פרקליט המדינה"]'::jsonb,
    '**וריאציה 1 — חיוב אוצר המדינה:** האם בית דין משמעתי יכול לחייב את אוצר המדינה בהוצאות? ← כן, אם הקובל הוא פרקליט המדינה והנאשם זוכה (סעיף 69(א)(5א) לחוק לשכת עורכי הדין). **וריאציה 2 — תנאי לחיוב:** מהם התנאים לחיוב אוצר המדינה? ← זיכוי הנאשם ומציאת חוסר יסוד לקובלנה או נסיבות אחרות המצדיקות זאת (סעיף 69(א)(5א) לחוק לשכת עורכי הדין). **וריאציה 3 — סמכות הקובל:** האם פרקליט המדינה מוסמך להגיש קובלנה? ← כן, הוא נחשב ל"קובל" לפי סעיף 63 לחוק לשכת עורכי הדין.',
    'זיכוי עו"ד מקובלנה של פרקליט המדינה ← בית הדין רשאי לחייב את אוצר המדינה בהוצאות (סעיף 69(א)(5א) לחוק לשכת עורכי הדין).',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961, סעיף 69(א)(5א)", "חוק לשכת עורכי הדין, תשכ\"א-1961, סעיף 63", "נבו - המתמחה, אתיקה מקצועית - כללי האתיקה (2026)", "יונה דה-לוי, דיני הנוטריון ותולדותיהם (2016)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'כן.', true, 'זו התשובה הנכונה. סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961, מסמיך במפורש את בית הדין המשמעתי לחייב את אוצר המדינה בהוצאות הגנה לנאשם שזוכה, אם הקובל היה פרקליט המדינה ומצא בית הדין שלא היה יסוד להגשת הקובלנה או שהתקיימו נסיבות אחרות המצדיקות זאת.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'לא ניתן לחייב את אוצר המדינה בהוצאות בהליכי משמעת.', false, 'תשובה זו שגויה. סעיף 69(א)(5א) לחוק לשכת עורכי הדין קובע במפורש את האפשרות לחייב את אוצר המדינה בהוצאות בהליכי משמעת, בתנאים מסוימים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'כל ההליך פסול מיסודו, שכן פרקליט המדינה אינו מוסמך להגיש קובלנה.', false, 'תשובה זו שגויה. סעיף 63 לחוק לשכת עורכי הדין קובע במפורש כי פרקליט המדינה הוא אחד הגורמים המוסמכים להגיש קובלנה לבית דין משמעתי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'לא; בהליכי משמעת ניתן לחייב בהוצאות רק את הנקבל, אך לא את הקובל.', false, 'תשובה זו שגויה. סעיף 69 לחוק לשכת עורכי הדין מאפשר חיוב בהוצאות הן של נאשם שהורשע (סעיף קטן (א)(2)), הן של מתלונן (סעיף קטן (א)(5)), והן של הלשכה או אוצר המדינה (סעיף קטן (א)(5א)).', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'חיוב הלשכה בהוצאות לאחר זיכוי נאשם', 1, 'בית הדין המשמעתי זיכה את עו"ד לוי מקובלנה שהוגשה נגדו על ידי ועדת האתיקה המחוזית של לשכת עורכי הדין. האם רשאי היה בית הדין לחייב את לשכת עורכי הדין בתשלום הוצאות ההליך לטובת עו"ד לוי?',
    'שאלה זו בוחנת את סמכותו של בית הדין המשמעתי לחייב את לשכת עורכי הדין בהוצאות הגנה של נאשם שזוכה מקובלנה שהוגשה על ידה. היא מתמקדת בסעיף 69(א)(5א) לחוק לשכת עורכי הדין, המאזן בין הצורך באכיפת כללי האתיקה לבין הגנה על עורכי דין מפני קובלנות חסרות יסוד.',
    'סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961, קובע כי בית דין משמעתי רשאי לחייב את הלשכה בתשלום הוצאות ההגנה לנאשם בסכום שיקבע בית הדין, אם הנאשם זוכה ובית הדין מצא שלא היה יסוד להגשת הקובלנה או שנתקיימו נסיבות אחרות המצדיקות זאת. סעיף זה נועד להבטיח כי הלשכה, כגוף המגיש קובלנות, תפעל באחריות ותשקול היטב את הגשתן, וכי נאשמים שזוכו מקובלנות חסרות יסוד לא יישאו בעלויות ההגנה. סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | חוק לשכת עורכי הדין, התשכ"א-1961יונה דה-לוי דיני הנוטריון ותולדותיהם (2016) | פרק שישי: עבֵרות משמעת ושיפוטן',
    'טעות נפוצה היא לחשוב שלשכת עורכי הדין חסינה מפסיקת הוצאות בהליכים משמעתיים שהיא עצמה יזמה, מבלי להכיר את הוראת סעיף 69(א)(5א) לחוק לשכת עורכי הדין.',
    '["חוק לשכת עורכי הדין", "בית דין משמעתי", "הוצאות הגנה", "לשכת עורכי הדין", "זיכוי", "קובלנה", "ועדת אתיקה"]'::jsonb,
    '**וריאציה 1 — חיוב הלשכה:** האם בית דין משמעתי יכול לחייב את לשכת עורכי הדין בהוצאות? ← כן, אם הנאשם זוכה ולא היה יסוד לקובלנה (סעיף 69(א)(5א) לחוק לשכת עורכי הדין). **וריאציה 2 — תנאי לחיוב:** מהם התנאים לחיוב הלשכה? ← זיכוי הנאשם ומציאת חוסר יסוד לקובלנה או נסיבות אחרות המצדיקות זאת (סעיף 69(א)(5א) לחוק לשכת עורכי הדין). **וריאציה 3 — מטרת הסעיף:** מה מטרת סעיף 69(א)(5א)? ← להבטיח אחריות של הלשכה על קובלנות חסרות יסוד ולהגן על עורכי דין.',
    'זיכוי עו"ד מקובלנה של הלשכה ← בית הדין רשאי לחייב את הלשכה בהוצאות (סעיף 69(א)(5א) לחוק לשכת עורכי הדין).',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961, סעיף 69(א)(5א)", "נבו - המתמחה, אתיקה מקצועית - כללי האתיקה (2026)", "יונה דה-לוי, דיני הנוטריון ותולדותיהם (2016)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'תנאים לחיוב אוצר המדינה בהוצאות בהליך משמעתי', 2, 'בית הדין המשמעתי זיכה את עו"ד כהן מקובלנה שהוגשה נגדו על ידי פרקליט המדינה. אילו תנאים נדרשים כדי שבית הדין יהיה רשאי לחייב את אוצר המדינה בתשלום הוצאות ההליך לטובת עו"ד כהן?',
    'שאלה זו מתמקדת בתנאים הספציפיים המאפשרים לבית הדין המשמעתי לחייב את אוצר המדינה בהוצאות הגנה, כפי שנקבעו בסעיף 69(א)(5א) לחוק לשכת עורכי הדין. היא מדגישה את הצורך בזיכוי הנאשם, ובנוסף, את קיומו של חוסר יסוד לקובלנה או נסיבות אחרות המצדיקות חיוב כזה.',
    'סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961, קובע כי אם היועץ המשפטי לממשלה או פרקליט המדינה הגיש את הקובלנה, ובית הדין מצא שהנאשם זוכה, הוא רשאי לחייב את אוצר המדינה בתשלום הוצאות ההגנה לנאשם, וזאת אם מצא בית הדין שלא היה יסוד להגשת הקובלנה או שנתקיימו נסיבות אחרות המצדיקות זאת. תנאים אלו דומים לאלו הקבועים בסעיף 80 לחוק העונשין לעניין פיצוי נאשם שזוכה בהליך פלילי, וכוללים שיקולים כמו התנהלות התביעה, משך ההליך, והנזק שנגרם לנאשם. סעיף 69(א)(5א) לחוק לשכת עורכי הדין, תשכ"א-1961נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | חוק לשכת עורכי הדין, התשכ"א-1961שלמה יעקובוביץ סדרי הדין בבית הדין לעבודה (2024) | פרק כג סדר הדין בהליכים פליליים בבית הדין לעבודהתל"פ (שלום חיפה) 1335/07 מיכאל ינוביץ נ'' מדינת ישראל, לשכת התביעות חיפה (07.07.2008)',
    'טעות נפוצה היא להניח שזיכוי אוטומטית מזכה בהוצאות, מבלי להבין את הצורך בקיום התנאים הנוספים של ''חוסר יסוד'' או ''נסיבות אחרות המצדיקות זאת''.',
    '["חוק לשכת עורכי הדין", "הוצאות הגנה", "אוצר המדינה", "זיכוי", "לא היה יסוד לקובלנה", "נסיבות אחרות המצדיקות זאת", "סעיף 80 לחוק העונשין"]'::jsonb,
    '**וריאציה 1 — תנאי לחיוב:** מהם התנאים לחיוב אוצר המדינה בהוצאות? ← זיכוי הנאשם + (אין יסוד לקובלנה או נסיבות אחרות המצדיקות זאת) (סעיף 69(א)(5א) לחוק לשכת עורכי הדין). **וריאציה 2 — דמיון לחוק העונשין:** לאיזה סעיף דומה סעיף זה? ← סעיף 80 לחוק העונשין, הדן בפיצוי נאשם שזוכה. **וריאציה 3 — שיקול דעת:** האם בית הדין חייב לחייב בהוצאות אם התנאים מתקיימים? ← לא, הסעיף מעניק שיקול דעת לבית הדין (''רשאי'').',
    'חיוב אוצר המדינה בהוצאות ← זיכוי + (אין יסוד לקובלנה או נסיבות אחרות) ← שיקול דעת בית הדין.',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961, סעיף 69(א)(5א)", "נבו - המתמחה, אתיקה מקצועית - כללי האתיקה (2026)", "שלמה יעקובוביץ, סדרי הדין בבית הדין לעבודה (2024)", "תל\"פ (שלום חיפה) 1335/07 מיכאל ינוביץ נ'' מדינת ישראל, לשכת התביעות חיפה (07.07.2008)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'חיוב מתלונן בהוצאות בהליך משמעתי', 3, 'בית הדין המשמעתי זיכה את עו"ד כהן מקובלנה שהוגשה נגדו על ידי מתלונן פרטי. בית הדין מצא שהתלונה הוגשה בקלות ראש. האם רשאי היה בית הדין לחייב את המתלונן בתשלום הוצאות ההליך לטובת עו"ד כהן?',
    'שאלה זו עוסקת בסמכותו של בית הדין המשמעתי לחייב מתלונן פרטי בהוצאות משפט, כאשר הנאשם זוכה והתלונה נמצאה ככזו שהוגשה בקלות ראש. היא מדגישה את התנאים לחיוב זה, ובפרט את חובת מתן זכות הטיעון למתלונן, כפי שמעוגן בסעיף 69(א)(5) לחוק לשכת עורכי הדין ובכללים הרלוונטיים.',
    'סעיף 69(א)(5) לחוק לשכת עורכי הדין, תשכ"א-1961, קובע כי בית דין משמעתי רשאי לחייב מתלונן בתשלום הוצאות המשפט למדינה, ללשכה ולנאשם בסכום שיקבע בית הדין, אם הנאשם זוכה ובית הדין מצא שהתלונה הוגשה בקלות ראש או לשם קינטור או ללא יסוד. בנוסף, כלל 45 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015, מבהיר כי בית הדין לא יחייב מתלונן בתשלום הוצאות אלא לאחר שנתן לו הזדמנות להשמיע את דברו. חובה זו נובעת מעקרונות הצדק הטבעי ומבטיחה כי לא ייפגע אדם שלא בפניו. סעיף 69(א)(5) לחוק לשכת עורכי הדין, תשכ"א-1961כלל 45 לכללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע"ה-2015נבו - המתמחה אתיקה מקצועית - כללי האתיקה (2026) | חוק לשכת עורכי הדין, התשכ"א-1961בד"מ (ועדת משמעת לשכת עוה"ד תל אביב-יפו) 34/05 הועד המחוזי של לשכת עורכי דין בתל אביב יפו נ'' פלוני (29.11.2006)',
    'טעות נפוצה היא להתעלם מחובת מתן זכות הטיעון למתלונן לפני חיובו בהוצאות, או לחשוב שרק עילות חמורות כמו זדון מצדיקות חיוב כזה.',
    '["חוק לשכת עורכי הדין", "בית דין משמעתי", "הוצאות משפט", "מתלונן", "זיכוי", "קלות ראש", "זכות טיעון", "כללי סדר הדין המשמעתי"]'::jsonb,
    '**וריאציה 1 — תנאי לחיוב מתלונן:** מתי בית דין משמעתי יכול לחייב מתלונן בהוצאות? ← אם הנאשם זוכה והתלונה הוגשה בקלות ראש/קינטור/ללא יסוד (סעיף 69(א)(5) לחוק לשכת עורכי הדין). **וריאציה 2 — זכות טיעון:** האם למתלונן יש זכות טיעון לפני חיוב? ← כן, חובה לתת לו הזדמנות להשמיע את דברו (כלל 45 לכללי סדר הדין המשמעתי). **וריאציה 3 — מטרת החיוב:** מה מטרת חיוב מתלונן בהוצאות? ← למנוע תלונות סרק ולקנטר, ולהגן על עורכי דין מפני הליכים מיותרים.',
    'זיכוי עו"ד + תלונה בקלות ראש ← בית הדין רשאי לחייב מתלונן בהוצאות, לאחר זכות טיעון.',
    '["חוק לשכת עורכי הדין, תשכ\"א-1961, סעיף 69(א)(5)", "כללי לשכת עורכי הדין (סדרי הדין בבתי הדין המשמעתיים), תשע\"ה-2015, כלל 45", "נבו - המתמחה, אתיקה מקצועית - כללי האתיקה (2026)", "בד\"מ (ועדת משמעת לשכת עוה\"ד תל אביב-יפו) 34/05 הועד המחוזי של לשכת עורכי דין בתל אביב יפו נ'' פלוני (29.11.2006)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'חיוב עורך דין בהוצאות אישיות בהליך משמעתי', 4, 'עו"ד כהן הורשע בהליך משמעתי. בית הדין המשמעתי שוקל לחייב אותו בהוצאות אישיות לטובת הלשכה, בשל התנהלות דיונית פסולה שגרמה להתארכות מיותרת של ההליך. האם רשאי היה בית הדין לעשות כן?',
    'שאלה זו בוחנת את סמכותו של בית הדין המשמעתי לחייב עורך דין בהוצאות אישיות, במיוחד במקרים של התנהלות דיונית פסולה. היא מדגישה את קיומה של סמכות טבועה לכל ערכאה שיפוטית, כולל בתי דין משמעתיים, להטיל הוצאות אישיות על עורך דין, גם אם החוק אינו מפרט זאת במפורש, וזאת במקרים חריגים ובזהירות רבה.',
    'לבית הדין המשמעתי, כמו לכל ערכאה שיפוטית, קיימת סמכות טבועה להטיל הוצאות אישיות על עורך דין בגין התנהלות דיונית פסולה, גם אם החוק המסמיך אינו מפרט זאת במפורש. סמכות זו נובעת מהצורך להגן על יכולתו התפקודית-מוסדית של בית הדין, להבטיח אי-ניצול הליכיו לרעה ולמנוע אי-צדק בולט. השימוש בסמכות זו ייעשה בזהירות ובמקרים חריגים בלבד, תוך מתן זכות טיעון לעורך הדין. תקנה 151(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018, עיגנה סמכות זו במפורש בהליכים אזרחיים, אך הפסיקה הכירה בקיומה של סמכות טבועה גם בהליכים משמעתיים. יעקב שקד סדר הדין האזרחי (2026) | פרק יז נושאים כלליים בפרק זה אעמוד על נושאים שונים הכרוכים בהליך האזרחי, חלקם מופיעים בתקנות וחלקם בחיקוקים אחרים.יעקב שקד סדר הדין האזרחי (2026) | פרק יד הוצאות משפטבד"מ (ועדת משמעת לשכת עוה"ד תל אביב-יפו) 34/05 הועד המחוזי של לשכת עורכי דין בתל אביב יפו נ'' פלוני (29.11.2006)ע"ע (ארצי ) 55458-09-22 חוסיין אבו חג''ול - סעיד שיח (02.11.2023)תקנה 151(ג) לתקנות סדר הדין האזרחי, תשע"ט-2018',
    'טעות נפוצה היא לחשוב שחיוב עורך דין בהוצאות אישיות אפשרי רק אם קיימת הוראת חוק מפורשת, מבלי להכיר את עקרון הסמכות הטבועה של בית המשפט.',
    '["סמכות טבועה", "הוצאות אישיות", "הליך משמעתי", "התנהלות דיונית פסולה", "שיקול דעת שיפוטי", "תקנה 151(ג) לתקנות סדר הדין האזרחי"]'::jsonb,
    '**וריאציה 1 — סמכות טבועה:** האם לבית הדין המשמעתי סמכות טבועה לחייב עו"ד בהוצאות אישיות? ← כן, במקרים חריגים של התנהלות פסולה (יעקב שקד, סדר הדין האזרחי). **וריאציה 2 — תנאים לשימוש:** מתי תופעל סמכות זו? ← בזהירות ובמקרים חריגים, למשל התנהלות דיונית פסולה שגרמה להתארכות מיותרת (בד"מ 34/05). **וריאציה 3 — זכות טיעון:** האם לעורך הדין יש זכות טיעון לפני חיוב אישי? ← כן, חובה להתרות בו מראש ולתת לו הזדמנות להסביר (יעקב שקד, סדר הדין האזרחי).',
    'עו"ד הורשע + התנהלות דיונית פסולה ← בית הדין רשאי לחייב בהוצאות אישיות מכוח סמכות טבועה, בזהירות.',
    '["יעקב שקד, סדר הדין האזרחי (2026)", "בד\"מ (ועדת משמעת לשכת עוה\"ד תל אביב-יפו) 34/05 הועד המחוזי של לשכת עורכי דין בתל אביב יפו נ'' פלוני (29.11.2006)", "ע\"ע (ארצי ) 55458-09-22 חוסיין אבו חג''ול - סעיד שיח (02.11.2023)", "תקנה 151(ג) לתקנות סדר הדין האזרחי, תשע\"ט-2018"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כן, אם בית הדין מצא שלא היה יסוד להגשת הקובלנה או שהתקיימו נסיבות אחרות המצדיקות זאת.', true, 'זו התשובה הנכונה. סעיף 69(א)(5א) לחוק לשכת עורכי הדין מסמיך את בית הדין המשמעתי לחייב את הלשכה בהוצאות הגנה לנאשם שזוכה, אם הקובל הוא ועדת האתיקה המחוזית, ומתקיימים התנאים המפורטים בסעיף.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'לא, לשכת עורכי הדין אינה יכולה להיות מחויבת בהוצאות בהליכים משמעתיים שהיא עצמה יזמה.', false, 'תשובה זו שגויה. סעיף 69(א)(5א) לחוק לשכת עורכי הדין קובע במפורש את האפשרות לחייב את הלשכה בהוצאות, ובכך מטיל עליה אחריות על קובלנות חסרות יסוד.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אך רק אם הקובלנה הוגשה בזדון או לשם קינטור.', false, 'תשובה זו שגויה. התנאים לחיוב הלשכה הם ''שלא היה יסוד להגשת הקובלנה או שנתקיימו נסיבות אחרות המצדיקות זאת'', ולאו דווקא זדון או קינטור, שהם תנאים לחיוב מתלונן פרטי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, אלא אם כן בית הדין מצא שהלשכה התרשלה בהגשת הקובלנה.', false, 'תשובה זו שגויה. אף שרשלנות יכולה להיכלל ב''נסיבות אחרות'', הסעיף אינו דורש הוכחת רשלנות ספציפית, אלא מאפשר שיקול דעת רחב יותר.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'די בזיכוי הנאשם, ללא צורך בבחינת נסיבות נוספות.', false, 'תשובה זו שגויה. זיכוי הוא תנאי הכרחי אך לא מספיק. נדרש גם קיום אחד משני התנאים הנוספים המפורטים בסעיף 69(א)(5א) לחוק לשכת עורכי הדין.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'בית הדין מצא שלא היה יסוד להגשת הקובלנה, או שהתקיימו נסיבות אחרות המצדיקות זאת.', true, 'זו התשובה הנכונה. אלו הם שני התנאים החלופיים הקבועים בסעיף 69(א)(5א) לחוק לשכת עורכי הדין, המאפשרים לבית הדין לחייב את אוצר המדינה בהוצאות הגנה לאחר זיכוי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'בית הדין מצא שהקובלנה הוגשה בזדון או לשם קינטור בלבד.', false, 'תשובה זו שגויה. ''זדון'' או ''קינטור'' הם תנאים לחיוב מתלונן פרטי בהוצאות (סעיף 69(א)(5)), אך לא לחיוב אוצר המדינה או הלשכה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'בית הדין מצא שהתנהלות פרקליט המדינה בהליך הייתה רשלנית באופן חמור.', false, 'תשובה זו שגויה. אף שרשלנות חמורה יכולה להיכלל ב''נסיבות אחרות המצדיקות זאת'', היא אינה תנאי בלעדי, והסעיף מאפשר שיקול דעת רחב יותר.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, אך רק אם המתלונן קיבל הזדמנות להשמיע את דברו לפני החיוב.', true, 'זו התשובה הנכונה. סעיף 69(א)(5) לחוק לשכת עורכי הדין מאפשר חיוב מתלונן בהוצאות בתנאים מסוימים, וכלל 45 לכללי לשכת עורכי הדין (סדרי דין בבתי הדין המשמעתיים) מחייב מתן זכות טיעון למתלונן לפני הטלת חיוב כזה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, בית הדין המשמעתי אינו מוסמך לחייב מתלונן פרטי בהוצאות.', false, 'תשובה זו שגויה. סעיף 69(א)(5) לחוק לשכת עורכי הדין מסמיך במפורש את בית הדין לחייב מתלונן פרטי בהוצאות, בתנאים מסוימים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, באופן אוטומטי, שכן תלונה בקלות ראש מצדיקה חיוב בהוצאות.', false, 'תשובה זו שגויה. החיוב אינו אוטומטי, ודורש מתן זכות טיעון למתלונן ושיקול דעת של בית הדין.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, אלא אם כן המתלונן הגיש את התלונה בזדון מובהק.', false, 'תשובה זו שגויה. ''קלות ראש'' היא אחת העילות המפורשות לחיוב מתלונן בהוצאות, ואינה דורשת הוכחת זדון מובהק.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'כן, מכוח סמכותו הטבועה של בית הדין, ובנסיבות מיוחדות.', true, 'זו התשובה הנכונה. לבית הדין המשמעתי, כמו לכל ערכאה שיפוטית, קיימת סמכות טבועה לחייב עורך דין בהוצאות אישיות במקרים חריגים של התנהלות דיונית פסולה, גם אם החוק אינו מפרט זאת במפורש.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'לא, חוק לשכת עורכי הדין אינו מסמיך את בית הדין לחייב עורך דין בהוצאות אישיות.', false, 'תשובה זו שגויה. אף שחוק לשכת עורכי הדין אינו מפרט במפורש חיוב עורך דין בהוצאות אישיות בגין התנהלות דיונית, סמכות זו נובעת מהסמכות הטבועה של בית הדין.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'כן, אך רק אם התנהלותו של עו"ד כהן הגיעה לכדי שיבוש הליכי משפט.', false, 'תשובה זו שגויה. אף ששיבוש הליכי משפט הוא עילה חמורה, הסמכות הטבועה לחיוב בהוצאות אישיות רחבה יותר וכוללת כל התנהלות דיונית פסולה שגרמה להתארכות מיותרת או לבזבוז משאבים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'לא, הוצאות אישיות על עורך דין ניתנות רק בהליכים אזרחיים, לא משמעתיים.', false, 'תשובה זו שגויה. הסמכות הטבועה לחיוב בהוצאות אישיות אינה מוגבלת לסוג הליך מסוים, וקיימת גם בהליכים משמעתיים.', 4);

END $$;

-- ============================================================
-- Q15 — 2024-W-Q15 — chapter=criminal_proc subtopic=lawyer_discipline
-- notes: needs_review=true | subtopic_mapping_review: original='העמדה לדין' → mapped='lawyer_discipline'
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q15';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q15 skipped: external_id % already exists', '2024-W-Q15';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'lawyer_discipline';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'lawyer_discipline';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q15', 'e4a16014-22c7-4653-bf0d-89ff4bb34c20', v_subtopic_id,
    'נגד פלוני הוגש לבית המשפט המחוזי כתב אישום בגין עבירה פלילית. ברצונו של פלוני להעלות טענות כלפי שיקול דעת רשויות התביעה בהחלטה להגיש כתב אישום נגדו. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 15}'::jsonb,
    'שאלה זו עוסקת בפורום המתאים לביקורת שיפוטית על החלטות רשויות התביעה להגיש כתב אישום. היא מתמקדת בהלכה שנקבעה בפסיקת בית המשפט העליון, לפיה דרך המלך להעלות טענות נגד שיקול דעת התביעה היא במסגרת ההליך הפלילי עצמו, בעיקר באמצעות דוקטרינת ''הגנה מן הצדק'' המעוגנת בסעיף 149(10) לחוק סדר הדין הפלילי.',
    'הפסיקה קבעה כי החלטות רשויות התביעה, לרבות ההחלטה להגיש כתב אישום, כפופות לביקורת שיפוטית. עם זאת, דרך המלך להעלות טענות נגד שיקול דעת התביעה בהגשת כתב אישום היא במסגרת ההליך הפלילי גופו, בפני הערכאה הדיונית. המסגרת הדוקטרינרית המתאימה לדיון בטענות אלו היא ''הגנה מן הצדק'', המעוגנת בסעיף 149(10) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982. טענה זו מאפשרת לבית המשפט להתערב במצבים שבהם הגשת כתב האישום או ניהול ההליך הפלילי עומדים בסתירה מהותית לעקרונות של צדק והגינות משפטית. דנ"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)בג"ץ 9131/05 ניר עם כהן ירקות אגודה שיתופית חקלאית בע מ'' מדינת ישראל - משרד התעשייה המסחר והתעסוקה (06.02.2006)ישגב נקדימון הגנה מן הצדק (2025) | פרק שביעי המודל המנהלי של ההגנה מן הצדקישגב נקדימון הגנה מן הצדק (2025) | פרק עשרים ושלושה סדרי דיןסעיף 149(10) לחוק סדר הדין הפלילי [נוסח משולב], תשמ"ב-1982',
    'טעות נפוצה היא לחשוב שביקורת על החלטות תביעה צריכה להתבצע תמיד בבג"ץ, מבלי להכיר את ההלכה שקבעה כי הפורום המתאים הוא הערכאה הפלילית עצמה, באמצעות דוקטרינת ''הגנה מן הצדק''.',
    '["הגנה מן הצדק", "ביקורת שיפוטית", "שיקול דעת תביעה", "הליך פלילי", "טענות מקדמיות", "סעיף 149(10) לחוק סדר הדין הפלילי"]'::jsonb,
    '**וריאציה 1 — פורום לביקורת:** היכן יש להעלות טענות נגד שיקול דעת התביעה בהגשת כתב אישום? ← במסגרת ההליך הפלילי עצמו (דנ"פ 5387/20 רותם). **וריאציה 2 — המסגרת הדוקטרינרית:** מהי המסגרת המשפטית לטענות אלו? ← הגנה מן הצדק, המעוגנת בסעיף 149(10) לחוק סדר הדין הפלילי (דנ"פ 5387/20 רותם). **וריאציה 3 — מטרת ההגנה:** מהי מטרת ההגנה מן הצדק בהקשר זה? ← להתערב במצבים שבהם הגשת כתב האישום עומדת בסתירה מהותית לעקרונות של צדק והגינות משפטית (סעיף 149(10) לחוק סדר הדין הפלילי).',
    'טענות נגד הגשת כתב אישום ← בהליך הפלילי ← באמצעות הגנה מן הצדק (סעיף 149(10) לחוק סדר הדין הפלילי).',
    '["דנ\"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)", "בג\"ץ 9131/05 ניר עם כהן ירקות אגודה שיתופית חקלאית בע מ'' מדינת ישראל - משרד התעשייה המסחר והתעסוקה (06.02.2006)", "ישגב נקדימון, הגנה מן הצדק (2025), פרק שביעי המודל המנהלי של ההגנה מן הצדק", "ישגב נקדימון, הגנה מן הצדק (2025), פרק עשרים ושלושה סדרי דין", "חוק סדר הדין הפלילי [נוסח משולב], תשמ\"ב-1982, סעיף 149(10)"]'::jsonb,
    'needs_review=true | subtopic_mapping_review: original=''העמדה לדין'' → mapped=''lawyer_discipline''',
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'פלוני נדרש להגיש עתירה נפרדת לבית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים ובמסגרתה להעלות טענות אלו.', false, 'תשובה זו שגויה. דרך המלך להעלות טענות נגד שיקול דעת התביעה בהגשת כתב אישום היא במסגרת ההליך הפלילי עצמו, ולא בעתירה נפרדת לבית המשפט לעניינים מינהליים.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'כלל לא ניתן להעלות טענות ביחס לשיקול דעתן של רשויות התביעה בהחלטה על הגשת כתב אישום במסגרת הליך פלילי.', false, 'תשובה זו שגויה. ניתן ואף נדרש להעלות טענות אלו במסגרת ההליך הפלילי, בעיקר באמצעות דוקטרינת ''הגנה מן הצדק''.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'נדרש להעלות טענות אלו במסגרת ההליך הפלילי עצמו.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי דרך המלך להעלות טענות נגד שיקול דעת התביעה בהגשת כתב אישום היא במסגרת ההליך הפלילי גופו, בעיקר באמצעות דוקטרינת ''הגנה מן הצדק'' המעוגנת בסעיף 149(10) לחוק סדר הדין הפלילי.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'טענות מסוג זה ניתן להעלות רק לפני ערכאת הערעור.', false, 'תשובה זו שגויה. טענות אלו הן טענות מקדמיות שיש להעלותן בפני הערכאה הדיונית, ולא רק בשלב הערעור.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'ביקורת בג"ץ על החלטת תביעה לסגור תיק', 1, 'ראובן, חשוד בעבירה, קיבל הודעה על סגירת תיק החקירה נגדו בעילה של חוסר ראיות. ראובן סבור כי התיק נסגר שלא כדין וכי יש להגיש נגדו כתב אישום כדי לטהר את שמו. היכן עליו להעלות את טענותיו?',
    'שאלה זו עוסקת בפורום המתאים לביקורת שיפוטית על החלטות תביעה לסגור תיק חקירה, ומבחינה בינה לבין ביקורת על החלטה להגיש כתב אישום. היא מדגישה את ההבחנה הפסיקתית בין שני סוגי ההחלטות ואת הערכאה המוסמכת לדון בכל אחת מהן.',
    'הפסיקה מבחינה בין ביקורת שיפוטית על החלטה לסגור תיק חקירה לבין ביקורת על החלטה להגיש כתב אישום. בעוד שביקורת על החלטה להעמיד לדין תתקיים, ברגיל, בערכאה הפלילית שלפניה מתברר ההליך הפלילי, הרי שביקורת על החלטה לסגור תיק תעשה בבג"ץ. הסיבה להבחנה זו נעוצה בכך שהחלטה לסגור תיק היא החלטה מינהלית סופית, בעוד שהחלטה להגיש כתב אישום היא רק תחילתו של הליך פלילי, שבמהלכו יתבררו טענות הנאשם. דנ"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)רע"פ 7052/18 מדינת ישראל נ'' רפי רותם (05.05.2020)ישגב נקדימון הגנה מן הצדק (2025) | פרק עשרים ושניים סמכות ענייניתבג"ץ 3405/12 פלונית נ'' מדינת ישראל (30.12.2012)',
    'טעות נפוצה היא לבלבל בין הפורום לביקורת על סגירת תיק לבין הפורום לביקורת על הגשת כתב אישום, או לחשוב שכל החלטות התביעה נתונות לביקורת באותה ערכאה.',
    '["ביקורת שיפוטית", "סגירת תיק", "הגשת כתב אישום", "בג\"ץ", "ערכאה פלילית", "החלטה מינהלית"]'::jsonb,
    '**וריאציה 1 — פורום לביקורת על סגירת תיק:** היכן תתבצע ביקורת על החלטה לסגור תיק חקירה? ← בבג"ץ (דנ"פ 5387/20 רותם, פסקה 24). **וריאציה 2 — פורום לביקורת על הגשת כתב אישום:** היכן תתבצע ביקורת על החלטה להגיש כתב אישום? ← בערכאה הפלילית שדנה בכתב האישום (דנ"פ 5387/20 רותם, פסקה 24). **וריאציה 3 — ההבחנה:** מדוע קיימת הבחנה בין שני סוגי ההחלטות? ← החלטה לסגור תיק היא סופית, בעוד שהגשת כתב אישום היא תחילתו של הליך (רע"פ 7052/18 רותם, פסקה 19).',
    'סגירת תיק ← ביקורת בבג"ץ; הגשת כתב אישום ← ביקורת בערכאה הפלילית.',
    '["דנ\"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)", "רע\"פ 7052/18 מדינת ישראל נ'' רפי רותם (05.05.2020)", "ישגב נקדימון, הגנה מן הצדק (2025), פרק עשרים ושניים סמכות עניינית", "בג\"ץ 3405/12 פלונית נ'' מדינת ישראל (30.12.2012)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'עילות הביקורת השיפוטית על החלטת תביעה', 2, 'מהן העילות המרכזיות שבגינן בית המשפט הפלילי רשאי להתערב בשיקול דעת רשויות התביעה בהחלטה להגיש כתב אישום, במסגרת דוקטרינת ההגנה מן הצדק?',
    'שאלה זו בוחנת את אמות המידה לביקורת שיפוטית על החלטות תביעה להגיש כתב אישום, תוך התייחסות לעילות המשפט המנהלי המיושמות דרך דוקטרינת ההגנה מן הצדק. היא מדגישה את היקף הביקורת המצומצם ואת הצורך בפגם מהותי כדי להצדיק התערבות.',
    'החלטת התביעה להעמיד אדם לדין פלילי היא החלטה מינהלית הכפופה לביקורת שיפוטית. עם זאת, היקף הביקורת מצומצם, ובית המשפט אינו ממיר את שיקול דעת התביעה בשיקול דעתו שלו. התערבות שיפוטית תהיה שמורה למקרים בהם ההחלטה נגועה בחוסר סבירות קיצוני או בעיוות מהותי, או כאשר הגשת כתב האישום עומדת בסתירה מהותית לעקרונות של צדק והגינות משפטית, כפי שמעוגן בסעיף 149(10) לחוק סדר הדין הפלילי. דנ"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)בג"ץ 3405/12 פלונית נ'' מדינת ישראל (30.12.2012)רע"פ 5034/15 פלוני נ'' מדינת ישראל (31.10.2018)ע"פ 4855/02 מדינת ישראל נ'' ד"ר איתמר בורוביץ, נט(6) 776 (31.03.2005)',
    'טעות נפוצה היא לחשוב שבית המשפט יכול להתערב בכל מקרה של אי-הסכמה עם התביעה, ולא רק במקרים של פגם מהותי וחמור הפוגע בצדק ובהגינות.',
    '["הגנה מן הצדק", "ביקורת שיפוטית", "שיקול דעת תביעה", "חוסר סבירות קיצוני", "עיוות מהותי", "צדק והגינות משפטית", "סעיף 149(10) לחוק סדר הדין הפלילי"]'::jsonb,
    '**וריאציה 1 — עילת ההתערבות המרכזית:** מהי העילה המרכזית להתערבות שיפוטית בהחלטת תביעה להגיש כתב אישום? ← סתירה מהותית לעקרונות של צדק והגינות משפטית (דנ"פ 5387/20 רותם). **וריאציה 2 — היקף הביקורת:** מהו היקף הביקורת השיפוטית? ← מצומצם, רק במקרים של חוסר סבירות קיצוני או עיוות מהותי (בג"ץ 3405/12 פלונית). **וריאציה 3 — תפקיד בית המשפט:** האם בית המשפט מחליף את שיקול דעת התביעה? ← לא, הוא בוחן את חוקיות ההחלטה ולא את טיבה (בג"ץ 3405/12 פלונית).',
    'ביקורת על הגשת כתב אישום ← הגנה מן הצדק ← חוסר סבירות קיצוני / עיוות מהותי / פגיעה בצדק והגינות.',
    '["דנ\"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)", "בג\"ץ 3405/12 פלונית נ'' מדינת ישראל (30.12.2012)", "רע\"פ 5034/15 פלוני נ'' מדינת ישראל (31.10.2018)", "ע\"פ 4855/02 מדינת ישראל נ'' ד\"ר איתמר בורוביץ, נט(6) 776 (31.03.2005)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'תקיפת כתב אישום בבג"ץ במקרים חריגים', 3, 'על אף שדרך המלך לתקוף החלטת תביעה להגיש כתב אישום היא במסגרת ההליך הפלילי, באילו נסיבות חריגות עשוי בית המשפט הגבוה לצדק לדון בעתירה התוקפת באופן ראשוני את עצם ההעמדה לדין?',
    'שאלה זו עוסקת בחריגים לכלל לפיו ביקורת על החלטת תביעה להגיש כתב אישום נעשית בערכאה הפלילית. היא בוחנת את הנסיבות המצומצמות והקיצוניות שבהן בית המשפט הגבוה לצדק עשוי בכל זאת להתערב באופן ראשוני בהחלטה כזו, תוך הדגשת עקרון הסעד החלופי.',
    'על דרך השגרה, טענות נגד פגמים בהגשת כתב אישום יועלו במסגרת ההליך הפלילי גופו. עם זאת, הפסיקה הותירה פתח צר מאוד לבג"ץ לדון בעתירות התוקפות באופן ראשוני את עצם ההעמדה לדין, וזאת רק בנסיבות מיוחדות שבהן העתירות מעוררות שאלות חדשות, חשובות וקשות, ובאין סעד חלופי אפקטיבי בערכאה הפלילית. מקרים אלו נחשבים לקיצוניים ונדירים ביותר. ישגב נקדימון הגנה מן הצדק (2025) | פרק עשרים ושניים סמכות ענייניתדנ"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)בג"ץ 9131/05 ניר עם כהן ירקות אגודה שיתופית חקלאית בע מ'' מדינת ישראל - משרד התעשייה המסחר והתעסוקה (06.02.2006)ישגב נקדימון הגנה מן הצדק (2025) | פרק עשרים ושניים סמכות עניינית',
    'טעות נפוצה היא לחשוב שבג"ץ הוא תמיד הכתובת לביקורת מנהלית, מבלי להכיר את העברת הסמכות לערכאה הפלילית ואת החריגים הצרים המצדיקים פנייה לבג"ץ.',
    '["בג\"ץ", "סעד חלופי", "העמדה לדין", "ביקורת שיפוטית", "מקרים חריגים", "שאלות עקרוניות"]'::jsonb,
    '**וריאציה 1 — דרך המלך:** מהי דרך המלך לתקוף הגשת כתב אישום? ← במסגרת ההליך הפלילי (בג"ץ 9131/05 ניר עם כהן). **וריאציה 2 — חריג בג"ץ:** מתי בג"ץ יתערב בהגשת כתב אישום? ← במקרים קיצוניים, שאלות חדשות וקשות, ובאין סעד חלופי אפקטיבי (דנ"פ 5387/20 רותם, פסקה 1 לשטיין). **וריאציה 3 — סעד חלופי:** מהו עקרון הסעד החלופי? ← אם קיים סעד אפקטיבי בערכאה אחרת, בג"ץ לא יתערב (בג"ץ 9131/05 ניר עם כהן).',
    'תקיפת כתב אישום ← דרך המלך בערכאה פלילית ← בג"ץ רק במקרים קיצוניים ובאין סעד חלופי.',
    '["ישגב נקדימון, הגנה מן הצדק (2025), פרק עשרים ושניים סמכות עניינית", "דנ\"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)", "בג\"ץ 9131/05 ניר עם כהן ירקות אגודה שיתופית חקלאית בע מ'' מדינת ישראל - משרד התעשייה המסחר והתעסוקה (06.02.2006)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'השלכות קבלת טענת הגנה מן הצדק', 4, 'בית המשפט הפלילי קיבל טענת הגנה מן הצדק שהעלה נאשם. מהן ההשלכות האפשריות של קבלת טענה זו?',
    'שאלה זו עוסקת במגוון הסעדים העומדים לרשות בית המשפט הפלילי כאשר הוא מקבל טענת הגנה מן הצדק. היא מדגישה את שיקול הדעת הרחב של בית המשפט בבחירת הסעד ההולם, החל מסעדים מתונים ועד לסעד הקיצוני של ביטול כתב האישום, תוך איזון בין האינטרסים השונים.',
    'כאשר בית המשפט מקבל טענת הגנה מן הצדק, עומד לרשותו מגוון רחב של סעדים, החל מסעדים מתונים ומידתיים ועד לסעד הקיצוני של ביטול כתב האישום. הסעדים יכולים לכלול, בין היתר, הקלה בעונש, אי-הרשעה, ביטול אישום מסוים, או ביטול כתב האישום כולו. בית המשפט יבחר את הסעד ההולם תוך איזון בין חומרת הפגם שנפל בהליך, חומרת העבירה, נסיבות המקרה, ושיקולים של גמול, הרתעה ואינטרס ציבורי בקיום המשפט. עפ"ג (מחוזי חי'') 55106-06-22 עומרי חזן נ'' מדינת ישראל (26.01.2023)ע"פ 4855/02 מדינת ישראל נ'' ד"ר איתמר בורוביץ, נט(6) 776 (31.03.2005)רע"פ 7052/18 מדינת ישראל נ'' רפי רותם (05.05.2020)דנ"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)',
    'טעות נפוצה היא לחשוב שקבלת טענת הגנה מן הצדק מובילה בהכרח לביטול כתב האישום, מבלי להכיר את מגוון הסעדים העומדים לרשות בית המשפט ואת שיקול הדעת הרחב בבחירתם.',
    '["הגנה מן הצדק", "סעדים", "ביטול כתב אישום", "הקלה בעונש", "אי-הרשעה", "שיקול דעת שיפוטי", "איזון אינטרסים"]'::jsonb,
    '**וריאציה 1 — מגוון סעדים:** מהם הסעדים האפשריים בקבלת הגנה מן הצדק? ← הקלה בעונש, אי-הרשעה, ביטול אישום חלקי או מלא (עפ"ג 55106-06-22 חזן). **וריאציה 2 — סעד קיצוני:** מהו הסעד הקיצוני ביותר? ← ביטול כתב האישום במלואו (ע"פ 4855/02 בורוביץ). **וריאציה 3 — שיקולי בית המשפט:** מהם השיקולים בבחירת הסעד? ← חומרת הפגם, חומרת העבירה, נסיבות המקרה, אינטרס ציבורי (ע"פ 4855/02 בורוביץ).',
    'קבלת הגנה מן הצדק ← מגוון סעדים (הקלה בעונש עד ביטול אישום) ← שיקול דעת בית המשפט.',
    '["עפ\"ג (מחוזי חי'') 55106-06-22 עומרי חזן נ'' מדינת ישראל (26.01.2023)", "ע\"פ 4855/02 מדינת ישראל נ'' ד\"ר איתמר בורוביץ, נט(6) 776 (31.03.2005)", "רע\"פ 7052/18 מדינת ישראל נ'' רפי רותם (05.05.2020)", "דנ\"פ 5387/20 רפי רותם נ'' מדינת ישראל (15.12.2021)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'בבית המשפט הפלילי שדן בעבירה.', false, 'תשובה זו שגויה, שכן בית המשפט הפלילי דן בכתב אישום שהוגש, ובמקרה זה התיק נסגר ולא הוגש כתב אישום.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'בבית המשפט הגבוה לצדק.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי ביקורת שיפוטית על החלטה לסגור תיק תעשה בבג"ץ, בניגוד לביקורת על החלטה להעמיד לדין שתתקיים, ברגיל, בערכאה הפלילית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'בבית המשפט המחוזי בשבתו כבית משפט לעניינים מינהליים.', false, 'תשובה זו שגויה. אף שההחלטה היא מינהלית, הפורום הספציפי לביקורת על סגירת תיק הוא בג"ץ, ולא בית המשפט לעניינים מינהליים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא ניתן לתקוף החלטה לסגור תיק חקירה.', false, 'תשובה זו שגויה. החלטות רשויות התביעה, לרבות סגירת תיק, כפופות לביקורת שיפוטית.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'חוסר סבירות קיצוני או עיוות מהותי.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי ביקורת שיפוטית על החלטות תביעה להגיש כתב אישום תתבצע במקרים של חוסר סבירות קיצוני או עיוות מהותי, במסגרת דוקטרינת ההגנה מן הצדק.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'טעות בשיקול הדעת של התביעה בלבד.', false, 'תשובה זו שגויה. בית המשפט אינו ממיר את שיקול דעת התביעה בשיקול דעתו שלו, וטעות רגילה אינה מספיקה להתערבות שיפוטית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'אי-הסכמה של בית המשפט עם מדיניות התביעה.', false, 'תשובה זו שגויה. בית המשפט אינו פועל כ''תובע על'' ואינו מתערב רק בשל אי-הסכמה עם מדיניות התביעה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'כל פגם שנפל בהליך החקירה.', false, 'תשובה זו שגויה. לא כל פגם בהליך החקירה יצדיק התערבות, אלא רק פגמים מהותיים העולים כדי סתירה מהותית לעקרונות של צדק והגינות משפטית.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'בכל מקרה שבו העותר מעדיף את בג"ץ על פני הערכאה הפלילית.', false, 'תשובה זו שגויה. העדפת העותר אינה שיקול מספיק כדי להצדיק סטייה מדרך המלך של הדיון בערכאה הפלילית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'במקרים קיצוניים בלבד, שבהם העתירה מעוררת שאלות חדשות, חשובות וקשות, ובאין סעד חלופי אפקטיבי.', true, 'זו התשובה הנכונה. הפסיקה הותירה פתח צר מאוד לבג"ץ לדון בעתירות התוקפות הגשת כתב אישום, וזאת רק במקרים חריגים וקיצוניים המעוררים שאלות עקרוניות, ובהיעדר סעד חלופי אפקטיבי בערכאה הפלילית.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'רק אם כתב האישום הוגש בחוסר סמכות מובהק.', false, 'תשובה זו שגויה. טענות חוסר סמכות הן טענות מקדמיות שניתן להעלותן בערכאה הפלילית עצמה, ואינן מצדיקות בהכרח פנייה לבג"ץ.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'אם העותר טוען לאכיפה בררנית פסולה.', false, 'תשובה זו שגויה. טענות לאכיפה בררנית נבחנות במסגרת דוקטרינת ההגנה מן הצדק בהליך הפלילי גופו.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'בית המשפט חייב לבטל את כתב האישום במלואו.', false, 'תשובה זו שגויה. ביטול כתב האישום הוא רק אחד מהסעדים האפשריים, והוא נחשב לסעד הקיצוני ביותר.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'בית המשפט רשאי לבחור מבין מגוון סעדים, החל מהקלה בעונש ועד לביטול כתב האישום.', true, 'זו התשובה הנכונה. הפסיקה הכירה במגוון רחב של סעדים אפשריים בעקבות קבלת טענת הגנה מן הצדק, תוך התאמה לחומרת הפגם והאיזון בין האינטרסים השונים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'בית המשפט חייב להורות על החזרת התיק לתביעה לצורך בחינה מחודשת.', false, 'תשובה זו שגויה. החזרת התיק לתביעה היא סעד אפשרי, אך אינה הסעד היחיד או המחייב.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'בית המשפט רשאי להטיל קנס על רשויות התביעה.', false, 'תשובה זו שגויה. הטלת קנס על רשויות התביעה אינה סעד מקובל במסגרת קבלת טענת הגנה מן הצדק.', 4);

END $$;

-- ============================================================
-- Q16 — 2024-W-Q16 — chapter=constitutional_intl subtopic=foreign_judgment_enforcement
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q16';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q16 skipped: external_id % already exists', '2024-W-Q16';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'foreign_judgment_enforcement';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'foreign_judgment_enforcement';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q16', 'ed89ea85-f137-4877-90ab-7c7d56ff3cc2', v_subtopic_id,
    'נגד דניאל ניתן לפני 6 חודשים פסק דין בבית משפט בבלגיה, שהפך לחלוט. במסגרת פסק הדין הוטל בין היתר, צו עיקול על נכסיו של דניאל בישראל ובבלגיה. דניאל התייצב לדיון בעניינו בבלגיה וטען כי יש לשחרר את הנכסים אשר צפויים להיתפס בבלגיה. בדיון בבקשה לאכוף את הפסק בישראל, טען דניאל כי לבית המשפט בבלגיה כלל לא הייתה סמכות לדון בעניינו. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 16}'::jsonb,
    'שאלה זו עוסקת באכיפת פסקי חוץ בישראל, ובפרט באחת מעילות ההגנה המרכזיות מפני אכיפה – חוסר סמכות של בית המשפט הזר. היא מתייחסת לסעיף 6 לחוק אכיפת פסקי-חוץ, תשי"ח-1958, המפרט את המקרים בהם פסק חוץ לא יוכרז אכיף, ומדגישה את ההבחנה בין התייצבות לדיון לבין הסכמה לסמכות.',
    'חוק אכיפת פסקי-חוץ, תשי"ח-1958, קובע את התנאים לאכיפת פסקי דין זרים בישראל. סעיף 6(א) לחוק מפרט את עילות ההגנה מפני אכיפה, כלומר מקרים בהם פסק חוץ לא יוכרז אכיף גם אם התקיימו התנאים המוקדמים לאכיפה. אחת מעילות ההגנה המרכזיות היא אם הוכח לבית המשפט כי הפסק ניתן על ידי בית משפט שלא היה מוסמך לתתו על פי כללי המשפט הבינלאומי הפרטי החלים בישראל (סעיף 6(א)(3)). חשוב לציין כי סעיף 6(ב) לחוק מבהיר כי התייצבות בפני בית משפט זר כדי לטעון נגד סמכותו, או כדי להגן על נכסים שנתפסו או צפויים להיתפס, אינה נחשבת כהסכמה לסמכותו של בית המשפט הזר. לכן, במקרה הנדון, טענתו של דניאל כי לבית המשפט בבלגיה לא הייתה סמכות לדון בעניינו, גם אם התייצב לדיון כדי לטעון לשחרור נכסים, היא טענת הגנה לגיטימית שיכולה למנוע את אכיפת פסק הדין בישראל. סעיף 6(א)(3) לחוק אכיפת פסקי-חוץ, תשי"ח-1958סעיף 6(ב) לחוק אכיפת פסקי-חוץ, תשי"ח-1958ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)',
    'טעות נפוצה היא להניח שהתייצבות של בעל דין בפני בית משפט זר, גם אם לצורך התנגדות לסמכות או הגנה על נכסים, מהווה הסכמה לסמכותו ומונעת ממנו לטעון לחוסר סמכות בהליך האכיפה בישראל.',
    '["אכיפת פסק חוץ", "חוק אכיפת פסקי-חוץ", "סמכות בינלאומית", "משפט בינלאומי פרטי", "הגנה מפני אכיפה", "התייצבות על תנאי"]'::jsonb,
    '**וריאציה 1 — עילת הגנה:** מהי עילת הגנה מפני אכיפת פסק חוץ הקשורה לסמכות? ← חוסר סמכות של בית המשפט הזר לפי כללי המשפט הבינלאומי הפרטי הישראלי (סעיף 6(א)(3) לחוק אכיפת פסקי-חוץ). **וריאציה 2 — התייצבות לדיון:** האם התייצבות בפני בית משפט זר כדי לטעון נגד סמכותו או להגן על נכסים נחשבת הסכמה לסמכות? ← לא, סעיף 6(ב) לחוק אכיפת פסקי-חוץ מבהיר זאת במפורש. **וריאציה 3 — חשיבות הטענה:** האם טענה לחוסר סמכות של בית המשפט הזר יכולה למנוע אכיפה? ← כן, אם היא מוכחת, בית המשפט בישראל אינו רשאי להכריז על הפסק כאכיף.',
    'אכיפת פסק חוץ ← לא אם לבית המשפט הזר לא הייתה סמכות ← התייצבות להגנה על נכסים אינה הסכמה לסמכות.',
    '["חוק אכיפת פסקי-חוץ, תשי\"ח-1958, סעיף 6", "ע\"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'בית המשפט בישראל חייב לקבוע כי פסק הדין אשר ניתן נגד דניאל בבלגיה אכיף, אם מצא שהתקיימו התנאים המוקדמים הקבועים בחוק.', false, 'תשובה זו שגויה. אף שהתקיימות התנאים המוקדמים היא הכרחית, בית המשפט אינו חייב לאכוף את הפסק אם מתקיימת אחת מההגנות המפורטות בסעיף 6 לחוק אכיפת פסקי-חוץ.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'בית המשפט בישראל חייב לקבוע כי פסק הדין אשר ניתן נגד דניאל בבלגיה אכיף רק מעצם העובדה שדניאל התייצב לדיון בעניינו בבלגיה, ומכאן ראיה שקיבל את סמכות בית המשפט בבלגיה ועליו לציית לפסק דינו.', false, 'תשובה זו שגויה. סעיף 6(ב) לחוק אכיפת פסקי-חוץ קובע במפורש כי התייצבות בפני בית משפט זר כדי לטעון נגד סמכותו או להגן על נכסים אינה נחשבת הסכמה לסמכותו.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'בית המשפט בישראל אינו רשאי לקבוע כי פסק הדין אשר ניתן נגד דניאל בבלגיה אכיף, אם לבית המשפט בבלגיה לא הייתה סמכות על פי כללי המשפט הבינלאומי הפרטי החלים בישראל.', true, 'זו התשובה הנכונה. סעיף 6(א)(3) לחוק אכיפת פסקי-חוץ קובע כי פסק חוץ לא יוכרז אכיף אם הוכח לבית המשפט כי הפסק ניתן על ידי בית משפט שלא היה מוסמך לתתו על פי כללי המשפט הבינלאומי הפרטי החלים בישראל.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'בית המשפט בישראל אינו רשאי לקבוע כי פסק הדין אשר ניתן נגד דניאל בבלגיה אכיף, שכן פסק הדין מתייחס גם לנכסיו של דניאל בישראל.', false, 'תשובה זו שגויה. העובדה שפסק הדין מתייחס לנכסים בישראל אינה עילה בפני עצמה לאי-אכיפה, אלא יש לבחון את סמכות בית המשפט הזר לפי כללי המשפט הבינלאומי הפרטי הישראלי.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'שימוש לרעה בהליכי משפט בערעור', 1, 'פרופ'' סמדג''ה הגיש ערעור לבית המשפט העליון. במהלך ההליכים, הוא הפר באופן חוזר ושיטתי צווים והחלטות של בית המשפט, הפגין זלזול נמשך בהליכים, בזכויות בעל הדין שכנגד ובחובות המוטלות עליו, ואף מסר כתובות שקריות. המשיב ביקש למחוק את הערעור על הסף. האם בית המשפט העליון רשאי למחוק את הערעור על הסף בנסיבות אלו?',
    'שאלה זו בוחנת את גבולות זכות הגישה לערכאות, ובפרט את זכות הערעור, אל מול החובה לנהוג בתום לב ובהגינות בהליכי משפט. היא מתמקדת במקרים חריגים וקיצוניים של שימוש לרעה בהליכי משפט, המצדיקים סנקציה חריפה של מחיקת הליך על הסף.',
    'זכות הגישה לערכאות, ובכללה זכות הערעור, היא זכות בסיסית בשיטת המשפט הישראלית. עם זאת, זכות זו אינה מוחלטת והיא מותנית בקיום חובות בסיסיות המוטלות על בעל הדין כלפי בית המשפט וכלפי בעלי הדין האחרים. בעל דין אינו רשאי לנצל את ההליך השיפוטי לרעה. אמנם, ככלל, בית המשפט יעדיף לנקוט בצעדים חמורים פחות, כגון זקיפת חוסר תום הלב לחובת בעל הדין או השתת הוצאות משמעותיות. אולם, אם שוכנע בית המשפט כי התקיימו נסיבות חריגות ויוצאות דופן, כגון ניצול לרעה בוטה של ההליך השיפוטי, זלזול חמור בהליכי המשפט או ניסיון זדוני להכשלתם, הוא עשוי למחוק את ההליך על הסף. במקרה של פרופ'' סמדג''ה, בית המשפט העליון (הנשיאה חיות) מחק את הערעור על הסף בשל התנהלותו חסרת תום הלב, הפרה חוזרת ושיטתית של צווים, וזלזול בהליכי בית המשפט. ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)',
    'טעות נפוצה היא להאמין כי זכות הגישה לערכאות היא מוחלטת ואינה כפופה לחובת תום הלב הדיוני, גם במקרים של התנהלות קיצונית ושיטתית של שימוש לרעה בהליכי משפט.',
    '["זכות הגישה לערכאות", "שימוש לרעה בהליכי משפט", "חוסר תום לב דיוני", "מחיקת ערעור על הסף", "סנקציות דיוניות", "זכות הערעור"]'::jsonb,
    '**וריאציה 1 — זכות הגישה לערכאות:** האם זכות הגישה לערכאות מוחלטת? ← לא, היא מותנית בחובות בסיסיות של בעל הדין (ע"א 6636/17 סמדג''ה). **וריאציה 2 — מחיקת ערעור על הסף:** מתי ניתן למחוק ערעור על הסף בשל שימוש לרעה? ← במקרים חריגים ויוצאי דופן של ניצול לרעה בוטה, זלזול חמור או ניסיון זדוני להכשלת ההליך (ע"א 6636/17 סמדג''ה). **וריאציה 3 — התנהלות המערער:** האם הפרה שיטתית של צווים וזלזול בהליכים מצדיקים מחיקה? ← כן, זו התנהלות חסרת תום לב העולה כדי ניצול לרעה (ע"א 6636/17 סמדג''ה).',
    'זכות הגישה לערכאות ← אינה מוחלטת ← שימוש לרעה קיצוני ← מחיקת ערעור על הסף.',
    '["ע\"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)", "רע\"א 3454/04 ורקר נ'' הראל (05.06.2005)", "בש\"א 6479/06 בנק דיסקונט לישראל בע\"מ נ'' שנפ (15.01.2007)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'מבחני שימוש לרעה בהליכי משפט', 2, 'מהם המבחנים העיקריים לקביעה האם התנהגות של בעל דין עולה כדי ''שימוש לרעה בהליכי משפט''?',
    'שאלה זו מתמקדת באמות המידה לקביעת ''שימוש לרעה בהליכי משפט''. היא מדגישה את אופיו הגמיש של המושג, את המבחן האובייקטיבי של סבירות והגינות כעיקר, ואת חשיבות התחשבות בנסיבות המקרה ובכוונות הסובייקטיביות של בעל הדין.',
    'המושג ''שימוש לרעה בהליכי משפט'' הוא בעל ''רקמה פתוחה'' בשל הקושי המובנה לצפות מראש את כלל המצבים והפעולות שיענו לתיאור זה. בדומה לעקרון תום הלב, אף האיסור על ניצול לרעה של הליכי משפט מבוסס בעיקרו על אמת מידה אובייקטיבית, הנבחנת בהתאם לנסיבותיו של כל מקרה לגופו. המבחן העיקרי הוא סבירות והגינות, קרי כיצד היה נוהג בעל דין סביר והגון בנסיבות העניין. כוונותיו הסובייקטיביות של בעל הדין והשאלה האם פעל בזדון עשויות להשליך על המסקנה, אך עיקרו של המבחן הוא אובייקטיבי. התפיסה שבבסיס אמת המידה היא שהשמירה על האינטרס האישי של בעל הדין צריכה להיעשות תוך התחשבות בציפיות הדיוניות המוצדקות של הצדדים האחרים ושל בית המשפט, כדי לאפשר הליך שיפוטי תקין והוגן. ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)ע"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)',
    'טעות נפוצה היא לחפש הגדרה קשיחה וסגורה ל''שימוש לרעה בהליכי משפט'', במקום להבין שמדובר במושג גמיש הנבחן לפי נסיבות המקרה ואמות מידה אובייקטיביות של סבירות והגינות.',
    '["שימוש לרעה בהליכי משפט", "רקמה פתוחה", "מבחן אובייקטיבי", "סבירות והגינות", "תום לב דיוני", "כוונות סובייקטיביות"]'::jsonb,
    '**וריאציה 1 — אופי המושג:** האם ''שימוש לרעה בהליכי משפט'' הוא מושג סגור? ← לא, הוא בעל ''רקמה פתוחה'' (ע"א 6636/17 סמדג''ה). **וריאציה 2 — המבחן העיקרי:** מהו המבחן העיקרי לקביעת שימוש לרעה? ← מבחן אובייקטיבי של סבירות והגינות (ע"א 6636/17 סמדג''ה). **וריאציה 3 — חשיבות הכוונה:** האם כוונותיו הסובייקטיביות של בעל הדין רלוונטיות? ← כן, הן עשויות להשליך על המסקנה, אך המבחן העיקרי הוא אובייקטיבי (ע"א 6636/17 סמדג''ה).',
    'שימוש לרעה בהליכי משפט ← רקמה פתוחה ← מבחן אובייקטיבי של סבירות והגינות.',
    '["ע\"א 6636/17 פרופ'' מנחם סמדג''ה נ'' BANKRUPTCY OFFICE GENEVA (27.08.2019)", "בש\"א 6479/06 בנק דיסקונט לישראל בע\"מ נ'' שנפ (15.01.2007)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'קנס בגין בזיון בית משפט לטובת בעל דין', 3, 'בית הדין השרעי הטיל קנס כספי על אם בגין הפרת החלטותיו בעניין זמני שהות עם הקטין, וקבע כי סכום הקנס יופקד בתכנית חיסכון מיוחדת לקטין. האם בית הדין פעל בסמכותו בקביעה זו?',
    'שאלה זו עוסקת במהותם של קנסות המוטלים מכוח פקודת בזיון בית משפט, ובפרט בשאלת היעד אליו משולמים קנסות אלו. היא מדגישה את אופיו הציבורי של הקנס כסנקציה לכפיית ציות, בניגוד לפיצוי פרטי, וקובעת כי קנס כזה ישולם לאוצר המדינה.',
    'סמכותו של בית הדין השרעי להטיל סנקציה בדמות קנס מכוח פקודת בזיון בית משפט מעוגנת בסעיף 7א(א) לחוק בתי דין דתיים (כפיית ציות ודרכי דיון), התשט"ז-1956. הפסיקה קבעה באופן עקבי כי קנס לפי סעיף 6(1) לפקודת בזיון בית משפט יש לשלם לאוצר המדינה. חיוב בקנס לפי הפקודה אינו נעשה לטובת בעל דין אלא לטובת המדינה, וכל הליך של גביית קנס צריך להיעשות על ידי המדינה. לכן, החלטת בית הדין להפקיד את כספי הקנס בתכנית חיסכון לקטין היא טעות, והקנס צריך להיות משולם לקופת המדינה. בש"פ 3592/19 פלוני נ'' פלונית (18.06.2019)בש"פ 3592/19 פלוני נ'' פלונית (18.06.2019)פקודת בזיון בית המשפט, סעיף 6(1)',
    'טעות נפוצה היא לראות בקנס המוטל בגין ביזיון בית משפט סעד פיצויי לטובת הצד הנפגע, במקום סנקציה ציבורית שנועדה לכפות ציות לצווי בית המשפט ולשמור על כבודו.',
    '["פקודת בזיון בית משפט", "קנס", "אוצר המדינה", "כפיית ציות", "סנקציה", "בית דין דתי"]'::jsonb,
    '**וריאציה 1 — יעד הקנס:** למי משולם קנס המוטל בגין ביזיון בית משפט? ← לאוצר המדינה (בש"פ 3592/19 פלוני נ'' פלונית). **וריאציה 2 — מטרת הקנס:** מהי מטרת הקנס בגין ביזיון בית משפט? ← כפיית ציות עתידית לצווי בית המשפט, ולא ענישה על הפרות עבר (בש"פ 3592/19 פלוני נ'' פלונית). **וריאציה 3 — טעות בית הדין:** האם בית הדין רשאי להורות על הפקדת הקנס לטובת הקטין? ← לא, זו טעות וההחלטה בטלה, הקנס ישולם לקופת המדינה (בש"פ 3592/19 פלוני נ'' פלונית).',
    'קנס בגין בזיון בית משפט ← משולם לאוצר המדינה ← לא לבעל דין.',
    '["בש\"פ 3592/19 פלוני נ'' פלונית (18.06.2019)", "פקודת בזיון בית המשפט, סעיף 6(1)", "רע\"א 4953/92 בבילה נ'' דדון, פ\"ד מז(1) 658 (1993)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'סעד זמני בערעור למימון ייצוג משפטי', 4, 'חשבונותיו של מר זיו בבנק הוקפאו. הוא הגיש ערעור על החלטה שדחתה את תביעתו לאפשר את סגירת חשבונותיו במשיכת כספים. במסגרת הערעור, ביקש מר זיו סעד זמני להורות לבנק לשחרר כספים מחשבונותיו לצורך מימון ייצוגו המשפטי בערעור זה. האם בית המשפט העליון ייעתר לבקשה זו?',
    'שאלה זו עוסקת במתן סעד זמני בערעור, ובפרט בשחרור כספים למימון ייצוג משפטי, כאשר חשבונות המבקש מוקפאים. היא בוחנת את האיזון בין שיקולי מאזן הנוחות לבין סיכויי הערעור, ואת חשיבות זכות הגישה לערכאות והיכולת לממן ייצוג משפטי הולם.',
    'בבקשה למתן סעד זמני בערעור, על המבקש להראות כי סיכויי הערעור להתקבל טובים וכי מאזן הנוחות נוטה לטובתו, כאשר ככלל יינתן מעמד בכורה לשיקולי מאזן הנוחות. במקרה של מר זיו, בית המשפט העליון קבע כי לא נדרש להידרש לשאלת סיכויי הערעור, וזאת מאחר ששיקולי מאזן הנוחות נטו באופן ברור לטובת היעתרות לבקשה לשחרור כספים עבור ייצוגו המשפטי בערעור. אף שפגיעה באפשרות לממן ייצוג משפטי אינה עולה בהכרח כדי פגיעה בליבת זכות הגישה לערכאות (שכן דלתות בית המשפט פתוחות וקיימת אפשרות לסיוע משפטי), ברור כי שחרור הכספים יאפשר למבקש לבחור את עורכי דינו ויעמיק את תחושתו כי היה לו יומו בבית המשפט. פגיעה זו, הגם שפריפריאלית, היא משמעותית. ע"א 7123/19 ישראל זיו נ'' בנק לאומי לישראל בע"מ (26.12.2019)ע"א 7123/19 ישראל זיו נ'' בנק לאומי לישראל בע"מ (26.12.2019)ע"א 7123/19 ישראל זיו נ'' בנק לאומי לישראל בע"מ (26.12.2019)ע"א 7123/19 ישראל זיו נ'' בנק לאומי לישראל בע"מ (26.12.2019)',
    'טעות נפוצה היא להתמקד בסיכויי הערעור כשיקול בלעדי, מבלי להבין את המשקל המכריע של מאזן הנוחות, ובמיוחד את חשיבות היכולת לממן ייצוג משפטי, גם אם אינה ''ליבת'' זכות הגישה לערכאות.',
    '["סעד זמני בערעור", "מאזן נוחות", "סיכויי ערעור", "זכות הגישה לערכאות", "ייצוג משפטי", "צו עשה", "חוק הסיוע המשפטי"]'::jsonb,
    '**וריאציה 1 — שיקולי סעד זמני:** מהם השיקולים למתן סעד זמני בערעור? ← סיכויי ערעור ומאזן נוחות, עם בכורה למאזן הנוחות (ע"א 7123/19 זיו). **וריאציה 2 — מימון ייצוג:** האם מימון ייצוג משפטי הוא שיקול במאזן הנוחות? ← כן, מאפשר בחירת עו"ד ומעמיק תחושת יומו בבית המשפט (ע"א 7123/19 זיו). **וריאציה 3 — חשיבות סיכויי הערעור:** האם תמיד חייבים לבחון את סיכויי הערעור? ← לא, אם מאזן הנוחות נוטה באופן ברור, ניתן להיעתר גם ללא בחינת סיכויים (ע"א 7123/19 זיו).',
    'סעד זמני למימון ייצוג ← מאזן נוחות מכריע ← מאפשר בחירת עו"ד ← גם ללא בחינת סיכויים.',
    '["ע\"א 7123/19 ישראל זיו נ'' בנק לאומי לישראל בע\"מ (26.12.2019)", "חוק הסיוע המשפטי, תשל\"ב-1972, סעיף 2"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'לא, זכות הגישה לערכאות היא זכות חוקתית ואין למחוק ערעור על הסף בשל התנהלות דיונית.', false, 'תשובה זו שגויה. אף שזכות הגישה לערכאות היא חוקתית, היא אינה מוחלטת ואינה מקנה חסינות מפני סנקציות במקרים של שימוש לרעה בהליכי משפט.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'כן, במקרים חריגים ויוצאי דופן של ניצול לרעה בוטה של ההליך השיפוטי, זלזול חמור או ניסיון זדוני להכשלתו.', true, 'זו התשובה הנכונה. בית המשפט העליון קבע כי במקרים נדירים של שימוש לרעה קיצוני בהליכי משפט, הכולל הפרה שיטתית של צווים וזלזול בהליכים, ניתן למחוק ערעור על הסף.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אך רק אם התנהלותו של המערער הגיעה לכדי ביזיון בית משפט שהוטל עליו קנס.', false, 'תשובה זו שגויה. אף שביזיון בית משפט הוא עילה חמורה, מחיקת ערעור על הסף בשל שימוש לרעה בהליכי משפט היא סנקציה נפרדת, שאינה תלויה בהטלת קנס בגין ביזיון.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, בית המשפט רשאי לנקוט רק בצעדים חמורים פחות, כגון השתת הוצאות משמעותיות.', false, 'תשובה זו שגויה. אף שצעדים חמורים פחות עדיפים ככלל, במקרים קיצוניים של שימוש לרעה בוטה, בית המשפט רשאי לנקוט בסנקציה של מחיקת ההליך על הסף.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'המבחן העיקרי הוא סובייקטיבי, הבוחן האם בעל הדין פעל בזדון או מתוך כוונה להכשלת ההליך.', false, 'תשובה זו שגויה. אף שכוונה סובייקטיבית עשויה להשליך על המסקנה, המבחן העיקרי הוא אובייקטיבי, הבוחן סבירות והגינות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'המבחן העיקרי הוא אובייקטיבי, הבוחן סבירות והגינות, קרי כיצד היה נוהג בעל דין סביר והגון בנסיבות העניין.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי המבחן העיקרי לשימוש לרעה בהליכי משפט הוא אובייקטיבי, המתמקד בסבירות ובהגינות ההתנהגות, תוך התחשבות בנסיבות המקרה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'המושג ''שימוש לרעה בהליכי משפט'' הוא בעל הגדרה סגורה וקבועה מראש, המפורטת בחוק.', false, 'תשובה זו שגויה. הפסיקה קבעה כי המושג הוא בעל ''רקמה פתוחה'' בשל הקושי לצפות מראש את כלל המצבים.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'די בכך שהתנהגות בעל הדין גרמה להתארכות ההליך או לבזבוז משאבים שיפוטיים.', false, 'תשובה זו שגויה. אף שתוצאות אלו הן אינדיקציה, הן אינן מספיקות כשלעצמן, ויש לבחון את אופי ההתנהגות עצמה ביחס לאמות מידה של סבירות והגינות.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, בית הדין רשאי לקבוע כי הקנס ישולם לטובת הקטין, שכן הוא הנפגע העיקרי מהפרת ההחלטות.', false, 'תשובה זו שגויה. קנס המוטל מכוח פקודת בזיון בית משפט אינו מיועד לפיצוי הנפגע, אלא הוא סנקציה ציבורית המשולמת לאוצר המדינה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, בית הדין נפל לכלל טעות, שכן קנס לפי פקודת בזיון בית משפט יש לשלם לאוצר המדינה.', true, 'זו התשובה הנכונה. הפסיקה קבעה באופן מפורש כי חיוב בקנס לפי סעיף 6(1) לפקודת בזיון בית משפט אינו נעשה לטובת בעל דין אלא לטובת המדינה, וכי הכספים ישולמו לקופת המדינה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, אך רק אם הקטין הוא צד להליך ונתן את הסכמתו לכך.', false, 'תשובה זו שגויה. הסכמת הקטין אינה רלוונטית, שכן מהות הקנס היא ציבורית ולא פרטית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, בית הדין רשאי להטיל קנס רק אם האם הפרה את ההחלטות בזדון מובהק.', false, 'תשובה זו שגויה. הטלת קנס מכוח פקודת בזיון בית משפט אינה דורשת הוכחת זדון מובהק, אלא הפרה של צו שיפוטי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'לא, שכן מדובר בסעד זמני המשנה את המצב הקיים, ובית המשפט יימנע מכך ככלל.', false, 'תשובה זו שגויה. אף שזהו כלל, במקרים מסוימים, ובמיוחד כאשר מאזן הנוחות נוטה באופן ברור לטובת המבקש, בית המשפט עשוי לסטות ממנו.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'כן, אם שיקולי מאזן הנוחות נוטים באופן ברור לטובת המבקש, גם ללא בחינת סיכויי הערעור.', true, 'זו התשובה הנכונה. בית המשפט העליון קבע כי במקרים בהם מאזן הנוחות נוטה באופן ברור לטובת המבקש, ניתן להיעתר לבקשה לסעד זמני למימון ייצוג משפטי, גם מבלי להידרש לשאלת סיכויי הערעור.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'לא, שכן פגיעה באפשרות לממן ייצוג משפטי אינה עולה כדי פגיעה בליבת זכות הגישה לערכאות.', false, 'תשובה זו שגויה. אף שפגיעה זו אינה נחשבת תמיד ל''ליבת'' זכות הגישה, היא עדיין פגיעה בהיבטים הפריפריאליים שלה, ומהווה שיקול משמעותי במאזן הנוחות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'כן, אך רק אם המבקש הוכיח סיכויים גבוהים מאוד לקבלת הערעור.', false, 'תשובה זו שגויה. במקרים בהם מאזן הנוחות נוטה באופן ברור לטובת המבקש, בית המשפט עשוי להיעתר לבקשה גם מבלי להידרש לשאלת סיכויי הערעור.', 4);

END $$;

-- ============================================================
-- Q17 — 2024-W-Q17 — chapter=civil_proc subtopic=proceedings
-- notes: needs_review=true | note: הסיווג תחת 'סדר דין אזרחי' ו'הליכים' הוא הקרוב ביותר מתוך הרשימה הסגורה, אך הנושא המרכזי הוא משפט מינהלי וחופש המידע. יש לשקול הוספת קטגוריה מתאימה יותר בעתיד.
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q17';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q17 skipped: external_id % already exists', '2024-W-Q17';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'proceedings';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q17', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'רוונית הגישה עתירה לבית המשפט לעניינים מינהליים כנגד רשות מקומית מכוח הוראות חוק חופש המידע, התשנ"ח-1998. הרשות המקומית טענה כי מדובר בעניין חסוי, ומשכך הוצאה לגבי המידע נושא העתירה תעודת חיסיון לפי סעיף 44 לפקודת הראיות [נוסח חדש], התשל"א-1971. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 17}'::jsonb,
    'שאלה זו עוסקת בסמכות העניינית לדון בעתירה לפי חוק חופש המידע, התשנ"ח-1998, כאשר הרשות הציבורית מציגה תעודת חיסיון לפי סעיף 44 לפקודת הראיות. היא בוחנת את החריג הקבוע בסעיף 17(א) לחוק חופש המידע, המעביר את הסמכות לדון בעתירה מבית המשפט לעניינים מינהליים לבית המשפט העליון במקרים אלו.',
    'סעיף 17(א) לחוק חופש המידע, תשנ"ח-1998, קובע את הערכאה המוסמכת לדון בעתירה על החלטת רשות ציבורית לפי חוק זה. ככלל, עתירה כזו תידון בבית המשפט לעניינים מינהליים. אולם, הסעיף קובע חריג מפורש: אם הוצאה לגבי המידע נושא העתירה תעודת חיסיון לפי סעיף 44 לפקודת הראיות [נוסח חדש], התשל"א-1971 (חיסיון לטובת המדינה), העתירה תידון לפני בית המשפט העליון. חריג זה משקף את חשיבותם ורגישותם של ענייני ביטחון המדינה ויחסי החוץ שלה, ומפקיד את ההכרעה בעניינים אלו בידי הערכאה השיפוטית הגבוהה ביותר. סעיף 17(א) לחוק חופש המידע, תשנ"ח-1998יצחק עמית חסיונות ואינטרסים מוגנים - הליכי גילוי ועיון במשפט האזרחי והפלילי (2021) | פרק כה מידע סודי וחיסיון לטובת המדינה ולטובת הציבורנבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהלייםתקנה 13(ה) לתקנות בתי משפט לעניינים מינהליים (סדרי דין), תשס"א-2000',
    'טעות נפוצה היא לחשוב שכל עתירה לפי חוק חופש המידע נדונה בבית המשפט לעניינים מינהליים, מבלי להכיר את החריג הספציפי הקבוע בסעיף 17(א) לחוק, המעביר את הסמכות לבית המשפט העליון במקרה של תעודת חיסיון לפי סעיף 44 לפקודת הראיות.',
    '["חוק חופש המידע", "פקודת הראיות", "תעודת חיסיון", "סמכות עניינית", "בית משפט לעניינים מינהליים", "בית המשפט העליון", "חיסיון לטובת המדינה"]'::jsonb,
    '**וריאציה 1 — פורום ברירת מחדל:** היכן נדונה עתירה לפי חוק חופש המידע? ← בבית המשפט לעניינים מינהליים (סעיף 17(א) לחוק חופש המידע). **וריאציה 2 — חריג חיסיון סעיף 44:** מה קורה אם הוצאה תעודת חיסיון לפי סעיף 44 לפקודת הראיות? ← העתירה תידון בבית המשפט העליון (סעיף 17(א) לחוק חופש המידע). **וריאציה 3 — סיבת החריג:** מדוע הסמכות עוברת לבית המשפט העליון במקרה זה? ← בשל חשיבותם ורגישותם של ענייני ביטחון המדינה ויחסי החוץ שלה (יצחק עמית, חסיונות ואינטרסים מוגנים).',
    'עתירה לחופש מידע ← מינהלי, אלא אם חיסיון סעיף 44 ← אז עליון.',
    '["חוק חופש המידע, תשנ\"ח-1998, סעיף 17(א)", "פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 44", "יצחק עמית, חסיונות ואינטרסים מוגנים - הליכי גילוי ועיון במשפט האזרחי והפלילי (2021)", "נבו - המתמחה, מערכת בתי המשפט (2026)", "תקנות בתי משפט לעניינים מינהליים (סדרי דין), תשס\"א-2000, תקנה 13(ה)"]'::jsonb,
    'needs_review=true | note: הסיווג תחת ''סדר דין אזרחי'' ו''הליכים'' הוא הקרוב ביותר מתוך הרשימה הסגורה, אך הנושא המרכזי הוא משפט מינהלי וחופש המידע. יש לשקול הוספת קטגוריה מתאימה יותר בעתיד.',
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'העתירה תמשיך להידון לפני בית המשפט לעניינים מינהליים.', false, 'תשובה זו שגויה. סעיף 17(א) לחוק חופש המידע קובע חריג מפורש לסמכות בית המשפט לעניינים מינהליים במקרה של תעודת חיסיון לפי סעיף 44 לפקודת הראיות.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'העתירה תידון לפני בית המשפט לעניינים מינהליים או בפני בית המשפט העליון - לפי החלטת בית המשפט לעניינים מינהליים.', false, 'תשובה זו שגויה. במקרה של תעודת חיסיון לפי סעיף 44 לפקודת הראיות, הסמכות נתונה באופן בלעדי לבית המשפט העליון, ואין לבית המשפט לעניינים מינהליים שיקול דעת בעניין.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'העתירה תידון לפני בית המשפט המחוזי.', false, 'תשובה זו שגויה. בית המשפט המחוזי אינו הערכאה המוסמכת לדון בעתירות לפי חוק חופש המידע, ובפרט לא בעתירות הכוללות תעודת חיסיון לפי סעיף 44 לפקודת הראיות.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'העתירה תידון לפני בית המשפט העליון.', true, 'זו התשובה הנכונה. סעיף 17(א) לחוק חופש המידע קובע במפורש כי אם הוצאה לגבי המידע נושא העתירה תעודת חיסיון לפי סעיף 44 לפקודת הראיות, העתירה תידון לפני בית המשפט העליון.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'סמכות לדון בעתירה למידע חסוי לטובת הציבור', 1, 'ראובן הגיש עתירה לבית המשפט לעניינים מינהליים כנגד רשות ציבורית מכוח חוק חופש המידע. הרשות טענה כי המידע חסוי, ומשכך הוצאה לגביו תעודת חיסיון לפי סעיף 45 לפקודת הראיות [נוסח חדש], התשל"א-1971. מה הדין לגבי הערכאה שתדון בעתירה?',
    'שאלה זו בוחנת את ההבחנה בין סוגי חסיונות שונים בפקודת הראיות ואת השלכתם על הערכאה המוסמכת לדון בעתירה לגילוי מידע לפי חוק חופש המידע. היא מדגישה כי בעוד שחיסיון לטובת המדינה (סעיף 44) מופנה לבית המשפט העליון, חיסיון לטובת הציבור (סעיף 45) נדון בערכאה הדיונית הרלוונטית.',
    'סעיף 17(א) לחוק חופש המידע קובע כי עתירה על החלטת רשות ציבורית לפי חוק זה תידון בבית משפט לעניינים מינהליים, אלא אם כן הוצאה לגבי המידע נושא העתירה תעודת חיסיון לפי סעיף 44 לפקודת הראיות, שאז העתירה תידון לפני בית המשפט העליון. לעומת זאת, במקרה של תעודת חיסיון לפי סעיף 45 לפקודת הראיות (חיסיון לטובת הציבור), העתירה לגילוי הראיה נדונה בערכאה הדיונית שדנה בתיק העיקרי. במקרה של עתירה לפי חוק חופש המידע, הערכאה הדיונית היא בית המשפט לעניינים מינהליים. סעיף 45(ג) לפקודת הראיות מאפשר לבית המשפט להעביר את הדיון בעתירה לגילוי הראיה לשופט יחיד שאינו דן בתיק העיקרי. סעיף 17(א) לחוק חופש המידע, תשנ"ח-1998סעיף 45(ג) לפקודת הראיות [נוסח חדש], תשל"א-1971יצחק עמית חסיונות ואינטרסים מוגנים - הליכי גילוי ועיון במשפט האזרחי והפלילי (2021) | פרק כה מידע סודי וחיסיון לטובת המדינה ולטובת הציבורנבו - המתמחה מערכת בתי המשפט (2026) | ז - בג"ץ ובית משפט לעניינים מינהליים',
    'טעות נפוצה היא להניח שכל תעודת חיסיון, ללא קשר לסוגה, מעבירה את הסמכות לדון בעתירה לגילוי מידע לבית המשפט העליון, מבלי להבחין בין סעיף 44 לסעיף 45 לפקודת הראיות.',
    '["חוק חופש המידע", "פקודת הראיות", "חיסיון לטובת המדינה", "חיסיון לטובת הציבור", "סמכות עניינית", "בית משפט לעניינים מינהליים", "בית המשפט העליון"]'::jsonb,
    '**וריאציה 1 — חיסיון סעיף 44:** היכן נדונה עתירה למידע עם חיסיון לפי סעיף 44 לפקודת הראיות? ← בבית המשפט העליון (סעיף 17(א) לחוק חופש המידע). **וריאציה 2 — חיסיון סעיף 45:** היכן נדונה עתירה למידע עם חיסיון לפי סעיף 45 לפקודת הראיות? ← בערכאה הדיונית, כלומר בית המשפט לעניינים מינהליים (סעיף 45 לפקודת הראיות). **וריאציה 3 — העברת דיון:** האם בית המשפט לעניינים מינהליים יכול להעביר את הדיון לשופט אחר במקרה של סעיף 45? ← כן, לשופט יחיד שאינו דן בתיק העיקרי (סעיף 45(ג) לפקודת הראיות).',
    'חיסיון סעיף 44 ← עליון; חיסיון סעיף 45 ← מינהלי (עם אפשרות לשופט אחר).',
    '["חוק חופש המידע, תשנ\"ח-1998, סעיף 17(א)", "פקודת הראיות [נוסח חדש], תשל\"א-1971, סעיף 45(ג)", "יצחק עמית, חסיונות ואינטרסים מוגנים - הליכי גילוי ועיון במשפט האזרחי והפלילי (2021)", "נבו - המתמחה, מערכת בתי המשפט (2026)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'מבחן האיזון בסעיף 17(ד) לחוק חופש המידע', 2, 'בית המשפט לעניינים מינהליים דן בעתירה לפי חוק חופש המידע, כאשר הרשות הציבורית סירבה למסור מידע מכוח סעיף 9 לחוק. מהו מבחן האיזון שבית המשפט יפעיל בהתאם לסעיף 17(ד) לחוק?',
    'שאלה זו מתמקדת במבחן האיזון המהותי שבית המשפט לעניינים מינהליים מפעיל בעת דיון בעתירה לפי חוק חופש המידע, כאשר הרשות מסרבת למסור מידע מכוח סייגי סעיף 9. היא מדגישה את סמכותו הרחבה של בית המשפט לבצע איזון בין העניין הציבורי בגילוי המידע לבין הטעמים לדחיית הבקשה.',
    'סעיף 17(ד) לחוק חופש המידע מקנה לבית המשפט סמכות מיוחדת ורחבה יותר מביקורת שיפוטית רגילה. על אף הוראות סעיף 9 (הכוללות סייגים למסירת מידע), בית המשפט רשאי להורות על מתן מידע מבוקש, כולו או חלקו ובתנאים שיקבע, אם לדעתו העניין הציבורי בגילוי המידע עדיף וגובר על הטעם לדחיית הבקשה, ובלבד שגילוי המידע אינו אסור על פי דין. סמכות זו הופכת את בית המשפט ל''מונה עוצמה'' המבצע סינתזה בין-ערכית, תוך מתן משקל לנסיבותיו הספציפיות של העניין ולאור חופש המידע. סעיף 17(ד) לחוק חופש המידע, תשנ"ח-1998עת"מ (מינהליים מרכז) 3968-03-18 ליאון שנקלר נ'' מדינת ישראל (15.12.2020)עת"מ (מינהליים מרכז) 3968-03-18 ליאון שנקלר נ'' מדינת ישראל (15.12.2020)עע"מ 414/18 התנועה למשילות ודמוקרטיה נ'' הממונה על יישום חוק חופש המידע בהנהלת בתי המשפט (13.12.2018)עע"מ 6616/21 רם כהן נ'' הממונה על יישום חוק חופש המידע במשרד האוצר (13.07.2023)',
    'טעות נפוצה היא לחשוב שסעיף 9 לחוק חופש המידע הוא חסם מוחלט למסירת מידע, מבלי להכיר את סמכות האיזון הרחבה של בית המשפט לפי סעיף 17(ד).',
    '["חוק חופש המידע", "סעיף 17(ד)", "סעיף 9", "איזון אינטרסים", "עניין ציבורי", "שיקול דעת שיפוטי", "שקיפות"]'::jsonb,
    '**וריאציה 1 — סמכות בית המשפט:** מהי סמכות בית המשפט לפי סעיף 17(ד) לחוק חופש המידע? ← להורות על מתן מידע גם אם חל סייג מסעיף 9, אם העניין הציבורי גובר (סעיף 17(ד) לחוק). **וריאציה 2 — מבחן האיזון:** מהו מבחן האיזון? ← העדפת העניין הציבורי בגילוי המידע על פני הטעם לדחיית הבקשה (סעיף 17(ד) לחוק). **וריאציה 3 — ''מונה עוצמה'':** כיצד מכונה בית המשפט בהקשר זה? ← ''מונה עוצמה'' המבצע סינתזה בין-ערכית (עת"מ 3968-03-18 שנקלר).',
    'סעיף 17(ד) ← איזון בין עניין ציבורי לגילוי לטעם לדחייה ← בית המשפט כ''מונה עוצמה''.',
    '["חוק חופש המידע, תשנ\"ח-1998, סעיף 17(ד)", "עת\"מ (מינהליים מרכז) 3968-03-18 ליאון שנקלר נ'' מדינת ישראל (15.12.2020)", "עע\"מ 414/18 התנועה למשילות ודמוקרטיה נ'' הממונה על יישום חוק חופש המידע בהנהלת בתי המשפט (13.12.2018)", "עע\"מ 6616/21 רם כהן נ'' הממונה על יישום חוק חופש המידע במשרד האוצר (13.07.2023)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'מידע שאסור לגלותו על פי דין', 3, 'רוני הגישה עתירה לבית המשפט לעניינים מינהליים כנגד רשות ציבורית מכוח חוק חופש המידע, בבקשה לקבל מידע שחל עליו איסור גילוי מוחלט לפי חוק ספציפי אחר (הוראת סודיות). הרשות סירבה למסור את המידע. האם בית המשפט רשאי להורות על גילוי המידע מכוח סעיף 17(ד) לחוק חופש המידע?',
    'שאלה זו בוחנת את גבולות סמכות האיזון של בית המשפט לפי סעיף 17(ד) לחוק חופש המידע, במיוחד כאשר קיים איסור גילוי מוחלט על פי דין אחר. היא מדגישה את העיקרון לפיו חוק חופש המידע אינו גובר על הוראות סודיות ספציפיות הקבועות בחוקים אחרים, אלא אם כן הוראת הסודיות עצמה כוללת חריגים המאפשרים גילוי.',
    'סעיף 17(ד) לחוק חופש המידע מקנה לבית המשפט סמכות לאזן בין העניין הציבורי בגילוי מידע לבין הטעם לדחיית הבקשה. אולם, סמכות זו מסויגת במפורש בסיפא של הסעיף: ''ובלבד שגילוי המידע אינו אסור על פי דין''. משמעות הדבר היא שאם קיים חוק אחר הקובע איסור מוחלט על גילוי מידע מסוים (הוראת סודיות), בית המשפט אינו רשאי להורות על גילויו, גם אם לדעתו העניין הציבורי בגילוי גובר. הפסיקה קבעה כי קשה להלום שחוק חופש המידע, כדבר חקיקה כללי, ביקש להכפיף את כל הוראות הסודיות בחוקים ספציפיים למערכת איזונים שמחוץ לגדר החוק הספציפי. מידע שחלה עליו הוראת סודיות מוחלטת אינו נכנס כלל ל''מסננות'' של סעיפים 10 ו-11 לחוק חופש המידע, וגם לא ניתן לחשוף אותו במסגרת שיקול הדעת של בית המשפט לפי סעיף 17(ד). סעיף 17(ד) לחוק חופש המידע, תשנ"ח-1998סעיף 9(א)(4) לחוק חופש המידע, תשנ"ח-1998עת"מ (מינהליים י-ם) 33749-07-22 חיים פינץ, עו"ד נ'' הממונה על יישום חוק חופש המידע ברשות שוק ההון, ביטוח וחסכון (06.09.2023)עת"מ (מינהליים י-ם) 54264-10-20 התנועה לחופש המידע (ע"ר) נ'' משרד ראש הממשלה (07.12.2020)עע"מ 452/21 התנועה לחופש המידע נ'' משרד ראש הממשלה (07.09.2022)',
    'טעות נפוצה היא להאמין שסמכות האיזון של בית המשפט לפי סעיף 17(ד) לחוק חופש המידע היא מוחלטת וגוברת על כל הוראת סודיות אחרת, מבלי להבחין בסייג המפורש ''ובלבד שגילוי המידע אינו אסור על פי דין''.',
    '["חוק חופש המידע", "סעיף 17(ד)", "סעיף 9(א)(4)", "מידע שאסור לגלותו על פי דין", "הוראת סודיות", "איזון אינטרסים", "סמכות שיפוטית"]'::jsonb,
    '**וריאציה 1 — סייג לסמכות האיזון:** האם סעיף 17(ד) לחוק חופש המידע מאפשר לבית המשפט להורות על גילוי מידע שאסור לגלותו על פי דין אחר? ← לא, הסמכות מסויגת במפורש למידע שגילויו ''אינו אסור על פי דין'' (סעיף 17(ד) לחוק). **וריאציה 2 — הוראת סודיות מוחלטת:** מה מעמדה של הוראת סודיות מוחלטת בחוק אחר? ← היא גוברת על סמכות האיזון של בית המשפט לפי סעיף 17(ד) (עת"מ 33749-07-22 פינץ). **וריאציה 3 — תכלית המחוקק:** האם חוק חופש המידע נועד לבטל הוראות סודיות ספציפיות? ← לא, קשה להלום שהמחוקק ביקש להכפיף את כל הוראות הסודיות בחוקים ספציפיים למערכת איזונים כללית (עת"מ 54264-10-20 התנועה לחופש המידע).',
    'מידע שאסור לגלותו על פי דין ← בית המשפט אינו רשאי להורות על גילויו, גם לפי סעיף 17(ד).',
    '["חוק חופש המידע, תשנ\"ח-1998, סעיף 17(ד)", "חוק חופש המידע, תשנ\"ח-1998, סעיף 9(א)(4)", "עת\"מ (מינהליים י-ם) 33749-07-22 חיים פינץ, עו\"ד נ'' הממונה על יישום חוק חופש המידע ברשות שוק ההון, ביטוח וחסכון (06.09.2023)", "עת\"מ (מינהליים י-ם) 54264-10-20 התנועה לחופש המידע (ע\"ר) נ'' משרד ראש הממשלה (07.12.2020)", "עע\"מ 452/21 התנועה לחופש המידע נ'' משרד ראש הממשלה (07.09.2022)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'הבחנה בין חוק חופש המידע להליכי גילוי', 4, 'חברת ''אלפא'' הגישה תביעה אזרחית נגד רשות ציבורית. בקשתה לגילוי מסמכים במסגרת ההליך האזרחי נדחתה על ידי בית המשפט. האם חברת ''אלפא'' רשאית לפנות בבקשה לקבלת אותם מסמכים מכוח חוק חופש המידע, ולקבלם בדרך זו?',
    'שאלה זו עוסקת בהבחנה המהותית בין חוק חופש המידע לבין הליכי גילוי מסמכים בתובענה אזרחית. היא מדגישה כי מדובר בשני מסלולים נפרדים בעלי תכליות שונות, ולכן דחיית בקשה באחד אינה מונעת בהכרח הצלחה באחר.',
    'הפסיקה הכירה בכך שקיימת הבחנה מהותית בין הליכי גילוי ועיון במסגרת תובענה אזרחית לבין בקשות לקבלת מידע מכוח חוק חופש המידע. התכליות והרציונליים שבבסיס הגילוי על-פי תקנות סדר הדין האזרחי שונים מאלה של חוק חופש המידע. חוק חופש המידע נטוע במשפט המינהלי ומטרתו שקיפות המינהל, בעוד שההתדיינות במשפט האזרחי נועדה להכריע בסכסוך קונקרטי. מטעם זה, יכול בעל-דין שלא לקבל מידע מסוים במסלול על פי תקנות סדר הדין האזרחי, אך לקבל את המידע במסלול על-פי חוק חופש המידע, ולהיפך. עת"מ (מינהליים י-ם) 33749-07-22 חיים פינץ, עו"ד נ'' הממונה על יישום חוק חופש המידע ברשות שוק ההון, ביטוח וחסכון (06.09.2023)עת"מ (מינהליים י-ם) 33749-07-22 חיים פינץ, עו"ד נ'' הממונה על יישום חוק חופש המידע ברשות שוק ההון, ביטוח וחסכון (06.09.2023)רע"א 7461/16 מדינת ישראל - אגף המכס ומע"מ נ'' פן דור תעשיות בע"מ (29.11.2016)יצחק עמית חסיונות ואינטרסים מוגנים - הליכי גילוי ועיון במשפט האזרחי והפלילי (2021) | פרק כ בין גילוי ועיון בתובענה אזרחית לגילוי ועיון לפי חוק חופש המידע',
    'טעות נפוצה היא לראות בחוק חופש המידע ובכללי גילוי המסמכים האזרחיים מסלולים חלופיים זהים, מבלי להבין את ההבדלים המהותיים בתכליתם ובאמות המידה החלות עליהם.',
    '["חוק חופש המידע", "גילוי מסמכים", "סדר דין אזרחי", "משפט מינהלי", "תכליות שונות", "מעשה בית דין", "רלוונטיות"]'::jsonb,
    '**וריאציה 1 — תכלית חוק חופש המידע:** מהי תכלית חוק חופש המידע? ← שקיפות המינהל וזכות הציבור לדעת (עת"מ 33749-07-22 פינץ). **וריאציה 2 — תכלית גילוי אזרחי:** מהי תכלית גילוי מסמכים אזרחי? ← הכרעה בסכסוך קונקרטי בין צדדים (עת"מ 33749-07-22 פינץ). **וריאציה 3 — מסלולים נפרדים:** האם דחיית בקשה לגילוי מסמכים אזרחי חוסמת פנייה לפי חוק חופש המידע? ← לא, אלו מסלולים נפרדים (עת"מ 33749-07-22 פינץ).',
    'חוק חופש המידע והליכי גילוי אזרחיים ← מסלולים נפרדים ← דחייה באחד אינה חוסמת את השני.',
    '["עת\"מ (מינהליים י-ם) 33749-07-22 חיים פינץ, עו\"ד נ'' הממונה על יישום חוק חופש המידע ברשות שוק ההון, ביטוח וחסכון (06.09.2023)", "רע\"א 7461/16 מדינת ישראל - אגף המכס ומע\"מ נ'' פן דור תעשיות בע\"מ (29.11.2016)", "יצחק עמית, חסיונות ואינטרסים מוגנים - הליכי גילוי ועיון במשפט האזרחי והפלילי (2021)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'העתירה תידון לפני בית המשפט העליון.', false, 'תשובה זו שגויה. הסמכות הבלעדית לבית המשפט העליון חלה רק במקרה של תעודת חיסיון לפי סעיף 44 לפקודת הראיות (חיסיון לטובת המדינה), ולא לפי סעיף 45 (חיסיון לטובת הציבור).', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'העתירה תידון לפני בית המשפט לעניינים מינהליים, אשר רשאי להעבירה לשופט יחיד שאינו דן בתיק העיקרי.', true, 'זו התשובה הנכונה. במקרה של תעודת חיסיון לפי סעיף 45 לפקודת הראיות, העתירה לגילוי הראיה נדונה בערכאה הדיונית, ובמקרה של עתירה מינהלית, זו תהיה בית המשפט לעניינים מינהליים. בית המשפט רשאי להעביר את הדיון לשופט יחיד שאינו דן בתיק העיקרי.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'העתירה תידון לפני בית המשפט המחוזי, בשבתו כבית משפט אזרחי.', false, 'תשובה זו שגויה. עתירה לפי חוק חופש המידע נדונה בבית המשפט לעניינים מינהליים, ולא בבית משפט מחוזי אזרחי.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא ניתן להגיש עתירה נגד תעודת חיסיון לטובת הציבור.', false, 'תשובה זו שגויה. סעיף 45 לפקודת הראיות מאפשר במפורש הגשת עתירה לגילוי ראיה חסויה לטובת הציבור.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'בית המשפט יבחן האם הרשות פעלה בסבירות סבירה, ורק אם מצא חוסר סבירות קיצוני יתערב.', false, 'תשובה זו שגויה. סעיף 17(ד) לחוק חופש המידע מקנה לבית המשפט סמכות רחבה יותר מביקורת סבירות רגילה, ומאפשר לו לבצע איזון עצמאי בין האינטרסים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'בית המשפט יורה על גילוי המידע רק אם מצא שהרשות פעלה בחוסר תום לב מובהק.', false, 'תשובה זו שגויה. חוסר תום לב אינו תנאי הכרחי להתערבות בית המשפט לפי סעיף 17(ד), אלא שיקול דעת רחב יותר המבוסס על איזון אינטרסים.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'בית המשפט יבצע איזון בין העניין הציבורי בגילוי המידע לבין הטעם לדחיית הבקשה, תוך מתן משקל לנסיבות הספציפיות של העניין.', true, 'זו התשובה הנכונה. סעיף 17(ד) לחוק חופש המידע קובע במפורש כי בית המשפט רשאי להורות על מתן מידע אם לדעתו העניין הציבורי בגילוי המידע עדיף וגובר על הטעם לדחיית הבקשה, תוך התחשבות בנסיבות המקרה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'בית המשפט יורה על גילוי המידע באופן אוטומטי, שכן זכות הציבור לדעת גוברת תמיד על סייגי סעיף 9.', false, 'תשובה זו שגויה. זכות הציבור לדעת אינה מוחלטת, וסעיף 17(ד) דורש איזון בין אינטרסים מתנגשים, ולא גילוי אוטומטי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, אם העניין הציבורי בגילוי המידע גובר על הטעם לדחייה, שכן סעיף 17(ד) מאפשר לבית המשפט לאזן בין האינטרסים.', false, 'תשובה זו שגויה. סעיף 17(ד) מסייג את סמכות האיזון של בית המשפט במפורש למידע שגילויו ''אינו אסור על פי דין''.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, שכן סעיף 17(ד) מסייג את סמכותו למידע שגילויו אינו אסור על פי דין, ואיסור גילוי מוחלט בחוק אחר גובר.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי הוראת סודיות מוחלטת הקבועה בדין אחר גוברת על סמכות האיזון של בית המשפט לפי סעיף 17(ד) לחוק חופש המידע, שכן הסעיף עצמו מסייג את סמכותו למידע שגילויו ''אינו אסור על פי דין''.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, אך רק אם הרשות הציבורית לא ביצעה איזון ראוי בין האינטרסים בעת קבלת החלטתה.', false, 'תשובה זו שגויה. גם אם הרשות לא ביצעה איזון ראוי, אם קיים איסור גילוי מוחלט על פי דין אחר, בית המשפט אינו מוסמך להורות על גילוי המידע.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, אלא אם כן המידע נכנס לגדר חריג ספציפי הקבוע בהוראת הסודיות עצמה.', false, 'תשובה זו נכונה חלקית, אך אינה התשובה המדויקת ביותר לשאלה. בית המשפט יכול להורות על גילוי רק אם הוראת הסודיות עצמה מתירה זאת, אך השאלה מתייחסת לסמכותו של בית המשפט מכוח סעיף 17(ד) לחוק חופש המידע, והסייג המוחלט של ''אסור על פי דין'' גובר על סמכות זו.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'לא, שכן החלטת בית המשפט בהליך האזרחי יוצרת מעשה בית דין ומונעת פנייה נוספת באותו עניין.', false, 'תשובה זו שגויה. חוק חופש המידע והליכי גילוי מסמכים אזרחיים הם מסלולים נפרדים, ולכן דחייה באחד אינה יוצרת מעשה בית דין כלפי השני.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'כן, שכן חוק חופש המידע והליכי גילוי מסמכים אזרחיים הם מסלולים נפרדים בעלי תכליות שונות.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי קיימת הבחנה מהותית בין המסלולים, ולכן דחיית בקשה לגילוי מסמכים בהליך אזרחי אינה חוסמת בהכרח את האפשרות לקבל את המידע לפי חוק חופש המידע.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'לא, אלא אם כן חברת ''אלפא'' תוכיח כי הרשות הציבורית פעלה בחוסר תום לב בהליך האזרחי.', false, 'תשובה זו שגויה. הצלחה בבקשה לפי חוק חופש המידע אינה תלויה בהוכחת חוסר תום לב בהליך האזרחי, אלא בעמידה בתנאי חוק חופש המידע.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'כן, אך רק אם המידע המבוקש רלוונטי באופן ישיר לתביעה האזרחית.', false, 'תשובה זו שגויה. רלוונטיות לתביעה האזרחית היא שיקול בהליך האזרחי, אך לא תנאי לקבלת מידע לפי חוק חופש המידע, שאינו דורש הוכחת עניין ישיר במידע.', 4);

END $$;

-- ============================================================
-- Q18 — 2024-W-Q18 — chapter=civil_proc subtopic=proceedings
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q18';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q18 skipped: external_id % already exists', '2024-W-Q18';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'proceedings';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q18', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'חגית הגישה לבית המשפט לענייני משפחה בתל אביב, בקשה ליישוב סכסוך בינה לבין בעלה גל. לאחר ארבעים וחמישה ימים ממועד הגשת הבקשה על ידי חגית, מבקש גל לפנות בבקשה לבית המשפט. באיזו מבין הבקשות הבאות רשאי גל לפנות לבית המשפט?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 18}'::jsonb,
    'שאלה זו עוסקת בהוראות חוק להסדר התדיינויות בסכסוכי משפחה, התשע"ה-2014, ובפרט בתקופת עיכוב ההליכים ובחריגים לה. היא בוחנת את האיזון בין תכלית החוק לעודד יישוב סכסוכים בהסכמה לבין זכות הגישה לערכאות והצורך בסעדים דחופים.',
    'חוק להסדר התדיינויות בסכסוכי משפחה, התשע"ה-2014, קובע כי צד המבקש להגיש תובענה בעניין סכסוך משפחתי יגיש תחילה בקשה ליישוב סכסוך. עם הגשת הבקשה, חלה תקופת עיכוב הליכים, הנמשכת ככלל 60 ימים (עם אפשרות להארכה או קיצור), במהלכה אסור לצדדים להגיש תובענה בעניין סכסוך משפחתי לכל ערכאה שיפוטית, ואף הערכאה השיפוטית אינה רשאית לדון בתובענה כזו. תכלית עיכוב ההליכים היא לסייע לבני זוג ליישב סכסוכים בהסכמה ובדרכי שלום ולצמצם את הצורך בהתדיינות משפטית. עם זאת, החוק מותיר פתח להגשת סעדים זמניים ודחופים. סעיף 3(ז)(1) לחוק קובע כי צד לבקשה ליישוב סכסוך רשאי להגיש, בכל עת, בקשה לסעד דחוף, לסעד זמני לשמירת המצב הקיים או לצו עיכוב יציאה מן הארץ. תקנה 10(א) לתקנות להסדר התדיינויות בסכסוכי משפחה מפרטת כי בקשה לסעד זמני לשמירת המצב הקיים, ובכלל זה צו לעיכוב יציאה מן הארץ או צו עיקול, תיערך לפי טופס 5. לפיכך, גל רשאי לפנות לבית המשפט בבקשה לצו עיכוב יציאה מן הארץ, גם בתוך תקופת עיכוב ההליכים. סעיף 3(ה) לחוק להסדר התדיינויות בסכסוכי משפחה, תשע"ה-2014סעיף 3(ז)(1) לחוק להסדר התדיינויות בסכסוכי משפחה, תשע"ה-2014תקנה 10(א) לתקנות להסדר התדיינויות בסכסוכי משפחה, תשע"ו-2016רמ"ש (מחוזי תל אביב-יפו) 43637-12-22 פלונית נ'' אלמוני (12.01.2023)בני דון-יחייא תורת דיני המשפחה (2022) | בית הדין הרבני',
    'טעות נפוצה היא להניח כי תקופת עיכוב ההליכים אוסרת באופן גורף על הגשת כל בקשה לבית המשפט, מבלי להכיר את החריגים המפורשים המאפשרים הגשת סעדים דחופים וזמניים מסוימים.',
    '["חוק להסדר התדיינויות בסכסוכי משפחה", "תקופת עיכוב הליכים", "בקשה ליישוב סכסוך", "סעדים זמניים ודחופים", "צו עיכוב יציאה מן הארץ", "זכות הגישה לערכאות", "איזון אינטרסים"]'::jsonb,
    '**וריאציה 1 — תקופת עיכוב הליכים:** מהי תקופת עיכוב ההליכים? ← 60 ימים מיום הגשת בקשה ליישוב סכסוך, במהלכה אסור להגיש תביעות (סעיף 3(ה) לחוק להסדר התדיינויות). **וריאציה 2 — סעדים מותרים:** אילו סעדים מותר להגיש במהלך תקופת עיכוב ההליכים? ← סעד דחוף, סעד זמני לשמירת המצב הקיים, או צו עיכוב יציאה מן הארץ (סעיף 3(ז)(1) לחוק להסדר התדיינויות). **וריאציה 3 — תכלית החוק:** מהי תכלית החוק להסדר התדיינויות? ← לסייע ליישב סכסוכים בהסכמה ולצמצם התדיינויות משפטיות, תוך איזון עם זכות הגישה לערכאות (סעיף 1 לחוק להסדר התדיינויות).',
    'תקופת עיכוב הליכים (60 יום) ← אסור להגיש תביעות ← מותר סעדים דחופים/זמניים (צו עיכוב יציאה, שמירת מצב קיים).',
    '["חוק להסדר התדיינויות בסכסוכי משפחה, תשע\"ה-2014, סעיף 3(ה)", "חוק להסדר התדיינויות בסכסוכי משפחה, תשע\"ה-2014, סעיף 3(ז)(1)", "תקנות להסדר התדיינויות בסכסוכי משפחה, תשע\"ו-2016, תקנה 10(א)", "רמ\"ש (מחוזי תל אביב-יפו) 43637-12-22 פלונית נ'' אלמוני (12.01.2023)", "בני דון-יחייא, תורת דיני המשפחה (2022), בית הדין הרבני"]'::jsonb,
    NULL,
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'גל רשאי לפנות לבית המשפט בבקשה בעניין הסמכות המקומית.', false, 'תשובה זו שגויה. סעיף 3(ה) לחוק להסדר התדיינויות בסכסוכי משפחה קובע כי בתקופת עיכוב ההליכים לא תדון ערכאה שיפוטית בתובענה בעניין של סכסוך משפחתי, לרבות בעניין סמכות השיפוט של הערכאה השיפוטית.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'גל רשאי לפנות לבית המשפט בבקשה בעניין חיוב חגית לוותר באופן מיידי על חלקה בעסק המשותף.', false, 'תשובה זו שגויה. בקשה לוויתור על חלק בעסק משותף היא תביעה רכושית רגילה, שאינה נחשבת לסעד דחוף או זמני המותר להגשה במהלך תקופת עיכוב ההליכים.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'גל רשאי לפנות לבית המשפט בעניין הוצאת צו עיכוב יציאה מהארץ לחגית.', true, 'זו התשובה הנכונה. סעיף 3(ז)(1) לחוק להסדר התדיינויות בסכסוכי משפחה ותקנה 10(א) לתקנות להסדר התדיינויות בסכסוכי משפחה מאפשרים הגשת בקשה לסעד זמני לשמירת המצב הקיים או לצו עיכוב יציאה מן הארץ בכל עת, גם במהלך תקופת עיכוב ההליכים.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'גל לא רשאי בשלב הזה להגיש כל בקשה לבית המשפט.', false, 'תשובה זו שגויה. אף שקיימת תקופת עיכוב הליכים, החוק מאפשר הגשת סעדים דחופים וזמניים מסוימים, כגון צו עיכוב יציאה מן הארץ.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'קיצור תקופת עיכוב הליכים ביוזמת בית המשפט', 1, 'חגית הגישה בקשה ליישוב סכסוך. בית המשפט לענייני משפחה סגר את תיק יישוב הסכסוך לאחר 30 ימים, אך לא ציין במפורש בפסק הדין כי תקופת עיכוב ההליכים קוצרה. האם סגירת התיק כשלעצמה מקצרת את תקופת עיכוב ההליכים?',
    'שאלה זו מבהירה את הדרישה הפרוצדורלית לקיצור תקופת עיכוב ההליכים לפי חוק להסדר התדיינויות בסכסוכי משפחה. היא מדגישה כי סגירת תיק יישוב סכסוך אינה מקצרת אוטומטית את התקופה, אלא נדרשת הוראה שיפוטית מפורשת בעניין.',
    'החוק להסדר התדיינויות בסכסוכי משפחה קובע תקופת עיכוב הליכים, שבמהלכה אסור להגיש תביעות. תקופה זו יכולה להתקצר בהחלטת ערכאה שיפוטית. אולם, הפסיקה קבעה כי סגירת תיק יישוב הסכסוך אינה טומנת בחובה קיצור מובנה של תקופת עיכוב ההליכים. יש לבקש קיצור כאמור במפורש מבית המשפט, או שבית המשפט יורה על כך, אף מיוזמתו, במפורש בפסק דינו הסוגר את תיק יישוב הסכסוך. ללא הוראה מפורשת כזו, תקופת עיכוב ההליכים נותרת על כנה. רמ"ש (מחוזי תל אביב-יפו) 43637-12-22 פלונית נ'' אלמוני (12.01.2023)רמ"ש (מחוזי תל אביב-יפו) 43637-12-22 פלונית נ'' אלמוני (12.01.2023)תקנה 16(א) לתקנות להסדר התדיינויות בסכסוכי משפחה, תשע"ו-2016',
    'טעות נפוצה היא להניח שכל פעולה שיפוטית המביאה לסיום הליך יישוב הסכסוך, כגון סגירת התיק, מקצרת אוטומטית את תקופת עיכוב ההליכים, מבלי לדרוש הוראה מפורשת.',
    '["תקופת עיכוב הליכים", "קיצור הליכים", "בקשה ליישוב סכסוך", "הוראה מפורשת", "חוק להסדר התדיינויות בסכסוכי משפחה"]'::jsonb,
    '**וריאציה 1 — סגירת תיק:** האם סגירת תיק יישוב סכסוך מקצרת אוטומטית את תקופת עיכוב ההליכים? ← לא, נדרשת בקשה מפורשת או הוראה מפורשת של בית המשפט (רמ"ש 43637-12-22 פלונית נ'' אלמוני). **וריאציה 2 — דרישת מפורשות:** מהי הדרישה לקיצור תקופת עיכוב ההליכים? ← החלטה מפורשת של הערכאה השיפוטית (רמ"ש 43637-12-22 פלונית נ'' אלמוני). **וריאציה 3 — תכלית:** מדוע נדרשת מפורשות? ← כדי למנוע בלבול ולאזן בין זכות הגישה לערכאות לאינטרס יישוב הסכסוך בהסכמה (רמ"ש 43637-12-22 פלונית נ'' אלמוני).',
    'סגירת תיק יישוב סכסוך ← לא מקצרת אוטומטית עיכוב הליכים ← נדרשת הוראה מפורשת.',
    '["רמ\"ש (מחוזי תל אביב-יפו) 43637-12-22 פלונית נ'' אלמוני (12.01.2023)", "תקנות להסדר התדיינויות בסכסוכי משפחה, תשע\"ו-2016, תקנה 16(א)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'תנאים להגשת סעד דחוף למזונות לפני מהו"ת', 2, 'מהם התנאים להגשת בקשה לסעד דחוף בעניין מזונות או הבטחת קשר של קטין עם הוריו, לפני ישיבת מהו"ת ראשונה, לפי חוק להסדר התדיינויות בסכסוכי משפחה?',
    'שאלה זו מתמקדת בתנאים הספציפיים להגשת בקשות לסעדים דחופים בענייני מזונות והבטחת קשר של קטינים, כחריג לכלל עיכוב ההליכים. היא מדגישה את הדרישה לקיומו של ''נזק של ממש'' כתוצאה מהמתנה לפגישת המהו"ת הראשונה.',
    'חוק להסדר התדיינויות בסכסוכי משפחה ותקנותיו קובעים כי בקשות לסעד דחוף בעניין מזונות או הבטחת קשר של קטין עם הוריו ניתן להגיש ''בכל עת''. אולם, תקנה 12(א)(3) לתקנות מסייגת זאת וקובעת כי סעדים אלו יינתנו רק ''במקרים חריגים שבהם המתנה לפגישת המהו"ת הראשונה תגרום נזק של ממש לצדדים או לילדיהם''. תנאי זה נועד לאזן בין הצורך בסעד מיידי לבין תכלית החוק לעודד יישוב סכסוכים בהסכמה ולצמצם התדיינויות משפטיות. תקנה 12(א)(3) לתקנות להסדר התדיינויות בסכסוכי משפחה, תשע"ו-2016י"ס (משפחה נצרת) 9157-03-21 מ.ג נ'' ר.ק (28.04.2021)י"ס (משפחה נצרת) 9157-03-21 מ.ג נ'' ר.ק (28.04.2021)בני דון-יחייא תורת דיני המשפחה (2022) | מזונות ילדים',
    'הטעות הנפוצה היא להתעלם מהדרישה ל''נזק של ממש'' ולחשוב שכל בקשה לסעד דחוף בענייני מזונות או קשר מותרת אוטומטית בכל עת, מבלי להוכיח את דחיפותה המיוחדת.',
    '["סעד דחוף", "מזונות", "הבטחת קשר", "פגישת מהו\"ת", "נזק של ממש", "תקופת עיכוב הליכים", "חוק להסדר התדיינויות בסכסוכי משפחה"]'::jsonb,
    '**וריאציה 1 — תנאי למזונות/קשר:** מהו התנאי להגשת סעד דחוף למזונות או הבטחת קשר לפני מהו"ת? ← נזק של ממש כתוצאה מהמתנה (תקנה 12(א)(3) לתקנות להסדר התדיינויות). **וריאציה 2 — ''בכל עת'':** האם ''בכל עת'' משמעו ללא תנאים? ← לא, ''בכל עת'' מתייחס למועד ההגשה, אך התנאי המהותי של נזק ממשי עדיין חל (י"ס 9157-03-21 מ.ג נ'' ר.ק). **וריאציה 3 — תכלית התנאי:** מהי תכלית הדרישה לנזק ממשי? ← לאזן בין הצורך בסעד מיידי לבין עידוד יישוב סכסוכים בהסכמה (י"ס 9157-03-21 מ.ג נ'' ר.ק).',
    'סעד דחוף למזונות/קשר ← רק במקרים חריגים ← נזק של ממש מהמתנה למהו"ת.',
    '["תקנות להסדר התדיינויות בסכסוכי משפחה, תשע\"ו-2016, תקנה 12(א)(3)", "י\"ס (משפחה נצרת) 9157-03-21 מ.ג נ'' ר.ק (28.04.2021)", "בני דון-יחייא, תורת דיני המשפחה (2022), מזונות ילדים"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'הגשת תביעה לאחר תום תקופת עיכוב הליכים', 3, 'חגית הגישה בקשה ליישוב סכסוך. חלפו 60 ימים של תקופת עיכוב הליכים ועוד 15 ימי קדימה, וחגית לא הגישה תביעה. גל הגיש תביעה ביום ה-76. האם תביעתו של גל כשרה?',
    'שאלה זו עוסקת בזכות הקדימה להגשת תביעות לאחר תום תקופת עיכוב ההליכים, כפי שנקבעה בסעיף 4 לחוק להסדר התדיינויות בסכסוכי משפחה. היא מבהירה את סדר הזמנים והתנאים שבהם זכות זו עוברת מהצד שהגיש את הבקשה ליישוב סכסוך לצד השני.',
    'חוק להסדר התדיינויות בסכסוכי משפחה קובע תקופת עיכוב הליכים של 60 ימים. לאחר מכן, הצד שהגיש תחילה את הבקשה ליישוב סכסוך מקבל זכות קדימה להגיש את תביעותיו בתוך 15 ימים. אם צד זה לא הגיש תובענה בתוך 15 הימים, או הגיש רק לגבי חלק מהעניינים, רשאי הצד השני להגיש תובענה בעניינים שלא הוגשו. במקרה הנדון, חלפו 60 ימים ועוד 15 ימי קדימה, וחגית לא הגישה תביעה. גל הגיש תביעה ביום ה-76, כלומר לאחר שזכות הקדימה של חגית פקעה, ולכן תביעתו כשרה. הפסיקה דוחה את הרעיון של ''החייאת מתים'' לתביעה שהוגשה שלא כדין, ומדגישה כי זכותו של הצד השני קמה רק לאחר שזכות הקדימה של הצד הראשון פקעה. סעיף 4 לחוק להסדר התדיינויות בסכסוכי משפחה, תשע"ה-2014בע"מ 21627-10-25 פלונית נ'' פלוני (09.12.2025)בע"מ 21627-10-25 פלונית נ'' פלוני (09.12.2025)תלה"מ (משפחה ירושלים) 87229-02-26 פלונית נ'' אלמוני (13.04.2026)',
    'טעות נפוצה היא לחשוב שתביעה שהוגשה מוקדם מדי על ידי הצד השני ''תחכה'' עד שתגיע זכותו, במקום להבין שהיא בטלה מעיקרה וזכותו קמה רק לאחר פקיעת זכות הקדימה של הצד הראשון.',
    '["זכות קדימה", "תקופת עיכוב הליכים", "סעיף 4 לחוק להסדר התדיינויות", "הגשת תביעה", "מחיקה על הסף", "מרוץ סמכויות"]'::jsonb,
    '**וריאציה 1 — זכות קדימה:** כמה זמן יש לצד שהגיש בקשה ליישוב סכסוך להגיש תביעה לאחר תום עיכוב ההליכים? ← 15 ימים (סעיף 4 לחוק להסדר התדיינויות). **וריאציה 2 — זכות הצד השני:** מתי קמה זכותו של הצד השני להגיש תביעה? ← רק אם הצד הראשון לא הגיש תביעה בתוך 15 ימי הקדימה (סעיף 4 לחוק להסדר התדיינויות). **וריאציה 3 — ''החייאת מתים'':** האם תביעה שהוגשה מוקדם מדי על ידי הצד השני ''נכנסת לתוקף'' מאוחר יותר? ← לא, אין ''החייאת מתים'' בדין, תביעה כזו בטלה מעיקרה (בע"מ 21627-10-25 פלונית נ'' פלוני).',
    'תום עיכוב הליכים ← 15 ימי קדימה למגיש הבקשה ← אם לא הגיש, זכות עוברת לצד השני.',
    '["חוק להסדר התדיינויות בסכסוכי משפחה, תשע\"ה-2014, סעיף 4", "בע\"מ 21627-10-25 פלונית נ'' פלוני (09.12.2025)", "תלה\"מ (משפחה ירושלים) 87229-02-26 פלונית נ'' אלמוני (13.04.2026)"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'בקשה ליישוב סכסוך כ''תובענה''', 4, 'האם בקשה ליישוב סכסוך, שאינה כוללת פירוט של מהות הסכסוך, נחשבת ל''תובענה'' או ''הליך'' לצורך קביעת סמכות?',
    'שאלה זו בוחנת את מעמדה המשפטי של בקשה ליישוב סכסוך כ''תובענה'' או ''הליך'' לצורך קביעת סמכות, למרות אופייה המקורי כהליך גישור ואי-פירוט הסכסוך. היא מדגישה את ההכרה השיפוטית באופיו הייחודי של ההליך, הכולל החלטות שיפוטיות רבות, כבסיס למעמדו כתובענה.',
    'הבקשה ליישוב סכסוך, על אף שאינה כוללת פירוט של מהות הסכסוך ונועדה בתחילה להפנות את הצדדים ליחידת הסיוע, מהווה ''תובענה'' או ''הליך'' לכל דבר ועניין. זאת, משום שההליך רצוף החלטות שיפוטיות הנדרשות לאורך כל שלביו, כגון הפניית הצדדים ליחידת הסיוע, דיון בבקשות לסעדים זמניים, אישור הסכמים או הוראה על חידוש ההליכים. תקנה 258כ(ג) לתקנות סדר הדין האזרחי (שקדמו לתקנות להסדר התדיינויות) קובעת במפורש כי הגשת בקשה ליישוב סכסוך תיחשב כהגשת תובענה בענייני רכוש, מזונות ומשמורת. בג"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול, סג(2) 247 (23.06.2009)בג"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול, סג(2) 247 (23.06.2009)תקנה 258כ(ג) לתקנות סדר הדין האזרחי, תשמ"ד-1984בג"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול, סג(2) 247 (23.06.2009)',
    'טעות נפוצה היא לראות בבקשה ליישוב סכסוך הליך ''טיפולי'' בלבד, שאינו בעל מעמד של ''תובענה'' או ''הליך'' משפטי, ובכך להתעלם מהשלכותיו על קביעת סמכות ומרוץ סמכויות.',
    '["בקשה ליישוב סכסוך", "תובענה", "הליך", "סמכות עניינית", "מרוץ סמכויות", "החלטות שיפוטיות", "תקנה 258כ(ג)"]'::jsonb,
    '**וריאציה 1 — מעמד הבקשה:** האם בקשה ליישוב סכסוך נחשבת ל''תובענה'' או ''הליך''? ← כן, בשל ההחלטות השיפוטיות הרבות הכרוכות בה (בג"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול). **וריאציה 2 — תכלית:** מדוע היא נחשבת לתובענה למרות שאינה מפורטת? ← כדי למנוע מרוץ סמכויות ולאפשר פתיחת הליך בדרך פשוטה (בג"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול, תקנה 258כ(ג)). **וריאציה 3 — השלכה על סמכות:** מהי ההשלכה של מעמד זה על קביעת סמכות? ← התובענה נפתחת כבר במועד הגשת הבקשה ליישוב סכסוך, וזה קובע את הסמכות (בג"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול).',
    'בקשה ליישוב סכסוך ← נחשבת ''תובענה'' ← קובעת סמכות ← למרות שאינה מפורטת.',
    '["בג\"ץ 5918/07 פלונית נ'' בית הדין הרבני הגדול, סג(2) 247 (23.06.2009)", "תקנות סדר הדין האזרחי, תשמ\"ד-1984, תקנה 258כ(ג)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'כן, סגירת תיק יישוב סכסוך על ידי בית המשפט מקצרת אוטומטית את תקופת עיכוב ההליכים.', false, 'תשובה זו שגויה. הפסיקה קבעה כי סגירת תיק יישוב סכסוך אינה טומנת בחובה קיצור מובנה של תקופת עיכוב ההליכים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'לא, סגירת תיק יישוב הסכסוך אינה טומנת בחובה קיצור מובנה של תקופת עיכוב ההליכים, ויש לבקש קיצור במפורש מבית המשפט.', true, 'זו התשובה הנכונה. הפסיקה קובעת כי קיצור תקופת עיכוב ההליכים דורש בקשה מפורשת מבית המשפט, או הוראה מפורשת של בית המשפט בפסק הדין הסוגר את תיק יישוב הסכסוך.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'כן, אם חלפו לפחות 30 ימים ממועד הגשת הבקשה ליישוב סכסוך.', false, 'תשובה זו שגויה. משך הזמן שחלף אינו קובע אוטומטית קיצור, אלא נדרשת החלטה שיפוטית מפורשת.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'לא, אלא אם כן הצדדים הסכימו במפורש על קיצור תקופת עיכוב ההליכים.', false, 'תשובה זו שגויה. הסכמת הצדדים היא דרך אחת לקיצור, אך השאלה מתייחסת למצב בו בית המשפט סגר את התיק, וגם אז נדרשת הוראה מפורשת של בית המשפט.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'ניתן להגיש בקשה כזו בכל עת, ללא תנאים נוספים.', false, 'תשובה זו שגויה. אף שניתן להגיש ''בכל עת'', תקנה 12(א)(3) קובעת תנאי מהותי נוסף למקרים חריגים.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'רק במקרים חריגים שבהם המתנה לפגישת המהו"ת הראשונה תגרום נזק של ממש לצדדים או לילדיהם.', true, 'זו התשובה הנכונה. תקנה 12(א)(3) לתקנות להסדר התדיינויות בסכסוכי משפחה קובעת תנאי זה במפורש להגשת סעד דחוף בעניין מזונות או הבטחת קשר של קטין.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'רק אם הצד השני מסרב להשתתף בפגישות המהו"ת.', false, 'תשובה זו שגויה. סירוב הצד השני להשתתף בפגישות מהו"ת עשוי להוות עילה לקיצור תקופת עיכוב ההליכים, אך אינו התנאי היחיד או המרכזי להגשת סעד דחוף למזונות או הבטחת קשר.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'רק אם חלפו לפחות 30 ימים ממועד הגשת הבקשה ליישוב סכסוך.', false, 'תשובה זו שגויה. משך הזמן שחלף אינו תנאי להגשת סעד דחוף למזונות או הבטחת קשר, אלא נזק ממשי.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'לא, תביעתו של גל הוגשה שלא כדין ודינה להימחק על הסף, שכן הוא הקדים את זמנו.', false, 'תשובה זו שגויה. גל רשאי להגיש את תביעתו רק לאחר שחלפו 15 ימי הקדימה של חגית, ובמקרה זה הוא הגיש אותה ביום ה-76, כלומר לאחר תום תקופת הקדימה של חגית.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'כן, תביעתו של גל כשרה, שכן זכותו להגיש תביעה קמה לתחיה לאחר שחגית לא הגישה את תביעתה בתקופת זכות הקדימה.', true, 'זו התשובה הנכונה. סעיף 4 לחוק להסדר התדיינויות בסכסוכי משפחה קובע כי אם הצד שהגיש תחילה את הבקשה ליישוב סכסוך לא הגיש תובענה בתוך 15 ימים לאחר תום תקופת עיכוב ההליכים, רשאי הצד השני להגיש תובענה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'לא, תביעתו של גל כשרה רק אם חגית הסכימה לכך במפורש.', false, 'תשובה זו שגויה. זכותו של הצד השני להגיש תביעה קמה מכוח החוק, ואינה תלויה בהסכמת הצד הראשון.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'כן, אך רק אם בית המשפט אישר את הגשת התביעה בדיעבד.', false, 'תשובה זו שגויה. זכותו של הצד השני להגיש תביעה קמה מכוח החוק, ואינה דורשת אישור בדיעבד של בית המשפט.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'לא, שכן היא אינה כוללת פירוט של העניינים במחלוקת ואינה מיועדת להכרעה שיפוטית ישירה.', false, 'תשובה זו שגויה. אף שהבקשה אינה מפורטת, הפסיקה קבעה כי היא מהווה ''תובענה'' או ''הליך'' בשל ההחלטות השיפוטיות הרבות הכרוכות בה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'כן, הבקשה ליישוב סכסוך מהווה ''תובענה'' או ''הליך'' בשל ההחלטות השיפוטיות הרבות הכרוכות בה לאורך כל שלביה.', true, 'זו התשובה הנכונה. הפסיקה קבעה כי בקשה ליישוב סכסוך מהווה ''תובענה'' או ''הליך'' בשל אופיו הייחודי של ההליך, הכולל החלטות שיפוטיות רבות, למרות שאינו מפורט בתחילה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'רק אם הצדדים הגיעו להסכם שאושר על ידי בית המשפט.', false, 'תשובה זו שגויה. ההכרה בבקשה כ''תובענה'' או ''הליך'' אינה תלויה בתוצאת ההליך, אלא באופיו הפרוצדורלי הכולל החלטות שיפוטיות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'רק אם הוגשו כתבי תביעה מאוחרים לאחר כישלון הליך יישוב הסכסוך.', false, 'תשובה זו שגויה. הגשת כתבי תביעה מאוחרים אינה פותחת את ההליך, אלא ממשיכה אותו, שכן הבקשה ליישוב סכסוך כבר נחשבת לתובענה.', 4);

END $$;

-- ============================================================
-- Q19 — 2024-W-Q19 — chapter=civil_proc subtopic=proceedings
-- notes: needs_review=true | note: הסיווג תחת 'סדר דין אזרחי' ו'הליכים' הוא הקרוב ביותר מתוך הרשימה הסגורה, אך הנושא המרכזי הוא משפט חוקתי והליכי חקיקה תקציביים. יש לשקול הוספת קטגוריה מתאימה יותר בעתיד.
-- ============================================================
DO $$
DECLARE
  v_sq_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_subtopic_id uuid;
  v_existing_id uuid;
  v_ang_a uuid := gen_random_uuid();
  v_ang_b uuid := gen_random_uuid();
  v_ang_c uuid := gen_random_uuid();
  v_ang_d uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_existing_id FROM public.source_questions WHERE external_id = '2024-W-Q19';
  IF v_existing_id IS NOT NULL THEN
    RAISE NOTICE 'Q19 skipped: external_id % already exists', '2024-W-Q19';
    RETURN;
  END IF;

  SELECT id INTO v_subtopic_id FROM public.subtopics WHERE code = 'proceedings';
  IF v_subtopic_id IS NULL THEN
    RAISE EXCEPTION 'Subtopic code % not found', 'proceedings';
  END IF;

  INSERT INTO public.source_questions (
    id, question_group_id, version, is_current, external_id, chapter_id, subtopic_id,
    question_text, source_metadata, legal_topic_analysis, full_explanation, common_pitfall,
    concepts_and_skills, quick_thinking_360, summary_for_memory, references_list,
    notes_for_admin, status, created_by
  ) VALUES (
    v_sq_id, v_group_id, 1, true,
    '2024-W-Q19', '34781415-6c5e-4e9c-9550-d65a9d3e1d90', v_subtopic_id,
    'חבר כנסת מהאופוזיציה הגיש הסתייגות תקציבית לאחת מהצעות החוק של חבר כנסת מהקואליציה. מה הדין?',
    '{"exam_year": 2024, "exam_season": "winter", "exam_part": 2, "exam_question_number": 19}'::jsonb,
    'שאלה זו עוסקת בהליכי חקיקה בכנסת, ובפרט ברוב המיוחד הנדרש לקבלת ''הסתייגות תקציבית'' לפי חוק יסוד: משק המדינה. היא מדגישה את ההבחנה בין רוב רגיל לרוב מיוחד, ואת חשיבות הפיקוח הפרלמנטרי על התקציב באמצעות דרישות רוב מחמירות יותר להצעות והסתייגויות בעלות השלכה תקציבית משמעותית.',
    'חוק יסוד: משק המדינה קובע כללים מיוחדים לחקיקה בענייני תקציב, במטרה להבטיח פיקוח פרלמנטרי הדוק על כספי הציבור. סעיף 3ג(ב) לחוק יסוד: משק המדינה קובע כי ''הסתייגות תקציבית'' לא תתקבל בכנסת אלא בקולותיהם של 50 חברי הכנסת לפחות. יתרה מכך, אם התקבלה הסתייגות תקציבית להצעת חוק, הצעת החוק כולה לא תתקבל בכנסת בקריאה השלישית אלא בקולותיהם של 50 חברי הכנסת לפחות. דרישה זו לרוב מיוחד (50 חברי כנסת) נועדה להבטיח כי שינויים תקציביים משמעותיים, במיוחד אלו שלא זכו להסכמת הממשלה, יתקבלו רק בתמיכה רחבה יחסית של חברי הכנסת. הרוב המיוחד הזה נמוך מרוב של חברי הכנסת (61), אך גבוה מרוב רגיל, ומשקף את האיזון בין הצורך בגמישות תקציבית לבין חשיבות הפיקוח הפרלמנטרי. סעיף 3ג(ב) לחוק יסוד: משק המדינהנבו - המתמחה חוקי יסוד (2026) | פרק א - חוק-יסוד: משק המדינהנבו - המתמחה חוקי יסוד (2026) | כללי אצבעבג"ץ 2337/21 התנועה למען איכות השלטון בישראל נ'' היועמ"ש (22.02.2022)בג"ץ 8260/16 המרכז האקדמי למשפט ולעסקים נ'' כנסת ישראל (06.09.2017)',
    'טעות נפוצה היא לבלבל בין הרוב המיוחד של 50 חברי כנסת הנדרש להסתייגות תקציבית לבין רוב רגיל או רוב של 61 חברי כנסת הנדרש לעניינים אחרים, ובכך להחמיץ את הדרישה הספציפית של חוק יסוד: משק המדינה.',
    '["הסתייגות תקציבית", "חוק יסוד: משק המדינה", "רוב מיוחד", "הליכי חקיקה", "פיקוח פרלמנטרי", "קריאה שלישית"]'::jsonb,
    '**וריאציה 1 — רוב להסתייגות תקציבית:** מהו הרוב הדרוש לקבלת הסתייגות תקציבית? ← 50 חברי כנסת לפחות (סעיף 3ג(ב) לחוק יסוד: משק המדינה). **וריאציה 2 — השפעה על קריאה שלישית:** אם הסתייגות תקציבית התקבלה, מה הרוב הנדרש לקריאה השלישית של החוק? ← גם 50 חברי כנסת לפחות (סעיף 3ג(ב) לחוק יסוד: משק המדינה). **וריאציה 3 — תכלית הרוב המיוחד:** מדוע נדרש רוב מיוחד זה? ← להבטיח פיקוח פרלמנטרי על שינויים תקציביים משמעותיים (בג"ץ 8260/16 המרכז האקדמי למשפט ולעסקים).',
    'הסתייגות תקציבית ← דורשת רוב של 50 ח"כים ← גם לקריאה השלישית של החוק.',
    '["חוק יסוד: משק המדינה, סעיף 3ג(ב)", "נבו - המתמחה, חוקי יסוד (2026), פרק א - חוק-יסוד: משק המדינה", "נבו - המתמחה, חוקי יסוד (2026), כללי אצבע", "בג\"ץ 2337/21 התנועה למען איכות השלטון בישראל נ'' היועמ\"ש (22.02.2022)", "בג\"ץ 8260/16 המרכז האקדמי למשפט ולעסקים נ'' כנסת ישראל (06.09.2017)"]'::jsonb,
    'needs_review=true | note: הסיווג תחת ''סדר דין אזרחי'' ו''הליכים'' הוא הקרוב ביותר מתוך הרשימה הסגורה, אך הנושא המרכזי הוא משפט חוקתי והליכי חקיקה תקציביים. יש לשקול הוספת קטגוריה מתאימה יותר בעתיד.',
    'active',
    'b9ecdde2-d07e-4761-96ab-05f0ad32d4e3'
  );

  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'א', 'הסתייגות תקציבית לא תתקבל בכנסת אלא בקולותיהם של שני שליש מחברי הכנסת לפחות; התקבלה הסתייגות תקציבית להצעת חוק, לא תתקבל הצעת החוק בכנסת בקריאה השלישית, אלא בקולותיהם של שני שליש מחברי הכנסת לפחות.', false, 'תשובה זו שגויה. הרוב הדרוש לקבלת הסתייגות תקציבית הוא 50 חברי כנסת, ולא שני שליש מחברי הכנסת.', 1);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ב', 'הסתייגות תקציבית לא תתקבל בכנסת אלא בקולותיהם של חמישים חברי הכנסת לפחות; התקבלה הסתייגות תקציבית להצעת חוק, לא תתקבל הצעת החוק בכנסת בקריאה השלישית, אלא בקולותיהם של חמישים חברי הכנסת לפחות.', true, 'זו התשובה הנכונה. סעיף 3ג(ב) לחוק יסוד: משק המדינה קובע כי הסתייגות תקציבית תתקבל ברוב של 50 חברי כנסת לפחות, ואם התקבלה, הצעת החוק כולה תצטרך להתקבל בקריאה השלישית ברוב זהה.', 2);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ג', 'הסתייגות תקציבית תתקבל בכנסת ברוב רגיל; התקבלה הסתייגות תקציבית להצעת חוק, לא תתקבל הצעת החוק בכנסת בקריאה השלישית, אלא בקולותיהם של שני שליש מחברי הכנסת לפחות.', false, 'תשובה זו שגויה. הסתייגות תקציבית אינה מתקבלת ברוב רגיל, וגם הרוב הנדרש לקריאה שלישית במקרה זה אינו שני שליש.', 3);
  INSERT INTO public.source_choices (source_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_sq_id, 'ד', 'הסתייגות תקציבית לא תתקבל בכנסת אלא בקולותיהם של 61 חברי הכנסת לפחות; התקבלה הסתייגות תקציבית להצעת חוק, לא תתקבל הצעת החוק בכנסת בקריאה השלישית, אלא בקולותיהם של 61 חברי הכנסת לפחות.', false, 'תשובה זו שגויה. הרוב הדרוש לקבלת הסתייגות תקציבית הוא 50 חברי כנסת, ולא 61 חברי כנסת.', 4);

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_a, v_sq_id, 'א', 'רוב מיוחד לשינוי חוק יסוד: הכנסת', 1, 'הכנסת דנה בהצעת חוק לשינוי סעיף 4 לחוק יסוד: הכנסת, העוסק בשיטת הבחירות. מהו הרוב הדרוש לקבלת הצעת חוק זו?',
    'שאלה זו עוסקת ב''שריון'' חוקי יסוד, ובפרט בסעיף 46 לחוק יסוד: הכנסת, הקובע רוב מיוחד (רוב חברי הכנסת) לשינוי סעיפים מסוימים בחוק היסוד. היא מדגישה את ההבדל בין חוקי יסוד ''משוריינים'' לחוקים רגילים או חוקי יסוד שאינם משוריינים.',
    'חוק יסוד: הכנסת, כמו חוקי יסוד אחרים, כולל סעיפים ''משוריינים'' ששינויים בהם דורשים רוב מיוחד. סעיף 46 לחוק יסוד: הכנסת קובע במפורש כי הרוב הדרוש לשינוי סעיפים 4, 9א, 34, 44 או 45 יהא רוב של חברי הכנסת (כלומר 61 חברי כנסת לפחות) בכל שלוש הקריאות. דרישה זו נועדה להבטיח יציבות של עקרונות יסוד אלו ולמנוע שינויים ברוב מקרי. הפסיקה עמדה על חשיבותו של רוב מיוחד זה, המבטא את רצון הרוב המכריע של נבחרי הציבור. סעיף 46 לחוק-יסוד: הכנסתבג"ץ 142/89 תנועת לאו"ר - לב אחד ורוח חדשה נ'' יושב-ראש הכנסת ו- 16אח'' (01.07.1990)בג"ץ 246/81 אגודת דרך ארץ נ'' רשות השידור (28.07.1981)נבו - המתמחה חוקי יסוד (2026) | הרוב הדרוש - חוקי יסוד',
    'טעות נפוצה היא לבלבל בין הרוב המיוחד הנדרש לשינוי סעיפים משוריינים בחוקי יסוד (61 חברי כנסת) לבין רוב מיוחד אחר, כגון 50 חברי כנסת להצעות חוק תקציביות, או רוב רגיל.',
    '["חוק יסוד: הכנסת", "סעיף 46", "שריון חוקתי", "רוב מיוחד", "שיטת הבחירות", "הליכי חקיקה"]'::jsonb,
    '**וריאציה 1 — רוב לשינוי סעיף 4:** מהו הרוב הדרוש לשינוי סעיף 4 לחוק יסוד: הכנסת? ← 61 חברי כנסת בכל שלוש הקריאות (סעיף 46 לחוק יסוד: הכנסת). **וריאציה 2 — מטרת השריון:** מדוע סעיף זה משוריין? ← להבטיח יציבות של עקרונות יסוד ולמנוע שינויים ברוב מקרי (בג"ץ 142/89 תנועת לאו"ר). **וריאציה 3 — הבדל מרוב רגיל:** מה ההבדל בין רוב מיוחד לרוב רגיל בהקשר זה? ← רוב מיוחד (61 ח"כים) נדרש בכל שלבי החקיקה, בניגוד לרוב רגיל (נבו - המתמחה, חוקי יסוד).',
    'שינוי סעיף 4 לחוק יסוד: הכנסת ← רוב של 61 ח"כים ← בכל שלוש הקריאות.',
    '["חוק-יסוד: הכנסת, סעיף 46", "בג\"ץ 142/89 תנועת לאו\"ר - לב אחד ורוח חדשה נ'' יושב-ראש הכנסת ו- 16אח'', מד(3) 529 (01.07.1990)", "בג\"ץ 246/81 אגודת דרך ארץ נ'' רשות השידור, לה(4) 001 (28.07.1981)", "נבו - המתמחה, חוקי יסוד (2026), הרוב הדרוש - חוקי יסוד"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_b, v_sq_id, 'ב', 'הגדרת ''הצעת חוק תקציבית'' ו''הסתייגות תקציבית''', 2, 'מהם התנאים המצטברים להגדרת ''הסתייגות תקציבית'' לפי חוק יסוד: משק המדינה?',
    'שאלה זו מתמקדת בהגדרות המדויקות של ''הצעת חוק תקציבית'' ו''הסתייגות תקציבית'' כפי שנקבעו בחוק יסוד: משק המדינה. הבנה זו חיונית לקביעת הרוב המיוחד הנדרש לקבלתן בכנסת, ומדגישה את חשיבות הסכמת הממשלה לעלות התקציבית.',
    'סעיף 3ג(ד) לחוק יסוד: משק המדינה מגדיר במפורש ''הצעת חוק תקציבית'' ו''הסתייגות תקציבית''. ''הצעת חוק תקציבית'' היא הצעת חוק שהוגשה שלא בידי הממשלה, בביצועה כרוכה עלות תקציבית של 7,194,585 שקלים חדשים או יותר (סכום המתעדכן מעת לעת), והממשלה לא נתנה את הסכמתה לעלות התקציבית. ''הסתייגות תקציבית'' היא הסתייגות להצעת חוק שמתקיימים בה שני תנאים מצטברים: בביצועה כרוכה עלות תקציבית של 7,194,585 שקלים חדשים או יותר בשנת תקציב כלשהי, והממשלה לא נתנה את הסכמתה לעלות התקציבית. ההבחנה בין השתיים חשובה לקביעת הרוב הנדרש לקבלתן. סעיף 3ג(ד) לחוק יסוד: משק המדינהסעיף 3ג(ד) לחוק יסוד: משק המדינהנבו - המתמחה חוקי יסוד (2026) | פרק א - חוק-יסוד: משק המדינהנבו - המתמחה חוקי יסוד (2026) | פרק א - חוק-יסוד: משק המדינה',
    'טעות נפוצה היא לבלבל בין הגדרת ''הצעת חוק תקציבית'' ל''הסתייגות תקציבית'', ובפרט להתעלם מהתנאי של ''הוגשה שלא בידי הממשלה'' שרלוונטי רק להצעת חוק תקציבית.',
    '["הצעת חוק תקציבית", "הסתייגות תקציבית", "חוק יסוד: משק המדינה", "עלות תקציבית", "הסכמת הממשלה", "רוב מיוחד"]'::jsonb,
    '**וריאציה 1 — הגדרת הסתייגות תקציבית:** מה מגדיר הסתייגות תקציבית? ← עלות תקציבית של 7.2 מיליון ש"ח ומעלה, והממשלה לא הסכימה (סעיף 3ג(ד) לחוק יסוד: משק המדינה). **וריאציה 2 — הבדל מהצעת חוק תקציבית:** מה ההבדל העיקרי בין הסתייגות תקציבית להצעת חוק תקציבית? ← הצעת חוק תקציבית חייבת להיות מוגשת שלא בידי הממשלה, בעוד הסתייגות לא (סעיף 3ג(ד) לחוק יסוד: משק המדינה). **וריאציה 3 — חשיבות ההגדרה:** מדוע ההגדרה חשובה? ← היא קובעת את הרוב המיוחד הנדרש לקבלת ההסתייגות (50 ח"כים) (סעיף 3ג(ב) לחוק יסוד: משק המדינה).',
    'הסתייגות תקציבית ← עלות מעל 7.2 מיליון ש"ח ← ללא הסכמת ממשלה.',
    '["חוק יסוד: משק המדינה, סעיף 3ג(ד)", "נבו - המתמחה, חוקי יסוד (2026), פרק א - חוק-יסוד: משק המדינה"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_c, v_sq_id, 'ג', 'הסכמת הממשלה לעלות תקציבית', 3, 'חבר כנסת הגיש הסתייגות להצעת חוק, שבביצועה כרוכה עלות תקציבית של 10 מיליון ש"ח. הממשלה, לאחר בחינה, הודיעה לוועדה כי היא נותנת את הסכמתה לעלות התקציבית. האם הסתייגות זו עדיין תיחשב ל''הסתייגות תקציבית'' ותדרוש רוב מיוחד?',
    'שאלה זו בוחנת את אחד התנאים המהותיים להגדרת ''הסתייגות תקציבית'' – היעדר הסכמת הממשלה לעלות התקציבית. היא מדגישה כי הסכמת הממשלה מנטרלת את אופי ההסתייגות כ''תקציבית'', ובכך מבטלת את הדרישה לרוב מיוחד לקבלתה.',
    'הגדרת ''הסתייגות תקציבית'' בסעיף 3ג(ד) לחוק יסוד: משק המדינה כוללת שני תנאים מצטברים: (1) בביצועה כרוכה עלות תקציבית של 7,194,585 שקלים חדשים או יותר, ו-(2) הממשלה לא נתנה את הסכמתה לעלות התקציבית. אם הממשלה נותנת את הסכמתה לעלות התקציבית, התנאי השני אינו מתקיים, ולכן ההסתייגות אינה נחשבת ל''הסתייגות תקציבית'' ואינה דורשת את הרוב המיוחד של 50 חברי כנסת. תקנון הכנסת אף מתייחס למצב זה, וקובע כי הממשלה רשאית להודיע על שינוי עמדתה בעניין הסכמתה לעלות התקציבית של הצעת חוק. סעיף 3ג(ד) לחוק יסוד: משק המדינהתקנון הכנסת, סעיף 93(ד)(1)תקנון הכנסת, סעיף 93(ה)נבו - המתמחה חוקי יסוד (2026) | פרק א - חוק-יסוד: משק המדינה',
    'טעות נפוצה היא להתמקד רק בסכום העלות התקציבית, מבלי לזכור שהיעדר הסכמת הממשלה הוא תנאי הכרחי נוסף להגדרת הסתייגות כ''תקציבית''.',
    '["הסתייגות תקציבית", "חוק יסוד: משק המדינה", "עלות תקציבית", "הסכמת הממשלה", "רוב מיוחד", "תקנון הכנסת"]'::jsonb,
    '**וריאציה 1 — תנאי הסכמה:** האם הסכמת הממשלה משפיעה על אופי הסתייגות תקציבית? ← כן, אם הממשלה מסכימה, היא אינה נחשבת הסתייגות תקציבית (סעיף 3ג(ד) לחוק יסוד: משק המדינה). **וריאציה 2 — רוב נדרש:** אם הממשלה הסכימה, איזה רוב נדרש לקבלת ההסתייגות? ← רוב רגיל, שכן היא אינה ''הסתייגות תקציבית'' (סעיף 3ג(ב) לחוק יסוד: משק המדינה). **וריאציה 3 — הודעת הממשלה:** כיצד הממשלה מודיעה על הסכמתה? ← בהודעה בכתב של מזכיר הממשלה או על ידי שר/סגן שר במליאה (תקנון הכנסת 93(ה)).',
    'הסתייגות תקציבית ← דורשת היעדר הסכמת ממשלה ← הסכמה מבטלת את אופייה התקציבי.',
    '["חוק יסוד: משק המדינה, סעיף 3ג(ד)", "תקנון הכנסת, סעיף 93(ד)(1)", "תקנון הכנסת, סעיף 93(ה)", "נבו - המתמחה, חוקי יסוד (2026), פרק א - חוק-יסוד: משק המדינה"]'::jsonb
  );

  INSERT INTO public.angle_questions (
    id, source_question_id, angle_letter, angle_title, display_order, question_text,
    legal_topic_analysis, full_explanation, common_pitfall, concepts_and_skills,
    quick_thinking_360, summary_for_memory, references_list
  ) VALUES (
    v_ang_d, v_sq_id, 'ד', 'סדרי דיון בהסתייגויות רבות', 4, 'במהלך הכנת הצעת חוק לקריאה שנייה ושלישית בוועדת הכנסת, הוגשו אלפי הסתייגויות. מהן האפשרויות העומדות בפני הוועדה לניהול הדיון וההצבעה על הסתייגויות אלו?',
    'שאלה זו עוסקת בסדרי הדיון וההצבעה על הסתייגויות בהליכי חקיקה בכנסת, ובפרט במקרים של ריבוי הסתייגויות. היא מדגישה את הצורך לאזן בין זכותם של חברי הכנסת להגיש הסתייגויות לבין היעילות של הליך החקיקה, באמצעות קביעת סדרי דיון מיוחדים.',
    'תקנון הכנסת קובע את סדרי הדיון וההצבעה על הסתייגויות בהליכי חקיקה. במקרים של ריבוי חריג של הסתייגויות, הכנסת, באמצעות ועדותיה (כגון ועדת הכנסת או הוועדה המסדרת), רשאית לקבוע סדרי דיון מיוחדים. סעיף 98 לתקנון הכנסת מאפשר לוועדת הכנסת לקבוע סדרי דיון מיוחדים ביחס לחוקי תקציב ו''במקרים אחרים יוצאים מן הכלל'', לרבות קביעת מסגרת הדיון וזמני הדיבור במליאה. נוהל ההסתייגויות של היועצת המשפטית לכנסת אף הוא מתייחס למצבים אלו, ומציע אפשרויות כגון הנמקה מרוכזת של הסתייגויות והצבעה במקבצים, או הגבלת מספר ההצבעות השמיות. זאת, כדי לאפשר את המשך הליכי החקיקה תוך שמירה על זכות ההשתתפות הפרלמנטרית. בג"ץ 5658/23 התנועה למען איכות השלטון בישראל נ'' הכנסת (01.01.2024)בג"ץ 5658/23 התנועה למען איכות השלטון בישראל נ'' הכנסת (01.01.2024)בג"ץ 8948/22 אילן שיינפלד נ'' הכנסת (18.01.2023)בג"ץ 3234/15 מפלגת יש עתיד בראשות יאיר לפיד נ'' יו"ר הכנסת (09.07.2015)תקנון הכנסת, סעיף 90(ה)',
    'טעות נפוצה היא לחשוב שכל הסתייגות חייבת לקבל יחס פרטני מלא, מבלי להכיר את הגמישות הקיימת בסדרי הדיון בכנסת להתמודדות עם כמויות גדולות של הסתייגויות.',
    '["הסתייגויות", "הליכי חקיקה", "תקנון הכנסת", "סדרי דיון מיוחדים", "הנמקה מרוכזת", "הצבעה במקבצים", "זכות ההשתתפות הפרלמנטרית"]'::jsonb,
    '**וריאציה 1 — ריבוי הסתייגויות:** מה קורה כשיש אלפי הסתייגויות? ← הוועדה רשאית לקבוע סדרי דיון מיוחדים (בג"ץ 5658/23 התנועה למען איכות השלטון). **וריאציה 2 — סדרי דיון לדוגמה:** אילו סדרי דיון מיוחדים ניתן לקבוע? ← הנמקה מרוכזת, הצבעה במקבצים, הגבלת הצבעות שמיות (בג"ץ 5658/23 התנועה למען איכות השלטון, בג"ץ 3234/15 מפלגת יש עתיד). **וריאציה 3 — בסיס סמכות:** מהו הבסיס לסמכות לקבוע סדרי דיון מיוחדים? ← סעיף 98 לתקנון הכנסת, המאפשר זאת במקרים יוצאי דופן (בג"ץ 5658/23 התנועה למען איכות השלטון).',
    'אלפי הסתייגויות ← סדרי דיון מיוחדים ← הנמקה מרוכזת והצבעה במקבצים.',
    '["בג\"ץ 5658/23 התנועה למען איכות השלטון בישראל נ'' הכנסת (01.01.2024)", "בג\"ץ 8948/22 אילן שיינפלד נ'' הכנסת (18.01.2023)", "בג\"ץ 3234/15 מפלגת יש עתיד בראשות יאיר לפיד נ'' יו\"ר הכנסת (09.07.2015)", "תקנון הכנסת, סעיף 90(ה)"]'::jsonb
  );

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'א', 'רוב רגיל של חברי הכנסת בכל שלוש הקריאות.', false, 'תשובה זו שגויה. שינוי סעיף 4 לחוק יסוד: הכנסת דורש רוב מיוחד של 61 חברי כנסת, ולא רוב רגיל.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ב', 'רוב של 61 חברי הכנסת לפחות בכל שלוש הקריאות.', true, 'זו התשובה הנכונה. סעיף 46 לחוק יסוד: הכנסת קובע כי הרוב הדרוש לשינוי סעיף 4 (בין היתר) הוא רוב של חברי הכנסת (61) בכל שלוש הקריאות.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ג', 'רוב של 50 חברי הכנסת לפחות בקריאה השנייה והשלישית בלבד.', false, 'תשובה זו שגויה. רוב של 50 חברי כנסת רלוונטי להצעות חוק תקציביות, ושינוי סעיף 4 לחוק יסוד: הכנסת דורש רוב של 61 חברי כנסת בכל הקריאות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_a, 'ד', 'רוב של שני שליש מחברי הכנסת לפחות בקריאה השלישית בלבד.', false, 'תשובה זו שגויה. רוב של שני שליש אינו הרוב הנדרש לשינוי סעיף 4 לחוק יסוד: הכנסת, והרוב המיוחד נדרש בכל שלוש הקריאות.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'א', 'הוגשה שלא בידי הממשלה, בביצועה כרוכה עלות תקציבית של 7.2 מיליון ש"ח או יותר, והממשלה לא נתנה את הסכמתה לעלות התקציבית.', false, 'תשובה זו שגויה. התנאי ''הוגשה שלא בידי הממשלה'' רלוונטי להצעת חוק תקציבית, אך לא להסתייגות תקציבית, שיכולה להיות מוגשת גם על ידי הממשלה.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ב', 'בביצועה כרוכה עלות תקציבית של 7.2 מיליון ש"ח או יותר בשנת תקציב כלשהי, והממשלה לא נתנה את הסכמתה לעלות התקציבית.', true, 'זו התשובה הנכונה. סעיף 3ג(ד) לחוק יסוד: משק המדינה מגדיר ''הסתייגות תקציבית'' כהסתייגות שמתקיימים בה שני תנאים מצטברים אלו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ג', 'בביצועה כרוכה עלות תקציבית של 2 מיליון ש"ח או יותר, והיא הוגשה על ידי חבר כנסת מהאופוזיציה.', false, 'תשובה זו שגויה. סכום העלות התקציבית המינימלי הוא 7.2 מיליון ש"ח, ולא 2 מיליון ש"ח, וזהות המגיש אינה תנאי להגדרה.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_b, 'ד', 'היא משנה את סדרי העדיפויות התקציביים של הממשלה, ודורשת אישור של ועדת הכספים.', false, 'תשובה זו שגויה. אף שהסתייגות תקציבית אכן משנה סדרי עדיפויות ודורשת אישור ועדת כספים, אלו אינם התנאים המצטברים להגדרתה בחוק יסוד: משק המדינה.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'א', 'כן, שכן העלות התקציבית עולה על הסכום הקבוע בחוק, ולכן היא תמיד תיחשב הסתייגות תקציבית.', false, 'תשובה זו שגויה. אף שהעלות עולה על הסכום הקבוע, תנאי נוסף להגדרת הסתייגות תקציבית הוא שהממשלה לא נתנה את הסכמתה לעלות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ב', 'לא, שכן אחד התנאים המצטברים להגדרת ''הסתייגות תקציבית'' הוא שהממשלה לא נתנה את הסכמתה לעלות התקציבית.', true, 'זו התשובה הנכונה. סעיף 3ג(ד) לחוק יסוד: משק המדינה קובע במפורש כי הסתייגות תיחשב תקציבית רק אם הממשלה לא נתנה את הסכמתה לעלות התקציבית. במקרה של הסכמה, היא אינה נחשבת כזו.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ג', 'כן, אלא אם כן ועדת הכספים של הכנסת אישרה את הסכמת הממשלה ברוב מיוחד.', false, 'תשובה זו שגויה. הסכמת הממשלה עצמה היא הקובעת, ואינה דורשת אישור נוסף של ועדת הכספים ברוב מיוחד כדי לבטל את אופי ההסתייגות התקציבית.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_c, 'ד', 'לא, אך רק אם הסתייגות זו הוגשה על ידי חבר כנסת מהקואליציה.', false, 'תשובה זו שגויה. זהות מגיש ההסתייגות אינה רלוונטית להגדרת ''הסתייגות תקציבית'', אלא רק התנאים המפורטים בסעיף 3ג(ד) לחוק יסוד: משק המדינה.', 4);

  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'א', 'הוועדה חייבת לדון ולהצביע על כל הסתייגות בנפרד, ללא אפשרות לקיצורי דרך, כדי לשמור על זכות ההשתתפות הפרלמנטרית.', false, 'תשובה זו שגויה. במקרים של אלפי הסתייגויות, הכנסת נוקטת בסדרי דיון מיוחדים כדי לאפשר את המשך הליכי החקיקה, תוך איזון עם זכות ההשתתפות.', 1);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ב', 'הוועדה רשאית לקבוע סדרי דיון מיוחדים, כגון הנמקה מרוכזת של הסתייגויות והצבעה במקבצים, או להגביל את מספר ההצבעות השמיות במליאה.', true, 'זו התשובה הנכונה. הפסיקה והנוהל בכנסת מכירים באפשרות לקבוע סדרי דיון מיוחדים במקרים של ריבוי הסתייגויות, כדי לאפשר את המשך הליכי החקיקה.', 2);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ג', 'הוועדה רשאית לדחות את כל ההסתייגויות על הסף אם הן מוגשות בכמות חריגה, בטענה של שימוש לרעה בהליכי חקיקה.', false, 'תשובה זו שגויה. דחייה גורפת של כל ההסתייגויות על הסף אינה הדרך המקובלת, אלא קביעת סדרי דיון שיאפשרו התמודדות עם הכמות.', 3);
  INSERT INTO public.angle_choices (angle_question_id, letter, choice_text, is_correct, distractor_analysis, display_order) VALUES (v_ang_d, 'ד', 'הדיון בהצעת החוק יופסק עד שיושג הסכם בין הקואליציה לאופוזיציה על אופן הטיפול בהסתייגויות.', false, 'תשובה זו שגויה. אף שרצוי להגיע להסכמות, הפסקת הדיון אינה חובה, והוועדה רשאית לקבוע סדרי דיון גם ללא הסכמה.', 4);

END $$;
