"use client";

import { useState } from "react";

import { CustomExamBuilder } from "@/app/(app)/dashboard/_components/custom-exam-builder";
import { TopicCharts } from "@/app/(app)/dashboard/_components/topic-charts";
import type {
  SubjectKey,
  SubjectTopics,
  TopicStatsBySubject,
} from "@/lib/dashboard/topic-stat";
import { cn } from "@/lib/utils";

/**
 * The subject tabs below the three squares, and the charts under each.
 *
 * REPLACED THE TRACK FILTER THAT USED TO LIVE HERE. The old tabs were
 * הכל / דיוני / מהותי and filtered a list of practice chapters. They are now the
 * three study surfaces the dashboard is actually about, matching the three
 * cards above them — so a candidate reads one subject all the way down the page
 * instead of switching mental models halfway.
 *
 * "הכל" is gone deliberately rather than by omission: an aggregate across
 * multiple-choice papers and written tasks would average a percentage of
 * correct answers together with a percentage of rubric points, which are not
 * the same measurement and produce a number that means nothing.
 */

/**
 * Hebrew ordinals for the two things that can be picked from the list.
 *
 * Written out rather than generated: Hebrew ordinals are irregular, and they
 * are gendered — מבחן takes ראשון and מטלה takes ראשונה. Past ten both fall
 * back to a numeral, which serves a candidate better than an invented word.
 */
const EXAM_NOUN = {
  all: "כל המבחנים",
  ordinals: [
    "מבחן ראשון", "מבחן שני", "מבחן שלישי", "מבחן רביעי", "מבחן חמישי",
    "מבחן שישי", "מבחן שביעי", "מבחן שמיני", "מבחן תשיעי", "מבחן עשירי",
  ],
};
const TASK_NOUN = {
  all: "כל המטלות",
  ordinals: [
    "מטלה ראשונה", "מטלה שנייה", "מטלה שלישית", "מטלה רביעית", "מטלה חמישית",
    "מטלה שישית", "מטלה שביעית", "מטלה שמינית", "מטלה תשיעית", "מטלה עשירית",
  ],
};

const TABS: {
  key: SubjectKey;
  label: string;
  empty: string;
  /** What the charts under this tab are grouped by. See TopicCharts. */
  dimension: string;
  /**
   * What they are grouped by once ONE sitting is picked, where that differs.
   *
   * It differs for מטלת כתיבה only, and the reason is the data rather than
   * a preference: a single written task has exactly one law, so grouping it by
   * law is a pie with one slice. What it does break down into is the three
   * things it was marked on — תוכן, לשון, ארגון — which is also the
   * breakdown the grade itself is built from.
   */
  sittingDimension?: string;
  /**
   * How one sitting is named in the picker.
   *
   * מבחן is masculine and מטלה is feminine, so they do not take the same
   * ordinals — "מטלה ראשון" is simply wrong Hebrew. Each tab carries its
   * own noun and ordinal list rather than one generated form.
   */
  sittingNoun: { all: string; ordinals: string[] };
  /**
   * A background for this tab AND for its two chart cards.
   *
   * דין מהותי and דין דיוני are one word apart and their charts look alike, so
   * a candidate glancing at the page could not tell which subject they were
   * reading. Tinting one of the two gives the page a landmark that survives
   * switching tabs — the difference is a colour, not a word you have to read.
   *
   * It reaches the charts as well as the tab because the tab is the part you
   * stop looking at once you start reading the charts, which is exactly when
   * knowing the subject matters.
   */
  tint?: string;
}[] = [
  {
    key: "mahoti",
    label: "דין מהותי",
    dimension: "תחום התמחות",
    sittingNoun: EXAM_NOUN,
    empty: "עדיין לא הגשת מבחן בדין מהותי — הגישו מבחן כדי לראות פילוח לפי תחום התמחות.",
  },
  {
    key: "diuni",
    label: "דין דיוני",
    dimension: "תחום התמחות",
    sittingNoun: EXAM_NOUN,
    empty: "עדיין לא הגשת מבחן בדין דיוני — הגישו מבחן כדי לראות פילוח לפי תחום התמחות.",
    // --bg-soft is the palette's light grey, and it has a dark-mode value, so
    // the tint follows the theme instead of staying pale on a dark card.
    tint: "var(--bg-soft)",
  },
  {
    key: "writing",
    label: "מטלת כתיבה",
    // A writing task's subject is one named statute, not a practice area.
    dimension: "חוק",
    sittingDimension: "מדד הערכה",
    sittingNoun: TASK_NOUN,
    empty: "עדיין לא נבדקה מטלת כתיבה — לאחר בדיקה יופיע כאן פילוח לפי נושא.",
    // A light blue, sitting clear of דיוני's grey. Written out rather than
    // taken from a token because the palette has no light blue — the nearest,
    // --accent-deep, is a saturated navy meant for text and buttons.
    tint: "#E8EEF8",
  },
];

