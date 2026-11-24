import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";

import { createUpdateManifest } from "./release-manifest";

test("publishes a complete versioned desktop manifest and rejects missing signatures", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-manifest-"));
  try {
    for (const target of ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]) {
      await mkdir(join(root, target));
      const name = target.startsWith("darwin") ? "Loop.app.tar.gz" : "Loop.exe";
      await writeFile(join(root, target, name), "synthetic");
      await writeFile(join(root, target, name + ".sig"), "c3ludGhldGlj");
    }
    const result = await createUpdateManifest(root, "1.2.3", "example/loop");
    expect(Object.keys(result.platforms)).toHaveLength(3);
    expect(result.platforms["darwin-aarch64"]?.url).toContain(
      "desktop-v1.2.3/darwin-aarch64-Loop.app.tar.gz",
    );
    await rm(join(root, "windows-x86_64/Loop.exe.sig"));
    await expect(createUpdateManifest(root, "1.2.3", "example/loop")).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
