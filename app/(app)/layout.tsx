import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/app-sidebar";
import { createClient } from "@/lib/supabase/server";

// Routes inside (app) that don't require an active subscription. The user
// must be able to reach /pricing to subscribe, /onboarding to see the
// welcome screen between mock-payment and dashboard, and /account/* to
// manage profile + subscription even after expiry (SPEC 7.4).
const SUBSCRIPTION_EXEMPT_PREFIXES = ["/pricing", "/onboarding", "/account"];

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding/complete-profile");

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";

  if (!isSubscriptionExempt(pathname)) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle();

    if (!subscription) redirect("/pricing");
  }

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
