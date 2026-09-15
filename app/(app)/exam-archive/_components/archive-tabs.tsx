"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { ArchiveEntry, ExamArchive } from "@/lib/db/exam-archive";
import { cn } from "@/lib/utils";

/**
 * The three subject tabs, and the candidate's filed exams under each.
 *
 * The tab bar is the dashboard's (app/(app)/dashboard/_components/
 * subject-tabs.tsx): same order, same labels, same segmented control and the
 * same subject tints, so a candidate moving between the two pages meets one
 * control rather than two that look alike and behave differently.
 *
 * Every entry is a link to the full sitting. A <Link>, not a button with an
 * onClick, so each one can also be opened in a new tab and read beside another.
 */

type TabKey = keyof ExamArchive;

const TABS: { key: TabKey; label: string; empty: string; tint?: string }[] = [
  {
    key: "mahoti",
    label: "דין מהותי",
    empty: "עדיין לא הגשת מבחן בדין מהותי.",
  },
  {
    key: "diuni",
    label: "דין דיוני",
    empty: "עדיין לא הגשת מבחן בדין דיוני.",
    tint: "var(--bg-soft)",
  },
  {
    key: "writing",
    label: "מטלת כתיבה",
    empty: "עדיין לא הגשת מטלת כתיבה.",
    tint: "#E8EEF8",
  },
];

export function ArchiveTabs({ archive }: { archive: ExamArchive }) {
  const [active, setActive] = useState<TabKey>("mahoti");
  const current = TABS.find((t) => t.key === active) ?? TABS[0];
  const entries = archive[current.key];

  return (
    <section className="space-y-4">
      <div
        role="tablist"
        aria-label="נושא"
        className="grid w-full grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: "var(--muted, #f2f4f7)", border: "1px solid var(--color-line)" }}
      >
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`archive-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls="archive-panel"
              onClick={() => setActive(tab.key)}
              className={cn(
                "rounded-lg py-2.5 text-center font-heebo text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                selected ? "font-bold shadow-sm" : "font-medium hover:bg-white/60"
              )}
              style={{
                background: tab.tint ?? (selected ? "var(--card)" : undefined),
                color: selected ? "var(--color-navy-ink)" : "var(--color-ink-dim)",
              }}
            >
              {tab.label}
              <span
                className="ms-1.5 font-mono text-[11px] tabular-nums"
                style={{ color: "var(--color-ink-muted)" }}
              >
                {archive[tab.key].length}
              </span>
            </button>
          );
        })}
      </div>

      <div id="archive-panel" role="tabpanel" aria-labelledby={`archive-tab-${current.key}`}>
        {entries.length === 0 ? (
          <p
            className="rounded-xl border border-dashed p-8 text-center font-heebo text-sm"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-muted)" }}
          >
            {current.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.answerId}>
                <ArchiveRow entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ArchiveRow({ entry }: { entry: ArchiveEntry }) {
  const date = new Date(entry.createdAt);
  const when = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Link
      href={entry.href}
      className={cn(
        "group flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors",
        "hover:border-[#1E3A8A]/30 hover:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
      style={{ borderColor: "var(--color-line)", background: "var(--card)" }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-heebo font-bold"
          style={{ fontSize: 15, color: "var(--color-navy-ink)" }}
        >
          {entry.title}
        </p>
        <p className="mt-0.5 font-heebo" style={{ fontSize: 12.5, color: "var(--color-ink-muted)" }}>
          {[when, `ניסיון ${entry.attempt}`].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span
        className="shrink-0 rounded-full px-3 py-1 font-heebo text-sm font-semibold tabular-nums"
        style={{ background: "var(--muted, #f2f4f7)", color: "var(--color-navy-ink)" }}
      >
        {entry.result}
      </span>
      {/* ChevronLeft points forward in RTL. */}
      <ChevronLeft
        aria-hidden
        className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
        style={{ color: "var(--color-ink-muted)" }}
      />
    </Link>
  );
}
