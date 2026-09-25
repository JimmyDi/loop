import { readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import type { DirectoryListing } from "../../shared/protocol";
import { HttpError } from "../http/errors";

export const browseDirectory = async (path = homedir()): Promise<DirectoryListing> => {
  if (!isAbsolute(path)) throw new HttpError(400, "absolute_path_required");

  try {
    const canonical = await realpath(path);
    const names = await readdir(canonical, { withFileTypes: true });
    const directories = names.filter((entry) => entry.isDirectory() || entry.isSymbolicLink());
    const selected = directories.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 1000);
    const entries = await Promise.all(
      selected.map(async (entry) => {
        const path = join(canonical, entry.name);

        if (!(await stat(path).catch(() => undefined))?.isDirectory()) return undefined;

        return { name: entry.name, path, hidden: entry.name.startsWith(".") };
      }),
    );

    return {
      path: canonical,
      parent: dirname(canonical),
      home: homedir(),
      entries: entries.filter((entry) => entry !== undefined),
      truncated: directories.length > 1000,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw new HttpError(400, "directory_unreadable");
  }
};
