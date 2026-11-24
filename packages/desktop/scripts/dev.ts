import { spawn } from "node:child_process";
import { once } from "node:events";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

try {
  loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run through pnpm desktop:dev");
const child = spawn(
  process.execPath,
  [
    pnpm,
    "tauri",
    "dev",
    "--config",
    ".tools/tauri-build.json",
    "--config",
    JSON.stringify({
      plugins: { updater: { pubkey: "", endpoints: [] } },
    }),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, LOOP_DESKTOP_DEV: "1" },
  },
);
process.exitCode = (await once(child, "exit"))[0] ?? 1;
