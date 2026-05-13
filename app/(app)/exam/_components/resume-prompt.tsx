"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  abandonActiveExamSession,
  createExamSession,
} from "@/app/(app)/exam/_actions";
import { Button } from "@/components/ui/button";
import type { ExamSessionRow } from "@/lib/db/exam";
import { examPlayUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { IntroContent } from "./intro-content";

type ResumePromptProps = {
  session: Pick<ExamSessionRow, "id" | "questions_answered" | "status">;
};

/**
 * Shown when the user lands on `/exam` and already has an active/paused
 * exam session. Renders the IntroContent as a frozen background for
 * visual continuity, with a non-dismissable AlertDialog layered on top.
 *
 * The dialog has no "X" close button and no `onOpenChange` handler —
 * Esc / backdrop-click cannot dismiss it. Both buttons navigate away,
 * so the dialog is always either replaced by a new page or by a
 * server-rendered re-fetch of `/exam` (which would render <ExamIntro>
 * after the abandon).
 *
 * "המשך בחינה" → /exam/play/[questions_answered]?session=…
 * "התחל בחינה חדשה" → abandonActiveExamSession() + createExamSession()
 *   → navigate to the fresh session's play URL.
 */
export function ResumePrompt({ session }: ResumePromptProps) {
  const resumeUrl = examPlayUrl(session.id, session.questions_answered);
  const [busy, setBusy] = useState<null | "resume" | "fresh">(null);
  const [, startTransition] = useTransition();

  function handleResume() {
    if (busy) return;
    setBusy("resume");
    window.location.assign(resumeUrl);
  }

  function handleStartFresh() {
    if (busy) return;
    setBusy("fresh");
    startTransition(async () => {
      const abandonResult = await abandonActiveExamSession();
      if (!abandonResult.ok) {
        toast.error("אירעה שגיאה. נסה שוב");
        setBusy(null);
        return;
      }
      const createResult = await createExamSession();
      if (!createResult.ok) {
        toast.error(
          createResult.error === "exam_pool_insufficient"
            ? "אין מספיק שאלות במאגר לסימולציה כרגע"
            : "אירעה שגיאה. נסה שוב"
        );
        setBusy(null);
        return;
      }
      window.location.assign(createResult.url);
    });
  }

  return (
    <>
      {/* Frozen visual background — non-interactive (modal traps focus
          and the buttons inside IntroContent are static markup). */}
      <div aria-hidden className="pointer-events-none select-none opacity-60">
        <IntroContent />
      </div>

      <AlertDialog.Root open>
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
              יש סימולציה פעילה
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
              המשך מהמקום שעצרת, או התחל בחינה חדשה (הקודמת תיכנס לארכיון).
            </AlertDialog.Description>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={handleStartFresh}
                disabled={busy !== null}
              >
                {busy === "fresh" ? "מכין סימולציה..." : "התחל בחינה חדשה"}
              </Button>
              <Button
                onClick={handleResume}
                disabled={busy !== null}
              >
                {busy === "resume" ? "טוען..." : "המשך בחינה"}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
