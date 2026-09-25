import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "./session-manager";

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
