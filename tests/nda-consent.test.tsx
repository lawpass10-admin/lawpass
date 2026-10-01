import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NdaConsent } from "@/app/(auth)/_components/nda-consent";
import { LLM_DISCLAIMER, NDA_SUMMARY } from "@/lib/legal/nda";

/**
 * The consent block on the registration forms.
 *
 * The case worth a test is the link: it sits inside a <Label>, so without a
 * preventDefault a click on it toggles the checkbox as well as opening the
 * dialog — meaning opening the agreement in order to read it would silently
 * accept it. That is a consent bug that looks like nothing on screen.
 */
afterEach(cleanup);

describe("NdaConsent", () => {
  it("shows the summary and the LLM disclaimer before the box", () => {
    render(<NdaConsent checked={false} onCheckedChange={() => {}} />);

    for (const line of NDA_SUMMARY) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText(LLM_DISCLAIMER)).toBeInTheDocument();
  });

  it("opens the agreement WITHOUT accepting it", () => {
    const onCheckedChange = vi.fn();
    render(<NdaConsent checked={false} onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("button", { name: "הסכם שמירת הסודיות" }));

    // The whole point: reading is not agreeing.
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("reports the tick when the box itself is clicked", () => {
    const onCheckedChange = vi.fn();
    render(<NdaConsent checked={false} onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("is unticked unless the caller says otherwise — consent is never pre-given", () => {
    render(<NdaConsent checked={false} onCheckedChange={() => {}} />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});
