import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";

import type { Frame, SessionSummary } from "../../shared/protocol";
import { useSessions } from "../state/session-store";

export const useSessionEvents = (id?: string): void => {
  const query = useQueryClient();
  useEffect(() => {
    if (!id) return;

    let source: EventSource;
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const disconnect = () => {
      const view = useSessions.getState().views[id];
      const snapshot = view?.connected ? view.snapshot : undefined;
      if (snapshot) {
        const queryKey = ["sessions", snapshot.workspaceId];
        // Hand off the last live status before rows fall back to the list cache.
        // Cancel older requests so their responses cannot undo this handoff.
        const cancelled = query.cancelQueries({ queryKey });
        query.setQueryData<SessionSummary[]>(queryKey, (sessions) =>
          sessions?.map((session) =>
            session.id === id
              ? {
                  ...session,
                  isGenerating: snapshot.operation === "prompt",
                  title: snapshot.state.title?.text ?? session.title,
                }
              : session,
          ),
        );
        void cancelled.then(() => query.invalidateQueries({ queryKey }));
      }
      useSessions.getState().connection(id, false);
    };
    const connect = (fresh = false) => {
      if (disposed) return;

      const cursor = fresh ? undefined : useSessions.getState().views[id]?.cursor;
      const suffix = cursor
        ? "?cursor=" + encodeURIComponent(cursor.streamId + ":" + cursor.seq)
        : "";

      source = new EventSource("/api/sessions/" + encodeURIComponent(id) + "/events" + suffix);
      source.onmessage = (event) => {
        if (disposed) return;
        try {
          const frame = JSON.parse(event.data) as Frame;
          let accepted = false;
          const apply = () => {
            accepted = frame.sessionId === id && useSessions.getState().frame(frame);
          };

          // Commit starts so a burst of results cannot skip the running icon's effect.
          if (frame.type === "loop.event" && frame.event.type === "tool_execution_start") {
            flushSync(apply);
          } else {
            apply();
          }

          if (!accepted) {
            source.close();
            disconnect();
            connect(true);

            return;
          }
        } catch {
          source.close();
          disconnect();

          if (!disposed) timer = setTimeout(() => connect(true), 1500);
        }
      };
      source.onerror = () => {
        if (disposed) return;
        source.close();
        disconnect();

        if (!disposed) timer = setTimeout(() => connect(), 1500);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      source.close();
      disconnect();
    };
  }, [id, query]);
};
