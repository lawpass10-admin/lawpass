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
    // One viewport-tall column that never scrolls as a page: `100dvh` less
    // the `p-6` the (app) focus-route layout puts around <main>. The panes
    // inside scroll on their own, which is what keeps the notebook, the
    // prev/next pair and the submit bar simultaneously on screen.
    <div className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-[1480px] flex-col gap-2 overflow-hidden">
      <PageHead
        questionCount={set?.questions.length ?? 0}
        lawCount={set?.notebook.notebook.law_count ?? 0}
      />
      {/* Keyed by the paper: moving to another `?set=` stays on this route, so
          without a key React would keep the workspace mounted and the previous
          paper's answers, position and clock would carry into the new one. */}
      {set ? (
        <div className="min-h-0 flex-1">
          <MahotiWorkspace key={set.questionId} set={set} />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

/**
 * The /writing-task head — breadcrumbs, H1, sub-line — squeezed onto one
 * short line. This screen has to fit two panes, a progress strip, a timer bar
 * and a pinned action stack into a single viewport with no scrollbar
 * anywhere, so every pixel the chrome gives up goes to the question and its
 * four answers. The counts moved to `title`: they are orientation, read once,
 * and not worth a row of height on every visit.
 */
function PageHead({
  questionCount,
  lawCount,
}: {
  questionCount: number;
  lawCount: number;
}) {
  const summary =
    questionCount > 0
      ? `${questionCount} שאלות מול מחברת החקיקה שממנה נכתבו — ${lawCount} חוקים. כל ציטוט בשאלה נמצא במחברת שמימין.`
      : "שאלות מול מחברת החקיקה שממנה נכתבו.";

  return (
    <header
      className="flex shrink-0 items-baseline gap-2 font-heebo leading-none"
      title={summary}
    >
      {/* A plain <Link>: <AppShell> decides focus mode from `usePathname()`,
          so the navy sidebar comes back on this soft navigation. It used to
          need a hard <a> — see ReviewFooter in review/page.tsx. */}
      <Link
        href="/dashboard"
        className="text-[11px] text-muted-foreground hover:underline"
      >
        דשבורד
      </Link>
      <span aria-hidden className="text-[11px] text-muted-foreground">
        ›
      </span>
      <h1 className="text-[13px] font-bold">דיון מהותי</h1>
      <span className="text-[11px] text-muted-foreground">
        {questionCount > 0 ? `${questionCount} שאלות · ${lawCount} חוקים` : ""}
      </span>
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
