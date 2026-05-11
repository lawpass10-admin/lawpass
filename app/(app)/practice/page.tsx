import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { createClient } from "@/lib/supabase/server";

import { PracticeSetupForm } from "./_components/practice-setup-form";
import { ResumePrompt } from "./_components/resume-prompt";

// 24-hour cutoff for silent abandon. A session older than this is treated
// as stale on the next /practice visit — flipped to abandoned and the
// user lands on the setup form rather than a resume prompt for a session
// they no longer remember. Plan §6 Phase 6 + plan review Part 3
// decision #4.
const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the active practice_session for `userId`, or null. If the
 * session's last activity is older than the cutoff, the row is flipped
 * to abandoned and null is returned.
 *
 * Lives outside the page component because react-hooks/purity treats
 * Date.now() as impure inside a render function. Server Components ARE
 * render functions per that rule — but a plain async helper isn't, and
 * Date.now() is the right primitive for comparing against an ISO
 * timestamp read from the DB.
 */
async function loadActiveSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("practice_sessions")
    .select(
      "id, started_at, last_activity_at, questions_answered, question_list"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const lastActivityMs = new Date(data.last_activity_at).getTime();
  if (Date.now() - lastActivityMs > STALE_SESSION_MS) {
    await supabase
      .from("practice_sessions")
      .update({
        status: "abandoned",
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return null;
  }

  return data;
}

/**
 * /practice — Slice 2 PracticeSetup entry point. Server Component.
 *
 * 1. `requireActiveSubscription()` re-runs the auth + subscription gate
 *    so the layout's Router Cache can't replay /practice for an expired
 *    user (same hardening as /dashboard).
 * 2. Loads the chapter + subtopic taxonomy used by the setup form.
 *    Both tables' RLS allows any authenticated SELECT, so the SSR
 *    client is the right one (admin client would bypass that
 *    intentionally — Hardening Rule territory).
 * 3. Looks for an in-flight practice_session. If one exists and
 *    last_activity_at is within 24h, render the resume prompt INSTEAD
 *    of the setup form (the user opts in to either Continue or Start
 *    Over). If it's older than 24h, silently abandon it and proceed
 *    straight to the setup form.
 */
export default async function PracticePage() {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  const [chaptersResult, subtopicsResult, activeSession] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, code, title, display_order")
      .order("display_order", { ascending: true }),
    supabase
      .from("subtopics")
      .select("id, chapter_id, code, title, display_order")
      .order("display_order", { ascending: true }),
    loadActiveSession(supabase, user.id),
  ]);

  if (chaptersResult.error || subtopicsResult.error) {
    // Render-time DB failure on the taxonomy. Bubble up so the route-group
    // error.tsx renders rather than crashing into an empty form. The
    // boundary's Hebrew copy + retry button is the right UX here.
    throw new Error(
      `Failed to load practice taxonomy: ${
        chaptersResult.error?.message ?? subtopicsResult.error?.message
      }`
    );
  }

  const chapters = chaptersResult.data ?? [];
  const subtopics = subtopicsResult.data ?? [];

  if (chapters.length === 0) {
    // Empty taxonomy. Until Sharon's bulk-seed lands, we have exactly one
    // chapter (סדר דין אזרחי) — a missing chapters table means the seed
    // got wiped. Surface a friendly state rather than an empty grid.
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            סשן תרגול חדש
          </p>
          <h1 className="text-3xl font-bold">בנה את הסשן שלך</h1>
        </header>
        <p className="text-sm text-muted-foreground">
          אין כרגע פרקים זמינים. נסה שוב מאוחר יותר או פנה לתמיכה.
        </p>
      </div>
    );
  }

  if (activeSession) {
    // Resume-prompt path. The next unanswered position is exactly
    // questions_answered (positions are 0-indexed, dense). The
    // /practice/play route segment is wired in Phase 3 — for now the
    // link merely targets it.
    const nextPosition = activeSession.questions_answered;
    const totalQuestions = Array.isArray(activeSession.question_list)
      ? activeSession.question_list.length
      : 0;
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            סשן תרגול
          </p>
          <h1 className="text-3xl font-bold">בנה את הסשן שלך</h1>
        </header>
        <ResumePrompt
          sessionId={activeSession.id}
          startedAt={activeSession.started_at}
          nextPosition={nextPosition}
          totalQuestions={totalQuestions}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          סשן תרגול חדש
        </p>
        <h1 className="text-3xl font-bold">בנה את הסשן שלך</h1>
        <p className="text-sm text-muted-foreground">
          בחר נושאים, כמה שאלות מקור, וכמה זוויות לכל מקור.
        </p>
      </header>
      <PracticeSetupForm chapters={chapters} subtopics={subtopics} />
    </div>
  );
}
