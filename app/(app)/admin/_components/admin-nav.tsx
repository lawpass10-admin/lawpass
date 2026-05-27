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
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
