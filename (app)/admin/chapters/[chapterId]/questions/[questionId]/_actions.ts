"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin-gate";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

// =============================================================================
// Schemas
// =============================================================================

/**
 * Text field cap. 10k is well above any realistic 360° body length —
 * the longest existing field on disk is < 2k chars. A hard cap stops
 * pathological pastes from blowing up the row size.
 */
const MAX_FIELD_CHARS = 10_000;

/**
 * Array field cap (the raw textarea string). Higher than the text-field
 * cap because users will often newline-paste references/concepts.
 */
const MAX_ARRAY_TEXTAREA_CHARS = 20_000;

const textField = z.string().max(MAX_FIELD_CHARS, {
  message: "השדה ארוך מדי",
});

/**
 * Textarea-to-string-array transformer. Per the slice-7 product
 * decision: the client posts the raw textarea string, the server
 * splits on \n, trims each line, drops empties. This keeps the form
 * trivial on the client and treats the textarea content as the
 * source of truth.
 */
const arrayTextareaField = z
  .string()
  .max(MAX_ARRAY_TEXTAREA_CHARS, { message: "הטקסט ארוך מדי" })
  .transform((s) =>
    s
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  );

const uuid = z.string().uuid({ message: "מזהה לא תקין" });

const editSourceSchema = z.object({
  sourceQuestionId: uuid,
  legal_topic_analysis: textField,
  full_explanation: textField,
  common_pitfall: textField,
  summary_for_memory: textField,
  quick_thinking_360: textField,
  notes_for_admin: textField.nullable().transform((v) => v ?? ""),
  concepts_and_skills: arrayTextareaField,
  references_list: arrayTextareaField,
});

const editAngleSchema = z.object({
  angleQuestionId: uuid,
  legal_topic_analysis: textField,
  full_explanation: textField,
  common_pitfall: textField,
  summary_for_memory: textField,
  quick_thinking_360: textField,
  concepts_and_skills: arrayTextareaField,
  references_list: arrayTextareaField,
});

export type EditSourceContentInput = z.input<typeof editSourceSchema>;
export type EditAngleContentInput = z.input<typeof editAngleSchema>;

// =============================================================================
// Whitelist enforcement + audit row builder
// =============================================================================

const SOURCE_EDITABLE_FIELDS = [
  "legal_topic_analysis",
  "full_explanation",
  "common_pitfall",
  "summary_for_memory",
  "quick_thinking_360",
  "notes_for_admin",
  "concepts_and_skills",
  "references_list",
] as const;

const ANGLE_EDITABLE_FIELDS = [
  "legal_topic_analysis",
  "full_explanation",
  "common_pitfall",
  "summary_for_memory",
  "quick_thinking_360",
  "concepts_and_skills",
  "references_list",
] as const;

/**
 * Compares the loaded "before" row with the validated "after" payload
 * and returns just the field names that changed. Used to populate the
 * admin_actions_log details column — we deliberately do NOT log the
 * full before/after text, which could be many KB per field.
 */
function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T)[]
): (keyof T)[] {
  const changed: (keyof T)[] = [];
  for (const key of fields) {
    const b = before[key];
    const a = after[key];
    if (Array.isArray(b) && Array.isArray(a)) {
      if (
        b.length !== a.length ||
        b.some((v, i) => v !== a[i])
      ) {
        changed.push(key);
      }
    } else if (b !== a) {
      changed.push(key);
    }
  }
  return changed;
}

