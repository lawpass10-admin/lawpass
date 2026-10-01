"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  LLM_DISCLAIMER,
  NDA_SECTIONS,
  NDA_SUBTITLE,
  NDA_SUMMARY,
  NDA_TITLE,
} from "@/lib/legal/nda";

/**
 * The NDA block on the registration forms: three summary lines, the LLM
 * disclaimer, and the checkbox that accepts the agreement.
 *
 * A SECOND CHECKBOX, NOT A LONGER FIRST ONE. The agreement's own appendix
 * requires two separate boxes and says in terms that they must not be merged:
 * one for the usage policy, one for the NDA. Rolling the NDA into the existing
 * תקנון/פרטיות tick would mean a user who only read that line is recorded as
 * having signed a confidentiality agreement, which is the thing the separation
 * exists to prevent.
 *
 * THE FULL TEXT OPENS IN A DIALOG, not a new tab. Also from the appendix:
 * reading the agreement must not drop someone out of a half-filled
 * registration form. A dialog keeps the form state exactly where it was.
 *
 * Unticked by default, and there is no way to set it otherwise — the appendix
 * requires that too, and a pre-ticked consent box is not consent.
 *
 * Shared by the two registration paths: the email form (signup-form) and the
 * OAuth one (complete-profile-form). A user arriving through Google must not
 * skip the agreement by taking a different door.
 */
export function NdaConsent({
  checked,
  onCheckedChange,
  id = "nda_accepted",
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* The summary and the disclaimer sit in their own panel ABOVE the box,
          so they are read before the decision rather than after it. The
          CHECKBOX is deliberately outside that panel: it is the same kind of
          control as the תקנון/פרטיות one above it and should look like it,
          rather than like a different mechanism inside a grey card. */}
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <ul className="space-y-1">
          {NDA_SUMMARY.map((line) => (
            <li
              key={line}
              className="flex gap-1.5 text-[13px] leading-snug text-muted-foreground"
            >
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {LLM_DISCLAIMER}
        </p>
      </div>

      {/* Same markup as the תקנון row, so the two consents read as a pair. */}
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
          קראתי את{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-2 hover:no-underline"
            // preventDefault because this sits inside a <Label>: without it a
            // click would toggle the checkbox as well as open the dialog, so
            // opening the agreement to read it would silently accept it.
            onClick={(event) => {
              event.preventDefault();
              setOpen(true);
            }}
          >
            הסכם שמירת הסודיות
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-start">{NDA_TITLE}</DialogTitle>
                <DialogDescription className="text-start">{NDA_SUBTITLE}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-start">
                {NDA_SECTIONS.map((section, at) => (
                  <section key={section.heading || `s${at}`} className="space-y-1.5">
                    {section.heading ? (
                      <h3 className="font-heebo text-[15px] font-bold">{section.heading}</h3>
                    ) : null}
                    {section.paragraphs.map((text) => (
                      <p key={text} className="text-[14px] leading-relaxed text-muted-foreground">
                        {text}
                      </p>
                    ))}
                  </section>
                ))}
              </div>
            </DialogContent>
          </Dialog>{" "}
          ואני מתחייב/ת לפעול לפיו
          <span aria-hidden className="ms-0.5 text-destructive">
            *
          </span>
        </Label>
      </div>
    </div>
  );
}
