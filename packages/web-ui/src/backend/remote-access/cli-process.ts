import { spawn } from "node:child_process";

import { RemoteAccessError } from "./errors";

export type CliProcess = {
  done: Promise<{ code: number | null; output: string }>;
  stop(): Promise<void>;
};

export const startCliProcess = (
  file: string,
  args: string[],
  signal: AbortSignal,
  onLine: (line: string) => void = () => {},
  timeout = 30_000,
): CliProcess => {
  signal.throwIfAborted();
  const child = spawn(file, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
    env: { ...process.env, DOTNET_CLI_UI_LANGUAGE: "en-US", LANG: "en_US.UTF-8" },
  });
  let output = "";
  let killing: ReturnType<typeof setTimeout> | undefined;
  let ended = false;
  let timedOut = false;
  const terminate = () => {
    if (ended || killing) return;
    child.kill("SIGTERM");
    killing = setTimeout(() => child.kill("SIGKILL"), 2_000);
    killing.unref();
  };
  const timer =
    timeout > 0
      ? setTimeout(() => {
          timedOut = true;
          terminate();
        }, timeout)
      : undefined;
  const done = new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const cleanup = () => {
      ended = true;
      clearTimeout(timer);
      clearTimeout(killing);
      signal.removeEventListener("abort", terminate);
    };
    for (const stream of [child.stdout, child.stderr]) {
      let pending = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => {
        if (stream === child.stdout) output = (output + chunk).slice(-64 * 1024);
        pending = (pending + chunk).slice(-64 * 1024);
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) onLine(line);
      });
      stream.on("end", () => {
        if (pending) onLine(pending);
      });
    }
    child.once("error", () => {
      cleanup();
      reject(new RemoteAccessError("cli_failed"));
    });
    child.once("close", (code) => {
      cleanup();
      if (signal.aborted) reject(new DOMException("Cancelled", "AbortError"));
      else if (timedOut) reject(new RemoteAccessError("cli_failed"));
      else resolve({ code, output });
    });
    signal.addEventListener("abort", terminate, { once: true });
    if (signal.aborted) terminate();
  });
  void done.catch(() => {});
  return {
    done,
    stop: async () => {
      terminate();
      await done.catch(() => {});
    },
  };
};

export const runCli = async (
  file: string,
  args: string[],
  signal: AbortSignal,
  timeout?: number,
) => {
  const result = await startCliProcess(file, args, signal, undefined, timeout).done;
  if (result.code !== 0) throw new RemoteAccessError("cli_failed");
  return result.output;
};
