"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPracticeSession,
  getAvailableQuestionCount,
} from "@/app/(app)/practice/_actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

type Chapter = {
  id: string;
  code: string;
  title: string;
  display_order: number;
};

type Subtopic = {
  id: string;
  chapter_id: string;
  code: string;
  title: string;
  display_order: number;
};

const SOURCE_COUNT_CHOICES = [5, 10, 20, 50] as const;
type SourceCount = (typeof SOURCE_COUNT_CHOICES)[number];

const ANGLE_CHOICES = [0, 1, 2, 3, 4] as const;
type AngleCount = (typeof ANGLE_CHOICES)[number];

const DEFAULT_SOURCE_COUNT: SourceCount = 10;
const DEFAULT_ANGLES: AngleCount = 3;
const DEFAULT_TIME_SECONDS = 150;
const TIME_MIN = 60;
const TIME_MAX = 300;
const TIME_STEP = 15;
const AVAILABILITY_DEBOUNCE_MS = 300;
const MIN_QUESTIONS_REQUIRED = SOURCE_COUNT_CHOICES[0];

// =============================================================================
// Helpers
// =============================================================================

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// =============================================================================
// Main
// =============================================================================

/**
 * Stable fingerprint string for the current chapter+subtopic selection.
 * Used to key availability lookups so a stale response can't appear to
 * apply to a newer selection.
 */
function selectionFingerprint(
  chapterIds: string[],
  subtopicId: string | null
): string {
  return [...chapterIds].sort().join(",") + "|" + (subtopicId ?? "*");
}

