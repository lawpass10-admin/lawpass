"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { signInAction } from "@/app/(auth)/_actions";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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

export default function LoginForm() {
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
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

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
    },
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
        <CardTitle className="text-center">התחברות</CardTitle>
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סיסמה</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      dir="ltr"
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
                className="text-sm text-primary hover:underline"
              >
                שכחתי סיסמה
              </Link>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "מתחבר..." : "התחבר"}
            </Button>
          </form>
        </Form>

        <Separator className="my-6" />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={oauthSubmitting}
          onClick={() => {
            // Navigate to the /auth/google Route Handler, which calls
            // signInWithOAuth server-side and returns NextResponse.redirect
            // with the PKCE verifier cookie attached. Server Actions
            // delivered Set-Cookie unreliably in Vercel production; a
            // same-origin Route Handler redirect is the reliable path.
            setOauthSubmitting(true);
            window.location.href = "/auth/google";
          }}
        >
          {oauthSubmitting ? "מעביר ל-Google..." : "התחברות עם Google"}
        </Button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          אין לך חשבון?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            הרשם
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
