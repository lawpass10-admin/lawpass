"use client";

import { Check, ChevronDown, Play, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createExamSession } from "@/app/(app)/exam/_actions";
import { Button } from "@/components/ui/button";
import type { ExamResultsAggregate } from "@/lib/db/exam";
import { EXAM_TOTAL_QUESTIONS } from "@/lib/exam/clusters";
import { cn } from "@/lib/utils";

/**
 * PM-revised UX (Phase 4 hotfix v2): show 5 rows by default — each row
 * now carries a question-text excerpt in the middle column, so the
 * default view is meaningful rather than 8 lines of position+pill with
 * an empty band between them.
 */
const REVIEW_INITIAL_ROWS = 5;

type Props = {
  aggregate: ExamResultsAggregate;
};

const STATUS_COPY: Record<string, { label: string; classes: string }> = {
  correct: {
    label: "נכון",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  wrong: {
    label: "שגוי",
    classes:
      "bg-destructive/15 text-destructive",
  },
  skipped: {
    label: "דולג",
    classes: "bg-muted text-muted-foreground",
  },
  unanswered: {
    label: "לא נענה",
    classes: "bg-muted text-muted-foreground",
  },
};

/**
 * Final exam results screen. PM-locked layout (no drill-in, no
 * subtopic labels, no "פירוט" buttons, no "הצג את כל 40" collapse —
 * the 40 rows render directly).
 *
 * Sections:
 *   A. Hero: pass/fail pill + big score + percent + time + threshold.
 *   B. 3 cluster cards (correct/total + progress bar).
 *   C. 40-row review (position number + status pill only).
 *   D. Footer CTAs: dashboard + new exam.
 */
export function ExamResults({ aggregate }: Props) {
  const { session, byPosition, byCluster } = aggregate;
  const score = session.final_score ?? 0;
  const total = EXAM_TOTAL_QUESTIONS;
  const passed = session.passed === true;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const minutesUsed = Math.max(0, Math.round(session.time_used_seconds / 60));

  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [, startTransition] = useTransition();

  const visibleRows = showAll
    ? byPosition
    : byPosition.slice(0, REVIEW_INITIAL_ROWS);
  const hasHiddenRows = !showAll && byPosition.length > REVIEW_INITIAL_ROWS;

  function handleAnother(): void {
    if (creating) return;
    setCreating(true);
    startTransition(async () => {
      const result = await createExamSession();
      if (!result.ok) {
        toast.error(
          result.error === "exam_pool_insufficient"
            ? "אין מספיק שאלות במאגר לסימולציה כרגע"
            : "אירעה שגיאה. נסה שוב"
        );
        setCreating(false);
        return;
      }
      try {
        window.localStorage.setItem(
          `lawpass.exam.${result.sessionId}.windowToken`,
          result.windowToken
        );
      } catch {
        // localStorage unavailable — Phase 5 hardens the fallback.
      }
      window.location.assign(result.url);
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
      {/* A. Hero */}
      <header className="space-y-3 text-center">
        <div
          className={cn(
            "mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
            passed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-destructive/15 text-destructive"
          )}
        >
          {passed ? (
            <>
              <Check className="size-4" aria-hidden />
              <span>עברת</span>
            </>
          ) : (
            <>
              <X className="size-4" aria-hidden />
              <span>לא עברת</span>
            </>
          )}
        </div>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          סימולציית בחינה
        </p>
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-5xl font-bold tabular-nums sm:text-7xl">
            {score}
          </span>
          <span className="text-2xl font-semibold text-muted-foreground tabular-nums">
            /{total}
          </span>
        </div>
        <p className="text-sm text-muted-foreground" dir="auto">
          {pct}% · סף מעבר: 60% (24/40) · משך: {minutesUsed} דקות
        </p>
      </header>

      {/* B. Cluster cards */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {byCluster.map((cluster) => {
          const clusterPct =
            cluster.total > 0
              ? Math.round((cluster.correct / cluster.total) * 100)
              : 0;
          return (
            <div
              key={cluster.code}
              className="rounded-xl border border-border bg-card p-5"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                אשכול {cluster.code}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {cluster.correct}
                <span className="text-base font-semibold text-muted-foreground">
                  /{cluster.total}
                </span>
              </p>
              <div
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
                aria-label={`${clusterPct}%`}
              >
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${clusterPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>

      {/* C. Question review */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">סקירת שאלות</h2>
        </header>
        <ul>
          {visibleRows.map((row, idx) => {
            const meta = STATUS_COPY[row.status] ?? STATUS_COPY.unanswered;
            // Border on every row except the visual last — when
            // `hasHiddenRows`, the expand button sits below the list
            // and we still want the divider above it.
            const isLast = idx === visibleRows.length - 1 && !hasHiddenRows;
            return (
              <li
                key={row.position}
                className={cn(
                  "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-3 text-sm",
                  !isLast && "border-b border-border/70"
                )}
              >
                <span className="font-mono text-muted-foreground tabular-nums">
                  {String(row.position + 1).padStart(2, "0")}
                </span>
                <span
                  dir="auto"
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground"
                >
                  {row.excerpt}
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    meta.classes
                  )}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
        {hasHiddenRows && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 px-5 py-3 text-sm font-medium text-primary/80 transition-colors",
              "hover:bg-muted/40 hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <span>הצג את כל {byPosition.length} השאלות</span>
            <ChevronDown className="size-4" aria-hidden />
          </button>
        )}
      </section>

      {/* D. Footer CTAs.
          Both use window.location.assign (hard nav) rather than <Link>
          or router.push. Reason: the (app) layout's sidebar branch
          reads `headers().get('x-pathname')`. Next.js App Router reuses
          the parent layout across client-side <Link> transitions
          between sibling pages, so the layout re-renders against a
          stale x-pathname='/exam/results/...' value — isExamRoute
          stays true and the sidebar stays hidden on /dashboard. Hard
          nav forces a fresh request through middleware so the new
          x-pathname='/dashboard' lands and the sidebar mounts. */}
      <div className="flex flex-col-reverse items-stretch gap-2 pb-10 sm:flex-row sm:justify-center">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            window.location.assign("/dashboard");
          }}
          className="sm:min-w-44"
        >
          חזור לדשבורד
        </Button>
        <Button
          size="lg"
          onClick={handleAnother}
          disabled={creating}
          className="sm:min-w-44"
        >
          <span>{creating ? "יוצר סימולציה..." : "סימולציה נוספת"}</span>
          {!creating && <Play className="ms-2 size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}
