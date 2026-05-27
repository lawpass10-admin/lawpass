import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUserDetail } from "@/lib/db/admin";

import UserActions from "./_components/user-actions";
import UserAttempts from "./_components/user-attempts";
import UserProfileCard from "./_components/user-profile-card";

export const dynamic = "force-dynamic";

/**
 * /admin/users/[userId] — per-user read-only drill-in. Profile +
 * auth fields + recent attempts at the top; admin actions in their
 * own panel below. The five proposed actions:
 *   - view details (this page itself — covered)
 *   - edit display name (form, server action)
 *   - send password-reset email (button, server action)
 *   - force sign-out (button, server action with confirm)
 *   - copy user id / email (client-side clipboard buttons)
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
          <h2 className="font-heebo text-xl font-semibold">
            {detail.profile.fullName}
          </h2>
          {detail.auth.email ? (
            <div className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
              {detail.auth.email}
            </div>
          ) : null}
        </div>
        <Link
          href="/admin/users"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← חזרה לרשימת המשתמשים
        </Link>
      </div>

      <UserProfileCard detail={detail} />

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
