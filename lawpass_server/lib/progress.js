"use strict";

// A live elapsed-time counter for the long-running generation calls.
//
// These runs take minutes with no output in between, which is indistinguishable
// from a hang. The ticking clock is the only signal that the process is alive.

function mmss(ms) {
  const total = Math.round(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Start ticking. Returns stop(), which clears the line and gives back the
 * elapsed seconds.
 *
 * When output is piped or redirected there is no cursor to rewind, so the timer
 * stays silent rather than filling the file with carriage returns — the caller
 * still gets the elapsed total.
 */
function startTimer(label = "elapsed") {
  const started = Date.now();
  const elapsed = () => Math.round((Date.now() - started) / 1000);

  if (!process.stdout.isTTY) return elapsed;

  const tick = () => {
    process.stdout.write(`\r  ⏱  ${label} ${mmss(Date.now() - started)}    `);
  };
  tick();
  const id = setInterval(tick, 1000);
  if (id.unref) id.unref(); // never hold the process open

  return () => {
    clearInterval(id);
    process.stdout.write("\r" + " ".repeat(48) + "\r");
    return elapsed();
  };
}

module.exports = { startTimer, mmss };
