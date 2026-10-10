import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { SessionManager } from "./core/session-manager";

test("real CLI print calls the model runtime, restores history and reports failure and cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-print-"));
  const requests: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
  let reason = "stop";
  let stalled = false;
  let started!: () => void;
  let ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const server = await serveTest({
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
    spawnProcess(
      [
        process.execPath,
        "--conditions=loop-source",
        "--import",
        import.meta.resolve("tsx"),
        import.meta.dirname + "/cli.ts",
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
    expect(await read(start(["--permission-preset", "workspace-write"]))).toEqual({
      code: 0,
      output: "hello\n",
      error: "",
    });
    await writeFile(
      join(dir, "settings.json"),
      JSON.stringify({ permissionPreset: "danger-full-access" }),
    );
    expect((await read(start(["-c"]))).code).toBe(0);
    expect(requests[1].messages.filter((item) => item.role !== "system")).toMatchObject([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "hello" },
    ]);
    const instructions = requests[1].messages.find((item) => item.role === "system")?.content;
    expect(instructions).toContain("<permissions>");
    expect(instructions).toContain("Current permission preset: workspace-write");
    const restored = await SessionManager.continueRecent(dir, join(dir, "sessions"));
    expect(restored.messages).toHaveLength(4);
    expect(restored.getRuntimeContexts()).toEqual([]);
    expect(restored.getHeader().permissionPreset).toBe("workspace-write");

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
  const server = await serveTest({
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
    await writeFile(
      join(dir, "settings.json"),
      JSON.stringify({ permissionPreset: "workspace-write" }),
    );
    const child = spawnProcess(
      [
        process.execPath,
        "--conditions=loop-source",
        "--import",
        import.meta.resolve("tsx"),
        import.meta.dirname + "/cli.ts",
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
    expect(
      (await SessionManager.continueRecent(dir, join(dir, "sessions"))).getHeader()
        .permissionPreset,
    ).toBe("workspace-write");
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

const serveTest = async (options: {
  hostname: string;
  port: number;
  fetch(request: Request): Response | Promise<Response>;
}) => {
  const server = createServer(getRequestListener(options.fetch));
  server.listen(options.port, options.hostname);
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    url: new URL("http://127.0.0.1:" + address.port + "/"),
    stop: async (_force?: boolean) =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

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
