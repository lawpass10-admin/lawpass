import { ChevronLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { ExamPageNav } from "@/app/(app)/_components/exam-page-nav";
import { Learning360Panel } from "@/app/(app)/practice/play/_components/learning-360-panel";
import { ScoreSummary } from "@/components/app/score-summary";
import { Button } from "@/components/ui/button";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getDiuniAttempt,
  getDiuniReview,
  getNextDiuniSetId,
  type DiuniReviewItem,
} from "@/lib/db/diuni";
import { breakdownByTopic } from "@/lib/scoring/topic-breakdown";
import { cn } from "@/lib/utils";

type Letter = "א" | "ב" | "ג" | "ד";

const LETTERS: Letter[] = ["א", "ב", "ג", "ד"];

/**
 * /diuni/review — the full review for the generated paper, opened in its own
 * tab from "שלח את המבחן לבדיקה" once every question has been answered.
 *
 * The review body is the app's existing `<Learning360Panel>`, fed from the
 * `question_review` column: same nine sections, same look as practice play and
 * exam results, so nothing here is a second dialect of the same content.
 *
 * WHERE THE ANSWERS COME FROM. `?attempt=<answer_id>` is the current form: the
 * sitting was filed and marked server-side (diuni_answers), and this screen
 * reads that row — the same letters, the same right/wrong, and the same score
 * that is in the table. One marking run, one number, everywhere.
 *
 * `?answers=א-ב-ג…&set=…` is the older form and still works, for links made
 * before sittings were stored. It is marked here instead, by POSITION, which
 * is only equivalent while every question of the paper reaches `review.items`
 * — a question dropped for having no correct option would shift every answer
 * after it. That is the reason the attempt form exists and is preferred; this
 * one is kept because breaking a bookmarked tab is worse than the risk.
 *
 * Either way a missing or unreadable parameter degrades to the plain review,
 * which is still the useful half.
 */
