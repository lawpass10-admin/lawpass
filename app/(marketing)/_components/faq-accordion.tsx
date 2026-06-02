"use client";

import { useState } from "react";

import { faqCopy } from "@/app/(marketing)/_components/landing-copy";
import styles from "./landing.module.css";

/**
 * Slice 46 — single-open FAQ accordion island.
 *
 * Faithful port of the design's script 3c (lines 2037–2049 of
 * `_design/landing-hifi-new.html`): clicking an item closes any other open
 * item and toggles the clicked one. The first item starts open by default
 * (same as the design's initial state set via JS).
 *
 * The accordion is the ONLY interactive bit of the FAQ section — the left
 * column (eyebrow + h2 + character + quote) stays server-rendered and is
 * composed alongside this island by `<LandingFaq>`.
 */

export function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <div className={styles.faqList}>
      {faqCopy.items.map((item, i) => {
        const isOpen = openIdx === i;
        // CSS Modules hash BOTH `.faqItem` and `.open` — the compound selector
        // `.faqItem.open` in landing.module.css matches when the element has
        // both hashed classes. So we join the hashed names rather than
        // appending a literal "open".
        const itemClass = isOpen
          ? `${styles.faqItem} ${styles.open}`
          : styles.faqItem;
        return (
          <div key={i} className={itemClass}>
            <button
              type="button"
              className={styles.faqQ}
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? -1 : i)}
            >
              <span className={styles.faqQText}>{item.question}</span>
              <span aria-hidden className={styles.faqQIcon}>
                <svg height="16" viewBox="0 0 20 20" width="16">
                  <path
                    d="M5 8l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.4"
                  />
                </svg>
              </span>
            </button>
            <div className={styles.faqAWrap}>
              <div className={styles.faqA}>{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
