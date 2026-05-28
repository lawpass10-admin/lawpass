"use client";

import { Bug, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitQaReport } from "@/app/(app)/qa/_actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReportType } from "@/lib/validators/qa-reports";
import { cn } from "@/lib/utils";

import { useQaContext } from "./qa-context";

/**
 * Slice 10.1 — QA widget UX overhaul.
 *
 * The Slice 10 widget opened the report form as a centered MODAL with
 * a backdrop. Testers couldn't read/copy text from the page behind
 * (e.g. exam/practice question text) and paste it into the form. This
 * revision keeps the SAME form (3-card type picker, two textareas,
 * optional screenshot, submit) but changes the presentation:
 *
 *   - The popup is now a NON-MODAL SIDE PANEL anchored to a screen
 *     edge — no backdrop, no focus trap, no scroll lock. The page
 *     behind stays fully visible AND interactive: the user can
 *     select / copy text and paste into the form.
 *
 *   - The launcher button moved from bottom-START (visually
 *     bottom-right in RTL) to bottom-END (bottom-left in RTL), on
 *     the OPPOSITE side from the panel — so launcher + panel are
 *     never both fighting for the same corner.
 *
 *   - The launcher is now DRAGGABLE. The tester drags it wherever it
 *     stays out of the way of whatever they're inspecting. Position
 *     is kept in component state only — no localStorage writes, no
 *     coupling to any lawpass.exam.* key. The tracked position is
 *     clamped to the viewport on every pointermove and on resize.
 *
 *   - Exam-safety contract preserved + reinforced: the widget does
 *     not call router navigation, does not write to localStorage,
 *     does not pause/interact with the exam timer, never remounts
 *     the exam interactive tree (it's a sibling in the layout). Now
 *     that the panel is non-modal, it ALSO never intercepts the
 *     exam's clicks / keyboard / pointer events outside its own
 *     bounding box.
 */

/** Launcher size in pixels — matches the h-12 w-12 utility classes. */
const LAUNCHER_SIZE = 48;
/** Movement threshold (pixels) before a pointer drag is treated as a
 *  drag rather than a click. Same magnitude the browser itself uses
 *  for distinguishing click from drag-start. */
const DRAG_THRESHOLD = 5;
/** Margin from the viewport edges when clamping the launcher's
 *  position — keeps the button visible even when the user drags it
 *  into a corner. */
const EDGE_MARGIN = 8;

type LauncherPosition = { left: number; bottom: number };

/** Default position — bottom-LEFT visually (in RTL). 16px from each
 *  edge. The component re-clamps on first measurement so we don't
 *  blow past narrow viewports. */
