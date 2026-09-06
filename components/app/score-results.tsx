import { ArrowLeft, ClipboardCheck, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { TopicScore } from "@/lib/scoring/topic-score";
import { cn } from "@/lib/utils";

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
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  const wrong = Math.max(0, answered - correct);
  const blank = Math.max(0, total - answered);
  const tone = scoreTone(percent);

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 py-8">
      <nav className="flex items-baseline gap-2 font-heebo leading-none">
        <Link
          href="/dashboard"
          className="text-[11px] text-muted-foreground hover:underline"
        >
          דשבורד
        </Link>
        <span aria-hidden className="text-[11px] text-muted-foreground">
          ›
        </span>
        <Link href={backUrl} className="text-[11px] text-muted-foreground hover:underline">
          {subject}
        </Link>
        <span aria-hidden className="text-[11px] text-muted-foreground">
          ›
        </span>
        <span className="text-[11px] font-semibold text-foreground">תוצאות</span>
      </nav>

      <header className="mt-3">
        <h1 className="font-heebo text-[26px] font-extrabold tracking-tight md:text-[32px]">
          תוצאות המבחן — {subject}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ניסיון {attempts} · נשמר בהצלחה
        </p>
      </header>

      {/* The headline. The score is the one thing this page exists to say, so
          it gets the width and the weight before anything qualifies it. */}
      <section
        className={cn("mt-6 rounded-2xl border p-6 md:p-8", tone.box)}
        aria-label="ציון כולל"
      >
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-between">
          <div className="text-center md:text-start">
            <p className="font-mono text-6xl font-bold leading-none md:text-7xl">
              {correct}
              <span className="text-4xl text-muted-foreground md:text-5xl">/{total}</span>
            </p>
            <p className={cn("mt-2 text-lg font-semibold", tone.text)}>
              {percent}% תשובות נכונות
            </p>
          </div>

          {/* The same total, split three ways. A candidate reading "10/40" wants
              to know immediately how much of the gap was wrong and how much was
              simply never attempted — they are different problems with
              different fixes. */}
          <dl className="grid w-full grid-cols-3 gap-3 md:w-auto md:gap-6">
            <Tally label="נכונות" value={correct} tone="text-emerald-700 dark:text-emerald-400" />
            <Tally label="שגויות" value={wrong} tone="text-red-700 dark:text-red-400" />
            <Tally label="ללא מענה" value={blank} tone="text-muted-foreground" />
          </dl>
        </div>

        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full transition-[width]", tone.bar)}
            style={{ width: percent === 0 ? "0%" : `${Math.max(percent, 1.5)}%` }}
          />
        </div>
      </section>

      {byTopic.length > 0 ? (
        <section className="mt-8" aria-label="פילוח לפי נושא">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heebo text-lg font-bold">פילוח לפי נושא</h2>
            {/* Says why the weakest row is first, so the order reads as a
                recommendation rather than an arbitrary sort. */}
            <span className="text-xs text-muted-foreground">
              מסודר מהחלש לחזק — התחילו מלמעלה
            </span>
          </div>

          {/* A real table on a real page: every row visible, no inner scroll. */}
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">נושא</th>
                  <th className="w-24 px-3 py-2.5 text-center font-medium">נכונות</th>
                  <th className="w-[38%] px-4 py-2.5 text-start font-medium">אחוז</th>
                </tr>
              </thead>
              <tbody>
                {byTopic.map((row) => (
                  <tr key={row.topic} className="border-t border-border align-middle">
                    <td className="px-4 py-2.5 leading-snug">{row.topic}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono text-xs tabular-nums">
                      {row.correct}/{row.total}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          {/* A floor keeps a low score visible as a mark — but
                              only above zero. Painting a sliver for 0/3 would
                              show credit that was never earned, in the row the
                              candidate most needs to read correctly. */}
                          <div
                            className={cn("h-full rounded-full", scoreTone(row.percent).bar)}
                            style={{
                              width:
                                row.percent === 0 ? "0%" : `${Math.max(row.percent, 2)}%`,
                            }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-end font-mono text-xs tabular-nums text-muted-foreground">
                          {row.percent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="text-center">
      <dd className={cn("font-mono text-2xl font-bold tabular-nums", tone)}>{value}</dd>
      <dt className="mt-0.5 text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}

/**
 * Colour for a percentage. Three bands rather than a gradient: the reading is
 * "revise this / this is fine", which is a judgement, and a continuous scale
 * asks the candidate to make it themselves. 60 is the Bar's own pass mark and
 * 80 is comfortably clear of it.
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
