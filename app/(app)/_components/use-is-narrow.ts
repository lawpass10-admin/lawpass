"use client";

import * as React from "react";

/**
 * True on a phone-width viewport.
 *
 * `useSyncExternalStore` rather than state in an effect, for two reasons. The
 * repo's eslint bars `setState` in an effect body (react-hooks/set-state-in-effect),
 * and more importantly this is a subscription to something outside React —
 * exactly what the hook exists for. The server snapshot is `false`, so the
 * first paint matches the desktop markup and a phone corrects on hydration;
 * guessing "narrow" on the server would make every desktop load flash the
 * compact layout.
 *
 * 768px is Tailwind's `md` breakpoint, so the JS and the CSS agree about where
 * "narrow" starts. If one moves, move both.
 */
const NARROW = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsNarrow(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => false
  );
}
