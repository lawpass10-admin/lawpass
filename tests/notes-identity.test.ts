/**
 * Slice 25 B-1 — coverage for `deriveNoteIdentity`.
 *
 * This is the single most-load-bearing piece of the notes feature:
 * a wrong derivation silently writes a note against the wrong slot.
 * The asserts pin every shape:
 *   - source notes use the parent question_group_id and NULL position
 *   - angle notes use the PARENT source's question_group_id (NOT the
 *     angle's own id) and the angle's display_order as the position
 *   - archived / out-of-range resolutions return null (no stable
 *     identity to attach a note to)
 *   - out-of-range angle display_order returns null so the action
 *     fails cleanly rather than writing to a slot the CHECK will
 *     reject downstream
 */

import { describe, expect, it } from "vitest";

import { deriveNoteIdentity } from "@/lib/db/notes";
import type {
  AngleQuestionRow,
  PracticeSessionRow,
  ResolvedQuestion,
  SourceQuestionRow,
} from "@/lib/db/practice";

const SESSION = { id: "session" } as PracticeSessionRow;

function fakeSource(groupId: string): SourceQuestionRow {
  return {
    id: "src-id",
    question_group_id: groupId,
    external_id: "ext",
    question_text: "q",
    chapter_id: "ch",
    subtopic_id: "st",
    chapter_title: "ch title",
    subtopic_title: "st title",
    choices: [],
    legal_topic_analysis: "",
    full_explanation: "",
    common_pitfall: "",
    concepts_and_skills: [],
    quick_thinking_360: "",
    summary_for_memory: "",
    references_list: [],
  };
}

function fakeAngle(displayOrder: number): AngleQuestionRow {
  return {
    id: "angle-id",
    source_question_id: "src-id",
    angle_letter: "א",
    angle_title: null,
    display_order: displayOrder,
    question_text: "q",
    choices: [],
    legal_topic_analysis: "",
    full_explanation: "",
    common_pitfall: "",
    concepts_and_skills: [],
    quick_thinking_360: "",
    summary_for_memory: "",
    references_list: [],
  };
}

describe("deriveNoteIdentity — Slice 25 B-1", () => {
  it("source: keys on question_group_id with angle_position null", () => {
    const resolved: ResolvedQuestion = {
      kind: "source",
      question: fakeSource("group-uuid-1"),
      session: SESSION,
    };
    expect(deriveNoteIdentity(resolved)).toEqual({
      question_type: "source",
      source_question_group_id: "group-uuid-1",
      angle_position: null,
    });
  });

  it("angle: keys on PARENT source's question_group_id + angle display_order", () => {
    const resolved: ResolvedQuestion = {
      kind: "angle",
      question: fakeAngle(3),
      parentSource: fakeSource("parent-group-uuid"),
      session: SESSION,
    };
    const identity = deriveNoteIdentity(resolved);
    expect(identity).toEqual({
      question_type: "angle",
      source_question_group_id: "parent-group-uuid",
      angle_position: 3,
    });
    // Critical: the parent's group_id, NOT the angle's own UUID,
    // NOT the source's row id ("src-id").
    expect(identity!.source_question_group_id).not.toBe("angle-id");
    expect(identity!.source_question_group_id).not.toBe("src-id");
  });

  it("angle: accepts display_order at both bounds (1 and 5)", () => {
    const r1: ResolvedQuestion = {
      kind: "angle",
      question: fakeAngle(1),
      parentSource: fakeSource("g"),
      session: SESSION,
    };
    const r5: ResolvedQuestion = {
      kind: "angle",
      question: fakeAngle(5),
      parentSource: fakeSource("g"),
      session: SESSION,
    };
    expect(deriveNoteIdentity(r1)!.angle_position).toBe(1);
    expect(deriveNoteIdentity(r5)!.angle_position).toBe(5);
  });

  it("angle: returns null when display_order is out of range (defensive)", () => {
    // The DB CHECK rejects 0 / 6 / negative / non-integer; the
    // resolver guards before the INSERT so we surface a clean
    // "מיקום לא תקין" rather than a 23514 DB error.
    const outOfRange: ResolvedQuestion = {
      kind: "angle",
      question: fakeAngle(0),
      parentSource: fakeSource("g"),
      session: SESSION,
    };
    expect(deriveNoteIdentity(outOfRange)).toBeNull();

    const tooHigh: ResolvedQuestion = {
      kind: "angle",
      question: fakeAngle(6),
      parentSource: fakeSource("g"),
      session: SESSION,
    };
    expect(deriveNoteIdentity(tooHigh)).toBeNull();

    const nonInt: ResolvedQuestion = {
      kind: "angle",
      question: fakeAngle(2.5),
      parentSource: fakeSource("g"),
      session: SESSION,
    };
    expect(deriveNoteIdentity(nonInt)).toBeNull();
  });

  it("returns null for archived / out_of_range resolutions", () => {
    const archived: ResolvedQuestion = {
      kind: "archived",
      session: SESSION,
      position: 0,
    };
    expect(deriveNoteIdentity(archived)).toBeNull();

    const oor: ResolvedQuestion = {
      kind: "out_of_range",
      session: SESSION,
    };
    expect(deriveNoteIdentity(oor)).toBeNull();
  });
});
