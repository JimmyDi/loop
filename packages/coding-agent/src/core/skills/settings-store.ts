import { readFile, mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import { SkillError } from "./types";
import type { SkillSettings } from "./types";

export const readSkillSettings = async (file: string): Promise<SkillSettings> => {
  try {
    const data = JSON.parse(await readFile(file, "utf8"));
    if (
      data.version !== 1 ||
      !Array.isArray(data.disabled) ||
      data.disabled.some((id: unknown) => typeof id !== "string") ||
      !data.installations ||
      typeof data.installations !== "object" ||
      Array.isArray(data.installations)
    )
      throw new Error();
    for (const value of Object.values(data.installations)) {
      const source = value as Record<string, unknown> | undefined;
      if (
        !source ||
        !["github", "local", "created"].includes(String(source.kind)) ||
        ["location", "ref", "revision", "subdirectory"].some(
          (key) => source[key] !== undefined && typeof source[key] !== "string",
        )
      )
        throw new Error();
    }
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, disabled: [], installations: {} };
    throw new SkillError("skill_settings_invalid", "Skill settings could not be read.");
  }
};

export const writeSkillSettings = async (file: string, data: SkillSettings): Promise<void> => {
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
};
