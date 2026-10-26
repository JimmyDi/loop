import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { matchesResource } from "./download";
import { safeResourcePath } from "./resource-paths";
import type { VoiceComponent } from "./resource-types";

export const verifyLocalComponent = async (
  root: string,
  component: VoiceComponent,
): Promise<void> => {
  const visit = async (directory: string, prefix = ""): Promise<string[]> => {
    const paths: string[] = [];
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = prefix + item.name;
      if (!safeResourcePath(path) || item.isSymbolicLink())
        throw new Error("voice_resource_path_invalid");
      if (item.isDirectory()) paths.push(...(await visit(join(directory, item.name), path + "/")));
      else if (item.isFile()) paths.push(path);
      else throw new Error("voice_resource_path_invalid");
    }
    return paths;
  };
  const paths = (await visit(root)).filter((path) => path !== "engine-manifest.json");
  if (
    paths.length !== component.files.length ||
    paths.some((path) => !component.files.some((file) => file.path === path))
  )
    throw new Error("voice_resource_files_invalid");
  for (const file of component.files)
    if (!(await matchesResource(join(root, file.path), file)))
      throw new Error("voice_resource_integrity_failed");
};
