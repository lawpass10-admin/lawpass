import { getHebrewGreeting } from "@/lib/greetings";
import { cn } from "@/lib/utils";

import type { StatusContext, StatusPillState } from "@/lib/dashboard/types";

type Props = {
  fullName: string;
  /**
   * No longer rendered. The "הוסף תאריך בחינה" link this drove was removed
   * when the dashboard became a statistics page. Kept on the interface — like
   * `status` below — so `HeaderStripAsync`'s signature and its upstream fetch
   * are unchanged and the countdown can be re-enabled without re-threading
   * data. `null` when `profile.exam_date_planned` is unset.
   */
  examDate: Date | null;
  /**
   * Days remaining until `examDate`, computed by the caller. Also no longer
   * rendered; see `examDate`.
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

export function HeaderStrip({ fullName }: Props) {
  const greeting = getHebrewGreeting();
  const dateLine = formatDateHeLong(new Date());

  /**
   * `full_name` is whatever the profile holds, and a profile can be saved
   * without one. Trimmed and checked so a blank name greets the candidate with
   * "בוקר טוב, ." rather than "בוקר טוב."
   */
  const name = fullName?.trim() ?? "";

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
        {/* THE NAME IS SHOWN AT EVERY WIDTH.
            It used to be `hidden md:inline`, with a bare comma standing in for
            it below md — so a phone read "בוקר טוב," : no name, and a comma
            left pointing at nothing. Whatever the original width worry was, a
            dangling comma is worse than a second line, and `text-balance`
            splits a long greeting evenly rather than leaving one orphan word. */}
        <h1
          className="font-heebo font-extrabold tracking-tight text-[28px] text-balance md:text-[40px]"
          style={{
            lineHeight: 1.15,
            color: "var(--color-navy-ink)",
          }}
        >
          {name ? `${greeting}, ${name}.` : `${greeting}.`}
        </h1>
      </div>
      {/* The CTA cluster that sat here — "תרגול חופשי" → /practice and
          "התחל סימולציה" → /exam — was removed along with the
          "הוסף תאריך בחינה" link above it. Both destinations are still one
          click away in the sidebar, and this page is now a statistics page:
          its job is to show what has been practised and how well, not to
          push the candidate somewhere before they have read it. The three
          subject cards below are themselves links into each surface, so the
          route out is still on the page — attached to the number that would
          make you want to take it. */}
    </div>
  );
}
