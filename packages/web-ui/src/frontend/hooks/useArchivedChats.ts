import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Project, SessionSummary } from "../../shared/protocol";
import { api, command } from "../lib/api";
import { useWorkspace } from "../state/workspace-store";
import { useRequests } from "../state/request-store";

export type ArchivedChat = SessionSummary & { projectName: string };

export const useArchivedChats = () => {
  const client = useQueryClient();
  const sessions = useQuery({
    queryKey: ["archived-chats"],
    queryFn: async ({ signal }): Promise<ArchivedChat[]> => {
      const projects = await api<Project[]>("/workspaces", { signal });
      const groups = await Promise.all(
        projects
          .filter((project) => project.accessible !== false)
          .map(async (project) =>
            (
              await api<SessionSummary[]>(
                "/sessions?workspaceId=" + project.id + "&archived=true",
                { signal },
              )
            ).map((session) => ({ ...session, projectName: project.name })),
          ),
      );
      const standalone = await api<SessionSummary[]>("/sessions?scope=global&archived=true", {
        signal,
      });
      return [
        ...groups.flat(),
        ...standalone
          .filter((session) => session.workspaceId === null)
          .map((session) => ({ ...session, projectName: "" })),
      ];
    },
  });
  const change = useMutation({
    mutationFn: async ({
      selected,
      action,
    }: {
      selected: ArchivedChat[];
      action: "restore" | "delete";
    }) => {
      const projects = [...new Set(selected.map((session) => session.workspaceId))];
      try {
        for (const workspaceId of projects) {
          const ids = selected
            .filter((session) => session.workspaceId === workspaceId)
            .map((session) => session.id);
          await command<void>(
            "/workspaces/" + (workspaceId ?? "global") + "/archive",
            { ids, ...(action === "restore" ? { archived: false } : {}) },
            action === "delete" ? "DELETE" : "POST",
          );
          if (action === "delete") {
            useWorkspace.getState().removeSessions(ids);
            for (const id of ids) useRequests.getState().put(id);
          }
          client.setQueryData<ArchivedChat[]>(["archived-chats"], (current) =>
            current?.filter((session) => !ids.includes(session.id)),
          );
        }
      } finally {
        await Promise.all([
          client.invalidateQueries({ queryKey: ["archived-chats"] }),
          ...projects.map((id) => client.invalidateQueries({ queryKey: ["sessions", id] })),
        ]);
      }
    },
  });
  return { sessions, change };
};
