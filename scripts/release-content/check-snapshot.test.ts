import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

import { checkReleaseSnapshot } from "./check-snapshot";
import { createReleaseContent } from "./snapshot";

test("release check rejects docs edited after the snapshot was prepared", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".snapshot-test-"));
  try {
    for (const path of [
      "releases",
      "docs",
      "packages/web-ui/src/frontend",
      "packages/coding-agent",
      "packages/agent",
    ])
      await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    await writeFile(
      join(root, "CHANGELOG.md"),
      "## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n- Synthetic feature.\n",
    );
    for (const path of [
      "README.md",
      "docs/development.md",
      "packages/web-ui/src/frontend/README.md",
      "packages/coding-agent/README.md",
      "packages/agent/README.md",
    ])
      await writeFile(join(root, path), "# Synthetic docs\n\nReleased content.\n");
    const content = await createReleaseContent(root, "1.0.0", "Synthetic summary");
    await writeFile(join(root, "releases/1.0.0.json"), JSON.stringify(content));
    await expect(checkReleaseSnapshot(root, "1.0.0")).resolves.toBeUndefined();
    await writeFile(
      join(root, "README.md"),
      (await readFile(join(root, "README.md"), "utf8")) + "Changed docs.",
    );
    await expect(checkReleaseSnapshot(root, "1.0.0")).rejects.toThrow("stale");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
