"use client";

/**
 * The two floating pills at the top of every (app) screen, as one row.
 *
 * WHY A ROW AND NOT TWO FIXED BUTTONS. Each launcher used to place itself with
 * `fixed left-1/2 -translate-x-1/2`. That works for one; a second one placed
 * the same way lands exactly on top of it, and offsetting it by a hand-measured
 * number would break the moment either label changed. One centred flex row
 * places both, and neither knows how wide the other is.
 *
 * The placement note from feedback-launcher.tsx still applies and still needs
 * re-checking when a page grows a centred header: this is fixed-position and
 * knows nothing about what is underneath it.
 */

import { DraftLauncher } from "./draft-launcher";
import { FeedbackLauncher, PILL_TOP } from "./feedback-launcher";

export function TopLaunchers() {
  return (
    <div
      // z-40 matches the QA launcher: above the page, below an open dialog.
      // pointer-events-none on the row so the gap between the pills does not
      // swallow clicks meant for the page; each pill takes its own back.
      className="pointer-events-none fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 [&>*]:pointer-events-auto"
      style={{ top: `${PILL_TOP}px` }}
    >
      <FeedbackLauncher />
      <DraftLauncher />
    </div>
  );
}
