"use client";

import {
  AlertCircle,
  BarChart3,
  Bookmark,
  BookOpen,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/** Subscription columns the sidebar needs (subset of subscriptions row). */
type SubscriptionData = {
  id: string;
  plan_type: string;
  ends_at: string; // ISO timestamp
} | null;

/** plan_type → display label. Migration 0006 + 0001 use these snake-case
 *  values; the labels here are the human-facing Hebrew.
 *  TODO(slice-4): when Tranzila lands and plan_type may include more
 *  values (e.g. upgrade SKUs), keep this map in sync. */
const PLAN_LABELS: Record<string, string> = {
  "3_months": "תוכנית 3 חודשים",
  "6_months": "תוכנית 6 חודשים",
};

const NAV_LEARNING = [
  { href: "/dashboard", label: "דשבורד", Icon: LayoutDashboard },
  { href: "/practice", label: "תרגול", Icon: BookOpen },
  { href: "/exam", label: "סימולציות בחינה", Icon: ClipboardList },
] as const;

const NAV_LIBRARY = [
  {
    href: "/bookmarks",
    label: "שאלות שסימנתי",
    Icon: Bookmark,
    countKey: "bookmarks",
  },
  {
    href: "/mistakes",
    label: "שאלות שטעיתי בהן",
    Icon: AlertCircle,
    countKey: "mistakes",
  },
] as const;

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function daysUntil(future: Date, now: Date = new Date()): number {
  const ms = future.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatDateHe(d: Date): string {
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p[0] ?? "").join("");
  return letters.toUpperCase() || "?";
}

export function AppSidebar({
  userEmail,
  profileFullName,
  subscription,
  bookmarksCount,
  mistakesCount,
  pathname,
}: {
  userEmail: string;
  profileFullName: string;
  subscription: SubscriptionData;
  bookmarksCount: number;
  mistakesCount: number;
  pathname: string;
}) {
  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeaderArea />

      <SidebarContent>
        {/* קבוצה 1 — לימוד (SPEC §7.0.1) */}
        <SidebarGroup>
          <SidebarGroupLabel>לימוד</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_LEARNING.map((item) => {
              const active = isPathActive(pathname, item.href);
              const { Icon } = item;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* קבוצה 2 — המאגר שלי (SPEC §7.0.1, flat) */}
        <SidebarGroup>
          <SidebarGroupLabel>המאגר שלי</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_LIBRARY.map((item) => {
              const active = isPathActive(pathname, item.href);
              const { Icon } = item;
              const count =
                item.countKey === "bookmarks"
                  ? bookmarksCount
                  : mistakesCount;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {/* Hide the badge when 0 to avoid showing a misleading
                      "0" pill for users who haven't bookmarked / made
                      mistakes yet (Slice 1 has no practice flow). */}
                  {count > 0 && (
                    <SidebarMenuBadge>{count}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Standalone — סטטיסטיקה.
            SPEC §7.0.1 v1.3 had removed Statistics from MVP, but Yoav
            confirmed it's back in scope (basic analytics only — see
            placeholder page note). */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/statistics" />}
                isActive={isPathActive(pathname, "/statistics")}
              >
                <BarChart3 />
                <span>סטטיסטיקה</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {subscription && <SubscriptionCard subscription={subscription} />}
        <UserAreaDisplay
          fullName={profileFullName}
          email={userEmail}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

/** "תרגול מהיר" header CTA. Uses useSidebar() to hide itself when the
 *  sidebar is collapsed to its icon rail — a full-text button doesn't
 *  fit in the icon column. The dashboard / nav menu items stay reachable
 *  from the icon rail with their lucide icons. */
function SidebarHeaderArea() {
  const { state } = useSidebar();
  if (state === "collapsed") {
    return <SidebarHeader />;
  }
  return (
    <SidebarHeader>
      <Link
        href="/practice"
        className={cn(
          "flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        )}
      >
        תרגול מהיר
      </Link>
    </SidebarHeader>
  );
}

function SubscriptionCard({
  subscription,
}: {
  subscription: NonNullable<SubscriptionData>;
}) {
  const endsAt = new Date(subscription.ends_at);
  const days = daysUntil(endsAt);
  const isWarning = days <= 7;
  const planLabel =
    PLAN_LABELS[subscription.plan_type] ?? subscription.plan_type;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-xs",
        // Active = subtle primary tint. Within 7 days = amber warning.
        // Red/expired state deferred (unreachable in Slice 1 — middleware
        // bounces expired-sub users to /pricing before the sidebar renders).
        isWarning
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-primary/30 bg-primary/5"
      )}
    >
      <div className="font-medium">המנוי שלך</div>
      <div className="mt-1">{planLabel}</div>
      <div className={cn("mt-1", isWarning && "font-medium text-amber-600")}>
        {days} ימים נותרו
      </div>
      <div className="mt-1 text-muted-foreground">
        עד {formatDateHe(endsAt)}
      </div>
    </div>
  );
}

/** Display-only user area for Commit 1. Commit 2 wraps this block in a
 *  DropdownMenu trigger with הגדרות / התנתק items. */
function UserAreaDisplay({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md p-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {initials(fullName)}
      </div>
      <div className="flex min-w-0 flex-col items-start text-start">
        <div className="truncate text-sm font-medium">{fullName}</div>
        <div className="truncate text-xs text-muted-foreground" dir="ltr">
          {email}
        </div>
      </div>
    </div>
  );
}
