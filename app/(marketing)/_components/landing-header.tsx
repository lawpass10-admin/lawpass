import Image from "next/image";
import Link from "next/link";

import { headerCopy } from "@/app/(marketing)/_components/landing-copy";

import styles from "./landing.module.css";

/**
 * Slice 46 — landing header.
 *
 * Sticky navy bar with nav (md+) + centered logo + gold-pill CTA. Mobile drops
 * the nav and squeezes to logo+CTA via the 2-column grid in the module CSS.
 * `כניסה לאזור אישי` routes to /login (testers reach the app).
 */
export function LandingHeader() {
  return (
    <header className={styles.siteHeader}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <nav aria-label="ראשי" className={styles.mainNav}>
          {headerCopy.navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <Link aria-label="LawPass" className={styles.logoLink} href="/">
          <Image
            alt="LawPass"
            src="/landing/lawpass-logo-landing.png"
            width={195}
            height={113}
            priority
          />
        </Link>
        <Link href={headerCopy.ctaHref} className={styles.headerCta}>
          {headerCopy.ctaLabel}
        </Link>
      </div>
    </header>
  );
}
