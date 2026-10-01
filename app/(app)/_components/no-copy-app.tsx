"use client";

import { useNoCopyBypass } from "./no-copy-bypass-provider";

/**
 * The copy deterrent, applied to the WHOLE signed-in app.
 *
 * Slice 37 made this opt-in: `<NoCopyText>` wrapped the surfaces that carry
 * exam material, and everything else was selectable. That left the deterrent
 * only as complete as the list of places someone remembered to wrap, and the
 * list grew — practice, exam, mahoti, diuni, bookmarks, mistakes, 360 panels,
 * and now three study-material readers. This inverts it: inside (app)
 * everything is blocked, and the exceptions are named.
 *
 * ONE DELEGATED LISTENER, not a handler per element. The events used here —
 * copy, cut, contextmenu, dragstart — all bubble, so a single pair of handlers
 * on this wrapper covers every node under it including ones rendered later. Per
 * element handlers would have to be remembered for each new component, which is
 * the failure this replaces.
 *
 * WHAT STAYS COPYABLE, and none of these are optional:
 *   - inputs, textareas and contenteditable — the writing task, the notes
 *     editor, every search box. Blocking selection inside a field a candidate
 *     is typing into breaks the product, and a candidate cutting and pasting
 *     their OWN draft is not exfiltration.
 *   - anything inside `.allow-copy` — for the user's own authored content. A
 *     note someone wrote is theirs; refusing to let them copy it would be
 *     hostile and protects nothing.
 *
 * STILL A DETERRENT, NOT A CONTROL. It does not stop screenshots, OCR,
 * devtools, view-source, or a script in the console — the markup is in the page
 * because the page has to render it. It raises the cost of casual bulk
 * copying, which is what it is for. Anyone describing this as preventing
 * exfiltration is overselling it.
 *
 * QA bypass is unchanged: `useNoCopyBypass()` is the one toggle, set from
 * `is_qa_tester || is_admin` in the (app) layout, and when it is true this
 * renders a plain pass-through with no class and no listeners.
 */
export function NoCopyApp({ children }: { children: React.ReactNode }) {
  const bypass = useNoCopyBypass();

  if (bypass) return <>{children}</>;

  // A field or an opted-out region: let the event through untouched.
  const isExempt = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], .allow-copy'
    ) !== null;

  const block = (event: React.SyntheticEvent) => {
    if (isExempt(event.target)) return;
    event.preventDefault();
  };

  return (
    <div
      className="no-copy-app"
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      {children}
    </div>
  );
}
