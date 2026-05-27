"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  unansweredCount: number;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  pending?: boolean;
};

/**
 * Manual-submit confirmation. The parent only opens this dialog when
 * there ARE unanswered questions. If everything is answered, the
 * parent calls `submitFinalExam` directly and skips this UI.
 */
export function ExamSubmitConfirmDialog({
  open,
  unansweredCount,
  onConfirm,
  onCancel,
  pending = false,
}: Props) {
  return (
    <AlertDialog.Root open={open}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/40 transition-opacity duration-150",
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
            סיים בחינה?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            יש {unansweredCount} שאלות לא ענויות. הן ייספרו כשגויות.
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              חזור לבחינה
            </Button>
            <Button onClick={() => void onConfirm()} disabled={pending}>
              {pending ? "מסיים..." : "סיים בחינה"}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
