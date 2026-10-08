"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// "תוכן" (/admin) and "QA" (/admin/qa) were removed from this strip on PM
// request — not in use for now. Only the TABS are gone: both routes, their
// pages and everything behind them are untouched and still reachable by URL,
// and the QA badge code below is kept too. Put either entry back here to
// restore its tab, badge and all:
//
//   { href: "/admin", label: "תוכן" },
//   { href: "/admin/qa", label: "QA" },
//
// Note the knock-on: /admin was the admin area's landing page, so the
// sidebar's "ניהול" link now points at /admin/users instead — otherwise the
// first thing an admin saw was a page with no tab selected and no way back to
// it. See components/app/app-sidebar.tsx.
// Typed rather than `as const`: the literal union from `as const` would now be
// just the two hrefs below, and the "/admin" and "/admin/qa" comparisons kept
// alive further down would be compile errors against it. Widening is what lets
// that restore code stay in place and still typecheck.
const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/usage", label: "שימוש" },
];

/**
 * Tabs strip under the admin header. usePathname (rather than threading
 * the pathname prop through the layout) is the same trick the sidebar
 * uses — Next's Router Cache reuses the layout segment across same-group
 * navigations, which would otherwise pin the active tab to whichever
 * route the user landed on first.
 *
 * Slice 10 Phase B-2 — the QA tab carries an open-reports COUNT badge.
 * `openQaCount` is fetched in app/(app)/admin/layout.tsx (the layout is
 * a Server Component) and passed in here. Zero badge → no pill rendered
 * (avoids visual noise when the queue is empty).
 */
export default function AdminNav({
  openQaCount = 0,
}: {
  openQaCount?: number;
}) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex gap-1 text-sm">
      {NAV_ITEMS.map((item) => {
        // /admin is the content home; only mark it active on exact match.
        // /admin/users (and any nested route) marks the users tab; same
        // for /admin/qa.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const showQaBadge = item.href === "/admin/qa" && openQaCount > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            // Slice 7 polish (e): active state shifts from a solid
            // primary tint to a gold underline + navy-ink text —
            // lighter touch that aligns with the sidebar's gold
            // accent without copying the full gradient.
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
              active
                ? "text-[var(--color-navy-ink)]"
                : "text-[var(--color-ink-dim)] hover:bg-[var(--color-gold-tint)] hover:text-foreground"
            )}
          >
            <span>{item.label}</span>
            {showQaBadge ? (
              <span
                aria-label={`${openQaCount} דיווחים פתוחים`}
                className={cn(
                  "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5",
                  "bg-amber-500 text-[11px] font-semibold leading-none text-primary-foreground tabular-nums"
                )}
              >
                {openQaCount}
              </span>
            ) : null}
            {active ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 -bottom-1 h-[2px] rounded bg-[var(--color-gold)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
