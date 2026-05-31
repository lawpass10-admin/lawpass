/**
 * Slice 24 — coverage for the per-session timer helper.
 *
 * `computeRemaining` is the single source of truth for the wall-clock
 * model: every play-page server render calls it with the session's
 * `session_duration_seconds` and `started_at`, and the value lands as
 * the `<Timer>` initialSeconds. These tests pin the boundary cases
 * the play-page wiring relies on.
 */

import { describe, expect, it } from "vitest";

import { computeRemaining } from "@/lib/practice/session-timer";

const ONE_HOUR_AGO = Date.parse("2026-05-31T12:00:00.000Z");
const NOW = ONE_HOUR_AGO + 60 * 60 * 1000;

describe("computeRemaining — Slice 24", () => {
  it("returns null when sessionDurationSeconds is 0 (no-timer sentinel)", () => {
    expect(
      computeRemaining({
        sessionDurationSeconds: 0,
        startedAt: new Date(NOW).toISOString(),
        nowMs: NOW,
      })
    ).toBeNull();
  });

  it("returns the full budget when started_at is exactly now", () => {
    const startIso = new Date(NOW).toISOString();
    expect(
      computeRemaining({
        sessionDurationSeconds: 600,
        startedAt: startIso,
        nowMs: NOW,
      })
    ).toBe(600);
  });

  it("returns budget minus elapsed for an in-flight session", () => {
    const startIso = new Date(NOW - 90 * 1000).toISOString(); // 90s ago
    expect(
      computeRemaining({
        sessionDurationSeconds: 600,
        startedAt: startIso,
        nowMs: NOW,
      })
    ).toBe(510);
  });

  it("clamps to 0 when elapsed exceeds the budget (expired session)", () => {
    const startIso = new Date(NOW - 90 * 60 * 1000).toISOString(); // 90 min ago
    expect(
      computeRemaining({
        sessionDurationSeconds: 30 * 60,
        startedAt: startIso,
        nowMs: NOW,
      })
    ).toBe(0);
  });

  it("clamps to the budget ceiling under negative clock skew", () => {
    // A client clock that lags behind the server could produce a
    // negative elapsed; the helper caps the result so the user never
    // sees a "remaining" value greater than the budget.
    const startIso = new Date(NOW + 60_000).toISOString(); // 60s in the FUTURE
    expect(
      computeRemaining({
        sessionDurationSeconds: 600,
        startedAt: startIso,
        nowMs: NOW,
      })
    ).toBe(600);
  });

  it("falls back to the full budget when started_at can't be parsed", () => {
    expect(
      computeRemaining({
        sessionDurationSeconds: 1200,
        startedAt: "not-a-real-iso-timestamp",
        nowMs: NOW,
      })
    ).toBe(1200);
  });

  it("returns null for negative or non-finite budgets (defensive)", () => {
    const startIso = new Date(NOW).toISOString();
    expect(
      computeRemaining({
        sessionDurationSeconds: -1,
        startedAt: startIso,
        nowMs: NOW,
      })
    ).toBeNull();
    expect(
      computeRemaining({
        sessionDurationSeconds: Number.NaN,
        startedAt: startIso,
        nowMs: NOW,
      })
    ).toBeNull();
  });
});
