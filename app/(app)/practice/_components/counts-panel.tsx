"use client";

import {
  ANGLE_CHOICES,
  SOURCE_COUNT_CHOICES,
  type AngleCount,
  type SourceCount,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P4 — Counts panel.
 *
 * Stacks two pill-row pickers ("שאלות מקור" and "זוויות לכל מקור")
 * inside one panel-bordered card. Mirrors `PracticeBuilder.html` lines
 * 234-285 — panel-title-num "2" + dynamic sub-line + grid pickers.
 *
 * Stateless presentation: the hook owns the values, this panel only
 * dispatches. Same pattern as ChapterPanel from P3.
 *
 * The source picker disables choices that exceed `available` so the
 * "submitDisabled" path can rely on a single source of truth — the
 * effective source count clamps inside `usePracticeBuilder` regardless,
 * so even a stale raw click here doesn't push a too-big number to the
 * server.
 */

type Props = {
  sourceCount: SourceCount;
  onSetSourceCount: (n: SourceCount) => void;
  angles: AngleCount;
  onSetAngles: (n: AngleCount) => void;
  available: number | null;
  isCountPending: boolean;
  hasSelection: boolean;
};

export function CountsPanel({
  sourceCount,
  onSetSourceCount,
  angles,
  onSetAngles,
  available,
  isCountPending,
  hasSelection,
}: Props) {
  const subLine = !hasSelection
    ? "בחר פרק כדי לראות שאלות זמינות"
    : isCountPending || available === null
      ? "טוען זמינות..."
      : available === 0
        ? "אין שאלות זמינות בנושאים שבחרת."
        : null;

  return (
    <section
      className="rounded-[22px] border bg-card"
      style={{
        padding: "24px 26px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <header className="flex items-start justify-between gap-4 mb-[18px]">
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
              2
            </span>
            כמות שאלות
          </h2>
          <p
            className="font-heebo font-normal mt-1"
            style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
          >
            {subLine ?? (
              <>
                כרגע יש{" "}
                <b
                  style={{
                    color: "var(--color-navy-ink)",
                    fontWeight: 700,
                  }}
                >
                  {available!.toLocaleString("he-IL")} שאלות זמינות
                </b>{" "}
                בנושאים שבחרת.
              </>
            )}
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-[22px]">
        {/* Source picker */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <span
              className="font-heebo font-semibold"
              style={{ fontSize: 14.5, color: "var(--color-navy-ink)" }}
            >
              שאלות מקור
            </span>
            <span
              className="font-heebo"
              style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
            >
              שאלות אמיתיות מבחינות עבר
            </span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {SOURCE_COUNT_CHOICES.map((n) => {
              const enabled = available !== null && available >= n;
              const isSelected = sourceCount === n;
              return (
                <PickerButton
                  key={n}
                  value={n}
                  active={isSelected && enabled}
                  disabled={!enabled}
                  onClick={() => enabled && onSetSourceCount(n)}
                />
              );
            })}
          </div>
        </div>

        {/* Angles picker */}
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <span
              className="font-heebo font-semibold"
              style={{ fontSize: 14.5, color: "var(--color-navy-ink)" }}
            >
              זוויות לכל מקור
            </span>
            <span
              className="font-heebo"
              style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
            >
              שאלות נלוות בזוויות פדגוגיות
            </span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
            {ANGLE_CHOICES.map((n) => {
              const isSelected = angles === n;
              return (
                <PickerButton
                  key={n}
                  value={n}
                  active={isSelected}
                  disabled={false}
                  onClick={() => onSetAngles(n)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PickerButton({
  value,
  active,
  disabled,
  onClick,
}: {
  value: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "font-heebo font-bold transition-all tabular-nums text-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        !disabled && !active && "hover:border-[var(--color-navy)] hover:text-[var(--color-navy-ink)]",
        disabled && "cursor-not-allowed"
      )}
      style={{
        padding: "11px 0",
        borderRadius: 10,
        fontSize: 15,
        background: active ? "var(--color-navy-ink)" : "var(--color-paper)",
        color: active
          ? "var(--color-white, #FFFFFF)"
          : disabled
            ? "var(--color-ink-muted)"
            : "var(--color-ink-dim)",
        border: active
          ? "1.5px solid var(--color-navy-ink)"
          : "1.5px solid var(--color-line)",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {value}
    </button>
  );
}
