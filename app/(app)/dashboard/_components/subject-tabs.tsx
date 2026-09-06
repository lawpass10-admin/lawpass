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

const TABS: {
  key: SubjectKey;
  label: string;
  empty: string;
  /** What the charts under this tab are grouped by. See TopicCharts. */
  dimension: string;
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
    empty: "עדיין לא הגשת מבחן בדין מהותי — הגישו מבחן כדי לראות פילוח לפי תחום התמחות.",
  },
  {
    key: "diuni",
    label: "דין דיוני",
    dimension: "תחום התמחות",
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
  surface,
}: {
  subject: SubjectTopics | undefined;
  empty: string;
  dimension: string;
  surface?: string;
}) {
  const sittings = subject?.sittings ?? [];
  const [selected, setSelected] = useState<number | "all">("all");

  const rows =
    selected === "all"
      ? (subject?.all ?? [])
      : (sittings.find((s) => s.index === selected)?.rows ?? []);

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
              <option value="all">כל המבחנים</option>
              {sittings.map((s) => (
                <option key={s.index} value={s.index}>
                  {ordinalExam(s.index)}
                  {s.score !== null ? ` · ${s.score}%` : ""}
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
        emptyMessage={empty}
        dimensionLabel={dimension}
        surface={surface}
      />
    </div>
  );
}

/**
 * "מבחן ראשון", "מבחן שני", … falling back to a numeral past ten.
 *
 * Hebrew ordinals are irregular enough that a generated form would be wrong,
 * and a candidate with eleven sittings is better served by "מבחן 11" than by an
 * invented word.
 */
const ORDINALS = [
  "ראשון", "שני", "שלישי", "רביעי", "חמישי",
  "שישי", "שביעי", "שמיני", "תשיעי", "עשירי",
];
function ordinalExam(index: number): string {
  return index <= ORDINALS.length ? `מבחן ${ORDINALS[index - 1]}` : `מבחן ${index}`;
}
