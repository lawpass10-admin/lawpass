"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Minimal pager for /admin/users. The Auth Admin API doesn't return
 * a total user count, so we can't render "page X of N" — only "prev /
 * next" with a `hasMore` flag inferred from page size.
 *
 * Slice 7: propagates ALL active query params (sub / plan / src / q)
 * so filter+search state survives pagination. Polish (i): outline
 * buttons replaced with token-colored compact buttons that match the
 * rest of the admin chrome.
 */
export default function UsersPager({
  page,
  perPage,
  hasMore,
}: {
  page: number;
  perPage: number;
  hasMore: boolean;
}) {
  const searchParams = useSearchParams();

  function hrefForPage(target: number): string {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("page", String(target));
    return `/admin/users?${next.toString()}`;
  }

  const prevHref = page > 1 ? hrefForPage(page - 1) : null;
  const nextHref = hasMore ? hrefForPage(page + 1) : null;

  const buttonCls = cn(
    "inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium",
    "border border-[var(--color-line-strong)] bg-card text-[var(--color-ink-dim)]",
    "transition-colors hover:bg-[var(--color-gold-tint)] hover:text-[var(--color-navy-ink)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
  );
  const disabledCls = "pointer-events-none opacity-40";

  return (
    <div className="flex items-center justify-between text-xs text-[var(--color-ink-dim)]">
      <span>
        עמוד {page} · עד {perPage} משתמשים בעמוד
      </span>
      <div className="flex gap-2">
        <Link
          aria-disabled={prevHref === null}
          href={prevHref ?? "#"}
          className={cn(buttonCls, prevHref === null && disabledCls)}
        >
          הקודם
        </Link>
        <Link
          aria-disabled={nextHref === null}
          href={nextHref ?? "#"}
          className={cn(buttonCls, nextHref === null && disabledCls)}
        >
          הבא
        </Link>
      </div>
    </div>
  );
}
