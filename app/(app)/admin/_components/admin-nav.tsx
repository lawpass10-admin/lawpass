"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "תוכן" },
  { href: "/admin/users", label: "משתמשים" },
] as const;

/**
 * Tabs strip under the admin header. usePathname (rather than threading
 * the pathname prop through the layout) is the same trick the sidebar
 * uses — Next's Router Cache reuses the layout segment across same-group
 * navigations, which would otherwise pin the active tab to whichever
 * route the user landed on first.
 */
export default function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex gap-1 text-sm">
      {NAV_ITEMS.map((item) => {
        // /admin is the content home; only mark it active on exact match.
        // /admin/users (and any nested route) marks the users tab.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              "relative rounded-md px-3 py-1.5 font-medium transition-colors",
              active
                ? "text-[var(--color-navy-ink)]"
                : "text-[var(--color-ink-dim)] hover:bg-[var(--color-gold-tint)] hover:text-foreground"
            )}
          >
            {item.label}
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
