import Link from "next/link";
import { redirect } from "next/navigation";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getChaptersWithQuestionCount,
  getResumableSessionForUser,
} from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";
import { parsePracticeSetupPrefill } from "@/lib/urls";

import { PracticeSetupForm } from "./_components/practice-setup-form";

/**
 * /practice — Slice 2 PracticeSetup entry point. Server Component.
 *
 * 1. `requireActiveSubscription()` re-runs the auth + subscription gate
 *    so the layout's Router Cache can't replay /practice for an expired
 *    user (same hardening as /dashboard).
 * 2. Phase P2 — if an active in-flight session exists (and isn't stale
 *    past the 24h cutoff), redirect to `/practice/resume`. The
 *    resumable check lives in `lib/db/practice.ts:getResumableSessionForUser`
 *    so /practice and /practice/resume share one source of truth and
 *    one place to silently flip stale rows to `abandoned`.
 * 3. Loads the chapter + subtopic taxonomy used by the setup form.
 *    Both tables' RLS allows any authenticated SELECT, so the SSR
 *    client is the right one (admin client would bypass that
 *    intentionally — Hardening Rule territory).
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user } = await requireActiveSubscription();
  const supabase = await createClient();

  // Resume gate — runs BEFORE taxonomy loading so we don't pay the
  // chapters+subtopics round trips when we're about to redirect away.
  const activeSession = await getResumableSessionForUser(supabase, user.id);
  if (activeSession) redirect("/practice/resume");

  // Parse optional ?prefill from the "תרגול נוסף" CTA on the summary
  // page. Defensive: parsePracticeSetupPrefill drops invalid uuids /
  // out-of-range integers silently, so invalid prefill simply falls
  // back to form defaults.
  const rawParams = (await searchParams) ?? {};
  const flatParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") flatParams.set(key, value);
    else if (Array.isArray(value) && typeof value[0] === "string") {
      flatParams.set(key, value[0]);
    }
  }
  const initialValues = parsePracticeSetupPrefill(flatParams);

  const [chapters, subtopicsResult] = await Promise.all([
    getChaptersWithQuestionCount(supabase),
    supabase
      .from("subtopics")
      .select("id, chapter_id, code, title, display_order")
      .order("display_order", { ascending: true }),
  ]);

  if (subtopicsResult.error) {
    // Render-time DB failure on the taxonomy. Bubble up so the route-group
    // error.tsx renders rather than crashing into an empty form. The
    // boundary's Hebrew copy + retry button is the right UX here.
    throw new Error(
      `Failed to load practice taxonomy: ${subtopicsResult.error.message}`
    );
  }

  const subtopics = subtopicsResult.data ?? [];

  if (chapters.length === 0) {
    // Empty taxonomy. Until Sharon's bulk-seed lands, we have exactly one
    // chapter (סדר דין אזרחי) — a missing chapters table means the seed
    // got wiped. Surface a friendly state rather than an empty grid.
    return (
      <div className="mx-auto w-full max-w-[1480px] space-y-6">
        <PageHead />
        <p className="text-sm text-muted-foreground">
          אין כרגע פרקים זמינים. נסה שוב מאוחר יותר או פנה לתמיכה.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-7">
      <PageHead />
      <PracticeSetupForm
        chapters={chapters}
        subtopics={subtopics}
        initialValues={initialValues}
      />
    </div>
  );
}

/**
 * Slice 5 Phase P3 — Page head per `PracticeBuilder.html`. Replaces
 * the old card-style header with breadcrumbs + a fluid H1 + sub-line
 * sitting flush on the paper background. Server-rendered alongside
 * the rest of the route — no client interactivity needed.
 */
function PageHead() {
  return (
    <header className="space-y-2">
      <nav
        aria-label="breadcrumbs"
        className="flex items-center gap-2 font-heebo"
        style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
      >
        <Link
          href="/dashboard"
          className="font-semibold transition-colors hover:underline"
          style={{ color: "var(--color-gold-deep)" }}
        >
          דשבורד
        </Link>
        <span aria-hidden>›</span>
        <span>בניית תרגול</span>
      </nav>
      <h1
        className="font-heebo font-extrabold tracking-tight"
        style={{
          fontSize: "clamp(28px, 2.4vw, 36px)",
          color: "var(--color-navy-ink)",
          lineHeight: 1.1,
        }}
      >
        בנה את הסשן שלך
      </h1>
      <p
        className="font-heebo font-normal"
        style={{ fontSize: 15, color: "var(--color-ink-dim)" }}
      >
        בחר נושאים, כמה שאלות מקור, וכמה זוויות לכל מקור.
      </p>
    </header>
  );
}
