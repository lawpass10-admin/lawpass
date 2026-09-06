import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project. The parent directory is a
  // separate, stale checkout that still carries its own pnpm-workspace.yaml and
  // pnpm-lock.yaml; without this pin Turbopack walks up, finds them, and treats
  // that folder as the workspace root. This project itself uses npm — see
  // CLAUDE.md — and has no pnpm files of its own.
  turbopack: {
    root: here,
  },
};

export default nextConfig;
