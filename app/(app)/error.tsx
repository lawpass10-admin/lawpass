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
 * Route-group error boundary for /(app) — fires when a Server Component
 * page or layout throws within the authenticated app shell. Next.js 16
 * requires error boundaries be Client Components and accepts the standard
 * (error, reset) prop pair.
 *
 * The "חזור לדשבורד" CTA targets /dashboard rather than / because every
 * caller of this boundary is already authenticated (middleware would have
 * bounced unauthed users before they reached an (app) route).
 */
export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[error-boundary] (app) digest=${error.digest ?? "none"} message=${error.message}`
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
            אירעה שגיאה בטעינת הדף. נסה שוב או חזור לדשבורד.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={reset}>נסה שוב</Button>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            חזור לדשבורד
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
