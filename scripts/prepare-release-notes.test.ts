import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("release notes include only the selected version and both registry identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-release-notes-"));
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "@loop-harness/loop", version: "0.5.0" }),
    );
    await writeFile(
      join(root, "CHANGELOG.md"),
      "## [Unreleased]\n\n- Pending.\n\n## [0.5.0] - 2026-10-30\n\n### Added\n\n- Feature.\n\n## [0.4.0] - 2026-10-29\n\n- Previous.\n",
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./prepare-release-notes.mjs", import.meta.url))],
        { cwd: root, env: process.env },
      );
    expect(run().status).toBe(0);
    const notes = await readFile(join(root, "release-notes.md"), "utf8");
    expect(notes).toContain("### Added\n\n- Feature.");
    expect(notes).toContain("@loop-harness/loop@0.5.0");
    expect(notes).toContain("GitHub Packages: `@loop-harness/loop@0.5.0`");
    expect(notes).not.toContain("Pending");
    expect(notes).not.toContain("Previous");
    await writeFile(join(root, "CHANGELOG.md"), "## [Unreleased]\n");
    expect(run().status).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
