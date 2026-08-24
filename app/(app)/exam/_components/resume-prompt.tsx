"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  abandonActiveExamSession,
  createExamSession,
} from "@/lib/api/exam";
import { Button } from "@/components/ui/button";
import type { ExamSessionRow } from "@/lib/db/exam";
import type { ExamMode } from "@/lib/exam/clusters";
import { examPlayUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

import { IntroContent } from "./intro-content";

type ResumePromptProps = {
  session: Pick<
    ExamSessionRow,
    "id" | "questions_answered" | "status" | "active_window_token" | "mode"
  >;
};

/** Slice 9 — "start fresh" from the resume modal mints a new session
 *  in the same mode as the one being abandoned. PM-confirmed: there's
 *  no last-mode-used preference on the fresh-entry path, but inside
 *  the resume flow it's clearest to mirror the in-progress mode (the
 *  user is signalling "throw away this attempt, start over") rather
 *  than silently switch them to procedural. */
const FRESH_MODE_FALLBACK: ExamMode = "procedural";

function persistWindowToken(sessionId: string, token: string): void {
  try {
    window.localStorage.setItem(
      `lawpass.exam.${sessionId}.windowToken`,
      token
    );
  } catch {
    // Private-browsing / quota — falls back to running without the
    // guard for this tab.
  }
}

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
    // Persist the session's existing window token so the play page
    // can validate it on mount.
    persistWindowToken(session.id, session.active_window_token);
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
      const createResult = await createExamSession({
        mode: session.mode ?? FRESH_MODE_FALLBACK,
      });
      if (!createResult.ok) {
        toast.error(
          createResult.error === "exam_pool_insufficient"
            ? "אין מספיק שאלות במאגר לסימולציה כרגע"
            : "אירעה שגיאה. נסה שוב"
        );
        setBusy(null);
        return;
      }
      persistWindowToken(createResult.sessionId, createResult.windowToken);
      window.location.assign(createResult.url);
    });
  }

  return (
    <>
      {/* Frozen visual background — non-interactive (modal traps focus
          and the buttons inside IntroContent are static markup). The
          mode mirrors the in-progress session so the background frame
          matches whatever the user was running. */}
      <div aria-hidden className="pointer-events-none select-none opacity-60">
        <IntroContent mode={session.mode ?? FRESH_MODE_FALLBACK} />
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
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-4">
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
