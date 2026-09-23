"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SubjectStat } from "@/lib/dashboard/subject-stat";

/**
 * One subject's score per exam, in the order the candidate sat them.
 *
 * A LINE, because the job is change over time: the question this card answers is
 * "am I improving", which a single average cannot answer and a bar chart of
 * unrelated columns answers badly. One point per exam, x is the exam's number
 * with its date beneath, y is the score as a percentage.
 *
 * ONE SERIES, SO NO LEGEND — the card's heading names it.
 *
 * EVERY POINT CARRIES ITS SCORE. Normally a chart labels selectively and leaves
 * the rest to the tooltip, because a number over every point competes with the
 * line it describes. Here the numbers were asked for, and they are the reason
 * the three summary figures under the card could go: the chart now states every
 * score it used to summarise. The labels are set small and in muted ink so the
 * line still reads as the shape of the trend.
 *
 * The y-axis is pinned to 0-100 rather than fitted to the data. Fitted, a run of
 * 62/64/63 becomes a dramatic mountain range, and the three cards would each use
 * a different scale — so the same height would mean a different score in each,
 * which is the one thing three cards side by side must not do.
 */

/** The Bar's own pass mark, drawn as a reference line. */
const PASS_MARK = 60;

/** Height of the plot, including the two-line axis labels under it. */
const CHART_HEIGHT = 150;

type Exam = SubjectStat["exams"][number];

/** "23.9" — day and month, no year. The axis has one tick per exam and three of
 *  these cards share a row, so the year is width this cannot spend; the full
 *  date is on the tooltip. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function fullDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ScoreTrendChart({
  exams,
  /** The line's colour. One hue per card, so a glance tells the subjects apart. */
  color,
  label,
}: {
  exams: Exam[];
  color: string;
  label: string;
}) {
  const data = exams.map((exam, i) => ({
    exam: i + 1,
    score: exam.score,
    date: shortDate(exam.date),
    fullDate: fullDate(exam.date),
  }));

  return (
    <div style={{ direction: "ltr" }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 18, right: 12, bottom: 4, left: -18 }}>
          {/* Recessive: horizontal only, so the grid reads as a scale behind the
              line rather than as graph paper competing with it. */}
          <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="exam"
            type="number"
            // The ticks are exam numbers, so the domain is the exam count and
            // every tick is a whole number — `allowDecimals` off stops recharts
            // offering "1.5" on a two-exam history. `interval={0}` keeps every
            // exam labelled rather than letting recharts thin them out, since
            // each label carries a date that belongs to one specific point.
            domain={[1, Math.max(data.length, 2)]}
            allowDecimals={false}
            interval={0}
            ticks={data.map((d) => d.exam)}
            tick={<ExamTick data={data} />}
            height={34}
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          {/* Drawn before the line so a line crossing it stays readable: the
              pass mark is a reference, not something to occlude the data. */}
          <ReferenceLine
            y={PASS_MARK}
            stroke="var(--color-status-weak)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <Tooltip
            cursor={{ stroke: "var(--color-line)", strokeWidth: 1 }}
            contentStyle={{
              direction: "rtl",
              background: "var(--card)",
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              fontSize: 12.5,
              padding: "6px 10px",
            }}
            // The tooltip carries the full date the axis had to abbreviate.
            labelFormatter={(exam, payload) => {
              const when = payload?.[0]?.payload?.fullDate;
              return when ? `מבחן ${exam} · ${when}` : `מבחן ${exam}`;
            }}
            // Unannotated, so the parameter types come from recharts' own
            // Formatter rather than from a narrower guess that will not accept
            // it (the same pattern topic-charts.tsx uses).
            formatter={(value) => [`${Number(value)}%`, label]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            // A 2px ring in the surface colour, so a dot sitting on the line or
            // on the grid still reads as its own mark.
            dot={{ r: 4, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
            // `unknown` per field rather than the narrower shape this actually
            // receives: the prop is contravariant, so a hand-written parameter
            // type has to accept everything recharts' own label Props can hold
            // (its `value` includes null, which a number|string annotation
            // rejects). The values are converted below.
            label={(props: { x?: unknown; y?: unknown; value?: unknown; index?: unknown }) => {
              const { x, y, value, index } = props;
              if (x === undefined || y === undefined || value === null) return <g />;
              return (
                <text
                  key={String(index)}
                  x={Number(x)}
                  y={Number(y) - 10}
                  textAnchor="middle"
                  // Text wears an ink token, never the series colour: the dot
                  // beside it already carries the identity.
                  fill="var(--color-ink-dim)"
                  fontSize={10.5}
                  fontWeight={700}
                >
                  {String(value)}
                </text>
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * One x-axis tick: the exam's number, and its date on a second line under it.
 *
 * A custom tick rather than a `tickFormatter`, because a formatter returns one
 * string and this is two lines with their own sizes — the number is what the
 * point IS, the date is when it happened.
 *
 * The number alone, not "מבחן 3": three of these cards share a row, and at ten
 * exams the word costs more width than the axis has. The tooltip spells it out.
 */
function ExamTick({
  x,
  y,
  payload,
  data,
}: {
  x?: number;
  y?: number;
  payload?: { value?: number };
  data: { exam: number; date: string }[];
}) {
  const exam = payload?.value;
  const date = data.find((d) => d.exam === exam)?.date ?? "";

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text
        textAnchor="middle"
        dy={12}
        fontSize={11}
        fontWeight={600}
        fill="var(--color-ink-dim)"
      >
        {exam}
      </text>
      <text textAnchor="middle" dy={25} fontSize={9.5} fill="var(--color-ink-muted)">
        {date}
      </text>
    </g>
  );
}
