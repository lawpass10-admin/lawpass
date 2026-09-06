"use client";

import { Loader2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  buildCustomExam,
  fetchExamPool,
  type ExamPool,
} from "@/lib/api/custom-exam";
import type { TopicStat } from "@/lib/dashboard/topic-stat";
import { cn } from "@/lib/utils";

/**
 * שאלון מותאם אישית — build an exam from questions that already exist.
 *
 * NOTHING IS GENERATED. Every question comes from an authored paper that has
 * already been written, quote-verified and reviewed, so building costs nothing
 * and is instant. The server selects and renumbers; see
 * lawpass_server/db/custom-exam.js.
 *
 * The candidate sets a count per area and the total must land on EXACTLY
 * EXAM_LENGTH — a whole paper, marked out of the same total as the real thing.
 * A part-length paper would score against a different denominator and could not
 * be compared with anything else on the dashboard.
 */

/**
 * How many questions a built exam holds.
 *
 * 40 is the real paper's length. Worth knowing before changing it: the pool is
 * small, so at 40 there is very little to choose — 46 authored mahoti questions
 * means a 40-question exam takes 87% of everything, and diuni's 40 means it
 * takes literally all of them and the form has exactly one valid answer.
 * Lowering this is what makes the builder interesting before the pool grows.
 */
const EXAM_LENGTH = 40;

/**
 * How hard auto-fill leans toward weak areas.
 *
 * At 1.5 an area scored 0% is weighted 2.5 against 1.0 for one scored 100% —
 * a pronounced tilt that still leaves the strong areas represented, because a
 * paper that drops them entirely stops being a mock exam and becomes a drill.
 */
const WEAKNESS_BOOST = 1.5;

