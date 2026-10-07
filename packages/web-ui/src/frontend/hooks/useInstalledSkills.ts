import { useQueries } from "@tanstack/react-query";

import type { Project } from "../../shared/protocol";
import type { SkillSummary } from "../../shared/skills";
import { skillQueryOptions } from "./useSkills";

export type InstalledSkill = { skill: SkillSummary; workspaceId?: string };

export const useInstalledSkills = (projects: Project[]) => {
  const scopes = [undefined, ...projects];
  const queries = useQueries({ queries: scopes.map((project) => skillQueryOptions(project?.id)) });
  const entries = new Map<string, InstalledSkill>();
  queries.forEach((query, index) => {
    const project = scopes[index];
    for (const skill of query.data?.skills ?? []) {
      if (entries.has(skill.id) || (skill.scope === "project" && !project)) continue;
      entries.set(skill.id, {
        skill,
        workspaceId: skill.scope === "project" ? project?.id : undefined,
      });
    }
  });
  return {
    entries: [...entries.values()].sort((a, b) => a.skill.name.localeCompare(b.skill.name)),
    loading: queries.some((query) => query.isPending || query.data?.discovering),
    error:
      queries.find((query) => query.error || query.data?.error)?.error ??
      queries.find((query) => query.data?.error)?.data?.error,
  };
};
