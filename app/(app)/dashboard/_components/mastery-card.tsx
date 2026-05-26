import Link from "next/link";
import type { CSSProperties } from "react";

import { ChapterIcon } from "@/app/(app)/dashboard/_components/chapter-icon";
import { buttonVariants } from "@/components/ui/button";
import type { MasteryRow } from "@/lib/dashboard/types";
import { practiceSetupUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

type MasteryState = "weak" | "ok" | "strong" | "empty";

/**
 * Per-state styling for the 38×38 chapter-icon container — drawn
 * straight from the handoff prototype. The "empty" branch keeps the
 * icon visible (white square, ink-dim glyph) for rows the user hasn't
 * touched yet — a soft hint, not a warning.
 */
const ICON_TINT: Record<MasteryState, CSSProperties> = {
  weak: {
    background: "var(--color-status-weak-bg)",
    color: "var(--color-status-weak)",
    border: "1px solid rgba(194, 65, 12, 0.20)",
  },
  ok: {
    background: "var(--color-status-ok-bg)",
    color: "var(--color-status-ok)",
    border: "1px solid rgba(62, 91, 168, 0.22)",
  },
  strong: {
    background: "var(--color-status-strong-bg)",
    color: "var(--color-status-strong)",
    border: "1px solid rgba(31, 138, 91, 0.25)",
  },
  empty: {
    background: "var(--card)",
    color: "var(--color-ink-dim)",
    border: "1px solid var(--color-line)",
  },
};

/**
 * "חולשה" weakness badge thresholds (plan §2.3):
 *   - accuracy < 60% AND non-skipped attempts >= 5
 */
const WEAKNESS_ACCURACY_PCT = 60;
const MIN_ATTEMPTS_FOR_WEAKNESS = 5;
const STRONG_ACCURACY_PCT = 75;

/**
 * Defaults for the per-row "תרגל" deep link. Matches `PrefillInput`
 * in `lib/urls.ts:23-29`; reduced from the practice form's own
 * defaults toward "quick weakness remediation" sizing.
 */
const PRACTICE_DEEPLINK_DEFAULTS = {
  sourceCount: 5,
  angles: 2,
  timePerQuestion: 150,
} as const;

function isWeakness(row: MasteryRow): boolean {
  if (row.accuracy === null) return false;
  if (row.accuracy >= WEAKNESS_ACCURACY_PCT) return false;
  return row.total - row.skipped >= MIN_ATTEMPTS_FOR_WEAKNESS;
}

function masteryState(row: MasteryRow): MasteryState {
  if (row.accuracy === null) return "empty";
  if (isWeakness(row)) return "weak";
  if (row.accuracy >= STRONG_ACCURACY_PCT) return "strong";
  return "ok";
}

/**
 * Bar fill color per the Phase 10b handoff palette:
 *   - 0-attempt row → bg-soft (track only, no fill — effectively width 0)
 *   - weakness → status-weak (warm amber #C2410C)
 *   - ≥75%    → status-strong (forest green #1F8A5B)
 *   - else    → status-ok (mid navy #3E5BA8)
 * The handoff intentionally pulls the OK bar off `--primary` so the
 * core navy stays reserved for hero surfaces (ring, sidebar, CTA hover).
 */
function barColor(row: MasteryRow): string {
  if (row.accuracy === null) return "var(--bg-soft)";
  if (isWeakness(row)) return "var(--color-status-weak)";
  if (row.accuracy >= STRONG_ACCURACY_PCT) return "var(--color-status-strong)";
  return "var(--color-status-ok)";
}

function MasteryBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 6,
        background: "var(--bg-soft)",
        borderRadius: 999,
        overflow: "hidden",
      }}
      aria-hidden
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

type Props = {
  rows: MasteryRow[];
};

