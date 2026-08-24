"use client";

import { CheckCircle2, CircleSlash, Loader2, MinusCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchAnswer,
  fetchQuestion,
  type AnswerScore,
  type AnswerState,
  type GradingProgress,
  type ScoredItem,
} from "@/lib/api/open-questions";

/**
 * The marking of one submission — and the waiting room before it exists.
 *
 * Grading runs in the background and takes minutes, so this screen has three
 * states, not one: still being marked, marked, and gave up. The waiting state is
 * the common one on arrival, because the student gets here the instant they
 * press send.
 *
 * Polling stops on its own. A page that retries forever quietly turns one stuck
 * row into a request every three seconds for as long as the tab is open, so
 * after POLL_LIMIT tries it says so and offers a manual retry instead.
 */
const POLL_MS = 3000;
// Six minutes. It was two, which was shorter than grading itself: a measured run
// took 218 seconds, so a student who sat and waited was shown "this is taking
// longer than expected" a full minute and a half BEFORE their score arrived,
// and had to reload to see a result that was already waiting for them.
const POLL_LIMIT = 120;

type Phase = "loading" | "waiting" | "graded" | "failed" | "timeout" | "error";

export function AnswerFeedback({ answerId }: { answerId: string }) {
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [title, setTitle] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  // When the marking run started, on this browser's clock. Derived here, as the
  // poll lands, because that is the only moment at which the server's
  // `elapsed_ms` and our own `Date.now()` are known to refer to the same
  // instant; the waiting screen then counts forward from it every second.
  const [gradingStartedAt, setGradingStartedAt] = useState<number | null>(null);
  const attempts = useRef(0);

  const load = useCallback(async (): Promise<AnswerState | null> => {
    const result = await fetchAnswer(answerId);
    if (!result.ok) {
      setError(result.error);
      setPhase("error");
      return null;
    }
    setAnswer(result.data);
    if (result.data.progress) {
      setGradingStartedAt(Date.now() - result.data.progress.elapsed_ms);
    }
    if (result.data.grading_status === "graded" && result.data.score) setPhase("graded");
    else if (result.data.grading_status === "failed") setPhase("failed");
    else setPhase("waiting");
    return result.data;
  }, [answerId]);

  // Poll while the marker still has it. The timeout chain is cancelled on
  // unmount, so navigating away mid-grading does not leave a request loop behind.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const data = await load();
      if (cancelled || !data) return;
      if (data.grading_status === "graded" || data.grading_status === "failed") return;

      attempts.current += 1;
      if (attempts.current >= POLL_LIMIT) {
        setPhase("timeout");
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  // The task's title, for the header. Best-effort: a failure here costs a
  // heading, not the marking, so it never blocks the screen.
  useEffect(() => {
    if (!answer?.open_question_id) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchQuestion(answer.open_question_id);
      if (!cancelled && result.ok) {
        setTitle(result.data.angle_title || result.data.title || "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [answer?.open_question_id]);

  if (phase === "loading") {
    return (
      <Waiting
        title=""
        attempt={0}
        justSubmitted={false}
        progress={null}
        startedAt={null}
      />
    );
  }
  if (phase === "error") return <Notice tone="danger">{error || "התשובה לא נמצאה"}</Notice>;

  if (phase === "waiting") {
    return (
      <Waiting
        title={title}
        attempt={answer?.attempt_number ?? 0}
        justSubmitted
        progress={answer?.progress ?? null}
        startedAt={gradingStartedAt}
      />
    );
  }

  if (phase === "timeout") {
    return (
      <div className="space-y-4">
        <Notice tone="muted">
          הבדיקה נמשכת יותר מהצפוי. התשובה שלך נשמרה במלואה — אפשר לרענן את הדף בעוד כמה
          דקות, והציון יופיע כאן.
        </Notice>
        <Button type="button" onClick={() => window.location.reload()} className="h-11 md:h-10">
          <RefreshCw className="size-4" aria-hidden />
          רענן
        </Button>
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="space-y-4">
        <Notice tone="danger">
          לא הצלחנו לסיים את הבדיקה של התשובה הזו. התשובה שלך שמורה ולא אבדה — נסה שוב
          מאוחר יותר, ואם זה חוזר, פנה אלינו.
        </Notice>
        <Link href="/writing-task">
          <Button type="button" variant="outline" className="h-11 md:h-10">
            חזרה למטלות
          </Button>
        </Link>
      </div>
    );
  }

  if (!answer?.score) return <Notice tone="muted">אין ציון להצגה.</Notice>;
  return <Marked answer={answer} score={answer.score} title={title} />;
}

/* ─────────────────────────────── waiting ─────────────────────────────── */

/**
 * The waiting room.
 *
 * Marking takes minutes, and a spinner alone says nothing about whether that
 * means twenty seconds or five more minutes — so when the server can tell us
 * where the run is, this shows it: a bar, a clock, and which of the two things
 * the marker is doing.
 *
 * The clock ticks locally rather than only on each poll. The server is asked
 * every three seconds, and a timer that jumped in three-second steps would look
 * stuck between them; `startedAt` is re-derived from the server's `elapsed_ms`
 * on every poll, and this counts forward from it in between, so the display is
 * both smooth and unable to drift.
 */
function Waiting({
  title,
  attempt,
  justSubmitted,
  progress,
  startedAt,
}: {
  title: string;
  attempt: number;
  justSubmitted: boolean;
  progress: GradingProgress | null;
  startedAt: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsedMs = startedAt === null ? 0 : Math.max(0, now - startedAt);
  const expectedMs = progress?.expected_ms ?? 0;
  const percent =
    expectedMs > 0 ? Math.min(95, Math.round((elapsedMs / expectedMs) * 100)) : 0;
  // Thinking is not streamed back, so characters stay at zero until the marker
  // stops reading and starts writing. That transition is the one genuinely
  // informative thing we can report mid-run.
  const writing = (progress?.answer_chars ?? 0) > 0;

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div
          className="flex size-16 items-center justify-center rounded-full"
          style={{ background: "var(--color-paper-2, rgba(0,0,0,0.04))" }}
        >
          <Loader2
            className="size-8 animate-spin"
            style={{ color: "var(--color-gold-deep)" }}
            aria-hidden
          />
        </div>
        <div className="space-y-1.5">
          <h1
            role="status"
            className="font-heebo font-extrabold tracking-tight"
            style={{ fontSize: "clamp(20px, 2vw, 26px)", color: "var(--color-navy-ink)" }}
          >
            התשובה שלך בבדיקה
          </h1>
          <p className="font-heebo" style={{ fontSize: 15, color: "var(--color-ink-dim)" }}>
            {progress
              ? writing
                ? "המערכת כותבת את חוות הדעת. אפשר להישאר בדף — הציון יופיע כאן מעצמו."
                : "המערכת קוראת את התשובה ובודקת אותה מול המחוון. אפשר להישאר בדף — הציון יופיע כאן מעצמו."
              : "הבדיקה יכולה לקחת כמה דקות. אפשר להישאר בדף — הציון יופיע כאן מעצמו."}
          </p>
          {title ? (
            <p className="font-heebo" style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
              {title}
              {attempt ? ` · ניסיון ${attempt}` : ""}
            </p>
          ) : null}
        </div>

        {progress ? (
          <div className="w-full max-w-sm space-y-1.5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="התקדמות הבדיקה"
              style={{ background: "var(--color-paper-2, rgba(0,0,0,0.08))" }}
            >
              <div
                className="h-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${percent}%`, background: "var(--color-gold-deep)" }}
              />
            </div>
            <p
              className="flex justify-between font-heebo tabular-nums"
              style={{ fontSize: 12, color: "var(--color-ink-muted)" }}
              dir="ltr"
            >
              <span>{clock(elapsedMs)}</span>
              <span>~{clock(expectedMs)}</span>
            </p>
          </div>
        ) : null}

        {justSubmitted ? (
          <p className="font-heebo" style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            אם תסגור את הדף, אפשר לחזור לכתובת הזו בכל רגע ולראות את התוצאה.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** 218450 -> "3:38". */
function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* ─────────────────────────────── marked ──────────────────────────────── */

function Marked({
  answer,
  score,
  title,
}: {
  answer: AnswerState;
  score: AnswerScore;
  title: string;
}) {
  const { content, language, organization } = score.dimensions;

  return (
    <div className="space-y-5">
      <ScoreHero score={score} title={title} answer={answer} />

      {score.summary ? (
        <Card>
          <CardContent className="px-5 py-5 md:px-7">
            <h2
              className="mb-1.5 font-heebo font-bold"
              style={{ fontSize: 16, color: "var(--color-navy-ink)" }}
            >
              בשורה התחתונה
            </h2>
            <p
              className="font-heebo"
              style={{ fontSize: 15, lineHeight: 1.85, color: "var(--color-ink)" }}
            >
              {score.summary}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <BandCard heading="ממד הלשון" dimension={language} />
        <BandCard heading="ממד הארגון" dimension={organization} />
      </div>

      <Card>
        <CardContent className="space-y-4 px-5 py-6 md:px-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className="font-heebo font-bold"
              style={{ fontSize: 18, color: "var(--color-navy-ink)" }}
            >
              ממד התוכן
            </h2>
            <PointsPill awarded={content.awarded} max={content.max} />
          </div>
          {content.criteria ? (
            <p className="font-heebo" style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
              {content.criteria}
            </p>
          ) : null}

          <ul className="space-y-3">
            {content.items.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} />
              </li>
            ))}
          </ul>

          {content.deductions_applied.length > 0 ? (
            <div
              className="rounded-lg border px-4 py-3"
              style={{
                borderColor: "var(--color-danger, #b42318)",
                background: "rgba(180, 35, 24, 0.05)",
              }}
            >
              <h3
                className="mb-1.5 font-heebo font-bold"
                style={{ fontSize: 14, color: "var(--color-danger, #b42318)" }}
              >
                הורדת נקודות
              </h3>
              <ul className="space-y-1.5">
                {content.deductions_applied.map((d) => (
                  <li
                    key={d.id}
                    className="font-heebo"
                    style={{ fontSize: 14, lineHeight: 1.75, color: "var(--color-ink)" }}
                  >
                    <span className="font-bold">−{d.points_off} נק׳ · </span>
                    {d.reason || d.fault}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 pb-4">
        <Link href={`/writing-task/${answer.open_question_id}`}>
          <Button type="button" className="h-11 md:h-10">
            כתוב את המטלה שוב
          </Button>
        </Link>
        <Link href="/writing-task">
          <Button type="button" variant="outline" className="h-11 md:h-10">
            למטלות נוספות
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ScoreHero({
  score,
  title,
  answer,
}: {
  score: AnswerScore;
  title: string;
  answer: AnswerState;
}) {
  const pct = score.max > 0 ? Math.round((score.total / score.max) * 100) : 0;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-6 px-5 py-6 md:px-7">
        <div className="space-y-1.5">
          <h1
            className="font-heebo font-extrabold tracking-tight"
            style={{
              fontSize: "clamp(22px, 2.2vw, 30px)",
              color: "var(--color-navy-ink)",
              lineHeight: 1.15,
            }}
          >
            {title || "חוות דעת על התשובה"}
          </h1>
          <p
            className="flex flex-wrap gap-x-3 font-heebo"
            style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
          >
            <span>ניסיון {answer.attempt_number}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(answer.graded_at || answer.created_at)}</span>
            <span aria-hidden>·</span>
            <span>{answer.word_count} מילים</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-left" dir="ltr">
            <div
              className="font-heebo font-extrabold"
              style={{ fontSize: 40, lineHeight: 1, color: "var(--color-navy-ink)" }}
            >
              {score.total}
              <span
                className="font-bold"
                style={{ fontSize: 20, color: "var(--color-ink-muted)" }}
              >
                /{score.max}
              </span>
            </div>
            <div
              className="mt-1 font-heebo font-semibold"
              style={{ fontSize: 12, color: "var(--color-ink-dim)" }}
            >
              {pct}%
            </div>
          </div>
        </div>
      </CardContent>
      <div
        className="h-1.5 w-full overflow-hidden rounded-b-xl"
        style={{ background: "var(--color-paper-2, rgba(0,0,0,0.06))" }}
      >
        <div
          className="h-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: "var(--color-gold-deep)" }}
        />
      </div>
    </Card>
  );
}

function BandCard({
  heading,
  dimension,
}: {
  heading: string;
  dimension: AnswerScore["dimensions"]["language"];
}) {
  return (
    <Card>
      <CardContent className="space-y-2 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            className="font-heebo font-bold"
            style={{ fontSize: 16, color: "var(--color-navy-ink)" }}
          >
            {heading}
          </h2>
          <PointsPill awarded={dimension.awarded} max={dimension.max} />
        </div>
        {dimension.band ? (
          <span
            className="inline-block rounded-full px-2.5 py-0.5 font-heebo font-semibold"
            style={{
              fontSize: 12,
              background: "var(--color-paper-2, rgba(0,0,0,0.05))",
              color: "var(--color-ink-dim)",
            }}
          >
            {dimension.band}
          </span>
        ) : null}
        {dimension.comment ? (
          <p
            className="font-heebo"
            style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-ink)" }}
          >
            {dimension.comment}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ItemRow({ item }: { item: ScoredItem }) {
  const tone =
    item.verdict === "full"
      ? { color: "var(--color-success, #067647)", Icon: CheckCircle2 }
      : item.verdict === "partial"
        ? { color: "var(--color-gold-deep)", Icon: MinusCircle }
        : { color: "var(--color-danger, #b42318)", Icon: CircleSlash };
  const { Icon } = tone;

  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--color-border, rgba(0,0,0,0.12))" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="size-4 shrink-0" style={{ color: tone.color }} aria-hidden />
        <h3
          className="font-heebo font-bold"
          style={{ fontSize: 15, color: "var(--color-navy-ink)" }}
        >
          {item.title}
        </h3>
        <span
          className="ms-auto font-heebo font-bold"
          style={{ fontSize: 13, color: tone.color }}
          dir="ltr"
        >
          {item.points_awarded}/{item.points_max}
        </span>
      </div>

      {item.comment ? (
        <p
          className="mt-1.5 font-heebo"
          style={{ fontSize: 14, lineHeight: 1.8, color: "var(--color-ink)" }}
        >
          {item.comment}
        </p>
      ) : null}

      {item.evidence ? (
        <blockquote
          className="mt-2 border-s-2 ps-3 font-heebo italic"
          style={{
            borderColor: "var(--color-gold-deep)",
            fontSize: 13,
            lineHeight: 1.75,
            color: "var(--color-ink-dim)",
          }}
        >
          „{item.evidence}”
        </blockquote>
      ) : null}

      {item.verdict !== "full" ? (
        <p
          className="mt-2 font-heebo"
          style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--color-ink-muted)" }}
        >
          <span className="font-semibold">מה נדרש: </span>
          {item.requirement}
        </p>
      ) : null}
    </div>
  );
}

function PointsPill({ awarded, max }: { awarded: number; max: number }) {
  const full = awarded >= max;
  const none = awarded <= 0;
  const color = full
    ? "var(--color-success, #067647)"
    : none
      ? "var(--color-danger, #b42318)"
      : "var(--color-gold-deep)";

  return (
    <span
      className="rounded-full px-3 py-1 font-heebo font-extrabold"
      style={{ fontSize: 13, color, background: "var(--color-paper-2, rgba(0,0,0,0.05))" }}
      dir="ltr"
    >
      {awarded}/{max}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "danger" | "muted";
  children: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <div
      role={danger ? "alert" : "status"}
      className="rounded-lg border px-4 py-3 font-heebo"
      style={{
        fontSize: 14,
        lineHeight: 1.8,
        borderColor: danger ? "var(--color-danger, #b42318)" : "var(--color-border, rgba(0,0,0,0.12))",
        color: danger ? "var(--color-danger, #b42318)" : "var(--color-ink)",
        background: danger ? "rgba(180, 35, 24, 0.06)" : "transparent",
      }}
    >
      {children}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
