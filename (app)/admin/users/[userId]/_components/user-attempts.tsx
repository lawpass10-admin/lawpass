import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminAttemptRow } from "@/lib/db/admin";

const QUESTION_TYPE_LABELS: Record<AdminAttemptRow["questionType"], string> = {
  source: "מקור",
  angle: "זווית",
};

const MODE_LABELS: Record<AdminAttemptRow["mode"], string> = {
  practice: "תרגול",
  exam: "סימולציה",
};

function fmtDateTime(iso: string): string {
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

function statusLabel(a: AdminAttemptRow): {
  text: string;
  tone: "ok" | "wrong" | "skip";
} {
  if (a.wasSkipped) return { text: "דילוג", tone: "skip" };
  if (a.isCorrect === true) return { text: "נכון", tone: "ok" };
  return { text: "שגוי", tone: "wrong" };
}

export default function UserAttempts({
  attempts,
}: {
  attempts: AdminAttemptRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>פעילות אחרונה</CardTitle>
        <CardDescription>10 הניסיונות האחרונים.</CardDescription>
      </CardHeader>
      <CardContent>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין ניסיונות לרשום.</p>
        ) : (
          // Slice 7 polish (a, c, f, g): tokens for border, hover,
          // status text, and Hebrew-friendly header.
          <div className="overflow-hidden rounded-md border border-[var(--color-line)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right text-xs tracking-wide text-[var(--color-ink-dim)]">
                <tr>
                  <th className="px-3 py-2 font-medium">תאריך</th>
                  <th className="px-3 py-2 font-medium">סוג</th>
                  <th className="px-3 py-2 font-medium">מצב</th>
                  <th className="px-3 py-2 font-medium">תוצאה</th>
                  <th className="px-3 py-2 text-center font-medium">משך (שניות)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {attempts.map((a) => {
                  const status = statusLabel(a);
                  return (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-[var(--color-gold-tint)]"
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {fmtDateTime(a.attemptedAt)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {QUESTION_TYPE_LABELS[a.questionType]}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {MODE_LABELS[a.mode]}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            status.tone === "ok"
                              ? "text-[var(--color-status-strong)]"
                              : status.tone === "wrong"
                                ? "text-[var(--color-status-weak)]"
                                : "text-muted-foreground"
                          }
                        >
                          {status.text}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">
                        {a.durationSeconds ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
