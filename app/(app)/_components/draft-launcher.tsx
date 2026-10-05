"use client";

/**
 * "דף טיוטה" — a scratch page a student can open from anywhere.
 *
 * The pill beside "שלחו לנו משוב", with the same shape and the same reasons
 * behind it (see feedback-launcher.tsx): mounted by the shell on both branches
 * so it is there on the focus routes too, because mid-sitting is exactly when
 * someone wants to note something down.
 *
 * WIDE, NOT TALL. The feedback box is a form with four short answers; this is a
 * page to write on. It opens at the dialog's widest and gives the textarea most
 * of the viewport height, because a 4-row box invites a sentence and this is
 * for whatever the student actually needs — a half-formed answer, a rule they
 * keep forgetting, something to look up later.
 *
 * THE BODY MOUNTS ONLY WHILE OPEN, so each opening starts empty. That is the
 * same rule the feedback box follows, and here it is a real decision rather
 * than a copied one: a draft that reappeared later, attached to whatever the
 * student was doing then, would be worse than a blank page. Saved drafts live
 * in the database; the box is not where they are kept.
 *
 * SAVING IS NOT UNDOABLE from here, so the button is disabled while empty and
 * while a save is in flight — a double-click must not file the same note twice.
 */

import { Check, Loader2, NotebookPen, Save } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { saveUserDraftAction } from "@/app/(app)/_actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { LAUNCHER_PILL_LIGHT, PILL_HEIGHT } from "./feedback-launcher";

/** Matches the action's Zod max and the CHECK on user_drafts. */
const MAX_CHARS = 20_000;
/** The counter stays quiet until the draft is long enough to be near it. */
const COUNTER_FROM = 1_000;
/** How long the confirmation sits before the box closes itself. */
const SAVED_MS = 1200;

export function DraftLauncher() {
  const [open, setOpen] = React.useState(false);
  // Lifted above the body so a close cannot land mid-save: the body unmounts on
  // close, and unmounting while the request is in flight would leave the
  // student unsure whether their writing was kept.
  const [saving, setSaving] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="דף טיוטה"
        style={{ height: `${PILL_HEIGHT}px` }}
        className={LAUNCHER_PILL_LIGHT}
      >
        {/* No colour of its own — it inherits the pill's navy ink, where the
            feedback pill's icon inherits gold on navy. */}
        <NotebookPen className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
        <span>דף טיוטה</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (saving) return;
          setOpen(next);
        }}
      >
        {/* Wider and taller than the feedback box, and `flex flex-col` so the
            textarea can take the space the header and footer do not. */}
        <DialogContent
          className="flex max-h-[88vh] w-[min(92vw,900px)] max-w-none flex-col"
          showCloseButton={!saving}
        >
          {open ? (
            <DraftDialogBody saving={saving} setSaving={setSaving} onDone={() => setOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DraftDialogBody({
  saving,
  setSaving,
  onDone,
}: {
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onDone: () => void;
}) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !saving;

  /** Ctrl/⌘+Enter saves. Plain Enter stays a newline — this is a page of
   *  paragraphs, and Enter-to-submit would lose a draft mid-thought. */
  function saveOnModEnter(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");

    const result = await saveUserDraftAction({ text: trimmed });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    toast.success("הטיוטה נשמרה");
    closeTimer.current = setTimeout(onDone, SAVED_MS);
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(201, 161, 73, 0.12)",
            boxShadow: "0 0 0 1px rgba(201, 161, 73, 0.35)",
          }}
        >
          <Check className="size-7" style={{ color: "#C9A149" }} strokeWidth={2.5} />
        </span>
        <DialogTitle className="text-lg">הטיוטה נשמרה</DialogTitle>
        <DialogDescription className="max-w-xs">
          היא שמורה בחשבון שלכם בלבד ותהיה כאן כשתחזרו.
        </DialogDescription>
      </div>
    );
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(140deg, rgba(30,58,138,0.10) 0%, rgba(201,161,73,0.16) 100%)",
              boxShadow: "0 0 0 1px rgba(201, 161, 73, 0.28)",
            }}
          >
            <NotebookPen className="size-5" style={{ color: "#C9A149" }} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <DialogTitle>דף טיוטה</DialogTitle>
            <DialogDescription>
              מקום לכתוב בו כל מה שצריך תוך כדי הלימוד. נשמר בחשבון שלכם בלבד.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* min-h-0 so the textarea can shrink inside the flex column rather than
          pushing the footer off the bottom of a short viewport. */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2">
        <Textarea
          autoFocus
          dir="auto"
          value={text}
          maxLength={MAX_CHARS}
          disabled={saving}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={saveOnModEnter}
          placeholder="כתבו כאן…"
          className="min-h-[40vh] flex-1 resize-none text-[15px] leading-relaxed"
          aria-invalid={error ? true : undefined}
          aria-label="תוכן הטיוטה"
        />

        <div className="flex min-h-5 items-center justify-between gap-3">
          <span className="text-xs text-destructive" role="alert">
            {error}
          </span>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums transition-opacity",
              text.length >= COUNTER_FROM ? "opacity-100" : "opacity-0",
              text.length >= MAX_CHARS ? "text-destructive" : "text-muted-foreground"
            )}
            aria-hidden={text.length < COUNTER_FROM}
          >
            {text.length.toLocaleString("he-IL")} / {MAX_CHARS.toLocaleString("he-IL")}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" size="lg" disabled={saving} onClick={onDone} type="button">
          ביטול
        </Button>
        <Button size="lg" disabled={!canSave} onClick={() => void save()} type="button">
          {saving ? (
            <>
              <Loader2 className="animate-spin" />
              שומר…
            </>
          ) : (
            <>
              <Save />
              שמור טיוטה
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
