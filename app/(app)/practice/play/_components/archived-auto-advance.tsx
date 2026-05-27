"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { advanceToNext } from "@/app/(app)/practice/play/_actions";
import { LoadingAnimation } from "@/components/ui/loading-animation";

type ArchivedAutoAdvanceProps = {
  sessionId: string;
  fromPosition: number;
};

/**
 * Renders when getQuestionForPosition returns {kind:"archived"} —
 * surfaces the toast and fires the advance action client-side so we
 * can communicate the skip to the user before the redirect.
 *
 * No attempt row is inserted (the page never reached submitAttempt).
 * Counters are unchanged. Plan §6 Phase 3 "Archived question
 * mid-session" semantics.
 */
export function ArchivedAutoAdvance({
  sessionId,
  fromPosition,
}: ArchivedAutoAdvanceProps) {
  // StrictMode dev double-mount guard — without it the toast fires
  // twice and we double-advance.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    toast.info("השאלה הזו הוסרה זמנית מהמערכת. עוברים לשאלה הבאה.");

    void (async () => {
      const result = await advanceToNext({ sessionId, fromPosition });
      if (result.ok) {
        window.location.assign(result.url);
      } else {
        toast.error(result.error);
      }
    })();
  }, [sessionId, fromPosition]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingAnimation size="md" label="מעבר לשאלה הבאה..." />
    </div>
  );
}
