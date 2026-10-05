import { join } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { SessionArchive } from "./session-archive";
import { SessionManager } from "./session-manager";

test("archive membership persists independently of history, serializes updates and restores", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".archive-test-"));
  try {
    const manager = await SessionManager.create(root, root);
    const id = manager.getSessionId();
    const other = crypto.randomUUID();
    const history = await readFile(manager.sessionFile!, "utf8");
    const archive = new SessionArchive(root);
    expect(await archive.list()).toEqual(new Set());
    await Promise.all([archive.set([id], true), archive.set([other], true)]);
    expect(await new SessionArchive(root).list()).toEqual(new Set([id, other]));
    expect(await readFile(manager.sessionFile!, "utf8")).toBe(history);
    expect((await SessionManager.list(root, root)).map((session) => session.id)).toEqual([id]);
    await archive.set([id], false);
    expect(await new SessionArchive(root).list()).toEqual(new Set([other]));
    expect(await readFile(manager.sessionFile!, "utf8")).toBe(history);
    await expect(archive.set(["../invalid"], true)).rejects.toThrow("Invalid archived");
    await archive.set([other], false);
    expect(await archive.list()).toEqual(new Set());
    await writeFile(join(root, "archive.json"), "{}");
    await expect(archive.set([id], true)).rejects.toThrow("Invalid session archive");
    expect(await readFile(join(root, "archive.json"), "utf8")).toBe("{}");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deleting only confirmed archived history preserves other sessions and project files", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".archive-delete-test-"));
  try {
    const managers = await Promise.all([0, 1, 2].map(() => SessionManager.create(root, root)));
    const ids = managers.map((manager) => manager.getSessionId());
    const archive = new SessionArchive(root);
    await writeFile(join(root, "example.txt"), "Project source");
    await archive.set(ids.slice(0, 2), true);
    await expect(archive.delete(root, [ids[0]!, ids[2]!])).rejects.toThrow(
      "Session is not archived",
    );
    expect(await existsSync(managers[0]!.sessionFile!)).toBe(true);
    await archive.delete(root, [ids[0]!, ids[0]!]);
    expect(await existsSync(managers[0]!.sessionFile!)).toBe(false);
    expect(await existsSync(managers[1]!.sessionFile!)).toBe(true);
    expect(await existsSync(managers[2]!.sessionFile!)).toBe(true);
    expect(await new SessionArchive(root).list()).toEqual(new Set([ids[1]!]));
    expect(await readFile(join(root, "example.txt"), "utf8")).toBe("Project source");
    await expect(
      archive.delete(root, [ids[2]!, "unknown"], { archivedOnly: false }),
    ).rejects.toThrow("Session not found in project");
    expect(await existsSync(managers[2]!.sessionFile!)).toBe(true);
    await archive.delete(root, [ids[2]!], { archivedOnly: false });
    expect(await existsSync(managers[2]!.sessionFile!)).toBe(false);
    expect(await archive.list()).toEqual(new Set([ids[1]!]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("delete restores staged history when updating archive metadata fails", async () => {
  const { mkdir } = await import("node:fs/promises");
  const root = await mkdtemp(join(import.meta.dirname, ".archive-rollback-test-"));
  try {
    const session = await SessionManager.create(root, root);
    const archive = new SessionArchive(root);
    const id = session.getSessionId();
    await archive.set([id], true);
    const original = SessionManager.list;
    SessionManager.list = async (...args) => {
      const records = await original(...args);
      await rm(join(root, "archive.json"));
      await mkdir(join(root, "archive.json"));
      return records;
    };
    try {
      await expect(archive.delete(root, [id])).rejects.toThrow();
    } finally {
      SessionManager.list = original;
    }
    expect(await existsSync(session.sessionFile!)).toBe(true);
    expect((await SessionManager.open(session.sessionFile!)).getSessionId()).toBe(id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
