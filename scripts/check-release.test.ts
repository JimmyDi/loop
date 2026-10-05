import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test.each([
  [404, 0, "Release metadata validated"],
  [200, 1, "already exists"],
  [403, 1, "Cannot confirm npm version availability"],
  [500, 1, "Cannot confirm npm version availability"],
  [0, 1, "Registry unavailable"],
])(
  "release command handles registry status %i without publishing",
  async (status, exit, message) => {
    const root = await mkdtemp(fileURLToPath(new URL("../.release-check-", import.meta.url)));
    try {
      await mkdir(join(root, "scripts"));
      for (const name of ["check-release.mjs", "release.ts"])
        await copyFile(new URL(name, import.meta.url), join(root, "scripts", name));
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({
          type: "module",
          name: "@loop-harness/loop",
          version: "0.1.1",
          private: false,
          repository: { type: "git", url: "git+https://github.com/example/loop.git" },
          publishConfig: { access: "public", registry: "https://registry.npmjs.org/" },
        }),
      );
      await writeFile(
        join(root, "CHANGELOG.md"),
        "## [Unreleased]\n\n## [0.1.1] - 2026-01-01\n\n### Fixed\n\n- CLI: fix startup.\n",
      );
      await writeFile(
        join(root, "registry.mjs"),
        `globalThis.fetch = async (url, options) => {
        if (url !== "https://registry.npmjs.org/%40loop-harness%2Floop/0.1.1" || !options.signal)
          throw Error("Unexpected registry request");
        if (${status} === 0) throw Error("Registry unavailable");
        return new Response(null, { status: ${status} });
      };`,
      );
      const result = spawnSync(
        process.execPath,
        ["--import", join(root, "registry.mjs"), join(root, "scripts/check-release.mjs")],
        {
          cwd: root,
          encoding: "utf8",
          timeout: 10000,
          env: {
            ...process.env,
            GITHUB_REF_TYPE: "tag",
            GITHUB_REF_NAME: "v0.1.1",
            GITHUB_REPOSITORY: "example/loop",
          },
        },
      );
      expect(result.status, result.stderr).toBe(exit);
      expect(result.stdout + result.stderr).toContain(message);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
