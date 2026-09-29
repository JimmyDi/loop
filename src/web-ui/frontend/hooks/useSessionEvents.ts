import { useEffect } from "react";
import { flushSync } from "react-dom";

import type { Frame } from "../../shared/protocol";
import { useSessions } from "../state/session-store";

export const useSessionEvents = (id?: string): void => {
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
            useSessions.getState().connection(id, false);
            connect(true);

            return;
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
  }, [id]);
};
