"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TopicStat } from "@/lib/dashboard/topic-stat";

/**
 * The two charts at the top of each dashboard tab.
 *
 *   1. Pie  — how the candidate's practice is DISTRIBUTED across laws.
 *   2. Bar  — what they actually SCORE in each, stacked correct/incorrect.
 *
 * Aggregated over every sitting, not one paper. The per-paper version already
 * exists on the results screen; this is the picture that says what to revise.
 *
 * READABILITY IS SOLVED UPSTREAM, NOT HERE. A diuni history spans 30+ raw legal
 * areas over 40 questions, which as a pie is a colour wheel rather than a chart.
 * That is fixed by grouping the areas into ~14 buckets before they arrive
 * (lawpass_server/lib/buckets_mapping.json), so these charts can simply draw
 * what they are given. The "אחר" tail below is now only a guard for an area that
 * falls through the mapping unbucketed — it is not the mechanism that keeps the
 * chart readable, and using it as one hid five real buckets and twelve answered
 * questions.
 */

/**
 * How many buckets each chart draws before the rest are rolled into "אחר".
 *
 * Set to the size of the bucket vocabulary, so in practice nothing is hidden:
 * the areas were already grouped into ~14 categories upstream
 * (lawpass_server/lib/buckets_mapping.json), and hiding five of those behind
 * "אחר" was throwing away real results — one candidate had 12 questions in the
 * bucket, including a category they had scored 100% in. The tail only appears
 * now if an area falls through the mapping unbucketed, which is the case it was
 * meant for.
 */
const TOP_N = 14;
const OTHER = "אחר";

/**
 * Width of the column to the right of the bars holding the category names.
 *
 * Set as the category axis's `width`. recharts insets the plot area by
 * `margin.right + rightAxesOffset` (selectChartOffsetInternal.js), so this both
 * shortens every bar by 220px and gives the axis a box to render its ticks in.
 * Moving the same 220 onto `margin.right` and zeroing the width also shortens
 * the bars — and renders no labels at all, because an axis with no width draws
 * no ticks.
 *
 * 220 fits the longest bucket name at 13px — "אתיקה ותורת המשפט",
 * "משפט חוקתי ומנהלי" — without truncation.
 */
const LABEL_GUTTER = 220;

/**
 * The pass line drawn across the score chart.
 *
 * 50% is the mark the Bar itself uses, so it is the one number that turns a bar
 * from "some green" into a verdict. Drawn in the palette's warning orange and
 * dashed, so it reads as a threshold rather than as another series.
 */
const PASS_MARK = 50;

/**
 * Slice colours, from the site's own palette rather than recharts' defaults.
 *
 * A CATEGORICAL palette, not a ramp. The first version walked navy through gold
 * in even steps, which is the right tool for an ordered quantity and the wrong
 * one here: nothing orders "דיני חוזים" against "מיסים", and adjacent steps of a
 * two-hue ramp are nearly the same colour, so a fourteen-slice pie became a
 * gradient the eye could not separate back into categories.
 *
 * These are spaced around the wheel instead, anchored on the site's navy and
 * gold. The set was chosen by measurement rather than by eye: no two of the
 * fourteen are closer than ΔE 20 in CIELAB — the threshold below which two
 * fills read as "the same colour, roughly" at slice size. The previous ramp had
 * SIXTEEN pairs under that, its closest at ΔE 6.6.
 *
 * Anything separating fourteen categories that well has to span the hue wheel,
 * so a few of these are further from navy-and-gold than the rest of the app.
 * That is the trade: a palette that stays strictly on-brand cannot separate this
 * many slices, and an unreadable chart is worse than an unexpected colour.
 *
 * The tail bucket is deliberately the flattest grey: it is the one slice that
 * means "several things", so it should never be the one the eye lands on.
 */
const SLICE_COLORS = [
  "#12224a", // navy — site anchor
  "#c9a149", // gold — site anchor
  "#2f7d72", // deep teal
  "#a2454b", // muted crimson
  "#5488c4", // mid blue
  "#6a4f8f", // violet
  "#6f9440", // olive
  "#2b6081", // petrol
  "#8a5a3c", // brown
  "#a8518c", // mauve
  "#54b3a3", // mint
  "#8e94a8", // slate
  "#4a4fb5", // indigo
  "#4fb04f", // green
];
const OTHER_COLOR = "#c3c8d2";

