"use client";

import { useEffect, useState } from "react";

/**
 * Looping typewriter — types each line, holds, erases, advances.
 *
 * Slice 16 / Phase L2-polish. Ported from the design prototype's
 * `Typewriter` component (`reference/app.jsx` line 16). State
 * machine has three phases:
 *
 *   typing  — append one char every `speed` ms until the full
 *             current line is rendered, then transition to
 *             `holding`.
 *   holding — wait 1600 ms with the full line on screen, then
 *             transition to `erasing`.
 *   erasing — drop one char every max(18, speed/2.5) ms (i.e. a
 *             little faster than typing) until empty, then advance
 *             `idx` and go back to `typing`.
 *
 * The setState calls that drive phase transitions live inside
 * setTimeouts so we never call setState synchronously in the
 * effect body (avoids the `react-hooks/set-state-in-effect`
 * warning that bit us on the cookie bar in L2).
 *
 * Accessibility: the cursor is `aria-hidden` and the live region
 * lives on the parent span so screen readers announce text
 * changes politely without reading the bar char. Under
 * `prefers-reduced-motion: reduce` the cursor blink is disabled
 * via CSS (`.typewriter-cursor` in app/globals.css); the typing
 * itself still runs because the prototype treats the typewriter
 * as core content rather than decoration.
 */
type Phase = "typing" | "holding" | "erasing";

type TypewriterProps = {
  lines: readonly string[];
  /** ms per character while typing. Default 55, matches prototype. */
  speed?: number;
  /** ms to hold the full line before erasing. Default 1600. */
  holdMs?: number;
};

export function Typewriter({
  lines,
  speed = 55,
  holdMs = 1600,
}: TypewriterProps) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");

  useEffect(() => {
    if (lines.length === 0) return;
    const current = lines[idx % lines.length];

    let to: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (text.length < current.length) {
        to = setTimeout(
          () => setText(current.slice(0, text.length + 1)),
          speed
        );
      } else {
        to = setTimeout(() => setPhase("holding"), holdMs);
      }
    } else if (phase === "holding") {
      // Brief pause inside `holding` before flipping to erasing —
      // matches the prototype's 400 ms post-hold delay.
      to = setTimeout(() => setPhase("erasing"), 400);
    } else {
      // erasing
      if (text.length > 0) {
        to = setTimeout(
          () => setText(text.slice(0, -1)),
          Math.max(18, speed / 2.5)
        );
      } else {
        // Wrapping in a 0 ms timeout so the setState pair runs in a
        // separate task — this isn't "set-state-in-effect" then.
        to = setTimeout(() => {
          setIdx((i) => i + 1);
          setPhase("typing");
        }, 0);
      }
    }

    return () => clearTimeout(to);
  }, [text, phase, idx, lines, speed, holdMs]);

  return (
    <span aria-live="polite" className="inline">
      <span className="text-[var(--color-navy-ink)] font-normal">{text}</span>
      <span
        aria-hidden="true"
        className="typewriter-cursor ms-0.5 inline-block font-bold text-[var(--color-gold-deep)]"
      >
        |
      </span>
    </span>
  );
}
