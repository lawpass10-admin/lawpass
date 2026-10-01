import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NoCopyApp } from "@/app/(app)/_components/no-copy-app";
import { NoCopyBypassProvider } from "@/app/(app)/_components/no-copy-bypass-provider";

/**
 * The app-wide copy deterrent, and specifically its EXEMPTIONS.
 *
 * The blocking half is easy to get right and loud when it breaks. The
 * exemptions are neither: `user-select: none` over a textarea breaks the
 * writing task and the notes editor in a way nobody notices until a candidate
 * cannot fix a typo mid-exam. These pin them.
 */
afterEach(cleanup);

/** copy/cut/contextmenu/dragstart are cancelable and bubble, so one assertion
 *  per event answers "did the wrapper block it". */
function fireCopy(node: Element) {
  return !fireEvent.copy(node);
}

describe("NoCopyApp — what it blocks", () => {
  it("blocks copy on ordinary content", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyApp>
          <p data-testid="question">שאלה מתוך מאגר הבחינות</p>
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    expect(fireCopy(screen.getByTestId("question"))).toBe(true);
  });

  it("blocks the context menu and dragging text out", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyApp>
          <p data-testid="question">שאלה</p>
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    const node = screen.getByTestId("question");
    expect(fireEvent.contextMenu(node)).toBe(false);
    expect(fireEvent.dragStart(node)).toBe(false);
  });
});

describe("NoCopyApp — what it must NOT block", () => {
  it("leaves a textarea alone — the writing task is typed into one", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyApp>
          <textarea data-testid="draft" defaultValue="טיוטת המטלה" />
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    expect(fireCopy(screen.getByTestId("draft"))).toBe(false);
  });

  it("leaves an input alone — every search box is one", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyApp>
          <input data-testid="search" defaultValue="נספח" />
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    expect(fireCopy(screen.getByTestId("search"))).toBe(false);
  });

  it("leaves a contenteditable alone — the notes editor is one", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyApp>
          <div contentEditable data-testid="editor" suppressContentEditableWarning>
            הערה
          </div>
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    expect(fireCopy(screen.getByTestId("editor"))).toBe(false);
  });

  it("leaves .allow-copy alone, including its children — the user's own notes", () => {
    render(
      <NoCopyBypassProvider bypass={false}>
        <NoCopyApp>
          <div className="allow-copy">
            <p data-testid="mine">ההערה שכתבתי</p>
          </div>
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    // Asserted on the CHILD, because that is what a selection actually targets
    // and the exemption is written as a `closest()` lookup for exactly that.
    expect(fireCopy(screen.getByTestId("mine"))).toBe(false);
  });
});

describe("NoCopyApp — the QA bypass", () => {
  it("does not block anything, and leaves no wrapper behind", () => {
    const { container } = render(
      <NoCopyBypassProvider bypass>
        <NoCopyApp>
          <p data-testid="question">שאלה</p>
        </NoCopyApp>
      </NoCopyBypassProvider>
    );
    expect(fireCopy(screen.getByTestId("question"))).toBe(false);
    // No class and no element: a reviewer's DOM should carry no signature of
    // the deterrent at all, which is what the Slice 63 provider promised.
    expect(container.querySelector(".no-copy-app")).toBeNull();
  });
});
