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
        <div className="mb-2.5">
          <span
            className="font-heebo font-semibold"
            style={{ fontSize: 14.5, color: "var(--color-navy-ink)" }}
          >
            כמות שאלות
          </span>
        </div>

        {/* Slice 23.1 — input + preset chips share a single flex row.
            The input lives at the RTL-start (right) edge with a gold
            accent border so it reads as editable; the presets fill
            the rest of the row as the same-height quick shortcuts.
            No inline hint sentence — the summary footer carries the
            truthful resolved total, and the input snaps to that
            resolved value on blur. */}
        <div className="flex items-stretch gap-1.5">
          <TotalNumberInput
            rawTotal={rawTotal}
            total={total}
            onSetTotal={onSetTotal}
            disabled={!hasSelection}
          />
          <div className="grid flex-1 grid-cols-3 md:grid-cols-6 gap-1.5">
            {TOTAL_QUESTION_CHOICES.map((n) => {
              // Available source questions × (1 + DEFAULT_ANGLES) =
              // the most we can ever produce. Disable presets that
              // exceed it.
              const maxTotal =
                available !== null
                  ? available * (1 + DEFAULT_ANGLES)
                  : null;
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
 * Slice 23 — Free numeric input for the question total. Compact
 * (same height as a preset chip) with a gold accent border to read
 * as editable, distinct from the line-border preset chips.
 *
 * The component holds a local string buffer for the in-flight typed
 * text so the user can clear / partial-edit without the hook
 * snapping back mid-keystroke. Slice 23.1 — on BLUR the field snaps
 * to the engine-resolved `total` (and dispatches it back to the
 * hook), so what the user sees in the input is always the truthful
 * count after they tab away. No inline hint sentence required.
 */
function TotalNumberInput({
  rawTotal,
  total,
  onSetTotal,
  disabled,
}: {
  rawTotal: number;
  total: number;
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
    // Slice 23.1 — snap-on-blur. The hook's `total` is the engine-
    // resolved count (sourceCount × (1 + angles)); if the user typed
    // a number that rounds to a different engine output we sync the
    // displayed text AND dispatch `total` back so rawTotal === total
    // afterwards. Empty / invalid input falls back to the current
    // resolved value, same idea.
    const parsed = Number.parseInt(text, 10);
    if (text === "" || !Number.isFinite(parsed)) {
      setText(String(total));
      if (rawTotal !== total) onSetTotal(total);
      return;
    }
    if (parsed !== total) {
      setText(String(total));
      onSetTotal(total);
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/40",
        disabled && "cursor-not-allowed opacity-50"
      )}
      style={{
        // Match the preset chips' vertical rhythm so the input sits
        // flush with them when they share a flex row.
        padding: "11px 12px",
        width: 88,
        borderRadius: 10,
        fontSize: 15,
        background: "var(--color-gold-tint)",
        color: "var(--color-navy-ink)",
        border: "1.5px solid var(--color-gold)",
      }}
    />
  );
}
