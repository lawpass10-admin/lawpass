"use client";

import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchQuestion,
  submitAnswer,
  type HandwritingPage,
  type OpenQuestionDetail,
} from "@/lib/api/open-questions";

import { HandwritingDialog } from "./handwriting-dialog";

/**
 * The question, then the answer sheet.
 *
 * The answer box is sized to two A4 pages because that is the limit the exam
 * itself sets and the marking criteria enforce (`answer_limit` on the question
 * usually says so in words). A4 text height is ~247mm, so two pages of writing
 * area is ~494mm — set as a min-height in mm so it means the same thing on any
 * screen, and left resizable so a student who wants more room has it.
 *
 * ── Answering happens inside a sitting ─────────────────────────────────────
 * Before "התחל בחינה" the box is a DRAFT and the only button is the one that
 * starts the exam: there is no send and no handwriting attach, because a task
 * answered off the clock is not the thing this page is for. Starting a sitting
 * MOVES the draft into the exam sheet, so nothing written while preparing is
 * stranded somewhere it can no longer be filed.
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
 *
 * ── Exam mode (התחל בחינה) ─────────────────────────────────────────────────
 * The sitting is a timed sheet: fifty minutes, counted down on the button
 * itself as a blinking mm:ss clock, amber under five minutes, red under one,
 * and at zero the sheet closes to further typing. It is a rehearsal of the real
 * sitting, so the clock is the point — but the answer already written stays
 * sendable after the buzzer, because refusing to file what the student produced
 * would punish them twice.
 *
 * The clock is derived from a DEADLINE, not decremented per tick: a background
 * tab gets its timers throttled, and a countdown that subtracts one per interval
 * would quietly hand back the minutes the browser skipped.
 *
 * ── Handwriting (הוסף תשובה בכתב ידך) ──────────────────────────────────────
 * The real exam is written by hand, so a sitting also offers a dialog for
 * photographing the paper: up to two images, one per A4 side, uploaded through
 * our server to Cloudinary and filed with the submission (see handwriting-dialog).
 *
 * An answer may then be typed text, photographed pages, or both — the submit
 * button unlocks on either. The one asymmetry is marking: the grader reads
 * text, so a photographed answer is filed and NOT queued, and the page says so
 * in place rather than sending the student to a results screen that would spin
 * waiting for a grade that is not coming.
 */

/** The real sitting's allowance for one writing task. */
const EXAM_SECONDS = 50 * 60;
/** Amber from here down. */
const EXAM_WARN_SECONDS = 5 * 60;
/** Red from here down. */
const EXAM_DANGER_SECONDS = 60;
/**
 * How long a finished sitting stays on screen before it is forgotten.
 *
 * A sitting that ended minutes ago should come back on refresh — the student
 * still wants to read and send what they wrote. One that ended yesterday should
 * not: reopening a spent exam every time the page loads is a haunting, not a
 * feature.
 */
const EXAM_KEEP_AFTER_END_MS = 2 * 60 * 60 * 1000;

/**
 * Where an in-progress sitting is kept across a refresh.
 *
 * localStorage, per question, and deliberately not the server: this is a
 * rehearsal aid, not invigilation. A student who wants more than fifty minutes
 * can clear the key, and that is fine — the clock is here to train the pace, not
 * to be enforced. Making it enforceable means the deadline living on a row the
 * client cannot write, which is a different feature and a bigger one.
 */
const examStorageKey = (questionId: string) => `lawpass:writing-task-exam:${questionId}`;

type StoredExam = { deadline: number; text: string; pages: HandwritingPage[] };

/**
 * Storage is not a trusted source: it survives deploys, another tab may have
 * written an older shape, and a user can edit it by hand. Anything that is not
 * the expected shape is dropped rather than handed to the UI as a page.
 */
function readStoredPages(value: unknown): HandwritingPage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (p): p is HandwritingPage =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as HandwritingPage).url === "string" &&
        typeof (p as HandwritingPage).public_id === "string"
    )
    .slice(0, 2);
}

