"use strict";

// diagnose-error.js — turn a failed AI call into something a person can act on.
//
// WHY THIS EXISTS. On 2026-09-10 every writing-task submission in production
// failed, and the only symptom anywhere was the student's "we couldn't finish
// checking this answer" screen. The browser console showed `status=200 ok=true`
// (the API calls were fine — it was the marking that failed), the server printed
// `status=failed` with no reason, and the reason itself — `401 API key is
// invalid` on the API host, seven times in a row — was written only to
// open_question_answers.grading_error, where nobody looks while debugging.
//
// Every failure now gets a CATEGORY, classified from the SDK's typed error
// classes rather than from message wording, and what is safe to show is kept
// apart from what is not:
//
//   * category / retryable / hint — safe for a browser. Never contains the
//     provider's message, a key, or a request id.
//   * status / type / requestId / message — server log and database only.

const Anthropic = require("@anthropic-ai/sdk");

/** What each category means for whoever is reading the log. */
const CATEGORIES = {
  no_api_key: {
    retryable: false,
    hint: "ANTHROPIC_API_KEY is not set on the API server",
  },
  auth: {
    retryable: false,
    hint: "the AI provider rejected the API key — replace ANTHROPIC_API_KEY on the API server and restart it",
  },
  permission: {
    retryable: false,
    hint: "the API key is valid but not permitted to use this model or feature",
  },
  not_found: {
    retryable: false,
    hint: "model or endpoint not found — check the grading model id",
  },
  bad_request: {
    retryable: false,
    hint: "the AI provider rejected the request itself — a code or prompt problem, not a transient one",
  },
  rate_limit: { retryable: true, hint: "rate limited by the AI provider — retry later" },
  overloaded: { retryable: true, hint: "the AI provider is temporarily overloaded — retry later" },
  server: { retryable: true, hint: "server error at the AI provider — retry later" },
  timeout: { retryable: true, hint: "the AI call timed out before a response arrived" },
  network: { retryable: true, hint: "the API server could not reach the AI provider" },
  refused: { retryable: false, hint: "the model declined to mark this answer" },
  truncated: { retryable: true, hint: "the marking hit max_tokens before it finished" },
  invalid_output: {
    retryable: true,
    hint: "the model's marking could not be parsed or failed validation",
  },
  // Not AI failures — the question itself is not set up to be marked. Neither is
  // retryable: retrying runs the same lookup and gets the same answer until
  // someone approves a rubric. Before these existed the reason was stored
  // untagged, fell through to `unknown`, and the page offered the student a
  // retry button that could only ever fail again.
  no_rubric: {
    retryable: false,
    hint: "this question has no approved rubric — approve one with load_rubric.mjs --approve, then requeue the answer",
  },
  question_missing: {
    retryable: false,
    hint: "the question this answer belongs to no longer exists",
  },
  unknown: { retryable: true, hint: "unexpected failure — the API server log has the detail" },
};

/** Our own errors carry a `code`; this maps them without reading their wording. */
const CODE_CATEGORIES = {
  ANTHROPIC_API_KEY_MISSING: "no_api_key",
  GRADE_REFUSED: "refused",
  GRADE_TRUNCATED: "truncated",
  GRADE_NO_TEXT: "invalid_output",
  GRADE_UNUSABLE: "invalid_output",
};

/** For rows stored before failures were tagged — see describeStoredFailure. */
const STATUS_CATEGORIES = {
  400: "bad_request",
  401: "auth",
  403: "permission",
  404: "not_found",
  413: "bad_request",
  429: "rate_limit",
  529: "overloaded",
};

const messageOf = (err) => (err && err.message ? err.message : String(err));

/**
 * Classify one thrown error.
 *
 * Typed checks, most specific first. In this SDK APIConnectionTimeoutError
 * extends APIConnectionError, which extends APIError — so the connection
 * classes must be tested before the status-based APIError branch, or a timeout
 * would read as an API error with no status.
 */
