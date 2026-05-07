import Link from "next/link";

import { SiteFooter } from "@/components/shared/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * / — public landing page (Server Component, static).
 *
 * Static placeholder until the Slice 6 marketing site lands. Renders the
 * app name, a one-sentence Hebrew tagline, and two CTA buttons (signup +
 * login). NO database access, NO admin client, NO server-side data
 * fetching — everything here is content-only.
 *
 * Replaced an earlier dev-only Supabase connectivity smoketest that used
 * `createAdminClient()` (the service-role key) on the public homepage.
 * That probe leaked connection-state information to anonymous visitors
 * and violated Hardening Rule #2 ("SSR client only — never the admin
 * client"). For a future health probe, use an admin-gated /api/health
 * route instead.
 */
export default function Home() {
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