const CORRECT_COLOR = "#1F8A5B"; // --color-status-strong
const WRONG_COLOR = "#e3e6ec";

/**
 * A category label in the bar chart's right-hand gutter.
 *
 * THE TEXT MUST GROW RIGHTWARD FROM `x`, INTO THE GUTTER. That is the whole
 * job, and it is where two earlier attempts went wrong: the label was given
 * `direction: rtl` together with `textAnchor="start"`, and for right-to-left
 * text "start" is the RIGHT edge — so every name anchored at x and ran
 * backwards across the bars. The reserved gutter was correct all along; the
 * text was simply pointing the wrong way out of it.
 *
 * So the element's own direction stays LTR (inherited from the dir="ltr"
 * wrapper), which makes `textAnchor="start"` mean the visual left edge and the
 * text extend rightward. `unicodeBidi: "plaintext"` is what keeps the Hebrew
 * itself correct inside that box: the run's direction is taken from its own
 * first strong character rather than from the LTR container, so the words read
 * right-to-left and any digits or punctuation land on the right end.
 */
function CategoryTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const { x = 0, y = 0, payload } = props;
  return (
    <text
      x={x + 10}
      y={y}
      dy={4}
      textAnchor="start"
      fontSize={13}
      fill="var(--color-ink-dim)"
      style={{ unicodeBidi: "plaintext" }}
    >
      {payload?.value ?? ""}
    </text>
  );
}

