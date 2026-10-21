import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { ConnectionStore } from "./connection-store";

test("reconnect preference survives restart, serializes writes and stores no host metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-connection-"));
  const file = join(directory, "connection.json");
  const store = new ConnectionStore(file);
  try {
    expect(await store.read()).toBe(false);
    await store.save(true);
    expect(await new ConnectionStore(file).read()).toBe(true);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ version: 1, enabled: true });
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    await Promise.all([store.save(false), store.save(true), store.save(false)]);
    expect(await store.read()).toBe(false);
    expect(await readdir(directory)).toEqual(["connection.json"]);
    for (const content of [
      "invalid json",
      "null",
      "[]",
      '{"version":2,"enabled":true}',
      '{"version":1,"enabled":"true"}',
      '{"version":1,"enabled":true,"url":"https://example.com"}',
    ]) {
      await writeFile(file, content);
      expect(await store.read()).toBe(false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("failed preference writes expose a fixed code and can recover", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-connection-"));
  const blocked = join(directory, "blocked");
  const store = new ConnectionStore(join(blocked, "connection.json"));
  try {
    await writeFile(blocked, "synthetic obstruction");
    await expect(store.save(true)).rejects.toMatchObject({ code: "connection_state_failed" });
    await rm(blocked);
    await store.save(true);
    expect(await store.read()).toBe(true);
    expect(await readdir(blocked)).toEqual(["connection.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
