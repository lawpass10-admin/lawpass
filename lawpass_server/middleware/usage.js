"use strict";

/**
 * Counts every API request by device and endpoint.
 *
 * The Express half of the pair; the Next proxy counts the web surface the same
 * way (see app/lib/usage/record.ts and proxy.ts). Both write through the same
 * `record_usage` function, so one table answers "which endpoints do phones
 * actually use" across the whole product.
 *
 * ── It never delays a response ────────────────────────────────────────────
 * The count is fired after `next()` and is not awaited. An API call must not
 * wait on analytics, and must not fail because of them — every error here is
 * swallowed. The database function deliberately does NOT swallow, so a silent
 * outage is still findable by calling it directly.
 *
 * ── Mounted before the routes, counted on the way out ─────────────────────
 * Registered high in app.js so nothing escapes it, but the path recorded is
 * `req.originalUrl`'s pathname, which is the route as the caller asked for it.
 * `req.route` would give the matched pattern, which is better, but it does not
 * exist yet when the middleware runs and is absent entirely for 404s — and a
 * 404'd endpoint that phones keep calling is exactly the kind of thing this
 * table should surface.
 */

const { adminClient } = require("../config/supabase");

const MOBILE =
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile Safari|webOS|BlackBerry/i;
const BOT =
  /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headless|lighthouse|monitor|preview/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

/** Bots first: a crawler's agent often contains "Mobile". */
function deviceOf(userAgent) {
  const ua = userAgent || "";
  if (!ua) return "bot";
  if (BOT.test(ua)) return "bot";
  return MOBILE.test(ua) ? "mobile" : "desktop";
}

/** "/api/practice/9876a9cc-…" -> "/api/practice/:id". Without this the table
 *  grows a row per id per day and answers nothing. */
function normalisePath(pathname) {
  const parts = String(pathname || "/")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .slice(0, 6);
  if (parts.length === 0) return "/";
  return (
    "/" +
    parts
      .map((part) =>
        UUID.test(part) || NUMERIC.test(part) || LONG_HEX.test(part)
          ? ":id"
          : part.toLowerCase()
      )
      .join("/")
  );
}

function usageTracking(req, res, next) {
  // The health probe runs every few seconds on Render and would otherwise be
  // the busiest "endpoint" in the product.
  if (req.path === "/health") return next();

  res.on("finish", () => {
    try {
      const client = adminClient();
      // Not awaited, and the rejection is caught rather than left to become an
      // unhandled rejection that takes the process down.
      client
        .rpc("record_usage", {
          p_surface: "api",
          p_device: deviceOf(req.get("user-agent")),
          p_path: normalisePath(req.originalUrl),
        })
        .then(
          () => {},
          () => {}
        );
    } catch {
      // Deliberately empty — the response has already been sent.
    }
  });

  next();
}

module.exports = { usageTracking, deviceOf, normalisePath };
