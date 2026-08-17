"use strict";

// Shared HTML -> PDF printing for the open-question pipeline.
//
// Chromium is the renderer because it is the only thing on hand that lays out
// Hebrew RTL correctly — the same reason poppler is the extractor on the way in.

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findBrowser() {
  const found = BROWSERS.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      "no Chromium browser found for PDF printing (looked for Edge and Chrome)"
    );
  }
  return found;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Blank-line separated text -> <p> blocks. */
function paragraphs(text, className = "") {
  return String(text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="${className}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * Write `html` next to `outBase` and print it to a PDF of the same name.
 * Returns the two paths; pdfPath is null when the PDF step is skipped.
 *
 * htmlOnly exists for the batch runner, which produces JSON + HTML and has no
 * use for the PDF. Skipping it is not just tidiness: the PDF step shells out to
 * Chrome, so on a server without a browser installed findBrowser() throws, and
 * a run would die on an artifact nobody asked for.
 */
function printHtmlToPdf(html, outBase, { htmlOnly = false } = {}) {
  const htmlPath = `${outBase}.html`;
  const pdfPath = `${outBase}.pdf`;

  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, "utf8");

  if (htmlOnly) return { htmlPath, pdfPath: null };

  execFileSync(
    findBrowser(),
    [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file:///${path.resolve(htmlPath).replace(/\\/g, "/")}`,
    ],
    { stdio: "pipe" }
  );

  return { htmlPath, pdfPath };
}

module.exports = { esc, paragraphs, findBrowser, printHtmlToPdf };
