import { Loader2 } from "lucide-react";

/**
 * Top-level loading fallback shown by Next.js while a Server Component
 * tree is suspended (initial render, route transitions, data fetches).
 * Server Component — no client-side state needed.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden />
        <p className="text-sm">טוען...</p>
      </div>
    </div>
  );
}
