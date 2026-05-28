import { describe, expect, it } from "vitest";

import { submitQaReportInput } from "@/lib/validators/qa-reports";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function baseInput() {
  return {
    reportType: "bug" as const,
    problemText: "השאלה לא נטענה",
    expectedText: "השאלה אמורה להופיע על המסך",
    pagePath: "/practice/play/3?session=abc",
    questionId: null,
    questionType: null,
    userAgent: "Mozilla/5.0",
    viewport: "1440x900",
  };
}

describe("submitQaReportInput", () => {
  it("accepts a valid bug report with no question identity", () => {
    const result = submitQaReportInput.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  it("accepts a content report with paired question identity", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      reportType: "content",
      questionId: VALID_UUID,
      questionType: "source",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown report_type", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      reportType: "typo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty problemText", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      problemText: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "";
      expect(msg).toMatch(/לתאר|מה לא/);
    }
  });

  it("rejects empty expectedText", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      expectedText: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed UUID in questionId", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      questionId: "not-a-uuid",
      questionType: "source",
    });
    expect(result.success).toBe(false);
  });

  it("rejects questionId without questionType (unpaired)", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      questionId: VALID_UUID,
      questionType: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "";
      expect(msg).toMatch(/שאלה/);
    }
  });

  it("rejects questionType without questionId (unpaired)", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      questionId: null,
      questionType: "angle",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown question_type", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      questionId: VALID_UUID,
      questionType: "essay",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty pagePath", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      pagePath: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional userAgent/viewport as null", () => {
    const result = submitQaReportInput.safeParse({
      ...baseInput(),
      userAgent: null,
      viewport: null,
    });
    expect(result.success).toBe(true);
  });
});
