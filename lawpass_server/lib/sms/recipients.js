"use strict";

// Read the recipient list off disk: CSV, TXT, or Excel.
//
// ── Why no column has to be configured ─────────────────────────────────────
// The file is "a column of phone numbers", but in practice it arrives as a
// one-column export, a two-column export with names, or a sheet with a header
// row in Hebrew. Rather than make you describe the shape in JSON and get it
// wrong, every cell in a row is offered to the normaliser and the first one
// that is a real Israeli mobile wins. A name column cannot accidentally be
// read as a phone number, because a name does not normalise to one.
//
// ── Why nothing is silently dropped ────────────────────────────────────────
// Every row ends up in exactly one bucket — `recipients`, `duplicates`, or
// `invalid` — and the counts are printed before anything is sent. A loader
// that quietly skipped the rows it could not read would turn "I uploaded 500"
// into "430 were messaged" with no way to notice, and the 70 who were missed
// look identical to 70 who were reached.

const fs = require("node:fs");
const path = require("node:path");

const { normalizeIsraeliMobile, mask } = require("./phone");

/** Excel is a zip full of XML; parsing it by hand is not worth owning. */
function loadXlsxReader() {
  try {
    return require("xlsx");
  } catch {
    return null;
  }
}

/**
 * Split one delimited line into cells.
 *
 * Deliberately not a full RFC-4180 parser: quoted fields are unquoted and
 * doubled quotes collapsed, but an embedded newline inside a quoted field is
 * not supported. A phone list does not contain one, and a parser that handles
 * it is a dependency or a hundred lines of state machine for a case that
 * cannot occur here.
 */
function splitCells(line) {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(delimiter).map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
      return trimmed.slice(1, -1).replace(/""/g, '"');
    }
    return trimmed;
  });
}

/** Text file → array of rows, each row an array of cell strings. */
function readDelimited(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCells);
}

/** Excel file → the same shape, from the first sheet. */
function readSpreadsheet(filePath) {
  const xlsx = loadXlsxReader();
  if (!xlsx) {
    throw new Error(
      `לקריאת קובץ אקסל נדרשת החבילה "xlsx", שאינה מותקנת.\n` +
        `  הפתרון הפשוט: פתחו את ${path.basename(filePath)} באקסל ושמרו כ-CSV.\n` +
        `  לחלופין: npm install xlsx  (בתיקיית lawpass_server)`
    );
  }
  const book = xlsx.readFile(filePath, { cellDates: false });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error(`הגיליון הראשון בקובץ ${path.basename(filePath)} ריק.`);
  // raw:false asks for the FORMATTED text, which is what keeps a number
  // formatted as text from arriving here as 5.41234567e8.
  return xlsx
    .utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false, defval: "" })
    .map((row) => row.map((cell) => String(cell ?? "").trim()));
}

/**
 * Load, normalise and de-duplicate a recipient file.
 *
 * @param {string} filePath  absolute path to a .csv / .txt / .xlsx / .xls
 * @returns {{
 *   file: string,
 *   rows: number,
 *   recipients: Array<{ phone: string, masked: string, row: number }>,
 *   duplicates: Array<{ phone: string, masked: string, row: number }>,
 *   invalid: Array<{ row: number, value: string }>,
 *   headerSkipped: boolean,
 * }}
 */
function loadRecipients(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `קובץ הנמענים לא נמצא: ${filePath}\n` +
        "  צרו אותו (עמודה אחת של מספרי נייד) או הצביעו על קובץ אחר עם --file."
    );
  }

  const extension = path.extname(filePath).toLowerCase();
  const rows =
    extension === ".xlsx" || extension === ".xls" || extension === ".xlsm"
      ? readSpreadsheet(filePath)
      : readDelimited(filePath);

  const recipients = [];
  const duplicates = [];
  const invalid = [];
  const seen = new Set();
  let headerSkipped = false;

  rows.forEach((cells, index) => {
    const lineNumber = index + 1;

    let phone = null;
    for (const cell of cells) {
      phone = normalizeIsraeliMobile(cell);
      if (phone) break;
    }

    if (!phone) {
      // A first row with no usable number is a header, not a mistake. Calling
      // it invalid would mean every well-formed file reports one bad row and
      // the warning stops meaning anything.
      if (index === 0) {
        headerSkipped = true;
        return;
      }
      invalid.push({ row: lineNumber, value: cells.join(" | ").slice(0, 80) });
      return;
    }

    const entry = { phone, masked: mask(phone), row: lineNumber };
    if (seen.has(phone)) {
      duplicates.push(entry);
      return;
    }
    seen.add(phone);
    recipients.push(entry);
  });

  return {
    file: filePath,
    rows: rows.length,
    recipients,
    duplicates,
    invalid,
    headerSkipped,
  };
}

module.exports = { loadRecipients };
