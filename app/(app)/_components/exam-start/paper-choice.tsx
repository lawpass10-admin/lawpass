"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PaperList, type PickerSet } from "@/components/app/paper-list";
import { Button } from "@/components/ui/button";

/**
 * Which paper to sit, under the instructions on an exam start page.
 *
 * The shared paper rows (PaperList), so the choice looks and
 * behaves the same wherever it is offered. The first paper on the list is
 * preselected — מבחן מספר 1, since the mahoti list is ordered by number — and
 * with one paper on the list the button is a single confirm. It opens as
 * `<examRoute>?set=<id>`, the parameter "למבחן הבא" already uses.
 *
 * `examRoute` is a string rather than a URL-building function because this is
 * rendered from a Server Component, and functions cannot cross that boundary.
 */
export function PaperChoice({
  sets,
  examRoute,
  listLabel,
  emptyLabel,
  heading = "בחירת המבחן",
}: {
  sets: PickerSet[];
  examRoute: "/diuni" | "/mahoti";
  listLabel: string;
  emptyLabel: string;
  /**
   * Overridden by the custom-papers section below the authored one, which
   * would otherwise render a second identical "בחירת המבחן" and leave the
   * candidate with two headings that do not say which list is which.
   */
  heading?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(sets[0]?.questionId ?? null);

  return (
    <section
      className="space-y-4 rounded-2xl border px-6 py-6 md:px-10"
      style={{ borderColor: "var(--color-line)", background: "var(--card)" }}
    >
      <h2 className="font-heebo font-bold" style={{ fontSize: 18, color: "var(--color-navy-ink)" }}>
        {heading}
      </h2>

      {sets.length === 0 ? (
        <p
          className="rounded-xl border border-dashed p-6 text-center font-heebo text-sm"
          style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
        >
          {emptyLabel}
        </p>
      ) : (
        <PaperList
          sets={sets}
          selected={selected}
          onSelect={setSelected}
          label={listLabel}
          // The storage namespace follows the route: "/mahoti" -> "mahoti".
          // Derived rather than passed as its own prop, so the two can never be
          // wired to different papers and show one list the other's progress.
          kind={examRoute === "/mahoti" ? "mahoti" : "diuni"}
        />
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!selected}
          onClick={() => {
            if (selected) router.push(`${examRoute}?set=${encodeURIComponent(selected)}`);
          }}
          className="w-full sm:w-auto"
        >
          עבור לעמוד המבחן
        </Button>
      </div>
    </section>
  );
}
