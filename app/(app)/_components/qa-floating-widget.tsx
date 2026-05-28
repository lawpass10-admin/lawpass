"use client";

import { Bug } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitQaReport } from "@/app/(app)/qa/_actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ReportType } from "@/lib/validators/qa-reports";
import { cn } from "@/lib/utils";

import { useQaContext } from "./qa-context";

/**
 * Slice 10 Phase B-1 — floating QA bug-report widget.
 *
 * Renders nothing when `isQaTester` is false (most users). For testers:
 * a fixed-position bug icon button at the bottom-start of the viewport
 * (logical property so it sits in the correct corner in RTL without
 * covering the exam timer which lives at the top).
 *
 * Clicking opens a base-ui Dialog (Portal-rendered at z-50) with:
 *   - 3-card type picker (bug / content / design)
 *   - "מה לא עבד?" textarea
 *   - "מה צריך להיות במקום?" textarea
 *   - optional screenshot file input
 *   - submit button
 *
 * On submit:
 *   - usePathname() → pagePath
 *   - useQaContext() → questionId / questionType (nulls outside play)
 *   - navigator.userAgent + window.innerWidth/innerHeight
 * Calls submitQaReport(input, screenshot). On success: close popup,
 * reset form, success toast. On error: error toast (popup stays open
 * so the user can retry).
 *
 * Exam-safety:
 *   - No router navigation; no window.location writes.
 *   - No writes to localStorage (especially not lawpass.exam.*).
 *   - Dialog renders into a Portal, so the play tree is NOT remounted
 *     when the widget opens/closes.
 *   - z-40 button, z-50 popup — same stacking the existing
 *     resume-prompt uses, so the exam pause overlay / window-conflict
 *     screen still layer correctly above when active.
 */
export function QaFloatingWidget({ isQaTester }: { isQaTester: boolean }) {
  // Hook order MUST be stable across renders, so call hooks before
  // the early-return guard. usePathname is cheap; the context hook
  // returns the default value on non-play pages.
  const pathname = usePathname() ?? "/";
  const { questionId, questionType } = useQaContext();

  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("bug");
  const [problemText, setProblemText] = useState("");
  const [expectedText, setExpectedText] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

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

  if (!isQaTester) return null;

  return (
    <>
      {/* Floating trigger. bottom-4 start-4 = logical bottom-right in
          RTL = correct corner without covering the exam timer (which
          lives in the top header). z-40 sits below modal dialogs
          (z-50) and the sidebar (z-50). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתח דיווח QA"
        className={cn(
          "fixed bottom-4 start-4 z-40",
          "flex h-12 w-12 items-center justify-center rounded-full",
          "border border-amber-300/60 bg-amber-500 text-primary-foreground shadow-lg",
          "transition-colors hover:bg-amber-600",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        )}
      >
        <Bug className="size-5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>דיווח QA</DialogTitle>
            <DialogDescription>
              עזרו לנו לשפר את LawPass — תארו מה נתקלתם בו ומה הציפיה.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="mt-4 space-y-4"
            noValidate
          >
            <fieldset
              className="space-y-2"
              aria-label="סוג דיווח"
            >
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
                rows={3}
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
                rows={3}
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
        </DialogContent>
      </Dialog>
    </>
  );
}

const REPORT_TYPE_CARDS: readonly { value: ReportType; label: string }[] = [
  { value: "bug", label: "באג טכני" },
  { value: "content", label: "טעות תוכן" },
  { value: "design", label: "עיצוב/UX" },
];
