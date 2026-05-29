"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "lawpass:cookie-bar-dismissed";

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
 * Decision 5 — "/privacy" link target stays "#" until the legal
 * pages land; the placeholder is wrapped in a comment so a future
 * Find shows it up.
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
      aria-label="הודעת עוגיות"
      className="relative border-b border-[var(--color-line)] bg-[#F4F1E8] px-14 py-[14px] text-center text-base font-normal text-[var(--ink)]"
    >
      <span>
        אתר זה משתמש בעוגיות (Cookies) לשיפור חוויית הגלישה והתאמת תכנים.
        למידע נוסף ראו{" "}
        <Link
          // TODO(slice-16 L5/L6): point at /privacy once that page exists.
          href="#"
          className="font-semibold text-[var(--color-navy)] underline underline-offset-[3px]"
        >
          מדיניות הפרטיות
        </Link>
        .
      </span>
      <button
        type="button"
        aria-label="סגור"
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
