"use strict";

// startup-check.js — verify the AI credentials when the server boots.
//
// The Anthropic client is built lazily (see client.js) so the server can start
// without a key, and that is right: most of the API has nothing to do with AI.
// The cost is that a bad key is discovered only when a student submits an
// answer, in a background job, long after deploy — which is how production ran
// with a rejected key through seven consecutive submissions before anyone knew.
//
// This makes the first line of every deploy's log say whether grading can work.
// It never stops the server from starting: a bad key breaks marking, not login,
// and turning it into a boot failure would take the whole API down with it.

const Anthropic = require("@anthropic-ai/sdk");

const { describeApiKey, diagnoseError } = require("./diagnose-error");

/** The model grading calls. Keep in step with DEFAULT_GRADE_PARAMS in grade-answer.js. */
const CHECK_MODEL = "claude-opus-5";

async function checkAiCredentials() {
  const raw = process.env.ANTHROPIC_API_KEY;
  const key = describeApiKey(raw);

  if (!key.present) {
    console.error(
      "[ai] STARTUP CHECK FAILED category=no_api_key — ANTHROPIC_API_KEY is not set. " +
        "Every grading run will fail until it is."
    );
    return { ok: false, category: "no_api_key" };
  }

  console.info(`[ai] ANTHROPIC_API_KEY ${key.fingerprint}`);
  for (const problem of key.problems) {
    console.warn(`[ai] WARNING: ANTHROPIC_API_KEY ${problem}`);
  }

  // A client of its own: no retries and a short timeout. The grading client
  // waits up to 15 minutes across 6 retries, which is right for a marking run
  // and wrong for a boot log that should report within seconds. The raw value
  // is passed untrimmed on purpose — it is exactly what grading will send.
  const client = new Anthropic({ apiKey: raw, maxRetries: 0, timeout: 10_000 });
  const started = Date.now();

  try {
    // Retrieving a model costs no tokens and exercises both the key and the
    // model id grading depends on.
    await client.models.retrieve(CHECK_MODEL);
    console.info(
      `[ai] startup check OK — key accepted, ${CHECK_MODEL} available (${Date.now() - started}ms)`
    );
    return { ok: true };
  } catch (err) {
    const d = diagnoseError(err);
    console.error(
      `[ai] STARTUP CHECK FAILED category=${d.category} status=${d.status ?? "-"} ` +
        `type=${d.type ?? "-"} request_id=${d.requestId ?? "-"} — ${d.hint}`
    );
    console.error(`[ai]   provider said: ${d.message}`);
    return { ok: false, category: d.category };
  }
}

module.exports = { checkAiCredentials, CHECK_MODEL };
