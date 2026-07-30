import { sourceNoteCopy } from "@/app/(marketing)/_components/landing-copy";

import styles from "./landing.module.css";

/**
 * Slice 46 — source-note strip (NEW section in the rebuild).
 *
 * Lives directly below the hero. Two short statements (the question-bank
 * grounding + the citations grounding) in a 2-column grid that stacks under
 * 820px. Each item carries an inline-start gold border-rule + a gold-deep
 * highlighted phrase.
 *
 * Copy was corrected from the design's "אלפי השאלות" → "מעל 1,000 השאלות" per
 * the Slice 46 locked content decision (live bank ~1,088).
 */
export function LandingSourceNote() {
  const [first, second] = sourceNoteCopy.items;
  return (
    <section
      className={styles.sourceNote360}
      aria-label={sourceNoteCopy.ariaLabel}
    >
      <div className={styles.sourceNoteGrid}>
        <p className={styles.sourceNoteItem}>
          <span className={styles.snHl}>{first.highlight}</span>
          {first.tail}
        </p>
        <p className={styles.sourceNoteItem}>
          {second.lead}
          <span className={styles.snHl}>{second.highlight}</span>
          {second.tail}
        </p>
      </div>
    </section>
  );
}
