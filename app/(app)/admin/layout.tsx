import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin-gate";

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 py-2">
      <header className="flex items-baseline justify-between border-b pb-3">
        <div>
          <h1 className="font-heebo text-2xl font-bold">ניהול</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            סקירת תוכן ומשתמשים. גישה מוגבלת לאדמינים בלבד.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← לדף הניהול
        </Link>
      </header>
      {children}
    </div>
  );
}
