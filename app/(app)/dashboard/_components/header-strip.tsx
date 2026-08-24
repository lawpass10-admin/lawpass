import { ClipboardList, Play } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getHebrewGreeting } from "@/lib/greetings";
import { cn } from "@/lib/utils";

import type { StatusContext, StatusPillState } from "@/lib/dashboard/types";

type Props = {
  fullName: string;
  /** `null` when `profile.exam_date_planned` is unset. */
  examDate: Date | null;
  /**
   * Days remaining until `examDate`. Caller computes (matches existing
   * `daysUntil` semantics in `dashboard/page.tsx`). `null` mirrors a
   * null `examDate`.
   */
  daysToExam: number | null;
  /**
   * Phase 9b: pill + focus are no longer rendered in the UI but the
   * upstream fetches (`getStatusContext`) still run. The prop stays on
   * the interface so HeaderStripAsync's signature is unchanged and we
   * can re-enable rendering later without re-threading data.
   */
  status: StatusContext;
};

const PILL_LABEL: Record<StatusPillState, string> = {
  starting: "התחלת המסע",
  on_track: "אתה במסלול",
  speed_up: "כדאי להגביר קצב",
};

const PILL_CLASS: Record<StatusPillState, string> = {
  starting: "bg-sky-50 text-sky-700 border-sky-200",
  on_track: "bg-emerald-50 text-emerald-700 border-emerald-200",
  speed_up: "bg-amber-50 text-amber-700 border-amber-200",
};

/**
 * Phase 9b: kept exported (not currently rendered in HeaderStrip) so
 * Slice 5 / a re-enable elsewhere can import without re-implementing.
 */
export function StatusPill({ state }: { state: StatusPillState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium align-baseline",
        PILL_CLASS[state]
      )}
    >
      {PILL_LABEL[state]}
    </span>
  );
}

/**
 * "{weekday} · {day} {month} {year}" — Hebrew long date for the small
 * mono uppercase line above the h1 greeting. Server-rendered with the
 * same Frankfurt-TZ caveat as the rest of the dashboard.
 */
function formatDateHeLong(d: Date): string {
  const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(
    d
  );
  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return `${weekday} · ${date}`;
}

// Slice 30 — `formatExamDateLong` was previously used to format the
// subtitle line ("נשארו N ימים לבחינת {month year}.") sitting under
// the greeting. That sentence was duplicated by the gold "המבחן בעוד
// N ימים" headline inside the hero ring, so the populated branch
// below was removed. We keep the import-shaped helper deleted; the
// no-exam-date fallback link does not need a formatted month/year.

export function HeaderStrip({ fullName, examDate, daysToExam }: Props) {
  const greeting = getHebrewGreeting();
  const dateLine = formatDateHeLong(new Date());
  // Slice 30 — when an exam date IS set, render no subtitle (the
  // countdown survives only inside the hero ring). When none is set,
  // we still surface the "add exam date" CTA so the no-date case
  // isn't dead in the dashboard.
  const showAddExamDateLink = examDate === null || daysToExam === null;

  return (
    <div
      className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 md:gap-6"
      style={{ marginBottom: 28 }}
    >
      <div>
        <div
          style={{
            fontSize: 11.5,
            letterSpacing: "0.12em",
            color: "var(--ink-mute)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {dateLine}
        </div>
        <h1
          className="font-heebo font-extrabold tracking-tight text-[28px] md:text-[40px]"
          style={{
            lineHeight: 1.15,
            color: "var(--color-navy-ink)",
          }}
        >
          {greeting}
          <span className="hidden md:inline">, {fullName}.</span>
          <span className="md:hidden">,</span>
        </h1>
        {showAddExamDateLink ? (
          <p
            style={{
              color: "var(--ink-3)",
              fontSize: 16,
              marginTop: 6,
              maxWidth: 540,
              lineHeight: 1.5,
            }}
          >
            <Link
              href="/account"
              className="text-primary underline underline-offset-2 hover:no-underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              הוסף תאריך בחינה
            </Link>
          </p>
        ) : null}
      </div>
      {/* Phase 16: split the two CTAs by destination —
         (1) outline "תרגול חופשי" → /practice (free-choice setup form),
         (2) gold-gradient "התחל סימולציה" → /exam (timed full-exam sim).
         Both surfaces stay reachable from the sidebar; promoting the
         exam path here gives the dashboard a clear "go practice the
         real thing" affordance opposite the lower-pressure browse CTA. */}
      {/* Slice 36 — mobile alignment fix. On mobile the cluster is a
          full-width flex row (column-flex parent → cross-axis stretch),
          so `justify-between` pushes the two buttons to opposite ends:
          "תרגול חופשי" (DOM 1) → visual right edge; "התחל סימולציה"
          (DOM 2) → visual left edge → aligned with the blue hero
          container's left edge below. On desktop the parent flex flips
          to row + items-end, the cluster becomes content-sized, so
          `justify-between` has no visible effect (the two buttons sit
          gap-3 apart, matching the CTA-pair spacing used across the app). */}
      <div className="flex shrink-0 gap-3 justify-between">
        <Link
          href="/practice"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 gap-2 rounded-full px-5 text-sm font-semibold font-heebo"
          )}
        >
          <ClipboardList className="size-4" aria-hidden />
          <span>תרגול חופשי</span>
        </Link>
        <Link
          href="/exam"
          className={cn(
            "btn-gold inline-flex h-11 items-center gap-2 rounded-full px-6 text-[15px] font-semibold font-heebo",
            "focus-visible:outline-none"
          )}
        >
          <Play className="size-4 fill-current" aria-hidden />
          <span>התחל סימולציה</span>
        </Link>
      </div>
    </div>
  );
}
