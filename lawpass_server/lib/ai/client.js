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
    throw new Error(
      "[ai] ANTHROPIC_API_KEY is not set. Add it to the env file that config/env.js " +
        "loads (app/.env.local) or export it in the shell before running generation."
    );
  }

  client = new Anthropic({ apiKey });
  return client;
}

module.exports = { getClient };
