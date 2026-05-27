import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SubscriptionData = {
  plan_type: string;
  ends_at: string; // ISO timestamp
} | null;

// Mirrors components/app/app-sidebar.tsx so plan labels and progress stay
// consistent between the sidebar card and the settings card. Kept locally
// (vs. exported from a shared module) because Slice 4's Tranzila work is
// expected to fold both into a richer SubscriptionCard component anyway.
const PLAN_LABELS: Record<string, string> = {
  "3_months": "תוכנית 3 חודשים",
  "6_months": "תוכנית 6 חודשים",
};

const PLAN_TOTAL_DAYS: Record<string, number> = {
  "3_months": 90,
  "6_months": 180,
};

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

/**
 * /account section 3 — DISPLAY ONLY. Upgrade flow is deferred to a
 * future slice (waiting on a payment provider); intentionally no CTA,
 * no link to /pricing.
 */
export default function SubscriptionStatus({
  subscription,
}: {
  subscription: SubscriptionData;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>המנוי שלי</CardTitle>
        <CardDescription>סטטוס המנוי הנוכחי שלך.</CardDescription>
      </CardHeader>
      <CardContent>
        {subscription ? (
          <ActiveSubscription subscription={subscription} />
        ) : (
          <p className="text-sm text-muted-foreground">אין מנוי פעיל</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveSubscription({
  subscription,
}: {
  subscription: NonNullable<SubscriptionData>;
}) {
  const endsAt = new Date(subscription.ends_at);
  const days = daysUntil(endsAt);
  const totalDays =
    PLAN_TOTAL_DAYS[subscription.plan_type] ?? Math.max(days, 1);
  const pct = Math.min(100, Math.max(0, (days / totalDays) * 100));
  const planLabel =
    PLAN_LABELS[subscription.plan_type] ?? subscription.plan_type;

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{
        background: "linear-gradient(160deg, #15243A 0%, #0F2A4A 100%)",
        padding: 18,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          insetInlineEnd: -20,
          top: -20,
          width: 96,
          height: 96,
          background:
            "radial-gradient(circle, rgba(201,161,73,0.18) 0%, transparent 70%)",
        }}
      />
      <div className="relative mb-2 flex items-baseline justify-between">
        <span
          style={{
            fontSize: 12,
            color: "rgba(201, 161, 73, 0.95)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {planLabel}
        </span>
        <span
          className="tabular-nums text-white"
          style={{ fontSize: 22, fontWeight: 700 }}
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
        style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.70)" }}
      >
        <span>בתוקף עד</span>
        <span className="tabular-nums">{formatDateHe(endsAt)}</span>
      </div>
    </div>
  );
}
