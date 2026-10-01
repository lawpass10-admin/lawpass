/**
 * The quality-control NDA, as one source of truth.
 *
 * WHY IT LIVES IN CODE. The agreement is shown in a dialog during registration,
 * its acceptance is recorded against a VERSION, and the same text has to be
 * reproducible later for a PDF copy and for the re-acceptance flow when it
 * changes. Three copies of a legal text drift; one does not. The .docx the
 * founder wrote is the drafting artefact, this is what the product shows.
 *
 * VERSION IS LOAD-BEARING. `profiles.nda_version` records which text a user
 * accepted. When the wording changes, bump NDA_VERSION — do not edit a released
 * version in place, or the recorded acceptance stops meaning anything. The
 * appendix to the agreement requires that a change forces re-acceptance on the
 * next sign-in; that flow reads this constant.
 *
 * Source: LawPass_NDA_בקרת_איכות_v2.docx, גרסה 1.0, אוקטובר 2026.
 */

export const NDA_VERSION = "1.0";

export const NDA_TITLE = "הסכם שמירת סודיות למשתתפי בקרת איכות";

export const NDA_SUBTITLE = "גרסת טרום-השקה | גרסה 1.0 | אוקטובר 2026";

/**
 * The three lines the agreement requires ABOVE the checkbox, before anyone
 * ticks anything. Verbatim from the appendix — they are the summary the
 * drafter chose, not a paraphrase of it.
 */
export const NDA_SUMMARY = [
  "קיבלת גישה חינמית לפלטפורמה במסגרת בקרת איכות לפני השקה.",
  "התכנים סודיים: אין להעתיק, לצלם, להעביר או להזין לכלי AI.",
  "אין למסור מידע לגורמים העוסקים בקורסי הכנה לבחינת הלשכה.",
] as const;

export type NdaSection = { heading: string; paragraphs: string[] };

/** The operative agreement — clauses 1 to 9. The developer appendix in the
 *  .docx is internal and deliberately not here. */
