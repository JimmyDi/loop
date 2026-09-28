import { useQueryClient } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { command } from "../lib/api";
import { useSessions } from "../state/session-store";
import { useAsyncAction } from "./useAsyncAction";

export const useSessionRename = (snapshot: SessionSnapshot) => {
  const query = useQueryClient();
  const action = useAsyncAction();
  const rename = async (text: string): Promise<boolean> => {
    if (!text.trim() || snapshot.operation !== "idle" || snapshot.state.hasPendingSave)
      return false;

    let saved = false;
    await action.run(async () => {
      const next = await command<SessionSnapshot>(
        "/sessions/" + encodeURIComponent(snapshot.sessionId) + "/title",
        { title: text.trim() },
        "PUT",
      );
      const title = next.state.title;
      if (!title) throw new Error("Missing saved session title");

      // Merge only title fields: an HTTP acknowledgement must not rewind live SSE state.
      const merge = (current: SessionSnapshot): SessionSnapshot => ({
        ...current,
        state: { ...current.state, title, titleError: undefined },
      });
      useSessions.setState((state) => {
        const view = state.views[next.sessionId];
        if (view?.snapshot && view.snapshot.streamId !== next.streamId) return state;
        return {
          views: {
            ...state.views,
            [next.sessionId]: {
              ...view,
              connected: view?.connected ?? false,
              snapshot: merge(view?.snapshot ?? next),
            },
          },
        };
      });
      query.setQueryData<SessionSnapshot>(["session", next.sessionId], (current) =>
        merge(current ?? next),
      );
      query.setQueryData<SessionSummary[]>(["sessions", next.workspaceId], (current) =>
        current?.map((session) =>
          session.id === next.sessionId ? { ...session, title: title.text } : session,
        ),
      );
      void query.invalidateQueries({ queryKey: ["sessions", next.workspaceId] });
      saved = true;
    });
    return saved;
  };

  return { rename, pending: action.pending, error: action.error };
};
