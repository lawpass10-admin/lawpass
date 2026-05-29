/**
 * Landing-page copy.
 *
 * Slice 16 / Phase L2-polish. Strings pulled verbatim from the
 * design prototype's `TWEAK_DEFAULTS` block in
 * `reference/app.jsx` (lines 4–13). Centralizing them here keeps
 * the JSX components readable and gives Sharon a single file to
 * scan when copy changes — see comment in landing-hero.tsx about
 * the eventual move to a fuller content store in Phase L5.
 */

/** Hero headline, line 1 (no emphasis). */
export const HERO_HEADLINE_A = "עוברים את מבחן הלשכה";

/** Hero headline, line 2 (gets the gold trailing dot). */
export const HERO_HEADLINE_B = "בפעם ראשונה";

/**
 * Typewriter loop — the four lines that cycle in the `<p className="sub">`
 * slot under the headline. Order matters: the typewriter cycles top-to-
 * bottom and then wraps. Each entry is one full sentence; the typewriter
 * adds the punctuation as it types, holds, then erases.
 */
export const HERO_TYPEWRITER_LINES = [
  "עם שיטת ה-360° של LawPass.",
  "ניתוח עומק לכל שאלה — לא רק תשובה.",
  "כל מסיח, כל מלכודת, כל רפרנס.",
  "כלי תרגול שעובר איתך לחדר הבחינה.",
] as const;

/** Default typing speed (ms per character) — matches the prototype. */
export const HERO_TYPEWRITER_SPEED_MS = 55;

/** Primary hero CTA label. L5 wires the href to /signup. */
export const HERO_CTA_LABEL = "התחילו לתרגל";

/* --------------------------------------------------------------
 * Method section
 * ------------------------------------------------------------ */

export const METHOD_EYEBROW = "השיטה";

/**
 * Each pillar drives one tile in the Method 6-column grid. `video`
 * is the path under public/ (Decision 8 — public/animations/landing/).
 * Order is meaningful: it's the numbered sequence (01–06) the
 * prototype renders.
 */
export type MethodPillar = {
  readonly title: string;
  readonly desc: string;
  readonly video: string;
};

export const METHOD_PILLARS: ReadonlyArray<MethodPillar> = [
  {
    title: "ניתוח הנושא המשפטי",
    desc: "רקע תיאורטי וקונטקסט רחב לכל שאלה — לא רק 'מה התשובה', אלא 'באיזה עולם משפטי אנחנו'.",
    video: "/animations/landing/balance.mp4",
  },
  {
    title: "הסבר משפטי מלא",
    desc: "למה התשובה הנכונה היא הנכונה — שלב אחר שלב, עם הפניות לחוק, תקנות ופסיקה.",
    video: "/animations/landing/legal-documents.mp4",
  },
  {
    title: "ניתוח מסיחים",
    desc: "כל אחת מהאפשרויות השגויות מקבלת הסבר משלה. למה היא נראית נכונה, ולמה היא לא.",
    video: "/animations/landing/flexibility.mp4",
  },
  {
    title: "מלכודות נפוצות",
    desc: "השגיאות שנבחנים נופלים בהן שוב ושוב — מתועדות, מסומנות ומנותחות.",
    video: "/animations/landing/warning.mp4",
  },
  {
    title: "חשיבה מהירה 360°",
    desc: "פרוטוקול מובנה לחשוב על שאלה תחת לחץ זמן — בלי לקפוא, בלי לנחש.",
    video: "/animations/landing/creativity.mp4",
  },
  {
    title: "מבט מסכם לזכירה",
    desc: "תקציר ויזואלי שנשאר איתך עד הבחינה, מותאם לאיך שהמוח שלך זוכר.",
    video: "/animations/landing/bookmark.mp4",
  },
] as const;

/* --------------------------------------------------------------
 * Plans section
 * ------------------------------------------------------------ */

export const PLANS_EYEBROW = "תוכניות מנוי";

/**
 * Per-plan landing-page copy (tag / feature bullets / CTA label).
 * Price + duration + recommended flag come from PLANS in
 * lib/billing/plans.ts so /pricing and the landing stay in sync.
 * Keyed by PlanId so the landing component can `LANDING_PLAN_COPY[plan.id]`
 * without prop drilling.
 */
export type LandingPlanCopy = {
  readonly tag: string;
  readonly subtitle: string;
  readonly features: ReadonlyArray<string>;
  readonly ctaLabel: string;
};

