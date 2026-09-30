"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
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
 *
 * A PERCENTAGE, rescaled to whatever unit the chart draws in: on a writing tab
 * marked out of 20 points the same line sits at 10. Same threshold, same data,
 * stated in the unit the reader is looking at.
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

/** The earned figure, laid over the green bar. The same light grey as WRONG_COLOR. */
const AWARDED_COLOR = WRONG_COLOR;

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

/** One decimal, and no trailing ".0" — the marks come in halves (15.5, 4). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The points earned, printed across the middle of its own bar.
 *
 * A custom renderer rather than a `position`, for two reasons. The figure is
 * centred in the bar, which no built-in position gives on a stacked horizontal
 * bar; and a thin bar cannot hold text at all — לשון scored 0.5 is a few
 * pixels of green, and a light figure laid over it would spill onto the light
 * grey behind and disappear. Under a threshold it moves out of the bar and
 * changes to ink, which is the same trick the bar itself uses: say it where it
 * can be read.
 *
 * THE RECT ARRIVES INSIDE OUT. recharts sets a horizontal bar's `x` to where
 * its stack segment BEGINS and its `width` to `end - begin` (Bar.js), and this
 * axis is `reversed` — zero on the right, the full mark on the left — so a bar
 * that grows leftward reports a NEGATIVE width and an `x` at its zero end. Read
 * naively, every bar looks narrower than the threshold below, which put every
 * figure outside its bar in dark ink: exactly the thing the fallback exists to
 * avoid. Both edges are normalised first, so the sign of the axis cannot reach
 * the placement.
 *
 * Exported for the geometry test — recharts draws its bar rectangles through
 * animation frames jsdom never delivers, so this cannot be checked on a
 * rendered chart.
 */
