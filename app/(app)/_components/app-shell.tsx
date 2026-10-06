"use client";

import { usePathname } from "next/navigation";

import { AppFooter } from "./app-footer";
import { AppSidebar } from "@/components/app/app-sidebar";
import { MobileTopBar } from "@/components/app/mobile-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { EnrollmentReminder } from "./enrollment-reminder";
import { TopLaunchers } from "./top-launchers";
import { QaFloatingWidget } from "./qa-floating-widget";

/**
 * Routes inside (app) that render WITHOUT the navy sidebar.
 *
 * /exam is a focused, no-distractions simulation (SPEC §7.0.4). /mahoti joins
 * it for a different reason: it is a split screen, question beside notebook,
 * and the sidebar costs it ~16rem of the width both panes compete for.
 *
 * /diuni is here for the first reason rather than the second — it has no
 * notebook and does not need the width, but it is a clocked sitting, and a
 * navigation rail beside a running exam invites the candidate out of it.
 */
const FOCUS_ROUTES = ["/exam", "/mahoti", "/diuni"];

/**
 * Focus routes that a prefix cannot express.
 *
 * /writing-task/<id> is the paper itself, and it is a split screen for the same
 * reason /mahoti is: the question on one side, the writing skeleton on the
 * other, with the answer sheet under both. It needs the width the rail takes.
 *
 * A prefix would be wrong here. /writing-task is the task LIST and
 * /writing-task/results/<id> is the marked answer; both are ordinary pages that
 * keep the sidebar. Only the single-segment id below is the paper.
 */
const FOCUS_ROUTE_PATTERNS = [/^\/writing-task\/(?!results(?:\/|$))[^/]+$/];

function isFocusRoute(pathname: string): boolean {
  return (
    FOCUS_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    ) || FOCUS_ROUTE_PATTERNS.some((re) => re.test(pathname))
  );
}

/**
 * The (app) chrome — sidebar shell vs. focus-mode bare <main> — decided on the
 * CLIENT, from `usePathname()`.
 *
 * This used to be an `if` inside (app)/layout.tsx, keyed off the `x-pathname`
 * header that lib/supabase/middleware.ts stamps on the request. That header is
 * only correct on a full document load: the App Router does NOT re-render a
 * shared layout on a client-side <Link> transition between two routes under it,
 * so navigating /dashboard → /mahoti left the layout on the pathname of
 * whichever page was loaded FIRST. The result was the reported bug — clicking
 * "דיון מהותי" in the sidebar kept the sidebar mounted until a manual refresh,
 * and a <Link> back out of a focus route kept the page full-screen.
 *
 * `usePathname()` re-runs on every navigation, soft or hard (it is also
 * available during SSR, so the first paint is already correct — no flash of
 * the wrong chrome). This mirrors what AppSidebar already does for its own
 * active-row highlight, and for the same reason.
 */
type AppShellProps = React.ComponentProps<typeof AppSidebar> & {
  children: React.ReactNode;
  isQaTester: boolean;
};

export function AppShell({
  children,
  isQaTester,
  ...sidebarProps
}: AppShellProps) {
  const pathname = usePathname() ?? "";

  // Slice 10 — the QA widget surfaces for testers on BOTH branches. It is
  // fixed-position and portals when open, so JSX placement is irrelevant;
  // it stays a sibling of <main> to mirror the sidebar's convention.
  if (isFocusRoute(pathname)) {
    return (
      <>
        {/* Slice 51 — id="main-content" so the universal skip-link (set up by
            the a11y widget) lands on the actual main element. */}
        <main id="main-content" className="page-fade-in flex-1 p-6">
          {children}
        </main>
        <AppFooter />
        {/* On both branches, so a student sitting a clocked exam — the place
            they are most likely to hit something worth telling us about — has
            the same launcher as everywhere else. Fixed-position, so JSX
            placement is irrelevant; it mirrors the QA widget's convention. */}
        <TopLaunchers />
        <EnrollmentReminder />
        <QaFloatingWidget isQaTester={isQaTester} />
      </>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar {...sidebarProps} />
      <SidebarInset>
        <MobileTopBar />
        {/* Slice 51 — id="main-content" (see focus-branch comment above). */}
        <main id="main-content" className="page-fade-in flex-1 p-4 md:p-6">
          {children}
        </main>
        <AppFooter />
      </SidebarInset>
      <TopLaunchers />
      <EnrollmentReminder />
      <QaFloatingWidget isQaTester={isQaTester} />
    </SidebarProvider>
  );
}
