"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./landing.module.css";

/**
 * Slice 46 — hero subline typewriter.
 *
 * Faithful port of the design's script 3a (lines 1996–2030 of
 * `_design/landing-hifi-new.html`): types each phrase, holds, erases, advances.
 * Refs hold the run-state across rerenders so a hot-reload doesn't double-fire
 * the loop. Uses CSS classes from `landing.module.css` (`.twText` + `.twCursor`)
 * — both module-local.
 */

const TYPE_SPEED_MS = 55;
const HOLD_MS = 1600;
const ERASE_SPEED_MS = Math.max(18, TYPE_SPEED_MS / 2.5);
const HOLD_AFTER_HOLD_MS = 400;

export function HeroTypewriter({ lines }: { lines: readonly string[] }) {
  const [text, setText] = useState("");
  const idxRef = useRef(0);
  const phaseRef = useRef<"typing" | "holding" | "erasing">("typing");

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const step = () => {
      if (cancelled) return;
      const cur = lines[idxRef.current % lines.length];
      if (phaseRef.current === "typing") {
        if (text.length < cur.length) {
          const next = cur.slice(0, text.length + 1);
          setText(next);
          timeout = setTimeout(step, TYPE_SPEED_MS);
        } else {
          phaseRef.current = "holding";
          timeout = setTimeout(step, HOLD_MS);
        }
      } else if (phaseRef.current === "holding") {
        phaseRef.current = "erasing";
        timeout = setTimeout(step, HOLD_AFTER_HOLD_MS);
      } else {
        if (text.length > 0) {
          setText(text.slice(0, -1));
          timeout = setTimeout(step, ERASE_SPEED_MS);
        } else {
          idxRef.current += 1;
          phaseRef.current = "typing";
          timeout = setTimeout(step, 0);
        }
      }
    };

    timeout = setTimeout(step, 0);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
    // `text` and `lines` participate in the loop; the parent passes a stable
    // const array so re-runs only fire on real changes.
  }, [text, lines]);

  return (
    <>
      <span className={styles.twText}>{text}</span>
      <span aria-hidden className={styles.twCursor}>
        |
      </span>
    </>
  );
}
