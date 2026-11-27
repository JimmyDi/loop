import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

import { ensureDesktopIcons } from "./desktop-icons";

try {
  loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run through pnpm desktop:dev");
const desktop = resolve(import.meta.dirname, "..");
await ensureDesktopIcons(desktop, pnpm);
execFileSync(process.execPath, [pnpm, "--filter", "@loop/web-ui", "build:frontend"], {
  cwd: resolve(desktop, "../.."),
  stdio: "inherit",
});

const child = spawn(
  process.execPath,
  [
    pnpm,
    "tauri",
    "dev",
    "--no-dev-server",
    "--config",
    JSON.stringify({
      bundle: { resources: [] },
    }),
  ],
  {
    stdio: "inherit",
    cwd: desktop,
    env: { ...process.env, LOOP_DESKTOP_DEV_NODE: process.execPath },
  },
);
process.exitCode = (await once(child, "exit"))[0] ?? 1;
