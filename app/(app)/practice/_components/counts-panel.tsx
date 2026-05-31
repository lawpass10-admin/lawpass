"use client";

import { useState, type ChangeEvent } from "react";

import {
  DEFAULT_ANGLES,
  MAX_TOTAL_QUESTIONS_INPUT,
  MIN_TOTAL_QUESTIONS_INPUT,
  TOTAL_QUESTION_CHOICES,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P4 — Counts panel.
 * Slice 18 — collapsed to a SINGLE "כמות שאלות" picker. The prior two
 * pill-rows ("שאלות מקור" and "זוויות לכל מקור") are gone; the user
 * picks one total and the hook derives `sourceCountTarget` for the
 * engine. `anglesPerSource` is locked to DEFAULT_ANGLES internally.
 * Slice 23 — adds a free numeric input alongside the preset chips.
 * The user can type any integer in
 * [MIN_TOTAL_QUESTIONS_INPUT, MAX_TOTAL_QUESTIONS_INPUT]. When the
 * typed value isn't an exact multiple of (1 + DEFAULT_ANGLES) the
 * engine rounds to the nearest source count; the panel surfaces the
 * resolved count inline so the displayed number is always truthful.
 *
 * Stateless presentation: the hook owns the values, this panel only
 * dispatches. Same pattern as ChapterPanel from P3.
 *
 * The presets disable themselves when they exceed the producible
 * total (available × (1 + DEFAULT_ANGLES)) so the "submitDisabled"
 * path can rely on a single source of truth — the effective total
 * clamps inside `usePracticeBuilder` regardless, so even a stale raw
 * click here doesn't push a too-big number to the server.
 */

type Props = {
  /** Raw user-typed (clamped) input. Drives the input field value. */
  rawTotal: number;
  /** Truthful engine-resolved total: sourceCount × (1 + angles). May
   *  differ from `rawTotal` when the typed number isn't a multiple
   *  of (1 + angles); the panel renders the resolved count as a hint. */
  total: number;
  onSetTotal: (n: number) => void;
  available: number | null;
  isCountPending: boolean;
  hasSelection: boolean;
};

export function CountsPanel({
  rawTotal,
  total,
  onSetTotal,
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

      <div>
        <div className="flex justify-between items-center mb-2.5">
          <span
            className="font-heebo font-semibold"
            style={{ fontSize: 14.5, color: "var(--color-navy-ink)" }}
          >
            כמות שאלות
          </span>
          <span
            className="font-heebo"
            style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
          >
            {MIN_TOTAL_QUESTIONS_INPUT}–{MAX_TOTAL_QUESTIONS_INPUT}
          </span>
        </div>

        {/* Slice 23 — free numeric input. Local string state buffers
            the in-flight typed text so the user can clear and re-type
            without the hook snapping back; an int parse on every
            change fires `onSetTotal`, the hook clamps to
            [MIN_TOTAL_QUESTIONS_INPUT, MAX_TOTAL_QUESTIONS_INPUT].
            The resolved engine total is shown next to the input only
            when it differs from the typed number (truth-in-display). */}
        <div className="mb-3 flex items-center gap-3">
          <TotalNumberInput
            rawTotal={rawTotal}
            onSetTotal={onSetTotal}
            disabled={!hasSelection}
          />
          {rawTotal !== total ? (
            <span
              className="font-heebo"
              style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
              dir="rtl"
            >
              בפועל{" "}
              <b
                style={{ color: "var(--color-navy-ink)", fontWeight: 700 }}
              >
                {total}
              </b>{" "}
              שאלות (עוגל מהמספר שהוקלד)
            </span>
          ) : null}
        </div>

        {/* Preset chips — keep as quick shortcuts. The `active` state
            keys off the resolved `total` so picking a preset
            highlights as expected even after a numeric edit. */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
          {TOTAL_QUESTION_CHOICES.map((n) => {
            // Available source questions × (1 + DEFAULT_ANGLES) = the
            // most we can ever produce. Disable presets that exceed it.
            const maxTotal =
              available !== null ? available * (1 + DEFAULT_ANGLES) : null;
            const enabled = maxTotal !== null && maxTotal >= n;
            const isSelected = total === n;
            return (
              <PickerButton
                key={n}
                value={n}
                active={isSelected && enabled}
                disabled={!enabled}
                onClick={() => enabled && onSetTotal(n)}
              />
            );
          })}
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

/**
 * Slice 23 — Free numeric input for the question total. Mirrors the
 * preset chips' visual idiom (rounded, navy-ink text, line border)
 * so the panel stays cohesive. The component holds a local string
 * for the in-flight typed text so the user can clear the field
 * without the hook snapping back, and parses + dispatches an integer
 * on every change. Incoming `rawTotal` changes (e.g. a preset click)
 * sync back to the displayed string via the effect.
 */
function TotalNumberInput({
  rawTotal,
  onSetTotal,
  disabled,
}: {
  rawTotal: number;
  onSetTotal: (n: number) => void;
  disabled: boolean;
}) {
  // The string buffer lets the user clear / partially edit the field
  // without the hook snapping back the displayed value mid-keystroke.
  // We mirror incoming `rawTotal` changes (preset click, prefill,
  // availability clamp) by comparing the prop against the last seen
  // value during render — a sanctioned React pattern that avoids the
  // `react-hooks/set-state-in-effect` lint warning.
  const [text, setText] = useState<string>(String(rawTotal));
  const [lastSeenRawTotal, setLastSeenRawTotal] = useState<number>(rawTotal);
  if (lastSeenRawTotal !== rawTotal) {
    setLastSeenRawTotal(rawTotal);
    setText(String(rawTotal));
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value;
    setText(next);
    // Empty / non-numeric → don't dispatch; let the user keep typing.
    // Hook-side clamping kicks in once we parse a valid integer.
    if (next === "") return;
    const n = Number.parseInt(next, 10);
    if (Number.isFinite(n)) onSetTotal(n);
  };

  const handleBlur = (): void => {
    // If the user left the field empty or invalid, restore the
    // current clamped value rather than persisting "".
    if (text === "" || !Number.isFinite(Number.parseInt(text, 10))) {
      setText(String(rawTotal));
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={MIN_TOTAL_QUESTIONS_INPUT}
      max={MAX_TOTAL_QUESTIONS_INPUT}
      step={1}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      aria-label="כמות שאלות"
      className={cn(
        "font-heebo font-bold tabular-nums text-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        disabled && "cursor-not-allowed opacity-50"
      )}
      style={{
        width: 92,
        padding: "11px 12px",
        borderRadius: 10,
        fontSize: 15,
        background: "var(--color-paper)",
        color: "var(--color-navy-ink)",
        border: "1.5px solid var(--color-line)",
      }}
    />
  );
}
