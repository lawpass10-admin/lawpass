/**
 * Slice 26 — coverage for the notes bank.
 *
 * Asserts:
 *   1. `getUserNotes` resolves a SOURCE note via
 *      `source_question_group_id` → current source_questions row +
 *      chapter title.
 *   2. `getUserNotes` resolves an ANGLE note via the PARENT
 *      source's group_id + the angle's `display_order = angle_position`.
 *      The resolved `questionId` is the angle row's UUID (which is
 *      what `Learning360Item.question_id` expects).
 *   3. `getUserNotes` flags notes whose underlying question can't be
 *      resolved (archived / RLS-hidden) as `isArchived: true` with a
 *      null `questionId`.
 *   4. `saveNoteFromBank` server action UPSERTs an ANGLE note with
 *      the right identity triple + onConflict columns, mirroring the
 *      Slice 25.2 angle-branch invariant.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { saveNoteFromBank } from "@/app/(app)/notes/_actions";
import { getUserNotes } from "@/lib/db/notes";
import { createClient } from "@/lib/supabase/server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_GROUP_A = "22222222-2222-4222-8222-222222222222";
const SOURCE_GROUP_B = "33333333-3333-4333-8333-333333333333";
const SOURCE_ROW_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const SOURCE_ROW_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const ANGLE_ROW = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const ARCHIVED_GROUP = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

// =============================================================================
// Chainable mock — covers the .from(...).select/insert/update/upsert/delete
// path the helpers and the action use
// =============================================================================

type Capture = {
  table: string;
  method: "select" | "insert" | "update" | "upsert" | "delete" | null;
  selectCols?: string;
  selectOptions?: Record<string, unknown>;
  payload?: unknown;
  options?: Record<string, unknown>;
  filters: Array<["eq" | "is" | "neq" | "in", string, unknown]>;
  orderBy?: { col: string; ascending?: boolean };
  limit?: number;
};

type Responder = (q: Capture) => {
  data: unknown;
  error: unknown;
  count?: number;
};

function makeMock(responder: Responder) {
  const captures: Capture[] = [];
  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: USER_ID } }, error: null }),
    },
    from(table: string) {
      const cap: Capture = { table, method: null, filters: [] };
      captures.push(cap);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.select = (cols: string, options?: Record<string, unknown>) => {
        if (cap.method === null) cap.method = "select";
        cap.selectCols = cols;
        if (options) cap.selectOptions = options;
        return chain;
      };
      chain.insert = (p: unknown) => {
        cap.method = "insert";
        cap.payload = p;
        return chain;
      };
      chain.update = (p: unknown) => {
        cap.method = "update";
        cap.payload = p;
        return chain;
      };
      chain.upsert = (p: unknown, o?: Record<string, unknown>) => {
        cap.method = "upsert";
        cap.payload = p;
        cap.options = o;
        return chain;
      };
      chain.delete = () => {
        cap.method = "delete";
        return chain;
      };
      chain.eq = (col: string, val: unknown) => {
        cap.filters.push(["eq", col, val]);
        return chain;
      };
      chain.is = (col: string, val: unknown) => {
        cap.filters.push(["is", col, val]);
        return chain;
      };
      chain.neq = (col: string, val: unknown) => {
        cap.filters.push(["neq", col, val]);
        return chain;
      };
      chain.in = (col: string, vals: unknown) => {
        cap.filters.push(["in", col, vals]);
        return chain;
      };
      chain.order = (col: string, opts?: { ascending?: boolean }) => {
        cap.orderBy = { col, ascending: opts?.ascending };
        return chain;
      };
      chain.limit = (n: number) => {
        cap.limit = n;
        return chain;
      };
      chain.single = () => Promise.resolve(responder(cap));
      chain.maybeSingle = () => Promise.resolve(responder(cap));
      chain.then = (
        onFulfilled?: (v: unknown) => unknown,
        onRejected?: (r: unknown) => unknown
      ) => Promise.resolve(responder(cap)).then(onFulfilled, onRejected);
      return chain;
    },
  };
  return { client, captures };
}

// =============================================================================
// Helpers for the getUserNotes responder
// =============================================================================

afterEach(() => {
  vi.resetAllMocks();
});

const NOTES_BASE = [
  {
    id: "note-source",
    question_type: "source" as const,
    source_question_group_id: SOURCE_GROUP_A,
    angle_position: null,
    content_json: { type: "doc", content: [] },
    content_html: "<p>source note</p>",
    updated_at: "2026-06-01T10:00:00Z",
  },
  {
    id: "note-angle",
    question_type: "angle" as const,
    source_question_group_id: SOURCE_GROUP_B,
    angle_position: 3,
    content_json: { type: "doc", content: [] },
    content_html: "<p>angle note</p>",
    updated_at: "2026-06-01T09:00:00Z",
  },
];

// =============================================================================
// Tests
// =============================================================================

describe("getUserNotes — Slice 26", () => {
  it("resolves a SOURCE note to its current source_questions row + chapter title", async () => {
    const responder: Responder = (q) => {
      if (q.table === "question_notes") return { data: NOTES_BASE, error: null };
      if (q.table === "source_questions") {
        return {
          data: [
            {
              id: SOURCE_ROW_A,
              question_group_id: SOURCE_GROUP_A,
              question_text: "Source A?",
              chapter: { title: "סדר דין אזרחי" },
            },
            {
              id: SOURCE_ROW_B,
              question_group_id: SOURCE_GROUP_B,
              question_text: "Parent for angle",
              chapter: { title: "ראיות" },
            },
          ],
          error: null,
        };
      }
      if (q.table === "angle_questions") {
        return {
          data: [
            {
              id: ANGLE_ROW,
              source_question_id: SOURCE_ROW_B,
              angle_letter: "ג",
              display_order: 3,
              question_text: "Angle question?",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const { client } = makeMock(responder);

    const notes = await getUserNotes(client as never, USER_ID);

    expect(notes).toHaveLength(2);
    const sourceNote = notes.find((n) => n.questionType === "source")!;
    expect(sourceNote.questionId).toBe(SOURCE_ROW_A);
    expect(sourceNote.chapterTitle).toBe("סדר דין אזרחי");
    expect(sourceNote.questionText).toBe("Source A?");
    expect(sourceNote.isArchived).toBe(false);
    expect(sourceNote.anglePosition).toBeNull();
    expect(sourceNote.angleLetter).toBeNull();
  });

  it("resolves an ANGLE note via parent group_id + display_order, returning the angle's UUID as questionId", async () => {
    const responder: Responder = (q) => {
      if (q.table === "question_notes") return { data: NOTES_BASE, error: null };
      if (q.table === "source_questions") {
        return {
          data: [
            {
              id: SOURCE_ROW_A,
              question_group_id: SOURCE_GROUP_A,
              question_text: "Source A?",
              chapter: { title: "סדר דין אזרחי" },
            },
            {
              id: SOURCE_ROW_B,
              question_group_id: SOURCE_GROUP_B,
              question_text: "Parent for angle",
              chapter: { title: "ראיות" },
            },
          ],
          error: null,
        };
      }
      if (q.table === "angle_questions") {
        return {
          data: [
            {
              id: ANGLE_ROW,
              source_question_id: SOURCE_ROW_B,
              angle_letter: "ג",
              display_order: 3,
              question_text: "Angle question?",
            },
            // Different display_order → must NOT be matched.
            {
              id: "other-angle",
              source_question_id: SOURCE_ROW_B,
              angle_letter: "א",
              display_order: 1,
              question_text: "Different slot",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const { client } = makeMock(responder);

    const notes = await getUserNotes(client as never, USER_ID);
    const angleNote = notes.find((n) => n.questionType === "angle")!;
    expect(angleNote.questionId).toBe(ANGLE_ROW);
    expect(angleNote.questionId).not.toBe(SOURCE_ROW_B);
    expect(angleNote.questionId).not.toBe("other-angle");
    expect(angleNote.anglePosition).toBe(3);
    expect(angleNote.angleLetter).toBe("ג");
    expect(angleNote.chapterTitle).toBe("ראיות");
    expect(angleNote.questionText).toBe("Angle question?");
    expect(angleNote.isArchived).toBe(false);
  });

  it("flags a note as archived when the source row is missing (RLS-hidden / unpublished)", async () => {
    const responder: Responder = (q) => {
      if (q.table === "question_notes") {
        return {
          data: [
            {
              id: "note-archived",
              question_type: "source",
              source_question_group_id: ARCHIVED_GROUP,
              angle_position: null,
              content_json: {},
              content_html: "<p>archived</p>",
              updated_at: "2026-06-01T10:00:00Z",
            },
          ],
          error: null,
        };
      }
      if (q.table === "source_questions") {
        // Empty — the ARCHIVED_GROUP doesn't resolve to anything.
        return { data: [], error: null };
      }
      return { data: null, error: null };
    };
    const { client } = makeMock(responder);

    const notes = await getUserNotes(client as never, USER_ID);
    expect(notes).toHaveLength(1);
    expect(notes[0].isArchived).toBe(true);
    expect(notes[0].questionId).toBeNull();
    expect(notes[0].chapterTitle).toBe("");
  });
});

describe("saveNoteFromBank — Slice 26", () => {
  it("upserts an ANGLE note with the stored identity triple + correct onConflict columns", async () => {
    const responder: Responder = (q) => {
      if (q.method === "upsert")
        return { data: { updated_at: "2026-06-02T00:00:00Z" }, error: null };
      return { data: null, error: null };
    };
    const { client, captures } = makeMock(responder);
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await saveNoteFromBank({
      questionType: "angle",
      sourceQuestionGroupId: SOURCE_GROUP_B,
      anglePosition: 3,
      contentJson: { type: "doc", content: [] },
      contentHtml: "<p>updated</p>",
    });

    expect(result.ok).toBe(true);
    const upsert = captures.find((c) => c.method === "upsert")!;
    expect(upsert.table).toBe("question_notes");
    expect(upsert.payload).toMatchObject({
      user_id: USER_ID,
      question_type: "angle",
      source_question_group_id: SOURCE_GROUP_B,
      angle_position: 3,
      content_html: "<p>updated</p>",
    });
    expect(upsert.options?.onConflict).toBe(
      "user_id,question_type,source_question_group_id,angle_position"
    );
  });

  it("rejects a SOURCE identity with a non-null angle_position (DB CHECK guard)", async () => {
    const { client } = makeMock(() => ({ data: null, error: null }));
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await saveNoteFromBank({
      questionType: "source",
      sourceQuestionGroupId: SOURCE_GROUP_A,
      anglePosition: 2, // invalid for source
      contentJson: {},
      contentHtml: "<p>nope</p>",
    });
    expect(result.ok).toBe(false);
  });
});
