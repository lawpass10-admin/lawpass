import type { TopicScore } from "@/lib/scoring/topic-score";
import { cn } from "@/lib/utils";

/**
 * The statistics of one run over a generated paper: the headline score, the
 * split behind it, and the per-subject table.
 *
 * Extracted from <ScoreResults> so the same panel can be drawn for a run that
 * was never filed. A candidate who presses "בדוק שאלות" at question 12 has
 * answered twelve questions and wants the same reading of them that a finished
 * sitting gets — which subject is costing marks, and how far from the pass mark
 * they are. Two different-looking summaries of the same arithmetic would read as
 * two different measures.
 *
 * It says nothing about WHERE the numbers came from — no breadcrumb, no attempt
 * number, no buttons. The screen around it owns that, because a filed sitting
 * and a mid-sitting check lead somewhere different afterwards.
 */
export function ScoreSummary({
  correct,
  total,
  answered,
  pending,
  caption,
  byTopic,
  className,
}: {
  correct: number;
  /** The denominator of the score — the whole paper for a filed sitting, the
   *  questions answered so far for a mid-sitting check. */
  total: number;
  /** How many of `total` were attempted. */
  answered: number;
  /** Questions of the paper still untouched. Given only mid-sitting, where
   *  they are not part of the score; it replaces the "ללא מענה" tally, which
   *  would otherwise read 0 beside thirty unanswered questions. */
  pending?: number;
  /** One line under the score, for what the numbers do not say on their own. */
  caption?: string;
  byTopic: TopicScore[];
  className?: string;
}) {
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  const wrong = Math.max(0, answered - correct);
  const blank = Math.max(0, total - answered);
  const tone = scoreTone(percent);

  return (
    <div className={className}>
      {/* The headline. The score is the one thing this panel exists to say, so
          it gets the width and the weight before anything qualifies it. */}
      <section
        className={cn("rounded-2xl border p-6 md:p-8", tone.box)}
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
            {caption ? (
              <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
            ) : null}
          </div>

          {/* The same total, split three ways. A candidate reading "10/40" wants
              to know immediately how much of the gap was wrong and how much was
              simply never attempted — they are different problems with
              different fixes. */}
          <dl className="grid w-full grid-cols-3 gap-3 md:w-auto md:gap-6">
            <Tally label="נכונות" value={correct} tone="text-emerald-700 dark:text-emerald-400" />
            <Tally label="שגויות" value={wrong} tone="text-red-700 dark:text-red-400" />
            {pending === undefined ? (
              <Tally label="ללא מענה" value={blank} tone="text-muted-foreground" />
            ) : (
              <Tally label="טרם נענו" value={pending} tone="text-muted-foreground" />
            )}
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
export function scoreTone(percent: number): { box: string; text: string; bar: string } {
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
