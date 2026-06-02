import Image from "next/image";

import { faqCopy } from "@/app/(marketing)/_components/landing-copy";

import { FaqAccordion } from "./faq-accordion";
import styles from "./landing.module.css";

/**
 * Slice 46 — FAQ section.
 *
 * Two-column grid (lg+): left = eyebrow + h2 + character circle + quote;
 * right = `<FaqAccordion>` client island. Mobile stacks (left block above
 * the accordion). The character is a portrait inside a rotating dashed ring
 * with a small white quote card hanging off the bottom-end corner.
 */
export function LandingFaq() {
  return (
    <section className={styles.faqSection} id="faq">
      <div className={`${styles.container} ${styles.faqContainer}`}>
        <div className={styles.faqLeft}>
          <div className={styles.sectionHead}>
            <div className={styles.eyebrow}>
              <span aria-hidden className={styles.eyebrowBar} />
              <span>{faqCopy.eyebrow}</span>
            </div>
            <h2 className={styles.h2}>
              {faqCopy.headline}
              <span className={styles.gold}>{faqCopy.headlineGold}</span>
            </h2>
          </div>
          <div className={styles.faqCharacter}>
            <div aria-hidden className={styles.faqCharacterRing} />
            <div className={styles.faqCharacterCircle}>
              <Image
                alt={faqCopy.characterAlt}
                className={styles.faqCharacterImg}
                src="/landing/faq-character.png"
                width={650}
                height={650}
              />
            </div>
            <div className={styles.faqCharacterQuote}>
              <div aria-hidden className={styles.faqQuoteMark}>
                ״
              </div>
              <div className={styles.faqQuoteTitle}>
                {faqCopy.characterQuoteTitle}
              </div>
              <div className={styles.faqQuoteSubtitle}>
                {faqCopy.characterQuoteSubtitle}
              </div>
            </div>
          </div>
        </div>

        <FaqAccordion />
      </div>
    </section>
  );
}
