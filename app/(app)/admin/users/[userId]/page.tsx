import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserDetail } from "@/lib/db/admin";

import SubscriptionMockups from "./_components/subscription-mockups";
import UserActions from "./_components/user-actions";
import UserAttempts from "./_components/user-attempts";
import UserProfileCard from "./_components/user-profile-card";

export const dynamic = "force-dynamic";

/**
 * /admin/users/[userId] — per-user drill-in. Profile + auth fields +
 * subscription-action mockups + admin-actions panel + recent
 * attempts. Slice 7 adds the subscription mockup buttons (UI only)
 * next to the active-sub field; the actions panel below keeps the
 * Phase B five actions.
 */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { user: adminUser } = await requireAdmin();
  const { userId } = await params;

  const supabase = await createClient();
  const adminClient = createAdminClient();

  const detail = await getUserDetail(supabase, adminClient, userId);
  if (!detail) notFound();

  const isSelf = adminUser.id === userId;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-heebo text-xl font-semibold text-[var(--color-navy-ink)]">
            {detail.profile.fullName}
          </h2>
          {detail.auth.email ? (
            <div
              className="mt-0.5 text-sm text-[var(--color-ink-dim)]"
              dir="ltr"
            >
              {detail.auth.email}
            </div>
          ) : null}
        </div>
        <Link
          href="/admin/users"
          className="text-sm text-[var(--color-ink-dim)] hover:text-foreground hover:underline"
        >
          ← חזרה לרשימת המשתמשים
        </Link>
      </div>

      <UserProfileCard detail={detail} />

      {/* Slice 7 — mockup subscription actions. Hidden when looking
          at yourself (matches the self-protection pattern in the
          Phase B admin actions panel). */}
      {!isSelf ? (
        <SubscriptionMockups activeSubscription={detail.activeSubscription} />
      ) : null}

      <UserActions
        userId={detail.userId}
        currentFullName={detail.profile.fullName}
        email={detail.auth.email}
        isSelf={isSelf}
      />

      <UserAttempts attempts={detail.recentAttempts} />
    </div>
  );
}
