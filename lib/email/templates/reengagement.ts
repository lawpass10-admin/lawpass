/**
 * "We haven't seen you in a while" — the re-engagement nudge.
 *
 * ── Hebrew is gendered, and the database knows the gender ──────────────────
 * `אינך משתמש` is what you write to a man and `אינך משתמשת` to a woman; there
 * is no correct neutral form of that verb. profiles.gender is collected at
 * signup, so we can get it right instead of guessing — and where it is 'other'
 * or 'prefer_not_to_say' the copy switches to a construction that happens to
 * be spelled identically for both (`לא נכנסת`), which sidesteps the problem
 * rather than picking a side.
 *
 * Getting this wrong is not cosmetic. An email that addresses a woman in the
 * masculine reads as machine-generated, in a product she is paying for.
 */

// Relative, not "@/lib/email/layout". The alias is a Next.js bundler feature:
// it does not resolve under plain Node, which breaks scripts that render a
// template outside the app, and it would not resolve at all once this module
// moves to lawpass_server. Imports WITHIN lib/email stay relative so the
// directory is genuinely self-contained; call sites outside it still use "@/".
import { renderEmail } from "../layout";

/** Mirrors profiles.gender's CHECK constraint. */
export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export type ReengagementInput = {
  /** profiles.full_name — only the first name is used. */
  fullName: string;
  gender?: Gender | string | null;
  /** Absolute URL that takes them back into the app. */
  loginUrl: string;
  /** Absolute one-click opt-out URL. Required — this is lifecycle mail. */
  unsubscribeUrl: string;
};

/**
 * "ישראל ישראלי" → "ישראל".
 *
 * A full legal name in a greeting sounds like a letter from the tax authority.
 * Falls back to the whole string when there is only one word, and to a neutral
 * greeting when the name is empty — which happens, because full_name is only
 * as good as what someone typed at signup.
 */
export function firstName(fullName: string): string {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

/** The one gendered sentence, in its three forms. */
function inactivityLine(gender: ReengagementInput["gender"]): string {
  switch (gender) {
    case "male":
      return "אנחנו רואים שזמן רב אינך משתמש במערכת.";
    case "female":
      return "אנחנו רואים שזמן רב אינך משתמשת במערכת.";
    default:
      // Written without vowel points, נכנסת is identical in both genders.
      return "אנחנו רואים שזמן רב לא נכנסת למערכת.";
  }
}

/**
 * Builds the subject and HTML body.
 *
 * Returns them together because they are written together — a subject line
 * that promises something the body does not deliver is how a sender teaches
 * people to ignore it.
 */
export function buildReengagementEmail(input: ReengagementInput): {
  subject: string;
  html: string;
} {
  const name = firstName(input.fullName);
  const greeting = name ? `${name}, ` : "";

  // No name in the subject: personalised subject lines are a spam-filter
  // signal when the sender has no reputation yet, and this one reads fine
  // without it.
  const subject = "לא ראינו אותך לאחרונה — ההתקדמות שלך ממתינה";

  const html = renderEmail({
    heading: `${greeting}מזמן לא התראינו`,
    preheader: "כל ההתקדמות שלך שמורה וממתינה לך במקום שבו עצרת",
    paragraphs: [
      `${greeting}${inactivityLine(input.gender)}`,
      "כל ההתקדמות שלך שמורה — המבחנים שפתרת, הציונים, והסטטיסטיקה האישית ממתינים לך בדיוק במקום שבו עצרת.",
      "חזרה לתרגול קבוע היא הדרך היעילה ביותר להתכונן לבחינת הלשכה. גם עשרים דקות היום מקדמות אותך.",
    ],
    cta: { label: "חזרה לתרגול", url: input.loginUrl },
    unsubscribeUrl: input.unsubscribeUrl,
  });

  return { subject, html };
}
