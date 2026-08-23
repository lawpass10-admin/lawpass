import Link from "next/link";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getMahotiSet } from "@/lib/db/mahoti";

import { MahotiWorkspace } from "./_components/mahoti-workspace";

/**
 * /mahoti — דיון מהותי: the generated paper beside the notebook it was
 * generated from.
 *
 * Server Component shell, same shape as /writing-task:
 * `requireActiveSubscription()` re-runs the gate here so the layout's Router
 * Cache cannot replay the route for an expired user. The data is read here
 * rather than client-side because `mahoti_questions` is admin-only under RLS
 * and the read goes through the service-role client — see lib/db/mahoti.ts,
 * which explains that bypass.
 *
 * `?set=<question_id>` opens one specific paper; without it the newest one is
 * shown. That parameter is what "למבחן הבא" at the end of a review points at,
 * so moving between papers needs no session and no stored position — the id
 * in the URL is the whole state.
 */
export default async function MahotiPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  await requireActiveSubscription();

  const { set: setId } = await searchParams;
  const set = await getMahotiSet(setId);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6">
      <PageHead
        questionCount={set?.questions.length ?? 0}
        lawCount={set?.notebook.notebook.law_count ?? 0}
      />
      {/* Keyed by the paper: moving to another `?set=` stays on this route, so
          without a key React would keep the workspace mounted and the previous
          paper's answers, position and clock would carry into the new one. */}
      {set ? (
        <MahotiWorkspace key={set.questionId} set={set} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

/** Same head shape as /writing-task: breadcrumbs, H1, sub-line. */
function PageHead({
  questionCount,
  lawCount,
}: {
  questionCount: number;
  lawCount: number;
}) {
  return (
    <header className="space-y-2">
      <nav
        aria-label="breadcrumbs"
        className="flex items-center gap-2 font-heebo"
        style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
      >
        <Link href="/dashboard" className="hover:underline">
          דשבורד
        </Link>
        <span aria-hidden>›</span>
        <span>דיון מהותי</span>
      </nav>
      <h1 className="text-3xl font-bold">דיון מהותי</h1>
      <p className="text-sm text-muted-foreground">
        {questionCount > 0
          ? `${questionCount} שאלות מול מחברת החקיקה שממנה נכתבו — ${lawCount} חוקים. כל ציטוט בשאלה נמצא במחברת שמימין.`
          : "שאלות מול מחברת החקיקה שממנה נכתבו."}
      </p>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">
        אין עדיין מחברת עם שאלות. לאחר טעינת שורה לטבלת{" "}
        <code className="font-mono text-xs">mahoti_questions</code> התוכן יופיע
        כאן.
      </p>
    </div>
  );
}
