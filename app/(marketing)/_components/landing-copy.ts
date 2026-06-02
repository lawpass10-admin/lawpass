/**
 * Slice 46 — landing copy strings.
 *
 * Single source of truth for all the landing page's Hebrew copy. Imported by
 * the section components. Keeping copy outside the JSX makes it easy to do a
 * single-file pass for tone/wording without touching layout.
 *
 * Replaces the Slice 16 / Phase L2-polish version. Numbers + terminology
 * locked decisions (per the Slice 46 brief):
 *   - Bank size: "מעל 1,000 שאלות" everywhere (live bank ~1,088).
 *   - NO "שאלת מקור" / "שאלת זווית" in user-facing copy.
 *   - Hero source-note corrected from "אלפי השאלות" → "מעל 1,000 השאלות".
 *   - FAQ Q3 corrected from "למעלה מ-1,200 שאלות" → "מעל 1,000 שאלות".
 */

import type { ReactNode } from "react";

export const headerCopy = {
  navLinks: [
    { href: "#method", label: "שיטת ה-360°" },
    { href: "#plans", label: "תוכניות מנוי" },
    { href: "#faq", label: "שאלות נפוצות" },
    { href: "#contact", label: "צרו קשר" },
  ],
  /** Slice 49 follow-up — PM-locked: during the private-testing phase the
   *  entire landing funnels exclusively to the waitlist, so the header CTA
   *  now routes to /early-access?source=header (was /login in Slice 46).
   *  Direct `/login` is still reachable by URL for testers. */
  ctaLabel: "כניסה לאזור אישי",
  ctaHref: "/early-access?source=header",
} as const;

export const cookieBarCopy = {
  text: "אתר זה משתמש בעוגיות (Cookies) לשיפור חוויית הגלישה והתאמת תכנים.",
  linkLabel: "מדיניות הפרטיות",
  // TODO(PM): wire to the real privacy page once it exists. Inert "#" today.
  linkHref: "#",
  closeLabel: "סגור",
} as const;

export const heroCopy = {
  headlineTop: "עוברים את מבחן הלשכה",
  headlineBottom: "בפעם ראשונה",
  /** Typewriter cycles through these on `<HeroTypewriter>`. */
  typewriterLines: [
    "עם שיטת ה-360° של LawPass.",
    "מאגר שאלות 360° + ניתוח מעמיק לכל שאלה.",
    "כל מסיח, כל מלכודת, כל רפרנס.",
    "כלי תרגול שיעזור להגיע מוכנים למבחן.",
  ],
  primaryCtaLabel: "התחילו לתרגל",
  primaryCtaHref: "/early-access?source=hero",
  secondaryCtaLabel: "איך זה עובד",
  secondaryCtaAriaLabel: "איך זה עובד - הסבר על שיטת LawPass",
  secondaryCtaHref: "#method",
  characterAlt: "ד״ר שרון נאור — שיטת ה-360° של LawPass",
} as const;

export const sourceNoteCopy = {
  ariaLabel: "מקורות וסימוכין במאגר",
  items: [
    {
      highlight: "כל מעל 1,000 השאלות במאגר",
      tail: " מבוססות על שאלות אמיתיות ממבחני לשכת עורכי הדין בשנים 2018–2024.",
    },
    {
      lead: "כל תשובה כוללת ",
      highlight: "סימוכין ממאגרי משפט",
      tail: " — עדכון לפי פסיקת בתי המשפט העליון וההלכה העכשווית.",
    },
  ],
} as const;

