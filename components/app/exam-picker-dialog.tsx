"use client";

import { Check, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The paper picker behind the sidebar's "דין מהותי" and "דין דיוני" rows.
 *
 * Those rows used to be plain links, which always served the newest paper. Now
 * the choice is made before the navigation: the dialog lists the papers on
 * offer and the button opens the selected one as `?set=<id>` — the same
 * parameter "למבחן הבא" uses at the end of a review, so a chosen paper needs no
 * session and no stored position.
 *
 * ONE COMPONENT FOR BOTH SUBJECTS. The two differ in their table, their route
 * and whether a paper has a notebook behind it, and in nothing else a picker
 * can see — so the subject arrives as props and `sets` is described
 * structurally: anything carrying these five fields fits, which is how
 * MahotiSetSummary (with a law count) and DiuniSetSummary (without one) both
 * pass without lib/db importing from a component.
 *
 * The list is fetched when the dialog OPENS, not when the sidebar renders. The
 * sidebar is on every protected route; the list is wanted on a click.
 *
 * The listbox is built from buttons rather than a <select> for two reasons: a
 * paper is two lines (its name, then its size), which a native option cannot
 * show, and the rows are the main content of this dialog rather than a field in
 * a form. `role="radiogroup"` + `role="radio"` keeps that honest for a screen
 * reader.
 */

/** What the picker needs of a paper. `lawCount` is optional because a diuni
 *  paper has no notebook to count laws in. */
export type PickerSet = {
  questionId: string;
  createdAt: string | null;
  title: string;
  questionCount: number | null;
  lawCount?: number | null;
};

export function ExamPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  Icon,
  href,
  emptyLabel,
  load,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The subject, as the dialog heading — "דין מהותי" / "דין דיוני". */
  title: string;
  description: string;
  Icon: LucideIcon;
  /** The route a chosen paper opens on, e.g. "/mahoti". */
  href: string;
  emptyLabel: string;
  /** The Server Action that lists the papers. Reading these tables needs the
   *  service-role client (both are admin-only under RLS), so this cannot be a
   *  browser query. */
  load: () => Promise<PickerSet[]>;
}) {
  const router = useRouter();
  const [sets, setSets] = React.useState<PickerSet[] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  // Re-read on every open rather than caching the first answer: a paper
  // generated while the tab was left sitting open should appear without a
  // reload. The previous list is left on screen while the re-read runs — the
  // answer is almost always the same one, and blanking it first would flash
  // skeletons over a list that is about to be identical. `cancelled` drops a
  // response that arrives after the dialog was closed again.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void load().then((rows) => {
      if (cancelled) return;
      setSets(rows);
      // Preselect the newest paper — with one paper on the list that makes the
      // dialog a single confirm, and with several it still opens on the one a
      // plain link would have served.
      setSelected(rows[0]?.questionId ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  const go = () => {
    if (!selected) return;
    // Closed on the way out rather than after the route settles: these pages
    // are a server render of a whole paper, so the wait is real and it belongs
    // to the route, whose own loading UI covers it. A dialog left hanging over
    // the new page would have to be dismissed afterwards.
    onOpenChange(false);
    router.push(`${href}?set=${encodeURIComponent(selected)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex size-8 items-center justify-center rounded-lg bg-[#1E3A8A]/10 text-[#1E3A8A]"
            >
              <Icon strokeWidth={1.75} className="size-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {sets === null ? (
            <LoadingRows />
          ) : sets.length === 0 ? (
            <EmptyRow label={emptyLabel} />
          ) : (
            <div
              role="radiogroup"
              aria-label={title}
              className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto pe-0.5"
            >
              {sets.map((set) => (
                <ExamRow
                  key={set.questionId}
                  set={set}
                  selected={set.questionId === selected}
                  onSelect={() => setSelected(set.questionId)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            size="lg"
            onClick={go}
            disabled={!selected}
            className="w-full sm:w-auto"
          >
            עבור לעמוד המבחן
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One selectable paper. Selection is carried by the gold ring and the check
 * badge together — colour alone would leave the state invisible to anyone who
 * cannot separate the navy border from the gold one.
 */
function ExamRow({
  set,
  selected,
  onSelect,
}: {
  set: PickerSet;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative w-full rounded-xl border p-3.5 text-start transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A149]/50",
        selected
          ? "border-[#C9A149] bg-[#C9A149]/[0.07] shadow-sm"
          : "border-border bg-card hover:border-[#1E3A8A]/30 hover:bg-muted/50"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-[#C9A149] bg-[#C9A149] text-white"
              : "border-border bg-background"
          )}
        >
          {selected ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heebo text-sm font-semibold text-foreground">
            {set.title}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {describe(set)}
          </span>
        </span>
      </div>
    </button>
  );
}

/**
 * "40 שאלות · 25 חוקים · נוצר ב-14 בספטמבר 2026" — every part of which can be
 * missing (a diuni paper never has a law count, an older row may have no
 * question count), so the pieces are joined rather than templated.
 */
function describe(set: PickerSet): string {
  const parts: string[] = [];
  if (set.questionCount) parts.push(`${set.questionCount} שאלות`);
  if (set.lawCount) parts.push(`${set.lawCount} חוקים`);
  if (set.createdAt) {
    const date = new Date(set.createdAt);
    if (!Number.isNaN(date.getTime())) {
      parts.push(
        `נוצר ב-${date.toLocaleDateString("he-IL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`
      );
    }
  }
  return parts.join(" · ");
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2" aria-busy aria-label="טוען מבחנים">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-[68px] animate-pulse rounded-xl border border-border bg-muted/40"
        />
      ))}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}
