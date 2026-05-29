"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { METHOD_EYEBROW, METHOD_PILLARS } from "./landing-copy";
import { MarketingSection } from "./marketing-section";

/**
 * Method section — six pillars with hover-to-play MP4 icons.
 *
 * Slice 16 / Phase L3. Navy-ink background, three-column grid of
 * `pillar` cards. Each card is a static title + description with a
 * looping (idle: paused on last frame) MP4 icon that resets to 0
 * and plays on `mouseenter`, returns to last frame on `mouseleave`.
 *
 * The MP4 elements are lazily mounted — they only render after an
 * IntersectionObserver flips `inView` to true. Cuts ~470 KB of
 * autoloaded video off the initial landing payload (six clips at
 * ~60–100 KB each) and keeps `preload="auto"` honest: video bytes
 * are only fetched once the section is on-screen.
 *
 * Decision 8 — MP4 paths are `/animations/landing/<name>.mp4`.
 */
export function LandingMethod() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    // IntersectionObserver is universally available in browsers our
    // Next 16 / React 19 stack targets; if a freak runtime is missing
    // it the pillars still render fine, the MP4 icons just stay blank.
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      // Start loading slightly before the section enters the viewport.
      { rootMargin: "200px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <MarketingSection
      as="section"
      id="method"
      className="relative overflow-hidden bg-[var(--color-navy-ink)] text-white"
      innerClassName="px-8 pt-20 pb-28"
    >
      {/* Subtle ambient wash — prototype .method-section::before. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 460px at 88% 12%, rgba(201,161,73,0.12), transparent 65%), radial-gradient(560px 400px at 8% 88%, rgba(255,255,255,0.04), transparent 65%)",
        }}
      />

      <div ref={sectionRef} className="relative">
        <div className="mx-auto mb-11 max-w-[820px] text-center">
          <div className="mb-[22px] inline-flex items-center gap-3 text-sm font-medium tracking-[0.01em] text-[var(--color-gold)]">
            <span
              aria-hidden="true"
              className="block h-[1.5px] w-7 shrink-0 bg-[var(--color-gold)]"
            />
            <span>{METHOD_EYEBROW}</span>
          </div>
          <h2 className="mb-[18px] font-extrabold leading-[1.08] tracking-[-0.01em] text-[clamp(36px,4vw,56px)] text-white">
            שיטת ה-<span className="text-[var(--color-gold)]">360°</span> — כל
            שאלה היא <span className="text-[var(--color-gold)]">שישה שיעורים.</span>
          </h2>
          <p className="mx-auto max-w-[620px] text-[clamp(17px,1.4vw,19px)] leading-[1.55] text-white/[0.78]">
            לכל שאלת מקור מבחינות עבר אנחנו מצמידים חמש שאלות זווית — כל אחת
            עם ניתוח 360° עצמאי. ככה אתם לא לומדים שאלה אחת, אתם לומדים את
            הנושא.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {METHOD_PILLARS.map((p, i) => (
            <Pillar
              key={p.title}
              index={i}
              title={p.title}
              desc={p.desc}
              video={p.video}
              loadVideo={inView}
            />
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}

type PillarProps = {
  index: number;
  title: string;
  desc: string;
  video: string;
  loadVideo: boolean;
};

function Pillar({ index, title, desc, video, loadVideo }: PillarProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Tracks the most recent play() promise so a quick mouseleave can
  // wait for it to resolve before calling pause(). Without this,
  // pause() interrupts the in-flight play() and the browser fires
  // an `AbortError: play() interrupted by pause()` rejection (which
  // is otherwise harmless but spams the console).
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Park the clip on its last frame so the still icon has the
  // "fully-formed" pose rather than the empty first frame.
  const settleOnLastFrame = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        v.currentTime = Math.max(0, v.duration - 0.05);
      }
      v.pause();
    } catch {
      // Ignore — best-effort idle frame.
    }
  };

  // Awaits any pending play() before settling, so we never call
  // pause() while play() is still resolving.
  const settleSafe = () => {
    const pending = playPromiseRef.current;
    if (pending) {
      pending.then(settleOnLastFrame, settleOnLastFrame);
    } else {
      settleOnLastFrame();
    }
  };

  return (
    <div
      className={cn(
        "group/pillar relative cursor-default rounded-[var(--radius-card-lg)] border border-white/[0.04] bg-white p-8 text-center transition-[background,color,transform,box-shadow,border-color] duration-300",
        "hover:-translate-y-1 hover:border-[rgba(201,161,73,0.55)] hover:bg-[var(--color-navy)] hover:text-white",
        "shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35)] hover:shadow-[0_28px_60px_-14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(201,161,73,0.35)]"
      )}
      onMouseEnter={() => {
        const v = videoRef.current;
        if (!v) return;
        try {
          v.currentTime = 0;
          const p = v.play();
          if (p && typeof p.then === "function") {
            // Stash + swallow AbortError. The `catch` returns void so
            // the stashed promise stays a Promise<void> the leave
            // handler can `.then()`.
            playPromiseRef.current = p.catch(() => {});
          }
        } catch {
          // Synchronous throw (e.g. detached element) — fall back to
          // last-frame so the slot isn't blank.
          settleOnLastFrame();
        }
      }}
      onMouseLeave={settleSafe}
    >
      <div className="mx-auto mb-[22px] flex h-18 w-18 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white transition-[border-color,box-shadow,transform] duration-300 group-hover/pillar:border-[rgba(201,161,73,0.7)] group-hover/pillar:shadow-[0_6px_18px_-6px_rgba(201,161,73,0.35)] group-hover/pillar:scale-[1.03]">
        {loadVideo ? (
          // Using a <source> child (rather than src on <video>) lets
          // us declare the MIME type explicitly — some browsers will
          // refuse to load a source without a confirmed video/mp4
          // type and fall back to the NotSupportedError seen in
          // QA when going through certain proxies / CDNs.
          //
          // settleOnLastFrame is wired into THREE load events because
          // the order they fire in varies by browser:
          //   loadedmetadata → duration known (might be Infinity briefly)
          //   loadeddata     → first frame decoded
          //   canplay        → first usable frame ready to render
          // First one to land where duration is finite wins; later
          // calls are no-ops thanks to the Number.isFinite guard.
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedMetadata={settleOnLastFrame}
            onLoadedData={settleOnLastFrame}
            onCanPlay={settleOnLastFrame}
            className="block h-full w-full bg-white object-contain"
          >
            <source src={video} type="video/mp4" />
          </video>
        ) : (
          // Placeholder before the section is on-screen — keeps the
          // 72×72 slot reserved so the pillars don't shift when MP4s
          // mount. Stays empty (no styling) to avoid a fake "icon".
          <div aria-hidden="true" className="h-full w-full" />
        )}
      </div>
      <div className="text-[13px] font-bold tracking-[0.06em] text-[var(--color-gold-deep)] transition-colors duration-300 group-hover/pillar:text-[var(--color-gold)]">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="mx-auto my-[22px] h-[3px] w-16 rounded bg-[var(--color-gold)] transition-[width,background] duration-300 group-hover/pillar:w-22" />
      <h3 className="mb-3 text-[22px] font-bold leading-[1.25] text-[var(--color-navy-ink)] transition-colors duration-300 group-hover/pillar:text-white">
        {title}
      </h3>
      <p className="font-[Assistant] text-[15.5px] leading-[1.55] text-[var(--ink-3)] transition-colors duration-300 group-hover/pillar:text-white/85">
        {desc}
      </p>
    </div>
  );
}