export const methodCopy = {
  headline: "שיטת חשיבה ",
  headlineGold: "360°",
  headlineTail: " - אל תלמדו את השאלה. תלמדו את החשיבה שמאחוריה.",
  lead: "זו לא רק הכנה למבחן הבא. זו בניית חשיבה משפטית שמאפשרת להתמודד עם כל שאלה שתופיע במבחן.",
  /** 6 pillars. Video file paths must exist in /public/animations/landing/. */
  pillars: [
    {
      num: "01",
      videoSrc: "/animations/landing/legal-documents.mp4",
      title: "ניתוח הנושא המשפטי",
      desc: "רקע תיאורטי וקונטקסט רחב לכל שאלה — לא רק 'מה התשובה', אלא 'באיזה עולם משפטי אנחנו'.",
    },
    {
      num: "02",
      videoSrc: "/animations/landing/balance.mp4",
      title: "הסבר משפטי מלא",
      desc: "למה התשובה הנכונה היא הנכונה — שלב אחר שלב, עם הפניות לחוק, תקנות ופסיקה.",
    },
    {
      num: "03",
      videoSrc: "/animations/landing/bookmark.mp4",
      title: "ניתוח מסיחים",
      desc: "כל אחת מהאפשרויות השגויות מקבלת הסבר משלה. למה היא נראית נכונה, ולמה היא לא.",
    },
    {
      num: "04",
      videoSrc: "/animations/landing/warning.mp4",
      title: "מלכודות נפוצות",
      desc: "השגיאות שנבחנים נופלים בהן שוב ושוב — מתועדות, מסומנות ומנותחות.",
    },
    {
      num: "05",
      videoSrc: "/animations/landing/creativity.mp4",
      title: "חשיבה 360°",
      desc: "מתודולוגיית למידה ייחודית המנתחת כל סוגיה משפטית ממספר זוויות באמצעות שאלות, תרחישים ווריאציות שונות, במטרה לפתח חשיבה אנליטית, הבנה מעמיקה וגמישות מחשבתית להתמודדות עם כל שאלה במבחן.",
    },
    {
      num: "06",
      videoSrc: "/animations/landing/flexibility.mp4",
      title: "מבט מסכם לזכירה",
      desc: "תקציר ויזואלי שנשאר איתך עד הבחינה, מותאם לאיך שהמוח שלך זוכר.",
    },
  ],
} as const;

export type PlanCopy = {
  /** "featured" gets the gold border + float animation; "comingSoon" is the
   *  disabled AI plan. */
  variant: "default" | "featured" | "comingSoon";
  badge?: string;
  badgeWithStar?: boolean;
  tag: string;
  tagWithBrainIcon?: boolean;
  name: string;
  priceCurrency?: string;
  priceAmount?: string;
  priceAmountTbd?: string;
  sub: string;
  features: string[];
  ctaLabel: string;
  /** Disabled plans render a <button> with no href. */
  ctaHref?: string;
};

export const plansCopy = {
  headline: "בחרו את הקצב ",
  headlineGold: "שלכם.",
  lead: 'כל מסלול נותן ערך מלא מהיום הראשון. כל המחירים כוללים מע"מ.',
  plans: [
    {
      variant: "default",
      tag: "תזוזה ראשונה",
      name: "3 חודשים",
      priceCurrency: "₪",
      priceAmount: "2,000",
      sub: "90 יום גישה מלאה",
      features: [
        "גישה מלאה למאגר השאלות",
        "Practice Mode עם 360° לכל שאלה",
        "סימולציות לחלק הדיוני והמהותי — עם טיימר נפרד לכל חלק",
        "שאלות שטעיתי בהן + סימוניות",
        "דשבורד התקדמות אישי",
      ],
      ctaLabel: "התחילו עם 3 חודשים",
      ctaHref: "/early-access?source=plan-3mo",
    },
    {
      variant: "featured",
      badge: "המומלץ",
      tag: "המסלול המומלץ",
      name: "6 חודשים",
      priceCurrency: "₪",
      priceAmount: "3,500",
      sub: "180 יום • החיסכון הכי טוב",
      features: [
        "כל מה שב-3 חודשים",
        "פי 2 זמן ללמוד לעומק",
        "גישה לכל עדכוני התוכן בתקופה",
        "התראות עונת בחינות",
        "תמיכה במייל בעדיפות גבוהה",
      ],
      ctaLabel: "אני רוצה 6 חודשים",
      ctaHref: "/early-access?source=plan-6mo",
    },
    {
      variant: "comingSoon",
      badge: "בקרוב",
      badgeWithStar: true,
      tag: "בקרוב • בפיתוח",
      tagWithBrainIcon: true,
      name: "6 חודשים + LawBot AI",
      priceAmountTbd: "בקרוב",
      sub: "בוט חכם שילמד איתכם — בפיתוח",
      features: [
        "מסביר כל שאלה בשפה טבעית",
        "מזהה נקודות חולשה ובונה תוכנית חזרה",
        "התאמה אישית לקצב הלמידה שלך",
        "מעקב את ההתקדמות שלך לאורך זמן",
        "מתוכנן להשקה בגרסה הבאה",
      ],
      ctaLabel: "צוות הפיתוח שלנו עובד על זה",
    },
  ] satisfies readonly PlanCopy[],
} as const;

export type FaqItemCopy = {
  question: string;
  /** ReactNode so an answer can include light formatting. Today all are
   *  plain strings. */
  answer: ReactNode;
};

