"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bug, Copy, KeyRound, LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  adminEditProfileNameAction,
  adminForceSignOutAction,
  adminSendPasswordResetAction,
  adminSetQaTesterAction,
} from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { fullNameSchema } from "@/lib/validators/auth";

const editSchema = z.object({ full_name: fullNameSchema });
type EditInput = z.infer<typeof editSchema>;

async function copyToClipboard(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} הועתק`);
  } catch {
    toast.error("ההעתקה נכשלה");
  }
}

export default function UserActions({
  userId,
  currentFullName,
  email,
  isSelf,
  isQaTester,
}: {
  userId: string;
  currentFullName: string;
  email: string | null;
  isSelf: boolean;
  /** Slice 10 Phase B-2 — drives the QA-tester toggle row. */
  isQaTester: boolean;
}) {
  const [resetPending, startResetTransition] = useTransition();
  const [signOutPending, startSignOutTransition] = useTransition();
  const [qaPending, startQaTransition] = useTransition();
  // Optimistic local mirror so the button label flips immediately on
  // click; reverted from the server response when the action fails.
  const [qaTesterLocal, setQaTesterLocal] = useState(isQaTester);

  function handleSendPasswordReset() {
    startResetTransition(async () => {
      const result = await adminSendPasswordResetAction({ userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("מייל איפוס סיסמה נשלח");
    });
  }

  function handleToggleQaTester() {
    if (qaPending) return;
    const next = !qaTesterLocal;
    setQaTesterLocal(next);
    startQaTransition(async () => {
      const result = await adminSetQaTesterAction({
        userId,
        isQaTester: next,
      });
      if (!result.ok) {
        setQaTesterLocal(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "המשתמש סומן כבודק QA" : "סימון בודק QA הוסר");
    });
  }

  function handleForceSignOut() {
    // No alert/confirm DOM dialog — sonner-only flow. The action itself
    // refuses to sign out the current admin, so we surface that too.
    const confirmed = window.confirm(
      "לנתק את כל ההפעלות של המשתמש? פעולה זו תאלץ אותו להיכנס מחדש."
    );
    if (!confirmed) return;
    startSignOutTransition(async () => {
      const result = await adminForceSignOutAction({ userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("המשתמש נותק");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>פעולות אדמין</CardTitle>
        <CardDescription>
          כל פעולה מתועדת ב-admin_actions_log.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <EditNameForm
          userId={userId}
          currentFullName={currentFullName}
        />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">פעולות אבטחה</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSendPasswordReset}
              disabled={resetPending || !email}
              className="h-9"
            >
              <KeyRound />
              <span>
                {resetPending ? "שולח..." : "שלח מייל איפוס סיסמה"}
              </span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleForceSignOut}
              disabled={signOutPending || isSelf}
              className="h-9"
              title={
                isSelf
                  ? "לא ניתן לנתק את עצמך מכאן"
                  : undefined
              }
            >
              <LogOut />
              <span>
                {signOutPending ? "מנתק..." : "אלץ ניתוק (sign-out)"}
              </span>
            </Button>
          </div>
          {isSelf ? (
            <p className="text-xs text-muted-foreground">
              להתנתקות אישית השתמש בכפתור בסרגל הצד.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">הרשאות</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={qaTesterLocal ? "destructive" : "outline"}
              onClick={handleToggleQaTester}
              disabled={qaPending}
              className="h-9"
            >
              <Bug />
              <span>
                {qaPending
                  ? "מעדכן..."
                  : qaTesterLocal
                    ? "הסר בודק QA"
                    : "סמן כבודק QA"}
              </span>
            </Button>
            <span className="text-xs text-muted-foreground">
              {qaTesterLocal
                ? "המשתמש רואה את כפתור הדיווח בכל דף."
                : "המשתמש לא רואה את כפתור הדיווח."}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">העתקת מזהים</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => copyToClipboard(userId, "המזהה")}
              className="h-9"
            >
              <Copy />
              <span>העתק מזהה משתמש</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                email
                  ? copyToClipboard(email, "האימייל")
                  : toast.error("אין אימייל להעתיק")
              }
              disabled={!email}
              className="h-9"
            >
              <Copy />
              <span>העתק אימייל</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditNameForm({
  userId,
  currentFullName,
}: {
  userId: string;
  currentFullName: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EditInput>({
    resolver: zodResolver(editSchema),
    mode: "onTouched",
    defaultValues: { full_name: currentFullName },
  });

  async function onSubmit(values: EditInput) {
    setSubmitting(true);
    const result = await adminEditProfileNameAction({
      userId,
      full_name: values.full_name,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("השם עודכן");
    form.reset(values);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">עריכת שם תצוגה</h3>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          noValidate
        >
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="text-xs">שם מלא</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={submitting}
            className="h-9 px-4"
          >
            {submitting ? "שומר..." : "שמור"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
