import { redirect } from "next/navigation";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getExamResultsAggregate,
  getExamSessionById,
} from "@/lib/db/exam";
import { getNotedIdentities } from "@/lib/db/notes";
import { createClient } from "@/lib/supabase/server";
import { examPlayUrl } from "@/lib/urls";

import { ExamResults } from "../_components/exam-results";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * /exam/results/[id] — Slice 3 Phase 4.
 *
 * Routing rules:
 *   - Bad id → /exam
 *   - Session not found → /exam
 *   - status='active' or 'paused' → /exam/play/[questions_answered]
 *     (results only viewable after submission)
 *   - status='abandoned' → /exam
 *   - status='completed' → render results
 */
export default async function ExamResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireActiveSubscription();
  const { id: sessionId } = await params;

  if (!sessionId || !UUID_RE.test(sessionId)) redirect("/exam");

  const supabase = await createClient();
  const session = await getExamSessionById(supabase, user.id, sessionId);
  if (!session) redirect("/exam");

  if (session.status === "active" || session.status === "paused") {
    redirect(examPlayUrl(session.id, session.questions_answered));
  }
  if (session.status !== "completed") {
    redirect("/exam");
  }

  // Slice 38 — run the aggregate fetch alongside the user's full
  // notes-identity set so the pencil indicator can pre-fill without a
  // per-row round-trip. `getNotedIdentities` reads at most a tens-of-
  // rows table for this user.
  const [aggregate, notedIdentities] = await Promise.all([
    getExamResultsAggregate(supabase, user.id, sessionId),
    getNotedIdentities(supabase, user.id),
  ]);
  if (!aggregate) redirect("/exam");

  return <ExamResults aggregate={aggregate} notedIdentities={notedIdentities} />;
}
