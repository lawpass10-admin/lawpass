"use client";

import { useEffect, type RefObject } from "react";

/**
 * Shrinks a question column's type until the fact pattern and all four options
 * clear the box, so the candidate never has to scroll to see an answer they are
 * choosing between.
 *
 * Shared by /mahoti and /diuni, which set the same kind of paper: a scrollbar
 * in the question column means reading the question and reading the options are
 * two separate acts, which is not how the paper is sat. Content length varies
 * per question, so no fixed font size can promise a fit — the box is measured
 * and the size stepped down instead.
 *
 * Two stages. First the whole column steps down together, from `maxPx` to
 * `minPx`. If that still overflows, the fact pattern holds at `minPx` and only
 * the options keep shrinking, to `answersMinPx` — a long fact pattern is read
 * once, while the four options are what the candidate compares against each
 * other, and all four visible a size smaller beats three visible at full size.
 *
 * Writes the size straight to the DOM as the custom properties
 * `--fit-q-font` / `--fit-a-font` (consumed by question-fit.module.css) rather
 * than holding it in React state: this is a measure-then-paint loop, and a
 * `setState` in an effect would both re-render the tree for a value only CSS
 * consumes and trip React 19's `set-state-in-effect` rule.
 *
 * The ResizeObserver watches the box, whose own border box is fixed by the flex
 * parent — changing the font size inside it moves `scrollHeight`, never the
 * observed size — so the loop cannot feed itself.
 *
 * `key` re-runs the pass when the content changes without the box resizing:
 * moving to the next question is exactly that.
 */
export type FitBounds = {
  /** The size the column is designed at. */
  maxPx: number;
  /** Floor for the whole column. */
  minPx: number;
  /** Floor for the options alone, once the column has stopped. */
  answersMinPx: number;
  stepPx?: number;
};

export function useFitToBox(
  ref: RefObject<HTMLDivElement | null>,
  key: unknown,
  { maxPx, minPx, answersMinPx, stepPx = 0.5 }: FitBounds
): void {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;

    let frame = 0;
    function fit(): void {
      if (!box) return;
      const overflows = () => box.scrollHeight > box.clientHeight;

      // Stage 1 — the column steps down as a whole. Starts from the top of the
      // range every pass, so a short question gets the full size back.
      let question = maxPx;
      box.style.setProperty("--fit-q-font", `${question}px`);
      box.style.removeProperty("--fit-a-font");
      while (question > minPx && overflows()) {
        question -= stepPx;
        box.style.setProperty("--fit-q-font", `${question}px`);
      }
      if (!overflows()) return;

      // Stage 2 — the question is at its floor; the options give way alone.
      let answers = question;
      while (answers > answersMinPx && overflows()) {
        answers -= stepPx;
        box.style.setProperty("--fit-a-font", `${answers}px`);
      }
    }
    function schedule(): void {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(box);

    // The first pass can land before Heebo has swapped in, and fallback metrics
    // measure short — the text would overflow the moment the real font arrived.
    // A ResizeObserver never sees that: the swap moves scrollHeight, not the
    // box. `fonts.ready` is the signal that does.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) schedule();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, key, maxPx, minPx, answersMinPx, stepPx]);
}
