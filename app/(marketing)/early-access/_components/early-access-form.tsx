"use client";

import { useState, type FormEvent } from "react";

import { submitWaitlist } from "@/app/(marketing)/early-access/_actions";

/**
 * Slice 43 — /early-access waitlist form.
 *
 * State machine (single field, single submit, one round-trip):
 *   idle        → user typing
 *   submitting  → action in flight; submit disabled, label swaps to "שולחים…"
 *   success     → replaces the form with a thank-you block; no second submit
 *   error_email → inline "כתובת אימייל לא תקינה"; field stays editable
 *   error_db    → inline "אירעה שגיאה. נסו שוב בעוד רגע."; field stays editable
 *
 * Both success branches (true first submit AND duplicate caught by 23505)
 * land in the same `success` state — the action collapses them on purpose so
 * we don't leak membership.
 */

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error_email" }
  | { kind: "error_db" };

export function EarlyAccessForm({ source }: { source: string | null }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Native HTML `required` + `type="email"` give a free pass at the form-
  // submission layer, but the action's Zod schema is the load-bearing check.
  // The client-side trim/lowercase mirrors the server's normalization so the
  // local UX matches whatever ends up in the DB.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "submitting" || status.kind === "success") return;
    setStatus({ kind: "submitting" });
    const normalized = email.trim().toLowerCase();
    const result = await submitWaitlist({ email: normalized, source });
    if (result.ok) {
      setStatus({ kind: "success" });
      return;
    }
    setStatus({
      kind: result.error === "invalid_email" ? "error_email" : "error_db",
    });
  }

  if (status.kind === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border px-6 py-7 text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderColor: "rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.92)",
        }}
      >
        <p className="font-heebo text-lg font-semibold sm:text-xl">
          תודה! נעדכן אתכם באימייל.
        </p>
      </div>
    );
  }

  const submitting = status.kind === "submitting";
  const showEmailError = status.kind === "error_email";
  const showDbError = status.kind === "error_db";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:gap-2"
    >
      <label htmlFor="early-access-email" className="sr-only">
        כתובת אימייל
      </label>
      <input
        id="early-access-email"
        type="email"
        required
        autoComplete="email"
        dir="ltr"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          // Reset any stale error once the user starts editing again so the
          // inline message doesn't linger across keystrokes.
          if (showEmailError || showDbError) setStatus({ kind: "idle" });
        }}
        disabled={submitting}
        aria-invalid={showEmailError ? true : undefined}
        aria-describedby={
          showEmailError
            ? "early-access-error-email"
            : showDbError
              ? "early-access-error-db"
              : undefined
        }
        className="flex-1 rounded-full border px-5 text-base outline-none transition-colors sm:text-[15px]"
        style={{
          height: "48px",
          background: "rgba(255,255,255,0.05)",
          borderColor: "rgba(255,255,255,0.18)",
          color: "#fff",
        }}
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 items-center justify-center rounded-full px-7 text-base font-bold transition-[filter,transform] duration-200 hover:brightness-105 hover:-translate-y-0.5 sm:h-12 sm:min-w-[160px]"
        style={{
          background:
            "linear-gradient(135deg, #E8C97A 0%, #D4AC57 55%, #C9A149 100%)",
          color: "var(--color-navy-ink)",
          boxShadow:
            "0 8px 22px -8px rgba(201, 161, 73, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.35)",
          opacity: submitting ? 0.65 : 1,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "שולחים…" : "הצטרפו לרשימה"}
      </button>

      {/* Inline error rows live inside the form so they reset alongside the
          status state. role="alert" pushes them straight to AT users. */}
      {showEmailError ? (
        <p
          id="early-access-error-email"
          role="alert"
          className="basis-full text-sm font-medium"
          style={{ color: "#FCA5A5" }}
        >
          כתובת אימייל לא תקינה
        </p>
      ) : null}
      {showDbError ? (
        <p
          id="early-access-error-db"
          role="alert"
          className="basis-full text-sm font-medium"
          style={{ color: "#FCA5A5" }}
        >
          אירעה שגיאה. נסו שוב בעוד רגע.
        </p>
      ) : null}
    </form>
  );
}
