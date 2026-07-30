"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { grantMockSubscriptionAction } from "@/app/(app)/_actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { type Plan } from "@/lib/billing/plans";

/** Returns true if a thrown value is the NEXT_REDIRECT marker. Server Actions
 *  signal redirects by throwing this; we let it propagate to Next instead of
 *  surfacing a toast. */
function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

// Visual styling for the placeholder payment inputs. They're functionally
// `disabled` and `aria-hidden="true"` (no Tranzila yet — see _actions.ts
// TODO(slice-4)) but render so /checkout looks like a real payment screen
// during Slice 1 manual testing.
const DISABLED_INPUT_CLS =
  "bg-muted text-muted-foreground cursor-not-allowed";

export default function CheckoutScreen({ plan }: { plan: Plan }) {
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      const result = await grantMockSubscriptionAction(plan.id);
      // Server Action redirects /dashboard on success — throws NEXT_REDIRECT,
      // doesn't reach here. Only failure paths return ActionResult.
      if (result?.ok === false) {
        toast.error(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      if (!isNextRedirect(err)) {
        toast.error("אירעה שגיאה. נסה שוב");
        setSubmitting(false);
      }
      // NEXT_REDIRECT: re-throw so Next handles the navigation.
      throw err;
    }
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      <div className="mb-4">
        <Link
          href="/pricing"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← חזרה לבחירת תוכנית
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטי תשלום</CardTitle>
          <CardDescription>תשלום מאובטח</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Order summary box */}
          <div className="rounded-md border p-3">
            <div className="text-sm text-muted-foreground">סיכום הזמנה</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="font-medium">{plan.durationLabel}</div>
              <div className="text-lg font-semibold">
                {plan.totalPrice} ₪
              </div>
            </div>
          </div>

          <Separator />

          {/* Placeholder payment fields. All disabled + aria-hidden. The
              real Tranzila iframe will replace this block in Slice 4. */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="card-number">מספר כרטיס אשראי</Label>
              <Input
                id="card-number"
                type="text"
                placeholder="0000 0000 0000 0000"
                className={DISABLED_INPUT_CLS}
                disabled
                aria-hidden="true"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="cardholder">שם בעל הכרטיס</Label>
              <Input
                id="cardholder"
                type="text"
                placeholder="ישראל ישראלי"
                className={DISABLED_INPUT_CLS}
                disabled
                aria-hidden="true"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="expiry">תוקף</Label>
                <Input
                  id="expiry"
                  type="text"
                  placeholder="MM/YY"
                  className={DISABLED_INPUT_CLS}
                  disabled
                  aria-hidden="true"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="text"
                  placeholder="123"
                  className={DISABLED_INPUT_CLS}
                  disabled
                  aria-hidden="true"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="id-number">תעודת זהות</Label>
              <Input
                id="id-number"
                type="text"
                placeholder="9 ספרות"
                className={DISABLED_INPUT_CLS}
                disabled
                aria-hidden="true"
                dir="ltr"
              />
            </div>
          </div>

          <p className="text-xs italic text-muted-foreground">
            מסך זה הוא placeholder — תשלום אמיתי יחובר בהמשך הפיתוח
          </p>

          <Button
            type="button"
            className="w-full"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting
              ? "מפעיל..."
              : `שלם ${plan.totalPrice} ₪ והפעל את החשבון`}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            העסקה מאובטחת ב-SSL
          </p>

          {/* One-time payment, no renewal. SPEC §1.6 + PM clarification.
              TODO(slice-4): review exact wording when Tranzila integration
              finalizes. */}
          <p className="text-center text-xs leading-snug text-muted-foreground">
            בלחיצה על שלם, אני מאשר את תנאי המנוי. גישה למערכת תינתן לתקופת
            התוכנית בלבד.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
