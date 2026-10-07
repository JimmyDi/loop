import type { PromptContent } from "@loop/agent";

import type { SkillManager } from "./skill-manager";
import { SkillError } from "./types";

export const resolveSkillSelection = async (
  manager: SkillManager,
  cwd: string,
  content: PromptContent,
  selected: string[],
): Promise<string[]> => {
  // Structured prompts may contain reference attachments, not user invocations.
  const text = typeof content === "string" ? content : "";
  const names = [...text.matchAll(/(?:^|\s)\$([a-z0-9]+(?:-[a-z0-9]+)*)(?=$|\s|[.,!?;:])/g)].map(
    (match) => match[1]!,
  );
  if (!names.length) return [...new Set(selected)];
  await manager.refresh(cwd);
  const skills = manager.view(cwd).skills;
  const ids = new Set(selected);
  for (const name of new Set(names)) {
    const matches = skills.filter((skill) => skill.name === name);
    if (!matches.length) continue;
    if (matches.some((skill) => ids.has(skill.id))) continue;
    if (matches.length > 1)
      throw new SkillError(
        "skill_name_ambiguous",
        "Several skills use this name; select an exact skill in the picker.",
      );
    ids.add(matches[0]!.id);
  }
  if (ids.size > 8) throw new SkillError("skill_selection_invalid", "Select at most eight skills.");
  return [...ids];
};
