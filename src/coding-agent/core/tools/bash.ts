import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AgentTool } from "../../../agent";
import { MAX_BYTES, truncate } from "./truncate";

export function createBashTool(cwd: string): AgentTool {
  return {
    name: "bash",
    description: "Run a bash command in the working directory. Optional timeout is in seconds.",
    parameters: {
      type: "object",
      properties: { command: { type: "string" }, timeout: { type: "number", minimum: 0.01 } },
      required: ["command"],
    },
    async execute(args, signal) {
      signal.throwIfAborted();

      const directory = await mkdtemp(join(tmpdir(), "loop-bash-"));
      const path = join(directory, "output.txt");
      let keep = false;

      try {
        const fd = openSync(path, "wx", 0o600);
        const child = spawn("bash", ["-c", String(args.command)], {
          cwd,
          detached: true,
          stdio: ["ignore", fd, fd],
        });

        closeSync(fd);

        const kill = (kind: NodeJS.Signals) => {
          if (!child.pid) return;

          try {
            process.kill(-child.pid, kind);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill(kind);
          }
        };
        let timedOut = false;
        let force: ReturnType<typeof setTimeout> | undefined;
        const cancel = () => {
          kill("SIGTERM");
          force ??= setTimeout(() => kill("SIGKILL"), 150);
        };
        const timer =
          args.timeout === undefined
            ? undefined
            : setTimeout(() => {
                timedOut = true;
                cancel();
              }, Number(args.timeout) * 1000);

        signal.addEventListener("abort", cancel, { once: true });

        if (signal.aborted) cancel();

        let code: number | null;

        try {
          code = await new Promise<number | null>((resolve, reject) => {
            child.once("error", reject);
            child.once("close", resolve);
          });
        } finally {
          clearTimeout(timer);
          clearTimeout(force);
          signal.removeEventListener("abort", cancel);
          kill("SIGKILL");
        }

        signal.throwIfAborted();

        const size = (await stat(path)).size;
        const text = await Bun.file(path)
          .slice(Math.max(0, size - MAX_BYTES * 2))
          .text();
        const output = truncate(text, true);

        keep = size > Buffer.byteLength(output);

        const result = output + (keep ? "\n[Output truncated. Full output: " + path + "]" : "");

        if (timedOut) throw new Error("Command timed out\n" + result);

        if (code !== 0) throw new Error("Command exited with code " + code + "\n" + result);

        return [{ type: "text", text: result || "(no output)" }];
      } finally {
        if (!keep) await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
