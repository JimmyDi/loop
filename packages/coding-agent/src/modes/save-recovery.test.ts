import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { SessionManager } from "../core/session-manager";

test("print retains a failed save and flushes it without another model call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-recovery-"));
  const store = join(dir, "sessions");
  let requests = 0;
  const server = await serveTest({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      await request.json();
      requests++;
      await rename(store, store + "-old");
      await writeFile(store, "blocks save");

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
  const child = spawnProcess(
    [
      process.execPath,
      "--conditions=loop-source",
      "--import",
      import.meta.resolve("tsx"),
      join(import.meta.dirname, "../cli.ts"),
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
