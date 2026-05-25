"use client";

import { Play } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P4 — Sticky summary footer.
 *
 * Pinned to the bottom of the viewport with the live equation on the
 * right (RTL visual right) and the gold CTA on the left. Spans the
 * content area only — on desktop the `inset-inline-start` matches the
 * sidebar width so the footer doesn't overlap the navy panel; on
 * mobile (`md` breakpoint and below) the sidebar collapses to a Sheet
 * via `MobileTopBar`, so the footer claims the full viewport width.
 *
 * Stateless — the parent form computes everything (sourceCount,
 * angles, total, time minutes, disabled reason) and hands it down.
 */

type Props = {
  sourceCount: number;
  angles: number;
  total: number;
  /** Per-question time in seconds. 0 = "no timer". Drives the "~N דקות" estimate. */
  timeSeconds: number;
  hasSelection: boolean;
  /** True when chapters picked but no questions matched (clamped lower than min). */
  insufficient: boolean;
  submitting: boolean;
  submitDisabled: boolean;
  onSubmit: () => void;
};

export function SummaryFooter({
  sourceCount,
  angles,
  total,
  timeSeconds,
  hasSelection,
  insufficient,
  submitting,
  submitDisabled,
  onSubmit,
}: Props) {
  const estimatedMinutes =
    timeSeconds > 0 ? Math.round((total * timeSeconds) / 60) : null;

  // Pick the helper string for the equation block when disabled.
  const helperText = !hasSelection
    ? "בחר לפחות פרק אחד"
    : insufficient
      ? "אין מספיק שאלות בנושאים שבחרת"
      : null;

  return (
    <div
      // `start-0` on mobile fills the viewport; `md:start-[var(--sidebar-width)]`
      // shifts the footer's start (= right edge in RTL) to where the
      // sidebar begins, so it doesn't bleed under the navy panel.
      className={cn(
        "fixed bottom-0 end-0 z-30 start-0 md:start-[var(--sidebar-width)]",
        "border-t bg-card"
      )}
      style={{
        borderColor: "var(--color-line)",
        boxShadow: "0 -8px 24px -8px rgba(15, 31, 79, 0.10)",
      }}
    >
      <div
        className={cn(
          "max-w-[1480px] mx-auto px-5 md:px-9 py-3 md:py-3.5",
          "flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3 md:gap-6"
        )}
      >
        {/* Equation / helper text */}
        <div
          className="font-heebo flex flex-wrap items-center gap-x-3.5 gap-y-1"
          style={{ fontSize: 14, color: "var(--color-ink-dim)" }}
        >
          {helperText ? (
            <span
              className="font-heebo"
              style={{ color: "var(--color-ink-muted)", fontSize: 14 }}
            >
              {helperText}
            </span>
          ) : (
            <>
              <span>
                <b style={{ color: "var(--color-navy-ink)", fontWeight: 700 }}>
                  {sourceCount}
                </b>{" "}
                שאלות מקור
              </span>
              {angles > 0 && (
                <>
                  <span
                    style={{
                      color: "var(--color-ink-muted)",
                      fontWeight: 500,
                    }}
                    aria-hidden
                  >
                    ×
                  </span>
                  <span>
                    (
                    <b
                      style={{
                        color: "var(--color-navy-ink)",
                        fontWeight: 700,
                      }}
                    >
                      1
                    </b>{" "}
                    +{" "}
                    <b
                      style={{
                        color: "var(--color-navy-ink)",
                        fontWeight: 700,
                      }}
                    >
                      {angles}
                    </b>{" "}
                    זוויות)
                  </span>
                </>
              )}
              <span
                style={{ color: "var(--color-ink-muted)", fontWeight: 500 }}
                aria-hidden
              >
                =
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                <span
                  className="font-heebo font-extrabold tabular-nums"
                  style={{
                    fontSize: 24,
                    color: "var(--color-gold-deep)",
                    lineHeight: 1,
                  }}
                >
                  {total}
                </span>
                <span style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
                  שאלות סה״כ
                  {estimatedMinutes !== null && (
                    <> · ~{estimatedMinutes} דקות</>
                  )}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Gold CTA — reuses the .btn-gold class from globals.css */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className={cn(
            "btn-gold inline-flex items-center justify-center gap-2 rounded-full font-heebo font-bold w-full md:w-auto",
            "px-6 md:px-[26px] py-3 md:py-3.5 text-[15px] md:text-[16px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            submitDisabled &&
              "opacity-50 pointer-events-none [filter:grayscale(0.6)]"
          )}
        >
          <Play className="size-4 fill-current" aria-hidden />
          {submitting ? "יוצר סשן..." : "התחל תרגול"}
        </button>
      </div>
    </div>
  );
}
