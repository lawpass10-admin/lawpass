"use client";

import { useEffect, useRef } from "react";

/**
 * Slice 46 — method-section pillar video.
 *
 * Faithful port of the design's script 3d (lines 2055–2085 of
 * `_design/landing-hifi-new.html`). Bind to the parent `.pillar` element via
 * the `getParent` callback (passed down as a ref the parent sets) and:
 *   - `mouseenter` → seek to 0, play, race-guard the play-promise.
 *   - `mouseleave` → wait for an in-flight play to settle, then seek to
 *     duration-0.05 and pause (so the pillar reads as "ended, last frame
 *     visible" rather than mid-frame).
 *   - On metadata/data-loaded, settle to last frame so the very first paint
 *     also shows a complete still.
 *
 * Pure presentation — does NOT autoplay continuously; the videos are decorative
 * loops keyed to hover.
 */
export function PillarVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Bind on the parent `.pillar` so hover anywhere in the card plays the
    // glyph, not only over the video tile itself.
    const pillar = video.closest("[data-pillar]") as HTMLElement | null;
    if (!pillar) return;

    let hasIdled = false;
    let playPromise: Promise<void> | null = null;

    const settle = () => {
      if (hasIdled) return;
      try {
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = Math.max(0, video.duration - 0.05);
          video.pause();
          hasIdled = true;
        }
      } catch {
        // No-op — quiet failure path matches the offline script's intent.
      }
    };

    const onEnter = () => {
      hasIdled = false;
      try {
        video.currentTime = 0;
        const p = video.play();
        if (p && typeof p.catch === "function") {
          playPromise = p;
          p.catch(() => {});
        }
      } catch {
        // ditto
      }
    };

    const onLeave = () => {
      const finish = () => {
        hasIdled = false;
        settle();
      };
      if (playPromise) {
        playPromise.then(finish, finish);
      } else {
        finish();
      }
    };

    video.addEventListener("loadedmetadata", settle);
    video.addEventListener("loadeddata", settle);
    pillar.addEventListener("mouseenter", onEnter);
    pillar.addEventListener("mouseleave", onLeave);
    return () => {
      video.removeEventListener("loadedmetadata", settle);
      video.removeEventListener("loadeddata", settle);
      pillar.removeEventListener("mouseenter", onEnter);
      pillar.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      aria-hidden
      loop
      muted
      playsInline
      preload="auto"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
