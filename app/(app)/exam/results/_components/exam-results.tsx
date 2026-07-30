"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Play,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ChoiceAnalysisRow } from "@/app/(app)/_components/choice-analysis-row";
import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { RowNotePencil } from "@/app/(app)/_components/row-note-pencil";
import { notedIdentityKey } from "@/lib/db/notes";
import { createExamSession } from "@/lib/api/exam";
import { Learning360Panel } from "@/app/(app)/practice/play/_components/learning-360-panel";
import { Button } from "@/components/ui/button";
import type { ExamResultsAggregate, ExamReviewRow } from "@/lib/db/exam";
import { EXAM_TOTAL_QUESTIONS, type ExamMode } from "@/lib/exam/clusters";
import { cn } from "@/lib/utils";

/**
 * PM-revised UX (Phase 4 hotfix v2): show 5 rows by default — each row
 * now carries a question-text excerpt in the middle column, so the
 * default view is meaningful rather than 8 lines of position+pill with
 * an empty band between them.
 */
const REVIEW_INITIAL_ROWS = 5;

type Props = {
  aggregate: ExamResultsAggregate;
  /** Slice 38 — set of identity keys (`source:${id}` /
   *  `angle:${id}:${pos}`) for which the user already has a note.
   *  Drives the pencil's filled state. */
  notedIdentities: Set<string>;
};

