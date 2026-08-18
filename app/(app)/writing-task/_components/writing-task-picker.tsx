"use client";

import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchQuestionsBySubject,
  fetchSubjects,
  type OpenQuestionListEntry,
  type OpenQuestionSubject,
} from "@/lib/api/open-questions";
import { cn } from "@/lib/utils";

/**
 * Two-step picker: subject → question → open it.
 *
 * The two lists load separately rather than fetching everything up front: a
 * subject can hold many questions, and the student only ever looks at one
 * subject's worth. Choosing a subject clears any selected question, so the
 * "בחר שאלה" button can never carry a stale id from the previous subject.
 */
export function WritingTaskPicker() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<OpenQuestionSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subject, setSubject] = useState<string>("");

  const [questions, setQuestions] = useState<OpenQuestionListEntry[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchSubjects();
      if (cancelled) return;
      if (result.ok) setSubjects(result.data);
      else setError(result.error);
      setSubjectsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch only. Every reset — clearing the old list, the old selection, the old
  // error, and raising the loading flag — happens in the Select's handler
  // instead: setting state synchronously in an effect body costs a cascading
  // render, and picking a subject is exactly the event that should do it.
  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchQuestionsBySubject(subject);
      // The guard matters: switching subjects quickly would otherwise let a
      // slow earlier response overwrite the newer subject's list.
      if (cancelled) return;
      if (result.ok) setQuestions(result.data);
      else {
        setQuestions([]);
        setError(result.error);
      }
      setQuestionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [subject]);

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border px-4 py-3 font-heebo text-sm"
          style={{
            borderColor: "var(--color-danger, #b42318)",
            color: "var(--color-danger, #b42318)",
            background: "rgba(180, 35, 24, 0.06)",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Step 1 — subject */}
      <Card>
        <CardContent className="space-y-3 px-4 py-5 md:px-6">
          <div className="flex items-center gap-2">
            <StepBadge n={1} />
            <Label
              htmlFor="writing-task-subject"
              className="font-heebo text-base font-bold"
              style={{ color: "var(--color-navy-ink)" }}
            >
              נושא
            </Label>
          </div>
          <p
            className="font-heebo"
            style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
          >
            הנושאים שיש עבורם מטלות כתיבה.
          </p>

          {subjectsLoading ? (
            <Skeletonish label="טוען נושאים…" />
          ) : subjects.length === 0 ? (
            <p
              className="font-heebo text-sm"
              style={{ color: "var(--color-ink-dim)" }}
            >
              אין כרגע נושאים זמינים.
            </p>
          ) : (
            <Select
              value={subject}
              onValueChange={(v) => {
                const next = v ?? "";
                setSubject(next);
                // A stale question list must not show under the new subject,
                // and a stale id must not reach the "בחר שאלה" button.
                setSelectedId("");
                setQuestions([]);
                setError("");
                setQuestionsLoading(Boolean(next));
              }}
            >
              <SelectTrigger id="writing-task-subject" className="w-full md:w-[520px]">
                <SelectValue placeholder="בחר נושא" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.subject} value={s.subject}>
                    {s.subject} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — question */}
      <Card>
        <CardContent className="space-y-3 px-4 py-5 md:px-6">
          <div className="flex items-center gap-2">
            <StepBadge n={2} />
            <span
              className="font-heebo text-base font-bold"
              style={{ color: "var(--color-navy-ink)" }}
            >
              שאלה
            </span>
          </div>

          {!subject ? (
            <p
              className="font-heebo text-sm"
              style={{ color: "var(--color-ink-dim)" }}
            >
              בחר נושא כדי לראות את השאלות.
            </p>
          ) : questionsLoading ? (
            <Skeletonish label="טוען שאלות…" />
          ) : questions.length === 0 ? (
            <p
              className="font-heebo text-sm"
              style={{ color: "var(--color-ink-dim)" }}
            >
              אין שאלות בנושא זה.
            </p>
          ) : (
            <ul className="space-y-2" role="radiogroup" aria-label="שאלות">
              {questions.map((q) => {
                const active = q.open_question_id === selectedId;
                return (
                  <li key={q.open_question_id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedId(q.open_question_id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-right transition-colors",
                        "hover:bg-[color:var(--color-paper-2,rgba(0,0,0,0.02))]",
                        active
                          ? "border-[color:var(--color-navy-ink)] ring-1 ring-[color:var(--color-navy-ink)]"
                          : "border-[color:var(--color-border,rgba(0,0,0,0.12))]"
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <FileText
                          className="mt-0.5 size-5 shrink-0"
                          style={{ color: "var(--color-gold-deep)" }}
                          aria-hidden
                        />
                        <span className="flex-1">
                          <span
                            className="block font-heebo font-bold"
                            style={{ fontSize: 15, color: "var(--color-navy-ink)" }}
                          >
                            {q.title}
                          </span>
                          {q.deliverable ? (
                            <span
                              className="mt-0.5 block font-heebo"
                              style={{ fontSize: 13, color: "var(--color-ink-dim)" }}
                            >
                              {q.deliverable}
                            </span>
                          ) : null}
                          <span
                            className="mt-1 flex flex-wrap gap-x-3 font-heebo"
                            style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
                          >
                            {q.external_id ? (
                              <span dir="ltr">{q.external_id}</span>
                            ) : null}
                            {q.answer_limit ? <span>{q.answer_limit}</span> : null}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="pt-1">
            <Button
              type="button"
              disabled={!selectedId}
              onClick={() => router.push(`/writing-task/${selectedId}`)}
              className="h-11 md:h-10"
            >
              בחר שאלה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** The small numbered chip the practice builder uses on each step. */
function StepBadge({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-6 items-center justify-center rounded-md font-heebo text-xs font-bold"
      style={{
        background: "var(--color-navy-ink)",
        color: "var(--color-paper, #fff)",
      }}
    >
      {n}
    </span>
  );
}

function Skeletonish({ label }: { label: string }) {
  return (
    <p
      className="flex items-center gap-2 font-heebo text-sm"
      style={{ color: "var(--color-ink-dim)" }}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </p>
  );
}
