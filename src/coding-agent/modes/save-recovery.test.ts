import { expect, test } from "bun:test";
import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "../core/session-manager";

test("print retains a failed save and flushes it without another model call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-recovery-"));
  const store = join(dir, "sessions");
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      await request.json();
      requests++;
      await rename(store, store + "-old");
      await Bun.write(store, "blocks save");

      const chunk = (delta: object, finish_reason: string | null) =>
        "data: " +
        JSON.stringify({
          id: "test",
          object: "chat.completion.chunk",
          created: 1,
          model: "test",
          choices: [{ index: 0, delta, finish_reason }],
        }) +
        "\n\n";

      return new Response(
        chunk({ content: "saved answer" }, null) + chunk({}, "stop") + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "../cli.ts"),
      "-p",
      "--no-context-files",
      "--tools",
      "",
      "--session-dir",
      store,
      "hello",
    ],
    {
      cwd: dir,
      env: {
        PATH: process.env.PATH!,
        HOME: dir,
        LOOP_DATA_DIR: dir,
        LOOP_AI_PROVIDER: "local-test",
        LOOP_MODEL: "test",
        LOOP_AI_API_KEY: "test-key",
        LOOP_AI_BASE_URL: server.url.href + "v1",
      },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  try {
    const reader = child.stderr.getReader();
    let errors = "";

    while (!errors.includes("enter /flush")) {
      const next = await reader.read();

      if (next.done) throw new Error(errors || "CLI exited before recovery");

      errors += new TextDecoder().decode(next.value);
    }

    expect(child.exitCode).toBeNull();
    await rm(store);
    await rename(store + "-old", store);
    child.stdin.write("/flush\n");
    await child.stdin.flush();

    expect(await child.exited).toBe(1);
    expect(requests).toBe(1);
    expect((await SessionManager.continueRecent(dir, store)).messages).toHaveLength(2);
    expect(await new Response(child.stdout).text()).toBe("");
    await reader.cancel();
  } finally {
    if (child.exitCode === null) child.kill("SIGKILL");

    await child.exited;
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});
