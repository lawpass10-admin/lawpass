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

// Slice 32 — the collapse cap moved 6 → 11. The fixtures + assertions
// below are anchored to `CAP` so a future tweak of the constant only
// needs an update here. Behavior under test (default-collapsed,
// show-more/less, filter-resets-collapse, empty state) is unchanged.
const CAP = 11;

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

// Sized so:
//   - "הכל" (all)        : 20 rows  → exceeds CAP=11 → show-more visible
//   - "דיוני" (procedural): 6 rows   → under CAP      → no show-more
//   - "מהותי" (substantive): 14 rows → exceeds CAP    → show-more visible
const PROCEDURAL_COUNT = 6;
const SUBSTANTIVE_COUNT = 14;
const ROWS: MasteryRow[] = [
  ...Array.from({ length: PROCEDURAL_COUNT }, (_, i) =>
    row(i + 1, "procedural")
  ),
  ...Array.from({ length: SUBSTANTIVE_COUNT }, (_, i) =>
    row(i + 1, "substantive")
  ),
];
const TOTAL_ROWS = PROCEDURAL_COUNT + SUBSTANTIVE_COUNT;

function getVisibleTitles(): string[] {
  return screen
    .getAllByRole("link", { name: /תרגל את הפרק/ })
    .map((el) => el.getAttribute("aria-label") ?? "");
}

// Slice 36 — the implementation renders TWO toggle buttons (mobile +
// desktop) with `md:hidden` / `hidden md:inline-flex` so the right
// one is visible per breakpoint. jsdom can't apply Tailwind's `md:`
// utilities, so both live in the DOM. To preserve the existing
// desktop-effective assertions at full strength, we target the
// desktop toggle by `data-testid` rather than the original ambiguous
// `getByRole("button", { name: /הצג עוד/ })`. Mobile toggle behaviour
// is verified visually post-merge — out of scope for jsdom.
const DESKTOP_TOGGLE = "mastery-toggle-desktop";

function clickDesktopToggle(): void {
  fireEvent.click(screen.getByTestId(DESKTOP_TOGGLE));
}

describe("MasteryRowsClient", () => {
  afterEach(() => cleanup());

  it("renders the first CAP rows by default and shows the 'הצג עוד' affordance", () => {
    render(<MasteryRowsClient rows={ROWS} />);
    expect(screen.getAllByRole("link").length).toBe(CAP);
    expect(screen.getByTestId(DESKTOP_TOGGLE)).toBeInTheDocument();
  });

  it("'הצג עוד' expands to the full set; 'הצג פחות' collapses back to CAP", () => {
    render(<MasteryRowsClient rows={ROWS} />);

    clickDesktopToggle();
    expect(screen.getAllByRole("link").length).toBe(TOTAL_ROWS);

    clickDesktopToggle();
    expect(screen.getAllByRole("link").length).toBe(CAP);
  });

  it("clicking 'דיוני' narrows the list to procedural rows", () => {
    render(<MasteryRowsClient rows={ROWS} />);

    fireEvent.click(screen.getByRole("radio", { name: "דיוני" }));
    // 6 procedural rows — under CAP_DESKTOP, so the desktop show-more
    // doesn't appear. (Mobile cap is 3, so the mobile-only toggle DOES
    // render in the DOM — that's intentional and not tested here.)
    expect(screen.getAllByRole("link").length).toBe(PROCEDURAL_COUNT);
    expect(screen.queryByTestId(DESKTOP_TOGGLE)).not.toBeInTheDocument();

    for (const aria of getVisibleTitles()) {
      expect(aria).toContain("פרק דיוני");
      expect(aria).not.toContain("פרק מהותי");
    }
  });

  it("clicking 'מהותי' narrows + shows show-more when set exceeds CAP", () => {
    render(<MasteryRowsClient rows={ROWS} />);

    fireEvent.click(screen.getByRole("radio", { name: "מהותי" }));
    expect(screen.getAllByRole("link").length).toBe(CAP);
    expect(screen.getByTestId(DESKTOP_TOGGLE)).toBeInTheDocument();

    clickDesktopToggle();
    expect(screen.getAllByRole("link").length).toBe(SUBSTANTIVE_COUNT);
    for (const aria of getVisibleTitles()) {
      expect(aria).toContain("פרק מהותי");
      expect(aria).not.toContain("פרק דיוני");
    }
  });

  it("switching the filter resets the collapsed view (showAll → false)", () => {
    render(<MasteryRowsClient rows={ROWS} />);

    // Expand on the default 'all' filter first.
    clickDesktopToggle();
    expect(screen.getAllByRole("link").length).toBe(TOTAL_ROWS);

    // Switch filter to a set that still overflows CAP — should collapse
    // back to CAP and show the desktop toggle again.
    fireEvent.click(screen.getByRole("radio", { name: "מהותי" }));
    expect(screen.getAllByRole("link").length).toBe(CAP);
    expect(screen.getByTestId(DESKTOP_TOGGLE)).toBeInTheDocument();
  });

  it("hides the show-more button entirely when the filtered set fits the cap", () => {
    render(<MasteryRowsClient rows={ROWS} />);

    // Procedural-only (6 rows) is under CAP_DESKTOP → no desktop toggle.
    // The mobile toggle still renders in the DOM (6 > CAP_MOBILE=3) —
    // that's intentional and not asserted here.
    fireEvent.click(screen.getByRole("radio", { name: "דיוני" }));
    expect(screen.queryByTestId(DESKTOP_TOGGLE)).not.toBeInTheDocument();
  });

  it("renders the empty-state hint when the current filter has no rows", () => {
    // Procedural-only fixture; substantive filter should be empty.
    const proceduralOnly = ROWS.filter((r) => r.track === "procedural");
    render(<MasteryRowsClient rows={proceduralOnly} />);

    fireEvent.click(screen.getByRole("radio", { name: "מהותי" }));
    expect(screen.queryAllByRole("link").length).toBe(0);
    expect(screen.getByText(/אין פרקים להצגה/)).toBeInTheDocument();
  });
});
