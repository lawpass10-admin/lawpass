import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAPER_ORDER,
  visibleToViewerFilter,
} from "@/lib/db/paper-visibility";

const VIEWER = "22222222-2222-4222-8222-222222222222";

/**
 * This predicate is the ONLY thing standing between a candidate and every
 * draft and custom exam in mahoti_questions / diuni_questions: those reads run
 * on the service role, so RLS is not enforcing anything behind it. Worth
 * testing at the string level, because that string is what reaches PostgREST.
 */
describe("visibleToViewerFilter", () => {
  it("admits published papers and the viewer's own custom exams, and nothing else", () => {
    expect(visibleToViewerFilter(VIEWER)).toBe(
      `and(exam_status.eq.prod,built_for.is.null),built_for.eq.${VIEWER}`
    );
  });

  it("requires built_for to be NULL on a published paper, not merely prod", () => {
    // A custom exam cannot be published (the CHECK in 20261004000001 forbids
    // it), but the filter does not lean on that constraint to be correct.
    expect(visibleToViewerFilter(VIEWER)).toContain("built_for.is.null");
  });

  it("scopes the custom-exam arm to the viewer, never to all custom exams", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    expect(visibleToViewerFilter(VIEWER)).not.toContain(other);
  });

  it("throws rather than silently downgrading when the viewer is missing", () => {
    // The dangerous failure is not an exception — it is a caller that forgets
    // the argument and quietly gets a different, looser query.
    for (const bad of ["", "   ", "undefined", "null"]) {
      expect(() => visibleToViewerFilter(bad)).toThrow(/must be a UUID/);
    }
  });

  it("refuses anything that could break out of the or(...) expression", () => {
    // The value is interpolated into a filter string, so these are the
    // characters that matter: comma, bracket, dot.
    const injections = [
      `${VIEWER},exam_status.eq.draft`,
      `${VIEWER})`,
      "built_for.not.is.null",
      "*",
    ];
    for (const bad of injections) {
      expect(() => visibleToViewerFilter(bad), bad).toThrow(/must be a UUID/);
    }
  });

  it("accepts an uppercase UUID, which Postgres would still match", () => {
    expect(() => visibleToViewerFilter(VIEWER.toUpperCase())).not.toThrow();
  });
});

describe("DEFAULT_PAPER_ORDER", () => {
  it("is exam_number ascending — מבחן מספר 1, not the newest row", () => {
    // The set reader and the review reader both use this. When they disagreed,
    // a candidate could read one paper's review beside another's questions.
    expect(DEFAULT_PAPER_ORDER).toEqual({
      column: "exam_number",
      ascending: true,
    });
  });
});
