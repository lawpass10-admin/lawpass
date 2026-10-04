// generated-lock.mjs — one writer at a time for scripts/diuni/generated/.
//
// WHY THIS EXISTS. `generated/` is shared mutable state with no owner:
// generate-batch.mjs writes question files into it and load-diuni-questions.mjs
// loads EVERY file it finds there. Two runs at once therefore do not merely
// race — they silently merge. On 2026-10-04 a --exams=1 run and a --exams=5 run
// overlapped for about 90 minutes and produced three unusable papers: one of 55
// questions, one of 64 and one of 20, where each loader had swept up a mixture
// of both runs' output. Nothing errored; the papers simply had the wrong
// contents, and that was only noticed because 55 is not 40.
//
// A lock turns that into a refusal. The second run stops before it archives
// anything, which is the step that destroys the first run's work.
//
// STALE LOCKS. A killed run leaves its lockfile behind. Rather than make
// someone delete a file to get going again, the holder's pid is recorded and
// checked: if that process is gone, the lock is stale and gets taken over. The
// pid is only meaningful on the machine that wrote it, so the hostname is
// recorded too and a lock from elsewhere is never assumed stale.

import { writeFileSync, readFileSync, unlinkSync, openSync, closeSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hostname } from "node:os";

/** Set by a parent that already holds the lock, so its own children pass. */
const PASS = "DIUNI_GENERATED_LOCK_OWNED";

function alive(pid) {
  try {
    process.kill(pid, 0); // signal 0 tests existence without touching it
    return true;
  } catch (err) {
    return err.code === "EPERM"; // exists but not ours to signal
  }
}

/**
 * Take the lock, or throw with an explanation of who holds it.
 * Returns a release function; also released on normal exit.
 */
export function acquireGeneratedLock(generatedDir, label) {
  if (process.env[PASS] === "1") return () => {};

  const lockPath = join(generatedDir, ".lock");
  const mine = { pid: process.pid, host: hostname(), label, at: new Date().toISOString() };

  const take = () => {
    // 'wx' fails if the file exists — the atomic part. Checking existence and
    // then writing would leave a window for two runs to both succeed.
    const fd = openSync(lockPath, "wx");
    closeSync(fd);
    writeFileSync(lockPath, JSON.stringify(mine, null, 2), "utf8");
  };

  try {
    take();
  } catch (err) {
    if (err.code !== "EEXIST") throw err;

    let held = null;
    try {
      held = JSON.parse(readFileSync(lockPath, "utf8"));
    } catch {
      held = null; // unreadable lock is treated as stale
    }

    const sameHost = held?.host === hostname();
    const stale = !held || (sameHost && !alive(held.pid));
    if (!stale) {
      const who = held.label ? `${held.label} ` : "";
      throw new Error(
        `scripts/diuni/generated/ is in use by ${who}(pid ${held.pid} on ${held.host}, since ${held.at}).\n` +
          `Two runs sharing that directory corrupt each other's papers, so this one is stopping.\n` +
          `Wait for it to finish, or — if you are certain it is dead — delete ${lockPath}.`
      );
    }
    try {
      unlinkSync(lockPath);
    } catch {
      /* someone else cleared it first; the retry below settles it */
    }
    take();
  }

  process.env[PASS] = "1";
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    delete process.env[PASS];
    try {
      const held = JSON.parse(readFileSync(lockPath, "utf8"));
      if (held.pid === process.pid) unlinkSync(lockPath);
    } catch {
      /* already gone, or not ours — leave it alone */
    }
  };

  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      release();
      process.exit(130);
    });
  }
  return release;
}

/** Who holds it, or null. For reporting without taking it. */
export function readGeneratedLock(generatedDir) {
  const lockPath = join(generatedDir, ".lock");
  if (!existsSync(lockPath)) return null;
  try {
    return JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}
