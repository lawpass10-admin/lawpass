import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// usePathname is used inside the widget; mock the entire navigation
// module so the test doesn't need a Next router context.
vi.mock("next/navigation", () => ({
  usePathname: () => "/test-path",
}));

// sonner toast — mock to silence side effects.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// The widget imports the Server Action; the action's module imports
// service-role-only deps at module load. Vitest under jsdom doesn't
// have those env vars, so we replace the action with a noop.
vi.mock("@/app/(app)/qa/_actions", () => ({
  submitQaReport: vi.fn(async () => ({ ok: true, reportId: "stub" })),
}));

import { QaFloatingWidget } from "@/app/(app)/_components/qa-floating-widget";

describe("QaFloatingWidget", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when the user is not a QA tester", () => {
    const { container } = render(<QaFloatingWidget isQaTester={false} />);
    expect(container.firstChild).toBeNull();
    // Bug button is absent.
    expect(screen.queryByRole("button", { name: /דיווח QA/ })).toBeNull();
  });

  it("renders the floating button when the user IS a QA tester", () => {
    render(<QaFloatingWidget isQaTester={true} />);
    const button = screen.getByRole("button", { name: /דיווח QA/ });
    expect(button).toBeInTheDocument();
  });
});
