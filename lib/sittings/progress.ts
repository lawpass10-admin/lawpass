"use client";

/**
 * Crash-recovery for an in-progress מהותי / דיוני sitting.
 *
 * These papers are filed in ONE call at the end (see lib/api/mahoti.ts), so
 * until the candidate submits there is nothing on the server: a reload, a
 * crash or a stray Back used to discard a 160-minute sitting outright. This
 * keeps a copy in localStorage so the paper can be picked back up.
 *
 * It is deliberately NOT a server feature. The sitting is worthless to anyone
 * but the candidate in front of it, it must survive a dead network, and a
 * per-keystroke write to Postgres for forty letters would be absurd. The cost
 * is that recovery is per-browser, which is the right trade for a study tool.
 *
 * The clock is stored as an ABSOLUTE deadline rather than a remaining count.
 * Storing "97 minutes left" would hand the candidate free time on every
 * reload — exactly the defect the /exam simulation has. An absolute deadline
 * keeps elapsing while the page is gone, which is what a timed paper means.
 *
 * Every accessor is wrapped: localStorage throws outright in some privacy
 * modes, and a study aid must never take the page down with it.
 */

/** Which sitting a key belongs to. The two papers never share storage. */
export type SittingKind = "mahoti" | "diuni";

/** Bumped if the stored shape changes; older payloads are then dropped. */
const VERSION = 1;

type Versioned = { v: number };

export type StoredAnswers = Versioned & {
  /** Question POSITION (not number) -> chosen letter, matching workspace state. */
  answers: Record<number, string>;
};

export type StoredClock = Versioned & {
  started: boolean;
  /** Epoch ms. Set while the clock runs; null while paused or stopped. */
  deadlineAt: number | null;
  /** Authoritative only while `deadlineAt` is null. */
  remaining: number;
};

function answersKey(kind: SittingKind, setId: string): string {
  return `lawpass.${kind}.${setId}.answers`;
}

function clockKey(kind: SittingKind, setId: string): string {
  return `lawpass.${kind}.${setId}.clock`;
}

function read<T extends Versioned>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    // A payload from an older build is discarded rather than guessed at — a
    // half-understood sitting is worse than a fresh one.
    if (!parsed || parsed.v !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or a blocked store. The sitting carries on in memory; only the
    // recovery copy is lost, and there is nothing useful to tell the user.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // See write().
  }
}

export function loadAnswers(
  kind: SittingKind,
  setId: string
): Record<number, string> | null {
  const stored = read<StoredAnswers>(answersKey(kind, setId));
  if (!stored || typeof stored.answers !== "object" || stored.answers === null) {
    return null;
  }
  return stored.answers;
}

export function saveAnswers(
  kind: SittingKind,
  setId: string,
  answers: Record<number, string>
): void {
  write(answersKey(kind, setId), { v: VERSION, answers } satisfies StoredAnswers);
}

export function loadClock(kind: SittingKind, setId: string): StoredClock | null {
  const stored = read<StoredClock>(clockKey(kind, setId));
  if (!stored || typeof stored.remaining !== "number") return null;
  return stored;
}

export function saveClock(
  kind: SittingKind,
  setId: string,
  clock: Omit<StoredClock, "v">
): void {
  write(clockKey(kind, setId), { v: VERSION, ...clock } satisfies StoredClock);
}

/**
 * Drop both copies. Called once the sitting has been filed: the server now
 * holds the result, and a stale recovery copy would offer to "resume" a paper
 * that has already been marked.
 */
export function clearSitting(kind: SittingKind, setId: string): void {
  remove(answersKey(kind, setId));
  remove(clockKey(kind, setId));
}
