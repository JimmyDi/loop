import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Frame } from "../../shared/protocol";
import { useSessions } from "../state/session-store";

export const useSessionEvents = (id?: string): void => {
  const query = useQueryClient();

  useEffect(() => {
    if (!id) return;

    let source: EventSource;
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const connect = (fresh = false) => {
      if (disposed) return;

      const cursor = fresh ? undefined : useSessions.getState().views[id]?.cursor;
      const suffix = cursor
        ? "?cursor=" + encodeURIComponent(cursor.streamId + ":" + cursor.seq)
        : "";

      source = new EventSource("/api/sessions/" + encodeURIComponent(id) + "/events" + suffix);
      source.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data) as Frame;

          if (frame.sessionId !== id || !useSessions.getState().frame(frame)) {
            source.close();
            useSessions.getState().connection(id, false);
            connect(true);

            return;
          }

          if (frame.type === "session.state" && frame.snapshot.operation === "idle") {
            void query.invalidateQueries({ queryKey: ["sessions"] });
          }
        } catch {
          source.close();
          useSessions.getState().connection(id, false);

          if (!disposed) timer = setTimeout(() => connect(true), 1500);
        }
      };
      source.onerror = () => {
        source.close();
        useSessions.getState().connection(id, false);

        if (!disposed) timer = setTimeout(() => connect(), 1500);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(timer);
      source.close();
      useSessions.getState().connection(id, false);
    };
  }, [id, query]);
};
