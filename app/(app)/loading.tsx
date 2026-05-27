import { Loader2 } from "lucide-react";

/**
 * Route-group loading fallback for /(app). Renders inside <SidebarInset>
 * (the app shell) so the sidebar stays mounted while the page Server
 * Component is loading.
 */
export default function AppGroupLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <p className="text-sm">טוען...</p>
      </div>
    </div>
  );
}
