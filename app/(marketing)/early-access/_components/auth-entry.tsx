"use client";

import Link from "next/link";
import { useState } from "react";

import { LoginFields } from "@/app/(auth)/login/_components/login-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The two ways past the waitlist, for people who already have an account or
 * are ready to open one.
 *
 * Sits under the waitlist form rather than beside it, behind its own rule and
 * a line of copy: the page's job is still to collect an address from a visitor
 * who cannot get in yet, and putting these two at the same weight as the
 * waitlist would turn the primary action into a choice of three.
 *
 * LOGIN OPENS A DIALOG; REGISTRATION NAVIGATES. Signing in is two fields and
 * ends where the visitor already is — sending them to another page to type an
 * address they know by heart is a page load for nothing. Registration is a
 * three-step form with its own progress and its own back button, and that
 * wants a page. /login still exists as a page regardless: it is where the
 * middleware sends anyone who reaches a protected route without a session, and
 * where the password-reset flow returns to.
 */
export function AuthEntry() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <div className="mt-10 w-full max-w-md">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-xs font-medium text-white/50">
          כבר יש לך חשבון?
        </span>
        <span className="h-px flex-1 bg-white/15" />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={() => setLoginOpen(true)}
          // Outline on navy: the ghost/outline defaults are tuned for a light
          // ground and would come out as dark-on-dark here.
          className="h-11 flex-1 border border-white/25 bg-white/5 text-base font-semibold text-white hover:border-white/40 hover:bg-white/10"
        >
          התחברות
        </Button>
        {/* nativeButton={false} because the render prop supplies an <a>, not a
            <button> — without it Base UI keeps the native button semantics and
            warns that they no longer match the element. */}
        <Button
          nativeButton={false}
          render={<Link href="/signup" />}
          className="btn-gold h-11 flex-1 border-0 text-base font-semibold"
        >
          הרשמה
        </Button>
      </div>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="font-heebo text-[22px] font-extrabold tracking-tight text-[var(--color-navy-ink)]">
              התחברות
            </DialogTitle>
            <p className="text-sm text-[var(--color-ink-dim)]">
              שמחים לראות אותך שוב
            </p>
          </DialogHeader>
          {/* Mounted only while open so the form starts empty each time and a
              half-typed password does not survive a close. */}
          {loginOpen ? <LoginFields onSuccess={() => setLoginOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
