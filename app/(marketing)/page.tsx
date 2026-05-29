import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFooter } from "@/components/shared/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * / — public landing page (Server Component, static).
 *
 * Slice 16 (Phase L1) — added the authenticated-visitor redirect.
 * Anonymous visitors see the public landing; authenticated users are
 * bounced to /dashboard. The redirect lives here at the page level
 * rather than in a Next middleware because the project has no
 * `middleware.ts` — auth gating across the app is per-route via
 * `requireActiveSubscription` / `requireAdmin` (see lib/auth/*).
 *
 * The full hi-fi landing (hero / method / pricing / FAQ / footer)
 * lands in Phase L2 onward; this file currently still renders the
 * pre-Slice-16 placeholder content below the redirect guard.
 *
 * NO database access, NO admin client. The single auth.getUser() call
 * uses the SSR client and reads from cookies — Hardening Rule #2
 * compliant (never the service-role client on a public page).
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold tracking-tight">LawPass</h1>
          <p className="mt-4 text-base text-muted-foreground">
            פלטפורמה דיגיטלית להכנה למבחני ההסמכה של לשכת עורכי הדין
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className={cn(buttonVariants(), "w-full sm:w-auto")}
            >
              הירשם
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "w-full sm:w-auto"
              )}
            >
              התחבר
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
