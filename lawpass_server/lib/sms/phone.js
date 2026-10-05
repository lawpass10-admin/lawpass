"use strict";

// The ONE place an Israeli mobile number becomes canonical.
//
// Everything else in lib/sms — the recipient file reader, the sent log, the
// provider — works on whatever this returns, so a second normaliser anywhere
// would silently split the same person into two numbers: one that gets the
// campaign twice, one that gets it never.
//
// Canonical form is E.164 (+9725XXXXXXXX). The gateway wants the local form
// (05XXXXXXXX), so `toLocal` is the only place that conversion happens.
//
// Mobiles only. A campaign exists to reach a handset; a landline on the list
// is a row that will be charged for and never read, so it is rejected loudly
// at load time rather than quietly at send time.

/** 050–059. 057 is historic but still in circulation, so the range is whole. */
const MOBILE = /^05\d{8}$/;

/**
 * Turn anything a spreadsheet might contain into +9725XXXXXXXX, or null.
 *
 * The three mangled shapes this has to survive, all of them normal:
 *   "054-123-4567"  a human typed the dashes
 *   "'0541234567"   Excel's text-cell apostrophe, which comes through in CSV
 *   "541234567"     Excel read the column as a NUMBER and ate the leading zero
 *
 * The last one is the dangerous case: it is still nine plausible digits, so a
 * reader that only strips punctuation would pass it through and the gateway
 * would reject 500 numbers at once.
 */
function normalizeIsraeliMobile(raw) {
  if (raw === null || raw === undefined) return null;

  const text = String(raw).trim().replace(/^'/, "");
  if (!text) return null;

  const hadPlus = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!digits) return null;

  // International form, with or without the +.
  if (hadPlus || digits.startsWith("972")) {
    digits = digits.replace(/^972/, "");
    if (!digits.startsWith("0")) digits = `0${digits}`;
  }

  // Excel's missing leading zero.
  if (digits.length === 9 && digits.startsWith("5")) digits = `0${digits}`;

  if (!MOBILE.test(digits)) return null;
  return `+972${digits.slice(1)}`;
}

/** +972541234567 → 0541234567. What SMS4Free expects in `recipient`. */
function toLocal(e164) {
  return String(e164).replace(/^\+972/, "0");
}

/**
 * 054-***-4567. What goes on screen and into anything shareable.
 *
 * The recipient file is a list of real people's phone numbers, so a preview
 * that printed them in full would turn every terminal scrollback and pasted
 * screenshot into a copy of the list. The last four digits are enough to
 * recognise your own number in a test run.
 */
function mask(e164) {
  const local = toLocal(e164);
  if (!MOBILE.test(local)) return "(invalid)";
  return `${local.slice(0, 3)}-***-${local.slice(6)}`;
}

module.exports = { normalizeIsraeliMobile, toLocal, mask };
