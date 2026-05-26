-- Substantive-law taxonomy: track column on chapters + 9 new chapters + 68 subtopics.
--
-- Additive only: the ONLY UPDATE here is backfilling track='procedural' on
-- the 6 existing chapters. No edits/deletes/reorders on existing rows; no
-- changes to source_questions, angle_questions, or any other table.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, NOT-NULL guarded by re-runnable
-- ALTER, CHECK constraint guarded by pg_constraint lookup, INSERT...ON
-- CONFLICT DO NOTHING for both chapters and subtopics. Safe to apply
-- multiple times.

-- ============================================================
-- Step 1 — `track` column on chapters
-- ============================================================

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS track text;

-- Backfill the 6 original procedural chapters by code. Explicit code
-- list (rather than "WHERE track IS NULL") so a partially-failed prior
-- run can never flip a substantive row to procedural by accident.
UPDATE public.chapters
SET track = 'procedural'
WHERE code IN (
  'civil_proc',
  'criminal_proc',
  'evidence',
  'execution',
  'insolvency_arbitration',
  'constitutional_intl'
)
AND track IS NULL;

-- Set NOT NULL after backfill so existing rows pass. Substantive INSERTs
-- below specify track explicitly so they cannot trip this either.
ALTER TABLE public.chapters
  ALTER COLUMN track SET NOT NULL;

-- CHECK constraint. Guard with a pg_constraint lookup so a re-run does
-- not error on duplicate constraint creation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chapters_track_check'
      AND conrelid = 'public.chapters'::regclass
  ) THEN
    ALTER TABLE public.chapters
      ADD CONSTRAINT chapters_track_check
      CHECK (track IN ('procedural', 'substantive'));
  END IF;
END
$$;

-- ============================================================
-- Step 2 — 9 substantive chapters
-- ============================================================

INSERT INTO public.chapters (code, title, display_order, track) VALUES
  ('contracts',            'דיני חוזים וחיובים', 7,  'substantive'),
  ('property',             'דיני קניין',         8,  'substantive'),
  ('criminal_substantive', 'דיני עונשין',        9,  'substantive'),
  ('corporate',            'דיני תאגידים',       10, 'substantive'),
  ('labor',                'דיני עבודה',         11, 'substantive'),
  ('family_inheritance',   'דיני משפחה וירושה',  12, 'substantive'),
  ('administrative',       'משפט מנהלי',         13, 'substantive'),
  ('tax',                  'דיני מסים',          14, 'substantive'),
  ('ethics',               'אתיקה מקצועית',      15, 'substantive')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Step 3 — 68 substantive subtopics
-- ============================================================
--
-- One INSERT...SELECT joining a VALUES list against chapters.code so we
-- don't have to hardcode chapter UUIDs. ON CONFLICT (chapter_id, code)
-- DO NOTHING covers the UNIQUE(chapter_id, code) index from migration
-- 0004; the UNIQUE(chapter_id, title) index would still fire if a title
-- collision sneaks in, which is the right failure mode (loud, not
-- silent) — we don't expect that here since no existing subtopic uses
-- any of the new substantive titles.

