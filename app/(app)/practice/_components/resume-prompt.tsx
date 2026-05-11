"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { abandonActiveSession } from "@/app/(app)/practice/_actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { practicePlayUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("he", {
  numeric: "auto",
});

/**
 * Renders a Hebrew "N minutes/hours/days ago" phrase using
 * Intl.RelativeTimeFormat. Picks the largest unit whose magnitude is at
 * least 1 — so 90s renders as "לפני דקה" (not "לפני 90 שניות"). The
 * session is auto-abandoned after 24h in the page Server Component, so
 * the worst case here is ~23h59m.
 */
function relativeTimeHe(iso: string): string {
  const deltaSeconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const buckets: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, secondsInUnit] of buckets) {
    if (Math.abs(deltaSeconds) >= secondsInUnit || unit === "second") {
      return RELATIVE_FORMATTER.format(
        Math.round(deltaSeconds / secondsInUnit),
        unit
      );
    }
  }
  return RELATIVE_FORMATTER.format(0, "second");
}

export function ResumePrompt({
  sessionId,
  startedAt,
  nextPosition,
  totalQuestions,
}: {
  sessionId: string;
  startedAt: string;
  nextPosition: number;
  totalQuestions: number;
}) {
  const [abandoning, setAbandoning] = useState(false);
  const resumeUrl = practicePlayUrl(sessionId, nextPosition);
  const relative = relativeTimeHe(startedAt);
  const progress =
    totalQuestions > 0
      ? `התקדמת בשאלה ${Math.min(nextPosition + 1, totalQuestions)} מתוך ${totalQuestions}`
      : null;

  async function handleAbandon() {
    setAbandoning(true);
    const result = await abandonActiveSession();
    if (!result.ok) {
      toast.error(result.error);
      setAbandoning(false);
      return;
    }
    // The Server Action revalidates /practice; Next.js refetches the
    // page and re-renders without the prompt. No client-side router
    // push needed.
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>יש לך סשן פעיל</CardTitle>
        <CardDescription>
          התחלת תרגול {relative}. תרצה להמשיך או להתחיל מחדש?
          {progress ? ` ${progress}.` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={resumeUrl}
          className={cn(buttonVariants(), "sm:flex-1")}
          aria-disabled={abandoning}
        >
          המשך סשן קיים
        </Link>
        <Button
          variant="ghost"
          onClick={handleAbandon}
          disabled={abandoning}
          className="sm:flex-1"
        >
          {abandoning ? "מבטל..." : "התחל מחדש"}
        </Button>
      </CardContent>
    </Card>
  );
}
