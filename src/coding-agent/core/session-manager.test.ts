import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "./session-manager";

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
