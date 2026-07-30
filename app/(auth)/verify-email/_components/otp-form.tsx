"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resendOtpAction, verifyOtpAction } from "@/lib/api/auth";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { otpSchema } from "@/lib/validators/auth";

const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

/**
 * Masks an email like "alice@example.com" → "a****@example.com" for display
 * on the OTP entry screen. Keeps the first character of the local part and
 * the domain visible. Leaves the email untouched if it doesn't have a
 * recognizable @ separator.
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

export default function OtpForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Start in cooldown — the signup that brought the user here just sent an
  // OTP. Server-side cooldown is enforced by resendOtpAction's HttpOnly
  // 'lawpass_otp_resend_lock' cookie regardless of this client value.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  // Best-effort UI counter. SPEC §6.3 + §12.2.4 specify a 5-attempt /
  // 15-minute lockout; that's deferred to slice-7 with custom DB tracking.
  // For Phase 3 this is purely informational — Supabase's built-in rate
  // limits do the actual throttling.
  const [attempts, setAttempts] = useState(0);

  const form = useForm<{ token: string }>({
    resolver: zodResolver(otpSchema.pick({ token: true })),
    mode: "onTouched",
    defaultValues: { token: "" },
  });

  // Tick the resend cooldown down every second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Defensive — if the user landed here without an email search param
  // (bookmark / refresh after the cookie expired / direct URL), there's
  // nothing we can do. Send them back to signup.
  if (!email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">קישור לא תקין</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            לא נמצאה כתובת מייל לאימות. נסה להירשם שוב.
          </p>
          <Link
            href="/signup"
            className={cn(buttonVariants(), "w-full")}
          >
            חזרה להרשמה
          </Link>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(values: { token: string }) {
    setSubmitting(true);
    // Server Action returns { ok: true, url } or { ok: false, error }. We
    // navigate via window.location instead of having the action redirect
    // because a Server-Action-initiated RSC redirect chain (action →
    // /dashboard → layout-redirect → /pricing) was racing with
    // revalidatePath in production and rendering /pricing empty on first
    // paint. A full page load eliminates the chain.
    const result = await verifyOtpAction({ email, token: values.token });
    if (!result.ok) {
      setAttempts((a) => a + 1);
      toast.error(result.error);
      form.setError("token", { message: result.error });
      setSubmitting(false);
      return;
    }
    // .assign() is functionally equivalent to `window.location.href = ...`
    // but the property-assignment form trips react-hooks/immutability
    // when used inside a function declaration in the component body.
    window.location.assign(result.url);
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const result = await resendOtpAction({ email });
      if (result.ok) {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        // Reset the attempt counter — fresh code, fresh budget.
        setAttempts(0);
        form.clearErrors("token");
        form.reset({ token: "" });
        toast.success("נשלח קוד חדש למייל");
      } else {
        toast.error(result.error);
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">אימות מייל</CardTitle>
        <CardDescription className="text-center">
          שלחנו קוד בן 6 ספרות למייל
          <br />
          <span className="font-medium text-foreground" dir="ltr">
            {maskEmail(email)}
          </span>
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

            {attempts > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                ניסיון {Math.min(attempts, MAX_ATTEMPTS)} מתוך {MAX_ATTEMPTS}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "מאמת..." : "אמת והמשך"}
            </Button>
          </form>
        </Form>

        <div className="mt-4 space-y-1 text-center">
          <Button
            type="button"
            variant="link"
            disabled={cooldown > 0 || resending}
            onClick={handleResend}
            className="h-auto p-0 text-sm"
          >
            {cooldown > 0
              ? `שלח קוד חדש בעוד ${cooldown} שניות`
              : resending
                ? "שולח..."
                : "שלח קוד חדש"}
          </Button>
          <p className="text-xs text-muted-foreground">
            לא קיבלת? בדוק בתיקיית הספאם
          </p>
        </div>

        <Separator className="my-6" />

        <p className="text-center text-sm text-muted-foreground">
          טעות בהרשמה?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            חזרה להרשמה
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
