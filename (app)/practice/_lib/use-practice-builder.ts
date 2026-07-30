"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPracticeSession,
  getAvailableQuestionCount,
} from "@/lib/api/practice";
import type { PrefillInput } from "@/lib/urls";

// =============================================================================
// Public types — re-exported so the renderer can stay in TypeScript-land
// without re-declaring the same primitives. Phase P1 lift from
// `practice-setup-form.tsx` — values verbatim, no behaviour change.
// =============================================================================

export type ChapterRow = {
  id: string;
  code: string;
  title: string;
  display_order: number;
  /**
   * Count of active+current source_questions for this chapter under the
   * caller's RLS view. `0` means "(בקרוב)" — chapter exists in the
   * taxonomy but isn't content-populated yet; the chip renders disabled
   * and cannot be toggled into selection.
   */
  activeQuestionCount: number;
};

export type SubtopicRow = {
  id: string;
  chapter_id: string;
  code: string;
  title: string;
  display_order: number;
};

export const SOURCE_COUNT_CHOICES = [1, 2, 5, 10, 20, 50] as const;
export type SourceCount = (typeof SOURCE_COUNT_CHOICES)[number];

export const ANGLE_CHOICES = [0, 1, 2, 3, 4] as const;
export type AngleCount = (typeof ANGLE_CHOICES)[number];

// Phase 9c — defaults bumped down toward "quick start" sizing per PM.
export const DEFAULT_SOURCE_COUNT: SourceCount = 5;
export const DEFAULT_ANGLES: AngleCount = 2;
export const DEFAULT_TIME_SECONDS = 150;
export const TIME_MIN = 60;
export const TIME_MAX = 300;
export const TIME_STEP = 15;
export const AVAILABILITY_DEBOUNCE_MS = 300;
export const MIN_QUESTIONS_REQUIRED: SourceCount = SOURCE_COUNT_CHOICES[0];

// =============================================================================
// Slice 18 — single "כמות שאלות" picker.
// Slice 23 — opens the picker to free numeric input.
// =============================================================================
// Sharon's decision: the user picks ONE "total questions" number. The
// engine signature (sourceCountTarget + anglesPerSource) stays
// unchanged; angles is locked to DEFAULT_ANGLES (2) and is no longer
// user-editable. The preset chips are deliberately set to
// SOURCE_COUNT_CHOICES × (1 + DEFAULT_ANGLES) = [1,2,5,10,20,50] × 3,
// so picking a preset still lands on an exact engine multiple. The
// new free input lets the user type any integer in
// [MIN_TOTAL_QUESTIONS_INPUT, MAX_TOTAL_QUESTIONS_INPUT]; when the
// typed number isn't a multiple of (1 + angles) the derivation
// rounds to the nearest source count via `totalToSourceCount`, and
// the resolved `total` returned from the hook is the true engine
// output (sourceCount × (1 + angles)) — which is what the UI must
// display for truth-in-display.
export const TOTAL_QUESTION_CHOICES = [3, 6, 15, 30, 60, 150] as const;
export type TotalQuestionCount = (typeof TOTAL_QUESTION_CHOICES)[number];

/**
 * Slice 59 B — native-dropdown presets for the new question-count
 * selector. PM-locked values; the engine still resolves
 * sourceCount = round(total/3), so 5→6, 10→9, 40→39 effective
 * questions (only 30 is exact). The CountsPanel renders a "≈ {total}
 * שאלות בפועל" caption so users see the truthful resolved count;
 * submit + summary footer continue to use the engine's `total`. */
export const TOTAL_QUESTION_DROPDOWN_PRESETS = [5, 10, 30, 40] as const;

export const DEFAULT_TOTAL_QUESTIONS = 10;
export const MIN_TOTAL_QUESTIONS_REQUIRED = TOTAL_QUESTION_CHOICES[0];

/** Slice 23 — input clamp for the free numeric field. 1 is the
 *  smallest non-trivial value (the engine still resolves to 3 via
 *  the `max(1, …)` floor in totalToSourceCount, and the truth-in-
 *  display feedback explains the bump). 200 is a sane upper bound
 *  for practice sessions — anything larger isn't a single sitting. */
export const MIN_TOTAL_QUESTIONS_INPUT = 1;
export const MAX_TOTAL_QUESTIONS_INPUT = 200;

/** Defensive clamp used by `setRawTotal` so callers (typed input,
 *  preset chips, prefill seeding) all funnel through one bound. */
