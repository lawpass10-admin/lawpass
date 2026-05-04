import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project so it doesn't pick up the
  // parent repo's pnpm-workspace.yaml when run from a git worktree.
  turbopack: {
    root: here,
  },
};

export default nextConfig;
