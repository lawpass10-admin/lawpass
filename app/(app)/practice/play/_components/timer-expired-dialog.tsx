"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimerExpiredDialogProps = {
  open: boolean;
  /** True if the user has already answered the current question. In that
   * case the "דלג לשאלה הבאה" button is hidden — advancing without an
   * extra confirm step would also be fine, but the design language
   * prefers giving the user only the actions still meaningful. */
  alreadyAnswered: boolean;
  onContinue: () => void;
  onSkipNext: () => void | Promise<void>;
  pending?: boolean;
};

/**
 * Modal dialog shown when the per-question timer counts down to 0:00.
 * Non-dismissable by clicking outside (matches exit-confirm-dialog
 * convention) — the user must click one of the two buttons.
 *
 * Built on @base-ui/react/alert-dialog like exit-confirm-dialog.tsx, the
 * only other AlertDialog in the app. We do not auto-submit or
 * auto-advance — the timer is informational in practice mode (plan §2
 * row 7), this dialog is just a soft nudge.
 */
export function TimerExpiredDialog({
  open,
  alreadyAnswered,
  onContinue,
  onSkipNext,
  pending = false,
}: TimerExpiredDialogProps) {
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
            הזמן נגמר
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            הזמן לשאלה הזו הסתיים. אתה יכול להמשיך לענות, או לעבור הלאה.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            {!alreadyAnswered && (
              <Button
                variant="ghost"
                onClick={() => void onSkipNext()}
                disabled={pending}
              >
                דלג לשאלה הבאה
              </Button>
            )}
            <Button onClick={onContinue} disabled={pending}>
              המשך לענות
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
