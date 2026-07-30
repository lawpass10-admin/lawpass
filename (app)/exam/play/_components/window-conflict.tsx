"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { claimExamWindow } from "@/lib/api/exam";
import { Button } from "@/components/ui/button";

type Props = {
  sessionId: string;
};

/**
 * Full-page block shown when the client's stored windowToken doesn't
 * match the session's `active_window_token`. Two actions:
 *
 *  1. "העבר לחלון הזה" — `claimExamWindow(sessionId)` mints a new token,
 *      persists it to `localStorage`, then navigates to the play URL
 *      (positioned at `questions_answered` per the resume convention).
 *      The OTHER tab's storage event listener detects the new token
 *      and renders its own conflict block immediately.
 *
 *  2. "חזור לדשבורד" — hard-nav to /dashboard (no claim, no token write).
 */
export function WindowConflict({ sessionId }: Props) {
  const [pending, startTransition] = useTransition();
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Phase 6 a11y: focus the primary "claim" button on mount so keyboard
  // users can Enter-to-confirm immediately.
  useEffect(() => {
    primaryBtnRef.current?.focus();
  }, []);

  function handleClaim(): void {
    if (pending) return;
    startTransition(async () => {
      const result = await claimExamWindow({ sessionId });
      if (!result.ok) {
        toast.error("ההעברה נכשלה. נסה שוב");
        return;
      }
      try {
        window.localStorage.setItem(
          `lawpass.exam.${sessionId}.windowToken`,
          result.windowToken
        );
      } catch {
        // localStorage unavailable — the play page's mount-time check
        // will fail and render this screen again. Acceptable degradation.
      }
      window.location.assign(result.url);
    });
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">סימולציה פעילה בחלון אחר</h1>
        <p className="text-sm text-muted-foreground">
          ניתן להעביר את הבחינה לחלון הזה (החלון הקודם ייחסם), או לחזור
          לדשבורד ולהמשיך מאוחר יותר.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            window.location.assign("/dashboard");
          }}
          disabled={pending}
          className="sm:min-w-44"
        >
          <ArrowLeft className="me-2 size-4" aria-hidden />
          <span>חזור לדשבורד</span>
        </Button>
        <Button
          ref={primaryBtnRef}
          size="lg"
          onClick={handleClaim}
          disabled={pending}
          className="sm:min-w-44"
        >
          <RotateCcw className="me-2 size-4" aria-hidden />
          <span>{pending ? "מעביר..." : "העבר לחלון הזה"}</span>
        </Button>
      </div>
    </div>
  );
}
