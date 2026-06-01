"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChoiceAnalysisRow } from "@/app/(app)/_components/choice-analysis-row";
import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { Learning360Panel } from "@/app/(app)/practice/play/_components/learning-360-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PracticeReviewRow, SummaryAggregate } from "@/lib/db/practice";
import { practiceSetupUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

type PracticeSummaryProps = {
  summary: SummaryAggregate;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * Slice 21 — per-question review status mapping, mirrors the
 * exam-results equivalent at exam-results.tsx:30-49 so both surfaces
 * share the same pill vocabulary. NOTE: no source/angle label
 * surfaces here — source/angle was removed from the user-facing UI
 * in Slice 18.
 */
const REVIEW_STATUS_COPY: Record<string, { label: string; classes: string }> = {
  correct: {
    label: "נכון",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  wrong: {
    label: "שגוי",
    classes: "bg-destructive/15 text-destructive",
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

function deriveStatusKey(row: PracticeReviewRow): keyof typeof REVIEW_STATUS_COPY {
  if (row.wasSkipped) return "skipped";
  if (row.isCorrect === true) return "correct";
  if (row.isCorrect === false) return "wrong";
  return "unanswered";
}

const REVIEW_INITIAL_ROWS = 5;

export function PracticeSummary({ summary }: PracticeSummaryProps) {
  // Slice 18 — only the aggregate totals are surfaced now. The
  // SummaryAggregate type still carries sourceAnswered / sourceCorrect
  // / angleAnswered / angleCorrect (lib/db/practice.ts); we just stop
  // pulling them into the view.
  // Slice 21 — pull `byPosition` to render the per-question review
  // section below the existing stats.
  const {
    session,
    totalAnswered,
    totalCorrect,
    byBucket,
    archivedSkipped,
    byPosition,
  } = summary;

  const overallPct = pct(totalCorrect, totalAnswered);
  const mistakeCount = totalAnswered - totalCorrect;

  // Slice 21 — per-question review state (same shape as
  // exam-results.tsx ExamResults).
  const [showAllReview, setShowAllReview] = useState(false);
  const [expandedReview, setExpandedReview] = useState<Set<number>>(
    () => new Set()
  );
  function toggleExpandedReview(position: number): void {
    setExpandedReview((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }
  const visibleReviewRows = showAllReview
    ? byPosition
    : byPosition.slice(0, REVIEW_INITIAL_ROWS);
  const hasHiddenReviewRows =
    !showAllReview && byPosition.length > REVIEW_INITIAL_ROWS;

  // PM decision: when a session spans multiple chapters, prefix every
  // subtopic row with the chapter title so users can tell which chapter
  // each row belongs to. Single-chapter sessions stay compact.
  const multiChapter = session.selected_chapters.length > 1;

  const retryUrl = practiceSetupUrl({
    chapters: session.selected_chapters,
    subtopic:
      session.selected_chapters.length === 1 &&
      session.selected_subtopics.length > 0
        ? session.selected_subtopics[0]
        : undefined,
    sourceCount: session.source_count_target,
    angles: session.angles_per_source,
    timePerQuestion: session.time_per_question_seconds,
  });

  // Max answered across buckets so the progress bars share a scale.
  const maxBucketAnswered = byBucket.reduce(
    (m, b) => (b.answered > m ? b.answered : m),
    0
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Topbar */}
      <div className="flex items-center justify-between">
        <nav
          aria-label="ניווט"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/dashboard" className="hover:text-foreground">
            תרגול
          </Link>
          <ChevronLeft className="size-3.5" aria-hidden />
          <span className="font-medium text-foreground">סיכום סשן</span>
        </nav>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          aria-label="סגור"
        >
          <X className="size-4" aria-hidden />
          <span>סגור</span>
        </Link>
      </div>

      {/* Centered header */}
      <div className="space-y-2 pt-4 text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          סיכום סשן
        </p>
        <h1 className="text-4xl font-bold">סיימת.</h1>
        <p className="text-sm text-muted-foreground">
          תרגלת {totalAnswered} שאלות. הנה התמונה.
        </p>
      </div>

      {/* Single overall-success card — Slice 18 dropped the two
          per-type cards ("שאלות מקור" / "שאלות זווית") that used to
          sit beside this one. The SummaryAggregate still carries the
          backing fields; we just stop rendering them. */}
      <div className="grid grid-cols-1 gap-3">
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">אחוז הצלחה</p>
            <p className="text-5xl font-bold tabular-nums">
              {overallPct}
              <span className="text-2xl text-muted-foreground">%</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {totalCorrect} מתוך {totalAnswered} שאלות
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subtopic breakdown */}
      {byBucket.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-base font-semibold">פירוט לפי תת־נושא</h3>
            <ul className="space-y-2">
              {byBucket.map((b, i) => {
                const isArchived =
                  b.chapterTitle === null && b.subtopicTitle === null;
                const label = isArchived
                  ? "—"
                  : multiChapter
                  ? `${b.chapterTitle ?? ""} / ${b.subtopicTitle ?? ""}`
                  : b.subtopicTitle ?? "";
                const bucketPct = pct(b.correct, b.answered);
                const widthPct =
                  maxBucketAnswered > 0
                    ? Math.max(
                        4,
                        Math.round((b.answered / maxBucketAnswered) * 100)
                      )
                    : 0;
                return (
                  <li
                    key={`${i}-${label}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm"
                  >
                    <div className="space-y-1.5">
                      <span dir="auto" className="font-medium">
                        {label}
                      </span>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            bucketPct === 100
                              ? "bg-emerald-500"
                              : bucketPct >= 50
                              ? "bg-primary"
                              : "bg-amber-500"
                          )}
                          style={{ width: `${widthPct}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                    <span className="tabular-nums text-muted-foreground">
                      {b.correct}/{b.answered}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Mistakes vs encouragement banner */}
      {mistakeCount > 0 ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-4 pt-6">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
              aria-hidden
            >
              <TriangleAlert className="size-4" />
            </span>
            <div className="flex-1 space-y-1.5">
              <p className="font-semibold">
                {mistakeCount} שאלות נוספו ל&quot;שאלות שטעיתי בהן&quot;
              </p>
              <p className="text-sm text-muted-foreground">
                תוכל לחזור עליהן בכל עת מהתפריט הצדדי.
              </p>
              <Link
                href="/mistakes"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-2"
                )}
              >
                סקור עכשיו
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        totalAnswered > 0 && (
          <Card className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20">
            <CardContent className="flex items-center gap-3 pt-6">
              <Sparkles
                className="size-5 text-emerald-600"
                aria-hidden
              />
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                🎯 מצוין! ענית נכון על כל השאלות
              </p>
            </CardContent>
          </Card>
        )
      )}

      {/* Slice 21 — per-question review. Mirrors the exam-results
          Section C pattern: collapsed-by-default rows showing
          position + excerpt + status pill, expanding inline to the
          choice rows + a collapsible Learning360Panel. Renders only
          when there's something to review (skipped + answered both
          count). NO source/angle label appears here — Slice 18 removed
          that distinction from the user-facing UI. */}
      {byPosition.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">סקירת שאלות</h2>
          </header>
          <ul>
            {visibleReviewRows.map((row, idx) => {
              const statusKey = deriveStatusKey(row);
              const meta = REVIEW_STATUS_COPY[statusKey];
              const isLast =
                idx === visibleReviewRows.length - 1 && !hasHiddenReviewRows;
              const isOpen = expandedReview.has(row.position);
              return (
                <li
                  key={row.position}
                  className={cn(!isLast && "border-b border-border/70")}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpandedReview(row.position)}
                    aria-expanded={isOpen}
                    className={cn(
                      "grid w-full grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 px-5 py-3 text-start text-sm transition-colors",
                      "hover:bg-muted/40",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
                    {isOpen ? (
                      <ChevronUp
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    ) : (
                      <ChevronDown
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                  </button>
                  {isOpen ? <PracticeQuestionExpansion row={row} /> : null}
                </li>
              );
            })}
          </ul>
          {hasHiddenReviewRows && (
            <button
              type="button"
              onClick={() => setShowAllReview(true)}
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
      ) : null}

      {/* Archived note */}
      {archivedSkipped > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {archivedSkipped} שאלות שהוסרו דולגו במהלך הסשן.
        </p>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          חזור לדשבורד
        </Link>
        <Link
          href={retryUrl}
          className={cn(buttonVariants({ size: "lg" }))}
        >
          תרגול נוסף
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// Per-question expansion — mirrors exam-results.tsx QuestionExpansion
// =============================================================================

/**
 * Slice 21 — the expanded body rendered below a clicked review row.
 * Identical structure to the exam-side `QuestionExpansion`
 * (exam-results.tsx:395-486): full question text, the 4 choice rows
 * (each with the Slice 19 "סימנת" pill), and a collapsible
 * Learning360Panel mounted only when `row.learning` and
 * `row.learning.correctChoice` are both present (archived rows skip
 * the toggle entirely).
 */
function PracticeQuestionExpansion({ row }: { row: PracticeReviewRow }) {
  const [panel360Open, setPanel360Open] = useState(false);
  const canShowPanel =
    row.learning !== null && row.learning.correctChoice !== null;

  return (
    <div className="border-t border-border/70 bg-muted/20 px-5 py-4">
      {row.questionText ? (
        /* Slice 37 — question stem wrapped in <NoCopyText>. */
        <NoCopyText
          dir="auto"
          className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
        >
          {row.questionText}
        </NoCopyText>
      ) : null}
      {row.choices.length > 0 ? (
        <ul className="space-y-2">
          {row.choices.map((choice) => (
            <li key={choice.letter}>
              <ChoiceAnalysisRow
                choice={choice}
                selectedLetter={row.selectedLetter}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          אין נתוני בחירות זמינים לשאלה זו.
        </p>
      )}
      {canShowPanel ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setPanel360Open((v) => !v)}
            aria-expanded={panel360Open}
          >
            {panel360Open ? (
              <>
                <ChevronUp className="size-4" aria-hidden />
                <span className="ms-1.5">הסר פירוט</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-4" aria-hidden />
                <span className="ms-1.5">פירוט 360° מלא</span>
              </>
            )}
          </Button>
          {panel360Open ? (
            <div className="mt-3">
              <Learning360Panel
                question={{ ...row.learning!, choices: row.choices }}
                correctChoice={row.learning!.correctChoice!}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
