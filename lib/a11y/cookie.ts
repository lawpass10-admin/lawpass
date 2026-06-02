import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

/**
 * Slice 51 — accessibility-widget preference persistence (cookie layer).
 *
 * Per the Gemini Deep Research spec (§Persistence and Next.js 16 SSR
 * Hydration Strategies), prefs MUST be cookie-based, not localStorage —
 * cookies ride to the server on every request, so the root layout can
 * inject the correct `<html className="lp-a11y-*">` classes during the
 * SSR pass and we get a FOUC-free first paint regardless of how slow the
 * client bundle is.
 *
 * Mirrors the existing `components/ui/sidebar.tsx` cookie pattern (one-line
 * `document.cookie = ...` write; named constant for the cookie name + a
 * 1-year max-age). PM-locked decisions for the cookie envelope:
 *   - name:      "lp_a11y_prefs"
 *   - value:     comma-separated active preference KEYS (e.g.
 *                "text-l,readable-font,stop-motion"). Compact, no JSON
 *                parse, no escaping needed because the key set below is
 *                whitelisted to [a-z\-] characters only.
 *   - path:      "/"     (every page sees it)
 *   - max-age:   31536000 (1 year — a11y prefs are sticky)
 *   - SameSite:  "Lax"   (no cross-site posting; fine for our flows)
 *   - Secure:    true in production, false in dev (avoids the dev http
 *                rejection trap)
 *   - HttpOnly:  false   (the client must read + write the cookie too)
 *
 * Each pref is mapped to a CSS class `lp-a11y-<key>` injected on `<html>`
 * by the root layout. The Phase-A whitelist below + `Object.fromEntries`
 * reconstruction makes the encode/decode pair lossless and tamper-safe:
 * unknown keys read out of the cookie are silently dropped, so a bad
 * value never trips a runtime error or floods the DOM with bogus classes.
 */

export const A11Y_COOKIE_NAME = "lp_a11y_prefs";
export const A11Y_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds
export const A11Y_COOKIE_PATH = "/";
export const A11Y_COOKIE_SAMESITE = "Lax" as const;
export const A11Y_HTML_CLASS_PREFIX = "lp-a11y-";

/**
 * Phase-A + Phase-B control keys. Adding a key here:
 *   1) lets the cookie carry it (encode/decode whitelist),
 *   2) lets the client island render its toggle, and
 *   3) requires the matching `.lp-a11y-<key>` rule in the CSS module.
 *
 * Mutex groups (enforced in the client toggle handler, NOT here — this
 * whitelist is concerned only with parsability of the cookie):
 *   - text-l ↔ text-xl                                  (Phase A typography)
 *   - invert ↔ grayscale ↔ saturate-high ↔ saturate-low (Phase B filters)
 *   - reading-guide ↔ focus-mask                        (Phase B cursor guides)
 *
 * `reset-all` is an action (not a stored pref), so it's NOT in this list.
 */
export const A11Y_KEYS = [
  // ─── Phase A (8 controls) ─────────────────────────────────────────────
  "text-l",
  "text-xl",
  "contrast-high",
  "contrast-dark",
  "readable-font",
  "line-height-lg",
  "stop-motion",
  // ─── Phase B (12 controls) ────────────────────────────────────────────
  // Visual filters (mutex group):
  "invert",
  "grayscale",
  "saturate-high",
  "saturate-low",
  // Links + focus:
  "highlight-links",
  "larger-focus-rings",
  // Cursor + reading tools (reading-guide ↔ focus-mask mutex):
  "big-cursor",
  "tooltips-on-hover",
  "reading-guide",
  "focus-mask",
  // Media:
  "pause-autoplay",
  "hide-images",
] as const;

export type A11yKey = (typeof A11Y_KEYS)[number];

const A11Y_KEY_SET: ReadonlySet<string> = new Set(A11Y_KEYS);

export type A11yPrefs = { readonly [K in A11yKey]: boolean };

export const EMPTY_PREFS: A11yPrefs = Object.fromEntries(
  A11Y_KEYS.map((k) => [k, false])
) as A11yPrefs;

/** Decode the cookie's comma-separated value into a typed prefs object.
 *  Silently drops unknown keys and trims whitespace so a hand-edited or
 *  partially-truncated cookie can't crash the page. */
export function parseClassString(raw: string | undefined): A11yPrefs {
  if (!raw) return EMPTY_PREFS;
  const out: { [K in A11yKey]: boolean } = { ...EMPTY_PREFS };
  for (const tok of raw.split(",")) {
    const key = tok.trim();
    if (A11Y_KEY_SET.has(key)) {
      out[key as A11yKey] = true;
    }
  }
  return out;
}

/** Encode a typed prefs object into the cookie's comma-separated value.
 *  Output order matches `A11Y_KEYS` for deterministic SSR + diffability. */
export function encodeClassString(prefs: A11yPrefs): string {
  return A11Y_KEYS.filter((k) => prefs[k]).join(",");
}

/** Build the space-separated `class=` string the root layout injects on
 *  `<html>` for the SSR pass. Returns "" when no prefs are active so the
 *  default (no class) HTML doesn't carry a useless trailing space. */
export function buildHtmlClassString(prefs: A11yPrefs): string {
  return A11Y_KEYS.filter((k) => prefs[k])
    .map((k) => `${A11Y_HTML_CLASS_PREFIX}${k}`)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/** Server-only — call from the root layout. Reads `lp_a11y_prefs` from the
 *  request's cookie store (Next 16 `cookies()` is async; the caller awaits
 *  it). Returns `EMPTY_PREFS` when the cookie is missing or empty. */
export function readPrefs(cookieStore: ReadonlyRequestCookies): A11yPrefs {
  const raw = cookieStore.get(A11Y_COOKIE_NAME)?.value;
  return parseClassString(raw);
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Client-only — sets the cookie via `document.cookie`. Mirrors the
 *  one-liner pattern in `components/ui/sidebar.tsx:86`. `Secure` is
 *  conditional on production so the dev (http://) server doesn't reject
 *  the write outright. */
export function writePrefsCookie(prefs: A11yPrefs): void {
  if (typeof document === "undefined") return;
  const value = encodeClassString(prefs);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  document.cookie =
    `${A11Y_COOKIE_NAME}=${value}` +
    `; Path=${A11Y_COOKIE_PATH}` +
    `; Max-Age=${A11Y_COOKIE_MAX_AGE}` +
    `; SameSite=${A11Y_COOKIE_SAMESITE}` +
    secure;
}

/** Client-only — wipe the cookie (Max-Age=0 expires it instantly). Used
 *  by the panel's "reset-all" button. */
export function clearPrefsCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${A11Y_COOKIE_NAME}=` +
    `; Path=${A11Y_COOKIE_PATH}` +
    `; Max-Age=0` +
    `; SameSite=${A11Y_COOKIE_SAMESITE}`;
}

/** Client-only — read the current cookie. Used by `useSyncExternalStore`'s
 *  `getSnapshot` in the client island so React stays in sync with what
 *  `<html>` already carries. Returns "" if document/cookie unavailable. */
export function readPrefsCookieRaw(): string {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie.split(";");
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (k.trim() === A11Y_COOKIE_NAME) {
      return rest.join("=").trim();
    }
  }
  return "";
}
