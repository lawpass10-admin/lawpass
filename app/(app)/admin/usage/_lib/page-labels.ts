/**
 * Which SCREEN an endpoint belongs to, for the usage table's "עמוד" column.
 *
 * The path column answers "what was called"; an admin reading this page wants
 * "where from". `/api/custom-exam/pool` means nothing to someone who has not
 * read the router, and "שאלון מותאם אישית" means everything.
 *
 * ── Matched by DOMAIN, not by exact path ───────────────────────────────────
 * One entry per router mounted in lawpass_server/routes/index.js, rather than
 * a row per endpoint. The alternative drifts: every new endpoint would need a
 * line here, and the one nobody adds shows an empty cell in a reporting table,
 * which reads as "no page" instead of "nobody maintained the list". A domain
 * covers its endpoints including the ones that do not exist yet.
 *
 * The cost is that a domain spanning two screens gets one label. `/api/auth`
 * is the real case — signup, sign-in and the OTP all live under it, on three
 * screens — so it is labelled for the flow rather than for any one page.
 *
 * ── The labels are the SIDEBAR's words ─────────────────────────────────────
 * Taken from NAV_MAIN / NAV_LIBRARY in components/app/app-sidebar.tsx, so the
 * admin reads the same name here that a candidate sees in the navigation.
 * They are duplicated rather than imported: that file is a client component
 * carrying icons and routing, and importing it into a server page to borrow
 * six strings would pull all of it along. If a sidebar label is reworded, this
 * list wants the same edit.
 */

/** Longest prefix wins, so `/api/x/y` can override `/api/x` if ever needed. */
const API_DOMAIN_LABELS: ReadonlyArray<readonly [prefix: string, label: string]> = [
  ["/api/dashboard", "סטטיסטיקה אישית ותרגול מותאם"],
  ["/api/custom-exam", "שאלון מותאם אישית"],
  ["/api/open-questions", "מטלת כתיבה"],
  ["/api/mahoti", "דין מהותי"],
  ["/api/diuni", "דין דיוני"],
  ["/api/practice", "תרגול"],
  ["/api/exam", "סימולציות בחינה"],
  ["/api/notes", "הערות שלי"],
  ["/api/bookmarks", "שאלות שסימנתי"],
  ["/api/mistakes", "שאלות שטעיתי בהן"],
  ["/api/drafts", "הטיוטות שלי"],
  ["/api/account", "החשבון שלי"],
  ["/api/admin", "ניהול"],
  ["/api/qa", "דיווחי QA"],
  ["/api/early-access", "רשימת המתנה"],
  // Three screens, one router: signup, sign-in and OTP verification. Named for
  // the flow, because no single page name would be true of all of them.
  ["/api/auth", "התחברות והרשמה"],
];

/** Web-surface rows ARE pages, so they are named directly. */
const WEB_PAGE_LABELS: ReadonlyArray<readonly [prefix: string, label: string]> = [
  ["/dashboard", "סטטיסטיקה אישית ותרגול מותאם"],
  ["/writing-task", "מטלת כתיבה"],
  ["/study-material", "חומר ללימוד"],
  ["/mahoti", "דין מהותי"],
  ["/diuni", "דין דיוני"],
  ["/exam-archive", "משוב מפורט על מבחנים שעשיתי"],
  ["/drafts", "הטיוטות שלי"],
  ["/practice", "תרגול"],
  ["/exam", "סימולציות בחינה"],
  ["/account", "החשבון שלי"],
  ["/admin", "ניהול"],
  ["/pricing", "מחירון"],
  ["/checkout", "תשלום"],
  ["/login", "התחברות והרשמה"],
  ["/signup", "התחברות והרשמה"],
];

/** Shown when nothing matches — an em dash, not an empty cell. */
export const UNKNOWN_PAGE = "—";

/**
 * The screen a recorded request belongs to.
 *
 * Unmatched paths are real and expected: `/favicon.ico` and `/` get counted
 * too, and so does any endpoint added after this list was last read. They get
 * UNKNOWN_PAGE rather than a guess.
 */
export function pageLabelFor(surface: string, path: string): string {
  const table = surface === "web" ? WEB_PAGE_LABELS : API_DOMAIN_LABELS;

  let best: string = UNKNOWN_PAGE;
  let bestLength = 0;
  for (const [prefix, label] of table) {
    // The boundary check stops `/api/exam` claiming `/api/exam-archive`, which
    // a bare startsWith would.
    const matches = path === prefix || path.startsWith(`${prefix}/`);
    if (matches && prefix.length > bestLength) {
      best = label;
      bestLength = prefix.length;
    }
  }
  return best;
}
