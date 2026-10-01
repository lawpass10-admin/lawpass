import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The two ways past the waitlist, for people who already have an account or
 * are ready to open one.
 *
 * Sits under the waitlist form rather than beside it, behind its own rule and
 * a line of copy: the page's job is still to collect an address from a visitor
 * who cannot get in yet, and putting these two at the same weight as the
 * waitlist would turn the primary action into a choice of three.
 *
 * BOTH NAVIGATE. Login opened a dialog here until now, on the reasoning that
 * signing in is two fields and ends where the visitor already is — but this
 * page is reached from the landing header by someone who has just said they
 * want their account, so arriving at a page that stays put while a box appears
 * over it is the odd outcome, not the saved page load. Two links that behave
 * alike also mean the choice reads as a choice: same shape, same weight, one
 * decision.
 *
 * /login is a page in its own right regardless: it is where the proxy sends
 * anyone who reaches a protected route without a session, and where the
 * password-reset flow returns to.
 */
export function AuthEntry() {
  return (
    <div className="mt-10 w-full max-w-md">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-xs font-medium text-white/50">
          כבר יש לך חשבון?
        </span>
        <span className="h-px flex-1 bg-white/15" />
      </div>

      {/* nativeButton={false} because the render prop supplies an <a>, not a
          <button> — without it Base UI keeps the native button semantics and
          warns that they no longer match the element. */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          nativeButton={false}
          render={<Link href="/login" />}
          // Outline on navy: the ghost/outline defaults are tuned for a light
          // ground and would come out as dark-on-dark here.
          className="h-11 flex-1 border border-white/25 bg-white/5 text-base font-semibold text-white hover:border-white/40 hover:bg-white/10"
        >
          התחברות
        </Button>
        <Button
          nativeButton={false}
          render={<Link href="/signup" />}
          className="btn-gold h-11 flex-1 border-0 text-base font-semibold"
        >
          הרשמה
        </Button>
      </div>
    </div>
  );
}
