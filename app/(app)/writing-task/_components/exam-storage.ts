/**
 * Where an in-progress writing-task sitting is kept across a refresh.
 *
 * localStorage, per question, and deliberately not the server: this is a
 * rehearsal aid, not invigilation. A student who wants more than fifty minutes
 * can clear the key, and that is fine — the clock is here to train the pace, not
 * to be enforced. Making it enforceable means the deadline living on a row the
 * client cannot write, which is a different feature and a bigger one.
 *
 * Its own module because two screens touch it: the workspace, which saves and
 * restores the sitting, and the results page, whose "כתוב את המטלה שוב" must
 * start the next attempt on an empty sheet rather than restore the one already
 * filed.
 *
 * Every function here swallows storage errors. Storage can be unavailable
 * (private mode, a blocked origin, quota, a corrupt value), and none of that
 * should stop a page rendering or interrupt the student — the sitting simply
 * does not survive a refresh.
 */

import type { HandwritingPage } from "@/lib/api/open-questions";

/**
 * How long a finished sitting stays on screen before it is forgotten.
 *
 * A sitting that ended minutes ago should come back on refresh — the student
 * still wants to read and send what they wrote. One that ended yesterday should
 * not: reopening a spent exam every time the page loads is a haunting, not a
 * feature.
 */
const EXAM_KEEP_AFTER_END_MS = 2 * 60 * 60 * 1000;

const examStorageKey = (questionId: string) => `lawpass:writing-task-exam:${questionId}`;

export type StoredExam = { deadline: number; text: string; pages: HandwritingPage[] };

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

export function readStoredExam(questionId: string): StoredExam | null {
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
    return null;
  }
}

export function writeStoredExam(questionId: string, value: StoredExam): void {
  try {
    window.localStorage.setItem(examStorageKey(questionId), JSON.stringify(value));
  } catch {
    // See the module note.
  }
}

export function clearStoredExam(questionId: string): void {
  try {
    window.localStorage.removeItem(examStorageKey(questionId));
  } catch {
    // See the module note.
  }
}