function MasteryRowItem({
  row,
  rowIndex,
}: {
  row: MasteryRow;
  rowIndex: number;
}) {
  const state = masteryState(row);
  const weak = state === "weak";
  const href = practiceSetupUrl({
    chapters: [row.chapterId],
    sourceCount: PRACTICE_DEEPLINK_DEFAULTS.sourceCount,
    angles: PRACTICE_DEEPLINK_DEFAULTS.angles,
    timePerQuestion: PRACTICE_DEEPLINK_DEFAULTS.timePerQuestion,
  });
  const numberPrefix = String(rowIndex + 1).padStart(2, "0");
  const pct = row.accuracy ?? 0;
  const pctColor =
    state === "weak"
      ? "var(--color-status-weak)"
      : state === "ok"
        ? "var(--color-status-ok)"
        : state === "strong"
          ? "var(--color-status-strong)"
          : "var(--color-ink-muted)";

  const metaText =
    row.total === 0
      ? "טרם תורגל"
      : state === "strong"
        ? `${row.total.toLocaleString("he-IL")} שאלות · השיא שלך`
        : `${row.total.toLocaleString("he-IL")} שאלות תורגלו`;

  const pctNode = (
    <span
      className="tabular-nums font-heebo"
      style={{
        fontSize: 15,
        color: pctColor,
        fontWeight: 700,
        textAlign: "end",
      }}
      aria-label={
        row.accuracy !== null ? `${Math.round(row.accuracy)} אחוז` : undefined
      }
    >
      {row.accuracy !== null ? `${Math.round(row.accuracy)}%` : "—"}
    </span>
  );

  return (
    <Link
      href={href}
      aria-label={`תרגל את הפרק ${row.chapterTitle}`}
      className="group block rounded-[14px] border transition-colors hover:bg-card hover:border-[var(--color-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{
        padding: "10px 14px",
        background: "var(--color-paper)",
        borderColor: "var(--color-line)",
      }}
    >
      {/* Desktop layout — single-row grid with bar + pct + CTA inline. */}
      <div
        className="hidden md:grid items-center"
        style={{
          gridTemplateColumns: "38px 28px 1fr 120px auto auto",
          gap: 14,
        }}
      >
        <span
          className="inline-flex items-center justify-center transition-transform group-hover:scale-105"
          style={{ width: 38, height: 38, borderRadius: 10, ...ICON_TINT[state] }}
          aria-hidden
        >
          <ChapterIcon code={row.chapterCode} />
        </span>
        <span
          className="tabular-nums font-heebo"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-ink-muted)",
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
          aria-hidden
        >
          {numberPrefix}
        </span>
        <div className="min-w-0 flex flex-col gap-0.5">
          <div
            className="font-heebo font-semibold"
            style={{ fontSize: 15, color: "var(--color-navy-ink)", lineHeight: 1.2 }}
          >
            {row.chapterTitle}
            {weak ? (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold align-middle font-heebo"
                style={{
                  background: "var(--color-status-weak-bg)",
                  color: "var(--color-status-weak)",
                  marginInlineStart: 8,
                }}
              >
                חולשה
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            {metaText}
          </div>
        </div>
        <MasteryBar pct={pct} color={barColor(row)} />
        {pctNode}
        <span
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "font-heebo text-[13px] font-semibold pointer-events-none"
          )}
          style={{ color: "var(--color-navy)" }}
          aria-hidden
        >
          תרגל ←
        </span>
      </div>

      {/* Mobile layout — 2 rows: (icon + title + pill) above, then
          (bar + pct) below. Meta line sits between the two. The whole
          row is the Link's hit-target, so no CTA chip is needed. */}
      <div className="md:hidden flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex shrink-0 items-center justify-center"
            style={{ width: 38, height: 38, borderRadius: 10, ...ICON_TINT[state] }}
            aria-hidden
          >
            <ChapterIcon code={row.chapterCode} />
          </span>
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-heebo font-semibold truncate"
                style={{
                  fontSize: 15,
                  color: "var(--color-navy-ink)",
                  lineHeight: 1.2,
                }}
              >
                {row.chapterTitle}
              </h3>
              {weak ? (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold font-heebo"
                  style={{
                    background: "var(--color-status-weak-bg)",
                    color: "var(--color-status-weak)",
                  }}
                >
                  חולשה
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
              {metaText}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ps-[50px]">
          <div className="flex-1">
            <MasteryBar pct={pct} color={barColor(row)} />
          </div>
          {pctNode}
        </div>
      </div>
    </Link>
  );
}

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

  return (
    <div
      className="rounded-[22px] border bg-card"
      style={{
        padding: "22px 24px",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-end justify-between" style={{ marginBottom: 18, gap: 16 }}>
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
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => (
          <MasteryRowItem key={row.chapterId} row={row} rowIndex={idx} />
        ))}
      </div>
    </div>
  );
}
