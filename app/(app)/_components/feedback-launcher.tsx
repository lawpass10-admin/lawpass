"use client";

/**
 * "שלחו לנו משוב" — a launcher on every (app) page, and the box behind it.
 *
 * WHY IT FLOATS INSTEAD OF SITTING IN THE SIDEBAR. It started as a sidebar row,
 * which put it on most screens and not on the ones a student is most likely to
 * have something to say about: /exam, /mahoti and /diuni are focus routes and
 * render with no sidebar at all (see app-shell.tsx). A student hitting a
 * problem mid-sitting is exactly who this is for, so the launcher is mounted by
 * the shell on BOTH branches — the same arrangement QaFloatingWidget uses, for
 * the same reason.
 *
 * WHERE IT SITS. Centred at the top of the viewport, as a LABELLED PILL — a
 * student has no reason to guess what an unmarked icon in a corner does.
 *
 * It began in the top-left cluster beside the accessibility and QA launchers,
 * which is where the app keeps its floating controls. That corner turned out to
 * be occupied on the screens that matter: on /diuni the pill landed on top of
 * the "חזרה לבחירת מבחן" button and the accessibility launcher's own label. The
 * centre is the one strip of the top edge that no page currently puts a control
 * in — the exam header runs along the inline-start side and the back buttons
 * along the inline-end.
 *
 * That makes this a placement to RE-CHECK when a page grows a centred header:
 * it is fixed-position and knows nothing about what is underneath it. The
 * bottom corners are not an alternative — /mahoti and the writing-task results
 * pin action rows to the foot and practice has a full-width summary footer,
 * which is the collision the QA widget moved out of the bottom to escape.
 *
 * ── The box ───────────────────────────────────────────────────────────────
 * One textarea and a send button. No category picker, no rating, no subject
 * line: every field is one more thing to get past before saying the thing they
 * opened the box to say. Context we can collect without asking — which page
 * they were on — is collected without asking.
 *
 * THE BODY MOUNTS ONLY WHILE OPEN, so every opening starts empty and a
 * half-typed message cannot survive a close and reappear later attached to a
 * different thought. Same pattern as handwriting-dialog.tsx.
 *
 * SENDING IS NOT UNDOABLE, so the button is disabled until there is something
 * to send and while the send is in flight — a double-click must not file the
 * same message twice.
 */

