import { ChevronRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The two ways out of an exam screen: back one step, and back to the main menu.
 *
 * These screens render in FOCUS MODE — /exam, /mahoti and /diuni drop the navy
 * sidebar (FOCUS_ROUTES in app-shell.tsx) so a clocked sitting has no navigation
 * rail beside it. The cost is that the sidebar is also the way OUT, so a
 * candidate who opened a paper had a breadcrumb in 11px type and nothing else.
 * This is that exit, as two real buttons.
 *
 * Both are plain <Link>s. <AppShell> decides focus mode from `usePathname()`,
 * so the sidebar comes back on a soft navigation and neither needs the hard
 * page load this used to take (see ReviewFooter in mahoti/review/page.tsx).
 *
 * `backHref` is the step the screen belongs under — the subject's instructions
 * page for a paper, the paper for a result — rather than browser history: a
 * candidate who reached the paper from a link in an email has no history to go
 * back to, and "back" that sometimes leaves the app is not a way out.
 *
 * ChevronRight, not Left: in RTL the arrow that means "back" points right.
 */
export function ExamPageNav({
  backHref,
  backLabel,
}: {
  backHref: string;
  backLabel: string;
}) {
  return (
    <nav className="flex shrink-0 items-center gap-2" aria-label="ניווט">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href={backHref} />}
      >
        <ChevronRight className="size-4" aria-hidden />
        <span className="ms-1.5">{backLabel}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        <LayoutDashboard className="size-4" aria-hidden />
        <span className="ms-1.5">לתפריט הראשי</span>
      </Button>
    </nav>
  );
}
