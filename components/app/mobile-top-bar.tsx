"use client";

import { Menu } from "lucide-react";
import Image from "next/image";

import { useSidebar } from "@/components/ui/sidebar";

/**
 * Slice 4.X Phase 14 — Mobile-only top bar.
 *
 * On screens < md the desktop sidebar collapses into a shadcn Sheet
 * overlay; this bar provides the visible hamburger that toggles it
 * plus a centered logo so the user has a constant brand anchor at the
 * top of every (app) route. Hidden on md+ where the sidebar is
 * permanently visible.
 *
 * Stays in client land because `useSidebar()` needs the provider's
 * context, which is only reachable through a Client Component.
 */
export function MobileTopBar() {
  const { toggleSidebar } = useSidebar();
  return (
    <header
      className="flex md:hidden items-center justify-between gap-3 px-4 py-3"
      style={{
        background: "var(--color-navy-ink)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="פתח תפריט ניווט"
        className="inline-flex size-9 items-center justify-center rounded-md text-white hover:bg-white/10"
      >
        <Menu className="size-5" strokeWidth={1.8} aria-hidden />
      </button>
      <Image
        src="/lawpass-logo-tight.png"
        alt="LawPass"
        width={120}
        height={70}
        className="h-9 w-auto"
        priority
      />
      <span className="size-9" aria-hidden />
    </header>
  );
}