export const NDA_SECTIONS: NdaSection[] = [
  {
    heading: "",
    paragraphs: [
      'הסכם זה נערך בינך ("המשתתף") לבין בעלי פלטפורמת "LawPass" (law-pass.com). סימון תיבת האישור באתר ולחיצה על "המשך" הם חתימה על ההסכם, ויש להם תוקף מחייב כמו חתימה בכתב יד.',
      "הפנייה בלשון זכר נועדה לנוחות הקריאה בלבד ומתייחסת לכל המגדרים.",
    ],
  },
  {
    heading: "1. הגישה שקיבלת",
    paragraphs: [
      "1.1 קיבלת הרשאה אישית להשתמש בפלטפורמת LawPass במסגרת תוכנית בקרת איכות, לפני ההשקה המסחרית שלה.",
      "1.2 הגישה ניתנת לך בחינם, ללא כל תשלום וללא התחייבות כספית מצדך.",
      "1.3 ההרשאה אישית ואינה ניתנת להעברה. LawPass והיזם רשאים להגביל אותה או להפסיק אותה בכל עת וללא מתן הסבר.",
    ],
  },
  {
    heading: "2. גרסה בבדיקה",
    paragraphs: [
      "הפלטפורמה ותכניה נמצאים בשלבי בדיקה, וייתכנו בהם טעויות או אי-דיוקים. התכנים אינם ייעוץ משפטי ואינם מחליפים את חומרי הלימוד הרשמיים, והשימוש בהם לצורך ההכנה לבחינה הוא באחריותך.",
    ],
  },
  {
    heading: "3. מה נחשב מידע סודי",
    paragraphs: [
      '3.1 כל מה שנחשף אליך בפלטפורמה או בקשר אליה, לרבות: שאלות, תשובות, הסברים, סיכומים ומבנה התכנים; שיטת "חשיבה 360°"; ממשק המשתמש, הפיצ\'רים ואופן פעולת המערכת; ומידע על תוכניות ההשקה והמודל העסקי.',
      "3.2 לא ייחשב סודי מידע שהיה פומבי, או שהפך לפומבי שלא באשמתך, או שהיה ידוע לך כדין לפני שנחשפת אליו בפלטפורמה.",
      "3.3 חקיקה ופסיקה כשלעצמן אינן סודיות. הסודיות חלה על האופן שבו LawPass ערכה, ניסחה, ארגנה והציגה אותן.",
    ],
  },
  {
    heading: "4. ההתחייבויות שלך",
    paragraphs: [
      "במהלך ההשתתפות ולאחריה, אתה מתחייב:",
      "א. לשמור את המידע הסודי בסודיות ולהשתמש בו ללימוד האישי שלך בלבד.",
      "ב. לא להעתיק, לצלם מסך, להקליט, להוריד, להדפיס או לשמור תכנים מהפלטפורמה.",
      "ג. לא לייצר מהתכנים חומר נגזר לשימוש של אחרים, כגון סיכומים להפצה, מאגרי שאלות, קורסים או מוצר מתחרה.",
      "ד. לא להעביר, למסור או לחשוף מידע סודי לאדם אחר, ובפרט לא לגורם העוסק, או המתכוון לעסוק, בקורסים או בפלטפורמות הכנה לבחינת ההסמכה של לשכת עורכי הדין.",
      "ה. לא להזין תכנים מהפלטפורמה לכלי בינה מלאכותית (כגון ChatGPT, Claude, Gemini, Copilot ואחרים) או לכל כלי דומה, לשירותי תרגום או תמלול, או לשירות ענן של צד שלישי.",
      "ו. לא לשתף את פרטי ההתחברות שלך ולא לאפשר לאחר להשתמש בחשבונך.",
      "ז. לא לעקוף מנגנוני אבטחה ולא לנסות לחלץ תכנים באמצעים אוטומטיים (סקרייפינג, בוטים וכדומה).",
    ],
  },
  {
    heading: "5. משוב",
    paragraphs: [
      "נשמח לקבל ממך הערות, הצעות ודיווחי תקלות. משוב שתמסור יהיה שייך ל-LawPass, והיא רשאית להשתמש בו ללא תמורה. אין בכך כדי לפגוע בידע ובניסיון המקצועי הכללי שלך.",
    ],
  },
  {
    heading: "6. קניין רוחני",
    paragraphs: [
      "כל הזכויות בפלטפורמה ובתכניה שייכות ל-LawPass וליזם. הגישה אינה מקנה לך זכות כלשהי מלבד השימוש האישי המותר לפי הסכם זה.",
    ],
  },
  {
    heading: "7. תוקף וסיום",
    paragraphs: [
      "ההתחייבויות לפי הסכם זה חלות מרגע האישור ולמשך 3 שנים ממועד סיום הגישה שלך לפלטפורמה. עם סיום הגישה, או לפי דרישת LawPass, תמחק כל חומר מהפלטפורמה שנשאר בידיך.",
    ],
  },
  {
    heading: "8. הפרה",
    paragraphs: [
      "הפרה של הסכם זה תביא לחסימה מיידית של הגישה. בנוסף, LawPass תהיה רשאית לפעול לפי דין, לרבות בבקשה לצו מניעה ובתביעת פיצוי על הנזק שנגרם לה.",
    ],
  },
  {
    heading: "9. כללי",
    paragraphs: [
      "9.1 על ההסכם חלים דיני מדינת ישראל, וסמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים במחוז תל אביב-יפו.",
      "9.2 ההסכם אינו יוצר יחסי עבודה, שותפות או התחייבות להתקשרות עתידית.",
      "9.3 LawPass רשאית להמחות את זכויותיה לפי ההסכם לחברה שבשליטת מייסדה.",
      "9.4 הודעות יישלחו לכתובת הדואר האלקטרוני הרשומה בחשבונך.",
    ],
  },
];

/**
 * The LLM disclaimer, shown on the registration form itself rather than only
 * inside the agreement.
 *
 * It restates clause 2 in one line, at the point of decision. The founder's
 * wording was "הפלטפורמה מבוססת על טכנולוגיית LLM עלולות לטעות חומרי לימוד
 * ותוכן"; the subject and verb did not agree, so it is phrased here as the
 * sentence it was meant to be. The meaning is unchanged.
 */
export const LLM_DISCLAIMER =
  "הפלטפורמה מבוססת על טכנולוגיית LLM — חומרי הלימוד והתוכן עלולים לכלול טעויות.";