INSERT INTO public.subtopics (chapter_id, code, title, display_order)
SELECT c.id, v.code, v.title, v.display_order
FROM (VALUES
  -- contracts (14)
  ('contracts', 'general_part',          'חלק כללי',                    1),
  ('contracts', 'breach_remedies',       'תרופות בשל הפרת חוזה',         2),
  ('contracts', 'standard_contracts',    'חוזים אחידים',                3),
  ('contracts', 'insurance_contract',    'חוזה ביטוח',                  4),
  ('contracts', 'construction_contract', 'חוזה קבלנות',                 5),
  ('contracts', 'sale',                  'מכר',                         6),
  ('contracts', 'gift',                  'מתנה',                        7),
  ('contracts', 'lease_bailment',        'שכירות ושאילה',               8),
  ('contracts', 'guarantee',             'ערבות',                       9),
  ('contracts', 'agency',                'שליחות',                      10),
  ('contracts', 'unjust_enrichment',     'עשיית עושר ולא במשפט',         11),
  ('contracts', 'limitation',            'התיישנות',                    12),
  ('contracts', 'legal_foundations',     'יסודות המשפט',                13),
  ('contracts', 'interpretation',        'פרשנות',                      14),

  -- property (7)
  ('property', 'real_estate',             'מקרקעין',                     1),
  ('property', 'condominiums',            'בתים משותפים',                2),
  ('property', 'pledge',                  'משכון',                       3),
  ('property', 'mortgages_housing_loans', 'משכנתאות והלוואות לדיור',     4),
  ('property', 'chattels_lost_found',     'מיטלטלין, אבדה ומציאה',        5),
  ('property', 'real_estate_taxation',    'מיסוי מקרקעין',               6),
  ('property', 'land_rights_settlement',  'הסדר זכויות במקרקעין',         7),

  -- criminal_substantive (8)
  ('criminal_substantive', 'general_part_elements',   'חלק כללי — יסודות העבירה וסייגים', 1),
  ('criminal_substantive', 'sentencing',              'ענישה',                            2),
  ('criminal_substantive', 'bodily_harm_offenses',    'עבירות פגיעה בגוף ובחיים',          3),
  ('criminal_substantive', 'sex_offenses',            'עבירות מין',                       4),
  ('criminal_substantive', 'property_fraud_offenses', 'עבירות רכוש ומרמה',                 5),
  ('criminal_substantive', 'drug_offenses',           'עבירות סמים',                      6),
  ('criminal_substantive', 'money_laundering_terror', 'איסור הלבנת הון ומימון טרור',        7),
  ('criminal_substantive', 'domestic_violence',       'אלימות במשפחה',                    8),

  -- corporate (9)
  ('corporate', 'companies_formation',           'חברות — הקמה ואורגנים',                    1),
  ('corporate', 'fiduciary_duties',              'חובות אמונים וזהירות של נושאי משרה',         2),
  ('corporate', 'piercing_veil',                 'הרמת מסך',                                3),
  ('corporate', 'derivative_class_action',       'תובענה נגזרת וייצוגית',                     4),
  ('corporate', 'interested_party_transactions', 'עסקאות בעלי עניין',                        5),
  ('corporate', 'partnerships',                  'שותפויות',                                6),
  ('corporate', 'nonprofits',                    'עמותות',                                  7),
  ('corporate', 'public_benefit_companies',      'חברות לתועלת הציבור',                      8),
  ('corporate', 'securities_disclosure',         'ניירות ערך וגילוי',                        9),

  -- labor (9)
  ('labor', 'employment_dismissal_severance', 'חוזה עבודה, פיטורין ופיצויי פיטורים', 1),
  ('labor', 'wages_protection',               'שכר והגנת השכר',                    2),
  ('labor', 'hours_rest_leave',               'שעות עבודה, מנוחה וחופשות',          3),
  ('labor', 'equality_anti_discrimination',   'שוויון ואיסור הפליה',                4),
  ('labor', 'workplace_harassment',           'הטרדה מינית בעבודה',                5),
  ('labor', 'women_parenting_employment',     'עבודת נשים והורות',                 6),
  ('labor', 'collective_disputes',            'הסכמים קיבוציים וסכסוכי עבודה',       7),
  ('labor', 'social_security',                'ביטחון סוציאלי',                    8),
  ('labor', 'foreign_workers',                'עובדים זרים',                      9),

  -- family_inheritance (7)
  ('family_inheritance', 'marriage_divorce',            'נישואין וגירושין',          1),
  ('family_inheritance', 'spousal_property',            'יחסי ממון בין בני זוג',     2),
  ('family_inheritance', 'alimony_support',             'מזונות',                   3),
  ('family_inheritance', 'legal_capacity_guardianship', 'כשרות משפטית ואפוטרופסות',  4),
  ('family_inheritance', 'adoption',                    'אימוץ',                    5),
  ('family_inheritance', 'prenup_cohabitation',         'הסכם ממון וידועים בציבור',  6),
  ('family_inheritance', 'inheritance_will',            'ירושה וצוואה',             7),

  -- administrative (5)
  ('administrative', 'administrative_authority_discretion', 'סמכות מנהלית ושיקול דעת',       1),
  ('administrative', 'reasonableness_proportionality',      'סבירות, מידתיות ותקינות מנהלית', 2),
  ('administrative', 'freedom_of_information',              'חופש המידע',                    3),
  ('administrative', 'tenders',                             'מכרזים',                       4),
  ('administrative', 'planning_building',                   'תכנון ובנייה',                  5),

  -- tax (5)
  ('tax', 'income_tax',            'מס הכנסה',          1),
  ('tax', 'vat',                   'מס ערך מוסף',       2),
  ('tax', 'real_estate_tax',       'מיסוי מקרקעין',     3),
  ('tax', 'customs',               'מכס',               4),
  ('tax', 'tax_offenses_planning', 'עבירות מס ותכנון מס', 5),

  -- ethics (4)
  ('ethics', 'licensing_bar_membership',      'ייחוד המקצוע, רישוי וחברות בלשכה',     1),
  ('ethics', 'fiduciary_privilege_conflict',  'חובות נאמנות, חיסיון וניגוד עניינים',  2),
  ('ethics', 'fees_client_funds_advertising', 'שכר טרחה, כספי לקוח ופרסום',          3),
  ('ethics', 'disciplinary_law',              'דין משמעתי',                         4)
) AS v(chapter_code, code, title, display_order)
JOIN public.chapters c ON c.code = v.chapter_code
ON CONFLICT (chapter_id, code) DO NOTHING;
