import { access, readdir, realpath } from "node:fs/promises";
import { join, dirname, resolve, basename } from "node:path";

import { readSkill, skillId } from "./skill-file";
import type { SkillSummary, SkillSettings, SkillScope } from "./types";

export const projectSkillRoots = async (cwd: string): Promise<string[]> => {
  const roots: string[] = [];
  let current = await realpath(cwd);
  while (true) {
    roots.push(join(current, ".agents", "skills"));
    if (
      await access(join(current, ".git")).then(
        () => true,
        () => false,
      )
    )
      break;
    const parent = dirname(current);
    if (parent === current) {
      // Outside a repository, only the selected working directory owns project skills.
      return [join(await realpath(cwd), ".agents", "skills")];
    }
    current = parent;
  }
  return roots;
};

export const discoverSkills = async (
  cwd: string,
  agentDir: string,
  agentsDir: string,
  settings: SkillSettings,
): Promise<SkillSummary[]> => {
  const roots: Array<{ path: string; scope: SkillScope }> = [
    ...(resolve(cwd) === resolve(agentDir) ? [] : await projectSkillRoots(cwd)).map((path) => ({
      path,
      scope: "project" as const,
    })),
    { path: join(agentDir, "skills"), scope: "personal" },
    { path: join(agentsDir, "skills"), scope: "personal" },
  ];
  const found = new Map<string, SkillSummary>();
  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root.path, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    if (entries.length > 2000) throw new Error("Too many entries in skill directory.");
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
      const file = join(root.path, entry.name, "SKILL.md");
      let path;
      try {
        path = await realpath(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      const id = skillId(path);
      if (found.has(id)) continue;
      const managed = settings.installations[path];
      const base = {
        id,
        path,
        scope: root.scope,
        enabled: !settings.disabled.includes(id),
        managed: !!managed,
        source: managed ?? { kind: "discovered" as const },
      };
      try {
        const skill = await readSkill(path);
        found.set(id, {
          ...base,
          name: skill.name,
          description: skill.description,
          modelInvocable: skill.modelInvocable,
          handle: skill.name + "-" + id,
        });
      } catch (error) {
        found.set(id, {
          ...base,
          name: basename(dirname(path)),
          description: "",
          modelInvocable: false,
          handle: "invalid-" + id,
          error: error instanceof Error ? error.message : "Invalid skill",
        });
      }
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
};
