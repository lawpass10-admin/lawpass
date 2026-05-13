"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createExamSession } from "@/app/(app)/exam/_actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { IntroContent } from "./intro-content";

/**
 * Fresh-user entry point at `/exam`. Renders the shared IntroContent
 * and the two-button footer. "התחל בחינה" fires createExamSession;
 * on success we navigate to the play URL via window.location.assign
 * (same pattern as createPracticeSession in Slice 2).
 *
 * Sidebar is hidden across the whole /exam/* subtree at the layout
 * level — see app/(app)/layout.tsx (Phase 0). This page therefore
 * renders full-bleed.
 */
export function ExamIntro() {
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  function handleStart() {
    if (submitting) return;
    setSubmitting(true);
    startTransition(async () => {
      const result = await createExamSession();
      if (!result.ok) {
        toast.error(
          result.error === "exam_pool_insufficient"
            ? "אין מספיק שאלות במאגר לסימולציה כרגע"
            : "אירעה שגיאה. נסה שוב"
        );
        setSubmitting(false);
        return;
      }
      // Cross-segment navigation matches Slice 2's convention.
      window.location.assign(result.url);
    });
  }

  return (
    <>
      <IntroContent />
      <div className="mx-auto flex w-full max-w-3xl flex-col-reverse gap-2 pb-10 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost" }), "sm:min-w-32")}
        >
          חזרה
        </Link>
        <Button
          size="lg"
          onClick={handleStart}
          disabled={submitting || isPending}
          className="sm:min-w-44"
        >
          <span>{submitting ? "יוצר סימולציה..." : "התחל בחינה"}</span>
          {!submitting && <Play className="ms-2 size-4" aria-hidden />}
        </Button>
      </div>
    </>
  );
}
