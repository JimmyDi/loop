import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { acquireResourceLock } from "./lock";

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-voice-lock-"));
  directories.push(root);
  return root;
};

test("refuses a live owner until its idempotent release", async () => {
  const root = await fixture();
  const release = acquireResourceLock(root);
  expect(() => acquireResourceLock(root)).toThrow("voice_resources_busy");
  release();
  release();
  acquireResourceLock(root)();
});

test("recovers only an owner whose PID is confirmed absent", async () => {
  const root = await fixture();
  const directory = join(root, ".resource-lock");
  await mkdir(directory);
  await writeFile(join(directory, "owner-2147483647-" + crypto.randomUUID()), "");
  vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("absent"), { code: "ESRCH" });
  });
  const release = acquireResourceLock(root);
  release();
});

test("preserves uncertain lock ownership instead of deleting it", async () => {
  const root = await fixture();
  const directory = join(root, ".resource-lock");
  await mkdir(directory);
  await writeFile(join(directory, "owner-2147483647-" + crypto.randomUUID()), "");
  vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("not permitted"), { code: "EPERM" });
  });
  expect(() => acquireResourceLock(root)).toThrow("voice_resources_busy");
});
