"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  UsersListPlanFilter,
  UsersListSignupFilter,
  UsersListSubscriptionFilter,
} from "@/lib/db/admin";

const ALL_VALUE = "__all__";
const SEARCH_DEBOUNCE_MS = 250;

/**
 * URL-searchParam-driven filter bar for /admin/users. Mirrors the
 * admin/_components/filters-bar.tsx pattern (useRouter().push with
 * page=1 reset, propagate other params on change).
 *
 * The search input debounces to avoid pushing a URL on every
 * keystroke; selects push immediately.
 */
export default function UsersFiltersBar({
  currentSub,
  currentPlan,
  currentSource,
  currentQ,
}: {
  currentSub: UsersListSubscriptionFilter | null;
  currentPlan: UsersListPlanFilter | null;
  currentSource: UsersListSignupFilter | null;
  currentQ: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(currentQ);
  // Remember the most recent prop to compare in the debounce effect —
  // see comment there. We deliberately do NOT sync `searchValue` back
  // to `currentQ` on prop change (would require setState-in-effect),
  // so a browser back/forward leaves the input at whatever the user
  // last typed. The next keystroke or filter change re-syncs the URL.
  const lastSyncedQ = useRef(currentQ);

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any filter change resets to page 1 — same convention as the
    // content filters bar.
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function setSelect(key: "sub" | "plan" | "src", value: string | null) {
    pushParams({ [key]: value });
  }

  // Debounced search-bar push. Skips when the local state matches the
  // last URL-synced value so we don't fire a redundant push every
  // time the prop updates back to us.
  useEffect(() => {
    if (searchValue === lastSyncedQ.current) return;
    const t = setTimeout(() => {
      const next = searchValue.trim() ? searchValue.trim() : null;
      lastSyncedQ.current = next ?? "";
      pushParams({ q: next });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--color-line)] bg-card p-3">
      <div className="flex flex-col gap-1">
        <Label
          htmlFor="users-filter-sub"
          className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          מנוי
        </Label>
        <Select
          value={currentSub ?? ALL_VALUE}
          onValueChange={(v) =>
            setSelect("sub", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="users-filter-sub" className="w-40">
            <SelectValue placeholder="הכל" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="expired">פג</SelectItem>
            <SelectItem value="cancelled">בוטל</SelectItem>
            <SelectItem value="none">ללא מנוי</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label
          htmlFor="users-filter-plan"
          className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          תוכנית
        </Label>
        <Select
          value={currentPlan ?? ALL_VALUE}
          onValueChange={(v) =>
            setSelect("plan", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="users-filter-plan" className="w-40">
            <SelectValue placeholder="כל התוכניות" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            <SelectItem value="3_months">3 חודשים</SelectItem>
            <SelectItem value="6_months">6 חודשים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label
          htmlFor="users-filter-src"
          className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          מקור הרשמה
        </Label>
        <Select
          value={currentSource ?? ALL_VALUE}
          onValueChange={(v) =>
            setSelect("src", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="users-filter-src" className="w-40">
            <SelectValue placeholder="הכל" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            <SelectItem value="email">אימייל</SelectItem>
            <SelectItem value="google">Google</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
        <Label
          htmlFor="users-filter-q"
          className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          חיפוש (שם, טלפון, אימייל)
        </Label>
        <Input
          id="users-filter-q"
          type="search"
          autoComplete="off"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="הקלד לחיפוש…"
        />
      </div>
    </div>
  );
}
