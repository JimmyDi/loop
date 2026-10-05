import { expect, test } from "vitest";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Readable } from "node:stream";

test("SDK import has no terminal, stdout or file creation side effects", async () => {
  const child = spawnProcess(
    [
      process.execPath,
      "--conditions=loop-source",
      "--import",
      import.meta.resolve("tsx"),
      "-e",
      "await import(process.argv[1]);",
      import.meta.dirname + "/index.ts",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  expect(await new Response(child.stdout).text()).toBe("");
  expect(await new Response(child.stderr).text()).toBe("");
  expect(await child.exited).toBe(0);
});

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
