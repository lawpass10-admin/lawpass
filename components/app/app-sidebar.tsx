"use client";

import {
  Bookmark,
  Gauge,
  LogOut,
  Pencil,
  Scale,
  Settings,
  Shield,
  Timer,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/(auth)/_actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
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

/** plan_type → display label + total days. The total-days mapping
 *  powers the Phase 9c progress bar; subscriptions table currently
 *  doesn't carry start_date so we derive from the plan SKU. */
const PLAN_LABELS: Record<string, string> = {
  "3_months": "תוכנית 3 חודשים",
  "6_months": "תוכנית 6 חודשים",
};

const PLAN_TOTAL_DAYS: Record<string, number> = {
  "3_months": 90,
  "6_months": 180,
};

// Phase 14 polish — icons re-tuned to match the final prototype:
// dashboard/practice/exam map to Gauge/Scale/Timer (legal-leaning,
// thin stroke). Bookmarks + mistakes stay on Bookmark + XCircle.
const NAV_LEARNING = [
  { href: "/dashboard", label: "דשבורד", Icon: Gauge },
  { href: "/practice", label: "תרגול", Icon: Scale },
  { href: "/exam", label: "סימולציות בחינה", Icon: Timer },
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
    Icon: XCircle,
    countKey: "mistakes",
  },
  {
    href: "/notes",
    label: "הערות",
    Icon: Pencil,
    countKey: "notes",
  },
] as const;

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Phase 9f — sidebar refactored to navy (`--sidebar: #1E3A8A`).
 *   - Inactive: `text-white/70`, `font-medium`. Hover → subtle white
 *     overlay (`bg-white/10`) + full white text.
 *   - Active: translucent white overlay (`bg-white/15`) + pure white
 *     text/icon + `font-semibold`. Gold bar pinned to the row's
 *     visual-LEFT edge (RTL end) — opposite the dot. Gold dot lives
 *     at the row's visual-RIGHT edge (RTL start) as the first flex
 *     child, so it never collides with the count badge on the
 *     visual-left.
 *
 * Icons inherit `currentColor` and track the text color automatically.
 */
const NAV_BUTTON_CLS = cn(
  "relative text-start text-sm",
  "[&_svg:not([class*='size-'])]:size-5",
  // Inactive — translucent white, medium weight
  "font-medium text-white/70",
  // Hover (inactive) — gentle white overlay, full-white text
  "hover:bg-white/10 hover:text-white",
  // Active — Phase 15: instead of a flat white overlay, paint a navy→gold
  // linear gradient so the active row reads as a warm "spotlight" lane.
  // SVG also flips to gold (matches the dot + bar accents).
  "data-active:bg-[linear-gradient(90deg,var(--color-navy-deep)_0%,rgba(201,161,73,0.08)_100%)]",
  "data-active:text-white data-active:font-semibold",
  "data-active:hover:text-white",
  "data-active:[&_svg]:text-[#C9A149]"
);

const COUNT_BADGE_CLS = cn(
  // `ms-auto` (margin-inline-start: auto) pushes the badge to the
  // row's inline-END edge — in RTL that's the visual LEFT.
  //
  // Slice 11 B-2 — bumped `me-2.5` (10px) to `me-4` (16px). The
  // active-row gold <ActiveBar /> is 4px wide at physical-left:0 with
  // a 12px box-shadow glow, occupying roughly the leftmost 16px of
  // the row. The Slice 6 clearance of 10px left the badge sitting
  // INSIDE the bar's glow on the active tab — visible collision in
  // the "המאגר שלי" group. 16px clears the bar + the full glow
  // radius with no overlap, and adds no visible cost in the inactive
  // state (just slightly more whitespace before the row edge).
  "ms-auto me-4 inline-flex items-center justify-center",
  "min-w-6 h-6 px-1.5 rounded-full text-xs font-semibold tabular-nums",
  // Inactive — translucent white pill
  "bg-white/10 text-white/80",
  // Active — clean white pill with navy text
  "group-data-active/menu-button:bg-white group-data-active/menu-button:text-[#1E3A8A]"
);

const SECTION_LABEL_CLS = cn(
  "px-3 pt-2.5 pb-1.5",
  "text-[10px] font-bold uppercase tracking-[0.16em] text-white/45"
);

/**
 * Phase 16b — Gold bar pinned to the active row's INNER LEFT edge
 * (visually-left in RTL — the side facing the dashboard content).
 * Previously the bar was at `-left-[22px]` and extended past the
 * sidebar bounds into the page gutter — PM wanted it inside the
 * sidebar instead. Sits flush against the menu-item's left edge with
 * a thin 4px width so it doesn't crowd the icon/label content.
 */
