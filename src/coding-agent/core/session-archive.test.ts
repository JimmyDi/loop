import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";

import { SessionArchive } from "./session-archive";
import { SessionManager } from "./session-manager";

test("archive membership persists independently of history, serializes updates and restores", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".archive-test-"));
  try {
    const manager = await SessionManager.create(root, root);
    const id = manager.getSessionId();
    const other = crypto.randomUUID();
    const history = await Bun.file(manager.sessionFile!).text();
    const archive = new SessionArchive(root);
    expect(await archive.list()).toEqual(new Set());
    await Promise.all([archive.set([id], true), archive.set([other], true)]);
    expect(await new SessionArchive(root).list()).toEqual(new Set([id, other]));
    expect(await Bun.file(manager.sessionFile!).text()).toBe(history);
    expect((await SessionManager.list(root, root)).map((session) => session.id)).toEqual([id]);
    await archive.set([id], false);
    expect(await new SessionArchive(root).list()).toEqual(new Set([other]));
    expect(await Bun.file(manager.sessionFile!).text()).toBe(history);
    await expect(archive.set(["../invalid"], true)).rejects.toThrow("Invalid archived");
    await archive.set([other], false);
    expect(await archive.list()).toEqual(new Set());
    await Bun.write(join(root, "archive.json"), "{}");
    await expect(archive.set([id], true)).rejects.toThrow("Invalid session archive");
    expect(await Bun.file(join(root, "archive.json")).text()).toBe("{}");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deleting only confirmed archived history preserves other sessions and project files", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".archive-delete-test-"));
  try {
    const managers = await Promise.all([0, 1, 2].map(() => SessionManager.create(root, root)));
    const ids = managers.map((manager) => manager.getSessionId());
    const archive = new SessionArchive(root);
    await Bun.write(join(root, "example.txt"), "Project source");
    await archive.set(ids.slice(0, 2), true);
    await expect(archive.delete(root, [ids[0]!, ids[2]!])).rejects.toThrow(
      "Session is not archived",
    );
    expect(await Bun.file(managers[0]!.sessionFile!).exists()).toBe(true);
    await archive.delete(root, [ids[0]!, ids[0]!]);
    expect(await Bun.file(managers[0]!.sessionFile!).exists()).toBe(false);
    expect(await Bun.file(managers[1]!.sessionFile!).exists()).toBe(true);
    expect(await Bun.file(managers[2]!.sessionFile!).exists()).toBe(true);
    expect(await new SessionArchive(root).list()).toEqual(new Set([ids[1]!]));
    expect(await Bun.file(join(root, "example.txt")).text()).toBe("Project source");
    await expect(
      archive.delete(root, [ids[2]!, "unknown"], { archivedOnly: false }),
    ).rejects.toThrow("Session not found in project");
    expect(await Bun.file(managers[2]!.sessionFile!).exists()).toBe(true);
    await archive.delete(root, [ids[2]!], { archivedOnly: false });
    expect(await Bun.file(managers[2]!.sessionFile!).exists()).toBe(false);
    expect(await archive.list()).toEqual(new Set([ids[1]!]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("delete restores staged history when updating archive metadata fails", async () => {
  const { mkdir } = await import("node:fs/promises");
  const root = await mkdtemp(join(import.meta.dir, ".archive-rollback-test-"));
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
    expect(await Bun.file(session.sessionFile!).exists()).toBe(true);
    expect((await SessionManager.open(session.sessionFile!)).getSessionId()).toBe(id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
