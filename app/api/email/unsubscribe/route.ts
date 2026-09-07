/**
 * One-click unsubscribe.
 *
 * GET  — a person clicked the footer link; answer with a Hebrew confirmation.
 * POST — Gmail's one-click unsubscribe button, driven by the
 *        `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header. It expects
 *        a 2xx and shows nothing, so the body does not matter here.
 *
 * Both are unauthenticated by design: the HMAC in the URL is the authorisation.
 * See lib/email/unsubscribe-token.ts for why.
 *
 * This route only ever sets a flag to TRUE. It cannot re-subscribe anyone, so
 * a leaked link is a nuisance at worst and never a way to start mail flowing.
 */

import { NextResponse } from "next/server";

import { verifyUnsubscribe } from "@/lib/email/unsubscribe-token";
import { createAdminClient } from "@/lib/supabase/admin";

// Needs node:crypto and the service-role key.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function optOut(request: Request): Promise<{ ok: boolean; status: number }> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";

  if (!verifyUnsubscribe(userId, token)) return { ok: false, status: 400 };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ email_opt_out: true })
    .eq("id", userId);

  if (error) {
    console.error("[unsubscribe] failed to opt out", error.message);
    return { ok: false, status: 500 };
  }
  return { ok: true, status: 200 };
}

export async function POST(request: Request): Promise<NextResponse> {
  const { ok, status } = await optOut(request);
  return NextResponse.json({ ok }, { status });
}

export async function GET(request: Request): Promise<Response> {
  const { ok, status } = await optOut(request);

  const message = ok
    ? {
        heading: "הוסרת מרשימת התפוצה",
        body: "לא נשלח לך יותר דוא״ל תזכורת. הודעות הקשורות לחשבון עצמו — איפוס סיסמה, אימות כתובת — עדיין יישלחו.",
      }
    : status === 400
      ? {
          heading: "הקישור אינו תקין",
          body: "ייתכן שהקישור נקטע בהעתקה. אפשר לפתוח אותו ישירות מתוך הודעת הדוא״ל, או לפנות אלינו.",
        }
      : {
          heading: "משהו השתבש",
          body: "לא הצלחנו לעדכן את ההעדפות שלך כרגע. נסו שוב מאוחר יותר.",
        };

  // A plain page rather than a redirect into the app: the person clicking this
  // is, by definition, someone who does not want to be taken to our product.
  return new Response(
    `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${message.heading} — LawPass</title>
</head>
<body style="margin:0;background:#F4F5F7;font-family:'Heebo',Arial,'Segoe UI',Tahoma,sans-serif;direction:rtl;">
  <div style="max-width:520px;margin:64px auto;padding:32px;background:#fff;border:1px solid #E8E5DC;border-radius:12px;text-align:right;">
    <div style="font-size:13px;font-weight:bold;color:#1E3A8A;">LawPass</div>
    <h1 style="margin:10px 0 14px;font-size:21px;color:#0F1F4F;">${message.heading}</h1>
    <p style="margin:0;font-size:15px;line-height:1.7;color:#535A6E;">${message.body}</p>
  </div>
</body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
