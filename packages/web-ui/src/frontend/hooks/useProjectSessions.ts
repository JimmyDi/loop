import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";

import type { SessionSnapshot, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";

export const projectSessionsQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: ["sessions", workspaceId],
    queryFn: ({ signal }) =>
      api<SessionSummary[]>("/sessions?workspaceId=" + encodeURIComponent(workspaceId), { signal }),
  });

export const useProjectSessions = (workspaceId: string, enabled: boolean) => {
  const sessions = useQuery({
    ...projectSessionsQueryOptions(workspaceId),
    enabled,
  });
  const create = useMutation({
    mutationFn: () => command<SessionSnapshot>("/sessions", { workspaceId }),
  });

  return { sessions, create };
};
