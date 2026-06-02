import Image from "next/image";

import { footerCopy } from "@/app/(marketing)/_components/landing-copy";

import styles from "./landing.module.css";

/**
 * Slice 46 — landing footer.
 *
 * Navy bar with the logo on the start side + 3 columns of links on the end
 * side. Bottom strip carries the copyright + tagline. Email column links via
 * plain `mailto:` (no Cloudflare obfuscation); privacy/terms/support/etc. are
 * inert "#" placeholders carrying TODO(PM) markers in landing-copy.ts.
 */
export function LandingFooter() {
  return (
    <footer className={styles.siteFooter} id="contact">
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div>
          <Image
            alt={footerCopy.logoAlt}
            className={styles.footerLogo}
            src="/landing/lawpass-logo-landing.png"
            width={195}
            height={113}
          />
        </div>
        <div className={styles.footerCols}>
          {footerCopy.cols.map((col) => (
            <div key={col.heading} className={styles.footerCol}>
              <div className={styles.footerColH}>{col.heading}</div>
              {col.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.footerBottom}>
        <div className={styles.footerBottomInner}>
          <span>{footerCopy.copyright}</span>
          <span>{footerCopy.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
