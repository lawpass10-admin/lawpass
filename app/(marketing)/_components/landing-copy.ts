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

/** Hero eyebrow above the headline. */
export const HERO_EYEBROW = "שיטת ה-360° של ד״ר שרון נאור";

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
