"use client";

import { Calendar, CheckCircle2, ListChecks, Play, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { abandonActiveSession } from "@/lib/api/practice";
import { practicePlayUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

/**
 * Slice 5 Phase P2 — Practice resume card.
 *
 * Pixel-mirror of `PracticeResume.html`. Two-section card centered on
 * the page (max-width 760px):
 *  1. Navy gradient top — status pill (pulsing gold dot) / session
 *     name / meta row (time + total + accuracy) / progress bar.
 *  2. White bottom — "next question" gold-tinted banner + two CTAs
 *     (outline "התחל מחדש" + gold-gradient "המשך מהשאלה ה-N").
 *
 * State is intentionally trivial: just the pending flag for the
 * abandon action. The session row is server-rendered by the page so
 * the user sees the right numbers immediately without a client fetch.
 */

type Props = {
  sessionId: string;
  /** Slice 57 A — ALL selected chapters' titles in builder click-order.
   *  Empty array for legacy single-question review sessions (they
   *  insert `selected_chapters: []`); the card falls back to a generic
   *  label in that case. */
  chapterTitles: string[];
  /** ISO timestamp of session start. Used for the "התחל לפני N דקות" line. */
  startedAtISO: string;
  totalQuestions: number;
  questionsAnswered: number;
  questionsCorrect: number;
  /** Slice 57 A — the chapter the user will actually land on when they
   *  click resume. Resolved server-side from the next item in
   *  `question_list`. `null` only in pathological cases (archived /
   *  out-of-range / empty selected_chapters) — the card then falls
   *  back to the first chapter title. */
  nextChapterTitle: string | null;
};

function formatRelativeHebrew(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return "התחיל הרגע";
  const min = Math.floor(sec / 60);
  if (min < 60) return `התחיל לפני ${min} ${min === 1 ? "דקה" : "דקות"}`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `התחיל לפני ${hr} ${hr === 1 ? "שעה" : "שעות"}`;
  const day = Math.floor(hr / 24);
  return `התחיל לפני ${day} ${day === 1 ? "יום" : "ימים"}`;
}

export function ResumeCard({
  sessionId,
  chapterTitles,
  startedAtISO,
  totalQuestions,
  questionsAnswered,
  questionsCorrect,
  nextChapterTitle,
}: Props) {
  // Slice 57 A — title composition. Builder click-order is preserved
  // server-side; we just join with the existing midpoint-dot separator.
  // Legacy single-question sessions (chapterTitles=[]) keep the prior
  // generic "התרגול הפעיל שלך" label.
  const titleText =
    chapterTitles.length > 0
      ? `${chapterTitles.join(" · ")} · ${totalQuestions} שאלות`
      : `התרגול הפעיל שלך · ${totalQuestions} שאלות`;
  // Slice 57 A — next-q banner: real chapter from getQuestionForPosition,
  // falling back to the first selected chapter or the generic label
  // (covers archived/out-of-range and the legacy [] case).
  const nextLabel =
    nextChapterTitle ?? chapterTitles[0] ?? "התרגול הפעיל שלך";
  const [abandoning, setAbandoning] = useState(false);
  const nextPosition = questionsAnswered; // 0-indexed in routes
  const displayNext = questionsAnswered + 1; // 1-indexed for copy
  // Route shape is `/practice/play/{idx}?session={uuid}`. The session
  // param is what the play page uses to load the session row — must be
  // included or the play page can't disambiguate.
  const resumeHref = practicePlayUrl(sessionId, nextPosition);
  const progressPct =
    totalQuestions > 0
      ? Math.min(100, Math.round((questionsAnswered / totalQuestions) * 100))
      : 0;
  const accuracyPct =
    questionsAnswered > 0
      ? Math.round((questionsCorrect / questionsAnswered) * 100)
      : null;
  const relativeStart = formatRelativeHebrew(startedAtISO);

  async function handleAbandon() {
    if (abandoning) return;
    setAbandoning(true);
    const result = await abandonActiveSession();
    if (!result.ok) {
      toast.error(result.error);
      setAbandoning(false);
      return;
    }
    // The Server Action revalidates /practice; once redirect-back lands,
    // the route's resumable check now sees no active session and renders
    // the builder. Use full nav so the route gate re-evaluates.
    window.location.assign("/practice");
  }

  return (
    <div className="w-full max-w-[760px] mx-auto py-12 md:py-16">
      {/* Eyebrow + H1 + sub */}
      <div
        className="inline-flex items-center gap-2.5 font-heebo font-medium mb-3.5"
        style={{ fontSize: 13, color: "var(--color-gold-deep)" }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 24,
            height: 1.5,
            background: "var(--color-gold)",
          }}
        />
        סשן תרגול פעיל
      </div>
      <h1
        className="font-heebo font-extrabold tracking-tight text-[32px] md:text-[44px]"
        style={{ color: "var(--color-navy-ink)", lineHeight: 1.1 }}
      >
        יש לך סשן שעוד לא סיימת.
      </h1>
      <p
        className="font-heebo mt-2.5 mb-7 max-w-[560px]"
        style={{
          fontSize: 16,
          color: "var(--color-ink-dim)",
          fontWeight: 400,
        }}
      >
        {relativeStart} וכבר ענית על{" "}
        {questionsAnswered === 1
          ? "שאלה אחת"
          : `${questionsAnswered.toLocaleString("he-IL")} שאלות`}
        . תוכל להמשיך מהמקום שעצרת או להתחיל סשן חדש.
      </p>

      {/* Card */}
      <div
        className="rounded-[22px] border bg-card overflow-hidden"
        style={{
          borderColor: "var(--color-line)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Top: navy gradient session info */}
        <div
          className="relative overflow-hidden px-6 md:px-9 py-7 md:py-[30px] text-white"
          style={{
            background: "linear-gradient(135deg, #15296B 0%, #1E3A8A 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -end-24 size-[320px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(201, 161, 73, 0.20), transparent 70%)",
            }}
          />

          <div
            className="relative inline-flex items-center gap-2 font-heebo font-semibold mb-3.5"
            style={{
              background: "rgba(201, 161, 73, 0.18)",
              border: "1px solid rgba(201, 161, 73, 0.35)",
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 12,
              color: "var(--color-gold)",
            }}
          >
            <span
              aria-hidden
              className="animate-pulse"
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--color-gold)",
                boxShadow: "0 0 8px rgba(201, 161, 73, 0.7)",
              }}
            />
            פעיל · ממתין
          </div>

          <h2
            className="relative font-heebo font-bold text-white mb-2"
            style={{ fontSize: 24, lineHeight: 1.2 }}
            dir="auto"
          >
            {titleText}
          </h2>

          <div
            className="relative flex flex-wrap gap-4 md:gap-[18px] mb-5"
            style={{
              color: "rgba(255, 255, 255, 0.75)",
              fontSize: 13.5,
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Calendar
                className="size-3.5"
                style={{ color: "rgba(255, 255, 255, 0.55)" }}
                aria-hidden
              />
              {relativeStart}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks
                className="size-3.5"
                style={{ color: "rgba(255, 255, 255, 0.55)" }}
                aria-hidden
              />
              סה״כ {totalQuestions} שאלות
            </span>
            {accuracyPct !== null && (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2
                  className="size-3.5"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                  aria-hidden
                />
                {accuracyPct}% עד כה
              </span>
            )}
          </div>

          <div className="relative">
            <div className="flex justify-between items-baseline mb-2">
              <span
                className="font-heebo font-medium"
                style={{ fontSize: 12.5, color: "rgba(255, 255, 255, 0.65)" }}
              >
                התקדמות בסשן
              </span>
              <span
                className="font-heebo font-bold tabular-nums"
                style={{ fontSize: 14.5, color: "var(--color-white, #FFFFFF)" }}
              >
                <span style={{ color: "var(--color-gold)" }}>
                  {questionsAnswered}
                </span>{" "}
                / {totalQuestions} שאלות
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded"
              style={{ background: "rgba(255, 255, 255, 0.10)" }}
            >
              <div
                className="h-full rounded"
                style={{
                  width: `${progressPct}%`,
                  background:
                    "linear-gradient(270deg, var(--color-gold), #E8C97A)",
                  boxShadow: "0 0 12px rgba(201, 161, 73, 0.5)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom: next-q banner + CTAs */}
        <div className="bg-card flex flex-col gap-[18px] px-6 md:px-9 py-[26px]">
          <div
            className="flex items-center gap-3.5 rounded-[14px] font-heebo"
            style={{
              background: "var(--color-gold-tint)",
              border: "1px dashed rgba(201, 161, 73, 0.45)",
              padding: "14px 16px",
            }}
          >
            <div
              className="shrink-0 inline-flex items-center justify-center font-heebo font-extrabold"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "var(--color-gold)",
                color: "var(--color-navy-ink)",
                fontSize: 15,
              }}
              aria-hidden
            >
              {displayNext}
            </div>
            <div
              className="flex-1"
              style={{ color: "var(--color-navy-ink)", fontSize: 14 }}
            >
              <b style={{ fontWeight: 700 }}>השאלה הבאה:</b>{" "}
              {nextLabel}
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3 md:gap-3">
            <button
              type="button"
              onClick={handleAbandon}
              disabled={abandoning}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full font-heebo font-bold transition-all w-full md:w-auto",
                "px-6 py-3.5 text-[15px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
              style={{
                background: "transparent",
                color: "var(--color-navy)",
                border: "1.5px solid var(--color-line-strong)",
              }}
            >
              <X className="size-4" strokeWidth={1.7} aria-hidden />
              {abandoning ? "מבטל..." : "התחל מחדש"}
            </button>
            <Link
              href={resumeHref}
              aria-disabled={abandoning}
              className={cn(
                "btn-gold inline-flex items-center justify-center gap-2 rounded-full font-heebo font-bold w-full md:w-auto",
                "px-6 py-3.5 text-[15px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              )}
            >
              <Play className="size-4 fill-current" aria-hidden />
              המשך מהשאלה ה-{displayNext}
            </Link>
          </div>
        </div>
      </div>

      {/* Hint */}
      <p
        className="text-center font-heebo mt-4"
        style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
      >
        לחיצה על &quot;התחל מחדש&quot; תאפס את הסשן הזה לחלוטין.{" "}
        <span
          style={{
            color: "var(--color-gold-deep)",
            fontWeight: 600,
            borderBottom: "1px solid var(--color-gold-deep)",
          }}
        >
          מה זה אומר?
        </span>
      </p>
    </div>
  );
}
