import { methodCopy } from "@/app/(marketing)/_components/landing-copy";

import { PillarVideo } from "./pillar-video";
import styles from "./landing.module.css";

/**
 * Slice 46 — method section (navy bg, 6 pillars).
 *
 * h2 sits at the top center; the 6 pillars below scale from 1-col on mobile
 * → 2-col @700px → 3-col @1024px. Each pillar's `<video>` is a small
 * `<PillarVideo>` client island that hooks into the parent `[data-pillar]`
 * element for hover-play behavior.
 */
export function LandingMethod() {
  return (
    <section className={styles.methodSection} id="method">
      <div className={styles.container}>
        <div
          className={styles.sectionHead}
          style={{ textAlign: "center" }}
        >
          <h2 className={styles.h2}>
            {methodCopy.headline}
            <span style={{ color: "#D4AF37" }}>{methodCopy.headlineGold}</span>
            {methodCopy.headlineTail}
          </h2>
          <p className={styles.lead}>{methodCopy.lead}</p>
        </div>

        <div className={styles.pillars}>
          {methodCopy.pillars.map((pillar) => (
            <div
              key={pillar.num}
              className={styles.pillar}
              data-pillar=""
            >
              <div className={styles.pillarIcon}>
                <PillarVideo src={pillar.videoSrc} />
              </div>
              <div className={styles.pillarNum}>{pillar.num}</div>
              <div className={styles.pillarBar} />
              <h3 className={styles.pillarT}>{pillar.title}</h3>
              <p className={styles.pillarD}>{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
