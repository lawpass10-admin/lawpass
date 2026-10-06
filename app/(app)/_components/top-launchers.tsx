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

import * as React from "react";

import { DraftLauncher } from "./draft-launcher";
import { FeedbackLauncher, PILL_TOP } from "./feedback-launcher";

export function TopLaunchers() {
  return (
    <div
      // z-40 matches the QA launcher: above the page, below an open dialog.
      // pointer-events-none on the row so the gap between the pills does not
      // swallow clicks meant for the page; each pill takes its own back.
      // BELOW THE MOBILE BAR, NOT ON TOP OF IT. MobileTopBar is `sticky top-0
      // z-40` and about 60px tall, and this row is also z-40 — so at the
      // desktop offset the pills sat across the logo and the menu button on
      // every phone. From md the bar is `md:hidden` and the desktop offset is
      // correct again.
      //
      // top-[68px] clears the bar with a few pixels to spare rather than
      // matching its height exactly: the bar grows with its own content, and a
      // flush value would start overlapping again the first time it does.
      className="pointer-events-none fixed left-1/2 top-[68px] z-40 flex -translate-x-1/2 items-center gap-2 [&>*]:pointer-events-auto md:top-[var(--pill-top)]"
      style={{ "--pill-top": `${PILL_TOP}px` } as React.CSSProperties}
    >
      <FeedbackLauncher />
      <DraftLauncher />
    </div>
  );
}
