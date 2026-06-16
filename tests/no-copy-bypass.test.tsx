import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NoCopyText } from "@/app/(app)/_components/no-copy-text";
import { NoCopyBypassProvider } from "@/app/(app)/_components/no-copy-bypass-provider";

/**
 * Slice 63 — verify the QA bypass flips the deterrent on/off through
 * the <NoCopyBypassProvider> context.
 *
 * The deterrent has two observable signatures on the rendered element:
 *   1. The `.no-copy-content` class (CSS user-select: none).
 *   2. The four React synthetic event handlers (onCopy / onCut /
 *      onContextMenu / onDragStart) — observable indirectly because
 *      DOM doesn't expose React listeners; we assert by behavior:
 *      `dispatchEvent(copy)` should be cancellable (defaultPrevented
 *      after dispatch) only when the deterrent is active.
 *
 * Note: the synthetic-event behavior assertion is intentionally light.
 * The class check is the durable invariant; the handler-presence test
 * adds a runtime smoke check.
 */
describe("NoCopyText × NoCopyBypassProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies the .no-copy-content deterrent OUTSIDE the provider (default false)", () => {
    render(
      <NoCopyText as="span" aria-label="t1">
        question stem
      </NoCopyText>
    );
    const el = screen.getByLabelText("t1");
    expect(el.classList.contains("no-copy-content")).toBe(true);
  });

  it("applies the deterrent when the provider's bypass is FALSE (normal users)", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyText as="span" aria-label="t2">
          question stem
        </NoCopyText>
      </NoCopyBypassProvider>
    );
    const el = screen.getByLabelText("t2");
    expect(el.classList.contains("no-copy-content")).toBe(true);

    // The four React onCopy/onCut/etc. handlers can't be inspected
    // directly on the DOM node, but we can assert behavior: a
    // synthesized copy event bubbles to React, the handler fires
    // preventDefault, and `defaultPrevented` flips to true.
    const ev = new Event("copy", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("DROPS the deterrent when the provider's bypass is TRUE (QA + admin)", () => {
    render(
      <NoCopyBypassProvider bypass={true}>
        <NoCopyText as="span" aria-label="t3">
          question stem
        </NoCopyText>
      </NoCopyBypassProvider>
    );
    const el = screen.getByLabelText("t3");
    expect(el.classList.contains("no-copy-content")).toBe(false);

    // No React onCopy handler is mounted → copy event remains
    // cancellable but nothing calls preventDefault, so the event
    // proceeds (defaultPrevented stays false).
    const ev = new Event("copy", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("renders the literal child text (deterrent or no deterrent)", () => {
    render(
      <NoCopyBypassProvider bypass={true}>
        <NoCopyText as="span" aria-label="t4">
          ע&quot;א 3506/13
        </NoCopyText>
      </NoCopyBypassProvider>
    );
    expect(screen.getByLabelText("t4").textContent).toBe('ע"א 3506/13');
  });
});
