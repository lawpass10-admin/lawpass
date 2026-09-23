import Link from "next/link";

import { ScoreTrendChart } from "@/app/(app)/dashboard/_components/score-trend-chart";
import type { SubjectStat } from "@/lib/dashboard/subject-stat";

/**
 * The three subject squares at the top of the personal dashboard.
 *
 * One card per study surface — דין מהותי, דין דיוני, מטלת כתיבה — each charting
 * the candidate's score in every exam they have sat in it, dated.
 *
 * THE CARD LEADS WITH A TREND, NOT A TOTAL. It used to headline the number of
 * questions answered, which says how much ground was covered but not whether it
 * is working; "am I improving" is the question a candidate opens this page with,
 * and only a series answers it. The questions-and-sittings count is still here,
 * as the caption under the chart, so the volume reading is not lost.
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

/**
 * One hue per subject, so the three lines are told apart by the card they sit in
 * AND by their colour. Navy and gold are the palette's own two; the writing task
 * takes the strong green already used for a high score, which no line competes
 * with because each card holds exactly one.
 */
const LINE_COLOR: Record<SubjectStat["key"], string> = {
  mahoti: "var(--color-navy-ink)",
  diuni: "var(--color-gold-deep)",
  writing: "var(--color-status-strong)",
};

function SubjectCard({ subject }: { subject: SubjectStat }) {
  const { key, label, href, questions, attempts, exams } = subject;
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

        {/* The headline: one point per exam, in the order they were sat.
            A subject with no scored exam yet keeps the same height as the other
            two — an empty box the size of the chart — so the row does not go
            ragged before a candidate has started. */}
        <div style={{ marginTop: 8 }}>
          {exams.length > 0 ? (
            <ScoreTrendChart exams={exams} color={LINE_COLOR[key]} label={label} />
          ) : (
            <div
              className="flex items-center justify-center rounded-lg border border-dashed"
              style={{
                height: 150,
                borderColor: "var(--color-line)",
                fontSize: 12.5,
                color: "var(--color-ink-muted)",
              }}
            >
              עדיין אין מבחנים בנושא זה
            </div>
          )}
        </div>

        {/* The volume reading the headline used to carry. */}
        <div
          style={{
            fontSize: 12.5,
            color: "var(--color-ink-muted)",
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {untouched
            ? "עדיין לא תרגלת בנושא זה"
            : `${questions} שאלות שענית · ${attempts} ${attempts === 1 ? "מבחן" : "מבחנים"}`}
        </div>

        {/* The lowest / average / highest figures that used to sit here are
            gone. The chart above now prints every score the three of them
            summarised, so they said the same thing three times, less precisely.
            The server still returns them (SubjectStat) — nothing reads them. */}

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0"
          style={{ height: 2, background: "var(--color-gold)" }}
        />
      </article>
    </Link>
  );
}