function ActiveBar() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-1/2 h-7 w-[4px] -translate-y-1/2 rounded-l-[3px] bg-[#C9A149] z-10"
      style={{ boxShadow: "0 0 12px rgba(201, 161, 73, 0.55)" }}
    />
  );
}

/**
 * Phase 14 — Inset gold dot (8×8) on the row's visual-RIGHT edge
 * (RTL start). Absolute-positioned so it doesn't shift the icon/label
 * flex layout, and pinned with `inset-inline-end: 10px` so the dot
 * sits ~10px from the row's start edge regardless of writing
 * direction. Soft gold glow matches the outer bar.
 */
function ActiveDot() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute size-2 rounded-full bg-[#C9A149]"
      style={{
        insetInlineEnd: 10,
        top: "50%",
        transform: "translateY(-50%)",
        boxShadow: "0 0 10px rgba(201, 161, 73, 0.7)",
      }}
    />
  );
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
  notesCount,
  isAdmin,
}: {
  userEmail: string;
  profileFullName: string;
  subscription: SubscriptionData;
  bookmarksCount: number;
  mistakesCount: number;
  /** Slice 26 — count for the new "/notes" nav row. */
  notesCount: number;
  /**
   * Slice 6 — server-decided flag from (app)/layout.tsx. The admin nav
   * link only renders when this is true. The /admin pages call
   * requireAdmin() themselves; this prop is purely a UX nicety.
   */
  isAdmin: boolean;
}) {
  // usePathname (rather than a pathname prop from the layout): the layout
  // is a shared Server Component that gets cached across client-side
  // navigations within the (app) group. The x-pathname header chain only
  // gives the value at the first layout render — subsequent navigations
  // leave the prop stale, pinning the sidebar's active state to whichever
  // route the user landed on first. usePathname re-runs on every
  // navigation, so isActive tracks the current route correctly.
  const pathname = usePathname() ?? "";

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeaderArea />

      <SidebarContent className="pt-0">
        {/* קבוצה 1 — לימוד (SPEC §7.0.1) */}
        <SidebarGroup>
          <SidebarGroupLabel className={SECTION_LABEL_CLS}>
            לימוד
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1.5">
            {NAV_LEARNING.map((item) => {
              const active = isPathActive(pathname, item.href);
              const { Icon } = item;
              return (
                <SidebarMenuItem key={item.href} className="relative">
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                    className={NAV_BUTTON_CLS}
                  >
                    <Icon strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {active ? <ActiveDot /> : null}
                  {active ? <ActiveBar /> : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* קבוצה 2 — המאגר שלי */}
        <SidebarGroup>
          <SidebarGroupLabel className={SECTION_LABEL_CLS}>
            המאגר שלי
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1.5">
            {NAV_LIBRARY.map((item) => {
              const active = isPathActive(pathname, item.href);
              const { Icon } = item;
              const count =
                item.countKey === "bookmarks"
                  ? bookmarksCount
                  : item.countKey === "mistakes"
                    ? mistakesCount
                    : notesCount;
              return (
                <SidebarMenuItem key={item.href} className="relative">
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={active}
                    className={NAV_BUTTON_CLS}
                  >
                    <Icon strokeWidth={1.5} />
                    <span>{item.label}</span>
                    {count > 0 ? (
                      <span className={COUNT_BADGE_CLS}>{count}</span>
                    ) : null}
                  </SidebarMenuButton>
                  {active ? <ActiveDot /> : null}
                  {active ? <ActiveBar /> : null}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Slice 12 — the standalone "סטטיסטיקה" nav block (linking to
            /statistics with the BarChart3 icon) lived here between the
            "המאגר שלי" group and the admin group. PM-removed; the
            page itself stays reachable by direct URL but no longer
            surfaces in the sidebar. */}

        {/* Slice 6 — admin nav. Renders only when the layout fetched
            profile.is_admin === true. */}
        {isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel className={SECTION_LABEL_CLS}>
              ניהול
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1.5">
              {(() => {
                const active = isPathActive(pathname, "/admin");
                return (
                  <SidebarMenuItem className="relative">
                    <SidebarMenuButton
                      render={<Link href="/admin" />}
                      isActive={active}
                      className={NAV_BUTTON_CLS}
                    >
                      <Shield strokeWidth={1.5} />
                      <span>ניהול</span>
                    </SidebarMenuButton>
                    {active ? <ActiveDot /> : null}
                    {active ? <ActiveBar /> : null}
                  </SidebarMenuItem>
                );
              })()}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {/* Phase 14b: pb-4 ensures the subscription card has breathing
          room on the mobile Sheet variant; shadcn pins the footer flex
          slot to the bottom but small-screen Safari sometimes clips
          the last few px when the URL bar collapses. */}
      <SidebarFooter className="pb-4">
        {subscription && <SubscriptionCard subscription={subscription} />}
        <UserAreaDropdown
          fullName={profileFullName}
          email={userEmail}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * Phase 9c B3: the "תרגול מהיר" CTA is gone. Sidebar header now hosts
 * the LawPass logo (gold wordmark + graduation cap). Hidden when the
 * sidebar is collapsed to the icon rail. Source: `public/lawpass-logo.png`
 * (1536×1024 transparent PNG; next/image handles optimization).
 */
function SidebarHeaderArea() {
  const { state } = useSidebar();
  if (state === "collapsed") {
    return <SidebarHeader />;
  }
  return (
    <SidebarHeader className="pb-0">
      <Link
        href="/dashboard"
        className="flex items-center justify-center px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
        aria-label="LawPass — חזרה לדשבורד"
      >
        <Image
          src="/lawpass-logo-v4.png"
          alt="LawPass"
          width={280}
          height={187}
          priority
          className="h-auto w-56"
        />
      </Link>
    </SidebarHeader>
  );
}

/**
 * Phase 9f — subscription card recolored for the navy sidebar.
 * Dark-navy gradient surface + gold accent radial in the corner +
 * gold label / gold progress fill. Same data wiring as before; only
 * the visual layer changes.
 *
 * `totalDays` derived from plan_type (no start_date column on the
 * subscriptions row). Width = daysRemaining / totalDays * 100 — bar
 * shrinks as the subscription wears down.
 */
function SubscriptionCard({
  subscription,
}: {
  subscription: NonNullable<SubscriptionData>;
}) {
  const endsAt = new Date(subscription.ends_at);
  const days = daysUntil(endsAt);
  const totalDays = PLAN_TOTAL_DAYS[subscription.plan_type] ?? Math.max(days, 1);
  const pct = Math.min(100, Math.max(0, (days / totalDays) * 100));
  const planLabel =
    PLAN_LABELS[subscription.plan_type] ?? subscription.plan_type;

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        background: "linear-gradient(160deg, #15243A 0%, #0F2A4A 100%)",
        padding: 14,
      }}
    >
      {/* Gold radial accent — top inline-end corner (visual top-left in RTL). */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          insetInlineEnd: -20,
          top: -20,
          width: 80,
          height: 80,
          background:
            "radial-gradient(circle, rgba(201,161,73,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative mb-2 flex items-baseline justify-between">
        <span
          style={{
            fontSize: 11,
            color: "rgba(201, 161, 73, 0.95)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          המנוי שלך
        </span>
        <span
          className="tabular-nums text-white"
          style={{ fontSize: 18, fontWeight: 700 }}
        >
          {days} ימים
        </span>
      </div>
      <div
        className="relative mb-2 h-1.5 overflow-hidden rounded-full"
        style={{ background: "rgba(255, 255, 255, 0.12)" }}
        aria-label={`${Math.round(pct)}% מהמנוי נותרו`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "#C9A149" }}
        />
      </div>
      <div
        className="relative flex justify-between"
        style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.70)" }}
      >
        <span>{planLabel}</span>
        <span className="tabular-nums">{formatDateHe(endsAt)}</span>
      </div>
    </div>
  );
}

/**
 * Phase 9c — typography bumped to keep parity with the larger nav text.
 * Name reads at `text-base` instead of `text-sm`; email keeps `text-xs`
 * for visual hierarchy.
 */
function UserAreaDropdown({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md p-2 text-start outline-none transition-colors",
          "hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30"
        )}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white/10 text-sm font-medium text-white"
          style={{ borderColor: "rgba(201, 161, 73, 0.4)" }}
        >
          {initials(fullName)}
        </div>
        <div className="flex min-w-0 flex-col items-start text-start">
          <div className="truncate text-base font-medium leading-tight text-white">
            {fullName}
          </div>
          <div
            className="truncate text-xs leading-tight text-white/60"
            dir="ltr"
          >
            {email}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--anchor-width)">
        <DropdownMenuItem render={<Link href="/account" />}>
          <Settings />
          <span>הגדרות</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            // Server Action: redirects to /login on success. Next handles
            // the navigation client-side. Promise resolution after redirect
            // is fine to ignore.
            await signOutAction();
          }}
        >
          <LogOut />
          <span>התנתק</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
