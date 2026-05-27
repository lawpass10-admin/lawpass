import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminUserDetail } from "@/lib/db/admin";

const GENDER_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  other: "אחר",
  prefer_not_to_say: "מעדיף לא לציין",
};

const SIGNUP_SOURCE_LABELS: Record<string, string> = {
  email: "אימייל",
  google: "Google",
};

const PLAN_LABELS: Record<string, string> = {
  "3_months": "3 חודשים",
  "6_months": "6 חודשים",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function UserProfileCard({
  detail,
}: {
  detail: AdminUserDetail;
}) {
  const sub = detail.activeSubscription;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>פרטי פרופיל</CardTitle>
          <CardDescription>מתוך טבלת profiles.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="שם מלא" value={detail.profile.fullName} />
          <Field label="טלפון" value={detail.profile.phone ?? "—"} />
          <Field
            label="מגדר"
            value={GENDER_LABELS[detail.profile.gender] ?? "—"}
          />
          <Field label="תאריך לידה" value={fmtDate(detail.profile.birthDate)} />
          <Field
            label="מועד בחינה מתוכנן"
            value={fmtDate(detail.profile.examDatePlanned)}
          />
          <Field
            label="מקור הרשמה"
            value={
              SIGNUP_SOURCE_LABELS[detail.profile.signupSource] ?? "—"
            }
          />
          <Field
            label="הצטרפות"
            value={fmtDateTime(detail.profile.createdAt)}
          />
          <Field
            label="מנוי פעיל"
            value={
              sub
                ? `${PLAN_LABELS[sub.planType] ?? sub.planType} · עד ${fmtDate(sub.endsAt)}`
                : "ללא"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>פרטי auth</CardTitle>
          <CardDescription>מתוך auth.users (קריאה בלבד).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <Field
            label="אימייל"
            value={
              detail.auth.email ? (
                <span dir="ltr">{detail.auth.email}</span>
              ) : (
                "—"
              )
            }
          />
          <Field
            label="כניסה אחרונה"
            value={fmtDateTime(detail.auth.lastSignInAt)}
          />
          <Field
            label="אימות מייל"
            value={
              detail.auth.emailConfirmedAt
                ? fmtDateTime(detail.auth.emailConfirmedAt)
                : "לא אומת"
            }
          />
          <Field
            label="מזהה משתמש"
            value={
              <span dir="ltr" className="font-mono text-xs">
                {detail.userId}
              </span>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
