import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";

export const projectSessionsQueryOptions = (workspaceId: string | null) =>
  queryOptions({
    queryKey: ["sessions", workspaceId],
    queryFn: ({ signal }) =>
      api<SessionSummary[]>(
        workspaceId === null
          ? "/sessions?scope=global"
          : "/sessions?workspaceId=" + encodeURIComponent(workspaceId),
        { signal },
      ),
  });

export const useProjectSessions = (workspaceId: string | null, enabled: boolean) => {
  const sessions = useQuery({
    ...projectSessionsQueryOptions(workspaceId),
    enabled,
  });
  const create = useMutation({
    mutationFn: () => command<SessionSnapshot>("/sessions", { workspaceId }),
  });

  return { sessions, create };
};
