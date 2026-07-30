"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { signOutAction } from "@/app/(auth)/_actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * /account section 4 — Log out.
 *
 * Reuses signOutAction (same action the sidebar dropdown calls). The
 * server action redirects to /login on success, so the success path
 * never returns; we only handle the ActionResult on failure.
 */
export default function LogoutButton() {
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    try {
      const result = await signOutAction();
      // Redirect throws NEXT_REDIRECT and never reaches here; the
      // explicit failure branch is defensive in case the action ever
      // grows a non-throwing failure path.
      if (result && result.ok === false) {
        toast.error(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      // NEXT_REDIRECT is Next's signal for a server-action redirect —
      // let it propagate so the navigation happens. Anything else is a
      // real failure worth surfacing.
      if (
        typeof err === "object" &&
        err !== null &&
        "digest" in err &&
        typeof (err as { digest?: unknown }).digest === "string" &&
        (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      toast.error("אירעה שגיאה. נסה שוב");
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>התנתקות</CardTitle>
        <CardDescription>
          ההתנתקות תסיים את ההפעלה ותחזיר אותך למסך ההתחברות.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="destructive"
          onClick={handleClick}
          disabled={submitting}
          className="h-10 px-5"
        >
          <LogOut />
          <span>{submitting ? "מתנתק..." : "התנתק"}</span>
        </Button>
      </CardContent>
    </Card>
  );
}
