"use client";

/**
 * The exam-registration reminder.
 *
 * Registration for the 22 December 2026 sitting closes on 8 December, and a
 * candidate who is deep in practice is exactly the person who will look up on
 * the 9th. So the app says so, hourly, until they tick the box.
 *
 * ── Why a toast and not a dialog ──────────────────────────────────────────
 * A dialog demands an answer before the page can be used again. This is a date
 * someone needs to KNOW, not a decision they need to make, and a modal that
 * interrupts a timed exam to tell you about a deadline three weeks out is
 * worse than useless. The toast sits in the corner and is ignorable, which is
 * the correct weight for a reminder.
 *
 * ── Three things stop it ──────────────────────────────────────────────────
 *   1. The checkbox. Permanent, per browser.
 *   2. The deadline passing. After 8 December 2026 the component renders
 *      nothing at all — a reminder about a closed registration is noise, and
 *      nobody should have to remember to delete this.
 *   3. The hour. It fires on mount and then hourly, so moving between pages
 *      does not re-fire it.
 *
 * ── Where the dismissal lives ─────────────────────────────────────────────
 * localStorage, not the database, following the cookie bar. Two reasons: it is
 * a display preference rather than a fact about the candidate, and it must
 * survive a dead network without a round trip. The cost is that it is
 * per-browser — someone who studies on a phone and a laptop ticks it twice.
 * That is the right trade here; it would not be for anything that mattered.
 */

import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

/** Ticked the box. Separate key from the last-shown stamp so clearing one
 *  does not clear the other. */
const DISMISSED_KEY = "lawpass:enrollment-reminder-dismissed";
/** Epoch ms of the last time it appeared, so an hour means an hour across
 *  navigations rather than resetting on every page. */
const LAST_SHOWN_KEY = "lawpass:enrollment-reminder-last-shown";

const HOUR_MS = 60 * 60 * 1000;

/**
 * When registration closes. Local midnight at the END of the 8th — the
 * reminder is useful on the 8th itself, which `new Date("2026-12-08")` would
 * not give (that is the START of the day, UTC).
 */
const DEADLINE = new Date(2026, 11, 9, 0, 0, 0);

const COPY = {
  title: "ההרשמה למבחן נסגרת ב-8 בדצמבר",
  body: "מועד הבחינה: 22 בדצמבר 2026. אל תשכחו להירשם דרך לשכת עורכי הדין.",
  stop: "אל תזכירו לי שוב",
};

/** localStorage throws outright in some privacy modes; a reminder must never
 *  take the page down with it. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota or a blocked store. The toast still showed; only the memory of it
    // is lost, which means it may appear again. Better than not appearing.
  }
}

function ReminderToast({ onStop, onClose }: { onStop: () => void; onClose: () => void }) {
  return (
    <div
      dir="rtl"
      className="flex w-[min(92vw,380px)] gap-3 rounded-xl border p-3.5 shadow-lg"
      style={{
        // The app's own pair — navy ground, gold ring — so it reads as LawPass
        // speaking rather than as a browser notification.
        background: "var(--color-navy-deep, #1E3A8A)",
        borderColor: "rgba(201, 161, 73, 0.55)",
      }}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "rgba(255,255,255,0.92)" }}
      >
        <Image src="/lawpass-logo-tight.png" alt="" width={34} height={34} className="h-auto w-[34px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-heebo text-[14px] font-bold" style={{ color: "#C9A149" }}>
          {COPY.title}
        </p>
        <p className="mt-1 font-heebo text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.86)" }}>
          {COPY.body}
        </p>

        {/* A real checkbox with a real label, not a styled div: it is the one
            control in here, and it has to be reachable by keyboard and
            announced as a checkbox. */}
        <label className="mt-2.5 flex cursor-pointer items-center gap-2 font-heebo text-[12.5px]"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-[#C9A149]"
            onChange={(event) => {
              if (!event.target.checked) return;
              onStop();
              onClose();
            }}
          />
          {COPY.stop}
        </label>
      </div>
    </div>
  );
}

export function EnrollmentReminder() {
  React.useEffect(() => {
    if (Date.now() >= DEADLINE.getTime()) return;

    const show = () => {
      if (read(DISMISSED_KEY) === "true") return;
      const last = Number(read(LAST_SHOWN_KEY) ?? 0);
      if (Number.isFinite(last) && Date.now() - last < HOUR_MS) return;

      write(LAST_SHOWN_KEY, String(Date.now()));
      toast.custom(
        (id) => (
          <ReminderToast
            onStop={() => write(DISMISSED_KEY, "true")}
            onClose={() => toast.dismiss(id)}
          />
        ),
        // Long enough to read twice, short enough not to sit in the corner of a
        // timed exam. Dismissible by the usual means as well as the checkbox.
        { duration: 12_000 }
      );
    };

    show();
    const timer = setInterval(show, HOUR_MS);
    return () => clearInterval(timer);
  }, []);

  return null;
}