export const LANDING_PLAN_COPY: Record<"plan_3m" | "plan_6m", LandingPlanCopy> = {
  plan_3m: {
    tag: "תזוזה ראשונה",
    subtitle: "90 יום גישה מלאה",
    features: [
      "גישה מלאה למאגר השאלות",
      "Practice Mode עם 360° לכל שאלה",
      "סימולציית בחינה (40 שאלות / 100 דקות)",
      "שאלות שטעיתי בהן + סימוניות",
      "דשבורד התקדמות אישי",
    ],
    ctaLabel: "התחילו עם 3 חודשים",
  },
  plan_6m: {
    tag: "המסלול המומלץ",
    subtitle: "180 יום • החיסכון הכי טוב",
    features: [
      "כל מה שב-3 חודשים",
      "פי 2 זמן ללמוד לעומק",
      "גישה לכל עדכוני התוכן בתקופה",
      "התראות עונת בחינות",
      "תמיכה במייל בעדיפות גבוהה",
    ],
    ctaLabel: "אני רוצה 6 חודשים",
  },
} as const;

/**
 * AI plan — visual-only "coming soon" card. NOT in PLANS, never
 * granted, no real price (renders "בקרוב"). Kept here in copy so
 * the Plans component renders it inline next to the real plans
 * without touching lib/billing/plans.ts.
 */
export const COMING_SOON_PLAN = {
  tag: "בקרוב • בפיתוח",
  name: "6 חודשים + AI אישי",
  subtitle: "בוט חכם שילמד איתכם — בפיתוח",
  features: [
    "מסביר כל שאלה בשפה טבעית",
    "מזהה נקודות חולשה ובונה תוכנית חזרה",
    "התאמה אישית לקצב הלמידה שלך",
    "מעקב את ההתקדמות שלך לאורך זמן",
    "מתוכנן להשקה בגרסה הבאה",
  ],
  ctaLabel: "צוות הפיתוח שלנו עובד על זה",
} as const;

/* --------------------------------------------------------------
 * FAQ section
 * ------------------------------------------------------------ */

export const FAQ_EYEBROW = "שאלות נפוצות";

export type FaqItem = {
  readonly q: string;
  readonly a: string;
};

/**
 * Quote bubble next to the FAQ character — title + subtitle. Sharon
 * 2026-05-29 (post-deploy): the prior copy was too soft; new framing
 * leads with "הכל עניין של תרגול." as the headline and lets the
 * subtitle spell out the value (per-distractor analysis, traps,
 * references). Stored as two separate strings rather than a
 * `\n`-joined block so the JSX can apply distinct typography
 * (bigger/bolder title, smaller subtitle).
 */
export const FAQ_QUOTE_TITLE = "הכל עניין של תרגול.";
export const FAQ_QUOTE_SUBTITLE =
  "כל שאלה שכבר נשאלה, לפי נושא — עם הסבר לכל מסיח, מלכודת ורפרנס.";

export const FAQ_ITEMS: ReadonlyArray<FaqItem> = [
  {
    q: "מה זה שיטת ה-360°?",
    a: "השיטה הפדגוגית של LawPass: כל שאלת מקור מקבלת ניתוח עומק מלא — לא רק התשובה הנכונה, אלא הנושא המשפטי, ניתוח של כל אחד מהמסיחים, מלכודות נפוצות, פרוטוקול חשיבה מהירה, ורפרנסים לחוק ולפסיקה. בנוסף, לכל שאלת מקור מצורפות 5 שאלות זווית מאותו נושא — כל אחת עם 360° עצמאי.",
  },
  {
    q: "האם יש תקופת ניסיון חינם?",
    a: "לא. אנחנו מאמינים שגישה רצינית לבחינת הלשכה דורשת מחויבות מהיום הראשון. כל המסלולים נותנים ערך מלא מהרגע הראשון, ויש לנו מדיניות ביטולים הוגנת בשבועיים הראשונים.",
  },
  {
    q: "כמה שאלות יש במאגר?",
    a: "המאגר בהשקה כולל למעלה מ-1,200 שאלות (שאלות מקור + זוויות), ומתעדכן באופן שוטף. כל מנוי פעיל מקבל גישה לכל העדכונים בתקופת המנוי שלו ללא תוספת תשלום.",
  },
  {
    q: "האם המערכת מתאימה למי שניגש בפעם השנייה?",
    a: "כן. למעשה, מסלול Pro מתוכנן במיוחד עבור חוזרים על הבחינה — עם שיחת אבחון אישית שמזהה את נקודות החולשה הספציפיות, ותוכנית לימוד שמתמקדת בדיוק בהן.",
  },
  {
    q: "באילו מכשירים אפשר ללמוד?",
    a: "LawPass רץ על כל דפדפן מודרני — מחשב, טאבלט וסמארטפון. ההתקדמות שלכם מסתנכרנת אוטומטית בין המכשירים, כך שאפשר להתחיל סימולציה במחשב ולסיים אותה בנייד.",
  },
  {
    q: "איך מבטלים את המנוי?",
    a: "ניתן לבטל בכל עת מאזור המנוי האישי. במקרה של ביטול תוך 14 יום מהרכישה ולפני שימוש מהותי במערכת — מגיע החזר מלא. לאחר מכן, הביטול נכנס לתוקף בסוף תקופת המנוי הנוכחית.",
  },
] as const;