import { Check, Loader2, MessageSquareHeart, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { submitUserFeedbackAction } from "@/app/(app)/_actions";
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

/** Matches the action's Zod max and the CHECK on user_feedback. */
const MAX_CHARS = 4000;
/** The counter stays quiet until the message is long enough to be near it. */
const COUNTER_FROM = 200;
/** How long the thank-you sits on screen before the box closes itself. */
const THANKS_MS = 1500;

/**
 * Geometry of the accessibility launcher, from
 * `app/_components/a11y-widget.module.css`. Not a neighbour any more — see
 * PILL_TOP — but still what this pill lines up with vertically.
 */
const LAUNCHER_SIZE = 32;
const A11Y_LAUNCHER_TOP = 12;

/**
 * This is a labelled pill, not a 32px utility circle.
 *
 * The accessibility and QA launchers are things a student goes looking for
 * when they already want them; this is an invitation, and an unlabelled icon
 * is an invitation nobody reads.
 */
const PILL_HEIGHT = 36;

/**
 * Pinned so the pill's CENTRE line matches the accessibility launcher's rather
 * than its top edge matching it — a taller control aligned by its top reads as
 * sitting slightly high beside a round one, even from across the page.
 */
const PILL_TOP = A11Y_LAUNCHER_TOP - (PILL_HEIGHT - LAUNCHER_SIZE) / 2;

export function FeedbackLauncher() {
  const [open, setOpen] = React.useState(false);
  // Lifted above the body so a close cannot land mid-send: the body unmounts on
  // close, and unmounting while the request is in flight would leave the
  // student with no idea whether their message arrived.
  const [sending, setSending] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="שלח לנו משוב"
        style={{
          top: `${PILL_TOP}px`,
          height: `${PILL_HEIGHT}px`,
        }}
        className={cn(
          // z-40 matches the QA launcher: above the page, below an open dialog.
          // Centred on the viewport, not anchored to a corner — see the header.
          "fixed left-1/2 -translate-x-1/2 z-40",
          "inline-flex items-center gap-2 rounded-full ps-3.5 pe-4",
          // Navy fill with a gold ring — the app's own pair, so it reads as
          // part of LawPass rather than as another debug control.
          "border border-[rgba(201,161,73,0.55)] bg-[var(--color-navy-deep,#1E3A8A)]",
          "text-[#C9A149] shadow-lg transition-transform",
          // The label never wraps: a two-line pill in the corner looks broken,
          // and the text is short enough to stay on one line at any width.
          "whitespace-nowrap text-sm font-semibold",
          // Brightness rather than a scale on hover: the pill is centred with a
          // -translate-x-1/2, and a transform-based hover effect is one more
          // thing that has to compose correctly with it to avoid a jump.
          "hover:brightness-110 hover:border-[#C9A149]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A149]/60"
        )}
      >
        {/* 18px to match the accessibility launcher's own icon size. */}
        <MessageSquareHeart
          className="size-[18px] shrink-0"
          strokeWidth={1.75}
          aria-hidden
        />
        <span>שלח לנו משוב</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (sending) return;
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-lg" showCloseButton={!sending}>
          {open ? (
            <FeedbackDialogBody
              sending={sending}
              setSending={setSending}
              onDone={() => setOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeedbackDialogBody({
  sending,
  setSending,
  onDone,
}: {
  sending: boolean;
  setSending: (sending: boolean) => void;
  onDone: () => void;
}) {
  const pathname = usePathname() ?? "";
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState("");
  const [sent, setSent] = React.useState(false);

  // The auto-close timer, cleared if the box goes away first — a student who
  // closes the thank-you themselves must not have a stray timer fire into an
  // unmounted component.
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError("");

    const result = await submitUserFeedbackAction({
      text: trimmed,
      page: pathname || undefined,
    });

    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSent(true);
    toast.success("המשוב נשלח — תודה!");
    closeTimer.current = setTimeout(onDone, THANKS_MS);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(201, 161, 73, 0.12)",
            boxShadow: "0 0 0 1px rgba(201, 161, 73, 0.35)",
          }}
        >
          <Check
            className="size-7"
            style={{ color: "#C9A149" }}
            strokeWidth={2.5}
          />
        </span>
        <DialogTitle className="text-lg">תודה שכתבתם לנו</DialogTitle>
        <DialogDescription className="max-w-xs">
          המשוב שלכם התקבל ונקרא על ידינו. הוא עוזר לנו לשפר את LawPass.
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
            <MessageSquareHeart
              className="size-5"
              style={{ color: "#C9A149" }}
              strokeWidth={1.75}
            />
          </span>
          <div className="min-w-0">
            <DialogTitle>נשמח לשמוע מכם</DialogTitle>
            <DialogDescription>
              רעיון, תקלה או כל דבר שחסר לכם — כתבו לנו בחופשיות.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="mt-5">
        <Textarea
          autoFocus
          dir="auto"
          value={text}
          maxLength={MAX_CHARS}
          disabled={sending}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            // Ctrl/⌘+Enter sends, the way every other message box does. Plain
            // Enter stays a newline: this is a paragraph, not a chat line.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="מה עובד, מה פחות, ומה הייתם רוצים שנוסיף?"
          className="min-h-40 resize-none text-[15px] leading-relaxed"
          aria-label="תוכן המשוב"
          aria-invalid={error ? true : undefined}
        />

        <div className="mt-2 flex min-h-5 items-center justify-between gap-3">
          <span className="text-xs text-destructive" role="alert">
            {error}
          </span>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums transition-opacity",
              text.length >= COUNTER_FROM ? "opacity-100" : "opacity-0",
              text.length >= MAX_CHARS
                ? "text-destructive"
                : "text-muted-foreground"
            )}
            aria-hidden={text.length < COUNTER_FROM}
          >
            {text.length.toLocaleString("he-IL")} /{" "}
            {MAX_CHARS.toLocaleString("he-IL")}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          size="lg"
          disabled={sending}
          onClick={onDone}
          type="button"
        >
          ביטול
        </Button>
        <Button
          size="lg"
          disabled={!canSend}
          onClick={() => void send()}
          type="button"
        >
          {sending ? (
            <>
              <Loader2 className="animate-spin" />
              שולח…
            </>
          ) : (
            <>
              <Send />
              שליחת משוב
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
