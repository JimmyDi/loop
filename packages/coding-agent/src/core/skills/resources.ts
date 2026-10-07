import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const listSkillResources = async (mainFile: string): Promise<string[]> => {
  const files: string[] = [];
  const visit = async (directory: string, prefix = "", depth = 0): Promise<void> => {
    if (depth > 12 || files.length >= 500) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", ".DS_Store"].includes(entry.name)) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(directory, entry.name), name + "/", depth + 1);
      else files.push(name + (entry.isSymbolicLink() ? " (link)" : ""));
      if (files.length >= 500) break;
    }
  };
  await visit(dirname(mainFile));
  return files.sort();
};
