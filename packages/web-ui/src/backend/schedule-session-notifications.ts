import { watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, join, normalize, sep } from "node:path";
import { getSessionDir } from "@loop/coding-agent";
import type { SessionRegistry } from "./session-registry";

// Committed history is visible to both the peer sidebar and already-open chats.
export const watchScheduleSessions = async (
  agentDir: string,
  registry: SessionRegistry,
  signal: AbortSignal,
) => {
  const directory = join(agentDir, "sessions");
  await mkdir(directory, { recursive: true });
  if (signal.aborted) return;
  const watcher = watch(directory, { recursive: true, persistent: false, signal });
  watcher.on("change", async (_event, filename) => {
    if (typeof filename !== "string") return;
    const parts = normalize(filename).split(sep);
    if (parts.length !== 3 || parts[2] !== "meta.json" || !/^[a-f0-9]{24}$/.test(parts[0]!)) return;
    try {
      await registry.invalidateSavedHistory(parts[1]!, join(directory, ...parts), signal);
      for (const project of await registry.projects.list()) {
        if (signal.aborted) return;
        if (project.accessible && basename(getSessionDir(project.cwd, agentDir)) === parts[0]) {
          registry.events.publish({ type: "sessions.changed", workspaceId: project.id });
          return;
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !signal.aborted)
        console.warn("Could not resolve project for saved session");
    }
  });
  watcher.on("error", () => {
    if (!signal.aborted) console.warn("Scheduled session notifications unavailable");
  });
};
