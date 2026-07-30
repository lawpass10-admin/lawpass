"use client";

import { useEffect, useState } from "react";

import styles from "./landing.module.css";

/**
 * Slice 46 — hero subline typewriter.
 * Slice 47 — fix: the loop's mutable state (displayedText, lineIdx, phase)
 *   now lives in EFFECT-LOCAL `let` bindings instead of React state + refs,
 *   and the effect deps are `[lines]` only. Reason: in the Slice-46 version
 *   `useEffect` depended on `[text, lines]`, so every setText triggered a
 *   re-render whose cleanup `clearTimeout`'d the just-scheduled 55 ms tick.
 *   The effect then re-ran and scheduled a fresh `setTimeout(step, 0)` — net
 *   effect: each char appeared at the React render+effect cycle pace (~16 ms)
 *   rather than the intended TYPE_SPEED_MS (55 ms), and the typewriter read
 *   as "instant" instead of typing visibly.
 *
 *   New shape: `text` stays as state purely for the visible <span>. The loop
 *   reads/mutates `displayedText` directly, calling `setText(displayedText)`
 *   to repaint. Cleanup runs only on unmount.
 *
 * Faithful port of the design's script 3a (lines 1996–2030 of
 * `_design/landing-hifi-new.html`): types each phrase, holds, erases, advances.
 */

const TYPE_SPEED_MS = 55;
const HOLD_MS = 1600;
const ERASE_SPEED_MS = Math.max(18, TYPE_SPEED_MS / 2.5);
const HOLD_AFTER_HOLD_MS = 400;

export function HeroTypewriter({ lines }: { lines: readonly string[] }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    // Slice 47 — locals replace state for the loop's working memory. The
    // closure stays stable across the whole loop lifetime so the 55ms /
    // 22ms ticks fire as intended.
    let displayedText = "";
    let lineIdx = 0;
    let phase: "typing" | "holding" | "erasing" = "typing";

    const step = () => {
      if (cancelled) return;
      const cur = lines[lineIdx % lines.length];
      if (phase === "typing") {
        if (displayedText.length < cur.length) {
          displayedText = cur.slice(0, displayedText.length + 1);
          setText(displayedText);
          timeoutId = setTimeout(step, TYPE_SPEED_MS);
        } else {
          phase = "holding";
          timeoutId = setTimeout(step, HOLD_MS);
        }
      } else if (phase === "holding") {
        phase = "erasing";
        timeoutId = setTimeout(step, HOLD_AFTER_HOLD_MS);
      } else {
        if (displayedText.length > 0) {
          displayedText = displayedText.slice(0, -1);
          setText(displayedText);
          timeoutId = setTimeout(step, ERASE_SPEED_MS);
        } else {
          lineIdx += 1;
          phase = "typing";
          timeoutId = setTimeout(step, 0);
        }
      }
    };

    timeoutId = setTimeout(step, 0);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [lines]);

  return (
    <>
      <span className={styles.twText}>{text}</span>
      <span aria-hidden className={styles.twCursor}>
        |
      </span>
    </>
  );
}
