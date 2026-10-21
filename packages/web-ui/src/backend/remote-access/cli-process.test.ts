import { expect, test } from "vitest";

import { runCli, startCliProcess } from "./cli-process";

test("separates JSON stdout from diagnostics and assembles complete lines", async () => {
  const lines: string[] = [];
  const child = startCliProcess(
    process.execPath,
    ["-e", 'console.error("diagnostic"); console.log(JSON.stringify({ok:true}));'],
    new AbortController().signal,
    (line) => lines.push(line),
  );
  const result = await child.done;
  expect(JSON.parse(result.output)).toEqual({ ok: true });
  expect(lines).toContain("diagnostic");
});

test("aborts a running child and settles stop without exposing its output", async () => {
  const abort = new AbortController();
  const child = startCliProcess(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    abort.signal,
  );
  abort.abort();
  await expect(child.done).rejects.toMatchObject({ name: "AbortError" });
  await child.stop();
});

test("bounds captured output and rejects timeouts and failed commands with sanitized errors", async () => {
  const output = await runCli(
    process.execPath,
    ["-e", 'process.stdout.write("x".repeat(100000))'],
    new AbortController().signal,
  );
  expect(output.length).toBe(64 * 1024);
  await expect(
    runCli(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000)"],
      new AbortController().signal,
      25,
    ),
  ).rejects.toMatchObject({ code: "cli_failed" });
  await expect(
    runCli(
      process.execPath,
      ["-e", 'console.error("synthetic-private-error"); process.exit(1)'],
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "cli_failed", message: "cli_failed" });
});
