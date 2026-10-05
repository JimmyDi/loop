import { spawn } from "node:child_process";
import { once } from "node:events";
import { text } from "node:stream/consumers";
import which from "which";
import { existingAncestor, isWithin } from "../permissions/paths";
import type { ExecutionPolicy } from "../permissions/types";
import { bubblewrapArgs, seatbeltProfile } from "./profiles";

export class SandboxUnavailableError extends Error {
  readonly code = "SANDBOX_UNAVAILABLE";

  constructor(message: string) {
    super("SANDBOX_UNAVAILABLE: " + message);
    this.name = "SandboxUnavailableError";
  }
}

export type SandboxLaunch = { argv: string[]; backend: "seatbelt" | "bubblewrap" | "none" };

/** Probe the exact profile before launching user code; no fallback to an ordinary shell. */
export const sandboxLaunch = async (
  argv: string[],
  policy: ExecutionPolicy,
  signal: AbortSignal,
): Promise<SandboxLaunch> => {
  signal.throwIfAborted();
  if (policy.preset === "danger-full-access") return { argv, backend: "none" };
  let prefix: string[];
  let backend: SandboxLaunch["backend"];
  if (process.platform === "darwin") {
    backend = "seatbelt";
    prefix = ["/usr/bin/sandbox-exec", "-p", seatbeltProfile(policy)];
  } else if (process.platform === "linux") {
    backend = "bubblewrap";
    const runner = await which("bwrap", { path: "/usr/bin:/bin", nothrow: true });
    if (!runner) throw new SandboxUnavailableError("Install Bubblewrap to run confined commands");
    const protectedMounts = await Promise.all(
      policy.protectedRoots
        .filter((root) =>
          policy.writableRoots.some((write) => isWithin(root, write) || isWithin(write, root)),
        )
        .map(existingAncestor),
    );
    prefix = [runner, ...bubblewrapArgs(policy, protectedMounts), "--"];
  } else {
    throw new SandboxUnavailableError("Confined commands require macOS or Linux");
  }
  signal.throwIfAborted();
  try {
    const probe = spawn(prefix[0]!, [...prefix.slice(1), "/bin/sh", "-c", "exit 0"], {
      cwd: policy.workspaceRoot,
      stdio: ["ignore", "ignore", "pipe"],
      env: { PATH: "/usr/bin:/bin" },
    });
    const stop = () => probe.kill("SIGKILL");
    signal.addEventListener("abort", stop, { once: true });
    const timeout = setTimeout(stop, 5000);
    try {
      if (signal.aborted) stop();
      const [code, diagnostic] = await Promise.all([
        once(probe, "close").then(([code]) => code),
        text(probe.stderr!),
      ]);
      signal.throwIfAborted();
      if (code !== 0)
        throw new SandboxUnavailableError(backend + " refused the profile: " + diagnostic.trim());
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", stop);
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof SandboxUnavailableError) throw error;
    throw new SandboxUnavailableError(backend + " could not start");
  }
  return { argv: [...prefix, ...argv], backend };
};
