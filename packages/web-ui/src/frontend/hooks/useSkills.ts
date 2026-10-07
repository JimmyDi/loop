import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  SkillCatalog,
  SkillJob,
  SkillPreviewInput,
  SkillScope,
  SkillSummary,
} from "../../shared/skills";
import { api, command } from "../lib/api";

export const skillQueryPath = (workspaceId?: string) =>
  workspaceId ? "?workspaceId=" + encodeURIComponent(workspaceId) : "";

export const skillQueryOptions = (workspaceId?: string) => ({
  queryKey: ["skills", workspaceId ?? "personal"],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    api<SkillCatalog>("/settings/skills" + skillQueryPath(workspaceId), { signal }),
  refetchInterval: 3000,
  retry: false as const,
});

export const useSkills = (workspaceId?: string, enabled = true) => {
  const client = useQueryClient();
  const suffix = skillQueryPath(workspaceId);
  const query = useQuery({
    ...skillQueryOptions(workspaceId),
    enabled,
  });
  const refresh = async () => {
    await command("/settings/skills/refresh" + suffix);
    await client.invalidateQueries({ queryKey: ["skills"] });
  };
  const mutate = async (path: string, body?: unknown, method = "POST") => {
    const result = await command("/settings/skills" + path + suffix, body, method);
    await client.invalidateQueries({ queryKey: ["skills"] });
    return result;
  };
  return {
    query,
    refresh,
    preview: (input: SkillPreviewInput) =>
      command<SkillJob>("/settings/skills/preview" + suffix, input),
    job: (id: string) => api<SkillJob>("/settings/skills/jobs/" + id + suffix),
    cancel: (id: string) =>
      command<void>("/settings/skills/jobs/" + id + suffix, undefined, "DELETE"),
    install: (jobId: string, keys: string[], scope: SkillScope, updateId?: string) =>
      mutate("/install", { jobId, keys, scope, updateId }),
    detail: (id: string) =>
      api<SkillSummary & { content: string; files?: string[] }>("/settings/skills/" + id + suffix),
    toggle: (id: string, enabled: boolean) => mutate("/" + id + "/enabled", { enabled }, "PATCH"),
    remove: (id: string) => mutate("/" + id, undefined, "DELETE"),
    update: (id: string) => command<SkillJob>("/settings/skills/" + id + "/update" + suffix),
  };
};
