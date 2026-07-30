import { requireAdmin } from "@/lib/auth/admin-gate";
import { countOpenQaReports } from "@/lib/db/qa-reports";
import { createClient } from "@/lib/supabase/server";

import AdminNav from "./_components/admin-nav";

export const dynamic = "force-dynamic";

/**
 * /admin shell — gates every page under `/admin/**` via `requireAdmin()`.
 *
 * Per the subscription-gate precedent (lib/auth/subscription-gate.ts),
 * layout-level gating is not load-bearing on its own — Next's Router
 * Cache reuses layout segments across same-group navigations. Pages
 * (and any future Server Action) re-call `requireAdmin()` defensively.
 * This layout's job is rendering the shell + running the gate once on
 * fresh navigations.
 *
 * Slice 10 Phase B-2 — also fetches the open-QA-reports count so the
 * QA tab can render a triage-queue badge. Single cheap COUNT, runs
 * under admin RLS; the layout already touches the DB via requireAdmin
 * so the extra round-trip is acceptable.
 *
 * The route is added to SUBSCRIPTION_EXEMPT_PREFIXES in
 * app/(app)/layout.tsx so an admin whose own subscription expired can
 * still reach the panel.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const openQaCount = await countOpenQaReports(supabase);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-2">
      {/* Slice 7 polish (d, j): navy-ink H1 + gold underline accent
          under the header (echoes dashboard's header-strip). */}
      <header className="relative space-y-3 border-b border-[var(--color-line)] pb-3">
        <div>
          <h1 className="font-heebo text-2xl font-bold text-[var(--color-navy-ink)]">
            ניהול
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
            סקירת תוכן ומשתמשים. גישה מוגבלת לאדמינים בלבד.
          </p>
        </div>
        <AdminNav openQaCount={openQaCount} />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] w-32 rounded bg-[var(--color-gold)]"
        />
      </header>
      {children}
    </div>
  );
}
