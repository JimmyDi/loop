import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { watch } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { createBackendProxy } from "./backend-proxy";

export const startDevelopmentBackend = () => {
  let child: ChildProcess | undefined;
  let target: { port: number; token: string } | undefined;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let operation = Promise.resolve();
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
    });
    current.send({ token }, (error) => {
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
