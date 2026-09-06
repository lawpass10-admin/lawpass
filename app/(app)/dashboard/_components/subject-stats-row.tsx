import Link from "next/link";

import type { SubjectStat } from "@/lib/dashboard/subject-stat";
import { cn } from "@/lib/utils";

/**
 * The three subject squares at the top of the personal dashboard.
 *
 * One card per study surface — דין מהותי, דין דיוני, מטלת כתיבה — each showing
 * how many QUESTIONS the candidate has answered in it and the average, lowest
 * and highest they have scored.
 *
 * WHY QUESTIONS AND NOT SITTINGS. A candidate who has opened four papers and
 * finished none has done less work than one who finished two, and a count of
 * papers says the opposite. The sitting count is still there, small, under the
 * question count, so both readings are available.
 *
 * Presentational only — the fetch lives in `subject-stats-row-async.tsx`, the
 * same split every other card on this page uses so the row can stream behind
 * its own Suspense boundary.
 */
export function SubjectStatsRow({ subjects }: { subjects: SubjectStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
      {subjects.map((subject) => (
        <SubjectCard key={subject.key} subject={subject} />
      ))}
    </div>
  );
}

function SubjectCard({ subject }: { subject: SubjectStat }) {
  const { label, href, questions, attempts, average, lowest, highest } = subject;
  const untouched = questions === 0;

  return (
    <Link
      href={href}
      aria-label={label}
      className="block rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <article
        className="relative overflow-hidden rounded-xl"
        style={{
          background: "var(--card)",
          border: "1px solid var(--color-line)",
          padding: "16px 18px",
        }}
      >
        <h3
          className="font-heebo font-bold"
          style={{ fontSize: 15, color: "var(--color-navy-ink)", textAlign: "center" }}
        >
          {label}
        </h3>

        {/* The headline is the work done, not the score. A candidate opens this
            card to see how much ground they have covered; the three figures
            below qualify it. */}
        <div
          className="font-heebo font-extrabold tabular-nums"
          style={{
            fontSize: 40,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: "var(--color-navy-ink)",
            textAlign: "center",
            marginTop: 10,
          }}
        >
          {questions}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--color-ink-muted)",
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {untouched
            ? "עדיין לא תרגלת בנושא זה"
            : `שאלות שענית · ${attempts} ${attempts === 1 ? "מבחן" : "מבחנים"}`}
        </div>

        {/* Lowest, average, highest — in that order so the average sits in the
            middle, between the two extremes it lies between. The average is the
            figure a candidate actually reads, so it is the larger and heavier of
            the three; the extremes flank it in red and green and are deliberately
            quieter.

            Rendered even when empty, so the three cards keep one height and the
            row does not go ragged when a subject has not been started. */}
        <div
          className="mt-3.5 grid grid-cols-3 gap-1 border-t pt-3"
          style={{ borderColor: "var(--color-line)" }}
        >
          <Figure label="הנמוך" value={lowest} tone="low" />
          <Figure label="ממוצע" value={average} tone="average" emphasis />
          <Figure label="הגבוה" value={highest} tone="high" />
        </div>

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0"
          style={{ height: 2, background: "var(--color-gold)" }}
        />
      </article>
    </Link>
  );
}

/**
 * Colour per figure: the worst sitting reads red, the best green, the average
 * neutral — it is a summary, not a verdict.
 *
 * Both come from the palette rather than from raw hex, so they follow the theme
 * into dark mode. `--color-destructive` is used for the low figure rather than
 * `--color-status-weak`, which is the burnt orange (#C2410C) this design system
 * reserves for warnings — it does not read as red beside the green.
 */
const FIGURE_COLOR: Record<"low" | "average" | "high", string> = {
  low: "var(--color-destructive)",
  average: "var(--color-navy-ink)",
  high: "var(--color-status-strong)",
};

/**
 * One of the three score figures.
 *
 * A null score renders "—", never "0%". The candidate has not scored zero in a
 * subject they have never sat, and a dashboard that says they have is telling
 * them something false about their own progress.
 *
 * A null also drops the red/green: an empty figure is muted whatever slot it is
 * in. Colouring a dash would say "your worst is bad" about a subject with no
 * scores in it at all.
 */
function Figure({
  label,
  value,
  tone,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  tone: "low" | "average" | "high";
  emphasis?: boolean;
}) {
  const empty = value === null;

  return (
    <div style={{ textAlign: "center" }}>
      <div
        className={cn(
          "font-heebo tabular-nums",
          emphasis ? "font-extrabold" : "font-semibold",
        )}
        style={{
          // The average carries the card, so it is a step larger than the two
          // extremes flanking it.
          fontSize: emphasis ? 21 : 16,
          color: empty ? "var(--color-ink-muted)" : FIGURE_COLOR[tone],
          lineHeight: 1.1,
        }}
      >
        {empty ? "—" : `${value}%`}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--color-ink-muted)",
          marginTop: 2,
          fontWeight: emphasis ? 600 : 400,
        }}
      >
        {label}
      </div>
    </div>
  );
}
