"use client";

import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useNoCopyBypass } from "./no-copy-bypass-provider";

/**
 * Slice 37 — copy/paste deterrent for question-content surfaces.
 *
 * Wraps a single text node (or any element) with:
 *   - `.no-copy-content` CSS class (user-select: none,
 *     -webkit-user-select: none, -webkit-touch-callout: none) — blocks
 *     text-selection AND iOS Safari's long-press magnifier/callout.
 *   - onCopy / onCut / onContextMenu / onDragStart handlers that each
 *     call `e.preventDefault()` — blocks Ctrl/Cmd-C copy, Ctrl/Cmd-X
 *     cut, the right-click context menu, and drag-text-out.
 *
 * This is a deterrent only. It does NOT prevent screenshots, OCR,
 * devtools, or copy-via-JS console. That's by design — PM brief.
 *
 * Scoped, NOT global. The block applies only to elements that opt in
 * via this component (or by manually using the `.no-copy-content`
 * class + handlers at one of the shared seams documented in the
 * Slice 37 surface map). The user's authored note text in
 * `app/(app)/notes/_components/note-row.tsx` (the saved-note HTML
 * section) and the TipTap NoteEditorSheet are deliberately NOT
 * wrapped — they must stay fully selectable.
 *
 * Slice 63 — QA bypass. When the `<NoCopyBypassProvider>` value is
 * `true` (the (app) layout sets it from is_qa_tester || is_admin),
 * this component renders a plain pass-through wrapper — no class, no
 * handlers — so QA reviewers can copy question + 360 content into AI
 * tools. Outside the provider (tests, marketing routes, the (auth)
 * group) the context default is `false` and the deterrent renders
 * as it always has.
 *
 * Usage:
 *   <NoCopyText className="whitespace-pre-wrap text-[17px]">
 *     {question.question_text}
 *   </NoCopyText>
 *   <NoCopyText as="span" className="…">{choice.choice_text}</NoCopyText>
 *   <NoCopyText as="div" className="…">{children}</NoCopyText>
 */

type NoCopyTextProps = {
  as?: "p" | "div" | "span" | "section" | "article";
  className?: string;
  children: ReactNode;
  /** Pass-through for accessibility / direction / aria props the
   *  caller wants applied to the same element (e.g. `dir="auto"`). */
  dir?: "ltr" | "rtl" | "auto";
  "aria-label"?: string;
};

export function NoCopyText({
  as,
  className,
  children,
  ...rest
}: NoCopyTextProps) {
  const bypass = useNoCopyBypass();
  const Tag = (as ?? "p") as ElementType;

  if (bypass) {
    // Slice 63 — QA mode: skip the deterrent entirely. No
    // `no-copy-content` class, no preventDefault handlers, no
    // direct DOM signature of the block at all. Native selection
    // and copy proceed unimpeded.
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      className={cn("no-copy-content", className)}
      onCopy={(e: React.SyntheticEvent) => e.preventDefault()}
      onCut={(e: React.SyntheticEvent) => e.preventDefault()}
      onContextMenu={(e: React.SyntheticEvent) => e.preventDefault()}
      onDragStart={(e: React.SyntheticEvent) => e.preventDefault()}
      {...rest}
    >
      {children}
    </Tag>
  );
}
