"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Route-group error boundary for /(auth) — fires when a sign-up / login /
 * verify-email / reset-password page or layout throws. The user at this
 * point is not authenticated, so the secondary CTA returns them to /login
 * rather than the dashboard.
 */
export default function AuthGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[error-boundary] (auth) digest=${error.digest ?? "none"} message=${error.message}`
      );
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
          </div>
          <CardTitle className="text-xl">משהו השתבש</CardTitle>
          <CardDescription>
            אירעה שגיאה. נסה שוב או חזור למסך ההתחברות.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={reset}>נסה שוב</Button>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            חזור להתחברות
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
