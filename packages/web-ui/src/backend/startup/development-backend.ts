import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { watch } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { createBackendProxy } from "./backend-proxy";
import { createVoiceProxy } from "./voice-proxy";

export const startDevelopmentBackend = () => {
  let child: ChildProcess | undefined;
  let target: { port: number; token: string } | undefined;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let operation = Promise.resolve();
  const invalidated = new Set<string>();
  const revocations = new Map<
    string,
    {
      child: ChildProcess;
      resolve: () => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const settleRevocation = (requestId: string) => {
    const pending = revocations.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    revocations.delete(requestId);
    pending.resolve();
  };
  const stop = async () => {
    target = undefined;
    const current = child;
    child = undefined;
    if (!current || current.exitCode !== null || current.signalCode !== null) return;
    const exited = once(current, "exit");
    current.kill("SIGTERM");
    const force = setTimeout(() => current.kill("SIGKILL"), 5_000);
    try {
      await exited;
    } finally {
      clearTimeout(force);
    }
  };
  const start = () => {
    if (closed) return;
    const token = randomBytes(32).toString("hex");
    const current = fork(new URL("./development-worker.ts", import.meta.url), [], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
      execArgv: ["--import", "tsx", "--conditions=loop-source"],
    });
    child = current;
    current.on("message", (message: unknown) => {
      if (closed || current !== child || !message || typeof message !== "object") return;
      if (
        "type" in message &&
        message.type === "voice.revoked" &&
        "requestId" in message &&
        typeof message.requestId === "string" &&
        revocations.get(message.requestId)?.child === current
      ) {
        settleRevocation(message.requestId);
        return;
      }
      const port = "port" in message ? message.port : undefined;
      if (typeof port === "number" && Number.isInteger(port) && port > 0 && port <= 65535)
        target = { port, token };
    });
    current.on("error", () => {
      if (current === child) target = undefined;
      console.error("Loop backend failed to start. Fix the error and save to retry.");
    });
    current.on("exit", () => {
      if (current === child) target = undefined;
      for (const [requestId, pending] of revocations)
        if (pending.child === current) settleRevocation(requestId);
    });
    current.send({ token, invalidated: [...invalidated] }, (error) => {
      if (error && current === child) target = undefined;
    });
  };
  const restart = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      operation = operation.then(async () => {
        await stop();
        start();
      });
    }, 200);
  };
  const roots = ["../", "../../shared/", "../../../../agent/src/", "../../../../coding-agent/src/"];
  const watchers = roots.map((path) =>
    watch(fileURLToPath(new URL(path, import.meta.url)), { recursive: true }, (_event, file) => {
      if (file && /(?<![.]test)[.](?:ts|tsx)$/.test(String(file))) restart();
    }),
  );
  start();
  return {
    handle: createBackendProxy(() => target),
    voice: createVoiceProxy(() => target),
    revokeVoice: (principal: string): Promise<void> => {
      invalidated.add(principal);
      const current = child;
      if (!current || current.exitCode !== null || current.signalCode !== null)
        return Promise.resolve();
      return new Promise<void>((resolve) => {
        const requestId = randomUUID();
        const timer = setTimeout(() => current.kill("SIGKILL"), 5_000);
        revocations.set(requestId, { child: current, resolve, timer });
        const failed = () => {
          current.kill("SIGTERM");
        };
        try {
          if (!current.connected) failed();
          else
            current.send({ type: "voice.revoke", principal, requestId }, (error) => {
              if (error) failed();
            });
        } catch {
          failed();
        }
      });
    },
    ready: () => !!target,
    restart,
    close: async () => {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      await operation;
      await stop();
    },
  };
};
