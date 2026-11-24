import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const desktop = resolve(import.meta.dirname, "..");
const release = join(desktop, "src-tauri/target/release");
const data = await mkdtemp(join(desktop, ".tools/app-smoke-"));
const executable =
  process.platform === "darwin"
    ? join(release, "bundle/macos/Loop.app/Contents/MacOS/loop-desktop")
    : join(release, "loop-desktop.exe");
try {
  await promisify(execFile)(executable, ["--smoke-test"], {
    env: { ...process.env, LOOP_DESKTOP_SMOKE_DIR: data },
    timeout: 90_000,
    windowsHide: true,
  });
  assert.equal(await readFile(join(data, "passed"), "utf8"), "desktop-ready");
  console.log("Native application initialization, bundled backend and shutdown passed");
} finally {
  await rm(data, { recursive: true, force: true });
}