export function CustomExamBuilder({
  subject,
  subjectLabel,
  lastSitting = [],
}: {
  subject: "mahoti" | "diuni";
  /** "דין מהותי" / "דין דיוני", for the heading and the button. */
  subjectLabel: string;
  /**
   * The candidate's most recent sitting of this subject, per area.
   *
   * Drives the weighting in autoFill. Empty when they have never sat one — the
   * fill then falls back to pool proportions, which is the only honest answer
   * when there is no performance to lean on.
   */
  lastSitting?: TopicStat[];
}) {
  const router = useRouter();
  const [pool, setPool] = useState<ExamPool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [building, setBuilding] = useState(false);

  // Fetches the pool once. It does NOT reset state for a subject change —
  // the caller remounts this component per subject with a `key`, which clears
  // pool, error and counts together and for free. Clearing them here instead
  // would be a synchronous setState in an effect body, which React 19 rejects
  // (react-hooks/set-state-in-effect) and which leaves a frame showing the
  // previous subject's areas under the new subject's heading.
  useEffect(() => {
    let cancelled = false;
    void fetchExamPool(subject).then((result) => {
      if (cancelled) return;
      if (result.ok) setPool(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [subject]);

  const chosen = Object.values(counts).reduce((n, v) => n + v, 0);
  const remaining = EXAM_LENGTH - chosen;
  const exact = remaining === 0;
  const poolTooSmall = (pool?.total ?? 0) < EXAM_LENGTH;

  function setArea(area: string, value: number, max: number): void {
    const clamped = Math.max(0, Math.min(value, max));
    setCounts((prev) => ({ ...prev, [area]: clamped }));
  }

  /**
   * Fill the paper, leaning on the areas the last sitting went worst in.
   *
   * Each area's share is proportional to how much of the POOL it holds, then
   * multiplied by a weakness weight taken from the most recent sitting:
   *
   *     weight = 1 + WEAKNESS_BOOST × (100 − score) / 100
   *
   * so an area scored 0% is asked about 2.5× as often as one scored 100%, and
   * an area with no score yet sits in the middle at 1.75 — untested is not the
   * same as mastered, and a paper that skipped everything new would keep
   * re-testing what the candidate has already seen.
   *
   * Weighting can only move questions the pool can spare. With 46 mahoti
   * questions and a 40-question paper there are 6 to redistribute; with diuni's
   * 40 there are none, and the fill is forced whatever the weights say. The
   * caps below are what keep it honest rather than pretending otherwise.
   */
  function autoFill(): void {
    if (!pool) return;

    const scoreByArea = new Map(lastSitting.map((r) => [r.topic, r.percent]));
    const weightFor = (area: string): number => {
      const score = scoreByArea.get(area);
      if (score === undefined) return 1 + WEAKNESS_BOOST * 0.5;
      return 1 + WEAKNESS_BOOST * ((100 - score) / 100);
    };

    const weighted = pool.areas.map((a) => ({
      ...a,
      weight: a.available * weightFor(a.area),
    }));
    const totalWeight = weighted.reduce((n, a) => n + a.weight, 0) || 1;

    const next: Record<string, number> = {};
    let left = Math.min(EXAM_LENGTH, pool.total);

    // Weakest-and-largest first, so the rounding remainder lands where there is
    // depth to absorb it rather than on an area holding one question.
    const order = [...weighted].sort((a, b) => b.weight - a.weight);

    for (const { area, available, weight } of order) {
      if (left <= 0) break;
      const share = Math.min(
        available,
        Math.max(1, Math.round((weight / totalWeight) * EXAM_LENGTH))
      );
      const take = Math.min(share, left);
      next[area] = take;
      left -= take;
    }
    // Rounding rarely lands exactly on the target; top up in the same order, so
    // the spare questions also go to the weakest areas that still have room.
    for (const { area, available } of order) {
      if (left <= 0) break;
      const room = available - (next[area] ?? 0);
      const add = Math.min(room, left);
      next[area] = (next[area] ?? 0) + add;
      left -= add;
    }
    setCounts(next);
  }

  async function handleBuild(): Promise<void> {
    if (!exact || building) return;
    setBuilding(true);
    const result = await buildCustomExam(subject, counts, EXAM_LENGTH);
    if (!result.ok) {
      setBuilding(false);
      toast.error(result.error);
      return;
    }
    // `building` stays true through the navigation: re-enabling the button
    // would offer a second exam for one click.
    router.push(`/${subject}?set=${encodeURIComponent(result.data.examId)}`);
  }

  if (error) {
    return (
      <Section>
        <p className="text-sm" style={{ color: "var(--color-ink-muted)" }}>
          {error}
        </p>
      </Section>
    );
  }

  if (!pool) {
    return (
      <Section>
        <div
          className="h-40 animate-pulse rounded-lg"
          style={{ background: "var(--color-line)", opacity: 0.35 }}
        />
      </Section>
    );
  }

  return (
    <Section>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-heebo text-lg font-bold" style={{ color: "var(--color-navy-ink)" }}>
            שאלון מותאם אישית לבנייה
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-muted)" }}>
            בחרו כמה שאלות לקחת מכל תחום — בדיוק {EXAM_LENGTH} שאלות, מתוך{" "}
            {pool.total} הקיימות ב{subjectLabel}.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="outline" size="sm" onClick={autoFill}>
            מלא אוטומטית
          </Button>
          {/* Says which rule the button follows, because the two produce
              noticeably different papers and the candidate cannot tell which
              they got by looking at the numbers. */}
          <span className="text-[11px]" style={{ color: "var(--color-ink-muted)" }}>
            {lastSitting.length
              ? "מדגיש תחומים חלשים מהמבחן האחרון"
              : "מחלק לפי גודל המאגר"}
          </span>
        </div>
      </header>

      {/* The pool is the binding constraint today, and saying so is more use
          than letting the candidate discover it box by box. */}
      {poolTooSmall ? (
        <p
          className="mb-3 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "var(--color-status-weak)",
            color: "var(--color-status-weak)",
          }}
        >
          במאגר {pool.total} שאלות בלבד — פחות מ־{EXAM_LENGTH}. לא ניתן לבנות מבחן מלא עדיין.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {pool.areas.map(({ area, available }) => {
          const value = counts[area] ?? 0;
          return (
            <label
              key={area}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
              style={{ background: value > 0 ? "var(--bg-soft)" : undefined }}
            >
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--color-ink-dim)" }}>
                {area}
              </span>
              <span className="shrink-0 font-mono text-[11px]" style={{ color: "var(--color-ink-muted)" }}>
                מתוך {available}
              </span>
              {/* A select rather than a free number field: every option it
                  offers is one the pool can actually fill, so an impossible
                  request cannot be typed in the first place. */}
              <select
                value={value}
                onChange={(e) => setArea(area, Number(e.target.value), available)}
                className="w-16 shrink-0 rounded-md border px-2 py-1 text-sm"
                style={{ borderColor: "var(--color-line)", background: "var(--card)" }}
                aria-label={`מספר שאלות מתוך ${area}`}
              >
                {Array.from({ length: available + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--color-line)" }}>
        <p className="text-sm" style={{ color: exact ? "var(--color-status-strong)" : "var(--color-ink-dim)" }}>
          נבחרו <strong className="font-mono tabular-nums">{chosen}</strong> / {EXAM_LENGTH}
          {exact ? " — אפשר לבנות" : remaining > 0 ? ` · חסרות ${remaining}` : ` · יש ${-remaining} יותר מדי`}
        </p>
        <Button
          onClick={handleBuild}
          disabled={!exact || building}
          className={cn(!exact && "opacity-60")}
        >
          {building ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Wand2 className="size-4" aria-hidden />
          )}
          <span className="ms-1.5">{building ? "בונה…" : "בנה מבחן"}</span>
        </Button>
      </footer>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl"
      style={{
        background: "var(--card)",
        border: "1px solid var(--color-line)",
        padding: "16px 18px",
      }}
    >
      {children}
    </section>
  );
}
