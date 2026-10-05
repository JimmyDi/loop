import { getRequestListener } from "@hono/node-server";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { expect, test } from "vitest";

// A real PTY drives the CLI; the local endpoint supplies deterministic model responses.
test("PTY supports streaming, model/new/resume commands and cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-pty-"));
  const requests: string[] = [];
  const server = await serveTest({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        messages: { role: string; content: string | { type: string; text?: string }[] }[];
      };
      // Managed permission context can follow the user's fixture prompt.
      const prompt = body.messages
        .filter((message) => message.role === "user")
        .map((message) =>
          typeof message.content === "string"
            ? message.content
            : message.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join(""),
        )
        .findLast((text) =>
          ["hello", "wait", "after cancellation", "write example"].includes(text),
        );
      const phase = body.messages.at(-1)?.role === "tool" ? "tool result" : prompt;
      requests.push(phase ?? "unknown");
      const frame = (delta: object, finish_reason: string | null) =>
        "data: " +
        JSON.stringify({
          id: "test",
          object: "chat.completion.chunk",
          created: 1,
          model: "test",
          choices: [{ index: 0, delta, finish_reason }],
        }) +
        "\n\n";

      // Cancellation may happen before dispatch; response selection cannot use request counts.
      if (phase === "wait") {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(frame({ content: "PTY_WAIT_READY" }, null)),
              );
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }

      if (phase === "write example") {
        const delta = {
          tool_calls: [
            {
              index: 0,
              id: "write-call",
              type: "function",
              function: {
                name: "write",
                arguments: JSON.stringify({ path: "approved.txt", content: "approved" }),
              },
            },
          ],
        };
        return new Response(frame(delta, null) + frame({}, "tool_calls") + "data: [DONE]\n\n", {
          headers: { "Content-Type": "text/event-stream" },
        });
      }

      return new Response(
        frame({ content: "PTY_STREAM_OK" }, null) + frame({}, "stop") + "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  const script = [
    "import os, pty, subprocess, select, time, sys, glob, re, errno",
    "master, slave = pty.openpty()",
    "child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, close_fds=True)",
    "os.close(slave)",
    "transcript = bytearray()",
    "pending = bytearray()",
    "def read_chunk():",
    "    try: return os.read(master, 65536)",
    "    except OSError as error:",
    "        if error.errno == errno.EIO: return b''  # Linux PTY EOF",
    "        raise",
    "def read_until(marker):",
    "    deadline = time.monotonic() + 8",
    "    while time.monotonic() < deadline:",
    "        end = pending.find(marker)",
    "        if end >= 0:",
    "            end += len(marker)",
    "            received = bytes(pending[:end]); del pending[:end]",
    "            return received",
    "        if select.select([master], [], [], 0.1)[0]:",
    "            data = read_chunk()",
    "            if not data: raise RuntimeError('PTY closed before marker: ' + repr(pending))",
    "            pending.extend(data); transcript.extend(data)",
    "    raise RuntimeError('PTY timeout waiting for ' + repr(marker) + ': ' + repr(pending))",
    "def send(text): os.write(master, (text + chr(10)).encode())",
    "try:",
    "    read_until(b'local-test/test'); read_until(b'> ')",
    "    send('hello'); read_until(b'Waiting for model'); read_until(b'PTY_STREAM_OK')",
    "    read_until(b'> ')",
    "    sessions = glob.glob(os.path.join(os.environ['LOOP_DATA_DIR'], 'sessions', '*.jsonl'))",
    "    assert len(sessions) == 1",
    "    send('/model local-test/test'); read_until(b'> ')",
    "    send('/permissions workspace-write'); read_until(b'Permissions: workspace-write')",
    "    read_until(b'> ')",
    "    send('/permissions invalid'); read_until(b'Use read-only')",
    "    read_until(b'> ')",
    "    send('/new'); read_until(b'> ')",
    "    send('/permissions'); read_until(b'Permissions: read-only')",
    "    read_until(b'> ')",
    "    assert len(glob.glob(os.path.join(os.environ['LOOP_DATA_DIR'], 'sessions', '*.jsonl'))) == 2",
    "    send('/resume ' + sessions[0]); read_until(b'> ')",
    "    send('/permissions'); read_until(b'Permissions: workspace-write')",
    "    read_until(b'> ')",
    "    send('wait'); read_until(b'Waiting for model'); read_until(b'PTY_WAIT_READY')",
    "    send('/new'); read_until(b'already running')",
    "    read_until(b'> ')",
    "    send('/abort'); read_until(b'Run cancelled')",
    "    send('after cancellation'); read_until(b'PTY_STREAM_OK')",
    "    read_until(b'> ')",
    "    send('/permissions read-only'); read_until(b'Permissions: read-only')",
    "    read_until(b'> ')",
    "    send('write example'); approval = read_until(b'/reject ')",
    "    request_id = re.search(rb'/approve ([a-f0-9-]+)', approval).group(1).decode()",
    "    assert not os.path.exists('approved.txt')",
    "    send('/approve wrong'); read_until(b'no longer pending')",
    "    assert not os.path.exists('approved.txt')",
    "    send('/approve ' + request_id); read_until(b'PTY_STREAM_OK')",
    "    assert open('approved.txt').read() == 'approved'",
    "    read_until(b'> '); send('/quit')",
    "    deadline = time.monotonic() + 5",
    "    while child.poll() is None and time.monotonic() < deadline:",
    "        if select.select([master], [], [], 0.1)[0]:",
    "            data = read_chunk()",
    "            if not data: break",
    "            transcript.extend(data)",
    "    assert child.wait(timeout=max(0.1, deadline - time.monotonic())) == 0, repr(transcript)",
    "    print('PTY passed')",
    "finally:",
    "    if child.poll() is None: child.kill(); child.wait()",
    "    os.close(master)",
  ].join("\n");

  try {
    const child = spawnProcess(
      [
        "python3",
        "-c",
        script,
        process.execPath,
        "--conditions=loop-source",
        "--import",
        import.meta.resolve("tsx"),
        join(import.meta.dirname, "../../cli.ts"),
        "--no-context-files",
        "--tools",
        "write",
        "--session-dir",
        join(dir, "data", "sessions"),
      ],
      {
        cwd: dir,
        env: {
          PATH: process.env.PATH!,
          HOME: dir,
          LOOP_DATA_DIR: join(dir, "data"),
          LOOP_AI_PROVIDER: "local-test",
          LOOP_MODEL: "test",
          LOOP_AI_API_KEY: "test-key",
          LOOP_AI_BASE_URL: server.url.href + "v1",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    expect(error).toBe("");
    expect(code).toBe(0);
    expect(output).toContain("PTY passed");
    expect(requests).toEqual([
      "hello",
      "wait",
      "after cancellation",
      "write example",
      "tool result",
    ]);
  } finally {
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
}, 20000);

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
