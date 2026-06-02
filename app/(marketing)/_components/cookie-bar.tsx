"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { cookieBarCopy } from "@/app/(marketing)/_components/landing-copy";

const STORAGE_KEY = "lawpass:cookie-bar-dismissed";

// Shared style for the two inline legal links in the cookie-bar text. The
// links inherit the bar's body color via `text-current` so the sentence
// reads as one continuous line; underline + offset is the affordance,
// `hover:opacity-80` covers hover, and the gold focus ring covers keyboard
// focus per the slice-50 follow-up brief.
const LEGAL_LINK_CLS =
  "font-semibold text-current underline underline-offset-[3px] " +
  "transition-opacity hover:opacity-80 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-[var(--color-gold-deep)] rounded-[2px]";

function subscribe(callback: () => void) {
  // We only need to react to *other tabs* dismissing the bar. The
  // current tab dismisses via local state below.
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage may be blocked (private mode, iframe sandbox);
    // default to NOT dismissed so the user still sees the bar.
    return false;
  }
}

// During SSR there's no window — the bar stays hidden until hydration.
const getServerSnapshot = () => true;

/**
 * Cookie consent bar (passive notice).
 *
 * Slice 16 / Phase L2. We don't run any analytics/marketing trackers
 * on the marketing surface yet, so this is informational only — a
 * single "we use cookies" notice with a close button that persists
 * via localStorage. Uses `useSyncExternalStore` so the dismissed
 * flag is read from localStorage synchronously without the
 * setState-in-effect lint warning, and so cross-tab dismissals
 * propagate via the `storage` event.
 *
 * Slice 50 follow-up — the previously-inert "מדיניות הפרטיות" mention
 * is now an inline `<Link href="/privacy">`, and a second inline
 * `<Link href="/accessibility">הצהרת הנגישות</Link>` was added so the
 * cookie notice references both new legal pages. Copy + link
 * destinations live in `cookieBarCopy` (landing-copy.ts) so future
 * legal-link wording changes touch one place. The 5-slot shape (pre /
 * privacy link / between / accessibility link / post) keeps the JSX
 * here readable and avoids any string templating in the bar.
 *
 * Styling mirrors prototype index.html L150–177 (#F4F1E8 wash,
 * 28×28 navy circle close button at inset-inline-end: 16px).
 */
export function CookieBar() {
  const storedDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  // Tracks "this-tab" dismissal so the bar disappears immediately
  // when the close button is clicked, without waiting for a storage
  // event round-trip (which doesn't fire on the same tab).
  const [localDismissed, setLocalDismissed] = useState(false);

  if (storedDismissed || localDismissed) return null;

  return (
    <div
      role="region"
      aria-label={cookieBarCopy.ariaLabel}
      // Mobile (<768px): asymmetric padding (12px start, 48px end) so
      // the text doesn't crash into the absolute-positioned close
      // button and so we don't waste 56px of space on the start side
      // for centring. md+: restore px-14 (56px each side) so the
      // centered text reads as a clean banner on desktop.
      className="relative border-b border-[var(--color-line)] bg-[#F4F1E8] ps-3 pe-12 py-3 text-start text-[14px] font-normal text-[var(--ink)] md:px-14 md:py-[14px] md:text-center md:text-base"
    >
      <span>
        {cookieBarCopy.pre}
        <Link
          href={cookieBarCopy.privacyLink.href}
          className={LEGAL_LINK_CLS}
        >
          {cookieBarCopy.privacyLink.label}
        </Link>
        {cookieBarCopy.between}
        <Link
          href={cookieBarCopy.accessibilityLink.href}
          className={LEGAL_LINK_CLS}
        >
          {cookieBarCopy.accessibilityLink.label}
        </Link>
        {cookieBarCopy.post}
      </span>
      <button
        type="button"
        aria-label={cookieBarCopy.closeLabel}
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, "true");
          } catch {
            // Swallow — if storage isn't writable we still close
            // the bar for the session, the user will just see it
            // again next visit.
          }
          setLocalDismissed(true);
        }}
        className="absolute top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-navy)] text-lg leading-none text-white"
        style={{ insetInlineEnd: 16 }}
      >
        ×
      </button>
    </div>
  );
}
