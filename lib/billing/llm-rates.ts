/**
 * What a Claude call costs, from the usage the API reports.
 *
 * ── READ THIS BEFORE TRUSTING A NUMBER THIS MODULE PRODUCES ────────────────
 *
 * Anthropic exposes no API for an account's credit balance, and the Cost API
 * needs an Admin key tied to an organization account. So nothing here can tell
 * you what is left. What it can do is add up what was SPENT, from the token
 * counts recorded on our own rows at the moment each call returned.
 *
 * A balance therefore has to be anchored by hand:
 *
 *     remaining ≈ balance you read in the console at time T
 *                 − spend recorded after T
 *
 * That is an estimate with three known gaps, all of which make it read LOW
 * (i.e. it will say you have more left than you do):
 *
 *   1. Only runs that record usage are counted. Every call made outside this
 *      repo — the console, another tool, a script that does not store its
 *      usage — is invisible here.
 *   2. Failed and retried calls are billed but usually not stored: a batch
 *      that fails its quote check is re-asked, and only the kept result is
 *      written to the row.
 *   3. Rates below are a copy of the published price list. If Anthropic
 *      changes them, this keeps using the old number until someone edits it.
 *
 * Treat the output as "at least this much has been spent", which is the right
 * direction for an alarm: it fires late rather than never, and never cries
 * wolf.
 */

/** Dollars per million tokens. */
export type Rate = {
  input: number;
  output: number;
  /** Writing the prompt cache. 1.25× input on the published list. */
  cacheWrite: number;
  /** Reading it back. 0.1× input. */
  cacheRead: number;
};

/**
 * Per million tokens, from the published price list.
 *
 * Keyed by the model id as the API reports it in `message.model`, which is the
 * resolved id rather than an alias — a request for "claude-opus-5" comes back
 * as "claude-opus-5" but a dated alias would come back dated, so UNKNOWN_RATE
 * below covers anything not listed rather than silently costing zero.
 */
export const RATES: Record<string, Rate> = {
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-5-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

/**
 * What an unrecognised model is priced at.
 *
 * The most expensive rate on the list, deliberately. An unknown model is
 * either new or misspelled, and for an alarm the safe error is to overstate
 * the spend — understating it is how you find out by having calls refused.
 * The breakdown flags these rows so the overstatement is visible rather than
 * silently baked into the total.
 */
export const UNKNOWN_RATE: Rate = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

/** The usage block as the Messages API reports it. Every field optional: older
 *  stored rows predate some of them, and a missing count means zero, never a
 *  crash in a cost report. */
export type StoredUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  /** "standard" or "batch". Batch is half price on every token type. */
  service_tier?: string | null;
  output_tokens_details?: { thinking_tokens?: number | null } | null;
};

export type CallCost = {
  dollars: number;
  /** True when the model id was not in RATES and UNKNOWN_RATE was used. */
  estimatedRate: boolean;
};

/**
 * The cost of one call.
 *
 * THE TWO MISTAKES THIS AVOIDS, both of which inflate the total:
 *
 *   * Thinking tokens are NOT added. `output_tokens_details.thinking_tokens`
 *     is a breakdown OF `output_tokens`, not a figure beside it. Adding both
 *     double-counts the most expensive tokens in the run — on a typical paper
 *     thinking is a third of the output.
 *   * Cached input is NOT added to `input_tokens`. The API reports the three
 *     input kinds separately and they do not overlap; `input_tokens` is
 *     already only the uncached part.
 *
 * Batch calls are halved on every token type, detected from `service_tier`
 * rather than from how the run was launched — the row is the record of what
 * actually happened, and a run that fell back from batch to streamed would
 * otherwise be priced wrongly.
 */
export function costOf(model: string | null | undefined, usage: StoredUsage | null | undefined): CallCost {
  if (!usage) return { dollars: 0, estimatedRate: false };

  const known = model ? RATES[model] : undefined;
  const rate = known ?? UNKNOWN_RATE;
  const half = usage.service_tier === "batch" ? 0.5 : 1;

  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  const dollars =
    ((n(usage.input_tokens) * rate.input +
      n(usage.output_tokens) * rate.output +
      n(usage.cache_creation_input_tokens) * rate.cacheWrite +
      n(usage.cache_read_input_tokens) * rate.cacheRead) /
      1_000_000) *
    half;

  return { dollars, estimatedRate: known === undefined && Boolean(model) };
}

/** Tokens of every kind in one call, for the "what did we actually send"
 *  half of a report. Thinking is excluded for the same reason as above. */
export function tokensOf(usage: StoredUsage | null | undefined): number {
  if (!usage) return 0;
  const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return (
    n(usage.input_tokens) +
    n(usage.output_tokens) +
    n(usage.cache_creation_input_tokens) +
    n(usage.cache_read_input_tokens)
  );
}

export const money = (dollars: number): string => `$${dollars.toFixed(2)}`;
