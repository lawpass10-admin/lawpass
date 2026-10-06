"use client";

/**
 * "הטיוטות שלי" — the saved scratch pages, newest first.
 *
 * A CLIENT component, fetching on mount, because the list comes from the
 * Express API and that call carries the browser's Supabase bearer token. The
 * page shell around it stays a Server Component.
 *
 * ── Why the text is on the card and not behind a click ────────────────────
 * A draft has no name of its own — the title is just its first sentence — so a
 * list of titles alone would be a list of opening lines with no way to tell
 * which one holds the thing you are looking for without opening each. The body
 * is on the card, clamped, and expands in place. Nobody navigates away to read
 * four lines they wrote themselves.
 *
 * Long drafts (the column allows 20,000 characters) collapse to CLAMP_LINES
 * with a "הצג הכל" toggle, so one essay cannot push everything else off screen.
 */

import { CalendarDays, ChevronDown, NotebookPen } from "lucide-react";
import * as React from "react";

import { listMyDrafts, type DraftSummary } from "@/lib/api/drafts";
import { cn } from "@/lib/utils";

/**
 * Roughly how many characters fit in the six clamped lines (`line-clamp-6`
 * below — change both together).
 *
 * This only decides whether the toggle is OFFERED; the clamp itself is CSS and
 * exact. A draft just over the line showing a toggle that reveals one more
 * word is a smaller problem than measuring the DOM on every render.
 */
const CLAMP_CHAR_ESTIMATE = 420;

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formatted on the client only — this component never renders on the server. */
function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : dateFormatter.format(parsed);
}

export function DraftsList() {
  const [state, setState] = React.useState<
    { status: "loading" } | { status: "error"; error: string } | { status: "ready"; drafts: DraftSummary[] }
  >({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    void listMyDrafts().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", drafts: result.drafts }
          : { status: "error", error: result.error }
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <DraftsSkeleton />;

  // A failed read and an empty list are deliberately different screens. Told
  // "you have no drafts" when the fetch failed, a student concludes their
  // notes are gone.
  if (state.status === "error") {
    return (
      <div
        className="rounded-xl border p-6 text-center font-heebo text-sm"
        style={{
          borderColor: "var(--color-line)",
          background: "var(--card)",
          color: "var(--color-ink-dim)",
        }}
        role="alert"
      >
        {state.error}
      </div>
    );
  }

  if (state.drafts.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed p-10 text-center font-heebo"
        style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
      >
        <NotebookPen className="mx-auto mb-3 size-7" strokeWidth={1.5} aria-hidden />
        <p className="text-sm">עדיין לא שמרת טיוטות.</p>
        <p className="mt-1 text-sm">
          אפשר לפתוח את דף הטיוטה מכל מסך — הכפתור נמצא בפינת המסך, ליד «שלחו לנו משוב».
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="font-heebo text-sm" style={{ color: "var(--color-ink-muted)" }}>
        {state.drafts.length === 1 ? "טיוטה אחת שמורה" : `${state.drafts.length} טיוטות שמורות`}
      </p>
      <ul className="space-y-3">
        {state.drafts.map((draft) => (
          <li key={draft.draft_id}>
            <DraftCard draft={draft} />
          </li>
        ))}
      </ul>
    </>
  );
}

function DraftCard({ draft }: { draft: DraftSummary }) {
  const [expanded, setExpanded] = React.useState(false);
  const expandable = draft.text.length > CLAMP_CHAR_ESTIMATE;

  return (
    <article
      className="rounded-xl border p-4 transition-colors sm:p-5"
      style={{ borderColor: "var(--color-line)", background: "var(--card)" }}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          className="font-heebo font-bold"
          style={{ fontSize: 16, color: "var(--color-navy-ink)", lineHeight: 1.4 }}
        >
          {draft.title}
        </h2>
        <p
          className="flex shrink-0 items-center gap-1.5 font-heebo text-xs tabular-nums"
          style={{ color: "var(--color-ink-muted)" }}
        >
          <CalendarDays className="size-3.5" strokeWidth={1.75} aria-hidden />
          {/* The machine-readable date is on the element, so the value is still
              available when the formatted string is not (copy, assistive tech). */}
          <time dateTime={draft.created_at}>{formatDate(draft.created_at)}</time>
        </p>
      </header>

      {/* whitespace-pre-wrap: a draft is typed with its own line breaks, and
          collapsing them would reorganise someone's notes for them. */}
      <p
        className={cn(
          "mt-3 font-heebo whitespace-pre-wrap break-words",
          !expanded && expandable && "line-clamp-6"
        )}
        style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-ink-dim)" }}
      >
        {draft.text}
      </p>

      {expandable ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 rounded-md font-heebo text-sm font-semibold hover:underline"
          style={{ color: "var(--color-gold-deep)" }}
        >
          {expanded ? "הצג פחות" : "הצג הכל"}
          <ChevronDown
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      ) : null}
    </article>
  );
}

/** Three cards' worth of grey, so the page does not jump when the list lands. */
function DraftsSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border p-5"
          style={{ borderColor: "var(--color-line)", background: "var(--card)" }}
        >
          <div className="h-4 w-1/3 rounded" style={{ background: "var(--muted, #f2f4f7)" }} />
          <div className="mt-4 h-3 w-full rounded" style={{ background: "var(--muted, #f2f4f7)" }} />
          <div className="mt-2 h-3 w-5/6 rounded" style={{ background: "var(--muted, #f2f4f7)" }} />
        </li>
      ))}
    </ul>
  );
}
