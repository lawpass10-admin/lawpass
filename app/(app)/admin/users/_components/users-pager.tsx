import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Minimal pager for /admin/users. The Auth Admin API doesn't return
 * a total user count, so we can't render "page X of N" — only "prev /
 * next" with a `hasMore` flag inferred from page size.
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
  const prevHref = page > 1 ? `/admin/users?page=${page - 1}` : null;
  const nextHref = hasMore ? `/admin/users?page=${page + 1}` : null;

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>
        עמוד {page} · עד {perPage} משתמשים בעמוד
      </span>
      <div className="flex gap-2">
        <Link
          aria-disabled={prevHref === null}
          href={prevHref ?? "#"}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            prevHref === null && "pointer-events-none opacity-40"
          )}
        >
          הקודם
        </Link>
        <Link
          aria-disabled={nextHref === null}
          href={nextHref ?? "#"}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            nextHref === null && "pointer-events-none opacity-40"
          )}
        >
          הבא
        </Link>
      </div>
    </div>
  );
}