export function SubjectTabs({ topics }: { topics: TopicStatsBySubject }) {
  const [active, setActive] = useState<SubjectKey>("mahoti");
  const current = TABS.find((t) => t.key === active) ?? TABS[0];

  return (
    <section className="space-y-4">
      {/* Full width, three equal columns. A segmented control rather than
          underlined tabs: it reads as a filter over the page's own content,
          which is what it is. */}
      <div
        role="tablist"
        aria-label="נושא"
        className="grid w-full grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: "var(--muted, #f2f4f7)", border: "1px solid var(--color-line)" }}
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={cn(
                "rounded-lg py-2.5 text-center font-heebo text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                selected ? "font-bold shadow-sm" : "font-medium hover:bg-white/60",
              )}
              style={{
                // The tint identifies the subject and stays put; selection is
                // carried by weight and the shadow, so the two signals do not
                // fight each other.
                background: tab.tint ?? (selected ? "var(--card)" : undefined),
                color: selected ? "var(--color-navy-ink)" : "var(--color-ink-dim)",
              }}
            >
              {tab.label}
              {/* The volume behind the tab, so the candidate can see which
                  subjects actually have data before clicking into them. */}
              <span
                className="ms-1.5 font-mono text-[11px] tabular-nums"
                style={{ color: "var(--color-ink-muted)" }}
              >
                {topics[tab.key]?.all.reduce((n, r) => n + r.questions, 0) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Keys are PREFIXED because this panel and the builder below are siblings
          and both remount per subject. Keyed on `active` alone they collided —
          two children of one parent carrying the key "diuni" — which React
          warns about and which lets it confuse the two on a tab change. */}
      <SubjectPanel
        key={`panel-${active}`}
        subject={topics[active]}
        empty={current.empty}
        dimension={current.dimension}
        sittingDimension={current.sittingDimension}
        sittingNoun={current.sittingNoun}
        surface={current.tint}
      />

      {/* Only the two multiple-choice subjects can be assembled from a bank.
          A writing task is one long answer marked against its own rubric —
          there is nothing to pick counts of. */}
      {active === "mahoti" || active === "diuni" ? (
        // Keyed by subject so switching tabs REMOUNTS the builder. Without it
        // the previous subject's pool and chosen counts would persist into the
        // new one — offering areas that do not exist there, with a total the
        // other bank cannot fill.
        <CustomExamBuilder
          key={`builder-${active}`}
          subject={active}
          subjectLabel={current.label}
          // The most recent sitting drives auto-fill's weighting. Last in the
          // array because the server returns them chronologically.
          lastSitting={topics[active]?.sittings.at(-1)?.rows ?? []}
        />
      ) : null}
    </section>
  );
}

/**
 * One subject's charts, with a picker for which sitting they show.
 *
 * "כל המבחנים" is the default because the whole history is what says which
 * areas to revise; a single sitting answers a different question — how one
 * paper went — and is the view you want when comparing improvement between
 * attempts.
 *
 * Keyed by subject at the call site, so switching tabs resets the selection
 * rather than carrying "מבחן שלישי" onto a subject with two sittings.
 */
function SubjectPanel({
  subject,
  empty,
  dimension,
  sittingDimension,
  sittingNoun,
  surface,
}: {
  subject: SubjectTopics | undefined;
  empty: string;
  dimension: string;
  sittingDimension?: string;
  sittingNoun: { all: string; ordinals: string[] };
  surface?: string;
}) {
  const sittings = subject?.sittings ?? [];
  const [selected, setSelected] = useState<number | "all">("all");

  const picked = selected === "all" ? null : sittings.find((s) => s.index === selected);
  const rows = selected === "all" ? (subject?.all ?? []) : (picked?.rows ?? []);

  // The mark as it was stored on the answer, not as a sum of the rows below it:
  // the two agree, and if they ever stopped agreeing the one on the answer is
  // the one the candidate was given.
  const total =
    picked?.points !== undefined && picked?.pointsMax !== undefined
      ? { points: picked.points, max: picked.pointsMax }
      : null;

  // One sitting of מטלת כתיבה is grouped by what it was marked on, not by
  // its law — see `sittingDimension` on TABS.
  const groupedBy = selected !== "all" && sittingDimension ? sittingDimension : dimension;

  // ACROSS THE WHOLE HISTORY THE TWO CHARTS SPLIT UP. The pie keeps showing
  // which laws the practice went into; the score chart switches to the three
  // things every answer was marked on, averaged over all of them, because
  // "תוכן is where I lose points" is what a candidate can act on and a law's
  // average score is not. Only מטלת כתיבה has the rows for it.
  const scoreRows = selected === "all" ? subject?.dimensions : undefined;

  // The tab's own empty line says "you have not sat one yet", which is the
  // wrong sentence for a sitting the candidate is looking AT. One with no rows
  // was marked before its breakdown was stored — for מטלת כתיבה, before the
  // per-dimension marks were kept.
  const emptySitting = "אין פירוט זמין עבור הבחירה הזו.";

  return (
    <div className="space-y-3">
      {/* Only shown when there is a choice to make: one sitting means the
          picker would offer the same data under two names. */}
      {sittings.length > 1 ? (
        <div className="flex justify-center">
          <label className="flex items-center gap-2 text-sm">
            <span style={{ color: "var(--color-ink-dim)" }}>הצג נתונים עבור</span>
            <select
              value={String(selected)}
              onChange={(e) =>
                setSelected(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="rounded-lg border px-3 py-1.5 text-sm font-medium"
              style={{
                borderColor: "var(--color-line)",
                background: "var(--card)",
                color: "var(--color-navy-ink)",
              }}
            >
              <option value="all">{sittingNoun.all}</option>
              {sittings.map((s) => (
                <option key={s.index} value={s.index}>
                  {ordinalSitting(s.index, sittingNoun.ordinals)}
                  {/* The task's own name between the two, TRIMMED: a law like
                      "תקנות בתי המשפט (אגרות), התשס"ז-2007" is longer than the
                      picker is wide, and a <select> sizes itself to its longest
                      option — one task would set the width of the whole control.
                      The full name is on the chart card. */}
                  {s.title ? ` · ${trim(s.title, 34)}` : ""}
                  {/* Named by the mark it was given, in the unit it was given
                      in: a written task is marked in points out of 20, a paper
                      scored as a percentage. */}
                  {s.points !== undefined
                    ? ` · ${s.points} נק'`
                    : s.score !== null
                      ? ` · ${s.score}%`
                      : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {/* Keyed by the selection so BOTH charts remount rather than update in
          place. The row count changes between sittings — one diuni sitting has
          8 areas, another 13 — and recharts carries scales, tick geometry and
          in-flight animations across a data change. Remounting is the cheap way
          to guarantee the pie and the bar are both drawn fresh from the selected
          sitting instead of one of them redrawing and the other easing from the
          previous shape. */}
      <TopicCharts
        key={String(selected)}
        rows={rows}
        emptyMessage={selected === "all" ? empty : emptySitting}
        dimensionLabel={groupedBy}
        scoreRows={scoreRows}
        scoreDimensionLabel={sittingDimension}
        scoreContext={picked?.title}
        total={total}
        surface={surface}
        // What draws מטלת כתיבה's score chart in points out of 20 while the
        // two exam tabs stay on percentages. The server sends it only for a
        // subject that is marked in points, so the tab does not decide this.
        maxPoints={subject?.pointsMax ?? null}
      />
    </div>
  );
}

/** Long law names have to fit inside a <select>; the card shows them in full. */
function trim(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * "מבחן ראשון" / "מטלה ראשונה", falling back to a numeral past ten.
 *
 * The list comes from the tab (EXAM_NOUN / TASK_NOUN) because the two nouns are
 * different genders. Past the tenth, "#11" — a candidate with eleven sittings is
 * better served by a numeral than by an invented ordinal.
 */
function ordinalSitting(index: number, ordinals: string[]): string {
  return index <= ordinals.length ? ordinals[index - 1] : `#${index}`;
}
