"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { regradeAnswer } from "@/lib/api/open-questions";

/**
 * "בדוק שוב את התשובה" — mark the saved answer again, without rewriting it.
 *
 * On success the page RELOADS rather than switching itself back to waiting.
 * The page already knows how to arrive at an answer that is pending or being
 * graded: it shows the waiting room and polls. Reusing that path means a retry
 * cannot drift from what a fresh visit does — and it is how the timeout state
 * already recovers.
 *
 * `busy` is never cleared on success, so the button stays disabled until the
 * reload lands and a second click cannot slip in. The server would turn that
 * second click into a no-op anyway; this just avoids the round trip.
 */
export function RetryGradingButton({ answerId }: { answerId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function retry(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError("");

    const result = await regradeAnswer(answerId);
    if (!result.ok) {
      console.warn(`[grading] answer=${answerId} regrade request failed — ${result.error}`);
      setError(result.error);
      setBusy(false);
      return;
    }

    console.info(
      `[grading] answer=${answerId} regrade requested — status=${result.data.grading_status}, reloading to resume polling`
    );
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={retry} disabled={busy} className="h-11 md:h-10">
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
        {busy ? "שולח לבדיקה…" : "בדוק שוב את התשובה"}
      </Button>
      {error ? (
        <p
          role="alert"
          className="font-heebo text-sm"
          style={{ color: "var(--color-danger, #b42318)" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
