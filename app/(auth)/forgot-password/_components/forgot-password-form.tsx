"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestPasswordResetAction } from "@/app/(auth)/_actions";
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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validators/auth";

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

export default function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setSubmitting(true);
    try {
      const result = await requestPasswordResetAction(values);
      // requestPasswordResetAction always redirects to /reset-password on
      // valid input (anti-enumeration — same response for known and unknown
      // emails per SPEC §6.5). The only return path here is { ok: false }
      // for malformed input that failed Zod parse.
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
    <Card>
      <CardHeader>
        <CardTitle className="text-center">שכחתי סיסמה</CardTitle>
        <CardDescription className="text-center">
          הזן את כתובת המייל שלך — נשלח אליך קוד לאיפוס הסיסמה
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אימייל</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      dir="ltr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "שולח..." : "שלח קוד"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            חזרה להתחברות
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
