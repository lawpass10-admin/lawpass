"use client";

import { useState, type ChangeEvent } from "react";

import {
  SESSION_DURATION_MAX_SECONDS,
  SESSION_DURATION_PRESETS_MINUTES,
  SESSION_TIMER_OFF,
  clampSessionDurationSeconds,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P4 — Timer panel (legacy per-question).
 * Slice 24 — repurposed for the SESSION timer. The user toggles a
 * single switch ("הפעלת טיימר" on/off); when on, they type the
 * session budget in MINUTES (or pick a preset chip), stored on the
 * builder as seconds. When off, the builder writes
 * `sessionDurationSeconds = 0` and the play screen renders no timer.
 *
 * The minutes are clamped to the DB CHECK constraint (0..14400s =
 * 0..240 min). The hook's `clampSessionDurationSeconds` is the
 * single source of truth.
 */

type Props = {
  sessionDurationSeconds: number;
  onSet: (n: number) => void;
};

const MAX_MINUTES = Math.floor(SESSION_DURATION_MAX_SECONDS / 60);
const MIN_MINUTES = 1;

function secondsToMinutes(s: number): number {
  return Math.max(0, Math.round(s / 60));
}

export function TimerPanel({ sessionDurationSeconds, onSet }: Props) {
  const isOn = sessionDurationSeconds > 0;
  const currentMinutes = secondsToMinutes(sessionDurationSeconds);

  return (
    <section
      className="rounded-[22px] border bg-card"
      style={{
        padding: "24px 26px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="mb-[18px] flex items-start justify-between gap-4">
        <div>
          <h2
            className="font-heebo font-bold flex items-center gap-2.5"
            style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
          >
            <span
              aria-hidden
              className="inline-flex items-center justify-center font-heebo font-bold"
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "var(--color-gold-tint)",
                color: "var(--color-gold-deep)",
                fontSize: 13,
              }}
            >
              3
            </span>
            זמן לסשן
          </h2>
          <p
            className="font-heebo font-normal mt-1"
            style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
          >
            טיימר אחד שספור לאחור כל זמן הסשן.
          </p>
        </div>
        <OnOffToggle isOn={isOn} onChange={onSet} />
      </header>

      {isOn ? (
        <SessionDurationControls
          currentMinutes={currentMinutes}
          onSet={onSet}
        />
      ) : (
        <p
          className="font-heebo font-medium"
          style={{ fontSize: 14, color: "var(--color-ink-muted)" }}
        >
          ללא טיימר — תוכל לתרגל ללא מגבלת זמן.
        </p>
      )}
    </section>
  );
}

// =============================================================================
// On/off switch
// =============================================================================

function OnOffToggle({
  isOn,
  onChange,
}: {
  isOn: boolean;
  onChange: (n: number) => void;
}) {
  // Flipping ON seeds the default 15-minute budget so the user has a
  // sensible starting value (the hook clamps anyway); flipping OFF
  // writes 0 (the no-timer sentinel).
  const handleToggle = (): void => {
    if (isOn) {
      onChange(SESSION_TIMER_OFF);
    } else {
      onChange(15 * 60);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={handleToggle}
      className={cn(
        "relative inline-flex shrink-0 items-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/40"
      )}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        background: isOn ? "var(--color-gold)" : "var(--color-line)",
      }}
    >
      <span
        aria-hidden
        className="absolute"
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "var(--color-white, #FFFFFF)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          // In RTL the "on" position is the visual-end (left). Using
          // `inset-inline-start` keeps the math directional.
          insetInlineStart: isOn ? 22 : 3,
          top: 3,
          transition: "inset-inline-start 0.18s ease",
        }}
      />
    </button>
  );
}

// =============================================================================
// Session-duration controls — minutes input + preset chips
// =============================================================================

function SessionDurationControls({
  currentMinutes,
  onSet,
}: {
  currentMinutes: number;
  onSet: (n: number) => void;
}) {
  // Local string buffer so the user can clear / partial-edit without
  // the hook snapping back mid-keystroke. Mirrors the Slice 23.1
  // pattern in counts-panel.tsx; the render-time set-state-on-change
  // guard keeps the lint rule happy.
  const [text, setText] = useState<string>(String(currentMinutes));
  const [lastSeen, setLastSeen] = useState<number>(currentMinutes);
  if (lastSeen !== currentMinutes) {
    setLastSeen(currentMinutes);
    setText(String(currentMinutes));
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    setText(next);
    if (next === "") return;
    const minutes = Number.parseInt(next, 10);
    if (Number.isFinite(minutes) && minutes > 0) {
      onSet(minutes * 60);
    }
  };

  const handleBlur = (): void => {
    const minutes = Number.parseInt(text, 10);
    if (text === "" || !Number.isFinite(minutes) || minutes <= 0) {
      // Restore the current clamped value.
      setText(String(currentMinutes));
      return;
    }
    // Re-sync after the hook clamp so the field never displays a
    // value the engine would reject.
    const clamped =
      clampSessionDurationSeconds(minutes * 60) / 60;
    if (clamped !== minutes) {
      setText(String(Math.round(clamped)));
      onSet(Math.round(clamped) * 60);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={1}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label="זמן לסשן בדקות"
          className={cn(
            "font-heebo font-bold tabular-nums text-center",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/40"
          )}
          style={{
            padding: "11px 12px",
            width: 88,
            borderRadius: 10,
            fontSize: 15,
            background: "var(--color-gold-tint)",
            color: "var(--color-navy-ink)",
            border: "1.5px solid var(--color-gold)",
          }}
        />
        <span
          className="font-heebo"
          style={{ fontSize: 14, color: "var(--color-ink-muted)" }}
        >
          דקות
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SESSION_DURATION_PRESETS_MINUTES.map((m) => {
          const active = m === currentMinutes;
          return (
            <PresetChip
              key={m}
              label={`${m} דק׳`}
              active={active}
              onClick={() => onSet(m * 60)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "font-heebo font-semibold transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        !active &&
          "hover:border-[var(--color-navy)] hover:text-[var(--color-navy-ink)]"
      )}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 12,
        background: active ? "var(--color-gold-tint)" : "transparent",
        color: active ? "var(--color-gold-deep)" : "var(--color-ink-muted)",
        border: active
          ? "1px solid var(--color-gold)"
          : "1px solid var(--color-line)",
      }}
    >
      {label}
    </button>
  );
}