export function clampTotalInput(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_TOTAL_QUESTIONS;
  const intval = Math.round(n);
  return Math.max(
    MIN_TOTAL_QUESTIONS_INPUT,
    Math.min(MAX_TOTAL_QUESTIONS_INPUT, intval)
  );
}

/** Slice 61 — derive sourceCountTarget from a chosen total. CEIL
 *  (not round): we want ENOUGH sources to cover the requested total
 *  so the server can trim the streamed question_list to EXACTLY
 *  `total` items. With angles=2 the math is:
 *    total=5  → ceil(5/3)  = 2 sources → 6 items built → trim to 5
 *    total=10 → ceil(10/3) = 4 sources → 12 items built → trim to 10
 *    total=30 → ceil(30/3) = 10 sources → 30 items (no trim)
 *    total=40 → ceil(40/3) = 14 sources → 42 items built → trim to 40
 *  The server may also need to oversample further when sources have
 *  fewer than `anglesPerSource` angles in the DB — see
 *  createPracticeSession for the streaming/cap loop. */
export function totalToSourceCount(total: number): number {
  return Math.max(1, Math.ceil(total / (1 + DEFAULT_ANGLES)));
}

// =============================================================================
// Slice 24 — per-session timer ("זמן לסשן").
// =============================================================================
// Wall-clock model: a single budget in seconds attached to the
// session at creation time. The server computes remaining on each
// play-page render as `max(0, sessionDurationSeconds - (now -
// started_at))`. The builder hold seconds; the timer panel UI lets
// the user type in MINUTES for legibility.
//
// 0 = "no timer" (the off state in the panel); the DB column defaults
// to 0 so every pre-Slice-24 session keeps its no-timer behavior.
// 14400s (4h) matches the DB CHECK constraint.
export const SESSION_TIMER_OFF = 0;
export const SESSION_DURATION_MIN_SECONDS = 60; // 1 minute floor when on
export const SESSION_DURATION_MAX_SECONDS = 14400; // 4 hours
export const DEFAULT_SESSION_DURATION_SECONDS = 15 * 60; // 15 min
export const SESSION_DURATION_PRESETS_MINUTES = [5, 15, 30, 60, 90] as const;

export function clampSessionDurationSeconds(n: number): number {
  if (!Number.isFinite(n)) return SESSION_TIMER_OFF;
  const intval = Math.round(n);
  if (intval <= 0) return SESSION_TIMER_OFF;
  return Math.max(
    SESSION_DURATION_MIN_SECONDS,
    Math.min(SESSION_DURATION_MAX_SECONDS, intval)
  );
}

// =============================================================================
// Pure helpers — no React; exported so they can pick up unit tests later
// without rebuilding the hook plumbing.
// =============================================================================

/**
 * Stable fingerprint string for the current chapter+subtopic selection.
 * Used to key availability lookups so a stale response can't appear to
 * apply to a newer selection.
 */
export function selectionFingerprint(
  chapterIds: string[],
  subtopicId: string | null
): string {
  return [...chapterIds].sort().join(",") + "|" + (subtopicId ?? "*");
}

export function isSourceCount(n: number): n is SourceCount {
  return (SOURCE_COUNT_CHOICES as readonly number[]).includes(n);
}

export function isAngleCount(n: number): n is AngleCount {
  return (ANGLE_CHOICES as readonly number[]).includes(n);
}

/**
 * Seeds the initial selection — drops prefill chapter ids that don't
 * exist OR are empty (those can't be toggled by the user, and silently
 * pre-selecting them would let "0 שאלות זמינות" reach the submit gate).
 *
 * Phase 9c A1: when the filtered prefill is empty, fall back to the
 * first chapter by display_order that actually has content. The form
 * never starts with zero chapters selected if any populated chapter exists.
 */
export function deriveInitialChapters(
  chapters: ChapterRow[],
  prefill: PrefillInput | null | undefined
): string[] {
  const fromPrefill = prefill?.chapters?.filter((id) =>
    chapters.some((c) => c.id === id && c.activeQuestionCount > 0)
  );
  if (fromPrefill && fromPrefill.length > 0) return fromPrefill;
  const firstPopulated = chapters
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .find((c) => c.activeQuestionCount > 0);
  return firstPopulated ? [firstPopulated.id] : [];
}

// =============================================================================
// usePracticeBuilder — single source of truth for the form's state.
// =============================================================================

