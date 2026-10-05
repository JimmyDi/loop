import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { buildSystemPrompt } from "./system-prompt";

export type ResourceOptions = { systemPrompt?: string; noContextFiles?: boolean };

export async function loadResources(cwd: string, options: ResourceOptions = {}): Promise<string> {
  const files: Array<{ path: string; content: string }> = [];

  if (!options.noContextFiles) {
    const directories: string[] = [];
    let directory = resolve(cwd);

    while (true) {
      directories.unshift(directory);

      const parent = dirname(directory);

      if (parent === directory) break;

      directory = parent;
    }

    for (const dir of directories) {
      for (const name of ["AGENTS.override.md", "AGENTS.md", "CLAUDE.md"]) {
        const path = join(dir, name);
        const file = path;

        if (!(await existsSync(file))) continue;

        files.push({ path, content: await readFile(file, "utf8") });
        break;
      }
    }
  }

  return buildSystemPrompt(cwd, options.systemPrompt, files);
}