/** Recharts hands tooltip formatters a loose `ValueType` that may be undefined. */
function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Long Hebrew law names need trimming before they reach an axis tick. */
function shortLabel(topic: string, max = 30): string {
  const clean = topic.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Top N by volume, with everything else folded into one bucket. */
function withTail(rows: TopicStat[]): { topic: string; questions: number }[] {
  if (rows.length <= TOP_N) {
    return rows.map((r) => ({ topic: r.topic, questions: r.questions }));
  }
  const head = rows.slice(0, TOP_N);
  const tail = rows.slice(TOP_N);
  return [
    ...head.map((r) => ({ topic: r.topic, questions: r.questions })),
    { topic: OTHER, questions: tail.reduce((n, r) => n + r.questions, 0) },
  ];
}

export function TopicCharts({
  rows,
  emptyMessage,
  dimensionLabel,
  surface,
}: {
  rows: TopicStat[];
  /** Shown instead of the charts when nothing has been practised yet. */
  emptyMessage: string;
  /**
   * What the rows are grouped BY, for the two headings.
   *
   * Not fixed, because it differs by subject and saying the wrong one is a
   * factual error rather than a wording preference. מהותי and דיוני are grouped
   * into practice areas (buckets), so they read "תחום התמחות"; a writing task's
   * subject really is a single named statute, so it stays "חוק".
   */
  dimensionLabel: string;
  /**
   * Background for the two chart cards.
   *
   * Carries the tab's own tint down onto the charts, so the subject a candidate
   * is looking at is identified by the whole panel rather than by one tab they
   * stopped looking at the moment they started reading. Defaults to the normal
   * card surface.
   */
  surface?: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed p-10 text-center text-sm"
        style={{
          borderColor: "var(--color-line)",
          color: "var(--color-ink-muted)",
          background: surface,
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const pieData = withTail(rows);
  const totalQuestions = rows.reduce((n, r) => n + r.questions, 0);

  // Both charts grow with the number of buckets rather than sitting at a fixed
  // height. At 13 buckets a 280px box gave every bar ~14px and squeezed the
  // legend to nine visible entries out of thirteen — the chart was hiding its
  // own data. 30px a row is the floor at which a Hebrew label stays legible.
  const barHeight = Math.max(300, rows.slice(0, TOP_N).length * 30 + 40);
  const pieHeight = Math.max(320, pieData.length * 26 + 90);

  // The bar shows real laws only, best-scoring first so the weakest sit at the
  // bottom where the eye finishes.
  const barData = rows
    .slice(0, TOP_N)
    .map((r) => ({
      topic: r.topic,
      label: shortLabel(r.topic),
      correct: r.percent,
      wrong: Math.max(0, 100 - r.percent),
      questions: r.questions,
    }))
    .sort((a, b) => b.correct - a.correct);

  return (
    <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
      <ChartCard
        surface={surface}
        title={`פילוח התרגול לפי ${dimensionLabel}`}
        subtitle={`${totalQuestions} שאלות · ${rows.length} תחומים`}
      >
        <ResponsiveContainer width="100%" height={pieHeight}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="questions"
              nameKey="topic"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={104}
              paddingAngle={1.5}
              stroke={surface ?? "var(--card)"}
              strokeWidth={2}
            >
              {pieData.map((entry, i) => (
                <Cell
                  key={entry.topic}
                  fill={entry.topic === OTHER ? OTHER_COLOR : SLICE_COLORS[i % SLICE_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [`${asNumber(value)} שאלות`, String(name)]}
            />
            <Legend
              layout="vertical"
              align="left"
              verticalAlign="middle"
              iconType="circle"
              iconSize={10}
              formatter={(value: string) => (
                <span style={{ fontSize: 13, color: "var(--color-ink-dim)", lineHeight: 1.7 }}>
                  {shortLabel(value, 26)}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        surface={surface}
        title={`ציון ממוצע לפי ${dimensionLabel}`}
        subtitle="אחוז תשובות נכונות בכל תחום"
      >
        {/* dir="ltr" ON THE CHART, DELIBERATELY. The page is RTL, but recharts
            computes its plot geometry as if it were LTR: under an RTL ancestor
            the axis reserved its gutter on one side while the bars were drawn
            from the other, and the category names ended up printed on top of the
            bars. Pinning the container to LTR makes the geometry predictable;
            the labels themselves are still rendered RTL by CategoryTick below,
            so the Hebrew reads correctly inside an LTR box. */}
        <div dir="ltr">
          <ResponsiveContainer width="100%" height={barHeight}>
            {/* Horizontal bars: Hebrew law names are far too long for a category
                axis along the bottom. `reversed` grows them right-to-left, and
                the category axis sits in its own gutter to their right. */}
            {/* THE GUTTER IS THE AXIS `width`, and it has to be non-zero.
                recharts insets the plot by `margin.right + rightAxesOffset`
                (selectChartOffsetInternal.js), so either lever shortens the
                bars — but an axis of width 0 renders no ticks, which took the
                labels away entirely. The width both reserves the column AND
                gives the ticks somewhere to draw. */}
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
              barCategoryGap={6}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                reversed
                tick={{ fontSize: 12.5, fill: "var(--color-ink-muted)" }}
                tickFormatter={(v: number) => `${v}%`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                orientation="right"
                width={LABEL_GUTTER}
                tick={<CategoryTick />}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                contentStyle={{ ...TOOLTIP_STYLE, direction: "rtl" }}
                formatter={(value, name) => [
                  `${Math.round(asNumber(value) * 10) / 10}%`,
                  name === "correct" ? "ציון ממוצע" : "לא נצבר",
                ]}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.topic ?? ""
                }
              />
              {/* Drawn BEFORE the bars so a bar that crosses it stays readable:
                  the line is a reference, not something to occlude the data. */}
              <ReferenceLine
                x={PASS_MARK}
                stroke="var(--color-status-weak)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
              {/* Stacked to 100: what was scored, and what was left on the table.
                  Reading the gap is the point — a 40% bar is 60% of visible grey. */}
              <Bar dataKey="correct" stackId="s" fill={CORRECT_COLOR} radius={[0, 3, 3, 0]} />
              <Bar dataKey="wrong" stackId="s" fill={WRONG_COLOR} radius={[3, 0, 0, 3]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--color-line)",
  background: "var(--card)",
  fontSize: 13,
  padding: "9px 12px",
  boxShadow: "0 8px 24px -8px rgba(0,0,0,.18)",
} as const;

function ChartCard({
  title,
  subtitle,
  surface,
  children,
}: {
  title: string;
  subtitle: string;
  surface?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-xl"
      style={{
        background: surface ?? "var(--card)",
        border: "1px solid var(--color-line)",
        padding: "14px 16px 8px",
      }}
    >
      <header className="mb-2">
        <h3
          className="font-heebo font-bold"
          style={{ fontSize: 16, color: "var(--color-navy-ink)" }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--color-ink-muted)", marginTop: 3 }}>
          {subtitle}
        </p>
      </header>
      {children}
    </section>
  );
}
