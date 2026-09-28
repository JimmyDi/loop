import { useMutation, useQuery } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";

export const useProjectSessions = (workspaceId: string, enabled: boolean) => {
  const sessions = useQuery({
    queryKey: ["sessions", workspaceId],
    enabled,
    refetchInterval: 5000,
    queryFn: () => api<SessionSummary[]>("/sessions?workspaceId=" + workspaceId),
  });
  const create = useMutation({
    mutationFn: () => command<SessionSnapshot>("/sessions", { workspaceId }),
  });

  return { sessions, create };
};
