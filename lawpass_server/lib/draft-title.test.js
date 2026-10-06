"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { draftTitle, MAX_TITLE_CHARS, UNTITLED } = require("./draft-title");

test("the first sentence becomes the title, without its full stop", () => {
  assert.equal(
    draftTitle("חוזה אחיד הוא חוזה שתנאיו נקבעו מראש. השאר לא רלוונטי."),
    "חוזה אחיד הוא חוזה שתנאיו נקבעו מראש"
  );
});

test("a question or exclamation mark stays — it carries meaning", () => {
  assert.equal(draftTitle("מה ההבדל בין עוולה לחוזה? לבדוק"), "מה ההבדל בין עוולה לחוזה?");
  assert.equal(draftTitle("לא לשכוח! המבחן ביולי"), "לא לשכוח!");
});

test("a heading line is the title even with no punctuation at all", () => {
  // How people actually write notes: a line, then the body under it. A
  // sentence-first reader would run past the heading into the paragraph.
  assert.equal(
    draftTitle("דיני חוזים — סיכום\nחוזה נכרת בדרך של הצעה וקיבול, ולאחר מכן..."),
    "דיני חוזים — סיכום"
  );
});

test("leading blank lines are skipped", () => {
  assert.equal(draftTitle("\n\n   \nסעיף 12 לחוק החוזים"), "סעיף 12 לחוק החוזים");
});

test("a decimal point does not end a sentence", () => {
  // The bug this guards: "סעיף 3.5 קובע..." titled as "סעיף 3".
  assert.equal(
    draftTitle("סעיף 3.5 לחוק קובע חובת תום לב"),
    "סעיף 3.5 לחוק קובע חובת תום לב"
  );
});

test("a long first sentence is cut on a word boundary with an ellipsis", () => {
  const long =
    "זהו משפט פתיחה ארוך מאוד שנכתב כדי לבדוק את החיתוך של הכותרת כאשר הטיוטה " +
    "נפתחת בפסקה שלמה בלי סימני פיסוק באמצע והיא ממשיכה הלאה";
  const title = draftTitle(long);

  assert.ok(title.length <= MAX_TITLE_CHARS + 1, "stays within the cap (+1 for the ellipsis)");
  assert.ok(title.endsWith("…"), "says it was cut");
  assert.ok(!title.includes("  "), "no double space left by the break");
  assert.ok(long.startsWith(title.slice(0, -1)), "the kept part is a real prefix of the draft");
});

test("a single unbroken word is cut rather than reduced to nothing", () => {
  const title = draftTitle("א".repeat(200));
  assert.equal(title.length, MAX_TITLE_CHARS + 1);
  assert.ok(title.endsWith("…"));
});

test("empty and whitespace-only drafts get a name rather than a blank heading", () => {
  // The column refuses these, so they should not exist — but a blank heading
  // in a list is unreadable, and this is cheaper than finding out the hard way.
  assert.equal(draftTitle(""), UNTITLED);
  assert.equal(draftTitle("   \n\t  "), UNTITLED);
  assert.equal(draftTitle(null), UNTITLED);
  assert.equal(draftTitle(undefined), UNTITLED);
});

test("a draft that is only punctuation still gets a usable heading", () => {
  assert.equal(draftTitle("."), UNTITLED);
});
