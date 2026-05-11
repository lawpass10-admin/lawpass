import { redirect } from "next/navigation";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getSummary } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { practicePlayUrl } from "@/lib/urls";

import { PracticeSummary } from "./_components/practice-summary";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * /practice/summary?session={id} — end-of-session breakdown.
 *
 * Handles three session-state cases:
 *   - active     → redirect back to the in-flight question page
 *                  (user reached this URL by editing or skipping ahead;
 *                  let them finish the session first).
 *   - completed  → render summary.
 *   - abandoned  → redirect /practice (no summary for abandoned sessions
 *                  per the "exit before any answer" branch of
 *                  exitSession).
 *
 * Aggregation lives in lib/db/practice.ts.getSummary — handles the
 * archived-mid-session case by bucketing archived attempts under a
 * separate "—" row rather than dropping the data.
 */
export default async function PracticeSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { user } = await requireActiveSubscription();

  const { session: sessionId } = await searchParams;
  if (!sessionId || !UUID_RE.test(sessionId)) redirect("/practice");

  const supabase = await createClient();
  const summary = await getSummary(supabase, user.id, sessionId);
  if (!summary) redirect("/practice");

  if (summary.session.status === "active") {
    redirect(practicePlayUrl(sessionId, summary.session.questions_answered));
  }
  if (summary.session.status === "abandoned") {
    redirect("/practice");
  }

  return <PracticeSummary summary={summary} />;
}
