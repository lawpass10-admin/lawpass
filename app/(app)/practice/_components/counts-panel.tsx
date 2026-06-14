"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type Ref,
} from "react";

import {
  DEFAULT_ANGLES,
  MAX_TOTAL_QUESTIONS_INPUT,
  MIN_TOTAL_QUESTIONS_INPUT,
  TOTAL_QUESTION_DROPDOWN_PRESETS,
} from "@/app/(app)/practice/_lib/use-practice-builder";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P4 — Counts panel.
 * Slice 18 — collapsed to a SINGLE "כמות שאלות" picker. The prior two
 * pill-rows ("שאלות מקור" and "זוויות לכל מקור") are gone; the user
 * picks one total and the hook derives `sourceCountTarget` for the
 * engine. `anglesPerSource` is locked to DEFAULT_ANGLES internally.
 * Slice 23 — added a free numeric input alongside the preset chips.
 * Slice 59 B — preset CHIPS replaced by a native <select> dropdown
 * offering 5, 10, 30, 40, plus "ידני" which reveals the existing
 * <TotalNumberInput>. The engine math is unchanged (sourceCountTarget
 * = round(total/3); resolved total = source × 3), so 5→6, 10→9, 40→39
 * effective questions (only 30 lands on an exact engine multiple).
 *
 * Slice 60 — layout & cleanup:
 *   • Part 1: the "≈ N שאלות בפועל" caption is removed. The summary
 *     footer already surfaces the truthful resolved total.
 *   • Part 2: the populated-state availability subtitle ("כרגע יש N
 *     שאלות זמינות בנושאים שבחרת") is removed. Status messages for
 *     no-selection / loading / no-available stay — they convey state.
 *   • Part 3: the section becomes a 2-column layout at md+: title
 *     block on the RTL-start (visual-right), the selector cluster on
 *     the RTL-end (visual-left). Mobile stacks (flex-col). Title's
 *     duplicate "כמות שאלות" inline label was redundant with the H2
 *     and is dropped; the <select> still carries aria-label.
 *
 * Stateless presentation: the hook owns rawTotal/total, this panel
 * only dispatches. Same pattern as ChapterPanel from P3.
 *
 * The presets disable themselves when they exceed the producible
 * total (available × (1 + DEFAULT_ANGLES)) so the "submitDisabled"
 * path can rely on a single source of truth — the effective total
 * clamps inside `usePracticeBuilder` regardless, so even a stale raw
 * selection here doesn't push a too-big number to the server.
 */

type Props = {
  /** Raw user-typed (clamped) input. Drives the input field value. */
  rawTotal: number;
  /** Truthful engine-resolved total: sourceCount × (1 + angles). May
   *  differ from `rawTotal` when the typed/picked number isn't a
   *  multiple of (1 + angles); the summary footer surfaces it. */
  total: number;
  onSetTotal: (n: number) => void;
  available: number | null;
  isCountPending: boolean;
  hasSelection: boolean;
};

const MANUAL_SELECT_VALUE = "manual";

export function CountsPanel({
  rawTotal,
  onSetTotal,
  available,
  isCountPending,
  hasSelection,
}: Props) {
  // Slice 60 — `total` is intentionally NOT destructured: the caption
  // that surfaced it was removed; the prop stays on the Props type
  // (parent already passes it) so the public surface is stable for
  // future copy that might want the resolved value back.

  // Slice 60 — only status messages remain in this subtitle slot; the
  // populated-state count line was dropped. `null` collapses the slot
  // entirely so the title sits flush against the selector on wide.
  const subLine = !hasSelection
    ? "בחר פרק כדי לראות שאלות זמינות"
    : isCountPending || available === null
      ? "טוען זמינות..."
      : available === 0
        ? "אין שאלות זמינות בנושאים שבחרת."
        : null;

  // Slice 59 B — mode resolution.
  //   • If the user explicitly picked "ידני" in this session, force
  //     manual mode (input source-of-truth) so that even when they
  //     subsequently type a value that happens to match a preset, the
  //     UI stays in the user's chosen mode.
  //   • Otherwise mode is derived from rawTotal: preset when it's one
  //     of TOTAL_QUESTION_DROPDOWN_PRESETS, manual otherwise. This
  //     handles hydration (e.g. ?total=15 → manual) and upstream
  //     availability clamps (e.g. 40→36 → manual).
  const [forceManual, setForceManual] = useState(false);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const isPresetValue = (
    TOTAL_QUESTION_DROPDOWN_PRESETS as readonly number[]
  ).includes(rawTotal);
  const mode: "preset" | "manual" =
    forceManual || !isPresetValue ? "manual" : "preset";

  // Per-option over-saturation guard: keep an option enabled only when
  // the producible ceiling (available sources × 3) covers it.
  const maxProducible =
    available !== null ? available * (1 + DEFAULT_ANGLES) : null;
  const isOptionEnabled = (n: number): boolean =>
    maxProducible !== null && maxProducible >= n;

  const selectValue =
    mode === "manual" ? MANUAL_SELECT_VALUE : String(rawTotal);

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (value === MANUAL_SELECT_VALUE) {
      setForceManual(true);
      // Render flips on this state change → microtask focuses the
      // newly-mounted input after the commit.
      queueMicrotask(() => manualInputRef.current?.focus());
      return;
    }
    setForceManual(false);
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n)) onSetTotal(n);
  };

  return (
    <section
      className="rounded-[22px] border bg-card"
      style={{
        padding: "24px 26px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Slice 60 — 2-column layout on md+. Title block sits at the
          RTL-start (visual-right); the selector cluster fills the
          RTL-end (visual-left) so the formerly-empty half is used.
          Mobile keeps the stack (flex-col → title above selector). */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="md:max-w-[320px]">
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
          {subLine && (
            <p
              className="font-heebo font-normal mt-1"
              style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
            >
              {subLine}
            </p>
          )}
        </div>

        {/* Selector cluster — native <select> on the RTL-start of the
            cluster (visual-right within its own bounds), manual input
            slides in alongside on ידני mode. `md:shrink-0` keeps the
            cluster from collapsing when the title block is wide. */}
        <div className="flex items-stretch gap-2 md:shrink-0">
          <select
            value={selectValue}
            onChange={handleSelectChange}
            disabled={!hasSelection}
            aria-label="כמות שאלות"
            className={cn(
              "font-heebo font-bold tabular-nums text-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              !hasSelection && "cursor-not-allowed opacity-50"
            )}
            style={{
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 15,
              minWidth: 132,
              background: "var(--color-paper)",
              color: "var(--color-navy-ink)",
              border: "1.5px solid var(--color-line)",
            }}
          >
            {TOTAL_QUESTION_DROPDOWN_PRESETS.map((n) => (
              <option key={n} value={n} disabled={!isOptionEnabled(n)}>
                {n}
              </option>
            ))}
            <option value={MANUAL_SELECT_VALUE}>ידני</option>
          </select>

          {mode === "manual" && (
            <TotalNumberInput
              rawTotal={rawTotal}
              onSetTotal={onSetTotal}
              disabled={!hasSelection}
              inputRef={manualInputRef}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Slice 23 — Free numeric input for the question total. Compact
 * (same height as the dropdown) with a gold accent border to read
 * as editable, distinct from the line-border dropdown.
 *
 * Slice 60 — the snap-on-blur to the engine-resolved `total` was
 * dropped along with the "≈ N שאלות בפועל" caption; the literal user
 * input now persists (clamped) so a typed "15" stays "15" in the
 * field. The hook still derives sourceCountTarget for the engine, and
 * the summary footer surfaces the resolved count.
 *
 * Slice 59 B — accepts an optional inputRef so CountsPanel can focus
 * the field when the user picks "ידני" from the selector.
 */
function TotalNumberInput({
  rawTotal,
  onSetTotal,
  disabled,
  inputRef,
}: {
  rawTotal: number;
  onSetTotal: (n: number) => void;
  disabled: boolean;
  inputRef?: Ref<HTMLInputElement>;
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
    // Empty / invalid → restore the current clamped value. We DON'T
    // snap to the engine-resolved total anymore (Slice 60 dropped
    // that caption); the literal user input persists for next time.
    const parsed = Number.parseInt(text, 10);
    if (text === "" || !Number.isFinite(parsed)) {
      setText(String(rawTotal));
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode="numeric"
      min={MIN_TOTAL_QUESTIONS_INPUT}
      max={MAX_TOTAL_QUESTIONS_INPUT}
      step={1}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      aria-label="כמות שאלות (ידני)"
      className={cn(
        "font-heebo font-bold tabular-nums text-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/40",
        disabled && "cursor-not-allowed opacity-50"
      )}
      style={{
        // Match the selector's vertical rhythm so the input sits
        // flush with it when they share a flex row.
        padding: "11px 12px",
        width: 96,
        borderRadius: 10,
        fontSize: 15,
        background: "var(--color-gold-tint)",
        color: "var(--color-navy-ink)",
        border: "1.5px solid var(--color-gold)",
      }}
    />
  );
}
