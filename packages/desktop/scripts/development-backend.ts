import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { watch } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const startBackend = async (reload: () => void) => {
  let child: ChildProcess;
  let address: string | undefined;
  let sequence = 0;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let operation = Promise.resolve();
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const request = (action: string, stop = false): Promise<unknown> => {
    if (!address) return Promise.reject(new Error("Development backend is restarting"));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Backend command timed out"));
      }, 60_000);
      pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      child.send({ id, action, stop }, (error) => {
        if (error) {
          pending.get(id)?.reject(error);
          pending.delete(id);
        }
      });
    });
  };
  const start = () =>
    new Promise<void>((resolveReady, rejectReady) => {
      const current = fork(new URL("./development-worker.ts", import.meta.url), [], {
        execArgv: [
          "--import",
          pathToFileURL(resolve(import.meta.dirname, "../node_modules/tsx/dist/loader.mjs")).href,
          "--conditions=loop-source",
        ],
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
      child = current;
      const timeout = setTimeout(() => {
        current.kill();
        rejectReady(new Error("Backend startup timed out"));
      }, 40_000);
      current.on(
        "message",
        (message: {
          event?: string;
          url?: string;
          id: number;
          ok: boolean;
          value?: unknown;
          error?: string;
        }) => {
          if (current !== child) return;
          if (message.event === "ready") {
            clearTimeout(timeout);
            address = message.url;
            resolveReady();
            return;
          }
          const reply = pending.get(message.id);
          if (message.ok) reply?.resolve(message.value);
          else reply?.reject(new Error(message.error));
          pending.delete(message.id);
        },
      );
      current.on("error", (error) => {
        clearTimeout(timeout);
        rejectReady(error);
      });
      current.on("exit", () => {
        clearTimeout(timeout);
        rejectReady(new Error("Development backend exited"));
        if (current !== child) return;
        address = undefined;
        for (const reply of pending.values()) reply.reject(new Error("Development backend exited"));
        pending.clear();
      });
    });
  const stop = async () => {
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    const force = setTimeout(() => child.kill("SIGKILL"), 10_000);
    try {
      await request("shutdown").catch(() => child.kill());
      await exited;
    } finally {
      clearTimeout(force);
      address = undefined;
    }
  };
  await start().catch((error) => console.error("Backend startup failed. Save to retry.", error));
  const roots = [
    "../../web-ui/src/backend",
    "../../web-ui/src/shared",
    "../../coding-agent/src",
    "../../agent/src",
    "../../telemetry/src",
  ];
  const watchers = roots.map((path) =>
    watch(resolve(import.meta.dirname, path), { recursive: true }, (_, file) => {
      if (
        !file ||
        !/(?<![.]test)[.](ts|tsx)$/.test(String(file)) ||
        /^(client)[.]/.test(String(file))
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        operation = operation
          .then(async () => {
            if (closed) return;
            console.error(
              "Backend source changed. Stopping tasks and restarting the development service.",
            );
            await stop();
            await start();
            reload();
          })
          .catch((error) => console.error("Backend restart failed. Save to retry.", error));
      }, 200);
    }),
  );
  return {
    url: () => address,
    request,
    close: async () => {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      await operation;
      await stop();
    },
  };
};
