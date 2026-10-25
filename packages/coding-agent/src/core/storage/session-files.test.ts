import { appendFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";

import { SessionManager } from "../session-manager";

test("split storage pages UTF-8 rounds, appends without rewriting and rebuilds its index", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".history-test-"));
  try {
    const manager = await SessionManager.create(root, root);
    const directory = dirname(manager.sessionFile!);
    expect((await readdir(directory)).sort()).toEqual([
      "index.json",
      "messages.jsonl",
      "meta.json",
    ]);
    const messages = Array.from({ length: 8 }, (_, timestamp) => ({
      role: "user" as const,
      content: "测试 🌍 " + timestamp,
      timestamp,
    }));
    await manager.commit(messages);
    const original = await readFile(join(directory, "messages.jsonl"), "utf8");
    const latest = await manager.readHistory();
    expect(latest).toMatchObject({ start: 5, end: 8, total: 8, messages: messages.slice(5) });
    expect((await manager.readHistory(0)).messages).toEqual([]);
    const earlier = await manager.readHistory(latest.start, latest.revision);
    expect(earlier).toMatchObject({ start: 2, end: 5, messages: messages.slice(2, 5) });
    expect((await manager.readHistory(earlier.start)).messages).toEqual(messages.slice(0, 2));
    await manager.setTitle({
      text: "A longer synthetic title",
      source: "user",
      messageIndices: [],
    });
    expect(await readFile(join(directory, "messages.jsonl"), "utf8")).toBe(original);
    await appendFile(join(directory, "messages.jsonl"), '{"incomplete":');
    expect((await SessionManager.open(manager.sessionFile!)).messages).toEqual(messages);
    const next = { role: "user" as const, content: "Next", timestamp: 9 };
    await manager.commit([...messages, next]);
    expect(await readFile(join(directory, "messages.jsonl"), "utf8")).toBe(
      original + JSON.stringify(next) + "\n",
    );
    await expect(manager.readHistory(5, latest.revision)).rejects.toThrow("history changed");
    await rm(join(directory, "index.json"));
    expect((await manager.readHistory()).messages).toEqual([...messages.slice(6), next]);
    expect(JSON.parse(await readFile(join(directory, "index.json"), "utf8")).entries).toHaveLength(
      9,
    );
    await writeFile(join(directory, "index.json"), "invalid");
    expect((await manager.readHistory(3)).messages).toEqual(messages.slice(0, 3));
    await manager.commit(messages.slice(0, 2));
    expect((await SessionManager.open(manager.sessionFile!)).messages).toEqual(
      messages.slice(0, 2),
    );
    expect((await manager.readHistory()).messages).toEqual(messages.slice(0, 2));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy sessions migrate only on explicit open and retain their original backup", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".migration-test-"));
  try {
    const memory = SessionManager.inMemory(root);
    const legacy = join(root, memory.getSessionId() + ".jsonl");
    const messages = [{ role: "user" as const, content: "Synthetic request", timestamp: 1 }];
    const source =
      [memory.getHeader(), ...messages].map((row) => JSON.stringify(row)).join("\n") + "\n";
    await writeFile(legacy, source);
    expect(await readdir(root)).toEqual([memory.getSessionId() + ".jsonl"]);
    expect(await SessionManager.list(root, root)).toHaveLength(1);
    expect(await readdir(root)).toHaveLength(1);
    const manager = await SessionManager.open(legacy);
    expect(manager.sessionFile).toBe(join(root, memory.getSessionId(), "meta.json"));
    expect(manager.messages).toEqual(messages);
    expect(await readFile(legacy, "utf8")).toBe(source);
    expect(await SessionManager.list(root, root)).toHaveLength(1);
    expect((await SessionManager.open(legacy)).messages).toEqual(messages);
    await rm(manager.sessionFile!);
    await expect(SessionManager.open(legacy)).rejects.toThrow();
    await writeFile(manager.sessionFile!, "invalid");
    await expect(SessionManager.open(legacy)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
