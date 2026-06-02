import Image from "next/image";
import Link from "next/link";

import { footerCopy } from "@/app/(marketing)/_components/landing-copy";

import styles from "./landing.module.css";

/**
 * Slice 46 — landing footer.
 *
 * Navy bar with the logo on the start side + 3 columns of links on the end
 * side. Bottom strip carries the copyright + tagline. Email column links via
 * plain `mailto:` (no Cloudflare obfuscation).
 *
 * Slice 50 — internal app routes (anything starting with "/") are now
 * rendered via `next/link` for client-side navigation; external + mailto +
 * anchor-only ("#") links stay on plain `<a>`. The "תקנון" slot was retired
 * in favor of "הצהרת נגישות" → /accessibility, and "מדיניות פרטיות" is
 * wired to /privacy. The רענון tag is rendered identically — only the
 * element type swaps based on href shape.
 */
function FooterLink({ href, label }: { href: string; label: string }) {
  // Internal app routes get next/link's prefetch + client-side nav. Everything
  // else (anchor "#", mailto:, external) stays on plain <a>.
  if (href.startsWith("/")) {
    return <Link href={href}>{label}</Link>;
  }
  return <a href={href}>{label}</a>;
}

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
                <FooterLink
                  key={link.label}
                  href={link.href}
                  label={link.label}
                />
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
