"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QaReportStatus, QaReportType } from "@/lib/db/qa-reports";

const ALL_VALUE = "__all__";

/**
 * URL-searchParam-driven filter bar for /admin/qa. Mirrors
 * users-filters-bar.tsx — selects push immediately; the reporter
 * filter is set indirectly by clicking a reporter name in the list
 * (no free-text input here).
 */
export default function QaFiltersBar({
  currentStatus,
  currentType,
  currentReporter,
}: {
  currentStatus: QaReportStatus | null;
  currentType: QaReportType | null;
  currentReporter: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function setSelect(key: "status" | "type", value: string | null) {
    pushParams({ [key]: value });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--color-line)] bg-card p-3">
      <div className="flex flex-col gap-1">
        <Label
          htmlFor="qa-filter-status"
          className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          סטטוס
        </Label>
        <Select
          value={currentStatus ?? ALL_VALUE}
          onValueChange={(v) =>
            setSelect("status", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="qa-filter-status" className="w-40">
            <SelectValue placeholder="הכל" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            <SelectItem value="open">פתוח</SelectItem>
            <SelectItem value="in_progress">בטיפול</SelectItem>
            <SelectItem value="resolved">טופל</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label
          htmlFor="qa-filter-type"
          className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
        >
          סוג
        </Label>
        <Select
          value={currentType ?? ALL_VALUE}
          onValueChange={(v) =>
            setSelect("type", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="qa-filter-type" className="w-40">
            <SelectValue placeholder="הכל" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            <SelectItem value="bug">באג טכני</SelectItem>
            <SelectItem value="content">טעות תוכן</SelectItem>
            <SelectItem value="design">עיצוב/UX</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {currentReporter ? (
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
            מדווח
          </Label>
          <div className="rounded-md border border-[var(--color-line)] bg-muted/30 px-3 py-1.5 font-mono text-xs">
            {currentReporter.slice(0, 8)}…
          </div>
        </div>
      ) : null}
    </div>
  );
}
