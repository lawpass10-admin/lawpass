import { LoadingAnimation } from "@/components/ui/loading-animation";

/**
 * Route-group loading fallback for /(app). Renders inside <SidebarInset>
 * (the app shell) so the sidebar stays mounted while the page Server
 * Component is loading. Slice 8: swapped the Loader2 spinner for the
 * looping mortarboard animation; reduced-motion users fall back to
 * the spinner inside LoadingAnimation itself.
 */
export default function AppGroupLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <LoadingAnimation />
    </div>
  );
}
