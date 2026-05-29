import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAN_ID,
  PLANS,
  getPlan,
  isValidPlanId,
} from "@/lib/billing/plans";

describe("PLANS constant", () => {
  it("contains both plan_3m and plan_6m", () => {
    const ids = PLANS.map((p) => p.id);
    expect(ids).toContain("plan_3m");
    expect(ids).toContain("plan_6m");
    expect(PLANS).toHaveLength(2);
  });

  it("plan_3m has the current price (2,000 ILS) and duration (3 months)", () => {
    // Slice 16 — prices were updated from the original SPEC §1.6
    // values (350 / 1000) to the new landing-page prices (2,000 /
    // 3,500) per Sharon, 2026-05-29.
    const plan = PLANS.find((p) => p.id === "plan_3m");
    expect(plan).toBeDefined();
    expect(plan?.totalPrice).toBe(2000);
    expect(plan?.durationMonths).toBe(3);
  });

  it("plan_6m has the current price (3,500 ILS) and duration (6 months)", () => {
    const plan = PLANS.find((p) => p.id === "plan_6m");
    expect(plan).toBeDefined();
    expect(plan?.totalPrice).toBe(3500);
    expect(plan?.durationMonths).toBe(6);
  });

  it("marks the 6-month plan as recommended (matches DEFAULT_PLAN_ID)", () => {
    expect(DEFAULT_PLAN_ID).toBe("plan_6m");
    const recommended = PLANS.find((p) => p.recommended);
    expect(recommended?.id).toBe("plan_6m");
  });
});

describe("isValidPlanId", () => {
  it("returns true for the two valid plan ids", () => {
    expect(isValidPlanId("plan_3m")).toBe(true);
    expect(isValidPlanId("plan_6m")).toBe(true);
  });

  it("returns false for unknown strings and non-string input", () => {
    expect(isValidPlanId("plan_12m")).toBe(false);
    expect(isValidPlanId(null)).toBe(false);
    expect(isValidPlanId(undefined)).toBe(false);
    expect(isValidPlanId(3)).toBe(false);
  });
});

describe("getPlan", () => {
  it("returns the matching plan for a valid id", () => {
    expect(getPlan("plan_3m").id).toBe("plan_3m");
    expect(getPlan("plan_6m").id).toBe("plan_6m");
  });
});
