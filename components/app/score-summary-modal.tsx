"use client";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TopicScore } from "@/lib/scoring/topic-score";
import { cn } from "@/lib/utils";

/**
 * The result of a sitting, shown the moment it is filed.
 *
 * Used by both /mahoti and /diuni. The two papers are marked by different
 * controllers but read by the same candidate, so one component draws both —
 * a score that looked different on the two screens would read as two different
 * standards rather than two different subjects.
 *
 * WHY A STEP BEFORE THE SOLUTION. Opening the full review straight away buries
 * the score: the candidate lands in question 1 of 40 and has to infer how they
 * did from scrolling. This answers the two questions they actually have —
 * how many did I get, and which subjects cost me — and then hands them the
 * solution deliberately.
 */
export function ScoreSummaryModal({
  open,
  onOpenChange,
  correct,
  total,
  answered,
  attempts,
  byTopic,
  reviewUrl,
  title = "תוצאות המבחן",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  correct: number;
  total: number;
  /** How many were attempted. Blanks count as wrong, but "30/32 attempted" is
   *  a different claim from "30/40" and the candidate is owed both. */
  answered?: number;
  /** 1-based sitting number for this candidate on this paper. */
  attempts?: number;
  byTopic?: TopicScore[];
  reviewUrl: string;
  title?: string;
}) {
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  const blank = answered === undefined ? 0 : total - answered;
  const rows = byTopic ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Capped and scrollable: forty questions can span a dozen subjects, and
          the button below must stay reachable without the dialog growing past
          the viewport on a laptop. */}
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {attempts
              ? `ניסיון ${attempts} · נשמר בהצלחה`
              : "המבחן נשמר בהצלחה"}
          </DialogDescription>
        </DialogHeader>

        {/* The headline. Deliberately the largest thing on the screen — it is
            the one number the candidate opened this to see. */}
        <div
          className={cn(
            "rounded-xl border p-4 text-center",
            scoreTone(percent).box,
          )}
        >
          <p className="font-mono text-4xl font-bold leading-none">
            {correct}
            <span className="text-2xl text-muted-foreground">/{total}</span>
          </p>
          <p className={cn("mt-1.5 text-sm font-medium", scoreTone(percent).text)}>
            {percent}% תשובות נכונות
          </p>
          {blank > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {blank} שאלות נותרו ללא מענה ונחשבו כשגויות
            </p>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">פילוח לפי נושא</h3>
              {/* Says why the weakest row is at the top, so the order reads as
                  a recommendation rather than as an arbitrary sort. */}
              <span className="text-[11px] text-muted-foreground">
                החלשים ביותר תחילה
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">נושא</th>
                    <th className="px-3 py-2 text-center font-medium">נכונות</th>
                    <th className="px-3 py-2 text-start font-medium">אחוז</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.topic}
                      className="border-t border-border align-middle"
                    >
                      <td className="px-3 py-2">{row.topic}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-center font-mono text-xs">
                        {row.correct}/{row.total}
                      </td>
                      <td className="px-3 py-2">
                        {/* Bar plus number: the bar makes the weak subjects
                            findable at a glance, the number keeps it precise. */}
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
                            role="presentation"
                          >
                            {/* A floor of 2% keeps a very low score visible as
                                a mark rather than as nothing — but only above
                                zero. Painting a sliver for 0/4 would show
                                credit where none was earned, in the one row
                                the candidate most needs to read correctly. */}
                            <div
                              className={cn("h-full rounded-full", scoreTone(row.percent).bar)}
                              style={{
                                width:
                                  row.percent === 0
                                    ? "0%"
                                    : `${Math.max(row.percent, 2)}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {row.percent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          {/* Opened in a new tab, matching what the screens did before this
              modal existed: the paper stays where it is, so a candidate can
              close the solution and still be on their own sitting. */}
          <Button
            nativeButton={false}
            render={<a href={reviewUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <span>עבור לפתרון המלא</span>
            <ArrowLeft className="ms-1.5 size-4" aria-hidden />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Colour for a percentage.
 *
 * Three bands rather than a gradient: the point is "revise this / this is fine",
 * which is a judgement, and a continuous scale asks the candidate to make it
 * themselves. 60 is the Bar's own pass mark and 80 is comfortably clear of it.
 */
function scoreTone(percent: number): { box: string; text: string; bar: string } {
  if (percent >= 80) {
    return {
      box: "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20",
      text: "text-emerald-700 dark:text-emerald-400",
      bar: "bg-emerald-500",
    };
  }
  if (percent >= 60) {
    return {
      box: "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-700 dark:text-amber-400",
      bar: "bg-amber-500",
    };
  }
  return {
    box: "border-red-500/40 bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-400",
    bar: "bg-red-500",
  };
}
