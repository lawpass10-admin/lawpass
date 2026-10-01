"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { createContext, useCallback, useContext, useState } from "react";
import { useForm } from "react-hook-form";

import { submitContactAction } from "../_actions/contact";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactSchema, type ContactInput } from "@/lib/validators/contact";

/**
 * The צרו קשר / תמיכה dialog, and the one way to open it.
 *
 * A CONTEXT RATHER THAN A TRIGGER PER CALLER. The links that open this live in
 * two different components — the landing nav and the footer — and both are
 * rendered from a copy array, so neither can wrap a trigger around its own
 * label without the copy knowing about components. One provider in the
 * marketing layout, one dialog mounted once, and both callers just ask for it
 * to open. It also means the two entry points cannot drift into two slightly
 * different forms.
 */
const ContactDialogContext = createContext<() => void>(() => {});

/** Open the contact dialog. Safe to call from anywhere under the provider. */
export function useContactDialog() {
  return useContext(ContactDialogContext);
}

export function ContactDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openContact = useCallback(() => setOpen(true), []);

  return (
    <ContactDialogContext.Provider value={openContact}>
      {children}
      <ContactDialog open={open} onOpenChange={setOpen} />
    </ContactDialogContext.Provider>
  );
}

function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onTouched",
    defaultValues: { full_name: "", email: "", phone: "", comment: "", website: "" },
  });

  async function onSubmit(values: ContactInput) {
    setServerError(null);
    const result = await submitContactAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSent(true);
    form.reset();
  }

  // Closing resets back to the form, so re-opening does not show last time's
  // confirmation to someone who wants to send a second message.
  function handleOpenChange(value: boolean) {
    onOpenChange(value);
    if (!value) {
      setSent(false);
      setServerError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0" dir="rtl">
        {/* A navy band carrying the gold logo, so the dialog is recognisably
            LawPass rather than a default white sheet. The form below it stays
            on the light card — navy is for the header and the CTA, not for the
            ground a Hebrew form is read on. */}
        <div
          className="flex items-center justify-center px-6 py-5"
          style={{ backgroundColor: "var(--color-navy-ink)" }}
        >
          <Image
            src="/landing/lawpass-logo-landing.png"
            alt="LawPass"
            width={195}
            height={113}
            className="block h-12 w-auto"
          />
        </div>

        <div className="space-y-4 px-6 pb-6 pt-5">
        <DialogHeader>
          <DialogTitle
            className="text-start"
            style={{ color: "var(--color-navy-ink)" }}
          >
            צרו קשר
          </DialogTitle>
          <DialogDescription className="text-start">
            {sent
              ? "הפנייה נשלחה."
              : "נשמח לשמוע מכם. נחזור אליכם בהקדם."}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 text-start">
            <p className="text-sm text-muted-foreground">
              תודה! קיבלנו את הפנייה שלכם וניצור קשר בהקדם האפשרי.
            </p>
            <Button
              type="button"
              className="btn-gold h-11 w-full border-0 text-base font-semibold"
              onClick={() => handleOpenChange(false)}
            >
              סגירה
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 text-start">
            {/* THE HONEYPOT. Positioned off-screen rather than display:none —
                a bot that skips hidden inputs is exactly the one worth
                catching, and `display:none` is the first thing it checks.
                aria-hidden and tabIndex=-1 keep it away from screen readers
                and the tab order, so nobody using the form can reach it.
                `autoComplete="off"` stops a browser filling it on a human's
                behalf, which would reject a real submission. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
                whiteSpace: "nowrap",
              }}
            >
              <label htmlFor="contact_website">אל תמלאו שדה זה</label>
              <input
                id="contact_website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                {...form.register("website")}
              />
            </div>

            <Field
              id="contact_full_name"
              label="שם מלא"
              error={form.formState.errors.full_name?.message}
            >
              <Input
                id="contact_full_name"
                autoComplete="name"
                {...form.register("full_name")}
              />
            </Field>

            <Field id="contact_email" label='דוא"ל' error={form.formState.errors.email?.message}>
              <Input
                id="contact_email"
                type="email"
                inputMode="email"
                dir="ltr"
                autoComplete="email"
                {...form.register("email")}
              />
            </Field>

            <Field
              id="contact_phone"
              label="טלפון"
              error={form.formState.errors.phone?.message}
            >
              <Input
                id="contact_phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                autoComplete="tel"
                {...form.register("phone")}
              />
            </Field>

            <Field
              id="contact_comment"
              label="תוכן הפנייה"
              error={form.formState.errors.comment?.message}
            >
              <Textarea id="contact_comment" rows={5} {...form.register("comment")} />
            </Field>

            {serverError ? (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            ) : null}

            {/* Submit leads, close is secondary — same pair and same order as
                the auth screens, so the dialog does not invent its own. */}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                type="submit"
                className="btn-gold h-11 flex-1 border-0 text-base font-semibold"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "שולחים…" : "שליחה"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 text-base font-semibold"
                onClick={() => handleOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                סגירה
              </Button>
            </div>
          </form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Label, control and error for one field — all four are laid out alike. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-sm font-medium"
        style={{ color: "var(--color-navy-ink)" }}
      >
        {label}
        {/* Every field here is required, so the marker is on all four rather
            than being the thing that distinguishes them. */}
        <span aria-hidden className="ms-0.5 text-destructive">
          *
        </span>
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A nav or footer entry that opens the dialog instead of navigating.
 *
 * The header and the footer are server components that render their links from
 * a copy array, so neither can hold the dialog's open state. This is the small
 * client island that can: it looks like the links beside it and does the one
 * thing they cannot.
 *
 * Marked by `href: "#contact"` in the copy, so adding another entry point is a
 * copy change rather than a component change.
 */
export function ContactLink({ label, className }: { label: string; className?: string }) {
  const openContact = useContactDialog();
  return (
    <button type="button" onClick={openContact} className={className}>
      {label}
    </button>
  );
}