export type UsePracticeBuilderResult = {
  // Raw + derived selection
  selectedChapterIds: string[];
  toggleChapter: (id: string) => void;
  /** Slice 34 — bulk select-all (only selectable chapters with
   *  `activeQuestionCount > 0`; "בקרוב" chapters are skipped). */
  selectAllChapters: () => void;
  /** Slice 34 — clears the chapter selection. Companion to
   *  `selectAllChapters` for the header toggle button. */
  clearAllChapters: () => void;
  rawSubtopicId: string | null;
  setRawSubtopicId: (id: string | null) => void;
  effectiveSubtopicId: string | null;
  subtopicsForSelected: SubtopicRow[];

  // Counts — Slice 18 collapses the prior two-axis (source × angles)
  // picker into a single "כמות שאלות" total. Slice 23 opens the
  // picker to free numeric input — `rawTotal` is now any integer in
  // [MIN_TOTAL_QUESTIONS_INPUT, MAX_TOTAL_QUESTIONS_INPUT] (clamped
  // by the setter). `angles` stays internal, locked to DEFAULT_ANGLES,
  // and is passed to the engine unchanged.
  rawTotal: number;
  setRawTotal: (n: number) => void;
  /** Same as `total` — kept for back-compat with callers that
   *  destructured the Slice 18 name. */
  effectiveTotal: number;

  // Per-question timer — Slice 24 marks this LEGACY. Still held in
  // state because `createPracticeSession` keeps writing it (the DB
  // column is NOT NULL with a default), but the play UI no longer
  // reads it. Kept on the result so any consumer that destructured
  // it pre-Slice-24 doesn't break.
  timeSeconds: number;
  setTimeSeconds: (n: number) => void;

  // Per-session timer — Slice 24. The active timer the play screen
  // surfaces. 0 = no timer ("ללא טיימר").
  sessionDurationSeconds: number;
  setSessionDurationSeconds: (n: number) => void;

  // Availability (server-derived)
  available: number | null;
  isCountPending: boolean;
  hasSelection: boolean;
  insufficient: boolean;

  // The actual number of questions the engine will produce.
  // Derived as `effectiveSourceCount × (1 + angles)`, so when the
  // user's typed `rawTotal` isn't a multiple of (1 + angles) the
  // resolved `total` rounds via `totalToSourceCount`. The summary
  // footer renders this number (truth-in-display); the counts
  // panel can compare `rawTotal` against `total` to surface the
  // rounding hint.
  total: number;

  // Submit
  submit: () => Promise<void>;
  submitting: boolean;
  submitDisabled: boolean;
};

export type UsePracticeBuilderArgs = {
  chapters: ChapterRow[];
  subtopics: SubtopicRow[];
  initialValues?: PrefillInput | null;
};

/**
 * Slice 5 Phase P1 — Headless builder state. Lifts every piece of
 * stateful behaviour out of `practice-setup-form.tsx` (7 useState,
 * 1 useTransition, 1 useRef, 1 useEffect) into a single hook so the
 * upcoming visual rebuild can swap the renderer without re-deriving
 * the contracts.
 *
 * The availability `useEffect` keeps its `generationRef` race-guard
 * verbatim — out-of-order resolutions of `getAvailableQuestionCount`
 * MUST be ignored, otherwise a slower stale lookup can clobber the
 * answer for the current selection.
 *
 * The submit path also stays a 1:1 lift — same payload, same
 * `window.location.assign` full-page navigation on success, same toast
 * on failure. Visual code never sees the action; the hook hands back
 * `submit`, `submitting`, and `submitDisabled` and that's it.
 */
