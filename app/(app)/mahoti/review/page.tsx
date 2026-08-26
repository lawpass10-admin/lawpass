import { ChevronLeft, LayoutDashboard } from "lucide-react";
import Link from "next/link";

import { Learning360Panel } from "@/app/(app)/practice/play/_components/learning-360-panel";
import { Button } from "@/components/ui/button";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getMahotiAttempt,
  getMahotiReview,
  getNextMahotiSetId,
  type MahotiReviewItem,
} from "@/lib/db/mahoti";
import { cn } from "@/lib/utils";

type Letter = "א" | "ב" | "ג" | "ד";

const LETTERS: Letter[] = ["א", "ב", "ג", "ד"];

/**
 * /mahoti/review — the full review for the generated paper, opened in its own
 * tab from "שלח את המבחן לבדיקה" once every question has been answered.
 *
 * The review body is the app's existing `<Learning360Panel>`, fed from the
 * `question_review` column: same nine sections, same look as practice play and
 * exam results, so nothing here is a second dialect of the same content.
 *
 * WHERE THE ANSWERS COME FROM. `?attempt=<answer_id>` is the current form: the
 * sitting was filed and marked server-side (mahoti_answers), and this screen
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
export default async function MahotiReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ answers?: string; set?: string; attempt?: string }>;
}) {
  await requireActiveSubscription();

  const { answers, set, attempt: attemptId } = await searchParams;

  // RLS scopes this to the caller's own sittings, so someone else's id reads
  // as null and lands on the unmarked review — see getMahotiAttempt.
  const attempt = attemptId ? await getMahotiAttempt(attemptId) : null;

  // The paper is the one the sitting was filed against; `?set=` only decides
  // it when there is no attempt to ask.
  const review = await getMahotiReview(attempt?.questionId ?? set);

  // Which paper "למבחן הבא" leads to. Resolved from the row actually being
  // reviewed, so it does not depend on the `set` parameter being present.
  const nextSetId = review ? await getNextMahotiSetId(review.questionId) : null;

  if (!review) {
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          אין עדיין תוכן בדיקה לשאלות האלה.
        </p>
      </div>
    );
  }

  // A filed sitting is matched to the review by question NUMBER, which is what
  // makes it immune to the positional drift the `?answers=` path can suffer.
  // The fallback still fills the array by position, from the URL.
  const byNumber = new Map(
    (attempt?.given ?? []).map((entry) => [entry.number, entry.letter])
  );
  const positional = parseAnswers(answers, review.items.length);
  const given: (Letter | null)[] = attempt
    ? review.items.map((item) => byNumber.get(item.number) ?? null)
    : positional;

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
  const total = attempt?.total ?? review.items.length;
  const percent =
    attempt?.score ??
    (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-2">
      <header className="space-y-2">
        <nav
          aria-label="breadcrumbs"
          className="flex items-center gap-2 font-heebo"
          style={{ fontSize: 13, color: "var(--color-ink-muted)" }}
        >
          <Link
            href={`/mahoti?set=${encodeURIComponent(review.questionId)}`}
            className="hover:underline"
          >
            דיון מהותי
          </Link>
          <span aria-hidden>›</span>
          <span>בדיקה</span>
        </nav>
        <h1 className="text-3xl font-bold">בדיקת השאלות</h1>
        {/* A filed sitting always gets its score line, even one submitted
            entirely blank — 0 מתוך 40 is a result, and hiding it would make a
            recorded attempt look like a page nobody sat. */}
        {attempt || scored > 0 ? (
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

      {review.items.map((item, i) => (
        <QuestionReview
          key={item.number}
          item={item}
          givenLetter={given[i]}
        />
      ))}

      <ReviewFooter nextSetId={nextSetId} />
    </div>
  );
}

/**
 * Where the review ends: on to the next paper, or out to the main menu.
 *
 * "למבחן הבא" is the next row of `mahoti_questions` (see `getNextMahotiSetId`),
 * loaded as a fresh paper at /mahoti?set=… — a new set of questions with its
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
        render={<Link href="/dashboard" />}
      >
        <LayoutDashboard className="size-4" aria-hidden />
        <span className="ms-1.5">חזרה לתפריט ראשי</span>
      </Button>

      {nextSetId ? (
        <Button
          size="lg"
          render={
            <Link href={`/mahoti?set=${encodeURIComponent(nextSetId)}`} />
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
  item: MahotiReviewItem;
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

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
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
