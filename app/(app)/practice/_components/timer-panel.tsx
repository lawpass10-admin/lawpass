"use client";

import {
  TIME_MAX,
  TIME_MIN,
  TIME_STEP,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P4 — Timer panel.
 *
 * Mirrors `PracticeBuilder.html` lines 287-321:
 *   - Big Heebo-800 readout on right + presets row on left.
 *   - Custom gold-gradient track + circular thumb (native input
 *     range is invisible but interactive on top of the decorative
 *     divs — keeps keyboard + accessibility while letting us paint
 *     the exact gold-stop colors the prototype calls for).
 *
 * The "ללא" preset writes `timeSeconds = 0` per PM clarification; the
 * slider thumb pins to the min position visually in that case and the
 * dialog reads "ללא טיימר".
 */

type Props = {
  timeSeconds: number;
  onSet: (n: number) => void;
};

type Preset = { label: string; value: number };
const PRESETS: ReadonlyArray<Preset> = [
  { label: "1:00", value: 60 },
  { label: "2:30", value: 150 },
  { label: "5:00", value: 300 },
  { label: "ללא", value: 0 },
];

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TimerPanel({ timeSeconds, onSet }: Props) {
  // Slider fill percentage from the start (right edge in RTL). When
  // `timeSeconds = 0` ("ללא"), pin to the min position so the visual
  // doesn't leak past the track's left edge.
  const effectiveForSlider = Math.max(TIME_MIN, Math.min(TIME_MAX, timeSeconds));
  const fillPct =
    ((effectiveForSlider - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;

  return (
    <section
      className="rounded-[22px] border bg-card"
      style={{
        padding: "24px 26px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="mb-[18px]">
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
          זמן לכל שאלה
        </h2>
        <p
          className="font-heebo font-normal mt-1"
          style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
        >
          טיימר ויזואלי שמופיע בזמן התרגול.
        </p>
      </header>

      <div className="flex items-baseline justify-between mb-3.5 gap-3">
        <div>
          <span
            className="font-heebo font-extrabold tabular-nums"
            style={{
              fontSize: 38,
              color: "var(--color-navy-ink)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {timeSeconds === 0 ? "—" : formatMinSec(timeSeconds)}
          </span>
          <span
            className="font-heebo font-medium ms-1.5"
            style={{ fontSize: 14, color: "var(--color-ink-muted)" }}
          >
            {timeSeconds === 0 ? "ללא טיימר" : "דקות לשאלה"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">
          {PRESETS.map((p) => {
            const active = p.value === timeSeconds;
            return (
              <PresetButton
                key={p.label}
                label={p.label}
                active={active}
                onClick={() => onSet(p.value)}
              />
            );
          })}
        </div>
      </div>

      {/* Slider — overlay decorative track/fill/thumb on top of a
          visually-hidden range input that owns interactivity. */}
      <div className="relative mt-[18px]">
        <div
          aria-hidden
          className="h-1.5 rounded-[3px]"
          style={{ background: "var(--color-line)" }}
        />
        <div
          aria-hidden
          className="absolute top-0 h-1.5 rounded-[3px]"
          style={{
            insetInlineStart: 0,
            width: `${fillPct}%`,
            background:
              "linear-gradient(270deg, var(--color-gold), var(--color-gold-deep))",
            opacity: timeSeconds === 0 ? 0.3 : 1,
            transition: "width 0.18s ease, opacity 0.18s ease",
          }}
        />
        <div
          aria-hidden
          className="absolute top-1/2"
          style={{
            insetInlineStart: `${fillPct}%`,
            transform: "translate(50%, -50%)",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--color-white, #FFFFFF)",
            border: "2px solid var(--color-gold-deep)",
            boxShadow: "0 4px 10px -3px rgba(0, 0, 0, 0.18)",
            transition: "inset-inline-start 0.18s ease",
            pointerEvents: "none",
          }}
        />
        <input
          type="range"
          min={TIME_MIN}
          max={TIME_MAX}
          step={TIME_STEP}
          value={effectiveForSlider}
          onChange={(e) => onSet(Number(e.target.value))}
          aria-label="זמן לכל שאלה בשניות"
          className={cn(
            "absolute inset-0 w-full cursor-pointer opacity-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          )}
          style={{ height: 22, top: "50%", transform: "translateY(-50%)" }}
        />
      </div>

      <div
        className="flex justify-between mt-2"
        style={{ fontSize: 11.5, color: "var(--color-ink-muted)" }}
      >
        <span className="font-heebo">1:00</span>
        <span
          className="font-heebo font-semibold"
          style={{ color: "var(--color-gold-deep)" }}
        >
          מומלץ · 2:30
        </span>
        <span className="font-heebo">5:00</span>
      </div>
    </section>
  );
}

function PresetButton({
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
        !active && "hover:border-[var(--color-navy)] hover:text-[var(--color-navy-ink)]"
      )}
      style={{
        padding: "5px 10px",
        borderRadius: 6,
        fontSize: 11.5,
        background: active ? "var(--color-gold-tint)" : "transparent",
        color: active
          ? "var(--color-gold-deep)"
          : "var(--color-ink-muted)",
        border: active
          ? "1px solid var(--color-gold)"
          : "1px solid var(--color-line)",
      }}
    >
      {label}
    </button>
  );
}
