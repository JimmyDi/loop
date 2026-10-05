import { spawn } from "node:child_process";
import { open } from "node:fs/promises";
import { once } from "node:events";
import which from "which";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdir, mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { closeSync, openSync } from "node:fs";

import type { PermissionTool } from "../approvals/tool-approvals";
import { PermissionPolicy } from "../permissions/policy";
import { approveShell } from "../permissions/shell-approval";
import type { ToolPermissionOptions } from "../permissions/types";
import { sandboxEnvironment } from "../sandbox/environment";
import { sandboxLaunch, SandboxUnavailableError } from "../sandbox/launcher";
import { MAX_BYTES, truncate } from "./truncate";

export const createBashTool = (
  cwd: string,
  options: ToolPermissionOptions | PermissionPolicy = {},
): PermissionTool => {
  const permissions =
    options instanceof PermissionPolicy ? options : new PermissionPolicy(cwd, options);
  return {
    name: "bash",
    description:
      "Run a bash command in the working directory. Optional timeout is in seconds. Request require_escalated with a justification before execution when host filesystem, network or environment access is needed; approval applies only to this call.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeout: { type: "number", minimum: 0.01 },
        sandbox_permissions: { type: "string", enum: ["use_default", "require_escalated"] },
        justification: {
          type: "string",
          minLength: 1,
          description:
            "Briefly explain why this command needs host access in one sentence in the user's language.",
        },
      },
      required: ["command"],
    },
    async execute(args, signal, approval) {
      signal.throwIfAborted();
      args = structuredClone(args);
      if (
        args.timeout !== undefined &&
        (typeof args.timeout !== "number" || !Number.isFinite(args.timeout) || args.timeout < 0.01)
      ) {
        throw new Error("Invalid command timeout");
      }
      const escalated = await approveShell(permissions, args, signal, approval);
      signal.throwIfAborted();

      const directory = await mkdtemp(join(tmpdir(), "loop-bash-"));
      const path = join(directory, "output.txt");
      let keep = false;

      try {
        const temporary = join(await realpath(directory), "work");
        await mkdir(temporary);
        const resolved = await permissions.resolve(escalated ? undefined : temporary);
        const policy = escalated
          ? { ...resolved, preset: "danger-full-access" as const }
          : resolved;
        const confined = policy.preset !== "danger-full-access";
        const bash = confined
          ? await which("bash", { path: "/bin:/usr/bin", nothrow: true })
          : await which("bash", { nothrow: true });
        if (!bash) throw new SandboxUnavailableError("Bash is unavailable");
        const launch = await sandboxLaunch(
          [bash, "--noprofile", "--norc", "-c", String(args.command)],
          policy,
          signal,
        );
        signal.throwIfAborted();
        const fd = openSync(path, "wx", 0o600);
        let child: ReturnType<typeof spawn>;
        try {
          child = spawn(launch.argv[0]!, launch.argv.slice(1), {
            cwd: policy.workspaceRoot,
            detached: true,
            stdio: ["ignore", fd, fd],
            env: confined ? sandboxEnvironment(temporary) : process.env,
          });
        } catch (error) {
          if (confined) throw new SandboxUnavailableError("Sandbox launch failed");
          throw error;
        } finally {
          closeSync(fd);
        }

        const kill = (kind: NodeJS.Signals) => {
          try {
            if (child.pid !== undefined) process.kill(-child.pid, kind);
          } catch (error) {
            // Bubblewrap starts a new session; terminate the wrapper as well.
            if (child.exitCode === null || (error as NodeJS.ErrnoException).code !== "ESRCH")
              child.kill(kind);
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

        let code: number;

        try {
          const [exitCode, exitSignal] = await once(child, "close");
          code = exitCode ?? (exitSignal === "SIGINT" ? 130 : 143);
        } finally {
          clearTimeout(timer);
          clearTimeout(force);
          signal.removeEventListener("abort", cancel);
          kill("SIGKILL");
        }

        signal.throwIfAborted();

        const size = (await stat(path)).size;
        const file = await open(path, "r");
        let text: string;
        try {
          const buffer = Buffer.alloc(Math.min(size, MAX_BYTES * 2));
          const { bytesRead } = await file.read(
            buffer,
            0,
            buffer.length,
            Math.max(0, size - buffer.length),
          );
          text = buffer.subarray(0, bytesRead).toString("utf8");
        } finally {
          await file.close();
        }
        const output = truncate(text, true);

        keep = size > Buffer.byteLength(output);

        const result = output + (keep ? "\n[Output truncated. Full output: " + path + "]" : "");

        if (timedOut) throw new Error("Command timed out\n" + result);

        if (code !== 0)
          throw new Error(
            "Command exited with code " +
              code +
              (confined ? " under " + policy.preset + " sandbox; no automatic retry" : "") +
              "\n" +
              result,
          );

        return [{ type: "text", text: result || "(no output)" }];
      } finally {
        await rm(join(directory, "work"), { recursive: true, force: true });
        if (!keep) await rm(directory, { recursive: true, force: true });
      }
    },
  };
};
