"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimerExpiredDialogProps = {
  open: boolean;
  /** Dismiss the dialog and keep practicing (no behavioral change). */
  onContinue: () => void;
  /** End the session and route to the summary (calls exitSession). */
  onEndSession: () => void | Promise<void>;
  pending?: boolean;
};

/**
 * Slice 24 — modal dialog shown when the SESSION timer counts down
 * to 0:00. Replaces the prior per-question variant.
 *
 * Non-dismissable by clicking outside (matches exit-confirm-dialog
 * convention) — the user must click one of the two buttons. The two
 * actions:
 *   - "המשך תרגול" (dismiss): keep practicing without time pressure.
 *     Choices remain interactive; no auto-submit, no lock. This is
 *     the soft-pacing model the owner picked over auto-finish.
 *   - "סיים סשן" (end): call `exitSession`, route to the summary.
 *
 * Built on @base-ui/react/alert-dialog like exit-confirm-dialog.tsx.
 */
export function TimerExpiredDialog({
  open,
  onContinue,
  onEndSession,
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
            הזמן לסשן הסתיים. אפשר להמשיך לתרגל בלי מגבלת זמן, או לסיים
            ולעבור לסיכום.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-4">
            <Button
              variant="ghost"
              onClick={() => void onEndSession()}
              disabled={pending}
            >
              סיים סשן
            </Button>
            <Button onClick={onContinue} disabled={pending}>
              המשך תרגול
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
