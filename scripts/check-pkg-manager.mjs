// Preinstall guard: this workspace only supports pnpm, and foreign lockfiles
// (package-lock.json / yarn.lock) must not exist in the repo root.
// Written in plain Node so it runs identically on Windows, macOS, and Linux.
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const userAgent = process.env.npm_config_user_agent ?? "";

// Allow pnpm only. Node also sets this var when scripts run via pnpm run.
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead");
  process.exit(1);
}

// Remove lockfiles from other package managers if they snuck in.
for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const lockfilePath = path.resolve(process.cwd(), lockfile);
  if (existsSync(lockfilePath)) {
    rmSync(lockfilePath);
    console.log(`Removed ${lockfile}`);
  }
}
