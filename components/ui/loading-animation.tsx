import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type LoadingAnimationProps = {
  /**
   * Box size for both the video and the reduced-motion Loader2.
   *  - "sm" → 64px (inline / in-card)
   *  - "md" → 128px (in-flow waiting cue, e.g. archived auto-advance)
   *  - "lg" → 224px (full-page Suspense fallback, post-answer overlay)
   * Default "lg".
   */
  size?: "sm" | "md" | "lg";
  /**
   * Label rendered below the animation. Pass `null` to suppress.
   * Default "טוען...".
   */
  label?: string | null;
  /** Outer wrapper className passthrough. */
  className?: string;
};

const SIZE_PX: Record<NonNullable<LoadingAnimationProps["size"]>, number> = {
  sm: 64,
  md: 128,
  lg: 224,
};

const SIZE_LOADER_CLS: Record<
  NonNullable<LoadingAnimationProps["size"]>,
  string
> = {
  sm: "size-8",
  md: "size-12",
  lg: "size-16",
};

/**
 * Full-page or in-flow loading animation. Renders a looping muted MP4
 * (the graduation-cap mortarboard) by default; gracefully degrades to
 * the lucide Loader2 spinner under `prefers-reduced-motion: reduce`.
 *
 * Reduced-motion strategy: Tailwind v4 `motion-safe:` / `motion-reduce:`
 * variants gate the two children — the video carries `motion-reduce:hidden`
 * (hide when user prefers reduced motion); the Loader2 carries
 * `motion-safe:hidden` (hide when motion is OK), i.e. it only shows
 * when motion is reduced. Same outer dimensions in both branches so
 * the layout doesn't shift between users.
 *
 * Accessibility: outer wrapper carries role="status" + aria-busy="true";
 * the visible label (when present) is the accessible name.
 */
export function LoadingAnimation({
  size = "lg",
  label = "טוען...",
  className,
}: LoadingAnimationProps) {
  const px = SIZE_PX[size];
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      {/* Video for the normal-motion branch. Square box; the source
          MP4 is itself square (graduation-cap centered) so no object-
          fit gymnastics needed. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        width={px}
        height={px}
        style={{ width: px, height: px }}
        className="motion-reduce:hidden rounded-md"
      >
        <source src="/animations/mortarboard.mp4" type="video/mp4" />
      </video>
      {/* Reduced-motion fallback. Same outer box so the layout doesn't
          shift between users. */}
      <div
        aria-hidden
        style={{ width: px, height: px }}
        className="motion-safe:hidden flex items-center justify-center"
      >
        <Loader2
          className={cn(
            "animate-spin text-muted-foreground",
            SIZE_LOADER_CLS[size]
          )}
        />
      </div>
      {label !== null ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
