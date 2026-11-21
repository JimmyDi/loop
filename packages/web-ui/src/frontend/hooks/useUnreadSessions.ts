import { useQueries } from "@tanstack/react-query";

import { useSessions } from "../state/session-store";
import { useProjects } from "./useProjects";
import { projectSessionsQueryOptions } from "./useProjectSessions";

/** Include chats outside the visible or expanded portion of the sidebar. */
export const useUnreadSessions = (): boolean => {
  const { projects } = useProjects();
  const workspaceIds = [
    null,
    ...(projects.data ?? [])
      .filter((project) => project.accessible !== false)
      .map((project) => project.id),
  ];
  const queries = useQueries({
    queries: workspaceIds.map(projectSessionsQueryOptions),
  });
  return useSessions((state) =>
    queries.some((query, index) =>
      (query.data ?? []).some((session) => {
        if (
          session.workspaceId !== workspaceIds[index] ||
          session.archived ||
          session.userMessageCount === 0
        ) {
          return false;
        }
        const view = state.views[session.id];
        return (view?.connected ? view.snapshot?.state.unread : session.unread) === true;
      }),
    ),
  );
};
