"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * "בדוק שאלות" — the review of the questions answered SO FAR, mid-sitting.
 *
 * Submitting is all-or-nothing: the paper is filed only once every question has
 * an answer, so before that there was no way to check anything. This opens the
 * ordinary review screen — the same page, the same per-question breakdown, the
 * same 360° panel — restricted to the questions actually answered, whether that
 * is one of forty or all of them.
 *
 * IN A NEW TAB, on purpose. The sitting is a clocked exam holding answers in
 * component state: navigating away and back would lose them and stop the run.
 * The exam stays exactly as it was, and the review is a second tab to close.
 *
 * The clock keeps running while the review is open. That is the candidate's
 * call to make — this is a rehearsal aid, not invigilation — and stopping it
 * here would make "check my work" a way to pause the exam.
 *
 * Answers travel as `number:letter` pairs rather than by position: the list is
 * partial by definition, so a positional encoding would have nothing to say
 * about the gaps.
 */
export function CheckAnsweredButton({
  reviewRoute,
  setId,
  given,
}: {
  reviewRoute: "/mahoti/review" | "/diuni/review";
  setId: string;
  /** Every question of the paper, with the letter chosen or null. */
  given: { number: number; letter: string | null }[];
}) {
  const answered = given.filter((entry) => entry.letter !== null);
  const param = answered.map((entry) => `${entry.number}:${entry.letter}`).join(",");
  const href = `${reviewRoute}?set=${encodeURIComponent(setId)}&given=${encodeURIComponent(param)}`;

  // Nothing answered yet: the button is there, and inert, rather than appearing
  // once a first answer is given — a control that materialises mid-exam reads
  // as a glitch.
  if (answered.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <ClipboardCheck className="size-3.5" aria-hidden />
        <span className="ms-1.5 text-xs">בדוק שאלות</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      render={<Link href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <ClipboardCheck className="size-3.5" aria-hidden />
      <span className="ms-1.5 text-xs">בדוק שאלות ({answered.length})</span>
    </Button>
  );
}
