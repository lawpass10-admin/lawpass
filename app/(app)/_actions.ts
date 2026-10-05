"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isMockCheckoutEnabled } from "@/lib/billing/mock-checkout";
import { isValidPlanId, type PlanId } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  // `warning` is for the case that is neither: the thing the caller asked for
  // happened, and something alongside it did not. The feedback box uses it for
  // a message that was filed while its screenshot was not.
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/**
 * Maps the client-side PlanId (URL-safe identifier used by /pricing →
 * /checkout) to the DB-level plan_type literal stored in
 * subscriptions.plan_type and accepted by grant_mock_subscription's
 * p_plan_type argument. Kept here rather than in lib/billing/plans.ts so
 * the DB-layer literals don't leak into the client bundle.
 */
const PLAN_TYPE_BY_ID: Record<PlanId, "3_months" | "6_months"> = {
  plan_3m: "3_months",
  plan_6m: "6_months",
};

/**
 * SPEC §6.9 step 6 (system performs charge) → step 7 (subscription active,
 * redirect to confirmation). Slice 1 placeholder: instead of a real charge,
 * we call the `grant_mock_subscription` RPC (migration
 * 20260506000001) which inserts an active subscription row for the
 * authenticated user with the chosen plan_type.
 *
 * TODO(slice-4): when Tranzila lands, this Server Action either goes away
 * (replaced by the Tranzila webhook flow) or evolves to forward the
 * planId/duration to a real charge → webhook → subscription-creation
 * pipeline. lib/billing/plans.ts remains the single source of truth for
 * client-facing pricing/labels.
 *
 * Hardening Rule #2: SSR client only — never the admin client. The RPC is
 * SECURITY DEFINER and derives user_id from auth.uid() server-side, so a
 * caller can't grant a subscription to someone else. The RPC also
 * server-side-validates p_plan_type against an allowlist.
 *
 * Idempotency: the RPC has `ON CONFLICT (user_id) WHERE is_current = TRUE
 * DO NOTHING` so concurrent double-clicks both succeed and end up with one
 * subscription row.
 */
