/**
 * Slice 25 B-1 — Per-question "open notes" trigger button. Mirrors
 * the Bookmark button's visual idiom (h-8 w-8 rounded, lucide icon,
 * focus-visible ring) so the two icons sit consistently in the
 * practice-question header.
 *
 * "Has-note" state: when an existing note is loaded for this
 * question, the icon is filled gold so the user can spot which
 * questions they've already annotated without opening the sheet.
 */

"use client";

import { StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";

type NoteTriggerButtonProps = {
  onClick: () => void;
  /** True when this question already has a saved note. Drives the
   *  filled-gold treatment. */
  hasNote: boolean;
  /** Disable during in-flight network operations (e.g. immediately
   *  after save). */
  disabled?: boolean;
};

export function NoteTriggerButton({
  onClick,
  hasNote,
  disabled,
}: NoteTriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="הערה אישית"
      aria-label="פתח הערה אישית"
      aria-pressed={hasNote}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition-colors",
        // Gold hover/border accent so it's visually distinct from
        // the amber Bookmark button next to it.
        "hover:border-[var(--color-gold)]/60 hover:bg-[var(--color-gold-tint)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        disabled && "opacity-50"
      )}
    >
      <StickyNote
        className={cn(
          "size-4",
          hasNote
            ? "fill-[var(--color-gold)] text-[var(--color-gold-deep)]"
            : "text-foreground"
        )}
        aria-hidden
      />
    </button>
  );
}
