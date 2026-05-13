"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Phase 3 minimal stub. Shown when the client's stored windowToken
 * doesn't match the session's active_window_token on the server.
 *
 * Phase 5 wires the "העבר לחלון הזה" claim button + the
 * `claimExamWindow` server action body. For Phase 3 we only render
 * the message + a "back to dashboard" CTA so users in the conflict
 * state aren't stuck.
 */
export function WindowConflict() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">סימולציה פעילה בחלון אחר</h1>
        <p className="text-sm text-muted-foreground">
          הסימולציה הזו פתוחה בחלון או מכשיר אחר. ניתן להמשיך בחלון הקודם,
          או לחזור לדשבורד ולנסות מאוחר יותר.
        </p>
        <p className="text-xs text-muted-foreground">
          (השתלטות על החלון הזה תתאפשר בעדכון הבא.)
        </p>
      </div>
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: "default" }), "min-w-44")}
      >
        <ArrowLeft className="me-2 size-4" aria-hidden />
        <span>חזור לדשבורד</span>
      </Link>
    </div>
  );
}
