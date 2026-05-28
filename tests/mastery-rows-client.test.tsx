import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MasteryRowsClient } from "@/app/(app)/dashboard/_components/mastery-rows-client";
import type { MasteryRow } from "@/lib/dashboard/types";

// next/link → plain anchor under jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ChapterIcon is data-driven; in jsdom we don't render real SVG paths.
// The default mock returns null so the row's icon slot stays empty.
vi.mock("@/app/(app)/dashboard/_components/chapter-icon", () => ({
  ChapterIcon: () => null,
}));

/**
 * Build a deterministic MasteryRow with sensible defaults so the
 * tests focus on the filter + collapse behavior rather than the
 * per-row visuals (those are presentational and don't change here).
 */
function row(
  i: number,
  track: "procedural" | "substantive",
  overrides: Partial<MasteryRow> = {}
): MasteryRow {
  return {
    chapterId: `ch-${track}-${i}`,
    chapterCode: `code_${track}_${i}`,
    chapterTitle: `${track === "procedural" ? "פרק דיוני" : "פרק מהותי"} ${i}`,
    track,
    correct: 0,
    total: 0,
    skipped: 0,
    accuracy: null,
    ...overrides,
  };
}

// Build a 16-row mix: 6 procedural + 10 substantive — matches the
// live taxonomy at the time of writing. Some rows MUST exceed the
// 6-row collapse cap on both filters AND on "all".
const ROWS_16: MasteryRow[] = [
  ...Array.from({ length: 6 }, (_, i) => row(i + 1, "procedural")),
  ...Array.from({ length: 10 }, (_, i) => row(i + 1, "substantive")),
];

function getVisibleTitles(): string[] {
  return screen
    .getAllByRole("link", { name: /תרגל את הפרק/ })
    .map((el) => el.getAttribute("aria-label") ?? "");
}

describe("MasteryRowsClient", () => {
  afterEach(() => cleanup());

  it("renders the first 6 rows by default and shows the 'הצג עוד' affordance", () => {
    render(<MasteryRowsClient rows={ROWS_16} />);
    expect(screen.getAllByRole("link").length).toBe(6);
    expect(
      screen.getByRole("button", { name: /הצג עוד/ })
    ).toBeInTheDocument();
  });

  it("'הצג עוד' expands to the full set; 'הצג פחות' collapses back to 6", () => {
    render(<MasteryRowsClient rows={ROWS_16} />);

    fireEvent.click(screen.getByRole("button", { name: /הצג עוד/ }));
    expect(screen.getAllByRole("link").length).toBe(16);

    fireEvent.click(screen.getByRole("button", { name: "הצג פחות" }));
    expect(screen.getAllByRole("link").length).toBe(6);
  });

  it("clicking 'דיוני' narrows the list to procedural rows", () => {
    render(<MasteryRowsClient rows={ROWS_16} />);

    fireEvent.click(screen.getByRole("radio", { name: "דיוני" }));
    // 6 procedural rows — exactly at the cap, so the show-more
    // button doesn't appear.
    expect(screen.getAllByRole("link").length).toBe(6);
    expect(
      screen.queryByRole("button", { name: /הצג/ })
    ).not.toBeInTheDocument();

    for (const aria of getVisibleTitles()) {
      expect(aria).toContain("פרק דיוני");
      expect(aria).not.toContain("פרק מהותי");
    }
  });

  it("clicking 'מהותי' narrows the list to substantive rows + shows show-more (10 > 6)", () => {
    render(<MasteryRowsClient rows={ROWS_16} />);

    fireEvent.click(screen.getByRole("radio", { name: "מהותי" }));
    expect(screen.getAllByRole("link").length).toBe(6);
    expect(screen.getByRole("button", { name: /הצג עוד/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /הצג עוד/ }));
    expect(screen.getAllByRole("link").length).toBe(10);
    for (const aria of getVisibleTitles()) {
      expect(aria).toContain("פרק מהותי");
      expect(aria).not.toContain("פרק דיוני");
    }
  });

  it("switching the filter resets the collapsed view (showAll → false)", () => {
    render(<MasteryRowsClient rows={ROWS_16} />);

    // Expand on the default 'all' filter first.
    fireEvent.click(screen.getByRole("button", { name: /הצג עוד/ }));
    expect(screen.getAllByRole("link").length).toBe(16);

    // Switch filter — should collapse back to 6 and show 'הצג עוד' again.
    fireEvent.click(screen.getByRole("radio", { name: "מהותי" }));
    expect(screen.getAllByRole("link").length).toBe(6);
    expect(screen.getByRole("button", { name: /הצג עוד/ })).toBeInTheDocument();
  });

  it("hides the show-more button entirely when the filtered set fits the cap", () => {
    render(<MasteryRowsClient rows={ROWS_16} />);

    // Procedural-only (6 rows) is exactly at the cap → no button.
    fireEvent.click(screen.getByRole("radio", { name: "דיוני" }));
    expect(
      screen.queryByRole("button", { name: /הצג/ })
    ).not.toBeInTheDocument();
  });

  it("renders the empty-state hint when the current filter has no rows", () => {
    // Procedural-only fixture; substantive filter should be empty.
    const proceduralOnly = ROWS_16.filter((r) => r.track === "procedural");
    render(<MasteryRowsClient rows={proceduralOnly} />);

    fireEvent.click(screen.getByRole("radio", { name: "מהותי" }));
    expect(screen.queryAllByRole("link").length).toBe(0);
    expect(screen.getByText(/אין פרקים להצגה/)).toBeInTheDocument();
  });
});
