import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import LogoutButton from "./_components/logout-button";
import ProfileForm from "./_components/profile-form";
import SubscriptionStatus from "./_components/subscription-status";

export const dynamic = "force-dynamic";

/**
 * /account — the user's Settings page (Slice 6, SPEC §7.4).
 *
 * Four sections, in order:
 *  1. Edit display name (profiles.full_name)
 *  2. Set planned exam date (profiles.exam_date_planned)
 *  3. Subscription status — display only (no upgrade flow; deferred)
 *  4. Log out
 *
 * Subscription-exempt per (app)/layout.tsx SUBSCRIPTION_EXEMPT_PREFIXES:
 * users without (or past) an active subscription can still reach here to
 * manage their profile and view subscription state.
 */
export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Belt-and-suspenders — middleware + (app)/layout.tsx should have
  // already bounced an unauthenticated visitor.
  if (!user) redirect("/login");

  const [profileResult, subscriptionResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, exam_date_planned")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_type, ends_at")
      .eq("user_id", user.id)
      .eq("is_current", true)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .maybeSingle(),
  ]);

  // (app)/layout.tsx already redirects to /onboarding/complete-profile or
  // /login when the profile is missing, so reaching here without one
  // means something is very wrong. Render minimal state instead of
  // crashing.
  const profile = profileResult.data ?? {
    full_name: "",
    exam_date_planned: null,
  };
  const subscription = subscriptionResult.data ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-2">
      <header>
        <h1 className="font-heebo text-2xl font-bold">הגדרות</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          נהל את הפרטים האישיים, את מועד הבחינה ואת המנוי שלך.
        </p>
      </header>

      <ProfileForm
        defaultFullName={profile.full_name}
        defaultExamDate={profile.exam_date_planned}
      />

      <SubscriptionStatus subscription={subscription} />

      <LogoutButton />
    </div>
  );
}
