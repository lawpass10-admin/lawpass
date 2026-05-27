import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { MobileTopBar } from "@/components/app/mobile-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";

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
      .select("id, full_name, exam_date_planned, is_admin")
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

  // Exam routes hide the sidebar to give a focused, no-distractions
  // simulation feel (SPEC §7.0.4). The SubscriptionGate above still
  // ran — exam is subscription-protected like every other (app) route.
  // We skip the sidebar mount AND the bookmark/mistake count queries,
  // since neither sidebar nor badges render on /exam/*.
  const isExamRoute = pathname === "/exam" || pathname.startsWith("/exam/");
  if (isExamRoute) {
    return <main className="flex-1 p-6">{children}</main>;
  }

  // Counts for sidebar badges. Both tables' RLS policies require
  // has_active_subscription(); for users on subscription-exempt routes
  // (without a sub), RLS returns 0 rows → count is 0 (no error).
  // head:true skips returning rows — server only returns the count integer.
  const [bookmarksResult, mistakesResult] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("mistakes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("manually_removed", false),
  ]);
  const bookmarksCount = bookmarksResult.count ?? 0;
  const mistakesCount = mistakesResult.count ?? 0;

  return (
    <SidebarProvider>
      <AppSidebar
        userEmail={user.email ?? ""}
        profileFullName={profile.full_name}
        subscription={subscription}
        bookmarksCount={bookmarksCount}
        mistakesCount={mistakesCount}
        isAdmin={profile.is_admin === true}
      />
      <SidebarInset>
        <MobileTopBar />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
