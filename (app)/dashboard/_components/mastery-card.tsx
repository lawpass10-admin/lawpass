import Link from "next/link";

import { isWeakness } from "@/app/(app)/dashboard/_components/mastery-row-item";
import { MasteryRowsClient } from "@/app/(app)/dashboard/_components/mastery-rows-client";
import { buttonVariants } from "@/components/ui/button";
import type { MasteryRow } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: MasteryRow[];
};

/**
 * Slice 11 — Server Component "chrome" for the chapters mastery
 * panel. Owns the card wrapper + header + sub-paragraph + the
 * total-attempts empty state. Hands the live row set to
 * `<MasteryRowsClient>` for the interactive filter + collapse — the
 * Slice 11 fix that prevents the full 16-chapter list from
 * overflowing the screen and lets the tester narrow by track.
 *
 * `<MasteryRowItem>` was extracted to its own file so both surfaces
 * can render it. The visuals are identical to the Slice 4 version;
 * only the surrounding tree changed.
 */
export function MasteryCard({ rows }: Props) {
  const totalLifetime = rows.reduce((acc, r) => acc + r.total, 0);

  if (totalLifetime === 0) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3
          className="font-semibold"
          style={{
            fontSize: 18,
            color: "var(--ink)",
          }}
        >
          שליטה לפי פרק
        </h3>
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <p style={{ color: "var(--ink-3)", fontSize: 14 }}>
            התחל לתרגל כדי לראות שליטה לפי פרק
          </p>
          <Link
            href="/practice"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            התחל תרגול
          </Link>
        </div>
      </div>
    );
  }

  const weaknessCount = rows.filter(isWeakness).length;
  const chaptersPhrase =
    rows.length === 1 ? "פרק אחד" : `${rows.length} הפרקים`;

  // Slice 41 — title block is passed as `titleSlot` into
  // `<MasteryRowsClient>`, which composes it with the filter pill in
  // a single flex header row (title visual-start, pill visual-end).
  // The server still owns title + sub-paragraph (data-derived); the
  // client owns layout + interactive pill.
  const titleSlot = (
    <div>
      <h3
        className="font-heebo font-bold"
        style={{
          fontSize: 16,
          color: "var(--color-navy-ink)",
        }}
      >
        שליטה לפי פרק
      </h3>
      <p
        style={{
          color: "var(--color-ink-dim)",
          fontSize: 13,
          marginTop: 4,
        }}
      >
        {weaknessCount === 1
          ? `חולשה אחת מסומנת — תמונת המצב שלך על פני ${chaptersPhrase}`
          : weaknessCount > 0
            ? `${weaknessCount} חולשות מסומנות — תמונת המצב שלך על פני ${chaptersPhrase}`
            : `תמונת המצב שלך על פני ${chaptersPhrase} — לפי אחוז שליטה`}
      </p>
    </div>
  );

  return (
    <div
      className="rounded-[22px] border bg-card"
      style={{
        padding: "22px 24px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <MasteryRowsClient rows={rows} titleSlot={titleSlot} />
    </div>
  );
}
