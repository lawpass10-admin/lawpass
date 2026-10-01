"use server";

import { headers } from "next/headers";

import { isEmailConfigured, renderEmail, sendEmail } from "@/lib/email";
import { contactSchema, type ContactInput } from "@/lib/validators/contact";
import { createClient } from "@/lib/supabase/server";

export type ContactResult = { ok: true } | { ok: false; error: string };

/** Where contact messages are sent. */
const CONTACT_INBOX = "lawpass10@gmail.com";

/**
 * Store one message from the צרו קשר / תמיכה dialog.
 *
 * RE-VALIDATED HERE. The dialog validates with the same schema before it calls,
 * but that runs in the browser and a server action is a public endpoint —
 * anything that reaches this function has to be checked as though the form did
 * not exist, because it may not have.
 *
 * WRITTEN WITH THE CALLER'S OWN CLIENT, not the service role. The table's RLS
 * policy grants INSERT to anon and authenticated and grants no SELECT to
 * either, so this path can add a message and cannot read one back. Reaching for
 * the service role here would hand a public form the ability to read every
 * message in the table if it were ever misused.
 *
 * `user_id` is attached when the sender happens to be signed in. It is not
 * required — the form lives on a public page — and no attempt is made to
 * reconcile it with the address typed into the form: someone may legitimately
 * write from an account and ask to be answered elsewhere.
 */
export async function submitContactAction(input: ContactInput): Promise<ContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "חלק מהשדות אינם תקינים. בדקו ונסו שוב." };
  }

  // THE HONEYPOT. `website` is hidden from people, so anything in it came from
  // something filling every input it found. The answer is a successful-looking
  // response that stores nothing: telling a bot it was caught only tells
  // whoever wrote it which field to leave alone next time.
  if (parsed.data.website && parsed.data.website.trim() !== "") {
    console.info("[contact] honeypot tripped — discarded");
    return { ok: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // x-forwarded-for is a list when there are proxies in front; the first entry
  // is the client. It is spoofable, which is why it rate limits rather than
  // authorises anything.
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const senderIp = forwarded.split(",")[0]?.trim() || null;

  // The RPC counts recent submissions from this IP and inserts, in one call —
  // the anon role has no SELECT here, and the two cannot be split without
  // leaving a window where parallel submissions all pass the check. See
  // migration 20261001000007.
  const { data, error } = await supabase.rpc("submit_general_comment", {
    p_full_name: parsed.data.full_name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_comment: parsed.data.comment,
    p_sender_ip: senderIp,
  });

  if (error) {
    if (error.message.includes("rate_limited")) {
      return {
        ok: false,
        error: "נשלחו מכם מספר פניות בזמן קצר. נסו שוב בעוד כשעה.",
      };
    }
    // Logged rather than swallowed: a contact form that silently drops messages
    // is worse than one that is plainly broken, because nobody finds out.
    console.error("[contact] insert failed", { message: error.message });
    return { ok: false, error: "השליחה נכשלה. נסו שוב בעוד רגע." };
  }

  // The notification is sent AFTER the row is committed, and its failure does
  // not fail the submission. The database is the record; the email is how
  // somebody finds out about it. If Resend is down, the sender should not be
  // told their message was lost when it is sitting safely in the table — it
  // would only make them send it again.
  //
  // `should_notify` is the hourly email cap's answer (migration
  // 20261001000008). False means the ceiling was reached: the message is
  // stored, no mail goes out, and the sender is told it was sent — because it
  // was. The cap protects the inbox and the sending domain, not the sender.
  const shouldNotify = Array.isArray(data) ? data[0]?.should_notify !== false : true;
  if (shouldNotify) {
    await notify(parsed.data, user?.id ?? null);
  } else {
    console.warn("[contact] hourly email cap reached — stored without notifying");
  }

  return { ok: true };
}

/**
 * Tell the team a message arrived.
 *
 * `replyTo` is the SENDER's address, so hitting reply in the inbox answers the
 * person rather than the platform's own from-address. That is the one detail
 * that decides whether this is useful or an extra copy-paste every time.
 */
async function notify(input: ContactInput, userId: string | null): Promise<void> {
  if (!isEmailConfigured()) {
    // Not an error: local and preview environments run without Resend
    // credentials on purpose. Worth a line so a missing notification in
    // production is distinguishable from one that was never attempted.
    console.info("[contact] email not configured — notification skipped");
    return;
  }

  const html = renderEmail({
    heading: "פנייה חדשה מהאתר",
    preheader: `${input.full_name} — ${input.email}`,
    paragraphs: [
      `שם מלא: ${input.full_name}`,
      `דוא"ל: ${input.email}`,
      `טלפון: ${input.phone}`,
      userId ? `משתמש מחובר: ${userId}` : "נשלח ללא התחברות",
      `התקבל: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
      "תוכן הפנייה:",
      input.comment,
    ],
  });

  try {
    const result = await sendEmail({
      to: CONTACT_INBOX,
      subject: `פנייה חדשה מ-${input.full_name}`,
      html,
      // Answering the sender should be one click, not a copy-paste.
      replyTo: input.email,
      tags: { type: "contact_form" },
    });
    if (!result.ok) {
      console.error("[contact] notification failed", { error: result.error });
    }
  } catch (cause) {
    // Thrown rather than returned — a network failure reaching Resend. Caught
    // here so it cannot turn a stored message into a failed submission.
    console.error("[contact] notification threw", {
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
