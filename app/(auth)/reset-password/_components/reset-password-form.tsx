"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resetPasswordAction } from "@/lib/api/auth";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
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

/**
 * Masks an email like "alice@example.com" → "a****@example.com" so the user
 * sees which inbox they need to check without exposing the full address on
 * a possibly-shared screen. Mirrors the helper in /verify-email's OtpForm.
 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 1) return `${local}${domain}`;
  const stars = "*".repeat(Math.min(local.length - 1, 4));
  return `${local[0]}${stars}${domain}`;
}

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onTouched",
    defaultValues: {
      email,
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Defensive — if the user landed here without an email search param
  // (bookmark / refresh after the cookie expired / direct URL), there's
  // nothing we can do. Send them back to /forgot-password to start over.
  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">קישור לא תקין</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            לא נמצאה כתובת מייל לאיפוס. נסה לבקש קוד חדש.
          </p>
          <Link
            href="/forgot-password"
            className={cn(buttonVariants(), "w-full")}
          >
            חזרה לשכחתי סיסמה
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(values: ResetPasswordInput) {
    setSubmitting(true);
    try {
      const result = await resetPasswordAction(values);
      // Server Action either redirects on success (throws NEXT_REDIRECT to
      // /login?reset=1) or returns { ok: false, error }. The redirect path
      // doesn't reach here.
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
        <CardTitle className="text-center">איפוס סיסמה</CardTitle>
        <CardDescription className="text-center">
          הזן את הקוד שנשלח למייל
          <br />
          <span className="font-medium text-foreground" dir="ltr">
            {maskEmail(email)}
          </span>
          <br />
          ובחר סיסמה חדשה
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
          >
            {/* Hidden email field — bound to URL param, included in the
                submitted payload so resetPasswordAction's Zod check has it. */}
            <input type="hidden" {...form.register("email")} value={email} />

            <FormField
              control={form.control}
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>קוד אימות</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      dir="ltr"
                      placeholder="123456"
                      className="text-center font-mono text-2xl tracking-[0.4em]"
                      {...field}
                      onChange={(e) => {
                        // OTPs are numeric only — strip anything else so the
                        // browser autofill of mixed input doesn't trip the
                        // schema's regex.
                        field.onChange(e.target.value.replace(/\D/g, ""));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סיסמה חדשה</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      dir="ltr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אישור סיסמה חדשה</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      dir="ltr"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "מעדכן..." : "אפס סיסמה"}
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
