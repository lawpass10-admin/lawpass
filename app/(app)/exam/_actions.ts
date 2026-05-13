"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { sampleExamQuestions } from "@/lib/db/exam";
import { EXAM_TOTAL_DURATION_SECONDS } from "@/lib/exam/clusters";
import { createClient } from "@/lib/supabase/server";
import { examPlayUrl } from "@/lib/urls";

// =============================================================================
// Result types
// =============================================================================

type CreateExamSessionResult =
  | {
      ok: true;
      url: string;
      sessionId: string;
      windowToken: string;
    }
  | { ok: false; error: string };

// =============================================================================
// createExamSession
// =============================================================================

/**
 * Mint a new exam session. No client input — sampling is fully derived
 * from the caller's auth + the cluster config.
 *
 * Steps:
 *   1. Abandon any prior active/paused session for the caller (per the
 *      PM-confirmed "single in-flight exam per user" rule; mirror of
 *      `createPracticeSession`).
 *   2. Sample 40 questions via the cluster-weighted sampler.
 *   3. Mint an `active_window_token` (the DB column has no DEFAULT) and
 *      INSERT the session row.
 *   4. revalidatePath layout (no badge changes today, but the resume
 *      modal on `/exam` reads via RSC and benefits from a fresh fetch).
 *   5. Return the play URL + sessionId + windowToken. The client carries
 *      the windowToken into `localStorage` so subsequent server-action
 *      calls can validate it against the row's `active_window_token` —
 *      the single-window guard surface lands in Phase 3.
 */
export async function createExamSession(): Promise<CreateExamSessionResult> {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  try {
    // Step 1 — abandon any prior in-flight session. .in() on status
    // covers both 'active' and 'paused'.
    await supabase
      .from("exam_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .in("status", ["active", "paused"]);

    // Step 2 — sample (throws 'exam_pool_insufficient' if the pool is
    // <40; current production pool is 195 so this branch is defensive).
    const questionList = await sampleExamQuestions(supabase);

    // Step 3 — mint window token client-side. The DB column has no
    // DEFAULT (verified via information_schema), so we explicitly set
    // it; the round-trip on .select('active_window_token') re-reads
    // the stored value, so token drift between app + DB can't happen.
    const windowToken = randomUUID();

    const { data: inserted, error: insertError } = await supabase
      .from("exam_sessions")
      .insert({
        user_id: user.id,
        question_list: questionList,
        total_duration_seconds: EXAM_TOTAL_DURATION_SECONDS,
        time_used_seconds: 0,
        status: "active",
        active_window_token: windowToken,
      })
      .select("id, active_window_token")
      .single();

    if (insertError || !inserted) {
      throw insertError ?? new Error("insert_returned_no_row");
    }

    console.info(
      `[exam] create_session OK user=${user.id} session=${inserted.id} items=${questionList.length}`
    );

    revalidatePath("/", "layout");

    return {
      ok: true,
      url: examPlayUrl(inserted.id, 0),
      sessionId: inserted.id,
      // Use the round-tripped value rather than the local variable so
      // any DB-side rewrite (none expected, but defensive) is reflected.
      windowToken: inserted.active_window_token,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    console.error(
      `[exam] create_session FAILED user=${user.id} code=${
        code ?? "unknown"
      } message=${message}`
    );
    // Surface the sampler's known-error code verbatim so the caller can
    // distinguish "we tried, the pool is too small" from generic
    // failures. Phase 2 surfaces this as a user-visible toast.
    if (message === "exam_pool_insufficient") {
      return { ok: false, error: "exam_pool_insufficient" };
    }
    return { ok: false, error: "create_exam_session_failed" };
  }
}

// =============================================================================
// abandonActiveExamSession
// =============================================================================

/**
 * Soft-cancel any in-flight exam session (status active OR paused) for
 * the caller. Used by the resume modal's "התחל בחינה חדשה" button so
 * the new createExamSession call doesn't trip the
 * "abandon-then-create" guard with a stale row.
 *
 * Idempotent — runs the UPDATE regardless of whether any active row
 * exists; the WHERE clause is the gate.
 */
export async function abandonActiveExamSession(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("exam_sessions")
    .update({
      status: "abandoned",
      last_activity_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .in("status", ["active", "paused"]);

  if (error) {
    console.error(
      `[exam] abandon_active FAILED user=${user.id} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "abandon_active_failed" };
  }

  console.info(`[exam] abandon_active OK user=${user.id}`);
  revalidatePath("/exam");
  return { ok: true };
}
