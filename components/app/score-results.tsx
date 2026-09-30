import { ArrowLeft, ClipboardCheck, RotateCcw } from "lucide-react";
import Link from "next/link";

import { ExamPageNav } from "@/app/(app)/_components/exam-page-nav";
import { ScoreSummary } from "@/components/app/score-summary";
import { Button } from "@/components/ui/button";
import type { TopicScore } from "@/lib/scoring/topic-score";

/**
 * The results screen for one sitting of a generated paper.
 *
 * WHY THIS IS A PAGE AND NOT A DIALOG. It began as a modal over the paper. A
 * 40-question mahoti sitting spans up to 25 laws, and 25 rows do not fit in a
 * dialog — the table became an inner scroll area inside a scrolling dialog,
 * with the button that matters pushed below both. A results screen is also
 * something a candidate wants to keep, link to and come back to, none of which
 * a modal supports. So it is a route: /mahoti/results and /diuni/results, both
 * addressed by `?attempt=`.
 *
 * Shared by the two subjects. They are marked by different controllers and read
 * from different tables, but a candidate compares them against each other, so
 * one screen draws both — two layouts would read as two standards rather than
 * two subjects.
 *
 * The numbers themselves are drawn by <ScoreSummary>, which the mid-sitting
 * check on the review screens uses as well: the same panel for a paper checked
 * at question 12 and for one filed at question 40.
 */
export function ScoreResults({
  subject,
  correct,
  total,
  answered,
  attempts,
  byTopic,
  reviewUrl,
  backUrl,
  backLabel,
}: {
  /** "דיון מהותי" / "דין דיוני" — used in the breadcrumb and the heading. */
  subject: string;
  correct: number;
  total: number;
  answered: number;
  /** 1-based sitting number for this candidate on this paper. */
  attempts: number;
  byTopic: TopicScore[];
  reviewUrl: string;
  backUrl: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8">
      {/* The breadcrumb still says where this screen sits; the buttons beside
          it are how a candidate leaves. This route renders in focus mode, with
          no sidebar, so an 11px link was the only exit. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-baseline gap-2 font-heebo leading-none" aria-label="פירורי לחם">
          <Link href={backUrl} className="text-[11px] text-muted-foreground hover:underline">
            {subject}
          </Link>
          <span aria-hidden className="text-[11px] text-muted-foreground">
            ›
          </span>
          <span className="text-[11px] font-semibold text-foreground">תוצאות</span>
        </nav>

        <ExamPageNav backHref={backUrl} backLabel={backLabel} />
      </div>

      <header className="mt-3">
        <h1 className="font-heebo text-[26px] font-extrabold tracking-tight md:text-[32px]">
          תוצאות המבחן — {subject}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ניסיון {attempts} · נשמר בהצלחה
        </p>
      </header>

      <ScoreSummary
        className="mt-6"
        correct={correct}
        total={total}
        answered={answered}
        byTopic={byTopic}
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" nativeButton={false} render={<Link href={backUrl} />}>
          <RotateCcw className="size-4" aria-hidden />
          <span className="ms-1.5">{backLabel}</span>
        </Button>
        <Button size="lg" nativeButton={false} render={<Link href={reviewUrl} />}>
          <ClipboardCheck className="size-4" aria-hidden />
          <span className="ms-1.5">עבור לפתרון המלא</span>
          <ArrowLeft className="ms-1.5 size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
