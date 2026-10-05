import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Cursor, ListFrame } from "../../shared/protocol";

export const useListEvents = (): void => {
  const query = useQueryClient();
  useEffect(() => {
    const source = new EventSource("/api/workspaces/events");
    const projects = new Set<string>();
    let reset = false;
    let projectList = false;
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
      const keys: string[][] = [["archived-chats"]];
      if (reset || projectList) keys.push(["projects"]);
      if (reset) keys.push(["sessions"]);
      else for (const id of projects) keys.push(["sessions", id]);
      reset = false;
      projectList = false;
      projects.clear();
      try {
        // Cancel even first loads so an older in-flight response cannot swallow a notification.
        await Promise.all(keys.map((queryKey) => query.cancelQueries({ queryKey })));
        if (!disposed)
          await Promise.all(keys.map((queryKey) => query.invalidateQueries({ queryKey })));
      } finally {
        refreshing = false;
        if (reset || projectList || projects.size) schedule();
      }
    };
    source.onmessage = (event) => {
      if (disposed) return;
      try {
        const frame = JSON.parse(event.data) as ListFrame;
        if (
          !frame ||
          typeof frame.streamId !== "string" ||
          !Number.isSafeInteger(frame.seq) ||
          frame.seq < 0 ||
          !["lists.reset", "sessions.changed", "projects.changed"].includes(frame.type) ||
          (frame.type !== "lists.reset" && typeof frame.workspaceId !== "string")
        )
          return;
        if (frame.type === "lists.reset") reset = true;
        else {
          if (cursor?.streamId === frame.streamId && frame.seq <= cursor.seq) return;
          if (!cursor || cursor.streamId !== frame.streamId || frame.seq !== cursor.seq + 1)
            reset = true;
          projects.add(frame.workspaceId);
          if (frame.type === "projects.changed") projectList = true;
        }
        cursor = { streamId: frame.streamId, seq: frame.seq };
        schedule();
      } catch {
        reset = true;
        schedule();
      }
    };
    // Native EventSource reconnects; every connection begins with a full list invalidation.
    return () => {
      disposed = true;
      clearTimeout(timer);
      source.close();
    };
  }, [query]);
};
