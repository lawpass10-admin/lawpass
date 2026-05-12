/**
 * Hebrew date formatter helpers. Slice 2 Phase 5 only needs the short
 * "{day} ב{month_abbr}" form for the bookmarks/mistakes list rows
 * (e.g., `4 באפר'`). Kept dependency-free — Intl.DateTimeFormat with
 * `he-IL` returns the full month name, not the apostrophe-abbreviated
 * forms that match the prototype.
 */

const HEBREW_MONTHS_ABBR = [
  "ינו'",
  "פבר'",
  "מרץ",
  "אפר'",
  "מאי",
  "יוני",
  "יולי",
  "אוג'",
  "ספט'",
  "אוק'",
  "נוב'",
  "דצמ'",
] as const;

/**
 * "{day} ב{month_abbr}", e.g. `4 באפר'`. Returns `""` for missing /
 * unparseable inputs so the caller can decide whether to hide the
 * date column entirely.
 */
export function formatHebrewDateShort(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = HEBREW_MONTHS_ABBR[d.getMonth()];
  return `${day} ב${month}`;
}
