import { readdir, lstat, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";

import { parseSkill } from "./skill-file";
import { SkillError } from "./types";
import type { SkillCandidate } from "./types";

export type SkillBundle = {
  candidate: SkillCandidate;
  files: Map<string, Buffer>;
  executable?: Set<string>;
};

export const validateBundlePath = (path: string): void => {
  if (
    !path ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    path.split("/").some((part) => !part || part === "." || part === ".." || part.includes(":"))
  )
    throw new SkillError("skill_bundle_path_invalid");
};

export const createBundle = (key: string, files: Map<string, Buffer>): SkillBundle => {
  const main = files.get("SKILL.md");
  if (!main) throw new SkillError("skill_file_missing", "The folder must contain SKILL.md.");
  const skill = parseSkill(new TextDecoder("utf-8", { fatal: true }).decode(main));
  return {
    candidate: {
      key,
      name: skill.name,
      description: skill.description,
      content: skill.content,
      files: [...files.keys()],
    },
    files,
  };
};

export const readLocalBundle = async (
  directory: string,
  signal: AbortSignal,
): Promise<SkillBundle> => {
  const files = new Map<string, Buffer>();
  const executable = new Set<string>();
  let bytes = 0;
  const walk = async (path: string, prefix = "", depth = 0): Promise<void> => {
    signal.throwIfAborted();
    if (depth > 12) throw new SkillError("skill_bundle_too_large");
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if ([".git", "node_modules", ".DS_Store"].includes(entry.name)) continue;
      const relative = prefix + entry.name;
      validateBundlePath(relative);
      const full = join(path, entry.name);
      const info = await lstat(full);
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile()))
        throw new SkillError(
          "skill_bundle_symlink",
          "Skill installations cannot contain symbolic links or special files.",
        );
      if (info.isDirectory()) {
        await walk(full, relative + "/", depth + 1);
        continue;
      }
      bytes += info.size;
      if (bytes > 20 * 1024 * 1024 || files.size >= 500)
        throw new SkillError("skill_bundle_too_large");
      files.set(relative, await readFile(full, { signal }));
      if (info.mode & 0o111) executable.add(relative);
    }
  };
  if ((await lstat(directory)).isSymbolicLink()) throw new SkillError("skill_bundle_symlink");
  await walk(directory);
  return { ...createBundle("local", files), executable };
};

export const writeBundle = async (
  directory: string,
  bundle: SkillBundle,
  signal: AbortSignal,
): Promise<void> => {
  for (const [path, content] of bundle.files) {
    signal.throwIfAborted();
    validateBundlePath(path);
    await mkdir(dirname(join(directory, path)), { recursive: true, mode: 0o700 });
    await writeFile(join(directory, path), content, {
      flag: "wx",
      mode: bundle.executable?.has(path) ? 0o700 : 0o600,
      signal,
    });
  }
};
