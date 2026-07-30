"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Slice 63 — QA-gated full-copy bypass.
 *
 * The Slice 37 copy/paste deterrent (`<NoCopyText>` + the three
 * manual `.no-copy-content` seams in Choice / Learning360Panel /
 * ChoiceAnalysisRow) blocks selection + clipboard writes on
 * question-content surfaces so casual users can't trivially exfiltrate
 * exam material. QA reviewers (is_qa_tester) and admins (is_admin)
 * need the OPPOSITE: copy everything, paste into AI tools, review.
 *
 * This provider exposes one boolean (`bypass`) sourced from the
 * `(app)` layout's existing `profile.is_qa_tester || profile.is_admin`
 * computation. Every NoCopyText caller and the three manual seams
 * read the same context via `useNoCopyBypass()`; when `true` they
 * render plain pass-through wrappers (no class, no handlers) — the
 * native browser copy proceeds. Normal users see `false` and the
 * deterrent renders exactly as before.
 *
 * Default is `false` so any tree NOT wrapped in the provider (e.g.,
 * unit tests, the marketing route group) still blocks copy by default
 * — same as pre-Slice-63 behavior.
 *
 * Single source of truth: this is the ONLY toggle. Don't add per-
 * surface props — the whole point of the context is keeping the QA
 * model consistent everywhere the deterrent is applied.
 */
const NoCopyBypassContext = createContext<boolean>(false);

export function NoCopyBypassProvider({
  bypass,
  children,
}: {
  bypass: boolean;
  children: ReactNode;
}) {
  return (
    <NoCopyBypassContext.Provider value={bypass}>
      {children}
    </NoCopyBypassContext.Provider>
  );
}

/** Returns true when the current user (per the `(app)` layout) should
 *  bypass the copy/paste deterrent. Outside the provider (or in tests
 *  that don't wrap), returns false — the safe default. */
export function useNoCopyBypass(): boolean {
  return useContext(NoCopyBypassContext);
}