const STATUS_COPY: Record<string, { label: string; classes: string }> = {
  correct: {
    label: "נכון",
    classes:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  wrong: {
    label: "שגוי",
    classes:
      "bg-destructive/15 text-destructive",
  },
  skipped: {
    label: "דולג",
    classes: "bg-muted text-muted-foreground",
  },
  unanswered: {
    label: "לא נענה",
    classes: "bg-muted text-muted-foreground",
  },
};

/**
 * Final exam results screen.
 *
 * Sections:
 *   A. Hero: pass/fail pill + big score + percent + time + threshold.
 *   B. Per-chapter performance list (Slice 9 follow-up — replaces the
 *      prior cluster cards). One compact row per chapter with ≥1
 *      question in the session: chapter title on the start side,
 *      correct/total on the end side, with a slim progress bar below.
 *      Identical layout across all three modes (procedural / substantive
 *      / combined). Real bar exams never surface "אשכול" labels to
 *      candidates, so we don't either.
 *   C. Review list — each row [position #][excerpt][status pill]
 *      with an inline expansion panel below (Slice 7.6) showing the
 *      full question + all 4 choices with their distractor analyses.
 *      Multiple rows can be expanded simultaneously.
 *   D. Footer CTAs: dashboard + new exam.
 *
 * History: the layout was locked in Phase 4 with cluster cards + no
 * drill-in. Slice 7.6 added per-question inline expansion. Slice 9
 * follow-up swapped the cluster cards for the per-chapter list.
 */
const HERO_EYEBROW_BY_MODE: Record<ExamMode, string> = {
  procedural: "סימולציית בחינה",
  substantive: "סימולציית בחינה — דין מהותי",
  combined: "סימולציה משולבת",
};

export function ExamResults({ aggregate, notedIdentities }: Props) {
  const { session, byPosition, byChapter } = aggregate;
  const score = session.final_score ?? 0;
  const total = EXAM_TOTAL_QUESTIONS;
  const passed = session.passed === true;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const minutesUsed = Math.max(0, Math.round(session.time_used_seconds / 60));
  const heroEyebrow = HERO_EYEBROW_BY_MODE[session.mode] ?? HERO_EYEBROW_BY_MODE.procedural;

  const [creating, setCreating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Slice 7.6 — expanded position indices. Non-exclusive: the user
  // can open multiple rows at once.
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [, startTransition] = useTransition();

  function toggleExpanded(position: number): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  const visibleRows = showAll
    ? byPosition
    : byPosition.slice(0, REVIEW_INITIAL_ROWS);
  const hasHiddenRows = !showAll && byPosition.length > REVIEW_INITIAL_ROWS;

  function handleAnother(): void {
    if (creating) return;
    setCreating(true);
    startTransition(async () => {
      // PM-confirmed: "another simulation" reuses the mode of the
      // finished session so a substantive-mode user staying in flow
      // doesn't unexpectedly drop back to procedural.
      const result = await createExamSession({ mode: session.mode });
      if (!result.ok) {
        toast.error(
          result.error === "exam_pool_insufficient"
            ? "אין מספיק שאלות במאגר לסימולציה כרגע"
            : "אירעה שגיאה. נסה שוב"
        );
        setCreating(false);
        return;
      }
      try {
        window.localStorage.setItem(
          `lawpass.exam.${result.sessionId}.windowToken`,
          result.windowToken
        );
      } catch {
        // localStorage unavailable — Phase 5 hardens the fallback.
      }
      window.location.assign(result.url);
    });
  }

  return (
    <>
      {/* Sticky top bar — dashboard affordance pinned to the viewport
          so it stays reachable while the user scrolls through 40
          review rows. The (app) layout's /exam/* branch renders
          <main> with no sidebar and no sticky header, so `top-0`
          lands cleanly against the viewport edge with no offset.

          Full-width navy chrome: the bar lives OUTSIDE the
          max-w-3xl content container as its own sibling under
          <main>, with `-mx-6` to cancel the layout's `p-6`
          horizontal padding — so the navy stripe bleeds edge-to-
          edge across the viewport. The button stays centered with
          the rest of the page via an inner `mx-auto max-w-3xl`
          wrapper, so it aligns with the hero + review list below.
          (Slice 17 polish 2 — Slice 17 C2 follow-up had the bar
          inside max-w-3xl, which clamped it to ~768px.)

          Navy chrome (bg-primary / text-primary-foreground) matches
          the exam-play sticky header at exam-header.tsx:64, so both
          sticky bars in the exam flow share the same visual idiom
          instead of blending into the page surface.

          Uses window.location.assign (NOT <Link>) for the same
          reason the footer CTAs do: the (app) layout reads a stale
          x-pathname on client-side <Link> transitions and the
          sidebar stays hidden. See the footer comment below.
          Icon: lucide ArrowRight — in RTL Hebrew it visually points
          right, which reads as "back" in the script direction. */}
      <div className="sticky top-0 z-30 -mx-6 bg-primary py-2 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-3xl items-center px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.assign("/dashboard");
            }}
            className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
          >
            <ArrowRight className="size-4" aria-hidden />
            <span className="ms-1.5">חזרה לדשבורד</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
        {/* A. Hero */}
        <header className="space-y-3 text-center">
        <div
          className={cn(
            "mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
            passed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-destructive/15 text-destructive"
          )}
        >
          {passed ? (
            <>
              <Check className="size-4" aria-hidden />
              <span>עברת</span>
            </>
          ) : (
            <>
              <X className="size-4" aria-hidden />
              <span>לא עברת</span>
            </>
          )}
        </div>
        <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {heroEyebrow}
        </p>
        {/* Slice 59 D — single stable unit rendering total/score so
            the visual order is deterministic in any bidi context.
            The previous two-flex-children pattern reversed visually
            under the document's dir="rtl", scattering the slash from
            the score and producing inconsistent reading. <bdi
            dir="ltr"> isolates the score/total run as a single LTR
            atom; PM locked the operand order as total-then-score
            ("40/0", "40/30") for this hero. */}
        <div className="flex items-baseline justify-center">
          <span className="text-5xl font-bold tabular-nums sm:text-7xl">
            <bdi dir="ltr">
              {total}/{score}
            </bdi>
          </span>
        </div>
        <p className="text-sm text-muted-foreground" dir="auto">
          {pct}% · סף מעבר: 60% (24/40) · משך: {minutesUsed} דקות
        </p>
      </header>

      {/* B. Per-chapter performance — uniform across all three modes.
          Compact rows (not cards) so combined mode's ~15-chapter list
          stays readable. Title on the start side, correct/total on the
          end side, slim progress bar below. */}
      {byChapter.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">ביצועים לפי נושא</h2>
          </header>
          <ul>
            {byChapter.map((chapter, idx) => {
              const chapterPct =
                chapter.total > 0
                  ? Math.round((chapter.correct / chapter.total) * 100)
                  : 0;
              const isLastRow = idx === byChapter.length - 1;
              return (
                <li
                  key={chapter.chapterCode}
                  className={cn(
                    "px-5 py-3",
                    !isLastRow && "border-b border-border/70"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span dir="auto" className="font-medium text-foreground/90">
                      {chapter.chapterTitle}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {chapter.correct}/{chapter.total}
                      <span className="ms-2 text-xs">({chapterPct}%)</span>
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    aria-label={`${chapterPct}%`}
                  >
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${chapterPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* C. Question review — Slice 7.6: rows are clickable to reveal
          an inline panel with full question text + 4 choices and
          their distractor analyses. */}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">סקירת שאלות</h2>
        </header>
        <ul>
          {visibleRows.map((row, idx) => {
            const meta = STATUS_COPY[row.status] ?? STATUS_COPY.unanswered;
            // Border on every row except the visual last — when
            // `hasHiddenRows`, the expand button sits below the list
            // and we still want the divider above it.
            const isLast = idx === visibleRows.length - 1 && !hasHiddenRows;
            const isOpen = expanded.has(row.position);
            return (
              <li
                key={row.position}
                className={cn(!isLast && "border-b border-border/70")}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(row.position)}
                  aria-expanded={isOpen}
                  className={cn(
                    "grid w-full grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 px-5 py-3 text-start text-sm transition-colors",
                    "hover:bg-muted/40",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                >
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {String(row.position + 1).padStart(2, "0")}
                  </span>
                  <span
                    dir="auto"
                    className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground"
                  >
                    {row.excerpt}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      meta.classes
                    )}
                  >
                    {meta.label}
                  </span>
                  {isOpen ? (
                    <ChevronUp
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  ) : (
                    <ChevronDown
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </button>
                {isOpen ? (
                  <QuestionExpansion
                    row={row}
                    notedIdentities={notedIdentities}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {hasHiddenRows && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 px-5 py-3 text-sm font-medium text-primary/80 transition-colors",
              "hover:bg-muted/40 hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <span>הצג את כל {byPosition.length} השאלות</span>
            <ChevronDown className="size-4" aria-hidden />
          </button>
        )}
      </section>

      {/* D. Footer CTAs.
          Both use window.location.assign (hard nav) rather than <Link>
          or router.push. Reason: the (app) layout's sidebar branch
          reads `headers().get('x-pathname')`. Next.js App Router reuses
          the parent layout across client-side <Link> transitions
          between sibling pages, so the layout re-renders against a
          stale x-pathname='/exam/results/...' value — isExamRoute
          stays true and the sidebar stays hidden on /dashboard. Hard
          nav forces a fresh request through middleware so the new
          x-pathname='/dashboard' lands and the sidebar mounts. */}
      <div className="flex flex-col-reverse items-stretch gap-2 pb-10 sm:flex-row sm:justify-center">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            window.location.assign("/dashboard");
          }}
          className="sm:min-w-44"
        >
          חזור לדשבורד
        </Button>
        <Button
          size="lg"
          onClick={handleAnother}
          disabled={creating}
          className="sm:min-w-44"
        >
          <span>{creating ? "יוצר סימולציה..." : "סימולציה נוספת"}</span>
          {!creating && <Play className="ms-2 size-4" aria-hidden />}
        </Button>
      </div>
      </div>
    </>
  );
}

// =============================================================================
// Per-question expansion (Slice 7.6)
// =============================================================================

/**
 * The expanded panel rendered below a clicked row. Shows the full
 * question text and all four choices, each with its distractor
 * analysis. Indicator conventions per choice:
 *  - correct       → green ✓ accent (status-strong tokens)
 *  - selected wrong → red ✗ accent (status-weak tokens)
 *  - other wrong   → neutral (no accent)
 *
 * When `selectedLetter` is null (skipped or unanswered), only the
 * correct choice gets the ✓ accent; the rest are neutral.
 *
 * Slice 17 B-2 — below the choice list, mounts the full
 * `<Learning360Panel>` (the same 9-section panel rendered on
 * /practice/play after answer reveal). The panel is null-guarded
 * against archived rows where the server couldn't resolve the 360°
 * payload OR couldn't derive a correctChoice — in either case the
 * choice list above still renders, the 360° panel just sits out.
 */
function QuestionExpansion({
  row,
  notedIdentities,
}: {
  row: ExamReviewRow;
  notedIdentities: Set<string>;
}) {
  // Slice 17 polish — the 360° panel is collapsed by default behind a
  // toggle button, mirroring the practice-page pattern at
  // practice-question.tsx:455 (panel360Expanded + ChevronDown/Up).
  // State is row-local: each row's expansion mounts its own
  // QuestionExpansion instance, so per-row state lives here without
  // any prop drilling. Default closed.
  const [panel360Open, setPanel360Open] = useState(false);
  const canShowPanel =
    row.learning !== null && row.learning.correctChoice !== null;

  // Slice 38 — note pencil mounts alongside the 360° toggle. When the
  // row has no resolvable identity (archived parent), `RowNotePencil`
  // still renders but in disabled state — gives the user a consistent
  // affordance without misleading interaction.
  const noteIdentity = row.noteIdentity;
  const hasNote =
    noteIdentity !== null && notedIdentities.has(notedIdentityKey(noteIdentity));
  const noteContextLabel = `שאלה ${row.position + 1}`;

  return (
    <div className="border-t border-border/70 bg-muted/20 px-5 py-4">
      {row.questionText ? (
        /* Slice 37 — question stem wrapped in <NoCopyText>. */
        <NoCopyText
          dir="auto"
          className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
        >
          {row.questionText}
        </NoCopyText>
      ) : null}
      {row.choices.length > 0 ? (
        <ul className="space-y-2">
          {row.choices.map((choice) => (
            <li key={choice.letter}>
              <ChoiceAnalysisRow
                choice={choice}
                selectedLetter={row.selectedLetter}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          אין נתוני בחירות זמינים לשאלה זו.
        </p>
      )}
      {/* Slice 38 — bottom action row: 360° toggle (when available)
          on the visual-start side, the note pencil on the visual-end
          side. The pencil renders even when the 360° panel is not
          available so the note affordance is still reachable on
          archived/no-learning rows; it just lands without a
          companion toggle. The flex container's items-center +
          justify-between ensures stable alignment whether or not
          the 360° button is present. */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {canShowPanel ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setPanel360Open((v) => !v)}
            aria-expanded={panel360Open}
          >
            {panel360Open ? (
              <>
                <ChevronUp className="size-4" aria-hidden />
                <span className="ms-1.5">הסר פירוט</span>
              </>
            ) : (
              <>
                <ChevronDown className="size-4" aria-hidden />
                <span className="ms-1.5">פירוט 360° מלא</span>
              </>
            )}
          </Button>
        ) : (
          /* Empty start-side spacer so the pencil stays end-aligned
             via justify-between even when the 360° toggle hides. */
          <span aria-hidden />
        )}
        <RowNotePencil
          /* Convert the snake_case DB triple to the camelCase shape
             RowNotePencil expects (NoteIdentityPayload). When
             noteIdentity is null (archived) the pencil renders
             disabled — the dummy identity stays out of the click
             path because RowNotePencil short-circuits on `disabled`. */
          identity={
            noteIdentity
              ? {
                  questionType: noteIdentity.question_type,
                  sourceQuestionGroupId:
                    noteIdentity.source_question_group_id,
                  anglePosition: noteIdentity.angle_position,
                }
              : {
                  questionType: "source",
                  sourceQuestionGroupId: "",
                  anglePosition: null,
                }
          }
          initiallyHasNote={hasNote}
          disabled={noteIdentity === null}
          questionContextLabel={noteContextLabel}
        />
      </div>
      {canShowPanel && panel360Open ? (
        <div className="mt-3">
          <Learning360Panel
            question={{ ...row.learning!, choices: row.choices }}
            correctChoice={row.learning!.correctChoice!}
          />
        </div>
      ) : null}
    </div>
  );
}

// Slice 21 — ChoiceAnalysisRow extracted to
// app/(app)/_components/choice-analysis-row.tsx so the practice-summary
// page can reuse the same per-choice review row (with the Slice 19
// "סימנת" pill). Imported at the top of this file.
