import { afterEach, describe, expect, it, vi } from "vitest";

import { isMockCheckoutEnabled } from "@/lib/billing/mock-checkout";

/**
 * The guard on the Slice-1 mock checkout.
 *
 * Worth testing despite being four lines, because the failure mode is silent
 * and expensive: if this ever returns true in production, /checkout hands out
 * free subscriptions to anyone who asks, and nothing in the UI would look
 * wrong. The cases below are the ones that decide that.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isMockCheckoutEnabled", () => {
  it("is on in development, so the local flow needs no configuration", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_MOCK_CHECKOUT", "");
    expect(isMockCheckoutEnabled()).toBe(true);
  });

  it("is OFF in production by default — the whole point of the module", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_CHECKOUT", "");
    expect(isMockCheckoutEnabled()).toBe(false);
  });

  it("can be switched back on in production, deliberately", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCK_CHECKOUT", "true");
    expect(isMockCheckoutEnabled()).toBe(true);
  });

  it("requires the exact string 'true' — no truthiness, no near misses", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const value of ["TRUE", "True", "1", "yes", "on", " true", "true "]) {
      vi.stubEnv("ALLOW_MOCK_CHECKOUT", value);
      expect(isMockCheckoutEnabled(), `value: ${JSON.stringify(value)}`).toBe(
        false
      );
    }
  });

  it("treats the test environment as non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALLOW_MOCK_CHECKOUT", "");
    expect(isMockCheckoutEnabled()).toBe(true);
  });
});
