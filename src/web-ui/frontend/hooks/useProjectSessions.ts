import { useMutation, useQuery } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";

export const useProjectSessions = (workspaceId: string, enabled: boolean) => {
  const sessions = useQuery({
    queryKey: ["sessions", workspaceId],
    enabled,
    queryFn: ({ signal }) =>
      api<SessionSummary[]>("/sessions?workspaceId=" + workspaceId, { signal }),
  });
  const create = useMutation({
    mutationFn: () => command<SessionSnapshot>("/sessions", { workspaceId }),
  });

  return { sessions, create };
};
