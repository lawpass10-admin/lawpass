import Link from "next/link";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { getDiuniSet } from "@/lib/db/diuni";

import { DiuniWorkspace } from "./_components/diuni-workspace";

/**
 * /diuni — דין דיוני: a generated paper in the format of חלק ב' of the Bar's
 * own sitting.
 *
 * Server Component shell, the same shape as /mahoti. `requireActiveSubscription()`
 * re-runs the gate here so the layout's Router Cache cannot replay the route for
 * an expired user. The data is read here rather than client-side because
 * `diuni_questions` is admin-only under RLS and the read goes through the
 * service-role client — see lib/db/diuni.ts, which explains that bypass.
 *
 * `?set=<question_id>` opens one specific paper; without it the newest one is
 * shown. That parameter is what "למבחן הבא" at the end of a review points at,
 * so moving between papers needs no session and no stored position.
 *
 * WHERE THIS DIFFERS FROM /mahoti. There is no notebook pane. A mahoti question
 * is checked against the legislation printed beside it, so that screen is a
 * split view and gives up the sidebar for the width. A diuni question is
 * answered from knowledge of procedure, exactly as in the real paper, so the
 * question column has the screen to itself and reads at a comfortable measure
 * rather than being squeezed into half of it.
 */
export default async function DiuniPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string }>;
}) {
  await requireActiveSubscription();

  const { set: setId } = await searchParams;
  const set = await getDiuniSet(setId);

  return (
    // One viewport-tall column that never scrolls as a page: `100dvh` less the
    // `p-6` the (app) focus-route layout puts around <main>. The question pane
    // scrolls inside itself, which is what keeps the timer, the progress strip
    // and the prev/next pair on screen at once.
    //
    // Width matches /mahoti (1480px) even though this screen has no notebook to
    // fill it. The progress strip lays its cells out at a 24px minimum and
    // scrolls horizontally when they do not fit — at 1100px a 40-question paper
    // overflowed and the numbering became a scrollable band instead of a row you
    // can see at a glance. The question text does NOT use the extra width; it is
    // capped to a readable measure inside the workspace.
    <div className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-[1480px] flex-col gap-2 overflow-hidden">
      <PageHead questionCount={set?.questions.length ?? 0} />
      {/* Keyed by the paper: moving to another `?set=` stays on this route, so
          without a key React would keep the workspace mounted and the previous
          paper's answers, position and clock would carry into the new one. */}
      {set ? (
        <div className="min-h-0 flex-1">
          <DiuniWorkspace key={set.questionId} set={set} />
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

/**
 * Breadcrumbs, H1 and sub-line on one short line — the same head /mahoti uses,
 * for the same reason: every pixel the chrome gives up goes to the question and
 * its four answers.
 */
function PageHead({ questionCount }: { questionCount: number }) {
  return (
    <header className="flex shrink-0 items-baseline gap-2 font-heebo leading-none">
      <Link
        href="/dashboard"
        className="text-[11px] text-muted-foreground hover:underline"
      >
        דשבורד
      </Link>
      <span aria-hidden className="text-[11px] text-muted-foreground">
        ›
      </span>
      <h1 className="text-[13px] font-bold">דין דיוני</h1>
      <span className="text-[11px] text-muted-foreground">
        {questionCount > 0 ? `${questionCount} שאלות · 100 דקות` : ""}
      </span>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">
        אין עדיין מבחן דין דיוני. לאחר טעינת שורה לטבלת{" "}
        <code className="font-mono text-xs">diuni_questions</code> התוכן יופיע
        כאן.
      </p>
    </div>
  );
}