export function usePracticeBuilder({
  chapters,
  subtopics,
  initialValues,
}: UsePracticeBuilderArgs): UsePracticeBuilderResult {
  // ---------- initial seeds (run once on mount via useState initializer) ----------
  const initialChapters = useMemo(
    () => deriveInitialChapters(chapters, initialValues),
    // chapters + initialValues are stable for the lifetime of the
    // page (server-rendered props), so this memo runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const initialSubtopic =
    initialValues?.subtopic &&
    initialChapters.length === 1 &&
    subtopics.some(
      (s) =>
        s.id === initialValues.subtopic && s.chapter_id === initialChapters[0]
    )
      ? initialValues.subtopic
      : null;
  // Slice 18 — angles is locked to the default and no longer
  // user-editable, but we still read prefill `angles` to derive an
  // accurate initial total when a "retry session" URL carries the
  // original two-axis sizing.
  // Slice 23 — no longer snaps to TOTAL_QUESTION_CHOICES. The free
  // input accepts any clamped integer, so prefill maps straight
  // through `clampTotalInput` and the user sees the original sizing.
  const prefillAngles: AngleCount =
    initialValues?.angles !== undefined && isAngleCount(initialValues.angles)
      ? initialValues.angles
      : DEFAULT_ANGLES;
  const prefillSourceCount: SourceCount =
    initialValues?.sourceCount !== undefined &&
    isSourceCount(initialValues.sourceCount)
      ? initialValues.sourceCount
      : DEFAULT_SOURCE_COUNT;
  // Slice 61 — preferred prefill is `total` (the truthful item count
  // from a prior session's question_list.length). Legacy callers that
  // still pass `sourceCount` (pre-Slice-61 URLs / bookmarks) map
  // through the historical `sourceCount × (1 + angles)` derivation
  // for behavior parity.
  const initialTotal: number =
    initialValues?.total !== undefined
      ? clampTotalInput(initialValues.total)
      : initialValues?.sourceCount !== undefined
        ? clampTotalInput(prefillSourceCount * (1 + prefillAngles))
        : DEFAULT_TOTAL_QUESTIONS;
  const initialTime: number =
    initialValues?.timePerQuestion !== undefined
      ? Math.min(TIME_MAX, Math.max(TIME_MIN, initialValues.timePerQuestion))
      : DEFAULT_TIME_SECONDS;

  // ---------- core state ----------
  const [selectedChapterIds, setSelectedChapterIds] =
    useState<string[]>(initialChapters);
  const [rawSubtopicId, setRawSubtopicId] = useState<string | null>(
    initialSubtopic
  );
  // Slice 23 — rawTotal is now any clamped integer in the input
  // range, not one of the fixed TOTAL_QUESTION_CHOICES. We hold the
  // raw setter as an internal then expose a wrapped public setter
  // that funnels every write through `clampTotalInput`.
  const [rawTotal, setRawTotalState] = useState<number>(initialTotal);
  const setRawTotal = (n: number): void => {
    setRawTotalState(clampTotalInput(n));
  };
  const [timeSeconds, setTimeSeconds] = useState<number>(initialTime);
  // Slice 24 — per-session timer state. Default to the off state;
  // prefill / retry flows don't carry a session timer setting yet.
  const [sessionDurationSeconds, setSessionDurationSecondsState] =
    useState<number>(SESSION_TIMER_OFF);
  const setSessionDurationSeconds = (n: number): void => {
    setSessionDurationSecondsState(clampSessionDurationSeconds(n));
  };
  // angles is locked — kept in a const, not state. Engine still
  // receives it via the unchanged createPracticeSession signature.
  const angles: AngleCount = DEFAULT_ANGLES;

  // Availability response carries the fingerprint it was computed for —
  // a stale response can't appear to apply to a newer selection.
  const [availabilityResponse, setAvailabilityResponse] = useState<{
    count: number;
    fingerprint: string;
  } | null>(null);
  const [isCountPending, startCountTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  // ---------- derived ----------
  const subtopicsForSelected = useMemo(() => {
    if (selectedChapterIds.length !== 1) return [];
    const chapterId = selectedChapterIds[0];
    return subtopics.filter((s) => s.chapter_id === chapterId);
  }, [selectedChapterIds, subtopics]);

  const effectiveSubtopicId =
    selectedChapterIds.length === 1 &&
    rawSubtopicId !== null &&
    subtopicsForSelected.some((s) => s.id === rawSubtopicId)
      ? rawSubtopicId
      : null;

  const currentFingerprint = selectionFingerprint(
    selectedChapterIds,
    effectiveSubtopicId
  );
  const hasSelection = selectedChapterIds.length > 0;
  const available =
    hasSelection &&
    availabilityResponse &&
    availabilityResponse.fingerprint === currentFingerprint
      ? availabilityResponse.count
      : null;

  // Clamp the user's typed total down to the producible ceiling when
  // their previous pick exceeds availability. `available` is the
  // count of distinct source questions in the selection; max
  // producible total = available × (1 + angles).
  //
  // Slice 23: with free numeric input, `effectiveTotal` is the raw
  // typed value clamped by availability (still un-rounded relative
  // to engine multiples). The final `total` below derives via
  // `totalToSourceCount` and multiplies back, so the rounding step
  // is observable as `total !== rawTotal` for the truth-in-display
  // hint in the counts panel.
  const maxTotal = available !== null ? available * (1 + angles) : null;
  const effectiveTotal: number =
    maxTotal !== null &&
    maxTotal >= MIN_TOTAL_QUESTIONS_REQUIRED &&
    rawTotal > maxTotal
      ? maxTotal
      : rawTotal;
  // Engine still expects sourceCountTarget + anglesPerSource. Derive
  // it from the (availability-clamped) effective total. When the
  // user's typed number isn't a multiple of (1 + angles), `Math.round`
  // inside the helper snaps to the nearest source count.
  const effectiveSourceCount = totalToSourceCount(effectiveTotal);

  // ---------- reactive availability lookup (race-guarded) ----------
  const generationRef = useRef(0);
  useEffect(() => {
    if (selectedChapterIds.length === 0) return;
    const gen = ++generationRef.current;
    const fingerprint = currentFingerprint;
    const timeoutId = setTimeout(() => {
      startCountTransition(async () => {
        const result = await getAvailableQuestionCount({
          chapterIds: selectedChapterIds,
          subtopicId: effectiveSubtopicId,
        });
        if (gen !== generationRef.current) return;
        if (result.ok) {
          setAvailabilityResponse({ count: result.count, fingerprint });
        } else {
          setAvailabilityResponse({ count: 0, fingerprint });
          toast.error(result.error);
        }
      });
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [selectedChapterIds, effectiveSubtopicId, currentFingerprint]);

  // ---------- actions ----------
  function toggleChapter(id: string) {
    setSelectedChapterIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  }

  /**
   * Slice 34 — select every non-disabled chapter at once. Mirrors what
   * a user would get by manually toggling all the populated cards.
   * Disabled ("בקרוב") chapters stay out because they can't yield
   * questions; including them would break the submit gate.
   *
   * Interaction note: subtopic gating uses `selectedChapterIds.length
   * === 1`, so calling this with more than one populated chapter
   * collapses the subtopic panel — same semantics as if the user
   * had toggled chapters one-by-one past the single-chapter mark.
   */
  function selectAllChapters() {
    setSelectedChapterIds(
      chapters.filter((c) => c.activeQuestionCount > 0).map((c) => c.id)
    );
  }

  /** Slice 34 — companion to `selectAllChapters`. Empties the
   *  selection so the header button can toggle between the two
   *  states based on whether all-selectable are currently selected. */
  function clearAllChapters() {
    setSelectedChapterIds([]);
  }

  // Slice 61 — `total` is the literal user-picked total (clamped by
  // availability). The server samples `sourceCountTarget = ceil(total
  // / 3)` sources, builds the question_list streaming-style, and
  // trims to EXACTLY this many items. There's no longer a drift step
  // (the prior `round(total/3) × 3` formula rewrote the user's pick
  // to the nearest multiple of 3); the displayed total now matches
  // what the user receives.
  const total = effectiveTotal;

  // Submit blockers: no chapters, no availability yet, availability
  // below the smallest count button, or a request already in-flight.
  // `insufficient` is keyed on the producible total so the helper
  // text matches the picker semantics.
  const insufficient =
    maxTotal !== null && maxTotal < MIN_TOTAL_QUESTIONS_REQUIRED;
  const submitDisabled =
    selectedChapterIds.length === 0 ||
    available === null ||
    insufficient ||
    submitting;

  async function submit() {
    if (submitDisabled) return;
    setSubmitting(true);
    const result = await createPracticeSession({
      selectedChapterIds,
      selectedSubtopicId: effectiveSubtopicId,
      sourceCountTarget: effectiveSourceCount,
      anglesPerSource: angles,
      // Slice 61 — the truthful item-count target. Server trims the
      // streamed question_list to exactly this length whenever the
      // selected chapters can produce ≥ that many items.
      totalQuestions: effectiveTotal,
      // Slice 24 — `timePerQuestionSeconds` is still required by the
      // schema (the DB column is NOT NULL); the play UI no longer
      // reads it. The active timer the user sees is the session-level
      // one keyed by `sessionDurationSeconds`.
      timePerQuestionSeconds: DEFAULT_TIME_SECONDS,
      sessionDurationSeconds,
    });
    if (!result.ok) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }
    // Full-page navigation — matches Slice 1's
    // window.location.assign(result.url) pattern (verifyOtpAction,
    // completeGoogleOAuthSignup) for cross-segment routing.
    window.location.assign(result.url);
  }

  return {
    selectedChapterIds,
    toggleChapter,
    selectAllChapters,
    clearAllChapters,
    rawSubtopicId,
    setRawSubtopicId,
    effectiveSubtopicId,
    subtopicsForSelected,
    rawTotal,
    setRawTotal,
    effectiveTotal,
    timeSeconds,
    setTimeSeconds,
    sessionDurationSeconds,
    setSessionDurationSeconds,
    available,
    isCountPending,
    hasSelection,
    insufficient,
    total,
    submit,
    submitting,
    submitDisabled,
  };
}
