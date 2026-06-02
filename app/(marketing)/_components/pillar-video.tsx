"use client";

import { useEffect, useRef } from "react";

/**
 * Slice 46 — method-section pillar video.
 * Slice 47 — touch devices now play the videos via IntersectionObserver
 *   instead of relying on mouseenter / mouseleave (which never fire on
 *   touch). Hover-capable devices keep the design's polished behavior:
 *   play from 0 on mouseenter, then seek to duration-0.05 and pause on
 *   mouseleave (the "settle to last frame" hand-off).
 *
 *   Branching is driven by `matchMedia("(hover: hover) and (pointer: fine)")`
 *   — a true positive means a precise pointing device that can hover (mouse
 *   or trackpad); anything else falls into the touch path. We re-check the
 *   media query on mount (NOT statically) so a window resize from hover to
 *   touch (e.g. dragging a window onto a tablet display) gets the right
 *   handler.
 *
 *   IntersectionObserver autoplay: when the pillar enters the viewport
 *   `video.play()` (race-guarded against the play-promise rejection on
 *   quick scroll); when it leaves, `video.pause()` so we never have 6
 *   videos playing off-screen.
 */
export function PillarVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const pillar = video.closest("[data-pillar]") as HTMLElement | null;
    if (!pillar) return;

    let playPromise: Promise<void> | null = null;
    const safePlay = () => {
      try {
        const p = video.play();
        if (p && typeof p.catch === "function") {
          playPromise = p;
          p.catch(() => {});
        }
      } catch {
        // No-op — quiet failure path matches the offline script's intent.
      }
    };

    // Detect whether the device can hover with a precise pointer. The
    // standard "user has a mouse" media query — coarse touch screens
    // (phones, most tablets) will return false here.
    const hoverCapable =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // ------------------------------------------------------------------
    // HOVER-CAPABLE branch — original design behavior, unchanged.
    // ------------------------------------------------------------------
    if (hoverCapable) {
      let hasIdled = false;

      const settle = () => {
        if (hasIdled) return;
        try {
          if (isFinite(video.duration) && video.duration > 0) {
            video.currentTime = Math.max(0, video.duration - 0.05);
            video.pause();
            hasIdled = true;
          }
        } catch {
          // ditto
        }
      };

      const onEnter = () => {
        hasIdled = false;
        try {
          video.currentTime = 0;
          safePlay();
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
    }

    // ------------------------------------------------------------------
    // TOUCH branch — autoplay while pillar is in the viewport. Pause
    // when scrolled out. The `loop` attribute on the <video> keeps the
    // playback running.
    // ------------------------------------------------------------------
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            safePlay();
          } else {
            const finish = () => {
              try {
                video.pause();
              } catch {
                // ditto
              }
            };
            if (playPromise) {
              playPromise.then(finish, finish);
            } else {
              finish();
            }
          }
        }
      },
      // 25% in view counts as "intersecting" — gives the video a head start
      // before the user fully scrolls onto the card.
      { threshold: 0.25 }
    );
    observer.observe(pillar);
    return () => {
      observer.disconnect();
      try {
        video.pause();
      } catch {
        // ditto
      }
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
