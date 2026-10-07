import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { expect, test } from "vitest";

import { validateBundlePath, readLocalBundle } from "./bundle";

test("rejects traversal and local symlink resources", async () => {
  for (const path of ["../SKILL.md", "/SKILL.md", "a/../b", "a\\b", "C:/secret", "a//b"])
    expect(() => validateBundlePath(path)).toThrow();
  const root = await mkdtemp(join(tmpdir(), "loop-bundle-"));
  try {
    await symlink(root, join(root, "alias"));
    await expect(readLocalBundle(root, new AbortController().signal)).rejects.toThrow(
      "symbolic links",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
