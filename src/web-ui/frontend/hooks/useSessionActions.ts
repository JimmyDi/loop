import { useQueryClient } from "@tanstack/react-query";

import type { SessionSummary } from "../../shared/protocol";
import { command } from "../lib/api";
import { useWorkspace } from "../state/workspace-store";
import { useRequests } from "../state/request-store";
import { useSessions } from "../state/session-store";
import { useAsyncAction } from "./useAsyncAction";

export const useSessionActions = (session: SessionSummary) => {
  const query = useQueryClient();
  const action = useAsyncAction();
  const change = async (kind: "archive" | "delete"): Promise<boolean> => {
    let saved = false;
    await action.run(async () => {
      const project = "/workspaces/" + encodeURIComponent(session.workspaceId);
      if (kind === "archive") {
        await command<void>(project + "/archive", { ids: [session.id], archived: true });
        if (useWorkspace.getState().active?.id === session.id)
          useWorkspace.setState({ active: undefined });
      } else {
        await command<void>(
          project + "/sessions/" + encodeURIComponent(session.id),
          undefined,
          "DELETE",
        );
        useWorkspace.getState().removeSessions([session.id]);
        useRequests.getState().put(session.id);
        await query.cancelQueries({ queryKey: ["session", session.id] });
        query.removeQueries({ queryKey: ["session", session.id] });
        useSessions.setState((state) => {
          const views = { ...state.views };
          delete views[session.id];
          return { views };
        });
      }
      query.setQueryData<SessionSummary[]>(["sessions", session.workspaceId], (current) =>
        current?.filter((item) => item.id !== session.id),
      );
      saved = true;
      await Promise.all([
        query.invalidateQueries({ queryKey: ["sessions", session.workspaceId] }),
        query.invalidateQueries({ queryKey: ["archived-chats"] }),
      ]);
    });
    return saved;
  };
  return { change, pending: action.pending, error: action.error };
};
