import { requireAdmin } from "@/lib/auth/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ADMIN_USERS_PAGE_SIZE,
  getUsersListPage,
  type UsersListFilters,
  type UsersListPlanFilter,
  type UsersListSignupFilter,
  type UsersListSubscriptionFilter,
} from "@/lib/db/admin";

import UsersFiltersBar from "./_components/users-filters-bar";
import UsersTable from "./_components/users-table";
import UsersPager from "./_components/users-pager";

export const dynamic = "force-dynamic";

function pickStr(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

function parsePage(v: string | string[] | undefined): number {
  const raw = pickStr(v);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function parseSubStatus(
  v: string | undefined
): UsersListSubscriptionFilter | null {
  return v === "active" || v === "expired" || v === "cancelled" || v === "none"
    ? v
    : null;
}

function parsePlanType(v: string | undefined): UsersListPlanFilter | null {
  return v === "3_months" || v === "6_months" ? v : null;
}

function parseSignupSource(
  v: string | undefined
): UsersListSignupFilter | null {
  return v === "email" || v === "google" ? v : null;
}

/**
 * /admin/users — paginated users table with subscription / plan /
 * signup-source filters and a name+phone+email search. The URL is the
 * canonical state for the filter bar (search params).
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    sub?: string | string[];
    plan?: string | string[];
    src?: string | string[];
    q?: string | string[];
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const page = parsePage(params.page);
  const filters: UsersListFilters = {
    subscriptionStatus: parseSubStatus(pickStr(params.sub)),
    planType: parsePlanType(pickStr(params.plan)),
    signupSource: parseSignupSource(pickStr(params.src)),
    q: pickStr(params.q) ?? null,
  };

  const supabase = await createClient();
  const adminClient = createAdminClient();
  const { rows, hasMore, perPage } = await getUsersListPage(
    supabase,
    adminClient,
    { page, perPage: ADMIN_USERS_PAGE_SIZE, filters }
  );

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-heebo text-lg font-semibold text-[var(--color-navy-ink)]">
          משתמשים
        </h2>
        <p className="mt-0.5 text-sm text-[var(--color-ink-dim)]">
          לחיצה על שורה פותחת את פרטי המשתמש.
        </p>
      </header>
      <UsersFiltersBar
        currentSub={filters.subscriptionStatus ?? null}
        currentPlan={filters.planType ?? null}
        currentSource={filters.signupSource ?? null}
        currentQ={filters.q ?? ""}
      />
      <UsersTable rows={rows} />
      <UsersPager page={page} hasMore={hasMore} perPage={perPage} />
    </div>
  );
}
