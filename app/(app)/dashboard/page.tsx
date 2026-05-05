import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getHebrewGreeting } from "@/lib/greetings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * /dashboard — Slice-1 dashboard. Server Component.
 *
 * Real data shown: time-of-day Hebrew greeting + user's full_name + today's
 * date; subscription card; exam countdown card (or CTA to set the date).
 *
 * Empty states (UI structure shown, no fake numbers): 4 KPI cards rendering
 * "—" placeholders, trend chart with SPEC §6 / §7.6.1 copy, chapter mastery
 * placeholder line.
 *
 * Hidden until practice data exists (Slice 2+): "המשך מאיפה שעצרת" 3 action
 * cards and the 3 weak chapters block from SPEC §7.1.
 *
 * Note: profile + subscription queries here run in addition to the same
 * queries in (app)/layout.tsx. React/Next dedupe via the request-scoped
 * cache so the second invocation is free (no extra round-trip).
 */

const KPI_CARDS = [
  { title: "שאלות שתורגלו" },
  { title: "אחוז הצלחה" },
  { title: "זמן ממוצע לשאלה" },
  { title: "סימולציות" },
] as const;

const PLAN_LABELS: Record<string, string> = {
  "3_months": "תוכנית 3 חודשים",
  "6_months": "תוכנית 6 חודשים",
};

function daysUntil(future: Date, now: Date = new Date()): number {
  const ms = future.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatDateHe(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * "{day_of_week} · {date}" — e.g. "יום שלישי · 5 במאי 2026". Two separate
 * Intl calls + manual concat: gives consistent " · " separator across
 * Node/locale variants (Intl's default he-IL combination uses a comma).
 */
function formatDateHeLong(d: Date): string {
  const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(
    d
  );
  const date = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return `${weekday} · ${date}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Defensive — (app)/layout.tsx already redirects unauthed / missing
  // profile / missing subscription users. These returns are unreachable in
  // normal flow but keep TS happy + cover a race-condition gap.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, exam_date_planned")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding/complete-profile");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_type, ends_at, created_at")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();
  if (!subscription) redirect("/pricing");

  const greeting = getHebrewGreeting();
  const today = new Date();
  const todayLong = formatDateHeLong(today);

  const subscriptionEndsAt = new Date(subscription.ends_at);
  const subscriptionDays = daysUntil(subscriptionEndsAt);
  const planLabel =
    PLAN_LABELS[subscription.plan_type] ?? subscription.plan_type;

  const examDate = profile.exam_date_planned
    ? new Date(profile.exam_date_planned)
    : null;
  const examDays = examDate ? daysUntil(examDate) : null;

  return (
    <div className="space-y-6">
      {/* 1. Greeting card — full width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {greeting}, {profile.full_name}
          </CardTitle>
          <CardDescription>{todayLong}</CardDescription>
        </CardHeader>
      </Card>

      {/* 2. Subscription + Exam row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">המנוי שלך</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold">
              {subscriptionDays} ימים נותרו
            </div>
            <div className="text-sm text-muted-foreground">{planLabel}</div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            עד {formatDateHe(subscriptionEndsAt)}
          </CardFooter>
        </Card>

        {examDate && examDays !== null ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">הבחינה שלך</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{examDays} ימים</div>
              <div className="text-sm text-muted-foreground">
                {formatDateHeLong(examDate)}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">תאריך הבחינה</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">טרם נקבע תאריך</p>
            </CardContent>
            <CardFooter>
              <Link
                href="/account"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                קבע תאריך בחינה
              </Link>
            </CardFooter>
          </Card>
        )}
      </div>

      {/* 3. KPI cards row — empty state */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl text-muted-foreground">—</div>
              <div className="text-xs text-muted-foreground">התחל לתרגל</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 4. Trend chart card — empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">מגמת הצלחה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp
              className="size-8 text-muted-foreground/50"
              aria-hidden
            />
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              עוד לא תרגלת. התחל את הסשן הראשון שלך כדי לראות את ההתקדמות
              שלך כאן
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 5. Chapter mastery card — empty state */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">שליטה לפי פרק</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <p className="text-sm text-muted-foreground">
              פירוק לפי נושא יוצג לאחר תחילת התרגול
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
