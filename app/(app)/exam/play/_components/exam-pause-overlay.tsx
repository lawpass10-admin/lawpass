"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onResume: () => void | Promise<void>;
  onExit: () => void | Promise<void>;
  pending?: boolean;
};

/**
 * Full-screen pause modal. PM-confirmed: "Save & exit" is folded into
 * this overlay rather than a separate header button. Two CTAs:
 *   - "המשך בחינה" (primary) → resumeExam → close overlay
 *   - "צא לדשבורד" (ghost) → abandonAndExitExam → navigate /dashboard
 *
 * Non-dismissable while open — Esc / backdrop click do nothing. Only
 * the two buttons close it.
 */
export function ExamPauseOverlay({
  open,
  onResume,
  onExit,
  pending = false,
}: Props) {
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
            "data-ending-style:opacity-0 data-starting-style:opacity-0"
          )}
        />
        <AlertDialog.Popup
          dir="rtl"
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-md rounded-xl border border-border bg-background p-6 text-start shadow-xl",
            "transition-opacity duration-150",
            "data-ending-style:opacity-0 data-starting-style:opacity-0"
          )}
        >
          <AlertDialog.Title className="text-lg font-semibold">
            הסימולציה בהשהיה
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            הטיימר עוצר. ניתן להמשיך מהמקום שעצרת, או לצאת לדשבורד ולחזור
            מאוחר יותר. ההתקדמות נשמרה.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => void onExit()}
              disabled={pending}
            >
              צא לדשבורד
            </Button>
            <Button onClick={() => void onResume()} disabled={pending}>
              {pending ? "מטעין..." : "המשך בחינה"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
