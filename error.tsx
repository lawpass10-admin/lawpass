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
 * Top-level error boundary — catches anything not handled by a route-group
 * error boundary (e.g., errors thrown by the marketing layout / root layout
 * children or by a route outside (app)/(auth)/(marketing)). Per Next.js 16
 * conventions, the boundary itself is a Client Component receiving
 * (error, reset).
 *
 * The secondary CTA targets / (marketing landing) because at the root
 * level we cannot assume the user is authenticated.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[error-boundary] root digest=${error.digest ?? "none"} message=${error.message}`
      );
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
          </div>
          <CardTitle className="text-xl">משהו השתבש</CardTitle>
          <CardDescription>
            אירעה שגיאה. נסה שוב או חזור לדף הבית.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={reset}>נסה שוב</Button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            חזור לדף הבית
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