export default async function DiuniReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    answers?: string;
    set?: string;
    attempt?: string;
    given?: string;
  }>;
}) {
  // See the note in /mahoti: the viewer id authorises the `?set=` id. It
  // matters more here — a review carries the correct answers.
  const { user } = await requireActiveSubscription();

  const { answers, set, attempt: attemptId, given: givenParam } = await searchParams;

  // RLS scopes this to the caller's own sittings, so someone else's id reads
  // as null and lands on the unmarked review — see getDiuniAttempt.
  const attempt = attemptId ? await getDiuniAttempt(attemptId) : null;

  // The paper is the one the sitting was filed against; `?set=` only decides
  // it when there is no attempt to ask.
  const review = await getDiuniReview(attempt?.questionId ?? set, user.id);

  // Which paper "למבחן הבא" leads to. Resolved from the row actually being
  // reviewed, so it does not depend on the `set` parameter being present.
  const nextSetId = review ? await getNextDiuniSetId(review.questionId) : null;

  if (!review) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 py-10 md:px-0">
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          אין עדיין תוכן בדיקה לשאלות האלה.
        </p>
      </div>
    );
  }

  // `?given=` — a mid-sitting check, from "בדוק שאלות" on the exam itself. It
  // carries only the questions answered so far, as number:letter pairs, and the
  // review then shows ONLY those: a candidate checking their work at question 12
  // must not be shown the other 28 with their answers. Keyed by number like the
  // attempt path, not by position, because it is a partial list.
  const midSitting = parseGiven(givenParam);

  // A filed sitting is matched to the review by question NUMBER, which is what
  // makes it immune to the positional drift the `?answers=` path can suffer.
  // The fallback still fills the array by position, from the URL.
  const byNumber = new Map(
    (attempt?.given ?? []).map((entry) => [entry.number, entry.letter])
  );
  const positional = parseAnswers(answers, review.items.length);
  const given: (Letter | null)[] = attempt
    ? review.items.map((item) => byNumber.get(item.number) ?? null)
    : midSitting
      ? review.items.map((item) => midSitting.get(item.number) ?? null)
      : positional;

  // Only the answered ones on the mid-sitting path; the whole paper otherwise.
  const shown = review.items
    .map((item, i) => ({ item, given: given[i] }))
    .filter((row) => !midSitting || row.given !== null);

  const scored = given.filter((letter) => letter !== null).length;
  // The stored score is READ, never recomputed: it is what the table holds and
  // what any report will quote, so a second calculation here could only
  // disagree with it. Only the fallback path counts, having nothing to read.
  const correct =
    attempt?.correct ??
    review.items.reduce(
      (total, item, i) =>
        given[i] === item.correctChoice.letter ? total + 1 : total,
      0
    );
  // On a mid-sitting check the denominator is what was ANSWERED, not the whole
  // paper: "3 מתוך 5" for five answered questions, never "3 מתוך 40", which
  // would read as a score on an exam the candidate has not finished.
  const total = midSitting ? shown.length : (attempt?.total ?? review.items.length);
  const percent =
    attempt?.score ??
    (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0);

  // The per-subject rollup for a mid-sitting check, grouped by the same
  // function that groups a filed sitting (`breakdownByTopic`) over the same
  // subjects the server stamps onto a marked answer — so checking at question
  // 12 and filing at question 40 cannot read as two different measures.
  //
  // Over the questions SHOWN, which on this path are the ones answered so far:
  // a subject the candidate has not reached yet has no row rather than a 0%
  // one, which would look like a subject they are failing.
  const midSittingByTopic =
    midSitting && shown.length > 0
      ? breakdownByTopic(
          shown.map((row) => ({
            topic: row.item.topic,
            is_correct: row.given === row.item.correctChoice.letter,
          }))
        )
      : [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-2 md:px-0">
      <header className="space-y-2">
        {/* The way out, at the TOP as well as in the footer: the footer's
            "חזרה לתפריט ראשי" sits below the whole review, which on a 40-question
            paper is a long way to scroll to leave. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="breadcrumbs"
            className="flex items-center gap-2 font-heebo"
            style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
          >
            <Link
              href={`/diuni?set=${encodeURIComponent(review.questionId)}`}
              className="hover:underline"
            >
              דין דיוני
            </Link>
            <span aria-hidden>›</span>
            <span>בדיקה</span>
          </nav>

          <ExamPageNav
            backHref={`/diuni?set=${encodeURIComponent(review.questionId)}`}
            backLabel="חזרה למבחן"
          />
        </div>
        <h1 className="text-3xl font-bold">
          {midSitting ? "בדיקת השאלות שענית" : "בדיקת השאלות"}
        </h1>
        {/* Mid-sitting the numbers are the panel's below, not a line here —
            printing them twice would put the same score in two places, one of
            them small and grey. Only the "nothing answered yet" case has no
            panel to show, so it keeps its sentence.
            A filed sitting always gets its score line, even one submitted
            entirely blank — 0 מתוך 40 is a result, and hiding it would make a
            recorded attempt look like a page nobody sat. */}
        {midSitting ? (
          shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              עדיין לא ענית על שאלות במבחן הזה.
            </p>
          ) : null
        ) : attempt || scored > 0 ? (
          <p className="text-sm text-muted-foreground">
            {attempt ? `ניסיון ${attempt.attempts} · ` : ""}
            {correct} מתוך {total} תשובות נכונות ({percent}%)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {review.items.length} שאלות — פירוט מלא לכל שאלה
          </p>
        )}
      </header>

      {/* The statistics of the run so far, in the same panel a filed sitting
          gets on /diuni/results: a candidate who checks their work at question
          12 is owed the same reading of it — the score, the split, and which
          subject is costing the marks — as one who finished the paper. The
          score is out of what was ANSWERED, and "טרם נענו" says how much of the
          paper is still to come, so nothing here reads as a result on a
          finished exam. */}
      {midSitting && shown.length > 0 ? (
        <ScoreSummary
          correct={correct}
          total={total}
          answered={total}
          pending={review.items.length - shown.length}
          caption={`נענו ${shown.length} מתוך ${review.items.length} שאלות · המבחן עצמו עדיין לא הוגש`}
          byTopic={midSittingByTopic}
        />
      ) : null}

      {shown.map((row) => (
        <QuestionReview
          key={row.item.number}
          item={row.item}
          givenLetter={row.given}
        />
      ))}

      <ReviewFooter nextSetId={nextSetId} />
    </div>
  );
}

