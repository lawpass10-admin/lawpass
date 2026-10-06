"use strict";

// A title for a draft that has no title column.
//
// user_drafts stores free text and nothing else — the scratch page is a blank
// box on purpose. A list still needs something to read down, so the first
// sentence becomes the heading.
//
// DERIVED ON THE SERVER, not in the browser. The list and anything that later
// shows a draft (a search result, an email, an export) must agree on what a
// given draft is called; a title computed in one component is a title the next
// one gets subtly wrong.
//
// Three things it has to survive, all of them normal in a scratch pad:
//   * no punctuation at all — someone typed a paragraph and never stopped;
//   * a title line followed by a body, which is how people actually write
//     notes, and where the FIRST LINE is the title even without a full stop;
//   * "סעיף 3.5" and "ע.ש." — a period that is not the end of a sentence.

/** Long enough to be a real heading, short enough to stay on one line. */
const MAX_TITLE_CHARS = 80;

/** Shown when a draft has nothing usable to name it by. */
const UNTITLED = "טיוטה ללא כותרת";

/**
 * The first sentence of a draft, as a heading.
 *
 * @param {string} text the draft body
 * @returns {string} never empty — falls back to UNTITLED
 */
function draftTitle(text) {
  // Line first, sentence second. A note written as a heading and then a body
  // has its heading on line one with no full stop, and a sentence-first reader
  // would run straight past it into the body.
  const firstLine = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return UNTITLED;

  // A terminator only ends a sentence when something separates it from the
  // next word. Without the lookahead, "סעיף 3.5 קובע ש..." is titled "סעיף 3."
  const match = firstLine.match(/^[\s\S]*?[.!?](?=\s|$)/);
  let title = (match ? match[0] : firstLine).trim();

  // A trailing full stop on a heading reads as a mistake. A question or
  // exclamation mark carries meaning, so those stay.
  title = title.replace(/\.$/, "");

  if (title.length > MAX_TITLE_CHARS) {
    const cut = title.slice(0, MAX_TITLE_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    // Only break on a space when the break is reasonably far in; a long first
    // word would otherwise be cut down to almost nothing.
    title = (lastSpace > MAX_TITLE_CHARS * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }

  return title || UNTITLED;
}

module.exports = { draftTitle, MAX_TITLE_CHARS, UNTITLED };