async function logAdminAction(input: {
  adminId: string;
  actionType: string;
  targetResourceId: string;
  details: Record<string, unknown>;
  targetUserId?: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_actions_log").insert({
    admin_id: input.adminId,
    action_type: input.actionType,
    target_user_id: input.targetUserId ?? null,
    target_resource_id: input.targetResourceId,
    details: input.details,
  });
  if (error) {
    // Audit-log failures are loud-but-non-blocking, mirroring the
    // pattern in Phase B's admin _actions.ts. The content write
    // already succeeded; surfacing this as a failure would mislead
    // the operator into retrying.
    console.error(
      `[admin] audit-log INSERT FAILED admin=${input.adminId} action=${input.actionType} target=${input.targetResourceId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
  }
}

// =============================================================================
// Edit source-question content
// =============================================================================

/**
 * Updates the editable text/array fields on a `source_questions` row.
 * NEVER touches question_text / chapter_id / subtopic_id / status /
 * is_correct / choice rows — those are explicitly out of scope and
 * are not even in the schema, so a forged payload trying to set them
 * is dropped by the Zod parser.
 *
 * Auth: requireAdmin() runs FIRST. RLS policy
 * admins_full_access_source_questions then permits the UPDATE.
 */
export async function adminEditSourceContentAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = editSourceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;
  const { sourceQuestionId, ...nextFields } = data;

  const supabase = await createClient();

  // Load the prior row so we can diff field names for the audit log.
  const { data: priorRow, error: priorErr } = await supabase
    .from("source_questions")
    .select(
      "legal_topic_analysis, full_explanation, common_pitfall, summary_for_memory, quick_thinking_360, notes_for_admin, concepts_and_skills, references_list"
    )
    .eq("id", sourceQuestionId)
    .maybeSingle();
  if (priorErr || !priorRow) {
    return { ok: false, error: "השאלה לא נמצאה" };
  }

  const { error } = await supabase
    .from("source_questions")
    .update(nextFields)
    .eq("id", sourceQuestionId);

  if (error) {
    console.error(
      `[admin] edit source content FAILED admin=${admin.id} source=${sourceQuestionId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" };
  }

  const fieldsChanged = diffFields(
    priorRow as Record<string, unknown>,
    nextFields as unknown as Record<string, unknown>,
    SOURCE_EDITABLE_FIELDS
  );

  await logAdminAction({
    adminId: admin.id,
    actionType: "edit_source_content",
    targetResourceId: sourceQuestionId,
    details: { fields_changed: fieldsChanged },
  });

  // The editor page reads the freshly-updated row to repopulate the
  // form on next render. Revalidate the editor route specifically.
  revalidatePath(`/admin/chapters/[chapterId]/questions/[questionId]`, "page");
  return { ok: true };
}

// =============================================================================
// Edit angle-question content
// =============================================================================

export async function adminEditAngleContentAction(
  input: unknown
): Promise<ActionResult> {
  const { user: admin } = await requireAdmin();

  const parsed = editAngleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "טופס לא תקין",
    };
  }
  const data = parsed.data;
  const { angleQuestionId, ...nextFields } = data;

  const supabase = await createClient();

  const { data: priorRow, error: priorErr } = await supabase
    .from("angle_questions")
    .select(
      "legal_topic_analysis, full_explanation, common_pitfall, summary_for_memory, quick_thinking_360, concepts_and_skills, references_list"
    )
    .eq("id", angleQuestionId)
    .maybeSingle();
  if (priorErr || !priorRow) {
    return { ok: false, error: "השאלה לא נמצאה" };
  }

  const { error } = await supabase
    .from("angle_questions")
    .update(nextFields)
    .eq("id", angleQuestionId);

  if (error) {
    console.error(
      `[admin] edit angle content FAILED admin=${admin.id} angle=${angleQuestionId} code=${
        (error as { code?: string }).code ?? "unknown"
      } msg=${error.message}`
    );
    return { ok: false, error: "אירעה שגיאה בשמירת השינויים. נסה שוב" };
  }

  const fieldsChanged = diffFields(
    priorRow as Record<string, unknown>,
    nextFields as unknown as Record<string, unknown>,
    ANGLE_EDITABLE_FIELDS
  );

  await logAdminAction({
    adminId: admin.id,
    actionType: "edit_angle_content",
    targetResourceId: angleQuestionId,
    details: { fields_changed: fieldsChanged },
  });

  revalidatePath(`/admin/chapters/[chapterId]/questions/[questionId]`, "page");
  return { ok: true };
}
