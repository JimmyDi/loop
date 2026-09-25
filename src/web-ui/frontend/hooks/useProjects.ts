import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Project } from "../../shared/protocol";
import { api, command } from "../lib/api";

export const useProjects = () => {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["projects"] });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/workspaces"),
  });
  const add = useMutation({
    mutationFn: (path: string) => command<Project>("/workspaces", { path }),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      command<Project>("/workspaces/" + id, { name }, "PATCH"),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => command<void>("/workspaces/" + id, undefined, "DELETE"),
    onSuccess: refresh,
  });

  return { projects, add, rename, remove };
};