const DEFAULT_POSITION: LauncherPosition = { left: 16, bottom: 16 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function QaFloatingWidget({ isQaTester }: { isQaTester: boolean }) {
  // Hook order MUST be stable across renders — call hooks BEFORE the
  // isQaTester early-return guard.
  const pathname = usePathname() ?? "/";
  const { questionId, questionType } = useQaContext();

  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("bug");
  const [problemText, setProblemText] = useState("");
  const [expectedText, setExpectedText] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<LauncherPosition>(DEFAULT_POSITION);
  const [, startTransition] = useTransition();

  // Pointer-drag state lives in a ref so we don't trigger renders on
  // every pointermove. setPosition does the visible updating.
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    basePos: LauncherPosition;
  } | null>(null);
  /** Set true the first time pointermove crosses DRAG_THRESHOLD; checked
   *  by handleClick to distinguish click-to-toggle from drag-end. */
  const wasDraggedRef = useRef(false);

  // Re-clamp position on viewport resize so the launcher never ends
  // up off-screen after a rotation / window resize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function clampToViewport() {
      setPosition((prev) => {
        const maxLeft = window.innerWidth - LAUNCHER_SIZE - EDGE_MARGIN;
        const maxBottom = window.innerHeight - LAUNCHER_SIZE - EDGE_MARGIN;
        const nextLeft = clamp(
          prev.left,
          EDGE_MARGIN,
          Math.max(EDGE_MARGIN, maxLeft)
        );
        const nextBottom = clamp(
          prev.bottom,
          EDGE_MARGIN,
          Math.max(EDGE_MARGIN, maxBottom)
        );
        if (nextLeft === prev.left && nextBottom === prev.bottom) return prev;
        return { left: nextLeft, bottom: nextBottom };
      });
    }
    clampToViewport();
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

  // ESC closes the panel. No focus trap — this is just a keyboard
  // convenience. We attach to the document so it works while focus
  // is on the page behind.
  useEffect(() => {
    if (!open) return;
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [open]);

  function resetForm(): void {
    setReportType("bug");
    setProblemText("");
    setExpectedText("");
    setScreenshot(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (submitting) return;

    const trimmedProblem = problemText.trim();
    const trimmedExpected = expectedText.trim();
    if (!trimmedProblem) {
      toast.error("יש לתאר מה לא עבד");
      return;
    }
    if (!trimmedExpected) {
      toast.error("יש לתאר מה היה צריך לקרות");
      return;
    }

    const viewport =
      typeof window !== "undefined"
        ? `${window.innerWidth}x${window.innerHeight}`
        : null;
    const userAgent =
      typeof navigator !== "undefined" ? navigator.userAgent : null;

    setSubmitting(true);
    startTransition(async () => {
      const result = await submitQaReport(
        {
          reportType,
          problemText: trimmedProblem,
          expectedText: trimmedExpected,
          pagePath: pathname,
          questionId,
          questionType,
          userAgent,
          viewport,
        },
        screenshot
      );
      setSubmitting(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("הדיווח נשלח, תודה");
      setOpen(false);
      resetForm();
    });
  }

  // -------------------------------------------------------------------------
  // Launcher drag handlers (pointer events).
  //
  // Pattern: setPointerCapture on pointerdown so subsequent move/up
  // events fire on the button even if the cursor exits its bounding
  // box. setPosition is throttled implicitly by React batching — the
  // ref-based drag state means we never re-render to record state.
  //
  // The click handler distinguishes a click from a drag-end by
  // checking wasDraggedRef.
  // -------------------------------------------------------------------------

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>): void {
    if (submitting) return;
    wasDraggedRef.current = false;
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      basePos: position,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers throw if the pointer is already captured; ignore.
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>): void {
    const state = dragStateRef.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!wasDraggedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }
    wasDraggedRef.current = true;
    const maxLeft =
      typeof window !== "undefined"
        ? Math.max(EDGE_MARGIN, window.innerWidth - LAUNCHER_SIZE - EDGE_MARGIN)
        : state.basePos.left;
    const maxBottom =
      typeof window !== "undefined"
        ? Math.max(EDGE_MARGIN, window.innerHeight - LAUNCHER_SIZE - EDGE_MARGIN)
        : state.basePos.bottom;
    // Viewport y grows DOWNWARD, but we anchor with `bottom` which
    // grows UPWARD — so the dy delta is subtracted.
    setPosition({
      left: clamp(state.basePos.left + dx, EDGE_MARGIN, maxLeft),
      bottom: clamp(state.basePos.bottom - dy, EDGE_MARGIN, maxBottom),
    });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>): void {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Already released — ignore.
    }
  }

  function handleClick(): void {
    if (wasDraggedRef.current) {
      // A drag just ended — consume the synthetic click. The next
      // genuine click will toggle.
      wasDraggedRef.current = false;
      return;
    }
    setOpen((prev) => !prev);
  }

  if (!isQaTester) return null;

  return (
    <>
      {/* Launcher. Fixed-positioned, draggable, toggles the panel.
          touch-action:none disables the browser's scroll-on-touch so
          mobile users can drag without scrolling the page. */}
      <button
        type="button"
        aria-label="פתח דיווח QA"
        title="גרור להזזה, לחץ לפתיחה"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        style={{
          left: `${position.left}px`,
          bottom: `${position.bottom}px`,
          touchAction: "none",
        }}
        className={cn(
          "fixed z-40",
          "flex h-12 w-12 cursor-grab items-center justify-center rounded-full",
          "border border-amber-300/60 bg-amber-500 text-primary-foreground shadow-lg",
          "transition-colors hover:bg-amber-600 active:cursor-grabbing",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        )}
      >
        {/* pointer-events-none on the icon so drag events register on
            the button surface, not the SVG. */}
        <Bug className="pointer-events-none size-5" aria-hidden />
      </button>

      {/*
        NON-MODAL side panel. No backdrop, no focus trap, no scroll
        lock — the page behind stays fully visible AND interactive.
        Anchored to the START edge (right in RTL) on desktop so the
        bottom-end launcher remains accessible while the panel is
        open. On mobile the panel is full-width by default; the
        max-w-sm cap keeps it ~384px on tablet/desktop.

        aria-modal="false" is explicit: assistive tech should NOT
        announce this as a focus-trapped modal. Tab-out of the panel
        is intentional — the user may need to interact with the page.
      */}
      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="דיווח QA"
          dir="rtl"
          className={cn(
            "fixed inset-y-0 start-0 z-50 flex w-full max-w-sm flex-col",
            "border-e border-border bg-background shadow-2xl",
            "overflow-y-auto"
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
            <div>
              <h2 className="font-heebo text-lg font-semibold">דיווח QA</h2>
              <p className="text-xs text-muted-foreground">
                העמוד שמאחור פעיל — אפשר להעתיק טקסט ולהדביק כאן.
              </p>
            </div>
            <button
              type="button"
              aria-label="סגור"
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md p-1.5 text-muted-foreground transition-colors",
                "hover:bg-muted/40 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 px-5 py-4"
            noValidate
          >
            <fieldset className="space-y-2" aria-label="סוג דיווח">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                סוג דיווח
              </legend>
              <div
                role="radiogroup"
                aria-label="סוג דיווח"
                className="grid grid-cols-3 gap-2"
              >
                {REPORT_TYPE_CARDS.map((card) => {
                  const selected = card.value === reportType;
                  return (
                    <button
                      key={card.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReportType(card.value)}
                      disabled={submitting}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                        selected
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                          : "border-border bg-card hover:bg-muted/40"
                      )}
                    >
                      {card.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1">
              <label
                htmlFor="qa-problem-text"
                className="text-xs font-semibold"
              >
                מה לא עבד?
              </label>
              <Textarea
                id="qa-problem-text"
                value={problemText}
                onChange={(e) => setProblemText(e.target.value)}
                rows={4}
                maxLength={4000}
                disabled={submitting}
                dir="auto"
                required
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="qa-expected-text"
                className="text-xs font-semibold"
              >
                מה צריך להיות במקום?
              </label>
              <Textarea
                id="qa-expected-text"
                value={expectedText}
                onChange={(e) => setExpectedText(e.target.value)}
                rows={4}
                maxLength={4000}
                disabled={submitting}
                dir="auto"
                required
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="qa-screenshot"
                className="text-xs font-semibold"
              >
                צילום מסך (אופציונלי)
              </label>
              <input
                id="qa-screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={submitting}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setScreenshot(file);
                }}
                className="block w-full text-xs file:me-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/40"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                disabled={submitting}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "שולח..." : "שליחת דיווח"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

const REPORT_TYPE_CARDS: readonly { value: ReportType; label: string }[] = [
  { value: "bug", label: "באג טכני" },
  { value: "content", label: "טעות תוכן" },
  { value: "design", label: "עיצוב/UX" },
];
