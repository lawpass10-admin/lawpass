import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getActiveExamSessionForUser } from "@/lib/db/exam";
import { createClient } from "@/lib/supabase/server";

import { ExamIntro } from "./_components/exam-intro";
import { ResumePrompt } from "./_components/resume-prompt";

/**
 * /exam — Slice 3 entry point. Server Component.
 *
 * Branching rule (per SLICE_3_PLAN.md §2):
 *   - Active or paused session exists → render <ResumePrompt> over the
 *     intro background. User chooses resume or fresh.
 *   - No active/paused session → render <ExamIntro>. CTA fires
 *     createExamSession.
 *
 * Sidebar is hidden by the (app)/layout.tsx pathname branch added in
 * Phase 0 — no extra wiring needed here.
 */
export default async function ExamPage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();
  const activeSession = await getActiveExamSessionForUser(supabase, user.id);

  if (activeSession) {
    return (
      <ResumePrompt
        session={{
          id: activeSession.id,
          questions_answered: activeSession.questions_answered,
          status: activeSession.status,
          active_window_token: activeSession.active_window_token,
        }}
      />
    );
  }

  return <ExamIntro />;
}
