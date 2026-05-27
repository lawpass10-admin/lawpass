"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type {
  QuestionEditorAngle,
  QuestionEditorSource,
} from "@/lib/db/admin";

import AngleForm from "./angle-form";
import SourceForm from "./source-form";

/**
 * Tabs shell for the question editor.
 *
 * One tab for "מקור" (source) + one per angle (in display_order). The
 * source has a notes_for_admin field; angles don't — the form
 * components diverge there. Read-only context blocks (question_text +
 * choices) live INSIDE each form so the editor sees what they're
 * editing analyses for without leaving the tab.
 *
 * Tab state is local — the URL doesn't track it. Switching tabs is
 * cheap and form state is per-tab (RHF instance per form component).
 */
export default function QuestionEditor({
  source,
  angles,
}: {
  source: QuestionEditorSource;
  angles: QuestionEditorAngle[];
}) {
  type TabId = "source" | string;
  const [active, setActive] = useState<TabId>("source");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "source", label: "מקור" },
    ...angles.map((a) => ({
      id: a.id,
      label: `זווית ${a.angleLetter}`,
    })),
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="עריכת מקור וזוויות"
        className="flex flex-wrap gap-1 border-b border-[var(--color-line)] pb-1"
      >
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={cn(
                "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                isActive
                  ? "text-[var(--color-navy-ink)]"
                  : "text-[var(--color-ink-dim)] hover:bg-[var(--color-gold-tint)] hover:text-foreground"
              )}
            >
              {t.label}
              {isActive ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-2 -bottom-1 h-[2px] rounded bg-[var(--color-gold)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {active === "source" ? (
        <SourceForm source={source} />
      ) : (
        (() => {
          const angle = angles.find((a) => a.id === active);
          if (!angle) return null;
          return <AngleForm angle={angle} />;
        })()
      )}
    </div>
  );
}
