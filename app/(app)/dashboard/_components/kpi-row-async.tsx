import { AlertTriangle, BookOpenCheck, Clock, ClipboardCheck } from "lucide-react";

import { StatCard } from "@/app/(app)/dashboard/_components/kpi-card";
import { getKpiData } from "@/app/(app)/dashboard/_lib/queries";
import { secondsToMmss } from "@/lib/dashboard/format";

/**
 * Slice 4.X Phase 12 — KPI strip.
 *
 *   Old layout (Phase 9a): 6 stat cards in a 3-col grid (totalAttempts,
 *   accuracy, time-per-q, exam-sessions, bookmarks, mistakes).
 *
 *   New layout: 4 stat cards in a 4-col grid (1×4 on desktop, 2×2 on
 *   tablet, 1×4 on mobile). `bookmarks` is dropped — the sidebar
 *   already surfaces that count via NAV_LIBRARY. `accuracy` is dropped
 *   because the hero ring + trend chart already convey the same
 *   information; keeping it here would be a redundant fifth voice.
 *
 *   Each card now has either a gold sparkline (volume-style cards) OR a
 *   trend pill (single-number cards). The mistakes card gets a
 *   status-weak bottom bar to read as a soft warning.
 */

const PRACTICE_TARGET_SECONDS = 150;
const TARGET_LABEL = secondsToMmss(PRACTICE_TARGET_SECONDS);

type Props = {
  userId: string;
};

export async function KpiRowAsync({ userId }: Props) {
  const kpi = await getKpiData(userId);

  // Sparkline windows — last 8 weekly buckets (oldest → newest). The
  // backing array is 12 entries; we trim to 8 here so the prototype's
  // 80×28 footprint isn't cramped at higher resolutions.
  const attemptsSparkline = kpi.weeklyAttempts.slice(-8);
  const examSparkline = kpi.weeklyExamAttempts.slice(-8);

  // KPI 1 — שאלות שתורגלו
  const kpi1Empty = kpi.totalAttempts === 0;
  const kpi1Value = kpi1Empty ? "—" : kpi.totalAttempts.toLocaleString("he-IL");
  const kpi1Meta = kpi1Empty
    ? "התחל לתרגל"
    : `מקור ${kpi.sourceAttempts.toLocaleString(
        "he-IL"
      )} · זווית ${kpi.angleAttempts.toLocaleString("he-IL")}`;

  // KPI 2 — זמן ממוצע לשאלה (practice). Phase 14 polish: tier system
  // replaces the raw "X% מהיעד" pill which could spike to 90%+ on tiny
  // sample sizes and read as marketing copy. Four tiers:
  //   > 60% faster  → "⚡ מהיר במיוחד" (no number)
  //   30–60% faster → "טוב יותר ב-X%"
  //   0–30% faster  → "טוב יותר ב-X%" (same wording, lower-key tier)
  //   slower        → "מתחת ליעד · X% איטי יותר" (status-weak pill)
  const avgSeconds = kpi.avgPracticeDurationSec;
  const kpi2Empty = avgSeconds === null;
  const kpi2Value = kpi2Empty ? "—" : secondsToMmss(avgSeconds);
  const kpi2DeltaPct =
    kpi2Empty
      ? 0
      : Math.round(
          ((PRACTICE_TARGET_SECONDS - avgSeconds) / PRACTICE_TARGET_SECONDS) *
            100
        );
  const kpi2Meta = kpi2Empty
    ? "התחל לתרגל"
    : kpi2DeltaPct >= 0
      ? `מהיר מהיעד ${TARGET_LABEL}`
      : `איטי מהיעד ${TARGET_LABEL}`;
  const kpi2Pill: { label: string; direction: "up" | "down" } | undefined = (() => {
    if (kpi2Empty) return undefined;
    if (kpi2DeltaPct < 0) {
      return {
        label: `מתחת ליעד · ${Math.abs(kpi2DeltaPct)}% איטי יותר`,
        direction: "down",
      };
    }
    if (kpi2DeltaPct > 60) {
      return { label: "⚡ מהיר במיוחד", direction: "up" };
    }
    if (kpi2DeltaPct === 0) return undefined;
    return { label: `טוב יותר ב-${kpi2DeltaPct}% מהיעד`, direction: "up" };
  })();

  // KPI 3 — סימולציות בחינה
  const kpi3Empty = kpi.examSessionsCompleted === 0;
  const kpi3Value = kpi3Empty
    ? "—"
    : kpi.examSessionsCompleted.toLocaleString("he-IL");
  const kpi3Meta = kpi3Empty
    ? "התחל סימולציה"
    : kpi.examAvgFinalScore !== null
      ? `ציון ממוצע ${kpi.examAvgFinalScore.toFixed(1)}/40`
      : "מתעדכן";

  // KPI 4 — טעויות פעילות + "+ N השבוע" pill
  const mistakesValue = kpi.mistakesActiveCount.toLocaleString("he-IL");
  const mistakesAdded = kpi.mistakesAddedLast7Days;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      style={{ gap: 16, marginBottom: 28 }}
    >
      <StatCard
        label="שאלות שתורגלו"
        value={kpi1Value}
        meta={kpi1Meta}
        icon={<BookOpenCheck className="size-[17px]" />}
        sparkline={kpi1Empty ? undefined : attemptsSparkline}
        barTone="gold"
      />
      <StatCard
        label="זמן ממוצע לשאלה"
        value={kpi2Value}
        meta={kpi2Meta}
        icon={<Clock className="size-[17px]" />}
        trendPill={kpi2Pill}
        barTone="gold-soft"
      />
      <StatCard
        label="סימולציות בחינה"
        value={kpi3Value}
        meta={kpi3Meta}
        icon={<ClipboardCheck className="size-[17px]" />}
        sparkline={kpi3Empty ? undefined : examSparkline}
        barTone="gold"
      />
      <StatCard
        label="טעויות פעילות"
        value={mistakesValue}
        meta="לתרגול ממוקד"
        icon={<AlertTriangle className="size-[17px]" />}
        trendPill={
          mistakesAdded > 0
            ? { label: `+ ${mistakesAdded} השבוע`, direction: "down" }
            : undefined
        }
        barTone="weak"
        href="/mistakes"
        hrefLabel="עבור לטעויות פעילות"
      />
    </div>
  );
}
