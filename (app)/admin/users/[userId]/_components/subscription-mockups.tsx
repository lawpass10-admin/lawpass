"use client";

import { Info, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminUserDetail } from "@/lib/db/admin";

/**
 * Slice 7 mockup section — three buttons next to the active-sub field
 * on /admin/users/[userId]. UI-only. No server actions, no DB writes.
 * Each dialog has a yellow "תכונה זו תהיה זמינה כשנחבר סליקה" banner
 * and a disabled primary button (or one that just toasts "mockup").
 */

const PLAN_LABEL: Record<string, string> = {
  "3_months": "3 חודשים",
  "6_months": "6 חודשים",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ninetyDaysOutIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

function MockupBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
    >
      <Info className="size-4 shrink-0" aria-hidden />
      <span>תכונה זו תהיה זמינה כשנחבר סליקה.</span>
    </div>
  );
}

export default function SubscriptionMockups({
  activeSubscription,
}: {
  activeSubscription: AdminUserDetail["activeSubscription"];
}) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">ניהול מנוי</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setGrantOpen(true)}
          className="h-9"
        >
          <Sparkles />
          <span>הענק מנוי</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCancelOpen(true)}
          disabled={!activeSubscription}
          className="h-9"
          title={!activeSubscription ? "אין מנוי פעיל לבטל" : undefined}
        >
          <XCircle />
          <span>בטל מנוי</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSwitchOpen(true)}
          disabled={!activeSubscription}
          className="h-9"
          title={!activeSubscription ? "אין מנוי פעיל להחליף" : undefined}
        >
          <RefreshCw />
          <span>החלף תוכנית</span>
        </Button>
      </div>

      <GrantDialog open={grantOpen} onOpenChange={setGrantOpen} />
      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        activeSubscription={activeSubscription}
      />
      <SwitchDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        activeSubscription={activeSubscription}
      />
    </div>
  );
}

// =============================================================================
// Grant dialog
// =============================================================================

function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function GrantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [planType, setPlanType] = useState<string>("3_months");
  const [startsAt, setStartsAt] = useState<string>(todayIso());
  const [notes, setNotes] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הענקת מנוי</DialogTitle>
          <DialogDescription>
            מילוי הטופס כאן לא יבצע עדיין שינוי בפועל.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <MockupBanner />
          <FieldRow label="תוכנית" htmlFor="mockup-grant-plan">
            <Select value={planType} onValueChange={(v) => setPlanType(v ?? "")}>
              <SelectTrigger id="mockup-grant-plan">
                <SelectValue placeholder="בחר תוכנית" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3_months">3 חודשים</SelectItem>
                <SelectItem value="6_months">6 חודשים</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="תאריך התחלה" htmlFor="mockup-grant-start">
            <Input
              id="mockup-grant-start"
              type="date"
              dir="ltr"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </FieldRow>
          <FieldRow label="הערות (פנימי)" htmlFor="mockup-grant-notes">
            <Textarea
              id="mockup-grant-notes"
              dir="auto"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: ניסיון 30 יום"
            />
          </FieldRow>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            סגור
          </Button>
          <Button
            type="button"
            disabled
            className="btn-gold h-10 rounded-full px-6 font-heebo font-semibold"
            title="mockup — יתחבר לסליקה בעתיד"
          >
            הענק
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Cancel dialog
// =============================================================================

function CancelDialog({
  open,
  onOpenChange,
  activeSubscription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeSubscription: AdminUserDetail["activeSubscription"];
}) {
  const [reason, setReason] = useState<string>("");
  const planLabel = activeSubscription
    ? PLAN_LABEL[activeSubscription.planType] ?? activeSubscription.planType
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ביטול מנוי</DialogTitle>
          <DialogDescription>
            פעולה זו תסיים את המנוי הנוכחי באופן מיידי (כשהפיצ&apos;ר יחובר).
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <MockupBanner />
          <div className="rounded-md border border-[var(--color-line)] bg-card p-3 text-sm">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
              המנוי הנוכחי
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span>{planLabel}</span>
              <span className="text-xs text-muted-foreground">
                עד {fmtDate(activeSubscription?.endsAt ?? null)}
              </span>
            </div>
          </div>
          <FieldRow label="סיבה (פנימי)" htmlFor="mockup-cancel-reason">
            <Textarea
              id="mockup-cancel-reason"
              dir="auto"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ביטול לבקשת המשתמש, החזר וכו'"
            />
          </FieldRow>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            סגור
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled
            className="h-10 px-6"
            title="mockup — יתחבר לסליקה בעתיד"
          >
            בטל
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Switch dialog
// =============================================================================

function SwitchDialog({
  open,
  onOpenChange,
  activeSubscription,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activeSubscription: AdminUserDetail["activeSubscription"];
}) {
  const currentPlan = activeSubscription?.planType ?? "3_months";
  const defaultNextPlan = currentPlan === "3_months" ? "6_months" : "3_months";
  const [planType, setPlanType] = useState<string>(defaultNextPlan);
  const [endsAt, setEndsAt] = useState<string>(ninetyDaysOutIso());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>החלפת תוכנית</DialogTitle>
          <DialogDescription>
            החלפה תחליף את התוכנית הנוכחית (כשהפיצ&apos;ר יחובר).
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <MockupBanner />
          <div className="rounded-md border border-[var(--color-line)] bg-card p-3 text-sm">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
              נכון לעכשיו
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span>{PLAN_LABEL[currentPlan] ?? currentPlan}</span>
              <span className="text-xs text-muted-foreground">
                עד {fmtDate(activeSubscription?.endsAt ?? null)}
              </span>
            </div>
          </div>
          <FieldRow label="תוכנית חדשה" htmlFor="mockup-switch-plan">
            <Select value={planType} onValueChange={(v) => setPlanType(v ?? "")}>
              <SelectTrigger id="mockup-switch-plan">
                <SelectValue placeholder="בחר תוכנית" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3_months">3 חודשים</SelectItem>
                <SelectItem value="6_months">6 חודשים</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="תאריך סיום חדש" htmlFor="mockup-switch-ends">
            <Input
              id="mockup-switch-ends"
              type="date"
              dir="ltr"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </FieldRow>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            סגור
          </Button>
          <Button
            type="button"
            disabled
            className="btn-gold h-10 rounded-full px-6 font-heebo font-semibold"
            title="mockup — יתחבר לסליקה בעתיד"
          >
            החלף
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