function diagnoseError(err) {
  let category = "unknown";

  if (err instanceof Anthropic.APIConnectionTimeoutError) category = "timeout";
  else if (err instanceof Anthropic.APIConnectionError) category = "network";
  else if (err instanceof Anthropic.AuthenticationError) category = "auth";
  else if (err instanceof Anthropic.PermissionDeniedError) category = "permission";
  else if (err instanceof Anthropic.NotFoundError) category = "not_found";
  else if (err instanceof Anthropic.RateLimitError) category = "rate_limit";
  else if (err instanceof Anthropic.BadRequestError) category = "bad_request";
  else if (err instanceof Anthropic.APIError) {
    // 529 has no class of its own; the error type separates it from other 5xx.
    if (err.type === "overloaded_error" || err.status === 529) category = "overloaded";
    else if (typeof err.status === "number" && err.status >= 500) category = "server";
    else if (typeof err.status === "number" && err.status >= 400) category = "bad_request";
  } else if (err && CODE_CATEGORIES[err.code]) {
    category = CODE_CATEGORIES[err.code];
  } else if (err instanceof SyntaxError) {
    // JSON.parse on the model's output.
    category = "invalid_output";
  }

  const isApiError = err instanceof Anthropic.APIError;
  return {
    category,
    ...CATEGORIES[category],
    status: isApiError && typeof err.status === "number" ? err.status : null,
    type: isApiError ? (err.type ?? null) : null,
    requestId: isApiError ? (err.requestID ?? null) : null,
    message: messageOf(err),
  };
}

/**
 * The string stored in grading_error: a category tag, then the full detail.
 *
 *   [auth] 401 {"type":"error",...} (request_id=req_…)
 *
 * Tagged so the category survives the trip through the database — the typed
 * error object does not.
 */
function formatForStorage(diagnosis) {
  const requestId = diagnosis.requestId ? ` (request_id=${diagnosis.requestId})` : "";
  return `[${diagnosis.category}] ${diagnosis.message}${requestId}`;
}

/**
 * The browser-safe summary of a stored grading_error.
 *
 * Reads the tag formatForStorage wrote. Rows written before tagging existed
 * (every failure up to 2026-09-10) hold the SDK's raw message, which begins with
 * the HTTP status, so the status is read instead. This parses our own stored
 * format — the live classification above never matches on wording.
 */
function describeStoredFailure(stored) {
  const text = String(stored ?? "");
  const tag = /^\[([a-z_]+)\]/.exec(text);
  let category = tag && CATEGORIES[tag[1]] ? tag[1] : null;

  // Blocked reasons stored before they carried a tag. Matched on the wording
  // grading.js used, which is fixed text of ours rather than a provider message.
  if (!category && /no approved rubric/.test(text)) category = "no_rubric";
  if (!category && /no longer exists/.test(text)) category = "question_missing";

  if (!category) {
    const status = Number((/^(\d{3})\b/.exec(text) || [])[1]);
    category = STATUS_CATEGORIES[status] || (status >= 500 ? "server" : "unknown");
  }

  const { retryable, hint } = CATEGORIES[category];
  return { category, retryable, hint };
}

/**
 * Describe the configured key WITHOUT revealing it, and flag the paste mistakes
 * that produce "API key is invalid" even when the right key was copied.
 *
 * The fingerprint is the non-secret "sk-ant-api03" prefix plus the last four
 * characters — enough to match against the key list in the Anthropic console,
 * which shows keys the same way, and nothing an attacker can use.
 */
function describeApiKey(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { present: false, fingerprint: "(unset)", problems: [] };
  }

  const problems = [];
  if (raw !== raw.trim()) {
    problems.push(
      "has leading or trailing whitespace or a newline — common when pasting into a hosting dashboard, and enough to get a correct key rejected"
    );
  }
  const trimmed = raw.trim();
  if (/^(["']).*\1$/.test(trimmed)) {
    problems.push("is wrapped in quotes — hosting dashboards store the quotes as part of the value");
  }
  const key = trimmed.replace(/^["']|["']$/g, "");
  if (!key.startsWith("sk-ant-")) {
    problems.push('does not start with "sk-ant-" — this is not an Anthropic API key');
  }
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    problems.push(
      "is set alongside ANTHROPIC_AUTH_TOKEN — the SDK sends both credentials and the API rejects the request"
    );
  }

  const fingerprint =
    key.length > 16
      ? `${key.slice(0, 12)}…${key.slice(-4)} (${key.length} chars)`
      : `(${key.length} chars — too short to be a real key)`;

  return { present: true, fingerprint, problems };
}

module.exports = {
  CATEGORIES,
  diagnoseError,
  formatForStorage,
  describeStoredFailure,
  describeApiKey,
};
