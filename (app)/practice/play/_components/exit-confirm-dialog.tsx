"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExitConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  questionsAnswered: number;
  totalQuestions: number;
  confirming?: boolean;
};

/**
 * Confirmation dialog rendered before the "סיים סשן" exit action fires.
 *
 * Copy varies on whether the user has answered anything:
 *   - answered > 0  → "סיום סשן" + "ענית על N מתוך M שאלות. הסיכום יישמר."
 *   - answered = 0  → "ביטול סשן" + "לא ענית על שאלות עדיין. הסשן ייבטל ולא יישמר סיכום."
 *
 * Built on @base-ui/react/alert-dialog (Slice 1's UI primitive layer)
 * because the project doesn't ship a shadcn AlertDialog wrapper. We
 * style the popup with the same data-starting-style / data-ending-style
 * conventions used by components/ui/sheet.tsx.
 */
export function ExitConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  questionsAnswered,
  totalQuestions,
  confirming = false,
}: ExitConfirmDialogProps) {
  const isCompletion = questionsAnswered > 0;
  const title = isCompletion ? "סיום סשן" : "ביטול סשן";
  const description = isCompletion
    ? `ענית על ${questionsAnswered} מתוך ${totalQuestions} שאלות. הסיכום יישמר.`
    : "לא ענית על שאלות עדיין. הסשן ייבטל ולא יישמר סיכום.";
  const cancelLabel = isCompletion ? "המשך לתרגל" : "המשך";
  const confirmLabel = isCompletion ? "סיים" : "בטל סשן";

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
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
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Close
              render={
                <Button variant="ghost" disabled={confirming}>
                  {cancelLabel}
                </Button>
              }
            />
            <Button
              variant={isCompletion ? "default" : "destructive"}
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? "מבצע..." : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
