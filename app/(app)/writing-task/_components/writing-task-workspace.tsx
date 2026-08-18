"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchQuestion,
  submitAnswer,
  type OpenQuestionDetail,
} from "@/lib/api/open-questions";

/**
 * The question, then the answer sheet.
 *
 * The answer box is sized to two A4 pages because that is the limit the exam
 * itself sets and the marking criteria enforce (`answer_limit` on the question
 * usually says so in words). A4 text height is ~247mm, so two pages of writing
 * area is ~494mm — set as a min-height in mm so it means the same thing on any
 * screen, and left resizable so a student who wants more room has it.
 *
 * Submitting files the answer against the student's own user id — taken from
 * the session server-side, never sent from here — and the row lands ungraded.
 * The grade itself is a later flow; `score` on the row stays NULL until
 * something marks it.
 *
 * Submitting does NOT close the task. The textarea stays editable and the
 * student can send the same task again as many times as they like; each send is
 * its own row, and the server stamps it with an attempt number (1, 2, 3…) which
 * is what the status line reports. What a send does not do is undo an earlier
 * one — the rows already filed stay as they were sent.
 */
export function WritingTaskWorkspace({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState<OpenQuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** The last send that succeeded: the exact text, and which attempt it was. */
  const [lastSent, setLastSent] = useState<{
    text: string;
    attempt: number;
  } | null>(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchQuestion(questionId);
      if (cancelled) return;
      if (result.ok) setQuestion(result.data);
      else setError(result.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  const trimmedAnswer = answer.trim();
  /** The text on screen is exactly what was last sent — nothing new to file. */
  const unchangedSinceSend = lastSent !== null && lastSent.text === trimmedAnswer;

  async function handleSubmit() {
    // Guard as well as disable: a double-click can land a second call before
    // React re-renders the disabled button, and that would file two rows. Only
    // an identical re-send is refused — a rewritten answer is a new attempt and
    // is meant to go through.
    if (submitting || unchangedSinceSend || !trimmedAnswer) return;
    setSubmitting(true);
    setSubmitError("");

    const result = await submitAnswer(questionId, answer);
    if (result.ok) {
      setLastSent({ text: trimmedAnswer, attempt: result.data.attempt_number });
      // Straight to the marking screen. Grading has already started server-side
      // and takes about a minute, so that page owns the waiting — it polls, and
      // it survives a refresh or a closed tab in a way this editor cannot.
      // `submitting` is deliberately left true: the navigation is in flight and
      // re-enabling the button would invite a second submission.
      router.push(`/writing-task/results/${result.data.answer_id}`);
      return;
    }

    setSubmitError(result.error);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <p
        className="flex items-center gap-2 font-heebo text-sm"
        style={{ color: "var(--color-ink-dim)" }}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        טוען את השאלה…
      </p>
    );
  }

  if (error || !question) {
    return (
      <div
        role="alert"
        className="rounded-lg border px-4 py-3 font-heebo text-sm"
        style={{
          borderColor: "var(--color-danger, #b42318)",
          color: "var(--color-danger, #b42318)",
          background: "rgba(180, 35, 24, 0.06)",
        }}
      >
        {error || "השאלה לא נמצאה"}
      </div>
    );
  }

  const title = question.angle_title || question.title || "מטלת כתיבה";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1
          className="font-heebo font-extrabold tracking-tight"
          style={{
            fontSize: "clamp(24px, 2.1vw, 32px)",
            color: "var(--color-navy-ink)",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>
        <p
          className="flex flex-wrap gap-x-4 font-heebo"
          style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
        >
          {question.subject ? <span>{question.subject}</span> : null}
          {question.answer_limit ? <span>{question.answer_limit}</span> : null}
          {question.client_role ? <span>{question.client_role}</span> : null}
        </p>
      </header>

      {/* The paper */}
      <Card>
        <CardContent className="space-y-6 px-4 py-6 md:px-8">
          {question.fact_pattern ? (
            <Section heading="העובדות">
              <Paragraphs text={question.fact_pattern} />
            </Section>
          ) : null}

          {question.timeline && question.timeline.length > 0 ? (
            <Section heading="ציר הזמן">
              <ul className="space-y-1.5">
                {question.timeline.map((entry, i) => (
                  <li
                    key={i}
                    className="font-heebo"
                    style={{ fontSize: 15, color: "var(--color-ink)" }}
                  >
                    <span className="font-bold">{entry.date}</span>
                    {entry.date && entry.event ? " — " : null}
                    <span>{entry.event}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {question.task_instructions ? (
            <Section heading="המטלה">
              <Paragraphs text={question.task_instructions} />
            </Section>
          ) : null}

          {question.quotes.length > 0 ? (
            <Section heading="המקורות המצורפים">
              <div className="space-y-4">
                {question.quotes.map((q) => (
                  <article
                    key={q.id}
                    className="rounded-lg border px-4 py-3"
                    style={{
                      borderColor: "var(--color-border, rgba(0,0,0,0.12))",
                      background: "var(--color-paper-2, rgba(0,0,0,0.02))",
                    }}
                  >
                    {q.citation ? (
                      <h3
                        className="mb-1 font-heebo font-bold"
                        style={{ fontSize: 14, color: "var(--color-navy-ink)" }}
                      >
                        {q.citation}
                      </h3>
                    ) : null}
                    {q.text ? (
                      <p
                        className="whitespace-pre-wrap font-heebo"
                        style={{
                          fontSize: 14,
                          lineHeight: 1.75,
                          color: "var(--color-ink)",
                        }}
                      >
                        {q.text}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </Section>
          ) : null}
        </CardContent>
      </Card>

      {/* The answer sheet */}
      <Card>
        <CardContent className="space-y-3 px-4 py-6 md:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className="font-heebo font-bold"
              style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
            >
              התשובה שלך
            </h2>
            <span
              className="font-heebo"
              style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
            >
              {answer.trim() ? `${countWords(answer)} מילים` : "עד שני עמודים"}
            </span>
          </div>

          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            dir="rtl"
            aria-label="התשובה שלך"
            placeholder="כתוב כאן את תשובתך…"
            className="w-full resize-y font-heebo leading-[1.9]"
            style={{ minHeight: "494mm", fontSize: 15 }}
          />

          {submitError ? (
            <div
              role="alert"
              className="rounded-lg border px-4 py-3 font-heebo text-sm"
              style={{
                borderColor: "var(--color-danger, #b42318)",
                color: "var(--color-danger, #b42318)",
                background: "rgba(180, 35, 24, 0.06)",
              }}
            >
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              disabled={!trimmedAnswer || submitting || unchangedSinceSend}
              onClick={handleSubmit}
              className="h-11 md:h-10"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  שולח…
                </>
              ) : lastSent ? (
                "שלח ניסיון נוסף לבדיקה"
              ) : (
                "שלח את השאלה לבדיקה"
              )}
            </Button>

            {lastSent ? (
              <span
                role="status"
                className="flex items-center gap-1.5 font-heebo font-semibold"
                style={{ fontSize: 13, color: "var(--color-success, #067647)" }}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                {`ניסיון ${lastSent.attempt} נשלח לבדיקה`}
              </span>
            ) : null}

            <span
              className="font-heebo"
              style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
            >
              {lastSent
                ? "אפשר להמשיך לכתוב ולשלוח שוב — כל שליחה נשמרת כניסיון נפרד."
                : "אפשר לשלוח את המטלה יותר מפעם אחת — כל שליחה נשמרת כניסיון נפרד."}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2
        className="font-heebo font-bold"
        style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
      >
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** Blank-line separated source text -> paragraphs, same rule as the PDF renderer. */
function Paragraphs({ text }: { text: string }) {
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <p
          key={i}
          className="whitespace-pre-wrap font-heebo"
          style={{ fontSize: 15, lineHeight: 1.85, color: "var(--color-ink)" }}
        >
          {p}
        </p>
      ))}
    </div>
  );
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
