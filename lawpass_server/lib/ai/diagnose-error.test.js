"use strict";

// diagnose-error — failure classification for AI calls.
//
// The category is what reaches the browser and what an operator filters logs
// by, so these pin the property that matters most: a rejected API key is
// reported as `auth` and never as a generic failure — the exact case that sat
// invisible in production on 2026-09-10.

const test = require("node:test");
const assert = require("node:assert/strict");
const Anthropic = require("@anthropic-ai/sdk");

const {
  diagnoseError,
  formatForStorage,
  describeStoredFailure,
  describeApiKey,
} = require("./diagnose-error");

const headers = () => new Headers({ "request-id": "req_test_123" });

/** Built the way the SDK builds them, so the subclass is the one it would throw. */
const apiError = (status, type) =>
  Anthropic.APIError.generate(
    status,
    { type: "error", error: { type, message: "provider message sk-ant-must-not-leak" } },
    undefined,
    headers()
  );

test("a rejected API key is `auth`, not retryable, with status and request id", () => {
  const d = diagnoseError(apiError(401, "authentication_error"));
  assert.equal(d.category, "auth");
  assert.equal(d.retryable, false);
  assert.equal(d.status, 401);
  assert.equal(d.requestId, "req_test_123");
});

test("each HTTP status maps to its category", () => {
  const cases = [
    [400, "invalid_request_error", "bad_request", false],
    [403, "permission_error", "permission", false],
    [404, "not_found_error", "not_found", false],
    [429, "rate_limit_error", "rate_limit", true],
    [500, "api_error", "server", true],
    [529, "overloaded_error", "overloaded", true],
  ];
  for (const [status, type, category, retryable] of cases) {
    const d = diagnoseError(apiError(status, type));
    assert.equal(d.category, category, `status ${status}`);
    assert.equal(d.retryable, retryable, `status ${status} retryable`);
  }
});

test("a timeout is `timeout`, not a status-less API error", () => {
  assert.equal(diagnoseError(new Anthropic.APIConnectionTimeoutError()).category, "timeout");
});

test("a connection failure is `network`", () => {
  const err = new Anthropic.APIConnectionError({ message: "ECONNRESET" });
  assert.equal(diagnoseError(err).category, "network");
});

test("our own coded errors are classified by code, not wording", () => {
  const missing = Object.assign(new Error("any wording at all"), {
    code: "ANTHROPIC_API_KEY_MISSING",
  });
  assert.equal(diagnoseError(missing).category, "no_api_key");
  const truncated = Object.assign(new Error("x"), { code: "GRADE_TRUNCATED" });
  assert.equal(diagnoseError(truncated).category, "truncated");
});

test("malformed model JSON is `invalid_output`; anything else is `unknown`", () => {
  let parseError;
  try {
    JSON.parse("{not json");
  } catch (e) {
    parseError = e;
  }
  assert.equal(diagnoseError(parseError).category, "invalid_output");
  assert.equal(diagnoseError(new Error("boom")).category, "unknown");
  assert.equal(diagnoseError("a string, not an Error").category, "unknown");
});

test("the browser-safe hint never carries the provider's message", () => {
  const d = diagnoseError(apiError(401, "authentication_error"));
  assert.ok(!d.hint.includes("sk-ant"));
  assert.ok(!describeStoredFailure(formatForStorage(d)).hint.includes("sk-ant"));
});

test("the category survives storage and is read back", () => {
  for (const [status, type] of [
    [401, "authentication_error"],
    [429, "rate_limit_error"],
  ]) {
    const d = diagnoseError(apiError(status, type));
    const stored = formatForStorage(d);
    assert.match(stored, /^\[[a-z_]+\] /);
    assert.match(stored, /request_id=req_test_123/);
    assert.equal(describeStoredFailure(stored).category, d.category);
  }
});

test("legacy untagged rows are classified by their leading status", () => {
  const legacy =
    '401 {"type":"error","error":{"type":"authentication_error","message":"API key is invalid."},"request_id":null}';
  assert.equal(describeStoredFailure(legacy).category, "auth");
  assert.equal(describeStoredFailure("529 overloaded").category, "overloaded");
  assert.equal(describeStoredFailure("503 unavailable").category, "server");
  assert.equal(describeStoredFailure("something odd").category, "unknown");
  assert.equal(describeStoredFailure(null).category, "unknown");
});

test("describeApiKey flags paste mistakes and never reveals the key body", () => {
  const saved = process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  try {
    const secret = "sk-ant-api03-SECRETSECRETSECRET-abcd";
    const clean = describeApiKey(secret);
    assert.equal(clean.present, true);
    assert.deepEqual(clean.problems, []);
    assert.ok(!clean.fingerprint.includes("SECRET"));
    assert.ok(clean.fingerprint.endsWith("abcd (36 chars)"));

    assert.equal(describeApiKey("").present, false);
    assert.equal(describeApiKey(undefined).present, false);
    assert.equal(describeApiKey(`${secret}\n`).problems.length, 1, "trailing newline");
    assert.equal(describeApiKey(`"${secret}"`).problems.length, 1, "quoted");
    assert.equal(describeApiKey("re_not_an_anthropic_key_value").problems.length, 1, "wrong prefix");

    process.env.ANTHROPIC_AUTH_TOKEN = "token";
    assert.equal(describeApiKey(secret).problems.length, 1, "both credentials set");
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN;
    else process.env.ANTHROPIC_AUTH_TOKEN = saved;
  }
});
