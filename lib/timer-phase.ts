/**
 * Slice 22 — shared 3-phase color logic for countdown timers.
 *
 * Originally defined inside `app/(app)/exam/play/_components/exam-header.tsx`
 * for Slice 17 B-1; extracted here so the practice timer
 * (`app/(app)/practice/play/_components/timer.tsx`) can apply the
 * same phases. Behavior-preserving for the exam timer: the
 * thresholds, the phase derivation, and the exam-side class set are
 * identical to what shipped in Slice 17 B-1.
 *
 * Phases:
 *   neutral  — remainingSeconds ≥ 30
 *   warning  — 30 > remainingSeconds ≥ 10  (amber)
 *   danger   — remainingSeconds < 10        (red + .timer-pulse)
 *
 * The `.timer-pulse` keyframe lives in `app/globals.css` and is
 * already gated on `prefers-reduced-motion: no-preference` so
 * motion-sensitive users see no animation. Both surface variants
 * reference it from their danger class set.
 */

export const TIMER_WARNING_SECONDS = 30;
export const TIMER_DANGER_SECONDS = 10;

export type TimerPhase = "neutral" | "warning" | "danger";

/**
 * Pure phase derivation. Same boundaries as the exam-side
 * implementation (Slice 17 B-1):
 *   `< 10`  → "danger"
 *   `< 30`  → "warning"
 *   otherwise → "neutral"
 *
 * The boundaries are STRICT inequalities — at exactly 30 seconds the
 * phase is still "neutral"; the first frame to land in "warning" is
 * 29s remaining. Matches the prior exam behavior.
 */
export function getTimerPhase(remainingSeconds: number): TimerPhase {
  if (remainingSeconds < TIMER_DANGER_SECONDS) return "danger";
  if (remainingSeconds < TIMER_WARNING_SECONDS) return "warning";
  return "neutral";
}

/**
 * Tailwind class set for the timer pill sitting on a NAVY chrome
 * surface (the exam-play sticky header at exam-header.tsx). Verbatim
 * from the pre-Slice-22 inline class branch.
 *
 *   - neutral: a low-opacity white wash that reads against navy
 *   - warning: amber palette
 *   - danger:  solid destructive bg + `.timer-pulse`
 */
export const TIMER_PHASE_CLASSES_NAVY: Record<TimerPhase, string> = {
  neutral: "bg-white/10 text-primary-foreground",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "bg-destructive text-destructive-foreground timer-pulse",
};

/**
 * Tailwind class set for the timer pill sitting on a LIGHT card
 * surface (the practice timer at practice/play/_components/timer.tsx).
 * Tuned for the white-ish bg-card backdrop:
 *
 *   - neutral: `bg-muted` rather than `bg-white/10` — a 10%-white
 *              wash disappears on top of a near-white card.
 *   - warning: same amber-100/800 token the project uses elsewhere
 *              for status pills on light rows (qa-list-table.tsx),
 *              PLUS a subtle `ring-1 ring-amber-300` so the pill
 *              pops against the near-white card background. The
 *              warning needs to read as an alert on a quiet
 *              surface, not blend in.
 *   - danger:  same `bg-destructive` + `.timer-pulse`. The
 *              destructive design tokens are surface-agnostic and
 *              the solid red stripe + pulse animation are the
 *              clearest "10 seconds left" signal regardless of
 *              surrounding chrome.
 */
export const TIMER_PHASE_CLASSES_LIGHT: Record<TimerPhase, string> = {
  neutral: "bg-muted text-muted-foreground",
  warning:
    "bg-amber-100 text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700/50",
  danger: "bg-destructive text-destructive-foreground timer-pulse",
};
