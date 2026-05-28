"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Slice 10 — QA Feedback System per-question context.
 *
 * The floating widget needs to know which question the user is looking
 * at when they file a content/design report. The play pages already
 * resolve that information server-side (exam: session.question_list[
 * position]; practice: view.question.id + view.kind), so wiring it via
 * a React context keeps the widget consumption pattern uniform without
 * forcing every play tree to thread the same props down.
 *
 * Default value is { null, null } — used by every (app) page that
 * isn't a play page. The widget then submits the report with no
 * question identity attached.
 *
 * The provider must mount ABOVE the question component (and any other
 * interactive tree on the page) so opening the widget popup doesn't
 * cause a remount of the play subtree. Provider lives in the page
 * Server Component; consumers live anywhere in the (app) layout
 * subtree.
 */

export type QaQuestionContextValue = {
  questionId: string | null;
  questionType: "source" | "angle" | null;
};

const DEFAULT_VALUE: QaQuestionContextValue = {
  questionId: null,
  questionType: null,
};

const QaContext = createContext<QaQuestionContextValue>(DEFAULT_VALUE);

/**
 * Provider — wrap a play page's interactive subtree with this so the
 * widget can read the current question identity. Pass `null` values
 * for non-play pages (or simply skip the provider — the default
 * context value is already nulls).
 */
export function QaContextProvider({
  value,
  children,
}: {
  value: QaQuestionContextValue;
  children: ReactNode;
}) {
  return <QaContext.Provider value={value}>{children}</QaContext.Provider>;
}

/** Consumer hook. Returns the active question identity or nulls. */
export function useQaContext(): QaQuestionContextValue {
  return useContext(QaContext);
}
