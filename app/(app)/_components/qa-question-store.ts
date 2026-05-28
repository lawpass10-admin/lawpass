/**
 * Slice 10.2 — module-level client store for the QA widget's
 * current-question context.
 *
 * WHY NOT REACT CONTEXT? The QA widget is mounted in
 * app/(app)/layout.tsx, i.e. ABOVE every page in the React tree. A
 * <QaContextProvider> placed inside a play page sits BELOW the widget,
 * and React context only flows DOWNWARD — so the widget's
 * `useContext()` always read the default {null, null}. Submitted
 * reports from /exam/play/* and /practice/play/* therefore stored
 * `question_id = NULL` even when the user was clearly looking at a
 * question.
 *
 * THIS STORE: a tiny module-level singleton. The play pages mount a
 * `<QaQuestionSetter>` client component that calls
 * `setQaQuestionContext()` on mount (and `clearQaQuestionContext()` on
 * unmount). The widget calls `getQaQuestionContext()` at SUBMIT time
 * to read the active value. Because module evaluation is per-tab on
 * the client, the store is naturally scoped to one user session;
 * different tabs each get their own copy.
 *
 * SSR safety: only the mutation functions touch `current`, and both
 * are called from "use client" components inside `useEffect`, which
 * never runs on the server. Server renders of any module that imports
 * this file see the initial default value and never mutate.
 */

export type QaQuestionContextValue = {
  questionId: string | null;
  questionType: "source" | "angle" | null;
};

const EMPTY_VALUE: QaQuestionContextValue = {
  questionId: null,
  questionType: null,
};

let current: QaQuestionContextValue = EMPTY_VALUE;

/** Replace the current value. Called by `<QaQuestionSetter>` on mount
 *  and whenever its props change. */
export function setQaQuestionContext(value: QaQuestionContextValue): void {
  current = value;
}

/** Reset the store to {null, null}. Called by `<QaQuestionSetter>` on
 *  unmount so a stale id can't leak into a later report submitted from
 *  a non-question page. */
export function clearQaQuestionContext(): void {
  current = EMPTY_VALUE;
}

/** Read the current value. Called by the widget at submit time. */
export function getQaQuestionContext(): QaQuestionContextValue {
  return current;
}
