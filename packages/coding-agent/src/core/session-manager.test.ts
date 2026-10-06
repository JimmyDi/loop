import { spawn } from "node:child_process";
import { once } from "node:events";
import { Readable } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { SessionManager } from "./session-manager";

test("new storage uses one session format and unsupported versions are never rewritten", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".session-format-test-"));
  try {
    const manager = await SessionManager.create(root, root);
    expect(manager.getHeader()).toMatchObject({ version: 2, permissionPreset: "read-only" });
    expect(SessionManager.inMemory(root).getHeader()).toMatchObject({
      version: 2,
      permissionPreset: "read-only",
    });
    expect(SessionManager.draft(root, root).getHeader()).toMatchObject({
      version: 2,
      permissionPreset: "read-only",
    });
    for (const version of [1, 3, undefined]) {
      const contents = JSON.stringify({ ...manager.getHeader(), version });
      await writeFile(manager.sessionFile!, contents);
      await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
        "Unsupported session format or version",
      );
      expect(await readFile(manager.sessionFile!, "utf8")).toBe(contents);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("session discovery skips unsupported formats without rewriting them or hiding current-format errors", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".session-discovery-test-"));
  try {
    const current = await SessionManager.create(root, root);
    const unsupported = join(root, "unsupported.jsonl");
    for (const header of [
      { ...current.getHeader(), version: 1 },
      { ...current.getHeader(), version: 99 },
      { ...current.getHeader(), format: "other-session" },
    ]) {
      const contents = JSON.stringify(header) + "\n";
      await writeFile(unsupported, contents);
      expect((await SessionManager.list(root, root)).map((item) => item.id)).toEqual([
        current.getSessionId(),
      ]);
      expect((await SessionManager.continueRecent(root, root)).getSessionId()).toBe(
        current.getSessionId(),
      );
      await expect(SessionManager.open(unsupported)).rejects.toThrow("Unsupported session format");
      expect(await readFile(unsupported, "utf8")).toBe(contents);
    }
    const malformed = join(root, "malformed.jsonl");
    await writeFile(malformed, "invalid json");
    await expect(SessionManager.list(root, root)).rejects.toThrow();
    await writeFile(malformed, JSON.stringify({ ...current.getHeader(), permissionPreset: null }));
    await expect(SessionManager.list(root, root)).rejects.toThrow("Invalid session metadata");
    await rm(malformed);
    await rm(current.sessionFile!);
    expect(await SessionManager.list(root, root)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runtime snapshots persist with history, survive failed saves and validate on restore", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".context-storage-test-"));
  const storage = join(root, "history");
  try {
    const manager = SessionManager.draft(root, storage);
    await manager.setPermissionPreset("read-only");
    const messages = [{ role: "user" as const, content: "Task", timestamp: 1 }];
    const snapshots = [{ userTurn: 0, content: "Context", timestamp: 1 }];
    await writeFile(storage, "Block directory creation");
    await expect(manager.commit(messages, snapshots)).rejects.toThrow();
    snapshots[0]!.content = "Mutated by caller";
    expect(manager.getRuntimeContexts()[0]?.content).toBe("Context");
    manager.getRuntimeContexts()[0]!.content = "Mutated snapshot";
    expect(manager.getRuntimeContexts()[0]?.content).toBe("Context");
    await rm(storage);
    await manager.flush();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getRuntimeContexts()).toEqual(manager.getRuntimeContexts());
    expect(restored.messages).toEqual(messages);
    await restored.setTitle({ text: "Title", source: "user", messageIndices: [] });
    await restored.commit(messages);
    expect((await SessionManager.open(manager.sessionFile!)).getRuntimeContexts()).toEqual(
      manager.getRuntimeContexts(),
    );

    const header = restored.getHeader();
    const invalid = {
      ...header,
      runtimeContexts: [{ userTurn: 1, content: "Context", timestamp: 1 }],
    };
    await writeFile(
      manager.sessionFile!,
      [invalid, ...messages].map((value) => JSON.stringify(value)).join("\n"),
    );
    await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
      "Invalid session runtime context",
    );
    delete header.runtimeContexts;
    await writeFile(
      manager.sessionFile!,
      [header, ...messages].map((value) => JSON.stringify(value)).join("\n"),
    );
    expect((await SessionManager.open(manager.sessionFile!)).getRuntimeContexts()).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("permission metadata uses version 2, serializes, and fails without publishing new authority", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".permission-storage-test-"));
  const storage = join(root, "storage");
  try {
    const manager = SessionManager.draft(root, storage);
    await manager.setPermissionPreset("read-only");
    expect(await existsSync(manager.sessionFile!)).toBe(false);
    await Promise.all([
      manager.setTitle({ text: "Title", source: "user", messageIndices: [] }),
      manager.commit([{ role: "user", content: "Example", timestamp: 1 }]),
    ]);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader()).toMatchObject({ version: 2, permissionPreset: "read-only" });
    expect(restored.restored).toBe(true);
    const original = await readFile(manager.sessionFile!, "utf8");
    await rm(storage, { recursive: true });
    await writeFile(storage, "block writes");
    await expect(manager.setPermissionPreset("danger-full-access")).rejects.toThrow();
    expect(manager.getHeader().permissionPreset).toBe("read-only");
    await rm(storage);
    await manager.setPermissionPreset("workspace-write");
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().permissionPreset).toBe(
      "workspace-write",
    );
    for (const value of [undefined, "unknown", null, 123]) {
      const lines = original.trim().split("\n");
      const header = { ...JSON.parse(lines[0]!), permissionPreset: value };
      const contents = [JSON.stringify(header), ...lines.slice(1)].join("\n");
      await writeFile(manager.sessionFile!, contents);
      await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
        "Invalid session metadata",
      );
      expect(await readFile(manager.sessionFile!, "utf8")).toBe(contents);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("obsolete section metadata is ignored on restore and omitted from subsequent saves", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".legacy-metadata-test-"));
  try {
    const manager = await SessionManager.create(root, join(root, "history"));
    const messages = [{ role: "user" as const, content: "Request", timestamp: 1000 }];
    await manager.commit(messages);
    const contents =
      [{ ...manager.getHeader(), runTimings: { obsolete: true } }, ...messages]
        .map((value) => JSON.stringify(value))
        .join("\n") + "\n";
    await writeFile(manager.sessionFile!, contents);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.messages).toEqual(messages);
    expect(restored.getHeader()).not.toHaveProperty("runTimings");
    expect(await readFile(manager.sessionFile!, "utf8")).toBe(contents);
    await restored.commit(messages);
    expect(
      JSON.parse((await readFile(manager.sessionFile!, "utf8")).split("\n")[0]!),
    ).not.toHaveProperty("runTimings");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("drafts defer files across metadata changes and persist the first user history with retry", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".draft-storage-test-"));
  try {
    const manager = SessionManager.draft(root, join(root, "history"));
    const id = manager.getSessionId();
    await manager.setModel({ provider: "example", id: "model", effort: "high" });
    await manager.setTitle({ text: "Draft", source: "user", messageIndices: [] });
    await manager.commit([]);
    expect(await existsSync(manager.sessionFile!)).toBe(false);
    expect(await SessionManager.list(root, join(root, "history"))).toEqual([]);
    await writeFile(join(root, "history"), "Block directory creation");
    await expect(
      manager.commit([{ role: "user", content: "First request", timestamp: 1 }]),
    ).rejects.toThrow();
    expect(manager.hasPendingSave).toBe(true);
    await rm(join(root, "history"));
    await manager.flush();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getSessionId()).toBe(id);
    expect(restored.getHeader()).toMatchObject({
      title: { text: "Draft" },
      model: { effort: "high" },
    });
    expect(restored.messages).toEqual([{ role: "user", content: "First request", timestamp: 1 }]);
    expect((await SessionManager.list(root, join(root, "history")))[0]?.userMessageCount).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("empty sessions persist, recent sessions stay within cwd, and a new process restores messages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-store-"));
  const other = await mkdtemp(join(tmpdir(), "loop-other-"));

  try {
    const first = await SessionManager.create(dir, dir);
    const unrelated = await SessionManager.create(other, dir);

    expect((await SessionManager.open(first.sessionFile!)).messages).toEqual([]);
    await first.commit([
      { role: "user", content: "same", timestamp: 1 },
      { role: "user", content: "same", timestamp: 2 },
    ]);
    expect((await SessionManager.continueRecent(dir, dir)).getSessionId()).toBe(
      first.getSessionId(),
    );
    expect((await SessionManager.list(other, dir)).map((item) => item.id)).toEqual([
      unrelated.getSessionId(),
    ]);

    const child = spawnProcess(
      [
        process.execPath,
        "--conditions=loop-source",
        "--import",
        import.meta.resolve("tsx"),
        "-e",
        "const {SessionManager} = await import(process.argv[1]); const m = await SessionManager.continueRecent(process.argv[2], process.argv[2]); console.log(JSON.stringify(m.messages));",
        import.meta.dirname + "/session-manager.ts",
        dir,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = await new Response(child.stdout).text();

    expect(await child.exited).toBe(0);
    expect(JSON.parse(output)).toEqual(first.messages);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

test("invalid versions, records and incomplete tool calls reject without touching the original", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-invalid-"));

  try {
    const manager = await SessionManager.create(dir, dir);
    const header = manager.getHeader();
    const file = manager.sessionFile!;
    const cases = [
      JSON.stringify({ ...header, version: 99 }),
      JSON.stringify(header) + "\n" + JSON.stringify({ role: "custom", timestamp: 0 }),
      JSON.stringify(header) +
        "\n" +
        JSON.stringify({
          role: "toolResult",
          toolCallId: "orphan",
          toolName: "bash",
          isError: false,
          content: [],
          timestamp: 0,
        }),
      JSON.stringify(header) +
        "\n" +
        JSON.stringify({
          role: "assistant",
          model: "test",
          provider: "test",
          api: "openai-completions",
          usage: {},
          stopReason: "toolUse",
          timestamp: 0,
          content: [{ type: "toolCall", id: "unresolved", name: "write", arguments: {} }],
        }),
      "not json",
    ];

    for (const value of cases) {
      await writeFile(file, value);
      await expect(SessionManager.open(file)).rejects.toThrow();
      expect(await readFile(file, "utf8")).toBe(value);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("effort metadata allows the default to be omitted and rejects invalid values without changing storage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-effort-metadata-"));
  try {
    const manager = await SessionManager.create(dir, dir);
    await manager.setModel({ provider: "example", id: "model", effort: "high" });
    const file = manager.sessionFile!;
    const original = await readFile(file, "utf8");
    expect((await SessionManager.open(file)).getHeader().model?.effort).toBe("high");
    await manager.setModel({ provider: "example", id: "model", effort: "default" });
    expect((await SessionManager.open(file)).getHeader().model).toEqual({
      provider: "example",
      id: "model",
    });
    await writeFile(file, original.replace('"effort":"high"', '"effort":"unsupported"'));
    await expect(SessionManager.open(file)).rejects.toThrow("Invalid session metadata");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("title writes serialize with commits and model changes without losing either snapshot", async () => {
  const dir = await mkdtemp(join(import.meta.dirname, ".title-storage-test-"));
  try {
    const manager = await SessionManager.create(dir, dir);
    const title = { text: "Example title", source: "model" as const, messageIndices: [0] };
    const messages = [{ role: "user" as const, content: "Example", timestamp: 0 }];
    await Promise.all([manager.setTitle(title), manager.commit(messages)]);
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().title).toEqual(title);
    await Promise.all([
      manager.setModel({ provider: "example", id: "other" }),
      manager.setTitle({ ...title, text: "Renamed" }),
    ]);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.messages).toEqual(messages);
    expect(restored.getHeader().model?.id).toBe("other");
    expect(restored.getHeader().title?.text).toBe("Renamed");
    let checks = 0;
    expect(await manager.setTitle(title, () => ++checks === 1)).toBe(false);
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().title?.text).toBe(
      "Renamed",
    );
    const original = await readFile(manager.sessionFile!, "utf8");
    await writeFile(
      manager.sessionFile!,
      original.replace('"source":"model"', '"source":"unknown"'),
    );
    await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
      "Invalid session metadata",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("untitled history derives its first user text without modifying storage or replacing explicit titles", async () => {
  const dir = await mkdtemp(join(import.meta.dirname, ".fallback-title-test-"));
  try {
    const manager = await SessionManager.create(dir, dir);
    expect(manager.getHeader().title).toBeUndefined();
    await manager.commit([
      {
        role: "user",
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
        timestamp: 0,
      },
      { role: "user", content: [{ type: "text", text: "First user request" }], timestamp: 1 },
      { role: "user", content: "Later user request", timestamp: 2 },
    ]);
    const original = await readFile(manager.sessionFile!, "utf8");
    expect(JSON.parse(original.split("\n")[0]!).title).toBeUndefined();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader().title).toEqual({
      text: "First user request",
      source: "fallback",
      messageIndices: [1],
    });
    expect((await SessionManager.list(dir, dir))[0]?.title?.text).toBe("First user request");
    expect(await readFile(manager.sessionFile!, "utf8")).toBe(original);
    await restored.setTitle({ text: "Manual name", source: "user", messageIndices: [] });
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().title?.text).toBe(
      "Manual name",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unread belongs to the header and stale receipts cannot clear newer completed output", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".unread-storage-"));
  const user = { role: "user" as const, content: "Example request", timestamp: 0 };
  const reply = {
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "Example reply" }],
    api: "openai-completions" as const,
    provider: "example",
    model: "example",
    stopReason: "stop" as const,
    timestamp: 1,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
  try {
    const manager = SessionManager.draft(root, join(root, "history"));
    expect(manager.getHeader().unread).toBe(false);
    expect(await manager.markRead(2)).toBe(false);
    expect(await existsSync(manager.sessionFile!)).toBe(false);
    await manager.commit([user, reply]);
    const original = await readFile(manager.sessionFile!, "utf8");
    expect(manager.unread).toBe(true);
    for (const turn of [-1, 1.5, Number.NaN])
      await expect(manager.markRead(turn)).rejects.toThrow("Invalid read message count");
    expect(await manager.markRead(4)).toBe(false);
    await Promise.all([
      manager.markRead(2),
      manager.setTitle({ text: "Renamed", source: "user", messageIndices: [] }),
      manager.setModel({ provider: "example", id: "other" }),
    ]);
    expect(manager.getHeader()).toMatchObject({
      unread: false,
      title: { text: "Renamed" },
      model: { id: "other" },
    });
    await manager.commit([user, reply]);
    expect(manager.unread).toBe(false);
    await manager.commit([user, reply, user, reply]);
    expect(await manager.markRead(2)).toBe(false);
    expect(manager.unread).toBe(true);
    const beforeRead = manager.getHeader();
    expect(await manager.markRead(4)).toBe(true);
    expect(await manager.markRead(4)).toBe(true);
    expect(manager.getHeader()).toEqual({ ...beforeRead, unread: false });
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.unread).toBe(false);
    expect(restored.messages).toEqual([user, reply, user, reply]);
    // A new failed run containing only its user message must not create unread output.
    await restored.commit([user, reply, user, reply, user]);
    expect(restored.unread).toBe(false);
    const lines = original.trim().split("\n");
    for (const unread of ["true", 1, null]) {
      await writeFile(
        manager.sessionFile!,
        [JSON.stringify({ ...JSON.parse(lines[0]!), unread }), ...lines.slice(1)].join("\n"),
      );
      await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
        "Invalid session metadata",
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("read writes serialize with commits and failed saves retain unread for retry", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".unread-race-"));
  const storage = join(root, "history");
  const user = { role: "user" as const, content: "Example", timestamp: 0 };
  const reply = {
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "Reply" }],
    api: "openai-completions" as const,
    provider: "example",
    model: "example",
    stopReason: "stop" as const,
    timestamp: 1,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
  };
  try {
    const manager = SessionManager.draft(root, storage);
    await manager.commit([user, reply]);
    // Let the receipt start writing before a newer commit is prepared.
    const reading = manager.markRead(2);
    await Promise.resolve();
    await Promise.all([reading, manager.commit([user, reply, user, reply])]);
    expect(manager.unread).toBe(true);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(true);
    // Re-saving the same history must also preserve a concurrent successful read.
    const readingLatest = manager.markRead(4);
    await Promise.resolve();
    await Promise.all([readingLatest, manager.commit(manager.messages)]);
    expect(manager.unread).toBe(false);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(false);
    await rm(storage, { recursive: true });
    await writeFile(storage, "Block writes");
    await expect(manager.commit([user, reply, user, reply, user, reply])).rejects.toThrow();
    expect(manager.unread).toBe(true);
    await expect(manager.markRead(6)).rejects.toThrow("Pending session save");
    await rm(storage);
    await manager.flush();
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(true);
    await rm(storage, { recursive: true });
    await writeFile(storage, "Block receipt");
    await expect(manager.markRead(6)).rejects.toThrow();
    expect(manager.unread).toBe(true);
    await rm(storage);
    expect(await manager.markRead(6)).toBe(true);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pin metadata persists in the header without changing history or activity", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".pin-storage-"));
  try {
    const manager = SessionManager.draft(root, join(root, "history"));
    expect(manager.getHeader().pinnedAt).toBeUndefined();
    const pinnedAt = await manager.setPinned(true);
    expect(pinnedAt).toBe(new Date(pinnedAt!).toISOString());
    expect(await manager.setPinned(true)).toBe(pinnedAt);
    expect(await existsSync(manager.sessionFile!)).toBe(false);
    await manager.commit([{ role: "user", content: "Example", timestamp: 1 }]);
    const before = await readFile(manager.sessionFile!, "utf8");
    const header = manager.getHeader();
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().pinnedAt).toBe(pinnedAt);
    expect((await SessionManager.list(root, join(root, "history")))[0]?.pinnedAt).toBe(pinnedAt);
    expect(await manager.setPinned(false)).toBeUndefined();
    const after = await readFile(manager.sessionFile!, "utf8");
    const { pinnedAt: _pin, ...unpinnedHeader } = JSON.parse(before.split("\n")[0]!);
    expect(JSON.parse(after.split("\n")[0]!)).toEqual(unpinnedHeader);
    expect(after.split("\n").slice(1)).toEqual(before.split("\n").slice(1));
    expect(await manager.setPinned(false)).toBeUndefined();
    for (const invalid of [
      null,
      true,
      1,
      "",
      "invalid",
      "2026-02-30T00:00:00.000Z",
      "2026-01-01",
    ]) {
      await writeFile(
        manager.sessionFile!,
        [JSON.stringify({ ...header, pinnedAt: invalid }), ...after.split("\n").slice(1)].join(
          "\n",
        ),
      );
      await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
        "Invalid session metadata",
      );
    }
    await expect(manager.setPinned("true" as unknown as boolean)).rejects.toThrow(
      "Invalid pinned state",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pin writes serialize with history and metadata; failed pin and history saves remain recoverable", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".pin-race-"));
  const storage = join(root, "history");
  const user = { role: "user" as const, content: "Example", timestamp: 1 };
  try {
    const manager = await SessionManager.create(root, storage);
    await manager.commit([user]);
    const pinning = manager.setPinned(true);
    await Promise.resolve();
    await Promise.all([pinning, manager.commit([user, user])]);
    const pinnedAt = await pinning;
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().pinnedAt).toBe(pinnedAt);
    const unpinning = manager.setPinned(false);
    await Promise.resolve();
    await Promise.all([unpinning, manager.commit([user, user, user])]);
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().pinnedAt).toBeUndefined();
    await Promise.all([
      manager.commit([user]),
      manager.setPinned(true),
      manager.setTitle({ text: "Manual title", source: "user", messageIndices: [] }),
      manager.markRead(1),
    ]);
    const accepted = manager.getHeader().pinnedAt;
    expect((await SessionManager.open(manager.sessionFile!)).getHeader()).toMatchObject({
      pinnedAt: accepted,
      title: { text: "Manual title" },
    });
    await rm(storage, { recursive: true });
    await writeFile(storage, "Block writes");
    await expect(manager.setPinned(false)).rejects.toThrow();
    expect(manager.getHeader().pinnedAt).toBe(accepted);
    await expect(manager.commit([user, user])).rejects.toThrow();
    expect(manager.hasPendingSave).toBe(true);
    await rm(storage);
    await manager.setPinned(false);
    expect(manager.hasPendingSave).toBe(true);
    expect(manager.messages).toEqual([user, user]);
    await manager.flush();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader().pinnedAt).toBeUndefined();
    expect(restored.messages).toEqual([user, user]);
    expect(manager.hasPendingSave).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

const spawnProcess = (
  argv: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdin?: string;
    stdout?: string;
    stderr?: string;
  } = {},
) => {
  const child = spawn(argv[0]!, argv.slice(1), {
    cwd: options.cwd,
    env: options.env,
    stdio: [options.stdin === "pipe" ? "pipe" : "ignore", "pipe", "pipe"],
  });
  const exited = once(child, "close").then(
    ([code, signal]) => code ?? (signal === "SIGINT" ? 130 : 143),
  );
  return {
    exited,
    get exitCode() {
      return child.exitCode;
    },
    kill: (signal?: NodeJS.Signals) => child.kill(signal),
    stdout: Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>,
    stderr: Readable.toWeb(child.stderr!) as ReadableStream<Uint8Array>,
    stdin: { write: (text: string) => child.stdin!.write(text), flush: async () => {} },
  };
};

test("prompt timings retain the original snapshot through save retry and validate on restore", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".prompt-timings-test-"));
  const storage = join(root, "history");
  try {
    const manager = SessionManager.draft(root, storage);
    const messages = [{ role: "user" as const, content: "Request", timestamp: 1000 }];
    const timings = [{ userMessageIndex: 0, startedAt: 1000, finishedAt: 30000 }];
    await writeFile(storage, "Block storage");
    await expect(manager.commit(messages, [], timings)).rejects.toThrow();
    timings[0]!.finishedAt = 90000;
    expect(manager.getPromptTimings()[0]?.finishedAt).toBe(30000);
    manager.getPromptTimings()[0]!.finishedAt = 50000;
    expect(manager.getPromptTimings()[0]?.finishedAt).toBe(30000);
    await rm(storage);
    await manager.flush();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getPromptTimings()).toEqual(manager.getPromptTimings());
    await restored.commit(messages);
    expect((await SessionManager.open(manager.sessionFile!)).getPromptTimings()).toEqual(
      manager.getPromptTimings(),
    );
    const header = {
      ...restored.getHeader(),
      promptTimings: [{ ...timings[0], userMessageIndex: 2 }],
    };
    await writeFile(
      manager.sessionFile!,
      [header, ...messages].map((entry) => JSON.stringify(entry)).join("\n"),
    );
    await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
      "Invalid prompt timings",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
