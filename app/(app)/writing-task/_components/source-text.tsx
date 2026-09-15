/**
 * The text of an attached source (a statute or judgment extract), set to be
 * read rather than merely displayed.
 *
 * Shared by the two screens that print sources: the question paper, where the
 * candidate works through them while drafting, and the full solution, where
 * each source the model answer relied on is shown again. One renderer, so the
 * same provision is laid out the same way on both.
 *
 * No "use client": plain markup with no state, usable from either kind of
 * component.
 */
export function SourceText({ text }: { text: string }) {
  const blocks = provisionBlocks(text);

  return (
    <div className="space-y-3.5">
      {blocks.map((block, i) => (
        <p
          key={i}
          className="whitespace-pre-wrap font-heebo"
          style={{ fontSize: 15, lineHeight: 1.95, color: "var(--color-ink)" }}
        >
          {block}
        </p>
      ))}
    </div>
  );
}

/**
 * Split a source into the provisions it is made of, so each starts on its own
 * paragraph instead of running into the previous one.
 *
 * The text arrives from the exam PDF as a single unbroken string — there is not
 * one newline in it — with the provision markers buried mid-line. Three forms
 * occur, and all three have to be matched:
 *
 *   "(129א). בתום"   repaired by migration 20260914000005
 *   "5. בית המשפט"   a section number, likewise repaired
 *   ") .ד( הליך"     still mirrored, on the quotes that migration left alone
 *                    because their brackets landed inside words
 *
 * Deliberately conservative — it must never break a sentence in half. A
 * parenthetical inside prose ("מחלוקות (פלוגתאות) כאשר") does not match,
 * because the content between the brackets is a word rather than a marker, and
 * case-law quotes, which have no markers at all, come back as one block.
 */
export function provisionBlocks(text: string): string[] {
  const MARKER = [
    // "(129א)." / "(א) " — a bracketed marker, with or without its full stop.
    /(?=\((?:[0-9]{1,3}[א-ת]?|[א-ת])\)\s*\.?\s)/,
    // "5. בית" / "129. " — a bare section number opening a sentence. Requires
    // the space after the stop so a decimal or a date cannot match.
    /(?=(?:^|\s)[0-9]{1,3}\.\s)/,
    // ") .ד(" — the mirrored form, on quotes that still carry it.
    /(?=\)\s*[.;]?\s*[0-9]{0,3}[א-ת]?\s*\()/,
  ]
    .map((r) => r.source)
    .join("|");

  const parts = text
    .split(new RegExp(MARKER, "g"))
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text];
}
