import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";

import { createFrontendRebuildQueue } from "./frontend-rebuild-queue";

export const watchFrontend = () => {
  let stopped = false;
  const directory = fileURLToPath(new URL("./", import.meta.url));
  const queue = createFrontendRebuildQueue(
    () =>
      new Promise<void>((resolve, reject) => {
        const current = spawn(process.execPath, ["--import", "tsx", "build-frontend.ts"], {
          cwd: directory,
          stdio: "inherit",
        });
        current.once("error", reject);
        current.once("exit", (code) => {
          if (code === 0 || stopped) resolve();
          else reject(new Error("Remote frontend build failed"));
        });
      }),
    () =>
      console.error("Remote frontend build failed; the last successful build remains available."),
  );
  const watches = [
    watch(new URL("./src/frontend/", import.meta.url), { recursive: true }, (_event, name) => {
      if (name && !/[.]test[.](?:ts|tsx)$/.test(String(name))) queue.schedule();
    }),
    watch(new URL("./src/shared/", import.meta.url), { recursive: true }, (_event, name) => {
      if (name && !/[.]test[.](?:ts|tsx)$/.test(String(name))) queue.schedule();
    }),
    watch(directory, (_event, name) => {
      if (
        name &&
        ["vite.config.ts", "pwa-plugin.ts", "build-frontend.ts", "publish-frontend.ts"].includes(
          String(name),
        )
      )
        queue.schedule();
    }),
  ];
  for (const watcher of watches)
    watcher.on("error", () => console.error("Remote frontend watcher failed; restart pnpm dev."));
  void queue.run();
  return {
    close: async () => {
      stopped = true;
      for (const watcher of watches) watcher.close();
      // Let the active staged build finish and clean up before shutting down.
      await queue.close();
    },
  };
};
