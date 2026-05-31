"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveNoteByIdentity } from "@/lib/db/notes";
import { createClient } from "@/lib/supabase/server";

/**
 * Slice 26 — server action used by the centralized notes bank to
 * persist edits from the in-place editor. The bank already knows the
 * note's identity (it loaded the row to render); it sends the
 * stored `(question_type, source_question_group_id, angle_position)`
 * triple directly. The practice-play editor still uses its own
 * `saveNote` action (Slice 25 B-1) which resolves identity from a
 * `(sessionId, position)` pair.
 *
 * RLS gates `question_notes` reads + writes on
 * `auth.uid() = user_id AND has_active_subscription()`, so an
 * expired sub fails CLOSED at the DB even if the client somehow
 * bypassed the layout's subscription gate.
 */

const saveNoteFromBankSchema = z.object({
  questionType: z.enum(["source", "angle"]),
  sourceQuestionGroupId: z.string().uuid(),
  /** Null for source notes; 1..5 for angle notes (matches the DB
   *  CHECK on question_notes.angle_position). */
  anglePosition: z.number().int().min(1).max(5).nullable(),
  contentJson: z.unknown(),
  contentHtml: z.string().min(0).max(200_000),
});

type SaveNoteFromBankResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string };

export async function saveNoteFromBank(
  input: unknown
): Promise<SaveNoteFromBankResult> {
  const parsed = saveNoteFromBankSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "טופס לא תקין" };
  const data = parsed.data;

  // Cross-field guard mirroring the DB CHECK:
  //   source → angle_position MUST be null
  //   angle  → angle_position MUST be 1..5
  if (data.questionType === "source" && data.anglePosition !== null) {
    return { ok: false, error: "טופס לא תקין" };
  }
  if (data.questionType === "angle" && data.anglePosition === null) {
    return { ok: false, error: "טופס לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "לא מחובר" };

  const result = await saveNoteByIdentity(
    supabase,
    user.id,
    {
      question_type: data.questionType,
      source_question_group_id: data.sourceQuestionGroupId,
      angle_position: data.anglePosition,
    },
    data.contentJson,
    data.contentHtml
  );

  if (!result.ok) return result;

  // The sidebar's "הערות" badge counts un-archived notes and is
  // computed in the (app) layout's bookmark/mistake/notes helper.
  // Revalidate so a brand-new note bumps the count immediately.
  revalidatePath("/", "layout");
  console.info(
    `[notes] save_from_bank OK user=${user.id} type=${data.questionType} group=${data.sourceQuestionGroupId} pos=${data.anglePosition ?? "null"}`
  );

  return result;
}
