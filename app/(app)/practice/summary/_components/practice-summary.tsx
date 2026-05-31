"use client";

import { ChevronLeft, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SummaryAggregate } from "@/lib/db/practice";
import { practiceSetupUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

type PracticeSummaryProps = {
  summary: SummaryAggregate;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function PracticeSummary({ summary }: PracticeSummaryProps) {
  // Slice 18 — only the aggregate totals are surfaced now. The
  // SummaryAggregate type still carries sourceAnswered / sourceCorrect
  // / angleAnswered / angleCorrect (lib/db/practice.ts); we just stop
  // pulling them into the view.
  const { session, totalAnswered, totalCorrect, byBucket, archivedSkipped } =
    summary;

  const overallPct = pct(totalCorrect, totalAnswered);
  const mistakeCount = totalAnswered - totalCorrect;

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
