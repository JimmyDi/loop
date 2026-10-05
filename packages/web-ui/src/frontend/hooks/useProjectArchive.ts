import { useMutation, useQueryClient } from "@tanstack/react-query";

import { command } from "../lib/api";
import { useWorkspace } from "../state/workspace-store";

export const useProjectArchive = (workspaceId: string) => {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, archived }: { ids: string[]; archived: boolean }) =>
      command<void>("/workspaces/" + workspaceId + "/archive", { ids, archived }),
    onSuccess: async (_, { ids, archived }) => {
      const active = useWorkspace.getState().active;
      if (archived && active?.workspaceId === workspaceId && ids.includes(active.id))
        useWorkspace.setState({ active: undefined });
      await Promise.all([
        query.invalidateQueries({ queryKey: ["sessions", workspaceId] }),
        query.invalidateQueries({ queryKey: ["archived-chats"] }),
      ]);
    },
  });
};
