import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";
import { useWorkspace } from "../state/workspace-store";
import { useSessions } from "../state/session-store";

export const useProjectSessions = (workspaceId: string, enabled: boolean) => {
  const query = useQueryClient();
  const sessions = useQuery({
    queryKey: ["sessions", workspaceId],
    enabled,
    refetchInterval: 5000,
    queryFn: () => api<SessionSummary[]>("/sessions?workspaceId=" + workspaceId),
  });
  useEffect(() => {
    for (const session of sessions.data ?? []) {
      const view = useSessions.getState().views[session.id];
      const title =
        (view?.connected ? view.snapshot?.state.title?.text : undefined) ?? session.title;
      if (title) useWorkspace.getState().title(session.id, title);
    }
  }, [sessions.data]);
  const create = useMutation({
    mutationFn: () => command<SessionSnapshot>("/sessions", { workspaceId }),
    onSuccess: () => query.invalidateQueries({ queryKey: ["sessions", workspaceId] }),
  });

  return { sessions, create };
};
