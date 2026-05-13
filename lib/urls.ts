/**
 * Practice-mode URL helpers. Consolidates the three URL shapes used across
 * Phase 2 and Phase 3:
 *   - /practice/play/[idx]?session={id}     — question page
 *   - /practice/summary?session={id}        — summary page
 *   - /practice?chapters=…&count=…          — setup, with optional prefill
 *
 * Phase 2 had three call sites generating these via template strings; they
 * now route through this module. Keeping it pure (no React, no Supabase
 * imports) so it can be unit-tested cheaply and used from both Server
 * Components and Client Components.
 */

/**
 * Subset of the PracticeSetupForm state that can be round-tripped via URL
 * params (used by the summary page's "תרגול נוסף" CTA to pre-fill the
 * setup form with the previous session's settings).
 *
 * `subtopic` is only meaningful when `chapters.length === 1`; the URL
 * encoder drops it otherwise. The form's existing cross-field constraint
 * enforces the same invariant on submit.
 */
export type PrefillInput = {
  chapters?: string[];
  subtopic?: string;
  sourceCount?: number;
  angles?: number;
  timePerQuestion?: number;
};

const SOURCE_COUNT_CHOICES = new Set([1, 2, 5, 10, 20, 50]);

// Lowercase UUID v1-v5 with hyphens. Used for cheap validation in the
// prefill parser; the full Zod schema in lib/validators/practice.ts is
// the source of truth for Server Action input.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function practicePlayUrl(sessionId: string, position: number): string {
  return `/practice/play/${position}?session=${sessionId}`;
}

export function practiceSummaryUrl(sessionId: string): string {
  return `/practice/summary?session=${sessionId}`;
}

export function bookmarksUrl(): string {
  return "/bookmarks";
}

export function mistakesUrl(): string {
  return "/mistakes";
}

// =============================================================================
// Slice 3 — Exam routes
// =============================================================================

/** Exam intro / resume-prompt route. */
export function examIntroUrl(): string {
  return "/exam";
}

/**
 * `/exam/play/[idx]?session={id}` — same path-segment shape as the
 * practice player. Position is dense 0..39.
 */
export function examPlayUrl(sessionId: string, position: number): string {
  return `/exam/play/${position}?session=${sessionId}`;
}

/** Results screen, keyed by session id in the path segment. */
export function examResultsUrl(sessionId: string): string {
  return `/exam/results/${sessionId}`;
}

/**
 * Build a /practice URL, optionally with prefill query params.
 *
 * Encoding rules:
 *   - undefined / empty-array fields are omitted
 *   - subtopic is dropped when chapters.length !== 1 (matches the form's
 *     own cross-field validation)
 *   - sourceCount, angles, timePerQuestion are passed through as integers;
 *     the parser is responsible for re-validating ranges
 */
export function practiceSetupUrl(prefill?: PrefillInput): string {
  if (!prefill) return "/practice";
  const params = new URLSearchParams();

  if (prefill.chapters && prefill.chapters.length > 0) {
    params.set("chapters", prefill.chapters.join(","));
  }
  if (
    prefill.subtopic &&
    prefill.chapters &&
    prefill.chapters.length === 1
  ) {
    params.set("subtopic", prefill.subtopic);
  }
  if (prefill.sourceCount !== undefined) {
    params.set("count", String(prefill.sourceCount));
  }
  if (prefill.angles !== undefined) {
    params.set("angles", String(prefill.angles));
  }
  if (prefill.timePerQuestion !== undefined) {
    params.set("time", String(prefill.timePerQuestion));
  }

  const query = params.toString();
  return query.length > 0 ? `/practice?${query}` : "/practice";
}

/**
 * Minimal interface for parsing — covers both `URLSearchParams` (native)
 * and `ReadonlyURLSearchParams` (Next.js's `useSearchParams()` return).
 * Avoids importing the Next.js type so this module stays framework-pure.
 */
type ParamsLike = { get(name: string): string | null };

/**
 * Parse prefill query params defensively. Invalid integers/uuids are
 * dropped silently — the page falls back to defaults for those fields
 * rather than rendering an error. Returns null when no usable prefill
 * fields parsed.
 */
export function parsePracticeSetupPrefill(
  searchParams: ParamsLike
): PrefillInput | null {
  const out: PrefillInput = {};

  const chaptersRaw = searchParams.get("chapters");
  if (chaptersRaw) {
    const ids = chaptersRaw
      .split(",")
      .map((s) => s.trim())
      .filter(isUuid);
    if (ids.length > 0) out.chapters = ids;
  }

  const subtopicRaw = searchParams.get("subtopic");
  if (
    subtopicRaw &&
    isUuid(subtopicRaw) &&
    out.chapters &&
    out.chapters.length === 1
  ) {
    out.subtopic = subtopicRaw;
  }

  const countRaw = searchParams.get("count");
  if (countRaw !== null) {
    const n = Number(countRaw);
    if (Number.isInteger(n) && SOURCE_COUNT_CHOICES.has(n)) {
      out.sourceCount = n;
    }
  }

  const anglesRaw = searchParams.get("angles");
  if (anglesRaw !== null) {
    const n = Number(anglesRaw);
    if (Number.isInteger(n) && n >= 0 && n <= 4) {
      out.angles = n;
    }
  }

  const timeRaw = searchParams.get("time");
  if (timeRaw !== null) {
    const n = Number(timeRaw);
    if (Number.isInteger(n) && n >= 60 && n <= 300) {
      out.timePerQuestion = n;
    }
  }

  if (Object.keys(out).length === 0) return null;
  return out;
}
