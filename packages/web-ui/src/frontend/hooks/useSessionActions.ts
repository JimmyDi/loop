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
  const setPinned = async (pinned: boolean): Promise<void> => {
    const queryKey = ["sessions", session.workspaceId];
    await action.run(async () => {
      try {
        const result = await command<{ pinnedAt: string | null }>(
          "/sessions/" + encodeURIComponent(session.id) + "/pin",
          { workspaceId: session.workspaceId, pinned },
          "PUT",
        );
        await query.cancelQueries({ queryKey });
        query.setQueryData<SessionSummary[]>(queryKey, (current) =>
          current?.map((item) =>
            item.id === session.id ? { ...item, pinnedAt: result.pinnedAt ?? undefined } : item,
          ),
        );
      } finally {
        // Reconcile uncertain deliveries and changes made by other browser pages.
        await query.invalidateQueries({ queryKey });
      }
    });
  };
  const markUnread = () =>
    action.run(async () => {
      const { active } = useWorkspace.getState();
      const current = active?.id === session.id ? active : undefined;
      if (current) useWorkspace.setState({ readReceiptPausedFor: current });
      let unread = false;
      try {
        ({ unread } = await command<{ unread: boolean }>(
          "/sessions/" + encodeURIComponent(session.id) + "/unread",
          { workspaceId: session.workspaceId },
          "PUT",
        ));
      } finally {
        if (!unread && current && useWorkspace.getState().readReceiptPausedFor === current) {
          useWorkspace.setState({ readReceiptPausedFor: undefined });
        }
        await query.invalidateQueries({ queryKey: ["sessions", session.workspaceId] });
      }
    });
  const change = async (kind: "archive" | "delete"): Promise<boolean> => {
    let saved = false;
    await action.run(async () => {
      const project = "/workspaces/" + encodeURIComponent(session.workspaceId ?? "global");
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
  const reveal = () =>
    action.run(async () => {
      await command("/sessions/" + encodeURIComponent(session.id) + "/reveal");
    });
  return {
    reveal,
    change,
    setPinned,
    markUnread,
    pending: action.pending,
    error: action.error,
    clearError: action.clearError,
  };
};
