/**
 * Slice 27 — pin the angle → note-identity derivation used by the
 * bookmarks + mistakes list pages.
 *
 * The single most-load-bearing invariant: an ANGLE row's note
 * identity uses the angle's `display_order` as the
 * `angle_position` value — NOT the angle's `angle_letter`, NOT the
 * angle's row UUID. If this drifts, the pencil opens an empty
 * editor for a question that already has a saved note, because the
 * read/write paths target different UNIQUE slots.
 *
 * `getNotedIdentities` is the server-side payload the list pages
 * use to flag rows with a saved note; `notedIdentityKey` builds the
 * lookup key from the same identity triple `saveNoteByIdentity`
 * writes to. They must speak the same language for source AND
 * angle notes.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getNotedIdentities,
  notedIdentityKey,
} from "@/lib/db/notes";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_GROUP_A = "22222222-2222-4222-8222-222222222222";
const PARENT_GROUP_B = "33333333-3333-4333-8333-333333333333";

// =============================================================================
// Minimal supabase mock — just the `.from(...).select(...).eq(...)` slice
// the helpers use.
// =============================================================================

function makeReadMock(rows: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (r: unknown) => unknown
  ) =>
    Promise.resolve({ data: rows, error: null }).then(
      onFulfilled,
      onRejected
    );
  return {
    from: () => chain,
  };
}

afterEach(() => vi.resetAllMocks());

// =============================================================================
// notedIdentityKey — derivation rules
// =============================================================================

describe("notedIdentityKey — Slice 27", () => {
  it("SOURCE note → 'source:${question_group_id}'", () => {
    expect(
      notedIdentityKey({
        question_type: "source",
        source_question_group_id: SOURCE_GROUP_A,
        angle_position: null,
      })
    ).toBe(`source:${SOURCE_GROUP_A}`);
  });

  it("ANGLE note → 'angle:${parent_group_id}:${position}' using display_order, NOT angle_letter", () => {
    // The angle's `display_order` = 3 ↦ position 3. Even though the
    // visible angle_letter ("ג") corresponds to the same slot under
    // the project's seeding convention, the identity key is keyed
    // off the INTEGER position, not the letter.
    expect(
      notedIdentityKey({
        question_type: "angle",
        source_question_group_id: PARENT_GROUP_B,
        angle_position: 3,
      })
    ).toBe(`angle:${PARENT_GROUP_B}:3`);
  });

  it("ANGLE position 1 and 5 both produce well-formed keys (bounds match the DB CHECK)", () => {
    expect(
      notedIdentityKey({
        question_type: "angle",
        source_question_group_id: PARENT_GROUP_B,
        angle_position: 1,
      })
    ).toBe(`angle:${PARENT_GROUP_B}:1`);
    expect(
      notedIdentityKey({
        question_type: "angle",
        source_question_group_id: PARENT_GROUP_B,
        angle_position: 5,
      })
    ).toBe(`angle:${PARENT_GROUP_B}:5`);
  });
});

// =============================================================================
// getNotedIdentities — set-shape contract
// =============================================================================

describe("getNotedIdentities — Slice 27", () => {
  it("returns an empty set when the user has no notes", async () => {
    const client = makeReadMock([]);
    const set = await getNotedIdentities(client as never, USER_ID);
    expect(set.size).toBe(0);
  });

  it("emits identity strings the list-page derivation can look up", async () => {
    const client = makeReadMock([
      {
        question_type: "source",
        source_question_group_id: SOURCE_GROUP_A,
        angle_position: null,
      },
      {
        question_type: "angle",
        source_question_group_id: PARENT_GROUP_B,
        angle_position: 3,
      },
    ]);

    const set = await getNotedIdentities(client as never, USER_ID);
    expect(set.size).toBe(2);
    // The list page constructs the same shape from its bookmark /
    // mistake row data; the indicator stays on as long as the keys
    // match.
    expect(set.has(`source:${SOURCE_GROUP_A}`)).toBe(true);
    expect(set.has(`angle:${PARENT_GROUP_B}:3`)).toBe(true);
    // Defensive negatives: the angle key MUST NOT live under the
    // wrong shape (parent_group_id only, or with a different
    // slot).
    expect(set.has(`angle:${PARENT_GROUP_B}`)).toBe(false);
    expect(set.has(`angle:${PARENT_GROUP_B}:1`)).toBe(false);
  });

  it("ignores rows that lack the identity columns (defensive)", async () => {
    const client = makeReadMock([
      // Missing source_question_group_id — would violate the table
      // CHECK in practice, but defensively dropped here.
      {
        question_type: "source",
        source_question_group_id: null,
        angle_position: null,
      },
      // Angle row without an angle_position — same idea.
      {
        question_type: "angle",
        source_question_group_id: PARENT_GROUP_B,
        angle_position: null,
      },
    ]);

    const set = await getNotedIdentities(client as never, USER_ID);
    expect(set.size).toBe(0);
  });
});
