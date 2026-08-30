"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { signInAction } from "@/lib/api/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { GoogleMark } from "@/components/shared/google-mark";
import { RequiredLegend } from "@/components/ui/required-legend";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

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

// Mobile-responsive sizing: inputs + buttons land at ≥44px tall on narrow
// widths (WCAG 2.5.5 touch-target spec) and shrink on md+.
const fieldClass =
  "h-11 md:h-10 text-base md:text-sm bg-white border-[var(--color-line)] " +
  "focus-visible:border-[var(--color-gold)] focus-visible:ring-[var(--color-gold)]/25";
const ctaClass = "h-11 md:h-10 w-full text-base md:text-sm";

/**
 * The login form itself — fields, the Google button, the link to signup.
 *
 * Deliberately WITHOUT a card, a heading, or anything that reads search
 * params: it is rendered both as the /login page (wrapped by <LoginForm>
 * below) and inside the dialog on /early-access, and those two want different
 * framing around the same eight controls. Keeping the shared part frameless is
 * what lets the second caller exist without a copy of the form.
 */
export function LoginFields({
  onSuccess,
}: {
  /** Called after a successful sign-in that did NOT redirect. The page form
   *  never needs this — the Server Action redirects — but a dialog does, so it
   *  can close itself. */
  onSuccess?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const result = await signInAction(values);
      // Server Action either redirects on success (throws NEXT_REDIRECT) or
      // returns { ok: false, error }. The redirect path doesn't reach here.
      if (result?.ok === false) {
        toast.error(result.error);
        setSubmitting(false);
        return;
      }
      onSuccess?.();
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
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <RequiredLegend />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>אימייל</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    dir="ltr"
                    className={fieldClass}
                    {...field}
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
                <FormLabel required>סיסמה</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    dir="ltr"
                    className={fieldClass}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-[var(--color-gold-deep)] hover:underline md:min-h-0"
            >
              שכחתי סיסמה
            </Link>
          </div>
          {/* The gold CTA the landing page uses for its primary action, so the
              button someone came here to press looks like the one they pressed
              to arrive. */}
          <Button
            type="submit"
            disabled={submitting}
            className={`btn-gold border-0 font-semibold ${ctaClass}`}
          >
            {submitting ? "מתחבר..." : "התחבר"}
          </Button>
        </form>
      </Form>

      {/* A labelled rule rather than a bare <Separator>: "או" tells the reader
          the two halves are alternatives, which a plain line only implies. */}
      <div className="my-6 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        <span className="text-xs font-medium text-[var(--color-ink-muted)]">
          או
        </span>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      <Button
        type="button"
        variant="outline"
        className={`${ctaClass} border-[var(--color-line-strong)] bg-white font-medium hover:bg-[var(--color-gold-tint)]`}
        disabled={oauthSubmitting}
        onClick={() => {
          // Navigate to the /auth/google Route Handler, which calls
          // signInWithOAuth server-side and returns NextResponse.redirect with
          // the PKCE verifier cookie attached. Server Actions delivered
          // Set-Cookie unreliably in Vercel production; a same-origin Route
          // Handler redirect is the reliable path.
          setOauthSubmitting(true);
          window.location.href = "/auth/google";
        }}
      >
        <GoogleMark className="size-4" />
        <span className="ms-2">
          {oauthSubmitting ? "מעביר ל-Google..." : "התחברות עם Google"}
        </span>
      </Button>

      <p className="mt-6 text-center text-sm text-[var(--color-ink-dim)]">
        אין לך חשבון?{" "}
        <Link
          href="/signup"
          className="inline-flex min-h-[44px] items-center font-semibold text-[var(--color-navy)] hover:underline md:min-h-0"
        >
          הרשמה
        </Link>
      </p>
    </>
  );
}

/**
 * /login — the form in its page framing, plus the two one-time toasts that
 * only the page can raise (they read query parameters that only ever land on
 * this route).
 */
export default function LoginForm() {
  const searchParams = useSearchParams();

  // Show a one-time success toast when /reset-password redirects here with
  // ?reset=1 (SPEC §6.5 step 6: "מועבר להתחברות מחדש").
  const resetFlashShown = useRef(false);
  useEffect(() => {
    if (searchParams.get("reset") === "1" && !resetFlashShown.current) {
      resetFlashShown.current = true;
      toast.success("הסיסמה עודכנה. התחבר עם הסיסמה החדשה");
    }
  }, [searchParams]);

  // Show a one-time error toast when /auth/callback bounces a failed OAuth
  // attempt back to /login?error=… (SPEC §6.2 edge cases). Discriminates on
  // the error code: cancel vs technical failure.
  const errorFlashShown = useRef(false);
  useEffect(() => {
    const error = searchParams.get("error");
    if (!error || errorFlashShown.current) return;
    errorFlashShown.current = true;
    switch (error) {
      case "oauth_cancelled":
        toast.error("ההרשמה לא הושלמה");
        break;
      case "oauth_failed":
      case "oauth_no_code":
        toast.error("התרחשה שגיאה. נסה שוב או הירשם עם מייל");
        break;
      default:
        toast.error("אירעה שגיאה. נסה שוב");
    }
  }, [searchParams]);

  return (
    <Card>
      <CardHeader className="pb-2 text-center">
        <CardTitle>התחברות</CardTitle>
        <p className="text-sm text-[var(--color-ink-dim)]">
          שמחים לראות אותך שוב
        </p>
      </CardHeader>
      <CardContent>
        <LoginFields />
      </CardContent>
    </Card>
  );
}
