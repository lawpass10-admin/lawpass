import { requireAdmin } from "@/lib/auth/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_USERS_PAGE_SIZE,
  getUsersListPage,
} from "@/lib/db/admin";

import UsersTable from "./_components/users-table";
import UsersPager from "./_components/users-pager";

export const dynamic = "force-dynamic";

function parsePage(v: string | string[] | undefined): number {
  const raw = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/**
 * /admin/users — paginated users table. Gate runs in the layout AND
 * defensively here (Server Action equivalent) before we touch the
 * service-role client.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parsePage(params.page);

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const { rows, hasMore, perPage } = await getUsersListPage(
    supabase,
    adminClient,
    { page, perPage: ADMIN_USERS_PAGE_SIZE }
  );

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-heebo text-lg font-semibold">משתמשים</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          לחיצה על שורה פותחת את פרטי המשתמש.
        </p>
      </header>
      <UsersTable rows={rows} />
      <UsersPager page={page} hasMore={hasMore} perPage={perPage} />
    </div>
  );
}
