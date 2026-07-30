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
import type { ChapterTrack } from "@/lib/db/admin";

const ALL_VALUE = "__all__";

/**
 * URL-searchParam-driven filter bar for /admin. Selecting an option
 * pushes a new URL; the page re-runs as a Server Component and the
 * table reflects the filtered counts. Using URLSearchParams (instead
 * of local React state) keeps the back button + deep-linking + the
 * chapter drill-down all in sync without prop drilling.
 */
export default function FiltersBar({
  availableYears,
  currentYear,
  currentTrack,
}: {
  availableYears: number[];
  currentYear: string | null;
  currentTrack: ChapterTrack | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: "year" | "track", value: string | null) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
      <div className="flex flex-col gap-1">
        <Label
          htmlFor="filter-year"
          className="text-xs font-medium text-muted-foreground"
        >
          שנת בחינה
        </Label>
        <Select
          value={currentYear ?? ALL_VALUE}
          onValueChange={(v) =>
            setParam("year", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="filter-year" className="w-40">
            <SelectValue placeholder="כל השנים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label
          htmlFor="filter-track"
          className="text-xs font-medium text-muted-foreground"
        >
          מסלול
        </Label>
        <Select
          value={currentTrack ?? ALL_VALUE}
          onValueChange={(v) =>
            setParam("track", v === ALL_VALUE ? null : (v ?? null))
          }
        >
          <SelectTrigger id="filter-track" className="w-40">
            <SelectValue placeholder="כל המסלולים" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>הכל</SelectItem>
            <SelectItem value="procedural">פרוצדורלי</SelectItem>
            <SelectItem value="substantive">מהותי</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
