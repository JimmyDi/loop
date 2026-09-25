import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A real PTY drives the CLI; the local endpoint supplies deterministic Pi AI responses.
test("PTY supports streaming, model/new/resume commands and cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-pty-"));
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      await request.json();
      requests++;

      if (requests === 2)
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(": wait\n\n"));
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );

      const chunk = (content: string, reason: string | null) =>
        "data: " +
        JSON.stringify({
          id: "test",
          object: "chat.completion.chunk",
          created: 1,
          model: "test",
          choices: [{ index: 0, delta: { content }, finish_reason: reason }],
        }) +
        "\n\n";

      await Bun.sleep(300);

      return new Response(chunk("PTY_STREAM_OK", null) + chunk("", "stop") + "data: [DONE]\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  });
  const script = [
    "import os, pty, subprocess, select, time, sys, glob",
    "master, slave = pty.openpty()",
    "child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, close_fds=True)",
    "os.close(slave)",
    "transcript = bytearray()",
    "def read_until(marker):",
    "    received = bytearray()",
    "    deadline = time.monotonic() + 8",
    "    while time.monotonic() < deadline:",
    "        if select.select([master], [], [], 0.1)[0]:",
    "            data = os.read(master, 65536)",
    "            received.extend(data); transcript.extend(data)",
    "            if marker in received: return",
    "    raise RuntimeError('PTY timeout: ' + repr(received))",
    "def send(text): os.write(master, (text + chr(10)).encode())",
    "try:",
    "    read_until(b'local-test/test')",
    "    send('hello'); read_until(b'Waiting for model'); read_until(b'PTY_STREAM_OK')",
    "    time.sleep(0.1)",
    "    sessions = glob.glob(os.path.join(os.environ['LOOP_DATA_DIR'], 'sessions', '*.jsonl'))",
    "    assert len(sessions) == 1",
    "    send('/model local-test/test'); time.sleep(0.15)",
    "    send('/new'); time.sleep(0.15)",
    "    assert len(glob.glob(os.path.join(os.environ['LOOP_DATA_DIR'], 'sessions', '*.jsonl'))) == 2",
    "    send('/resume ' + sessions[0]); time.sleep(0.15)",
    "    send('wait'); read_until(b'Waiting for model')",
    "    send('/new'); read_until(b'already running')",
    "    send('/abort'); read_until(b'cancel')",
    "    send('after cancellation'); read_until(b'PTY_STREAM_OK')",
    "    time.sleep(0.1); send('/quit')",
    "    deadline = time.monotonic() + 5",
    "    while child.poll() is None and time.monotonic() < deadline:",
    "        if select.select([master], [], [], 0.1)[0]: transcript.extend(os.read(master, 65536))",
    "    assert child.poll() == 0, repr(transcript)",
    "    print('PTY passed')",
    "finally:",
    "    if child.poll() is None: child.kill(); child.wait()",
    "    os.close(master)",
  ].join("\n");

  try {
    const child = Bun.spawn(
      [
        "python3",
        "-c",
        script,
        process.execPath,
        join(import.meta.dir, "../../cli.ts"),
        "--no-context-files",
        "--tools",
        "",
        "--session-dir",
        join(dir, "sessions"),
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
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    expect(error).toBe("");
    expect(code).toBe(0);
    expect(output).toContain("PTY passed");
    expect(requests).toBe(3);
  } finally {
    await server.stop(true);
    await rm(dir, { recursive: true, force: true });
  }
}, 20000);
