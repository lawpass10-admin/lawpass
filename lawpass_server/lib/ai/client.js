"use strict";

// Anthropic client. Lazily constructed so the server boots fine without a key —
// only the generation path requires one, and it fails there with a clear message
// rather than taking the whole process down at import time.

const Anthropic = require("@anthropic-ai/sdk");

let client = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error(
      "[ai] ANTHROPIC_API_KEY is not set. Add it to the env file that config/env.js " +
        "loads (app/.env.local) or export it in the shell before running generation."
    );
    // A code as well as a message, so diagnose-error.js can classify this
    // failure without matching on wording that is free to change.
    error.code = "ANTHROPIC_API_KEY_MISSING";
    throw error;
  }

  client = new Anthropic({
    apiKey,
    // 529 "overloaded" is transient and retryable. The default of 2 retries is
    // thin for these calls: a generation runs for minutes, so losing one to a
    // brief capacity dip means starting the whole thing over.
    maxRetries: 6,
    // Long thinking + a long answer can exceed the default request timeout.
    timeout: 15 * 60 * 1000,
  });
  return client;
}

module.exports = { getClient };
