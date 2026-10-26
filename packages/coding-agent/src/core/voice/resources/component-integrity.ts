import { lstat } from "node:fs/promises";
import { join } from "node:path";

import { matchesResource } from "./download";
import { componentDirectory } from "./resource-paths";
import type { VoiceComponent } from "./resource-types";

export const componentPresent = async (
  root: string,
  component: VoiceComponent,
  verify = false,
): Promise<boolean> => {
  const directory = componentDirectory(root, component);
  for (const file of component.files) {
    try {
      const path = join(directory, file.path);
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size !== file.bytes ||
        (verify && !(await matchesResource(path, file)))
      )
        return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
};