function readStoredExam(questionId: string): StoredExam | null {
  try {
    const raw = window.localStorage.getItem(examStorageKey(questionId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { deadline, text, pages } = parsed as Partial<StoredExam>;
    if (typeof deadline !== "number" || !Number.isFinite(deadline)) return null;
    if (Date.now() > deadline + EXAM_KEEP_AFTER_END_MS) return null;
    return {
      deadline,
      text: typeof text === "string" ? text : "",
      pages: readStoredPages(pages),
    };
  } catch {
    // Storage can be unavailable (private mode, a blocked origin, a corrupt
    // value). None of that should stop the page rendering — the sitting simply
    // does not survive a refresh.
    return null;
  }
}

function writeStoredExam(questionId: string, value: StoredExam): void {
  try {
    window.localStorage.setItem(examStorageKey(questionId), JSON.stringify(value));
  } catch {
    // Quota or a blocked origin. Nothing to do and nothing worth interrupting
    // the student for.
  }
}

function clearStoredExam(questionId: string): void {
  try {
    window.localStorage.removeItem(examStorageKey(questionId));
  } catch {
    // As above.
  }
}

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

  /** Wall-clock moment the sitting ends. null = exam mode never started. */
  const [examDeadline, setExamDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const [examText, setExamText] = useState("");
  /** Second click confirms leaving, so one stray click cannot end a sitting. */
  const [confirmingExit, setConfirmingExit] = useState(false);

  /**
   * The photographed pages of a handwritten answer, already on Cloudinary and
   * waiting to be filed with the submission. Belongs to the answer, not to the
   * sitting: attaching pages, leaving exam mode and then sending keeps them.
   */
  const [handwriting, setHandwriting] = useState<HandwritingPage[]>([]);
  const [handwritingOpen, setHandwritingOpen] = useState(false);
  /**
   * True after a send that was filed but NOT queued for marking — a handwriting
   * answer with no typed text. The submission is safe; only the grade is
   * missing, and saying so beats a results screen that spins forever.
   */
  const [filedUngraded, setFiledUngraded] = useState(false);

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

  // Resume a sitting left open in another tab or before a refresh. Runs once per
  // question, before the ticking effect below has anything to tick.
  //
  // This is the one legitimate setState-in-an-effect here, and it cannot be
  // lifted into a lazy useState initialiser: localStorage does not exist while
  // this renders on the server, so the initialiser would return "no sitting" on
  // the server and "sitting in progress" on the client, and the two would not
  // match. Restoring after mount is what keeps the hydrated HTML honest.
  useEffect(() => {
    const stored = readStoredExam(questionId);
    if (!stored) return;
    /* eslint-disable react-hooks/set-state-in-effect -- external store, read once after mount; see the note above */
    setExamDeadline(stored.deadline);
    setExamText(stored.text);
    setSecondsLeft(Math.max(0, Math.ceil((stored.deadline - Date.now()) / 1000)));
    // The pages are already uploaded; losing the references on a refresh would
    // mean photographing and uploading them a second time for no reason.
    if (stored.pages.length > 0) setHandwriting(stored.pages);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [questionId]);

  // Ticked four times a second, not once. The displayed value is still whole
  // seconds — but a 1000ms interval drifts against the deadline, and at second
  // resolution that drift is visible: the clock holds a number for two beats and
  // then skips one. Sampling faster keeps the shown second within ~250ms of the
  // truth. It costs nothing: three of the four ticks set the same number, and
  // React bails out of a re-render when the state value is unchanged.
  useEffect(() => {
    if (examDeadline === null) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.ceil((examDeadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [examDeadline]);

  // Persist the sitting as it goes. Debounced, because this writes on every
  // keystroke otherwise and localStorage is synchronous — a two-page answer
  // would be re-serialised on each character typed.
  useEffect(() => {
    if (examDeadline === null) return;
    const value = { deadline: examDeadline, text: examText, pages: handwriting };
    const id = setTimeout(() => writeStoredExam(questionId, value), 700);
    // A closing tab does not wait for the timer, so flush on the way out. This
    // is the difference between losing the last sentence and losing nothing.
    const flush = () => writeStoredExam(questionId, value);
    window.addEventListener("pagehide", flush);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pagehide", flush);
    };
  }, [questionId, examDeadline, examText, handwriting]);

  const examMode = examDeadline !== null;
  const examOver = examMode && secondsLeft <= 0;
  const examTone =
    examOver || secondsLeft <= EXAM_DANGER_SECONDS
      ? {
          text: "var(--color-danger, #b42318)",
          border: "var(--color-danger, #b42318)",
          background: "rgba(180, 35, 24, 0.08)",
        }
      : secondsLeft <= EXAM_WARN_SECONDS
        ? {
            text: "#92400e",
            border: "#f59e0b",
            background: "rgba(245, 158, 11, 0.14)",
          }
        : {
            text: "var(--color-navy-ink)",
            border: "var(--color-border, rgba(0,0,0,0.15))",
            background: "transparent",
          };

  // In exam mode the timed sheet IS the answer — one submit button, sending
  // whichever sheet the student is actually working on.
  const answerText = examMode ? examText : answer;
  const trimmedAnswer = answerText.trim();
  /** Photographed pages count as an answer on their own — see handleSubmit. */
  const hasHandwriting = handwriting.length > 0;
  /**
   * What is on screen is exactly what was last sent — nothing new to file.
   *
   * Attached pages always make it "new": a send clears the attachment, so
   * anything attached now was attached after the last one and has not been
   * filed. That is also what lets an identical text be re-sent with photos.
   */
  const unchangedSinceSend =
    lastSent !== null && lastSent.text === trimmedAnswer && !hasHandwriting;

  async function handleSubmit() {
    // Guard as well as disable: a double-click can land a second call before
    // React re-renders the disabled button, and that would file two rows. Only
    // an identical re-send is refused — a rewritten answer is a new attempt and
    // is meant to go through.
    if (submitting || unchangedSinceSend) return;
    // An answer is typed text, photographed pages, or both. Requiring text from
    // a student who answered on paper would be asking them to type something
    // they do not mean.
    if (!trimmedAnswer && !hasHandwriting) return;
    setSubmitting(true);
    setSubmitError("");
    setFiledUngraded(false);

    const result = await submitAnswer(questionId, answerText, handwriting);
    if (result.ok) {
      setLastSent({ text: trimmedAnswer, attempt: result.data.attempt_number });
      // The pages have been filed and belong to that row now. Clearing them
      // means the next attempt starts from paper the student chooses again,
      // rather than quietly re-filing the same photos with a rewritten answer.
      // Nothing is lost — the submitted row keeps its own references.
      setHandwriting([]);
      // The sitting is over the moment it is filed. Leaving it in storage would
      // reopen a spent exam the next time this question is opened.
      //
      // On the stay-in-place path below the sitting is still on screen — clock
      // running, text in the box — and the persist effect writes it back a beat
      // later. That is deliberate: storage should match what the student is
      // looking at, so a refresh returns them to it.
      clearStoredExam(questionId);

      // A handwriting-only answer is filed but not queued for marking — the
      // grader reads text. Sending the student to the results screen would put
      // them in front of a spinner for a grade that is not coming, so they stay
      // here with a receipt that says what actually happened.
      if (result.data.grading_queued === false) {
        setFiledUngraded(true);
        setSubmitting(false);
        return;
      }

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

  /**
   * Begin the sitting.
   *
   * Whatever is in the draft box moves into the exam sheet rather than being
   * left behind. Sending happens only inside a sitting, so a draft left where
   * it was would be text the student can no longer file — and this is the
   * mirror of exitExamMode, which moves the sheet back the other way.
   */
  function startExam() {
    setExamDeadline(Date.now() + EXAM_SECONDS * 1000);
    setSecondsLeft(EXAM_SECONDS);
    if (answer.trim()) {
      setExamText(answer);
      setAnswer("");
    }
  }

  /**
   * Leave the sitting, keeping what was written.
   *
   * The exam sheet is carried back into the draft box rather than dropped —
   * appended below what is already there when the draft is not empty, so
   * nothing a student wrote is ever destroyed by leaving.
   */
  function exitExamMode() {
    const carried = examText.trim();
    setExamDeadline(null);
    setSecondsLeft(EXAM_SECONDS);
    setExamText("");
    setConfirmingExit(false);
    clearStoredExam(questionId);
    if (!carried) return;
    setAnswer((draft) =>
      draft.trim() ? `${draft.trimEnd()}\n\n— גיליון הבחינה —\n\n${carried}` : carried
    );
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
              {examMode ? "מטלת בחינה בתנאי זמן" : "טיוטה"}
            </h2>
            <span
              className="font-heebo"
              style={{
                fontSize: 12,
                color: examOver
                  ? "var(--color-danger, #b42318)"
                  : "var(--color-ink-muted)",
                fontWeight: examOver ? 700 : 400,
              }}
            >
              {examOver
                ? "זמן השאלה הסתיים"
                : trimmedAnswer
                  ? `${countWords(answerText)} מילים`
                  : hasHandwriting
                    ? `כתב יד — ${handwriting.length === 1 ? "עמוד אחד" : "שני עמודים"}`
                    : "עד שני עמודים"}
            </span>
          </div>

          {examMode ? (
            <Textarea
              value={examText}
              onChange={(e) => {
                // Guard as well as readOnly: a paste or an IME commit can land
                // on the tick the clock hits zero.
                if (examOver) return;
                setExamText(e.target.value);
              }}
              readOnly={examOver}
              dir="rtl"
              aria-label="מטלת בחינה בתנאי זמן"
              placeholder={
                examOver ? "זמן השאלה הסתיים" : "כתוב כאן את תשובתך…"
              }
              className="w-full resize-y font-heebo leading-[1.9]"
              style={{
                minHeight: "494mm",
                fontSize: 15,
                // The closed sheet has to LOOK closed, or a student keeps typing
                // into a box that silently drops the keystrokes.
                background: examOver ? "rgba(180, 35, 24, 0.04)" : undefined,
                borderColor: examOver ? "var(--color-danger, #b42318)" : undefined,
                cursor: examOver ? "not-allowed" : undefined,
              }}
            />
          ) : (
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              dir="rtl"
              aria-label="טיוטה"
              placeholder="אפשר לכתוב כאן טיוטה — התשובה נשלחת ממצב בחינה…"
              className="w-full resize-y font-heebo leading-[1.9]"
              style={{ minHeight: "494mm", fontSize: 15 }}
            />
          )}

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
            {/* Sending and attaching belong to a sitting. Before one is started
                there is nothing to send: the box above is a draft, and offering
                a disabled "שלח" beside it only asks the student to work out why
                it will not press. */}
            {examMode ? (
              <Button
                type="button"
                disabled={
                  (!trimmedAnswer && !hasHandwriting) ||
                  submitting ||
                  unchangedSinceSend
                }
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
            ) : null}

            <Button
              type="button"
              variant={examMode ? "outline" : "secondary"}
              onClick={() => {
                if (examMode) return;
                startExam();
              }}
              disabled={examMode}
              className="h-11 font-bold md:h-10"
              style={
                examMode
                  ? {
                      // The clock lives on the button, so its colour is the
                      // warning: amber under five minutes, red under one, and
                      // red for good once the sheet has closed.
                      borderColor: examTone.border,
                      color: examTone.text,
                      background: examTone.background,
                      opacity: 1,
                    }
                  : undefined
              }
            >
              {!examMode ? (
                "התחל בחינה"
              ) : examOver ? (
                "זמן השאלה הסתיים"
              ) : (
                <>
                  נותרו <ExamClock seconds={secondsLeft} />
                </>
              )}
            </Button>

            {/* The paper route — part of the sitting, like the send button, and
                still available after the buzzer: photographing pages takes a
                minute, and the answer was written while the clock ran anyway. */}
            {examMode ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setHandwritingOpen(true)}
                disabled={submitting}
                className="h-11 md:h-10"
              >
                <PenLine className="size-4" aria-hidden />
                {hasHandwriting
                  ? `כתב יד — ${handwriting.length === 1 ? "עמוד אחד" : "שני עמודים"}`
                  : "הוסף תשובה בכתב ידך"}
              </Button>
            ) : null}

            {examMode ? (
              confirmingExit ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={exitExamMode}
                    className="h-11 md:h-10"
                  >
                    אישור יציאה
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmingExit(false)}
                    className="h-11 md:h-10"
                  >
                    ביטול
                  </Button>
                  <span
                    className="font-heebo"
                    style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
                  >
                    {/* The pages stay attached and come back with the next
                        sitting — the attach button only exists inside one, so
                        without saying this they would appear to vanish. */}
                    {(examOver
                      ? "הטקסט שכתבת יועבר לתיבת הטיוטה."
                      : "השעון ייעצר והטקסט שכתבת יועבר לתיבת הטיוטה.") +
                      (hasHandwriting
                        ? " העמודים שצילמת יישמרו ויחזרו בבחינה הבאה."
                        : "")}
                  </span>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingExit(true)}
                  className="h-11 md:h-10"
                >
                  יציאה ממצב בחינה
                </Button>
              )
            ) : null}

            {lastSent ? (
              <span
                role="status"
                className="flex items-center gap-1.5 font-heebo font-semibold"
                style={{ fontSize: 13, color: "var(--color-success, #067647)" }}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                {filedUngraded
                  ? `ניסיון ${lastSent.attempt} נשמר`
                  : `ניסיון ${lastSent.attempt} נשלח לבדיקה`}
              </span>
            ) : null}

            <span
              className="font-heebo"
              style={{
                fontSize: 12,
                color: "var(--color-ink-muted)",
                // The exit confirmation says its own piece; two explanations
                // side by side is noise at the moment of a decision.
                display: confirmingExit ? "none" : undefined,
              }}
            >
              {filedUngraded
                ? "התשובה בכתב יד נשמרה במלואה. בדיקה אוטומטית של תשובות בכתב יד עדיין לא זמינה — תשובה מוקלדת נבדקת מיד."
                : hasHandwriting
                  ? `צורפו ${handwriting.length === 1 ? "עמוד אחד" : "שני עמודים"} בכתב יד. העמודים יישמרו לתשובה רק אחרי לחיצה על "שלח את השאלה לבדיקה".`
                  : examOver
                    ? "הזמן הסתיים ולא ניתן להוסיף לתשובה — אפשר עדיין לשלוח אותה לבדיקה."
                    : examMode
                    ? "בחינה בתנאי זמן: 50 דקות. אפשר לכתוב כאן, לצרף עמודים בכתב יד ולשלוח. רענון הדף אינו מאפס את השעון."
                    : "כדי לענות ולשלוח — בהקלדה או בכתב יד — יש להתחיל בחינה: 50 דקות, כמו במבחן. מה שכתוב כאן יעבור לגיליון הבחינה."}
            </span>
          </div>
        </CardContent>
      </Card>

      <HandwritingDialog
        questionId={questionId}
        open={handwritingOpen}
        onOpenChange={setHandwritingOpen}
        pages={handwriting}
        onPagesChange={setHandwriting}
      />
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

/**
 * The clock face: mm:ss, with a colon that blinks once a second.
 *
 * Seconds all the way down, not minutes — a rehearsal clock is being watched,
 * and a number that only moves once a minute cannot be told apart from a page
 * that has stopped. The blinking colon says the same thing between ticks.
 *
 * Two details that are easy to get wrong in an RTL page:
 *   • `dir="ltr"` + bidi isolation. The colon is its own element, so without
 *     isolation the bidi algorithm is free to lay the three pieces out
 *     right-to-left and 49:59 renders as 59:49.
 *   • `tabular-nums`. Proportional digits change width as they change value,
 *     which makes the whole button twitch once a second.
 *
 * The colon stays real text (only its opacity animates), so a screen reader
 * still reads a time and not a four-digit number.
 */
function ExamClock({ seconds }: { seconds: number }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span dir="ltr" className="tabular-nums" style={{ unicodeBidi: "isolate" }}>
      {mm}
      <span className="exam-clock-colon">:</span>
      {ss}
    </span>
  );
}