/**
 * Where the review ends: on to the next paper, or out to the main menu.
 *
 * "למבחן הבא" is the next row of `diuni_questions` (see `getNextDiuniSetId`),
 * loaded as a fresh paper at /diuni?set=… — a new set of questions with its
 * own notebook, not the next question of this one. It is left out entirely
 * when the table holds only the paper just reviewed, since a button that
 * reloads the same exam would be a lie.
 *
 * "חזרה לתפריט ראשי" used to be a plain <a> — a forced full page load — because
 * the (app) layout picked focus mode from the `x-pathname` header, which a
 * client-side <Link> transition leaves stale, so the dashboard arrived with no
 * navy sidebar. That decision now lives in <AppShell> and is made from
 * `usePathname()`, which tracks soft navigations, so this is a plain <Link>
 * again and leaving the review costs no reload.
 */
function ReviewFooter({ nextSetId }: { nextSetId: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
      <Button
        variant="outline"
        size="lg"
        nativeButton={false}
        render={<Link href="/dashboard" />}
      >
        <LayoutDashboard className="size-4" aria-hidden />
        <span className="ms-1.5">חזרה לתפריט ראשי</span>
      </Button>

      {nextSetId ? (
        <Button
          size="lg"
          nativeButton={false}
          render={
            <Link href={`/diuni?set=${encodeURIComponent(nextSetId)}`} />
          }
        >
          <span>למבחן הבא</span>
          <ChevronLeft className="ms-1.5 size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

/** "א-ב-ג" -> ["א","ב","ג", …nulls]. Anything unrecognised becomes null,
 *  so a hand-edited URL cannot throw the page. */
/**
 * "12:א,13:ג,27:ד" -> Map(12 -> "א", …), or null when the parameter is absent.
 *
 * Null and an EMPTY map mean different things and both occur: absent is "review
 * the whole paper", empty is "a mid-sitting check with nothing answered yet",
 * which shows no questions rather than all of them. A malformed pair is dropped
 * rather than failing the page — the parameter comes from a URL.
 */
function parseGiven(raw: string | undefined): Map<number, Letter> | null {
  if (raw === undefined) return null;
  const map = new Map<number, Letter>();
  for (const pair of raw.split(",")) {
    const [rawNumber, rawLetter] = pair.split(":");
    const number = Number(rawNumber);
    const letter = rawLetter?.trim() as Letter | undefined;
    if (!Number.isInteger(number) || !letter || !LETTERS.includes(letter)) continue;
    map.set(number, letter);
  }
  return map;
}

function parseAnswers(raw: string | undefined, count: number): (Letter | null)[] {
  const parts = (raw ?? "").split("-");
  return Array.from({ length: count }, (_, i) => {
    const value = parts[i]?.trim() as Letter | undefined;
    return value && LETTERS.includes(value) ? value : null;
  });
}

function QuestionReview({
  item,
  givenLetter,
}: {
  item: DiuniReviewItem;
  givenLetter: Letter | null;
}) {
  const isCorrect = givenLetter === item.correctChoice.letter;
  const text = [item.fact_pattern, item.stem]
    .filter((part) => part && part.trim())
    .join("\n\n");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          שאלה {item.number}
        </h2>
        {givenLetter ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              isCorrect
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {isCorrect
              ? `תשובתך ${givenLetter} — נכון`
              : `תשובתך ${givenLetter} — שגוי`}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            לא נענתה
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm md:p-6">
        <p dir="auto" className="whitespace-pre-wrap text-[17px] leading-relaxed">
          {text}
        </p>
      </div>

      <Learning360Panel
        question={item.question}
        correctChoice={item.correctChoice}
      />
    </section>
  );
}
