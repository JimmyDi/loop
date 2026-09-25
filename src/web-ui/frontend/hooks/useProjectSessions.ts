import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";

export const useProjectSessions = (workspaceId: string, enabled: boolean) => {
  const query = useQueryClient();
  const sessions = useQuery({
    queryKey: ["sessions", workspaceId],
    enabled,
    queryFn: () => api<SessionSummary[]>("/sessions?workspaceId=" + workspaceId),
  });
  const create = useMutation({
    mutationFn: () => command<SessionSnapshot>("/sessions", { workspaceId }),
    onSuccess: () => query.invalidateQueries({ queryKey: ["sessions", workspaceId] }),
  });

  return { sessions, create };
};
