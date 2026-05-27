import { LoadingAnimation } from "@/components/ui/loading-animation";

/**
 * Top-level loading fallback shown by Next.js while a Server Component
 * tree is suspended (initial render, route transitions, data fetches).
 * Slice 8: swapped the Loader2 spinner for the looping mortarboard
 * animation; reduced-motion users fall back to the spinner inside
 * LoadingAnimation itself.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <LoadingAnimation />
    </div>
  );
}
