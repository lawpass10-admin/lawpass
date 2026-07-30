import styles from "./landing.module.css";

/**
 * Slice 47 — "החליקו לצדדים" swipe-hint for the mobile horizontal carousels
 * (method pillars + plans cards). The component is always rendered in the
 * server tree; the CSS rule `.swipeHint { display: none }` at the module's
 * top level hides it by default, and the `@media (max-width: 767px)` block
 * flips it to `display: flex` only on mobile. Color is styled per-section
 * via descendant selectors (`.methodSection .swipeHint` vs `.plansSection
 * .swipeHint`).
 *
 * Faithful port of the design's `<div class="swipe-hint">` markup at lines
 * 1414 and 1932 of `_design/landing-hifi-new.html`.
 */
export function SwipeHint() {
  return (
    <div className={styles.swipeHint} aria-hidden>
      <svg height="15" width="15" viewBox="0 0 24 24">
        <path
          d="M9 6l-4 6 4 6M15 6l4 6-4 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      החליקו לצדדים
    </div>
  );
}
