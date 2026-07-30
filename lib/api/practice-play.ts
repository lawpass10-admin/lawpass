"use client";

/**
 * Practice PLAY domain — client wrappers (safe dual-path) for the
 * in-session gameplay actions. Same signatures + return shapes as the
 * server actions. Falls back to the action when the Express API is
 * disabled (production). deleteNote uses the DELETE method (the server
 * route is `DELETE /api/practice/notes`).
 */

import { apiAction } from "@/lib/api/client";
import {
  submitAttempt as submitAttemptAction,
  advanceToNext as advanceToNextAction,
  toggleBookmark as toggleBookmarkAction,
  exitSession as exitSessionAction,
  saveNote as saveNoteAction,
  deleteNote as deleteNoteAction,
} from "@/app/(app)/practice/play/_actions";

const HE_ERROR = "טופס לא תקין";

export const submitAttempt = apiAction(
  "/api/practice/attempts",
  submitAttemptAction,
  { fallbackError: HE_ERROR }
);

export const advanceToNext = apiAction(
  "/api/practice/advance",
  advanceToNextAction,
  { fallbackError: HE_ERROR }
);

export const toggleBookmark = apiAction(
  "/api/practice/bookmark/toggle",
  toggleBookmarkAction,
  { fallbackError: HE_ERROR }
);

export const exitSession = apiAction(
  "/api/practice/sessions/exit",
  exitSessionAction,
  { fallbackError: HE_ERROR }
);

export const saveNote = apiAction("/api/practice/notes", saveNoteAction, {
  fallbackError: HE_ERROR,
});

export const deleteNote = apiAction("/api/practice/notes", deleteNoteAction, {
  method: "DELETE",
  fallbackError: HE_ERROR,
});
