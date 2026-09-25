import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SessionManager } from "./core/session-manager";

test("real CLI print uses Pi AI, restores history and reports model failure and cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-print-"));
  const requests: Array<{ messages: Array<{ role: string }> }> = [];
  let reason = "stop";
  let stalled = false;
  let started!: () => void;
  let ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push((await request.json()) as (typeof requests)[number]);
      started();

      if (stalled)
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(": waiting\n\n"));
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );

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
        chunk({ content: "hello" }, null) + chunk({}, reason) + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  const start = (extra: string[] = []) =>
    Bun.spawn(
      [
        process.execPath,
        import.meta.dir + "/cli.ts",
        "-p",
        "--no-context-files",
        "--tools",
        "",
        "--session-dir",
        join(dir, "sessions"),
        ...extra,
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
        stdout: "pipe",
        stderr: "pipe",
      },
    );
  const read = async (child: ReturnType<typeof start>) => {
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    return { code, output, error };
  };

  try {
    expect(await read(start())).toEqual({ code: 0, output: "hello\n", error: "" });
    expect((await read(start(["-c"]))).code).toBe(0);
    expect(requests[1].messages.filter((item) => item.role !== "system")).toHaveLength(3);
    expect((await SessionManager.continueRecent(dir, join(dir, "sessions"))).messages).toHaveLength(
      4,
    );

    reason = "length";

    const truncated = await read(start(["--no-session"]));

    expect(truncated.code).toBe(1);
    expect(truncated.error).toContain("truncated");
    expect(truncated.output).toBe("");

    stalled = true;
    ready = new Promise<void>((resolve) => {
      started = resolve;
    });

    const child = start(["--no-session"]);

    await ready;
    child.kill("SIGINT");

    const cancelled = await read(child);

    expect(cancelled.code).toBe(130);
    expect(cancelled.error).toContain("cancel");
  } finally {
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI defaults to OpenAI GPT-5.5 and uses chat completions at a custom URL", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-default-model-"));
  const requests: Array<{ path: string; authorization: string | null; model: string }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as { model: string };

      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
        model: body.model,
      });

      const chunk = (delta: object, finish_reason: string | null) =>
        "data: " +
        JSON.stringify({
          id: "test",
          object: "chat.completion.chunk",
          created: 1,
          model: body.model,
          choices: [{ index: 0, delta, finish_reason }],
        }) +
        "\n\n";

      return new Response(
        chunk({ content: "gateway answer" }, null) + chunk({}, "stop") + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });

  try {
    const child = Bun.spawn(
      [
        process.execPath,
        import.meta.dir + "/cli.ts",
        "-p",
        "--no-context-files",
        "--tools",
        "",
        "--session-dir",
        join(dir, "sessions"),
        "--base-url",
        server.url.href + "api/openai/v1",
        "--api-key",
        "test-only",
        "hello",
      ],
      {
        cwd: dir,
        env: { PATH: process.env.PATH!, HOME: dir, LOOP_DATA_DIR: dir },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    expect({ code, output, error }).toEqual({ code: 0, output: "gateway answer\n", error: "" });
    expect(requests).toEqual([
      {
        path: "/api/openai/v1/chat/completions",
        authorization: "Bearer test-only",
        model: "gpt-5.5",
      },
    ]);
    expect(
      (await SessionManager.continueRecent(dir, join(dir, "sessions"))).getHeader().model,
    ).toEqual({ provider: "openai", id: "gpt-5.5" });
  } finally {
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
});