export async function grantMockSubscriptionAction(
  planId: PlanId
): Promise<ActionResult> {
  // THE FIRST THING THIS DOES, before validating anything or touching the
  // database. A Server Action is a public POST endpoint: the checkout screen
  // is one way to reach this function and not a precondition of reaching it,
  // so the refusal has to live here rather than on the page. In production
  // without ALLOW_MOCK_CHECKOUT, granting a free subscription is simply not a
  // thing this deployment can do. See lib/billing/mock-checkout.ts.
  if (!isMockCheckoutEnabled()) {
    console.warn(
      "[billing] grant_mock_subscription REFUSED — mock checkout disabled in this environment"
    );
    return { ok: false, error: "התשלום אינו זמין כרגע" };
  }

  if (!isValidPlanId(planId)) {
    return { ok: false, error: "תוכנית לא תקינה" };
  }

  const supabase = await createClient();

  // Read auth.users id once for logging in both success + failure paths.
  // The RPC itself derives user_id internally; this is purely for [billing]
  // log telemetry.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "<unknown>";

  const { error } = await supabase.rpc("grant_mock_subscription", {
    p_plan_type: PLAN_TYPE_BY_ID[planId],
  });

  if (error) {
    // TODO(slice-7): replace with structured logger.
    console.error(
      `[billing] grant_mock_subscription rpc FAILED user=${userId} plan=${planId} code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return {
      ok: false,
      error: "אירעה שגיאה בהפעלת המנוי. נסה שוב או פנה לתמיכה",
    };
  }

  // TODO(slice-7): replace with structured logger.
  console.info(
    `[billing] grant_mock_subscription rpc OK user=${userId} plan=${planId}`
  );

  // Bust the (app)/layout.tsx subscription SELECT so the next request sees
  // the new row (same pattern as Phase 4 verifyOtpAction).
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// =============================================================================
// Feedback — the "שלחו לנו משוב" button in the sidebar
// =============================================================================

/**
 * The ceiling matches both the textarea's maxLength and the CHECK constraint on
 * user_feedback (migration 20260923000006). Three places agree on one number,
 * so a message that the box accepted is never rejected by the database.
 */
const FEEDBACK_MAX_CHARS = 4000;

/**
 * The three things a student can be writing about, matching the QA report
 * form's own vocabulary (lib/validators/qa-reports).
 *
 * The SAME three, deliberately: a student's "the timer jumped" and a tester's
 * are the same report, and two vocabularies for one thing would mean sorting
 * the pile twice.
 */
const FEEDBACK_TYPES = ["bug", "content", "design"] as const;

/** The screenshot bucket, created by migration 20260930000003. */
const FEEDBACK_SCREENSHOT_BUCKET = "feedback-screenshots";
/** Matches the bucket's own file_size_limit — rejected here so the student
 *  gets a sentence rather than a storage error. */
const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const FEEDBACK_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** Shown when the words were saved and the picture was not. */
const SCREENSHOT_WARNING =
  "המשוב נשלח, אך צילום המסך לא נשמר. אין צורך לשלוח שוב.";

const submitFeedbackSchema = z.object({
  /**
   * What went wrong — the message itself, and the only field the database
   * insists on (`feedback_body -> 'text'`, migration 20260923000006).
   */
  text: z.string().trim().min(1).max(FEEDBACK_MAX_CHARS),
  /**
   * What should have happened instead. OPTIONAL, unlike the QA form's own
   * version of this field, and the asymmetry is on purpose: a tester is filing
   * a report as a job, while a student is interrupting their own studying to
   * tell us something. Someone who knows a thing is broken but not what the
   * right behaviour is has still told us something worth having, and a required
   * second box is where that person gives up.
   */
  expected: z.string().trim().max(FEEDBACK_MAX_CHARS).optional(),
  /** Which of the three kinds of thing this is. Defaults to the first card. */
  type: z.enum(FEEDBACK_TYPES).default("bug"),
  /**
   * An optional screenshot, validated HERE as well as by the bucket.
   *
   * The bucket enforces the same size and MIME list, so this is not the
   * security boundary — it exists so an oversized image comes back as a
   * sentence in Hebrew instead of a storage error the student cannot act on.
   */
  screenshot: z
    .instanceof(File)
    .refine((file) => file.size > 0, { message: "קובץ ריק" })
    .refine((file) => file.size <= FEEDBACK_SCREENSHOT_MAX_BYTES, {
      message: "צילום המסך גדול מדי",
    })
    .refine((file) => FEEDBACK_SCREENSHOT_TYPES.includes(file.type), {
      message: "סוג קובץ לא נתמך",
    })
    .nullish(),
  /**
   * The route the student was on when they opened the box. Optional, and
   * deliberately not trusted for anything but context: it comes from the
   * client, so it is capped and stored as a plain string rather than resolved
   * against the route table. "The exam page is broken" is a different report
   * from "the dashboard is broken", and this is the cheapest way to know which.
   */
  page: z.string().max(200).optional(),
});

/**
 * Store one piece of feedback for the signed-in student.
 *
 * WRITTEN WITH THE SSR CLIENT, not the admin client. The insert therefore
 * passes through the `user_feedback_students_insert_own` policy, whose WITH
 * CHECK pins user_id to auth.uid() — authorization is the database's, and this
 * action cannot file feedback on behalf of somebody else even if it tried to.
 *
 * NO SUBSCRIPTION CHECK, on purpose: see the migration's header. A lapsed
 * student is precisely the one with something to tell us.
 */
export async function submitUserFeedbackAction(
  formData: FormData
): Promise<ActionResult> {
  // FORM DATA, NOT A PLAIN OBJECT, and the screenshot is why. A Server
  // Function's arguments are serialized by React, and FormData is the one
  // carrier whose file support is stated outright — a File smuggled inside an
  // object literal depends on behaviour this app would be the first place in
  // the repo to rely on. Everything else rides along in the same envelope.
  const screenshot = formData.get("screenshot");
  const parsed = submitFeedbackSchema.safeParse({
    text: formData.get("text"),
    expected: formData.get("expected") || undefined,
    type: formData.get("type") ?? undefined,
    page: formData.get("page") || undefined,
    // An empty file input posts a zero-byte File in some browsers rather than
    // nothing at all; treated as "no screenshot" so it cannot fail validation
    // for a student who never touched the field.
    screenshot:
      screenshot instanceof File && screenshot.size > 0 ? screenshot : null,
  });
  if (!parsed.success) {
    // The screenshot gets its own sentence. "לא ניתן לשלוח הודעה ריקה" over a
    // rejected image would send the student back to a paragraph they already
    // wrote, looking for a fault that is not there.
    const badScreenshot = parsed.error.issues.find(
      (issue) => issue.path[0] === "screenshot"
    );
    return {
      ok: false,
      error: badScreenshot
        ? `צילום המסך לא נקלט: ${badScreenshot.message}`
        : "לא ניתן לשלוח הודעה ריקה",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "לא מחובר" };

  // UPLOADED BEFORE THE ROW IS WRITTEN, so the row can carry the path it ended
  // up at. A failure here is deliberately NOT fatal: the words are the
  // feedback and the picture is context, and losing a typed paragraph because
  // an image would not upload is the wrong trade. The student is told, and the
  // message is filed either way.
  let screenshotPath: string | null = null;
  let screenshotFailed = false;
  if (parsed.data.screenshot) {
    const file = parsed.data.screenshot;
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // Foldered by user id because that is what the bucket's INSERT policy
    // checks — a path outside your own folder is refused by the database.
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(FEEDBACK_SCREENSHOT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      screenshotFailed = true;
      // TODO(slice-7): replace with structured logger.
      console.error(
        `[feedback] screenshot upload FAILED user=${user.id} message=${uploadError.message}`
      );
    } else {
      screenshotPath = path;
    }
  }

  // COLUMNS, NOT THE jsonb BODY (migration 20260930000002). Every field here is
  // asked of every student, which makes it a column rather than context: the
  // inbox sorts by type, counts bugs against design complaints and finds the
  // rows carrying a screenshot with an ordinary WHERE. `feedback_body` is left
  // NULL — it still holds the rows filed before the form had columns.
  //
  // No `submitted_at`: the row's own created_at is the authority, and the
  // second copy the jsonb carried existed only because a blob has to be
  // self-contained when exported. A column does not.
  const { error } = await supabase.from("user_feedback").insert({
    user_id: user.id,
    feedback_type: parsed.data.type,
    problem_text: parsed.data.text,
    // Null rather than an empty string, so "not answered" has exactly one
    // representation in the column — which is also what the CHECK enforces.
    expected_text: parsed.data.expected || null,
    screenshot_path: screenshotPath,
    page: parsed.data.page ?? null,
  });

  if (error) {
    // TODO(slice-7): replace with structured logger.
    console.error(
      `[feedback] insert FAILED user=${user.id} code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return { ok: false, error: "השליחה נכשלה. נסו שוב בעוד רגע" };
  }

  // TODO(slice-7): replace with structured logger.
  console.info(
    `[feedback] insert OK user=${user.id} type=${parsed.data.type} chars=${parsed.data.text.length} screenshot=${screenshotPath ? "yes" : "no"}`
  );

  // A saved message whose picture did not upload is a SUCCESS with a note, not
  // a failure: telling the student "השליחה נכשלה" over a message that is
  // safely in the table invites them to type the whole thing again.
  return screenshotFailed ? { ok: true, warning: SCREENSHOT_WARNING } : { ok: true };
}

// ---------------------------------------------------------------------------
// דף טיוטה — the candidate's own scratch page
// ---------------------------------------------------------------------------

/** Matches the CHECK on user_drafts.text (migration 20261005000002). */
const DRAFT_MAX_CHARS = 20_000;

const saveDraftSchema = z.object({
  text: z.string().trim().min(1).max(DRAFT_MAX_CHARS),
});

/**
 * Save a draft.
 *
 * A SERVER ACTION, NOT AN API ROUTE. The house rule is "Server Actions for
 * mutations; API Routes only for webhooks" (CLAUDE.md), and this is a mutation
 * made by a signed-in person from their own browser — the same shape as the
 * feedback box beside it. "Server API" in the sense that matters is satisfied:
 * the write happens on the server, under the caller's session, and the browser
 * never touches the table.
 *
 * ON THE CALLER'S OWN CLIENT, never the service role. user_drafts has
 * students-own-row policies and `user_id` is pinned to auth.uid() by the INSERT
 * policy's CHECK, so this cannot write a draft into somebody else's name even
 * if it tried. The authorization is the database's.
 *
 * NO SUBSCRIPTION GATE. A lapsed student's notes are still their notes, and
 * locking someone out of their own writing is not a thing a paywall should do.
 */
export async function saveUserDraftAction(
  input: { text: string }
): Promise<ActionResult> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "לא ניתן לשמור טיוטה ריקה" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "לא מחובר" };

  const { error } = await supabase.from("user_drafts").insert({
    user_id: user.id,
    text: parsed.data.text,
  });

  if (error) {
    // TODO(slice-7): replace with structured logger.
    console.error(
      `[drafts] insert FAILED user=${user.id} code=${
        (error as { code?: string }).code ?? "unknown"
      } message=${error.message}`
    );
    return { ok: false, error: "השמירה נכשלה. נסו שוב בעוד רגע" };
  }

  // TODO(slice-7): replace with structured logger.
  console.info(`[drafts] insert OK user=${user.id} chars=${parsed.data.text.length}`);
  return { ok: true };
}
