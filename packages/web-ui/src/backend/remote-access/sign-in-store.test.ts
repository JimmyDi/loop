import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { SignInStore } from "./sign-in-store";

test("sign-in survives a new store, clears in order and never stores credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-sign-in-"));
  const file = join(directory, "sign-in.json");
  const store = new SignInStore(file);
  try {
    expect(await store.read()).toBe(false);
    await store.save(true);
    expect(await new SignInStore(file).read()).toBe(true);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ version: 1, signedIn: true });
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    await Promise.all([store.save(false), store.save(true), store.save(false)]);
    expect(await new SignInStore(file).read()).toBe(false);
    expect(await readdir(directory)).toEqual(["sign-in.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing, malformed and unsupported state starts unconfirmed without exposing content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-sign-in-"));
  const file = join(directory, "sign-in.json");
  const store = new SignInStore(file);
  try {
    for (const content of [
      "invalid json",
      "null",
      "[]",
      '{"version":2,"signedIn":true}',
      '{"version":1,"signedIn":"true"}',
      '{"version":1,"signedIn":true,"unexpected":true}',
    ]) {
      await writeFile(file, content);
      expect(await store.read()).toBe(false);
    }
    expect(await new SignInStore(directory).read()).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed writes are sanitized and a later save can recover without temporary files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-sign-in-"));
  const blocked = join(directory, "blocked");
  const store = new SignInStore(join(blocked, "sign-in.json"));
  try {
    await writeFile(blocked, "synthetic obstruction");
    await expect(store.save(true)).rejects.toMatchObject({ message: "sign_in_state_failed" });
    expect(await store.read()).toBe(false);
    await rm(blocked);
    await store.save(true);
    expect(await store.read()).toBe(true);
    expect(await readdir(blocked)).toEqual(["sign-in.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
