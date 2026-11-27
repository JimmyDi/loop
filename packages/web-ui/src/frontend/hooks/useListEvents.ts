import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { checkRemoteSession } from "../lib/remote-session";
import { recoveringEvents } from "../lib/recovering-events";
import type { Cursor, ListFrame } from "../../shared/protocol";

export const useListEvents = (): void => {
  const query = useQueryClient();
  useEffect(() => {
    const projects = new Set<string | null>();
    let reset = false;
    let projectList = false;
    let schedules = false;
    let cursor: Cursor | undefined;
    let disposed = false;
    let refreshing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (!disposed && !refreshing && timer === undefined) timer = setTimeout(refresh, 50);
    };
    const refresh = async () => {
      timer = undefined;
      refreshing = true;
      const keys: (string | null)[][] = [];
      if (reset || projects.size) keys.push(["archived-chats"]);
      if (reset || schedules)
        keys.push(["schedules"], ["schedule-runs"], ["schedule-run-progress"]);
      if (reset || projectList) keys.push(["projects"]);
      if (reset) keys.push(["sessions"]);
      else for (const id of projects) keys.push(["sessions", id]);
      reset = false;
      projectList = false;
      schedules = false;
      projects.clear();
      try {
        // Cancel even first loads so an older in-flight response cannot swallow a notification.
        await Promise.all(keys.map((queryKey) => query.cancelQueries({ queryKey })));
        if (!disposed)
          await Promise.all(keys.map((queryKey) => query.invalidateQueries({ queryKey })));
      } finally {
        refreshing = false;
        if (reset || projectList || schedules || projects.size) schedule();
      }
    };
    const source = recoveringEvents({
      url: () => "/api/workspaces/events",
      message: (event) => {
        if (disposed) return;
        try {
          const frame = JSON.parse(event.data) as ListFrame;
          if (
            !frame ||
            typeof frame.streamId !== "string" ||
            !Number.isSafeInteger(frame.seq) ||
            frame.seq < 0 ||
            !["lists.reset", "sessions.changed", "projects.changed", "schedules.changed"].includes(
              frame.type,
            ) ||
            ((frame.type === "sessions.changed" || frame.type === "projects.changed") &&
              typeof frame.workspaceId !== "string" &&
              frame.workspaceId !== null)
          )
            return;
          if (frame.type === "lists.reset") reset = true;
          else {
            if (cursor?.streamId === frame.streamId && frame.seq <= cursor.seq) return;
            if (!cursor || cursor.streamId !== frame.streamId || frame.seq !== cursor.seq + 1)
              reset = true;
            if (frame.type === "schedules.changed") schedules = true;
            else projects.add(frame.workspaceId);
            if (frame.type === "projects.changed") projectList = true;
          }
          cursor = { streamId: frame.streamId, seq: frame.seq };
          schedule();
        } catch {
          reset = true;
          schedule();
        }
      },
      disconnected: checkRemoteSession,
    });
    // Every connection begins with a full list invalidation.
    return () => {
      disposed = true;
      clearTimeout(timer);
      source.close();
    };
  }, [query]);
};
