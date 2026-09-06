import styles from "./grading-illustration.module.css";

/**
 * The marker at work — shown while a written answer is being graded.
 *
 * Replaces a generic spinner. A spinner says "something is happening"; this says
 * what is happening, which on a screen the candidate is asked to wait on for
 * several minutes is the difference between a page that looks busy and one that
 * looks stuck. The ticks draw themselves in sequence and the nib follows, so the
 * loop reads as work being done rather than as a thing rotating.
 *
 * Decorative: `aria-hidden`, with the status carried by the <h1 role="status">
 * beside it. A screen reader gets the sentence, not a description of a pen.
 *
 * Drawn in the site's own navy and gold rather than a stock illustration, at a
 * 120-unit viewBox scaled by the caller.
 */
export function GradingIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="presentation"
      aria-hidden
      focusable="false"
    >
      {/* Soft ground, breathing slowly so the card is never quite static. */}
      <circle className={styles.halo} cx="60" cy="60" r="46" fill="var(--color-gold)" opacity="0.12" />

      <g className={styles.sheet}>
        {/* The paper. A clipped corner reads as a sheet far more cheaply than a
            drop shadow, and survives dark mode without a second colour. */}
        <path
          d="M30 16 h44 l14 14 v74 a4 4 0 0 1 -4 4 H30 a4 4 0 0 1 -4 -4 V20 a4 4 0 0 1 4 -4 z"
          fill="var(--card, #fff)"
          stroke="var(--color-navy-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M74 16 v10 a4 4 0 0 0 4 4 h10"
          fill="none"
          stroke="var(--color-navy-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* The candidate's writing, abstracted to rules. Shortening the last
            line is what makes it read as prose rather than as a table. */}
        <g stroke="var(--color-ink-muted)" strokeWidth="3" strokeLinecap="round" opacity="0.35">
          <line x1="37" y1="44" x2="77" y2="44" />
          <line x1="37" y1="54" x2="81" y2="54" />
          <line x1="37" y1="76" x2="77" y2="76" />
          <line x1="37" y1="86" x2="66" y2="86" />
        </g>

        {/* Two marks in the margin — the thing being waited for. */}
        <path
          className={`${styles.tick} ${styles.tick1}`}
          d="M38 62 l5 5 l10 -11"
          fill="none"
          stroke="var(--color-status-strong, #1F8A5B)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className={`${styles.tick} ${styles.tick2}`}
          d="M38 94 l5 5 l10 -11"
          fill="none"
          stroke="var(--color-status-strong, #1F8A5B)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* The pen, travelling between the two marks. Grouped so one transform
          moves the whole thing, nib and barrel together. */}
      <g className={styles.pen}>
        <path
          d="M96 40 l10 10 l-30 30 l-13 3 l3 -13 z"
          fill="var(--color-gold)"
          stroke="var(--color-navy-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* The nib: the darker tip that makes the shape read as a pen rather
            than as an arrow. */}
        <path
          d="M63 80 l3 -13 l6 6 z"
          fill="var(--color-navy-ink)"
        />
        <line
          x1="90"
          y1="46"
          x2="100"
          y2="56"
          stroke="var(--color-navy-ink)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
