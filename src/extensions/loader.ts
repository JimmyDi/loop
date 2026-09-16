import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Skill } from "./types";

export const loadSkills = async (directory: string): Promise<Skill[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const skills: Skill[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const name = entry.name.slice(0, -3);
    const instructions = await Bun.file(join(directory, entry.name)).text();
    skills.push({ name, description: `Loaded skill: ${name}`, instructions });
  }
  return skills;
};
