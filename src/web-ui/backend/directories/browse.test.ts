import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";

import { browseDirectory } from "./browse";

test("lists only folders, supports directory links and rejects relative paths", async () => {
  const root = await mkdtemp(join(import.meta.dir, ".browse-test-"));

  try {
    await mkdir(join(root, "z"));
    await mkdir(join(root, ".hidden"));
    await symlink(join(root, "z"), join(root, "a"));
    await symlink(join(root, "missing"), join(root, "broken"));
    await Bun.write(join(root, "file.txt"), "text");

    const result = await browseDirectory(root);

    expect(result.entries.map((entry) => entry.name)).toEqual([".hidden", "a", "z"]);
    expect(result.entries[0]?.hidden).toBe(true);
    await expect(browseDirectory(".")).rejects.toThrow("absolute_path_required");
    await expect(browseDirectory(join(root, "missing"))).rejects.toThrow("directory_unreadable");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
