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
 * THE SAME SHAPE AS THE QA REPORT FORM (qa-floating-widget.tsx): what kind of
 * thing it is, what went wrong, what should have happened, and an optional
 * screenshot. It began as a single free-text area on the grounds that every
 * field is one more thing to get past — but the two forms collect the same
 * material, and a free paragraph has to be read and re-sorted by hand before it
 * can be acted on, while these four answers arrive already sorted.
 *
 * ONE ASYMMETRY WITH THE QA FORM, deliberately: "what should have happened" is
 * optional here and required there. A tester is filing a report as a job; a
 * student is interrupting their own studying to tell us something, and someone
 * who knows a thing is broken but not what the right behaviour is has still
 * told us something worth having. A required second box is where that person
 * gives up.
 *
 * Context we can collect without asking — which page they were on — is still
 * collected without asking.
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

/**
 * The three kinds of report, in the QA form's own order and wording.
 *
 * The same three on purpose — a student's "the timer jumped" and a tester's are
 * the same report, and two vocabularies for one thing would mean sorting the
 * pile twice. The values are what the action stores.
 */
const FEEDBACK_TYPES = [
  { value: "bug", label: "באג טכני" },
  { value: "content", label: "טעות תוכן" },
  { value: "design", label: "עיצוב/UX" },
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number]["value"];

/** Mirrors the bucket's own allowlist and ceiling (migration 20260930000003). */
const SCREENSHOT_ACCEPT = "image/png,image/jpeg,image/webp";
const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
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
  const [type, setType] = React.useState<FeedbackType>("bug");
  const [text, setText] = React.useState("");
  const [expected, setExpected] = React.useState("");
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
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

  /** Ctrl/⌘+Enter sends from either box, the way every other message box does.
   *  Plain Enter stays a newline: these are paragraphs, not chat lines. */
  function sendOnModEnter(event: React.KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void send();
    }
  }

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError("");

    // FormData because of the screenshot — see the note on the action. Fields
    // the student left alone are simply not appended, which is what makes them
    // arrive as `undefined` rather than as an empty string the schema would
    // then have to special-case.
    const payload = new FormData();
    payload.set("type", type);
    payload.set("text", trimmed);
    if (expected.trim()) payload.set("expected", expected.trim());
    if (pathname) payload.set("page", pathname);
    if (screenshot) payload.set("screenshot", screenshot);

    const result = await submitUserFeedbackAction(payload);

    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSent(true);
    // A message whose screenshot did not upload still went in. The toast says
    // which of the two happened rather than leaving the student to guess from
    // a thank-you screen that looks identical either way.
    if (result.warning) toast.warning(result.warning);
    else toast.success("המשוב נשלח — תודה!");
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
              ספרו לנו מה קרה ומה הייתם מצפים שיקרה — כך נוכל לטפל מהר יותר.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="mt-5 space-y-4">
        {/* A radiogroup rather than three checkboxes or a <select>: exactly one
            applies, all three fit on one line, and a picker that shows its
            options costs no clicks. Selection is carried by the gold border and
            fill — the app's own accent — not by a dot. */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold tracking-wider text-muted-foreground">
            סוג הפנייה
          </legend>
          <div
            role="radiogroup"
            aria-label="סוג הפנייה"
            className="grid grid-cols-3 gap-2"
          >
            {FEEDBACK_TYPES.map((option) => {
              const selected = option.value === type;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={sending}
                  onClick={() => setType(option.value)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A149]/60",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? "border-[#C9A149] bg-[rgba(201,161,73,0.12)] text-[var(--color-navy-ink)]"
                      : "border-border bg-card hover:bg-muted/40"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor="feedback-problem" className="text-xs font-semibold">
            מה לא עבד?
          </label>
          <Textarea
            id="feedback-problem"
            autoFocus
            dir="auto"
            value={text}
            maxLength={MAX_CHARS}
            disabled={sending}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={sendOnModEnter}
            rows={4}
            className="resize-none text-[15px] leading-relaxed"
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="feedback-expected" className="text-xs font-semibold">
            מה צריך להיות במקום? <span className="font-normal text-muted-foreground">(אופציונלי)</span>
          </label>
          <Textarea
            id="feedback-expected"
            dir="auto"
            value={expected}
            maxLength={MAX_CHARS}
            disabled={sending}
            onChange={(e) => setExpected(e.target.value)}
            onKeyDown={sendOnModEnter}
            rows={3}
            className="resize-none text-[15px] leading-relaxed"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="feedback-screenshot" className="text-xs font-semibold">
            צילום מסך <span className="font-normal text-muted-foreground">(אופציונלי)</span>
          </label>
          <input
            id="feedback-screenshot"
            type="file"
            accept={SCREENSHOT_ACCEPT}
            disabled={sending}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              // Caught here so an oversized image is a sentence under the field
              // rather than a failed upload after the student has waited for it.
              if (file && file.size > SCREENSHOT_MAX_BYTES) {
                setScreenshot(null);
                e.target.value = "";
                setError("צילום המסך גדול מדי — עד 5MB");
                return;
              }
              setScreenshot(file);
              if (error) setError("");
            }}
            className="block w-full text-xs file:me-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/40"
          />
        </div>

        <div className="flex min-h-5 items-center justify-between gap-3">
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
