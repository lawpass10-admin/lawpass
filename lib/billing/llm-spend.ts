/**
 * How much Claude usage this project has recorded, and since when.
 *
 * Reads the token counts the generators store on their own rows and prices
 * them with lib/billing/llm-rates.ts. See that file first: there is no balance
 * API, so this measures SPEND, and a remaining balance has to be anchored to a
 * figure read from the console by hand.
 *
 * ── WHERE USAGE ACTUALLY LIVES ────────────────────────────────────────────
 *
 * Three stores, because three scripts wrote them at different times and only
 * two of them thought to record usage:
 *
 *   diuni_questions.generation_meta.questions[].usage
 *       Per question, with the model. Complete.
 *
 *   mahoti_real_questions.review.generated.usage
 *       Per review, with the model AND a timestamp of its own (`.at`), which
 *       is the only per-call timestamp anywhere — everything else is dated by
 *       the row it sits on.
 *
 *   mahoti_questions.questions.generation
 *       Model, effort, seed, batch size… and NO usage. The biggest spender in
 *       the project records nothing: ten papers of forty questions each.
 *       scripts/mahoti/generate-mahoti-set.mjs now stores `generation.calls`,
 *       so papers generated from 2026-10-04 onward are counted; the ten that
 *       came before are not, and cannot be — the API does not report usage
 *       retrospectively. `papersMissingUsage` in the result counts them so a
 *       report can say so out loud rather than quietly reading low.
 *
 * Everything is read with the service-role client: this is authoring-side
 * accounting over admin-only tables, with no per-user rows in it.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { costOf, tokensOf, type StoredUsage } from "@/lib/billing/llm-rates";

export type SpendSource = "mahoti-questions" | "mahoti-reviews" | "diuni-questions";

export type SpendRow = {
  source: SpendSource;
  /** The row this usage was recorded on, for tracing a surprising number. */
  id: string;
  at: string | null;
  model: string | null;
  dollars: number;
  tokens: number;
  estimatedRate: boolean;
};

export type SpendReport = {
  /** Only calls recorded at or after this moment are counted. */
  since: string | null;
  total: number;
  tokens: number;
  bySource: Record<SpendSource, { dollars: number; calls: number }>;
  /** Newest first. Capped — a report is for reading, not for auditing. */
  rows: SpendRow[];
  /** Calls priced with UNKNOWN_RATE because the model id was not recognised. */
  estimatedCalls: number;
  /**
   * Papers whose row carries no usage at all. Each one is roughly $6-8 of
   * spend this report CANNOT see, which is the difference between an alarm
   * that is conservative and one that is wrong.
   */
  papersMissingUsage: number;
};

const EMPTY_BY_SOURCE = (): SpendReport["bySource"] => ({
  "mahoti-questions": { dollars: 0, calls: 0 },
  "mahoti-reviews": { dollars: 0, calls: 0 },
  "diuni-questions": { dollars: 0, calls: 0 },
});

/** `at` is kept as a string throughout; this is only for the `since` filter. */
const atOrAfter = (at: string | null, since: string | null): boolean => {
  if (!since) return true;
  if (!at) return false; // undated usage cannot be proven to be in the window
  return at >= since;
};

type MahotiQuestionsRow = {
  question_id: string;
  created_at: string | null;
  questions: {
    generation?: {
      model?: string;
      /** Added 2026-10-04. One entry per model call, in wave order. */
      calls?: { at?: string; model?: string; usage?: StoredUsage }[];
    } | null;
  } | null;
};

type MahotiReviewRow = {
  real_question_id: string;
  review: { generated?: { at?: string; model?: string; usage?: StoredUsage } } | null;
};

type DiuniRow = {
  question_id: string;
  created_at: string | null;
  generation_meta: {
    questions?: { file?: string; model?: string; usage?: StoredUsage }[];
  } | null;
};

/**
 * Add up everything recorded at or after `since` (an ISO string, or null for
 * all time).
 *
 * A failure in any one source is swallowed and that source contributes zero,
 * on the same principle the picker's badges follow: a spend report that is
 * missing a section is more useful than a page that throws. The caller can
 * tell, because the counts for that source come back at zero.
 */
