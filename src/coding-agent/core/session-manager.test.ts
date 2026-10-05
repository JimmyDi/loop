import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "./session-manager";

test("runtime snapshots persist with history, survive failed saves and validate on restore", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".context-storage-test-"));
  const storage = join(root, "history");
  try {
    const manager = SessionManager.draft(root, storage);
    await manager.setPermissionPreset("read-only");
    const messages = [{ role: "user" as const, content: "Task", timestamp: 1 }];
    const snapshots = [{ userTurn: 0, content: "Context", timestamp: 1 }];
    await Bun.write(storage, "Block directory creation");
    await expect(manager.commit(messages, [], snapshots)).rejects.toThrow();
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
    await Bun.write(
      manager.sessionFile!,
      [invalid, ...messages].map((value) => JSON.stringify(value)).join("\n"),
    );
    await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
      "Invalid session runtime context",
    );
    delete header.runtimeContexts;
    await Bun.write(
      manager.sessionFile!,
      [header, ...messages].map((value) => JSON.stringify(value)).join("\n"),
    );
    expect((await SessionManager.open(manager.sessionFile!)).getRuntimeContexts()).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("permission metadata uses version 2, serializes, and fails without publishing new authority", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".permission-storage-test-"));
  const storage = join(root, "storage");
  try {
    const manager = SessionManager.draft(root, storage);
    await manager.setPermissionPreset("read-only");
    expect(await Bun.file(manager.sessionFile!).exists()).toBe(false);
    await Promise.all([
      manager.setTitle({ text: "Title", source: "user", messageIndices: [] }),
      manager.commit([{ role: "user", content: "Example", timestamp: 1 }]),
    ]);
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader()).toMatchObject({ version: 2, permissionPreset: "read-only" });
    expect(restored.restored).toBe(true);
    const original = await Bun.file(manager.sessionFile!).text();
    await rm(storage, { recursive: true });
    await Bun.write(storage, "block writes");
    await expect(manager.setPermissionPreset("danger-full-access")).rejects.toThrow();
    expect(manager.getHeader().permissionPreset).toBe("read-only");
    await rm(storage);
    await manager.setPermissionPreset("workspace-write");
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().permissionPreset).toBe(
      "workspace-write",
    );
    for (const value of ["unknown", null, 123]) {
      const lines = original.trim().split("\n");
      const header = { ...JSON.parse(lines[0]!), permissionPreset: value };
      const contents = [JSON.stringify(header), ...lines.slice(1)].join("\n");
      await Bun.write(manager.sessionFile!, contents);
      await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
        "Invalid session metadata",
      );
      expect(await Bun.file(manager.sessionFile!).text()).toBe(contents);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("timing is saved with history, survives failed saves and accepts legacy files", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".timing-storage-test-"));
  try {
    const manager = SessionManager.draft(root, join(root, "history"));
    const messages = [{ role: "user" as const, content: "Request", timestamp: 1000 }];
    const timings = [{ userMessageIndex: 0, startedAt: 1000, finishedAt: 2000 }];
    await Bun.write(join(root, "history"), "Block storage");
    await expect(manager.commit(messages, timings)).rejects.toThrow();
    expect(manager.getRunTimings()).toEqual(timings);
    timings[0]!.finishedAt = 9999;
    expect(manager.getRunTimings()[0]?.finishedAt).toBe(2000);
    await rm(join(root, "history"));
    await manager.flush();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getRunTimings()[0]?.finishedAt).toBe(2000);
    await restored.setTitle({ text: "Renamed", source: "user", messageIndices: [] });
    await restored.setModel({ provider: "example", id: "example" });
    expect((await SessionManager.open(manager.sessionFile!)).getRunTimings()).toEqual(
      restored.getRunTimings(),
    );
    const header = restored.getHeader();
    delete header.runTimings;
    await Bun.write(
      manager.sessionFile!,
      [header, ...messages].map((value) => JSON.stringify(value)).join("\n"),
    );
    expect((await SessionManager.open(manager.sessionFile!)).getRunTimings()).toEqual([]);
    header.runTimings = [{ userMessageIndex: 2, startedAt: 1000, finishedAt: 2000 }];
    await Bun.write(
      manager.sessionFile!,
      [header, ...messages].map((value) => JSON.stringify(value)).join("\n"),
    );
    await expect(SessionManager.open(manager.sessionFile!)).rejects.toThrow(
      "Invalid session run timings",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("drafts defer files across metadata changes and persist the first user history with retry", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".draft-storage-test-"));
  try {
    const manager = SessionManager.draft(root, join(root, "history"));
    const id = manager.getSessionId();
    await manager.setModel({ provider: "example", id: "model", effort: "high" });
    await manager.setTitle({ text: "Draft", source: "user", messageIndices: [] });
    await manager.commit([]);
    expect(await Bun.file(manager.sessionFile!).exists()).toBe(false);
    expect(await SessionManager.list(root, join(root, "history"))).toEqual([]);
    await Bun.write(join(root, "history"), "Block directory creation");
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

    const child = Bun.spawn(
      [
        process.execPath,
        "-e",
        "const {SessionManager} = await import(process.argv[1]); const m = await SessionManager.continueRecent(process.argv[2], process.argv[2]); console.log(JSON.stringify(m.messages));",
        import.meta.dir + "/session-manager.ts",
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
      await Bun.write(file, value);
      await expect(SessionManager.open(file)).rejects.toThrow();
      expect(await Bun.file(file).text()).toBe(value);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("effort metadata accepts legacy absence and rejects invalid values without changing storage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-effort-metadata-"));
  try {
    const manager = await SessionManager.create(dir, dir);
    await manager.setModel({ provider: "example", id: "model", effort: "high" });
    const file = manager.sessionFile!;
    const original = await Bun.file(file).text();
    expect((await SessionManager.open(file)).getHeader().model?.effort).toBe("high");
    await manager.setModel({ provider: "example", id: "model", effort: "default" });
    expect((await SessionManager.open(file)).getHeader().model).toEqual({
      provider: "example",
      id: "model",
    });
    await Bun.write(file, original.replace('"effort":"high"', '"effort":"unsupported"'));
    await expect(SessionManager.open(file)).rejects.toThrow("Invalid session metadata");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("title writes serialize with commits and model changes without losing either snapshot", async () => {
  const dir = await mkdtemp(join(import.meta.dir, ".title-storage-test-"));
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
    const original = await Bun.file(manager.sessionFile!).text();
    await Bun.write(
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
  const dir = await mkdtemp(join(import.meta.dir, ".fallback-title-test-"));
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
    const original = await Bun.file(manager.sessionFile!).text();
    expect(JSON.parse(original.split("\n")[0]!).title).toBeUndefined();
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader().title).toEqual({
      text: "First user request",
      source: "fallback",
      messageIndices: [1],
    });
    expect((await SessionManager.list(dir, dir))[0]?.title?.text).toBe("First user request");
    expect(await Bun.file(manager.sessionFile!).text()).toBe(original);
    await restored.setTitle({ text: "Manual name", source: "user", messageIndices: [] });
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().title?.text).toBe(
      "Manual name",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unread belongs to the header and stale receipts cannot clear newer completed output", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".unread-storage-"));
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
  const firstTiming = { userMessageIndex: 0, startedAt: 0, finishedAt: 1 };
  const secondTiming = { userMessageIndex: 2, startedAt: 2, finishedAt: 3 };
  try {
    const manager = SessionManager.draft(root, join(root, "history"));
    expect(manager.getHeader().unread).toBe(false);
    expect(await manager.markRead(2)).toBe(false);
    expect(await Bun.file(manager.sessionFile!).exists()).toBe(false);
    // Unread and read requests work without execution timing metadata.
    await manager.commit([user, reply]);
    const original = await Bun.file(manager.sessionFile!).text();
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
    await manager.commit([user, reply], [firstTiming]);
    expect(manager.unread).toBe(false);
    await manager.commit([user, reply, user, reply], [firstTiming, secondTiming]);
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
    await restored.commit(
      [user, reply, user, reply, user],
      [firstTiming, secondTiming, { userMessageIndex: 4, startedAt: 4, finishedAt: 5 }],
    );
    expect(restored.unread).toBe(false);
    const lines = original.trim().split("\n");
    for (const unread of ["true", 1, null]) {
      await Bun.write(
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
  const root = await mkdtemp(join(import.meta.dir, ".unread-race-"));
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
  const timings = [{ userMessageIndex: 0, startedAt: 0, finishedAt: 1 }];
  try {
    const manager = SessionManager.draft(root, storage);
    await manager.commit([user, reply], timings);
    // Let the receipt start writing before a newer commit is prepared.
    const reading = manager.markRead(2);
    await Promise.resolve();
    const nextTimings = [...timings, { userMessageIndex: 2, startedAt: 2, finishedAt: 3 }];
    await Promise.all([reading, manager.commit([user, reply, user, reply], nextTimings)]);
    expect(manager.unread).toBe(true);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(true);
    // Re-saving the same history must also preserve a concurrent successful read.
    const readingLatest = manager.markRead(4);
    await Promise.resolve();
    await Promise.all([readingLatest, manager.commit(manager.messages, nextTimings)]);
    expect(manager.unread).toBe(false);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(false);
    await rm(storage, { recursive: true });
    await Bun.write(storage, "Block writes");
    const newest = [...nextTimings, { userMessageIndex: 4, startedAt: 4, finishedAt: 5 }];
    await expect(manager.commit([user, reply, user, reply, user, reply], newest)).rejects.toThrow();
    expect(manager.unread).toBe(true);
    await expect(manager.markRead(6)).rejects.toThrow("Pending session save");
    await rm(storage);
    await manager.flush();
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(true);
    await rm(storage, { recursive: true });
    await Bun.write(storage, "Block receipt");
    await expect(manager.markRead(6)).rejects.toThrow();
    expect(manager.unread).toBe(true);
    await rm(storage);
    expect(await manager.markRead(6)).toBe(true);
    expect((await SessionManager.open(manager.sessionFile!)).unread).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
