import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";

import { checkRemoteSession } from "../lib/remote-session";
import { recoveringEvents } from "../lib/recovering-events";
import type { Frame, SessionSummary } from "../../shared/protocol";
import { useSessions } from "../state/session-store";

export const useSessionEvents = (id?: string): void => {
  const query = useQueryClient();
  const revision = useSessions((state) => (id ? state.views[id]?.revision : undefined));
  useEffect(() => {
    if (!id) return;
    useSessions.getState().latest(id);

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
                  unread: snapshot.state.unread,
                  isWaitingForApproval:
                    snapshot.state.pendingApprovals?.some((request) => request.sessionId === id) ??
                    false,
                  title: snapshot.state.title?.text ?? session.title,
                }
              : session,
          ),
        );
        void cancelled.then(() => query.invalidateQueries({ queryKey }));
      }
      useSessions.getState().connection(id, false);
    };
    const source = recoveringEvents({
      url: () => {
        const cursor = useSessions.getState().views[id]?.cursor;
        const suffix = cursor
          ? "&cursor=" + encodeURIComponent(cursor.streamId + ":" + cursor.seq)
          : "";

        return "/api/sessions/" + encodeURIComponent(id) + "/events?approvals=1" + suffix;
      },
      message: (event) => {
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
            useSessions.getState().resync(id);

            return;
          }
        } catch {
          useSessions.getState().resync(id);
        }
      },
      disconnected: () => {
        disconnect();
        checkRemoteSession();
      },
    });

    return () => {
      disposed = true;
      source.close();
      disconnect();
    };
  }, [id, query, revision]);
};