export async function getLlmSpend(since: string | null, rowLimit = 40): Promise<SpendReport> {
  const supabase = createAdminClient();

  const rows: SpendRow[] = [];
  const bySource = EMPTY_BY_SOURCE();
  let papersMissingUsage = 0;

  const add = (row: SpendRow) => {
    rows.push(row);
    bySource[row.source].dollars += row.dollars;
    bySource[row.source].calls += 1;
  };

  // ── mahoti papers ────────────────────────────────────────────────────────
  const papers = await supabase
    .from("mahoti_questions")
    .select("question_id, created_at, questions")
    .not("questions", "is", null)
    .returns<MahotiQuestionsRow[]>();

  for (const paper of papers.data ?? []) {
    const calls = paper.questions?.generation?.calls;
    if (!calls || calls.length === 0) {
      // Dated by the row, so a paper from before the window is not counted as
      // an unmeasured one — it is simply out of scope.
      if (atOrAfter(paper.created_at, since)) papersMissingUsage += 1;
      continue;
    }
    for (const [i, call] of calls.entries()) {
      const at = call.at ?? paper.created_at;
      if (!atOrAfter(at, since)) continue;
      const model = call.model ?? paper.questions?.generation?.model ?? null;
      const { dollars, estimatedRate } = costOf(model, call.usage);
      add({
        source: "mahoti-questions",
        id: `${paper.question_id}#${i + 1}`,
        at,
        model,
        dollars,
        tokens: tokensOf(call.usage),
        estimatedRate,
      });
    }
  }

  // ── mahoti real-question reviews ─────────────────────────────────────────
  const reviews = await supabase
    .from("mahoti_real_questions")
    .select("real_question_id, review")
    .not("review", "is", null)
    .returns<MahotiReviewRow[]>();

  for (const review of reviews.data ?? []) {
    const made = review.review?.generated;
    if (!made?.usage) continue;
    const at = made.at ?? null;
    if (!atOrAfter(at, since)) continue;
    const { dollars, estimatedRate } = costOf(made.model ?? null, made.usage);
    add({
      source: "mahoti-reviews",
      id: review.real_question_id,
      at,
      model: made.model ?? null,
      dollars,
      tokens: tokensOf(made.usage),
      estimatedRate,
    });
  }

  // ── diuni papers ─────────────────────────────────────────────────────────
  const diuni = await supabase
    .from("diuni_questions")
    .select("question_id, created_at, generation_meta")
    .not("generation_meta", "is", null)
    .order("created_at", { ascending: true })
    .returns<DiuniRow[]>();

  // A DRAFT IS BILLED ONCE, NOT ONCE PER SET IT LANDS IN.
  //
  // generate-batch.mjs writes drafts to disk and load-diuni-questions.mjs
  // copies each draft's generation_meta into whatever set it is loaded into —
  // so one draft loaded into three sets has its usage on three rows. Measured
  // when this was written: 255 entries over 187 distinct files, a quarter of
  // the diuni total counted twice or more. The file name is the identity, and
  // the oldest row carrying it is charged for it.
  const seenDraft = new Set<string>();

  for (const paper of diuni.data ?? []) {
    // Per-question usage with no per-question timestamp, so the whole paper is
    // dated by its row. A paper generated across a window boundary therefore
    // lands wholly on one side of it; at one row per paper that is a rounding
    // error, and the alternative is inventing timestamps.
    for (const question of paper.generation_meta?.questions ?? []) {
      if (!question.usage) continue;
      // Deduped BEFORE the window test, so a draft first loaded before the
      // window is not charged again by a later set that falls inside it.
      const key = question.file ?? `${paper.question_id}#${question.model ?? "?"}`;
      if (seenDraft.has(key)) continue;
      seenDraft.add(key);
      if (!atOrAfter(paper.created_at, since)) continue;

      const { dollars, estimatedRate } = costOf(question.model ?? null, question.usage);
      add({
        source: "diuni-questions",
        id: `${paper.question_id}#${question.file ?? "?"}`,
        at: paper.created_at,
        model: question.model ?? null,
        dollars,
        tokens: tokensOf(question.usage),
        estimatedRate,
      });
    }
  }

  rows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return {
    since,
    total: rows.reduce((sum, row) => sum + row.dollars, 0),
    tokens: rows.reduce((sum, row) => sum + row.tokens, 0),
    bySource,
    rows: rows.slice(0, rowLimit),
    estimatedCalls: rows.filter((row) => row.estimatedRate).length,
    papersMissingUsage,
  };
}

export type BalanceEstimate = {
  anchorDollars: number;
  anchorAt: string;
  spentSince: number;
  /** anchor − spend. Never below zero: a negative balance is not a thing. */
  remaining: number;
  /** remaining / anchor, for a "x% left" line. */
  fractionLeft: number;
};

/**
 * The balance arithmetic, such as it is.
 *
 *     remaining ≈ anchor − everything recorded after the anchor's timestamp
 *
 * The anchor is a figure a human read in the Anthropic console and put in the
 * environment, with the moment they read it. Both halves matter: an anchor
 * without a timestamp would subtract spend that the console had already
 * subtracted, and the alarm would fire within a day of being set up.
 */
export function estimateBalance(
  anchorDollars: number,
  anchorAt: string,
  spend: SpendReport
): BalanceEstimate {
  const remaining = Math.max(0, anchorDollars - spend.total);
  return {
    anchorDollars,
    anchorAt,
    spentSince: spend.total,
    remaining,
    fractionLeft: anchorDollars > 0 ? remaining / anchorDollars : 0,
  };
}