export function PracticeSetupForm({
  chapters,
  subtopics,
}: {
  chapters: Chapter[];
  subtopics: Subtopic[];
}) {
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [rawSubtopicId, setRawSubtopicId] = useState<string | null>(null);
  const [rawSourceCount, setRawSourceCount] = useState<SourceCount>(
    DEFAULT_SOURCE_COUNT
  );
  const [angles, setAngles] = useState<AngleCount>(DEFAULT_ANGLES);
  const [timeSeconds, setTimeSeconds] = useState<number>(DEFAULT_TIME_SECONDS);

  // Availability response carries the fingerprint it was computed for.
  // Reading code below clears it implicitly when the fingerprint doesn't
  // match the current selection — avoiding a setState-in-effect.
  const [availabilityResponse, setAvailabilityResponse] = useState<{
    count: number;
    fingerprint: string;
  } | null>(null);
  const [isCountPending, startCountTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  // Derived values — all computed during render so the effect below only
  // owns the async fetch (which the react-hooks/set-state-in-effect rule
  // allows because the setState lives inside an awaited callback, not
  // the synchronous effect body).
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

  // Clamp the source count to the highest enabled choice when the user's
  // previous pick now exceeds availability. Pure derivation: rawSourceCount
  // stays in state; effectiveSourceCount is what the UI shows + submits.
  const effectiveSourceCount: SourceCount = (() => {
    if (available === null) return rawSourceCount;
    if (available < MIN_QUESTIONS_REQUIRED) return rawSourceCount;
    if (rawSourceCount <= available) return rawSourceCount;
    const highest = [...SOURCE_COUNT_CHOICES]
      .reverse()
      .find((n) => n <= available);
    return (highest ?? rawSourceCount) as SourceCount;
  })();

  // Reactive availability lookup. Debounced; generation token guards
  // against out-of-order resolutions. The setAvailabilityResponse calls
  // happen inside the async transition callback (not the effect's
  // synchronous body), which the lint rule permits.
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

  function toggleChapter(id: string) {
    setSelectedChapterIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  }

  const total = effectiveSourceCount * (1 + angles);
  const estMinutes = Math.max(1, Math.round((total * timeSeconds) / 60));

  // Submit blockers: no chapters, no availability yet, availability
  // below the smallest count button, or a request already in-flight.
  const insufficient =
    available !== null && available < MIN_QUESTIONS_REQUIRED;
  const submitDisabled =
    selectedChapterIds.length === 0 ||
    available === null ||
    insufficient ||
    submitting;

  async function handleSubmit() {
    if (submitDisabled) return;
    setSubmitting(true);
    const result = await createPracticeSession({
      selectedChapterIds,
      selectedSubtopicId: effectiveSubtopicId,
      sourceCountTarget: effectiveSourceCount,
      anglesPerSource: angles,
      timePerQuestionSeconds: timeSeconds,
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

  return (
    <div className="space-y-4">
      {/* Chapters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">פרקים</CardTitle>
          <CardDescription>בחר אחד או יותר</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((chapter) => {
              const selected = selectedChapterIds.includes(chapter.id);
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => toggleChapter(chapter.id)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-start text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                  )}
                >
                  {chapter.title}
                </button>
              );
            })}
          </div>

          {selectedChapterIds.length === 1 && subtopicsForSelected.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <div className="text-xs text-muted-foreground">תת-נושא</div>
              <div className="flex flex-wrap gap-2">
                <SubtopicChip
                  label="הכול"
                  selected={effectiveSubtopicId === null}
                  onClick={() => setRawSubtopicId(null)}
                />
                {subtopicsForSelected.map((s) => (
                  <SubtopicChip
                    key={s.id}
                    label={s.title}
                    selected={effectiveSubtopicId === s.id}
                    onClick={() => setRawSubtopicId(s.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source count + Angles row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">שאלות מקור</CardTitle>
            <CardDescription>שאלות אמיתיות מבחינות עבר.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {SOURCE_COUNT_CHOICES.map((n) => {
                const enabled = available !== null && available >= n;
                const isSelected = effectiveSourceCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => enabled && setRawSourceCount(n)}
                    aria-pressed={isSelected}
                    disabled={!enabled}
                    className={cn(
                      "min-w-12 rounded-md border px-3 py-2 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      isSelected && enabled
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border bg-background",
                      enabled
                        ? "hover:border-primary/40 hover:bg-muted/40"
                        : "cursor-not-allowed text-muted-foreground/60"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <AvailabilitySubtitle
              available={available}
              isPending={isCountPending}
              hasSelection={selectedChapterIds.length > 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">זוויות לכל מקור</CardTitle>
            <CardDescription>
              שאלות נלוות במגוון זוויות פדגוגיות.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ANGLE_CHOICES.map((n) => {
                const isSelected = angles === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAngles(n)}
                    aria-pressed={isSelected}
                    className={cn(
                      "min-w-12 rounded-md border px-3 py-2 text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      isSelected
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time slider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">זמן לכל שאלה</CardTitle>
          <CardDescription>הצג טיימר ויזואלי בזמן התרגול.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {formatMinSec(timeSeconds)}
            </span>
            <span className="text-xs text-muted-foreground">דקות:שניות</span>
          </div>
          <input
            type="range"
            min={TIME_MIN}
            max={TIME_MAX}
            step={TIME_STEP}
            value={timeSeconds}
            onChange={(e) => setTimeSeconds(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label="זמן לכל שאלה בשניות"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1:00</span>
            <span>
              2:30
              <span className="ms-1 text-[10px] uppercase tracking-wider text-primary">
                מומלץ
              </span>
            </span>
            <span>5:00</span>
          </div>
        </CardContent>
      </Card>

      {/* Summary + CTA */}
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm">
            <div className="font-medium">
              {effectiveSourceCount} מקור · {effectiveSourceCount * angles} זווית · {total} שאלות
            </div>
            <div className="text-muted-foreground">
              זמן צפוי: כ-{estMinutes} דקות
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitDisabled}
            size="lg"
            className="sm:min-w-40"
          >
            {submitting ? "יוצר סשן..." : "התחל תרגול"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Small bits
// =============================================================================

function SubtopicChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary/10 font-medium"
          : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      {label}
    </button>
  );
}

/**
 * Three states for the subtitle below the source-count buttons:
 *   - no chapter picked → CTA to pick one
 *   - chapter picked but availability < MIN_QUESTIONS_REQUIRED → explain
 *     why all four count buttons are disabled, surface the exact shortfall
 *   - normal case → "כרגע יש N שאלות זמינות"
 * isPending suppresses flicker during the debounced in-flight request.
 */
function AvailabilitySubtitle({
  available,
  isPending,
  hasSelection,
}: {
  available: number | null;
  isPending: boolean;
  hasSelection: boolean;
}) {
  if (!hasSelection) {
    return (
      <p className="text-xs text-muted-foreground">
        בחר פרק כדי לראות שאלות זמינות
      </p>
    );
  }
  if (isPending || available === null) {
    return <p className="text-xs text-muted-foreground">טוען זמינות...</p>;
  }
  if (available < MIN_QUESTIONS_REQUIRED) {
    return (
      <p className="text-xs text-amber-600">
        צריך לפחות {MIN_QUESTIONS_REQUIRED} שאלות בפרק שבחרת. כרגע יש{" "}
        {available}.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      כרגע יש {available} שאלות זמינות לפרק שבחרת
    </p>
  );
}
