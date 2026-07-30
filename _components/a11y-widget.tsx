import { EMPTY_PREFS, type A11yPrefs } from "@/lib/a11y/cookie";

import { A11yWidgetClient } from "./a11y-widget-client";

/**
 * Slice 51 — accessibility widget Server Component shell.
 *
 * Thin server-side wrapper around `<A11yWidgetClient>`. The root layout
 * passes the parsed `initialPrefs` (from the SSR `cookies()` read) so the
 * client island's first paint already reflects what's on `<html>` —
 * eliminating the "Flash of Unstyled Content" path the Gemini spec calls
 * out as a Next.js anti-pattern. When the cookie is absent / empty we
 * pass `EMPTY_PREFS` so the panel renders with every toggle off.
 *
 * Note: this is the ONLY component that's a Server Component in the widget
 * surface. It does NO data fetching, has NO React state, and is here
 * purely as a server/client boundary marker. We keep it as a separate
 * file so the root layout's import graph stays clean and the client
 * island can be code-split out of any future Server Component that
 * happens to use it.
 */
export function A11yWidget({
  initialPrefs = EMPTY_PREFS,
}: {
  initialPrefs?: A11yPrefs;
}) {
  return <A11yWidgetClient initialPrefs={initialPrefs} />;
}
