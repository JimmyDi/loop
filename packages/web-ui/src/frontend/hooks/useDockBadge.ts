import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useSessions } from "../state/session-store";
import { useProjects } from "./useProjects";
import { projectSessionsQueryOptions } from "./useProjectSessions";

type DesktopWindow = Window & {
  __LOOP_MACOS_TITLEBAR__?: boolean;
  __TAURI_INTERNALS__?: {
    invoke(command: string, args: { value: number | null }): Promise<unknown>;
  };
};

export const useDockBadge = (): void => {
  const desktop = window as DesktopWindow;
  const native = desktop.__LOOP_MACOS_TITLEBAR__ ? desktop.__TAURI_INTERNALS__ : undefined;
  const { projects } = useProjects(Boolean(native));
  const workspaceIds = native
    ? [
        null,
        ...(projects.data ?? [])
          .filter((project) => project.accessible !== false)
          .map((project) => project.id),
      ]
    : [];
  const queries = useQueries({ queries: workspaceIds.map(projectSessionsQueryOptions) });
  const loading = projects.isPending || queries.some((query) => query.isPending);
  const count = useSessions((state) => {
    let unread = 0;
    for (const [index, query] of queries.entries()) {
      for (const session of query.data ?? []) {
        if (
          session.workspaceId !== workspaceIds[index] ||
          session.archived ||
          session.userMessageCount === 0
        ) {
          continue;
        }
        const view = state.views[session.id];
        const liveUnread = view?.connected ? view.snapshot?.state.unread : undefined;
        if ((liveUnread ?? session.unread) === true) unread++;
      }
    }
    return unread;
  });

  const update = useRef(Promise.resolve());
  useEffect(() => {
    if (!native || loading) return;
    let cancelled = false;
    update.current = update.current
      .then(async () => {
        if (!cancelled)
          await native.invoke("plugin:window|set_badge_count", { value: count || null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [count, loading, native]);
};
