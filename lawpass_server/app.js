"use strict";

const express = require("express");
const cors = require("cors");

const { env } = require("./config/env");
const { pingDatabase } = require("./config/supabase");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error-handler");

const app = express();

app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Lightweight request log. Replace with structured logging in Slice 7.
app.use((req, _res, next) => {
  console.info(`[server] ${req.method} ${req.originalUrl}`);
  next();
});

// Liveness probe — unauthenticated.
app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "lawpass_server" })
);

// All API endpoints live under /api.
app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, async () => {
  console.info(
    `[server] lawpass_server listening on http://localhost:${env.port} (${env.nodeEnv})`
  );
  console.info(`[server] env loaded from: ${env.envFile ?? "process env (no .env file)"}`);

  // Confirm the DB is actually reachable before we claim it is.
  const db = await pingDatabase();
  if (db.ok) {
    console.info("[server] connected to Supabase DB");
  } else {
    console.warn(`[server] WARNING: could not reach Supabase DB — ${db.error}`);
  }
});

module.exports = app;
