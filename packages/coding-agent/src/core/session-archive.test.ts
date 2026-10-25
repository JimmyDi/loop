import { dirname, join } from "node:path";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import { TraceRecorder } from "@loop/telemetry";

import { SessionArchive } from "./session-archive";
import { SessionManager } from "./session-manager";
import { getSessionDir, getTraceDir } from "../config";

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
    const traceDir = join(root, "traces");
    const archive = new SessionArchive(root, traceDir);
    const id = session.getSessionId();
    const directory = dirname(session.sessionFile!);
    const files = ["meta.json", "messages.jsonl", "index.json"];
    const saved = await Promise.all(files.map((name) => readFile(join(directory, name), "utf8")));
    const legacy = join(root, id + ".jsonl");
    const backup = JSON.stringify(session.getHeader()) + "\n";
    await writeFile(legacy, backup);
    const recorder = await TraceRecorder.open(join(traceDir, id), id);
    recorder.record({ type: "synthetic.event" });
    await recorder.close();
    const history = await readFile(join(traceDir, id, "events-000001.jsonl"), "utf8");
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
    expect(await Promise.all(files.map((name) => readFile(join(directory, name), "utf8")))).toEqual(
      saved,
    );
    expect(await readFile(legacy, "utf8")).toBe(backup);
    expect((await readdir(root)).some((name) => name.startsWith(".delete-"))).toBe(false);
    expect(await readFile(join(traceDir, id, "events-000001.jsonl"), "utf8")).toBe(history);
    expect(existsSync(join(traceDir, id, "writer.lock"))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("managed session deletion removes trace payloads while archiving and other sessions preserve them", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".archive-trace-test-"));
  try {
    const sessionDir = getSessionDir(root, root);
    const traceDir = getTraceDir(root, root);
    const sessions = await Promise.all(
      [0, 1, 2].map(() => SessionManager.create(root, sessionDir)),
    );
    const ids = sessions.map((session) => session.getSessionId());
    for (const id of ids.slice(0, 2)) {
      const trace = await TraceRecorder.open(join(traceDir, id), id);
      trace.record({ type: "synthetic.event", data: { text: "x".repeat(20000) } });
      await trace.close();
    }
    const archive = new SessionArchive(sessionDir);
    const original = await readFile(join(traceDir, ids[0]!, "manifest.json"), "utf8");
    await archive.set([ids[0]!], true);
    await archive.set([ids[0]!], false);
    expect(await readFile(join(traceDir, ids[0]!, "manifest.json"), "utf8")).toBe(original);
    await archive.delete(root, [ids[0]!], { archivedOnly: false });
    expect(existsSync(sessions[0]!.sessionFile!)).toBe(false);
    expect(existsSync(join(traceDir, ids[0]!))).toBe(false);
    expect(existsSync(join(traceDir, ids[1]!, "payloads"))).toBe(true);
    await archive.set([ids[1]!], true);
    await archive.delete(root, [ids[1]!]);
    expect(existsSync(join(traceDir, ids[1]!))).toBe(false);
    await archive.delete(root, [ids[2]!], { archivedOnly: false });
    expect(existsSync(sessions[2]!.sessionFile!)).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("active trace writers block deletion and restore earlier staged history and logs", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".archive-trace-busy-test-"));
  let active: TraceRecorder | undefined;
  try {
    const sessionDir = getSessionDir(root, root);
    const traceDir = getTraceDir(root, root);
    const first = await SessionManager.create(root, sessionDir);
    const second = await SessionManager.create(root, sessionDir);
    const firstId = first.getSessionId();
    const secondId = second.getSessionId();
    const closed = await TraceRecorder.open(join(traceDir, firstId), firstId);
    closed.record({ type: "synthetic.event" });
    await closed.close();
    active = await TraceRecorder.open(join(traceDir, secondId), secondId);
    const archive = new SessionArchive(sessionDir);
    await archive.set([firstId, secondId], true);
    await expect(archive.delete(root, [firstId, secondId])).rejects.toThrow(
      "Trace already has a writer",
    );
    expect(existsSync(first.sessionFile!)).toBe(true);
    expect(existsSync(second.sessionFile!)).toBe(true);
    expect(existsSync(join(traceDir, firstId, "events-000001.jsonl"))).toBe(true);
    expect(existsSync(join(traceDir, firstId, "writer.lock"))).toBe(false);
    expect(await archive.list()).toEqual(new Set([firstId, secondId]));
    await active.close();
    await archive.delete(root, [firstId, secondId]);
    expect(existsSync(join(traceDir, secondId))).toBe(false);
  } finally {
    await active?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("archive and restore preserve all split files across subsequent history saves", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".archive-split-test-"));
  try {
    const manager = await SessionManager.create(root, root);
    const id = manager.getSessionId();
    const directory = dirname(manager.sessionFile!);
    const archive = new SessionArchive(root);
    const files = ["meta.json", "messages.jsonl", "index.json"];
    const before = await Promise.all(files.map((name) => readFile(join(directory, name), "utf8")));
    await archive.set([id], true);
    expect(await Promise.all(files.map((name) => readFile(join(directory, name), "utf8")))).toEqual(
      before,
    );
    const messages = [{ role: "user" as const, content: "Synthetic request", timestamp: 1 }];
    await manager.commit(messages);
    expect(await archive.list()).toEqual(new Set([id]));
    const saved = await Promise.all(files.map((name) => readFile(join(directory, name), "utf8")));
    await archive.set([id], false);
    expect(await archive.list()).toEqual(new Set());
    expect(await Promise.all(files.map((name) => readFile(join(directory, name), "utf8")))).toEqual(
      saved,
    );
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.messages).toEqual(messages);
    expect((await restored.readHistory()).messages).toEqual(messages);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deletion removes split directories and migration backups without resurrecting legacy history", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".archive-migrated-test-"));
  try {
    for (const archivedOnly of [true, false]) {
      const memory = SessionManager.inMemory(root);
      const id = memory.getSessionId();
      const legacy = join(root, id + ".jsonl");
      const messages = [{ role: "user" as const, content: "Synthetic request", timestamp: 1 }];
      await writeFile(
        legacy,
        [memory.getHeader(), ...messages].map((row) => JSON.stringify(row)).join("\n") + "\n",
      );
      const manager = await SessionManager.open(legacy);
      const directory = dirname(manager.sessionFile!);
      expect((await readdir(directory)).sort()).toEqual([
        "index.json",
        "messages.jsonl",
        "meta.json",
      ]);
      const archive = new SessionArchive(root);
      if (archivedOnly) await archive.set([id], true);
      await archive.delete(root, [id], { archivedOnly });
      expect(existsSync(directory)).toBe(false);
      expect(existsSync(legacy)).toBe(false);
      expect(await archive.list()).toEqual(new Set());
      expect(await SessionManager.list(root, root)).toEqual([]);
      expect((await readdir(root)).some((name) => name.startsWith(".delete-"))).toBe(false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
