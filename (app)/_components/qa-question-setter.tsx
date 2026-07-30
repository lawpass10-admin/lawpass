"use client";

import { useEffect } from "react";

import {
  clearQaQuestionContext,
  setQaQuestionContext,
} from "./qa-question-store";

type Props = {
  /** Resolved on the play page Server Component:
   *    exam     → session.question_list[position].question_id
   *    practice → view.question.id  */
  questionId: string;
  /** Resolved on the play page Server Component:
   *    exam     → session.question_list[position].question_type
   *    practice → view.kind  */
  questionType: "source" | "angle";
};

/**
 * Slice 10.2 — writes the active question identity into the
 * module-level qa-question-store on mount + whenever the
 * (questionId, questionType) pair changes. Clears the store on
 * unmount so the QA widget never picks up a stale id when the user
 * has navigated to a non-question page.
 *
 * Renders nothing — it's just an effect host. Mount it ABOVE or
 * BESIDE the actual question component on each play page (sibling
 * placement is fine; the store is global to the tab, not tree-scoped).
 */
export function QaQuestionSetter({ questionId, questionType }: Props) {
  useEffect(() => {
    setQaQuestionContext({ questionId, questionType });
    return () => {
      clearQaQuestionContext();
    };
  }, [questionId, questionType]);
  return null;
}
