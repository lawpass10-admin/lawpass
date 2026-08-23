import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { MobileTopBar } from "@/components/app/mobile-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getActiveBookmarkAndMistakeCounts } from "@/lib/db/practice";
import { createClient } from "@/lib/supabase/server";

import { NoCopyBypassProvider } from "./_components/no-copy-bypass-provider";
import { QaFloatingWidget } from "./_components/qa-floating-widget";

// Routes inside (app) that don't require an active subscription. The user
// must be able to reach /pricing to choose a plan, /checkout to enter
// payment details (Phase 6 placeholder; Tranzila iframe in Slice 4),
// /onboarding to see the welcome screen between mock-payment and dashboard,
// and /account/* to manage profile + subscription even after expiry (SPEC 7.4).
const SUBSCRIPTION_EXEMPT_PREFIXES = [
  "/pricing",
  "/checkout",
  "/onboarding",
  "/account",
  "/admin",
];

function isSubscriptionExempt(pathname: string): boolean {
  return SUBSCRIPTION_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Defense in depth — middleware should already have redirected unauthed
  // users to /login. Belt-and-suspenders here in case a route slips past.
  // The try/catch handles AuthApiError thrown by the auto-refresh path when
  // the refresh_token was revoked (e.g., admin-deleted user). Without it,
  // the throw bubbles out of this Server Component as a Next runtime error
  // visible to the user. Middleware should have cleared cookies already; if
  // we still landed here without a session, just bounce.
  let user: User | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    redirect("/login");
  }
  if (!user) redirect("/login");

  // profiles + subscriptions both depend only on user.id — fetch in
  // parallel to shave one DB round-trip off every protected-route render.
  // The subscription SELECT runs ALWAYS (the sidebar needs plan_type +
  // ends_at to render the subscription card); the redirect-to-/pricing
  // gate further down still only fires for non-exempt routes.
  const [profileResult, subscriptionResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, exam_date_planned, is_admin, is_qa_tester")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, plan_type, ends_at")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle(),
  ]);
  const profile = profileResult.data;
  const subscription = subscriptionResult.data;

  if (!profile) {
    // /onboarding/complete-profile is the Google-OAuth completion route
    // (SPEC §6.2 step 5). Only OAuth users land there. For email-flow users,
    // verifyOtpAction's fail-recovery (Phase 4 — signOut + cookie sweep on
    // createProfile failure) wipes orphans before they reach this layout, so
    // the else branch below should be unreachable in normal flow. It's
    // defensive — if we ever do see an authenticated user with no profile
    // and no Google provider, signOut and bounce to /login rather than
    // misroute them to a form that wasn't designed for them.
    //
    // app_metadata.providers shape verified live during Phase 5 planning:
    // email user has providers: ["email"], merged user has both. Using the
    // array (vs the singular `provider` which only reflects the most-recent
    // login) handles the merge case correctly.
    const isOAuthUser =
      user.app_metadata?.providers?.includes("google") ?? false;
    if (isOAuthUser) {
      redirect("/onboarding/complete-profile");
    }
    await supabase.auth.signOut();
    redirect("/login");
  }

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";

  // The redirect-to-/pricing gate fires only for non-exempt routes.
  // `subscription` was already fetched above in the Promise.all alongside
  // the profile query.
  if (!subscription && !isSubscriptionExempt(pathname)) {
    redirect("/pricing");
  }

  // Focus routes hide the sidebar to give a focused, no-distractions
  // simulation feel (SPEC §7.0.4). The SubscriptionGate above still
  // ran — these are subscription-protected like every other (app) route.
  // We skip the sidebar mount AND the bookmark/mistake count queries,
  // since neither sidebar nor badges render on them.
  //
  // /mahoti joins /exam here for a different reason than distraction: it
  // is a split screen, question beside notebook, and the navy sidebar
  // costs it ~16rem of the width both panes are competing for.
  const FOCUS_ROUTES = ["/exam", "/mahoti"];
  const isFocusRoute = FOCUS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  // Slice 10 — surface the QA widget for testers across BOTH branches
  // of the layout (exam-focused branch + sidebar branch). The widget
  // is fixed-position and renders into a Portal when open, so JSX
  // placement is layout-irrelevant; we keep it as a sibling of <main>
  // to mirror the sidebar's placement-as-sibling convention.
  const isQaTester = profile.is_qa_tester === true;
  // Slice 63 — QA users (testers + admins) bypass the Slice 37
  // copy/paste deterrent so reviewers can paste questions + 360
  // content into AI tools. Wired through <NoCopyBypassProvider>
  // (context) at the layout level so it covers every (app) route in
  // one place. The flags are already loaded in the Promise.all
  // above; no new query. Normal users see `bypass=false` and the
  // deterrent renders unchanged.
  const canCopy = isQaTester || profile.is_admin === true;

  if (isFocusRoute) {
    return (
      <NoCopyBypassProvider bypass={canCopy}>
        {/* Slice 51 — id="main-content" added so the universal skip-link
            (set up by the a11y widget) lands on the actual main element.
            Previously only the landing + legal pages had this id. */}
        <main id="main-content" className="page-fade-in flex-1 p-6">
          {children}
        </main>
        <QaFloatingWidget isQaTester={isQaTester} />
      </NoCopyBypassProvider>
    );
  }

  // Counts for sidebar badges. Both tables' RLS policies require
  // has_active_subscription(); for users on subscription-exempt routes
  // (without a sub), RLS returns 0 rows → count is 0 (no error).
  //
  // Slice 6 fix 1: badges must reflect the same auto-resolve filter as
  // the list pages — a bookmark/mistake disappears once the user's
  // most recent attempt on that question is correct. The compute-at-
  // read predicate can't be expressed with `count: exact, head: true`,
  // so we now fetch the rows minimally (id columns only) and count
  // post-filter. See lib/db/practice.ts for the shared helper.
  const { bookmarksCount, mistakesCount, notesCount } =
    await getActiveBookmarkAndMistakeCounts(supabase, user.id);

  return (
    <NoCopyBypassProvider bypass={canCopy}>
      <SidebarProvider>
        <AppSidebar
          userEmail={user.email ?? ""}
          profileFullName={profile.full_name}
          subscription={subscription}
          bookmarksCount={bookmarksCount}
          mistakesCount={mistakesCount}
          notesCount={notesCount}
          isAdmin={profile.is_admin === true}
        />
        <SidebarInset>
          <MobileTopBar />
          {/* Slice 51 — id="main-content" added (see exam-branch comment
              above for context). */}
          <main id="main-content" className="page-fade-in flex-1 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
        <QaFloatingWidget isQaTester={isQaTester} />
      </SidebarProvider>
    </NoCopyBypassProvider>
  );
}