export const faqCopy = {
  eyebrow: "שאלות נפוצות",
  headline: "כל מה שרציתם לדעת, ",
  headlineGold: "לפני שנכנסים.",
  characterAlt: "ד״ר שרון נאור",
  characterQuoteTitle: "הכל עניין של תרגול.",
  characterQuoteSubtitle:
    "כל שאלה שכבר נשאלה, לפי נושא — עם הסבר לכל מסיח, מלכודת ורפרנס.",
  items: [
    {
      question: "מה זה שיטת ה-360°?",
      answer:
        "חשיבה 360° של LawPass היא מתודולוגיית למידה שמלמדת את הנבחן להבין את ההיגיון המשפטי שמאחורי השאלה, ולא רק לשנן תשובות. כל שאלה מנותחת ממספר זוויות: מדוע התשובה הנכונה נכונה, מדוע כל מסיח שגוי, אילו עקרונות משפטיים עומדים בבסיס ההכרעה, וכיצד שינוי קטן בעובדות עשוי לשנות את התוצאה. המערכת מייצרת וריאציות של השאלה ומחברת בין נושאים משפטיים שונים כדי לפתח חשיבה אנליטית וגמישות מחשבתית — כך הנבחן בונה יכולת להתמודד גם עם שאלות חדשות ובלתי מוכרות במבחן, ולא רק עם שאלות שראה בעבר.",
    },
    {
      question: "האם יש תקופת ניסיון חינם?",
      answer:
        "לא. אנחנו מאמינים שגישה רצינית לבחינת הלשכה דורשת מחויבות מהיום הראשון. כל המסלולים נותנים ערך מלא כבר מהרגע הראשון.",
    },
    {
      question: "כמה שאלות יש במאגר?",
      // Slice 46 — corrected from "למעלה מ-1,200" → "מעל 1,000" per the
      // locked content decision (live bank ~1,088).
      answer:
        "המאגר בהשקה כולל מעל 1,000 שאלות, ומתעדכן באופן שוטף. כל מנוי פעיל מקבל גישה לכל העדכונים בתקופת המנוי שלו ללא תוספת תשלום.",
    },
    {
      question: "האם המערכת מתאימה למי שניגש בפעם השנייה?",
      answer:
        "כן. המערכת מתאימה במיוחד גם למי שחוזר על הבחינה — ניתוח ה-360° לכל שאלה ומעקב אחר השאלות שטעיתם בהן עוזרים לזהות בדיוק את נקודות החולשה ולחזק אותן לקראת המועד הבא.",
    },
    {
      question: "באילו מכשירים אפשר ללמוד?",
      answer:
        "LawPass רץ על כל דפדפן מודרני — מחשב, טאבלט וסמארטפון. ההתקדמות שלכם מסתנכרנת אוטומטית בין המכשירים, כך שאפשר להתחיל סימולציה במחשב ולסיים אותה בנייד.",
    },
  ] satisfies readonly FaqItemCopy[],
} as const;

export const footerCopy = {
  logoAlt: "LawPass",
  cols: [
    {
      heading: "המוצר",
      links: [
        { label: "שיטת ה-360°", href: "#method" },
        { label: "תוכניות מנוי", href: "#plans" },
        { label: "שאלות נפוצות", href: "#faq" },
      ],
    },
    {
      heading: "חשבון",
      links: [
        { label: "כניסה לאזור אישי", href: "/login" },
        // TODO(PM): wire to a real support page once it exists. Inert "#" today.
        { label: "תמיכה", href: "#" },
        // Slice 50 — `תקנון` (/terms) is deferred to a follow-up slice
        // once the תקנון file lands. Until then the slot carries the
        // accessibility declaration (/accessibility, חוק שוויון זכויות).
        { label: "הצהרת נגישות", href: "/accessibility" },
        { label: "מדיניות פרטיות", href: "/privacy" },
      ],
    },
    {
      heading: "צרו קשר",
      links: [
        // TODO(PM): confirm footer email. Placeholder mailto: until then.
        { label: "info@law-pass.com", href: "mailto:info@law-pass.com" },
        { label: "WhatsApp", href: "#" },
        { label: "טופס פנייה", href: "#" },
      ],
    },
  ],
  copyright: "© 2026 LawPass. כל הזכויות שמורות.",
  tagline: "נבנה בקפידה עבור סטאז'רים בישראל.",
} as const;
