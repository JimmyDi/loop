import { watch } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";

import type { ListEvents } from "./list-events";

export const watchScheduleChanges = async (
  agentDir: string,
  events: ListEvents,
  signal: AbortSignal,
  notifyPeerSession: () => boolean,
  invalidateLiveSummary: () => void,
) => {
  const directory = join(agentDir, "schedules");
  try {
    await mkdir(directory, { recursive: true });
    if (signal.aborted) return;
    const watcher = watch(directory, { recursive: true, persistent: false, signal });
    watcher.on("change", async (_event, file) => {
      if (typeof file !== "string" || signal.aborted) return;
      const [id, entry, run, extra] = file.split(sep);
      if (!id || !/^[a-f0-9-]{36}$/.test(id) || extra) return;
      if ((entry === "schedule.json" && !run) || (entry === "runs" && run?.endsWith(".json"))) {
        events.publish({ type: "schedules.changed" });
      }
      if (entry !== "runs" || !run?.endsWith(".json") || !notifyPeerSession()) return;
      invalidateLiveSummary();
      try {
        const record = JSON.parse(await readFile(join(directory, id, entry, run), "utf8"));
        if (
          !signal.aborted &&
          typeof record.sessionId === "string" &&
          typeof record.input?.projectId === "string"
        ) {
          events.publish({ type: "sessions.changed", workspaceId: record.input.projectId });
        }
      } catch {
        // A missing event can still be recovered by the committed session metadata watcher.
      }
    });
    watcher.on("error", () => {
      if (!signal.aborted) console.warn("Schedule change notifications unavailable");
    });
  } catch {
    if (!signal.aborted) console.warn("Schedule change notifications unavailable");
  }
};
