import { beforeEach, describe, expect, it } from "vitest";

import {
  clearQaQuestionContext,
  getQaQuestionContext,
  setQaQuestionContext,
} from "@/app/(app)/_components/qa-question-store";

/**
 * The store is a module-level singleton, so the previous test's value
 * leaks into the next test if we don't reset. clearQaQuestionContext
 * is the documented reset path.
 */
beforeEach(() => {
  clearQaQuestionContext();
});

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";

describe("qa-question-store", () => {
  it("returns {null, null} by default", () => {
    expect(getQaQuestionContext()).toEqual({
      questionId: null,
      questionType: null,
    });
  });

  it("set → get returns the stored value", () => {
    setQaQuestionContext({ questionId: QUESTION_ID, questionType: "source" });
    expect(getQaQuestionContext()).toEqual({
      questionId: QUESTION_ID,
      questionType: "source",
    });
  });

  it("supports the 'angle' question type", () => {
    setQaQuestionContext({ questionId: QUESTION_ID, questionType: "angle" });
    expect(getQaQuestionContext()).toEqual({
      questionId: QUESTION_ID,
      questionType: "angle",
    });
  });

  it("overwrites the prior value", () => {
    setQaQuestionContext({ questionId: QUESTION_ID, questionType: "source" });
    const second = "22222222-2222-4222-8222-222222222222";
    setQaQuestionContext({ questionId: second, questionType: "angle" });
    expect(getQaQuestionContext()).toEqual({
      questionId: second,
      questionType: "angle",
    });
  });

  it("clear resets to {null, null} even after a set", () => {
    setQaQuestionContext({ questionId: QUESTION_ID, questionType: "source" });
    clearQaQuestionContext();
    expect(getQaQuestionContext()).toEqual({
      questionId: null,
      questionType: null,
    });
  });

  it("setting to {null, null} is equivalent to clearing", () => {
    setQaQuestionContext({ questionId: QUESTION_ID, questionType: "source" });
    setQaQuestionContext({ questionId: null, questionType: null });
    expect(getQaQuestionContext()).toEqual({
      questionId: null,
      questionType: null,
    });
  });
});
