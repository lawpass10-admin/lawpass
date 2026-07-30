"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { adminSetQaReportStatusAction } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QaReportStatus } from "@/lib/db/qa-reports";

const OPTIONS: Array<{ value: QaReportStatus; label: string }> = [
  { value: "open", label: "פתוח" },
  { value: "in_progress", label: "בטיפול" },
  { value: "resolved", label: "טופל" },
];

const SELECTED_PILL_CLASSES: Record<QaReportStatus, string> = {
  open: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  in_progress:
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700",
  resolved:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700",
};

/**
 * Three-option pill picker for qa_reports.status. Optimistic local
 * mirror flips immediately so the admin sees the change; reverts on
 * action failure. router.refresh() re-fetches the page (re-runs
 * getQaReportDetail) so the surrounding chrome (open-count badge in
 * the layout) re-renders too.
 */
export default function QaStatusControl({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: QaReportStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<QaReportStatus>(currentStatus);
  const [pending, startTransition] = useTransition();

  function handleSelect(next: QaReportStatus) {
    if (pending || next === status) return;
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const result = await adminSetQaReportStatusAction({
        reportId,
        status: next,
      });
      if (!result.ok) {
        setStatus(prev);
        toast.error(result.error);
        return;
      }
      toast.success("הסטטוס עודכן");
      // Re-run the layout so the open-count badge reflects the new
      // status, and the surrounding RSC re-fetches the report.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((opt) => {
        const selected = opt.value === status;
        return (
          <Button
            key={opt.value}
            type="button"
            variant={selected ? "default" : "outline"}
            onClick={() => handleSelect(opt.value)}
            disabled={pending}
            className={cn(
              "h-9",
              selected && SELECTED_PILL_CLASSES[opt.value]
            )}
          >
            {opt.label}
          </Button>
        );
      })}
      {pending ? (
        <span className="text-xs text-muted-foreground">מעדכן…</span>
      ) : null}
    </div>
  );
}
