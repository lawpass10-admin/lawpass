import Link from "next/link";

import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

import { WritingTaskPicker } from "./_components/writing-task-picker";

/**
 * /writing-task — pick a מטלת כתיבה: choose a subject, then a question.
 *
 * Server Component shell. `requireActiveSubscription()` re-runs the gate here
 * for the same reason /practice does — the layout's Router Cache must not be
 * able to replay this route for an expired user.
 *
 * The data itself is NOT loaded here. Questions live in lawpass_server
 * (GET /api/open-questions/*), which the browser calls with the user's Supabase
 * bearer token, so the picker below is a client component. The page stays a
 * thin server shell so the gate still runs before anything renders.
 */
export default async function WritingTaskPage() {
  await requireActiveSubscription();

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-7">
      <PageHead />
      <WritingTaskPicker />
    </div>
  );
}

/** Same head shape as /practice: breadcrumbs, fluid H1, sub-line. */
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
        <span>מטלת כתיבה</span>
      </nav>
      <h1
        className="font-heebo font-extrabold tracking-tight"
        style={{
          fontSize: "clamp(28px, 2.4vw, 36px)",
          color: "var(--color-navy-ink)",
          lineHeight: 1.1,
        }}
      >
        בחר מטלת כתיבה
      </h1>
      <p
        className="font-heebo font-normal"
        style={{ fontSize: 15, color: "var(--color-ink-dim)" }}
      >
        בחר נושא, ואז את השאלה שברצונך לכתוב.
      </p>
    </header>
  );
}