export function AwardedLabel(props: {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
  value?: unknown;
}) {
  const rawX = Number(props.x);
  const rawWidth = Number(props.width);
  const y = Number(props.y);
  const height = Number(props.height);
  if (!Number.isFinite(rawX) || !Number.isFinite(y) || !Number.isFinite(rawWidth)) {
    return <g />;
  }

  const width = Math.abs(rawWidth);
  const farEnd = Math.min(rawX, rawX + rawWidth);
  const roomy = width >= 34;
  return (
    <text
      x={roomy ? farEnd + width / 2 : farEnd - 6}
      y={y + height / 2}
      dy={4}
      textAnchor={roomy ? "middle" : "end"}
      // The chart's own light grey, the one the remainder bar is filled with,
      // rather than a second grey invented for this. Outside the bar it has to
      // change: light grey on the light grey remainder is nothing at all.
      fill={roomy ? AWARDED_COLOR : "var(--color-ink-dim)"}
      fontSize={12}
      fontWeight={700}
    >
      {String(props.value ?? "")}
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

/**
 * Top N by volume, with everything else folded into one bucket.
 *
 * `points` rides along because the pie is sized by it in the rubric view; a
 * slice whose points were dropped here would be drawn as nothing at all.
 */
function withTail(
  rows: TopicStat[]
): { topic: string; questions: number; points: number }[] {
  const keep = (r: TopicStat) => ({
    topic: r.topic,
    questions: r.questions,
    points: r.points ?? 0,
  });
  if (rows.length <= TOP_N) return rows.map(keep);
  const tail = rows.slice(TOP_N);
  return [
    ...rows.slice(0, TOP_N).map(keep),
    {
      topic: OTHER,
      questions: tail.reduce((n, r) => n + r.questions, 0),
      points: tail.reduce((n, r) => n + (r.points ?? 0), 0),
    },
  ];
}

export function TopicCharts({
  rows,
  emptyMessage,
  dimensionLabel,
  surface,
  maxPoints,
  total,
  scoreContext,
  scoreRows,
  scoreDimensionLabel,
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
  /**
   * The mark every answer in these rows was scored out of, if they share one —
   * 20 for the writing task.
   *
   * Set, the score chart is drawn in points: a law is "15.5 נק'" rather than
   * "77.5%", which is the sentence the marked answer itself carries. Null or
   * absent (both multiple-choice subjects, where a question is right or wrong
   * rather than worth points) keeps the chart on percentages.
   */
  maxPoints?: number | null;
  /**
   * The mark ONE answer was given, which the score card then leads with.
   *
   * Only a single marked task has one. Summing the rows instead would put a
   * number over the whole-history view too — the three averages added up — and
   * that figure is not a mark anybody was ever given: it is what the candidate
   * would have scored on an imaginary task that went exactly averagely. The
   * card is headline-less there, which is the honest amount to say.
   */
  total?: { points: number; max: number } | null;
  /**
   * A line under the title naming what the card is about — for a single מטלת
   * כתיבה, the law it was set on. Without it the card reads the same for
   * every task in the list, and the picker is the only thing saying which one
   * is on screen.
   */
  scoreContext?: string;
  /**
   * Rows for the SCORE chart alone, when it measures something other than the
   * pie beside it.
   *
   * The whole-history view of מטלת כתיבה is the case: practice is
   * distributed across LAWS, which is what the pie is for, but a written
   * answer's score breaks down into the three things it was marked on, and
   * "which of תוכן / לשון / ארגון is weakest" is the question the score
   * chart is read for. Averaging a law's percentage and calling it a score said
   * less, from the same data.
   *
   * Absent, both charts draw `rows`, which is every other tab.
   */
  scoreRows?: TopicStat[];
  /** What `scoreRows` are grouped by, for that card's heading. */
  scoreDimensionLabel?: string;
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

  // The score chart's own rows, where it has them. An empty set is ignored
  // rather than drawn as an empty card: a candidate whose answers predate
  // dimension-level grading still has a by-law score chart to read.
  const separateScoreRows = scoreRows !== undefined && scoreRows.length > 0;
  const drawn = (separateScoreRows ? scoreRows : rows).slice(0, TOP_N);
  const scoreLabel = separateScoreRows
    ? (scoreDimensionLabel ?? dimensionLabel)
    : dimensionLabel;

  // THE RUBRIC VIEW, and the rows themselves say when it applies: a row that
  // carries its own `pointsMax` is one of the three things a written answer was
  // marked on (תוכן out of 12, לשון and ארגון out of 4 each), not a law
  // among comparable laws. Two consequences, both of them the point of the
  // mode: every bar runs to ITS OWN maximum rather than to a shared one, and
  // the pie sizes its slices by the points scored rather than by a question
  // count that is 1 for all three.
  const perRowMax = drawn.every((r) => typeof r.pointsMax === "number" && r.pointsMax > 0);
  // What the green segment IS, in one phrase, for the tooltip: a mark on one
  // answer, the same mark averaged over many, or — with no points anywhere in
  // play — a percentage of questions answered correctly.
  const scoreSeriesName = !perRowMax
    ? "ציון ממוצע"
    : separateScoreRows
      ? "ניקוד ממוצע"
      : "ניקוד";

  // Points only when the scale is known AND every row carries one. A chart with
  // some bars in points and some in percent would be unreadable in the worst
  // way — it would still look fine — so one missing value puts all of them back
  // on percentages, which every row always has.
  const inPoints =
    drawn.every((r) => typeof r.points === "number") &&
    (perRowMax || (typeof maxPoints === "number" && maxPoints > 0));
  // The widest ceiling any row has, so תוכן's twelve sets the axis and לשון's
  // four is visibly a quarter of it — which is exactly the weighting the rubric
  // gives them, and the reason a shared axis is right even here.
  const axisMax = perRowMax
    ? Math.max(...drawn.map((r) => r.pointsMax as number))
    : inPoints
      ? (maxPoints as number)
      : 100;

  // THE FULL MARKS, ON THE SCALE. לשון and ארגון are both out of 4, so a 4
  // on the axis is where a perfect bar for either of them ends — the reference
  // the reader needs, stated once under all three rows rather than repeated at
  // the end of each. Added TO the scale the axis would have drawn anyway (five
  // even steps, recharts' own default) rather than replacing it, so the ruler a
  // reader measures the long תוכן bar against is still there.
  const barTicks = perRowMax
    ? [
        ...new Set([
          ...Array.from({ length: 5 }, (_, i) => round1((axisMax * i) / 4)),
          ...drawn.map((r) => r.pointsMax as number),
        ]),
      ].sort((a, b) => a - b)
    : undefined;

  const pieData = withTail(rows);
  const totalQuestions = rows.reduce((n, r) => n + r.questions, 0);

  // Both charts grow with the number of buckets rather than sitting at a fixed
  // height. At 13 buckets a 280px box gave every bar ~14px and squeezed the
  // legend to nine visible entries out of thirteen — the chart was hiding its
  // own data. 30px a row is the floor at which a Hebrew label stays legible.
  const barHeight = Math.max(300, drawn.length * 30 + 40);
  const pieHeight = Math.max(320, pieData.length * 26 + 90);

  // The bar shows real laws only, best-scoring first so the weakest sit at the
  // bottom where the eye finishes.
  //
  // SORTED ON THE PERCENTAGE, NOT ON THE PLOTTED VALUE. Where every row shares
  // a ceiling the two orders are identical, so nothing changes for the exam
  // tabs — but 3 of 4 in לשון beats 8 of 12 in תוכן, and sorting on the raw
  // points would have put the better mark below the worse one.
  const barData = drawn
    .map((r) => {
      const ceiling = perRowMax ? (r.pointsMax as number) : axisMax;
      const scored = inPoints ? (r.points as number) : r.percent;
      return {
        topic: r.topic,
        label: shortLabel(r.topic),
        percent: r.percent,
        correct: scored,
        // To this row's OWN ceiling, so the grey tail after a לשון bar stops
        // at 4 and the bar reads "3 out of 4" rather than "3 out of 12".
        wrong: Math.max(0, ceiling - scored),
        ceiling,
        questions: r.questions,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  return (
    // ONE CARD WIDE FOR A SINGLE MARKED ANSWER. Its three rows would be drawn
    // twice there, and a pie of three slices says strictly less than a bar of
    // the same three numbers: the bar states how much of each metric was earned
    // AND how much was available, which is the question being asked. Where the
    // two cards measure DIFFERENT things — `scoreRows` — both stay.
    <div
      className={`grid grid-cols-1 gap-[18px] ${
        perRowMax && !separateScoreRows ? "" : "lg:grid-cols-2"
      }`}
    >
      {perRowMax && !separateScoreRows ? null : (
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
      )}

      <ChartCard
        surface={surface}
        // "הניקוד" for ONE marked answer, "ניקוד ממוצע" once the rows are
        // an average over many — which is what `scoreRows` always are. Saying
        // "הניקוד" over an average would be a factual error, not a wording
        // preference: a candidate would read it as a mark they were given.
        title={
          perRowMax
            ? `${separateScoreRows ? "ניקוד ממוצע" : "הניקוד"} לפי ${scoreLabel}`
            : `ציון ממוצע לפי ${scoreLabel}`
        }
        // The mark itself, in the words it is given in. It leads because it is
        // the one number a candidate came to this card for; the three bars
        // under it say where it came from.
        headline={total ? `${round1(total.points)} מתוך ${round1(total.max)}` : undefined}
        context={scoreContext}
        subtitle={
          perRowMax
            ? separateScoreRows
              ? "הניקוד הממוצע בכל מדד על פני כל המטלות, מתוך הניקוד המלא שלו"
              : "הנקודות שנצברו בכל מדד, מתוך הניקוד המלא שלו"
            : inPoints
              ? `ניקוד ממוצע בכל תחום · מתוך ${axisMax} נקודות`
              : "אחוז תשובות נכונות בכל תחום"
        }
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
                domain={[0, axisMax]}
                ticks={barTicks}
                reversed
                tick={{ fontSize: 12.5, fill: "var(--color-ink-muted)" }}
                tickFormatter={(v: number) => (inPoints ? `${v}` : `${v}%`)}
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
                formatter={(value, name, entry) => {
                  const ceiling = entry?.payload?.ceiling;
                  const shown = `${round1(asNumber(value))}${inPoints ? " נק'" : "%"}`;
                  return [
                    // In the rubric view the number needs its denominator on
                    // the tooltip: "3 נק'" is a full mark in לשון and a quarter
                    // of one in תוכן, and the bar alone cannot say which.
                    perRowMax ? `${shown} מתוך ${round1(asNumber(ceiling))}` : shown,
                    name === "correct" ? scoreSeriesName : "לא נצבר",
                  ];
                }}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.topic ?? ""
                }
              />
              {/* Drawn BEFORE the bars so a bar that crosses it stays readable:
                  the line is a reference, not something to occlude the data.

                  GONE IN THE RUBRIC VIEW, because there is no single x it could
                  sit at: half of תוכן is 6 and half of לשון is 2, so one
                  vertical line would be the pass mark for one row and a wrong
                  number for the other two. Each bar states its own ceiling
                  there instead — the grey tail after it. */}
              {perRowMax ? null : (
                <ReferenceLine
                  x={(PASS_MARK / 100) * axisMax}
                  stroke="var(--color-status-weak)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
              )}
              {/* Stacked to full marks: what was scored, and what was left on
                  the table. Reading the gap is the point — a 40% bar is 60% of
                  visible grey, and an 8-point bar out of 20 is 12 points of it. */}
              <Bar dataKey="correct" stackId="s" fill={CORRECT_COLOR} radius={[0, 3, 3, 0]}>
                {/* What was actually earned, printed inside its own bar. It is
                    what the orange figure opposite is a reference FOR — without
                    it the reader can compare a bar length against a number, and
                    "9.5 מתוך 12" is the sentence they are trying to read. */}
                {perRowMax ? <LabelList dataKey="correct" content={<AwardedLabel />} /> : null}
              </Bar>
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
  headline,
  context,
  surface,
  children,
}: {
  title: string;
  subtitle: string;
  /** An optional figure between the title and the subtitle — the card's answer. */
  headline?: string;
  /** What the card is about, named under the title. */
  context?: string;
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
        {context ? (
          <p
            className="font-heebo"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-ink-dim)",
              marginTop: 3,
            }}
          >
            {context}
          </p>
        ) : null}
        {headline ? (
          <p
            className="font-heebo font-bold tabular-nums"
            style={{ fontSize: 22, color: "var(--color-navy-ink)", marginTop: 4 }}
          >
            {headline}
          </p>
        ) : null}
        <p style={{ fontSize: 12.5, color: "var(--color-ink-muted)", marginTop: 3 }}>
          {subtitle}
        </p>
      </header>
      {children}
    </section>
  );
}
