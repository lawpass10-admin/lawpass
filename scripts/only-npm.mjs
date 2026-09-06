// only-npm.mjs — refuse to install with anything but npm.
//
// WHY THIS EXISTS. On 2026-09-06 a single `pnpm add recharts` broke both
// deployments at once, in two different ways that looked unrelated:
//
//   * it wrote a pnpm-lock.yaml, and Vercel picks its package manager from
//     whichever lockfile is committed — so Vercel silently switched to pnpm and
//     then refused the build over a stale `pnpm.overrides` config mismatch;
//   * it did NOT touch package-lock.json, so Render's `npm ci` failed with
//     "Missing: recharts@3.10.1 from lock file".
//
// Neither failure names the real cause, and neither appears until deploy time —
// the local dev server was perfectly happy. This script moves the failure to the
// moment the mistake is made.
//
// Runs as `preinstall`, so it fires on the wrong tool's own install command
// before any lockfile is written.
//
// FAILS OPEN ON PURPOSE. It errors only when it positively identifies a
// non-npm client. If npm_config_user_agent is missing or unrecognised — an
// install run with --ignore-scripts, a host that shells out differently, some
// future tool — it stays quiet and lets the install proceed. A guard that
// blocks a legitimate deploy would be worse than the problem it prevents.

const agent = process.env.npm_config_user_agent ?? "";
const client = agent.split("/")[0].trim().toLowerCase();

const BANNED = {
  pnpm: "pnpm-lock.yaml",
  yarn: "yarn.lock",
  bun: "bun.lockb",
};

if (client in BANNED) {
  const lockfile = BANNED[client];
  console.error(
    [
      "",
      `  This project uses npm. Refusing to install with ${client}.`,
      "",
      `  ${client} would write a ${lockfile} and leave package-lock.json`,
      "  without the change. Vercel builds from whichever lockfile is committed",
      "  and Render runs `npm ci`, so the two would disagree and both deploys",
      "  would fail — with error messages that do not mention the real cause.",
      "",
      "  Use npm instead:",
      "",
      "      npm install <package>          instead of  " + client + " add <package>",
      "      npm install                    instead of  " + client + " install",
      "      npm run dev                    instead of  " + client + " dev",
      "",
      "  See CLAUDE.md.",
      "",
    ].join("\n")
  );
  process.exit(1);
}
